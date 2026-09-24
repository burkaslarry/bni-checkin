/**
 * [F003][S302]
 * Feature: Guest Registration
 * Step: Match Leadership Team term
 * Description: Term number stored in bni_eventxp_guests.lt_term.
 * Dates before 2026-10-01 are term 2.
 * 2026-10-01 through 2027-03-31 is term 3, then each following six months increments.
 */
export function guestLtTermNumber(eventDate: string | undefined | null): number | null {
  const raw = eventDate?.trim().slice(0, 10) ?? "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (raw < "2026-10-01") return 2;

  const monthsSinceOct2026 = (year - 2026) * 12 + (month - 10);
  return 3 + Math.floor(monthsSinceOct2026 / 6);
}

/**
 * [F003][S404]
 * Feature: Guest Registration
 * Step: Render LT label
 * Description: Display form of an LT term number, e.g. "第 3 屆 LT".
 */
export function formatGuestLtTerm(term: number): string {
  return `第 ${term} 屆 LT`;
}

/**
 * [F003][S302]
 * Feature: Guest Registration
 * Step: Match Leadership Team term
 * Description: Label for an event date. Null when the date is missing or invalid.
 */
export function guestLtTermLabel(eventDate: string | undefined | null): string | null {
  const term = guestLtTermNumber(eventDate);
  return term == null ? null : formatGuestLtTerm(term);
}

/**
 * [F003][S404]
 * Feature: Guest Registration
 * Step: Filter guests by LT term
 * Description: Prefer bni_eventxp_guests.lt_term. Fall back to the event date when the column is empty.
 */
export function resolveGuestLtTerm(guest: {
  ltTerm?: number | string | null;
  eventDate?: string | null;
}): number | null {
  const raw = guest.ltTerm;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return guestLtTermNumber(guest.eventDate);
}
