import type { GuestInfo } from "../api";

/** Match guest when every keyword appears in name, profession, referrer, or event date. */
export function guestMatchesKeywords(guest: GuestInfo, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [
    guest.name,
    guest.profession,
    guest.referrer || "",
    guest.eventDate || "",
  ]
    .join(" ")
    .toLowerCase();

  const keywords = trimmed.split(/\s+/).filter(Boolean);
  return keywords.every((keyword) => haystack.includes(keyword));
}
