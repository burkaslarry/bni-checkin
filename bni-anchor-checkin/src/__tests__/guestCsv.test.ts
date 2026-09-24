import { describe, expect, it } from "vitest";
import { guestsToCsv } from "../lib/guestCsv";
import type { GuestInfo } from "../api";

const guest = (overrides: Partial<GuestInfo>): GuestInfo => ({
  name: "Amy Chan",
  profession: "會計",
  referrer: "Larry Lo",
  eventDate: "2026-07-16",
  phoneNumber: "91234567",
  ...overrides,
});

describe("guestsToCsv", () => {
  it("uses the guest import columns", () => {
    const csv = guestsToCsv([guest({})]);
    expect(csv.split("\n")[0]).toBe("name,profession,phone,referrer,event_date");
    expect(csv).toContain("Amy Chan,會計,91234567,Larry Lo,2026-07-16");
  });

  it("quotes values that contain commas", () => {
    const csv = guestsToCsv([guest({ profession: "會計, 稅務" })]);
    expect(csv).toContain('"會計, 稅務"');
  });

  it("leaves missing phone and date empty", () => {
    const csv = guestsToCsv([
      guest({ phoneNumber: undefined, eventDate: undefined, referrer: "" }),
    ]);
    expect(csv).toContain("Amy Chan,會計,,,");
  });
});
