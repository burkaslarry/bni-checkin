import Papa from "papaparse";

export type ParsedGuest = {
  name: string;
  profession: string;
  referrer: string;
  eventDate: string;
};

export type ParsedObserver = {
  name: string;
  profession: string;
  eventDate: string;
};

export type ParsedSubstitute = {
  substituteName: string;
  memberName: string;
  eventDate: string;
};

export type ParsedMeetingMessage = {
  eventDate: string;
  guests: ParsedGuest[];
  observers: ParsedObserver[];
  substitutes: ParsedSubstitute[];
  errors: string[];
};

/** WhatsApp / iOS paste: WJ, ZWSP, LRM/RLM, NBSP, soft hyphen. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;
const NBSP_CHARS = /[\u00A0\u202F\u2007]/g;
const EMOJI_CHARS = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu;
/** Numbered list: 1.  1．  1、  1)  1） */
const LINE_NUMBER_PREFIX = /^\d+\s*[.．、)）]\s*/;

export function normalizeMeetingLine(raw: string): string {
  return raw.replace(INVISIBLE_CHARS, "").replace(NBSP_CHARS, " ").trim();
}

/** Strip WhatsApp / copy-paste invisible characters and list numbering. */
export function cleanMeetingLine(raw: string): string {
  return normalizeMeetingLine(raw).replace(LINE_NUMBER_PREFIX, "").trim();
}

function isNumberedMeetingLine(line: string): boolean {
  return LINE_NUMBER_PREFIX.test(normalizeMeetingLine(line));
}

function isGuestLikeLine(line: string): boolean {
  const cleaned = normalizeMeetingLine(line);
  if (!cleaned || /嘉賓名單|觀察員|替代人/.test(cleaned)) return false;
  return isNumberedMeetingLine(cleaned) || /[/／]/.test(cleaned);
}

/** Parse 2026年8月13日 or embedded YYYY-MM-DD from meeting announcement text. */
export function parseMeetingEventDate(text: string): string | null {
  const zh = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (zh) {
    return `${zh[1]}-${zh[2].padStart(2, "0")}-${zh[3].padStart(2, "0")}`;
  }
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return iso ? iso[1] : null;
}

export function cleanReferrer(raw: string): string {
  return raw.replace(EMOJI_CHARS, "").trim();
}

/** Split "Name / Profession / Referrer" lines (supports full-width slashes). */
export function splitPersonLine(line: string): { name: string; profession: string; referrer: string } | null {
  const cleaned = cleanMeetingLine(line);
  if (!cleaned) return null;

  const firstSlash = cleaned.search(/[/／]/);
  if (firstSlash < 0) return null;

  const name = cleaned.slice(0, firstSlash).trim();
  const remainder = cleaned.slice(firstSlash + 1);
  const lastSlash = Math.max(remainder.lastIndexOf("/"), remainder.lastIndexOf("／"));

  if (lastSlash < 0) {
    return { name, profession: remainder.trim(), referrer: "" };
  }

  return {
    name,
    profession: remainder.slice(0, lastSlash).trim(),
    referrer: cleanReferrer(remainder.slice(lastSlash + 1)),
  };
}

/** Split "Substitute Name / Member Name" (替代人名單). */
export function splitSubstituteLine(line: string): { substituteName: string; memberName: string } | null {
  const cleaned = cleanMeetingLine(line);
  if (!cleaned) return null;
  const slash = cleaned.search(/[/／]/);
  if (slash < 0) return null;
  const substituteName = cleaned.slice(0, slash).trim();
  const memberName = cleaned.slice(slash + 1).trim();
  if (!substituteName || !memberName) return null;
  return { substituteName, memberName };
}

function extractSectionLines(text: string, startPattern: RegExp, endPattern: RegExp): string[] {
  const startMatch = text.match(startPattern);
  if (!startMatch || startMatch.index == null) return [];

  const from = startMatch.index + startMatch[0].length;
  const rest = text.slice(from);
  const endMatch = rest.match(endPattern);
  const block = endMatch && endMatch.index != null ? rest.slice(0, endMatch.index) : rest;

  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const numbered = lines.filter(isNumberedMeetingLine);
  if (numbered.length > 0) return numbered;
  return lines.filter(isGuestLikeLine);
}

function extractSectionLinesToEnd(text: string, startPattern: RegExp): string[] {
  const startMatch = text.match(startPattern);
  if (!startMatch || startMatch.index == null) return [];
  const block = text.slice(startMatch.index + startMatch[0].length);
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const numbered = lines.filter(isNumberedMeetingLine);
  if (numbered.length > 0) return numbered;
  return lines.filter(isGuestLikeLine);
}

export type ParseMeetingMessageOptions = {
  /** Used when the paste has no date (e.g. 替代人名單 only). */
  fallbackEventDate?: string;
};

/**
 * Parse Anchor-style WhatsApp meeting announcements into guest, observer, and substitute rows.
 * Accepts a full meeting announcement or a standalone 替代人名單 block.
 */
export function parseWhatsAppMeetingMessage(
  text: string,
  options?: ParseMeetingMessageOptions
): ParsedMeetingMessage {
  const errors: string[] = [];
  const normalized = text.replace(/\r\n/g, "\n");
  const parsedDate = parseMeetingEventDate(normalized);
  const fallbackDate = options?.fallbackEventDate?.trim() || "";
  const eventDate = parsedDate || fallbackDate;

  if (!eventDate) {
    errors.push("找不到活動日期（例如 2026年8月13日）");
  }

  const guestLines = extractSectionLines(
    normalized,
    /嘉賓名單[^\n]*/i,
    /(?:觀察員|替代人)/i
  );
  const observerLines = extractSectionLines(
    normalized,
    /觀察員[^\n]*/i,
    /替代人/i
  );
  const substituteLines = extractSectionLinesToEnd(normalized, /替代人[^\n]*/i);

  const guests: ParsedGuest[] = [];
  for (const line of guestLines) {
    const parts = splitPersonLine(line);
    if (!parts?.name || !parts.profession) {
      errors.push(`無法解析嘉賓行：${cleanMeetingLine(line)}`);
      continue;
    }
    guests.push({
      name: parts.name,
      profession: parts.profession,
      referrer: parts.referrer,
      eventDate: eventDate || "",
    });
  }

  const observers: ParsedObserver[] = [];
  for (const line of observerLines) {
    const parts = splitPersonLine(line);
    if (!parts?.name || !parts.profession) {
      errors.push(`無法解析觀察員行：${cleanMeetingLine(line)}`);
      continue;
    }
    observers.push({
      name: parts.name,
      profession: parts.profession,
      eventDate: eventDate || "",
    });
  }

  const substitutes: ParsedSubstitute[] = [];
  for (const line of substituteLines) {
    const parts = splitSubstituteLine(line);
    if (!parts) {
      errors.push(`無法解析替代人行：${cleanMeetingLine(line)}`);
      continue;
    }
    substitutes.push({
      substituteName: parts.substituteName,
      memberName: parts.memberName,
      eventDate: eventDate || "",
    });
  }

  if (guestLines.length === 0 && observerLines.length === 0 && substituteLines.length === 0) {
    errors.push("找不到嘉賓名單、觀察員或替代人段落（請確認已貼上完整會議訊息）");
  }

  return { eventDate: eventDate || "", guests, observers, substitutes, errors };
}

export function guestListToCsv(guests: ParsedGuest[]): string {
  return Papa.unparse(
    guests.map((g) => ({
      name: g.name,
      profession: g.profession,
      phone: "",
      referrer: g.referrer,
      event_date: g.eventDate,
    })),
    { columns: ["name", "profession", "phone", "referrer", "event_date"] }
  );
}

export function observerListToCsv(observers: ParsedObserver[]): string {
  return Papa.unparse(
    observers.map((o) => ({
      name: o.name,
      profession: o.profession,
      event_date: o.eventDate,
    })),
    { columns: ["name", "profession", "event_date"] }
  );
}

export function substituteListToCsv(substitutes: ParsedSubstitute[]): string {
  return Papa.unparse(
    substitutes.map((s) => ({
      substitute_name: s.substituteName,
      member_name: s.memberName,
      event_date: s.eventDate,
    })),
    { columns: ["substitute_name", "member_name", "event_date"] }
  );
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
