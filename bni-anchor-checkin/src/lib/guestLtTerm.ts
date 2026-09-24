/**
 * Guest Leadership Team term from the event date.
 * Dates before 2026-10-01 are 第 2 屆 LT.
 * 2026-10-01 through 2027-03-31 is 第 3 屆 LT, then each following six months increments.
 */
export function guestLtTermLabel(eventDate: string | undefined | null): string | null {
  const raw = eventDate?.trim().slice(0, 10) ?? "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (raw < "2026-10-01") return "第 2 屆 LT";

  const monthsSinceOct2026 = (year - 2026) * 12 + (month - 10);
  const term = 3 + Math.floor(monthsSinceOct2026 / 6);
  return `第 ${term} 屆 LT`;
}
