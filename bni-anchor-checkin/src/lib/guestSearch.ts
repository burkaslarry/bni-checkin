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

/** Sort by event date. Guests with no date stay at the end. */
export function sortGuestsByEventDate(
  guests: GuestInfo[],
  direction: "asc" | "desc"
): GuestInfo[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...guests].sort((a, b) => {
    const left = a.eventDate?.trim() || "";
    const right = b.eventDate?.trim() || "";
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right) * factor;
  });
}
