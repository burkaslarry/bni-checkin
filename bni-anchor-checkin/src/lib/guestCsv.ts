import Papa from "papaparse";
import type { GuestInfo } from "../api";

const COLUMNS = ["name", "profession", "phone", "referrer", "event_date"] as const;

/** CSV matching the guest bulk-import template. */
export function guestsToCsv(guests: GuestInfo[]): string {
  return Papa.unparse(
    guests.map((guest) => ({
      name: guest.name,
      profession: guest.profession ?? "",
      phone: guest.phoneNumber ?? "",
      referrer: guest.referrer ?? "",
      event_date: guest.eventDate ?? "",
    })),
    { columns: [...COLUMNS], newline: "\n" }
  );
}

export function downloadGuestCsv(filename: string, guests: GuestInfo[]): void {
  const blob = new Blob(["\uFEFF" + guestsToCsv(guests)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
