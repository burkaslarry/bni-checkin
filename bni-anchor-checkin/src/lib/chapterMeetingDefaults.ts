/** JS Date.getDay(): 0=Sunday … 6=Saturday */

export const WEEKDAY_OPTIONS: Array<{ value: number; labelEn: string; labelZh: string }> = [
  { value: 0, labelEn: "Sunday", labelZh: "星期日" },
  { value: 1, labelEn: "Monday", labelZh: "星期一" },
  { value: 2, labelEn: "Tuesday", labelZh: "星期二" },
  { value: 3, labelEn: "Wednesday", labelZh: "星期三" },
  { value: 4, labelEn: "Thursday", labelZh: "星期四" },
  { value: 5, labelEn: "Friday", labelZh: "星期五" },
  { value: 6, labelEn: "Saturday", labelZh: "星期六" },
];

export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Next occurrence of `weekday` on or after `from` (local calendar). */
export function nextWeekdayOnOrAfter(from: Date, weekday: number): Date {
  const target = ((weekday % 7) + 7) % 7;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Fallback when chapter.meetingWeekday is missing: Anchor Thu; AMax/Dynasty Wed. */
export function defaultMeetingWeekdayForTag(tag: string | null | undefined): number {
  const t = (tag || "anchor").trim().toLowerCase();
  if (t === "amax" || t === "dynasty") return 3;
  return 4;
}

export function resolveMeetingWeekday(
  meetingWeekday: number | null | undefined,
  tag: string | null | undefined
): number {
  if (typeof meetingWeekday === "number" && meetingWeekday >= 0 && meetingWeekday <= 6) {
    return meetingWeekday;
  }
  return defaultMeetingWeekdayForTag(tag);
}

/** Default create-event title: "{displayName} Business Meeting {YYYY-MM-DD}". */
export function defaultBusinessMeetingName(displayName: string, dateYmd: string): string {
  const chapter = displayName.trim() || "BNI Chapter";
  return `${chapter} Business Meeting ${dateYmd}`;
}

export function isDefaultBusinessMeetingName(
  name: string,
  displayName: string,
  dateYmd: string
): boolean {
  return name.trim() === defaultBusinessMeetingName(displayName, dateYmd);
}

export function buildMeetingDefaults(opts: {
  displayName: string;
  tag?: string | null;
  meetingWeekday?: number | null;
  from?: Date;
}): { weekday: number; date: string; name: string } {
  const weekday = resolveMeetingWeekday(opts.meetingWeekday, opts.tag);
  const dateObj = nextWeekdayOnOrAfter(opts.from ?? new Date(), weekday);
  const date = formatLocalYmd(dateObj);
  const name = defaultBusinessMeetingName(opts.displayName, date);
  return { weekday, date, name };
}
