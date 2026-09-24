import { describe, expect, it } from "vitest";
import { guestMatchesKeywords, sortGuestsByEventDate } from "../lib/guestSearch";
import type { GuestInfo } from "../api";

const guest = (overrides: Partial<GuestInfo>): GuestInfo => ({
  name: "Amy Chan",
  profession: "會計",
  referrer: "Larry Lo",
  eventDate: "2026-07-16",
  ...overrides,
});

describe("guestMatchesKeywords", () => {
  it("returns all guests when query is empty", () => {
    expect(guestMatchesKeywords(guest({}), "")).toBe(true);
  });

  it("matches keywords across name, profession, referrer, and event date", () => {
    expect(guestMatchesKeywords(guest({}), "amy 會計")).toBe(true);
    expect(guestMatchesKeywords(guest({}), "larry 2026-07")).toBe(true);
    expect(guestMatchesKeywords(guest({}), "amy 不存在")).toBe(false);
  });
});

describe("sortGuestsByEventDate", () => {
  it("sorts newest first and keeps missing dates last", () => {
    const sorted = sortGuestsByEventDate(
      [
        guest({ name: "Amy", eventDate: "2026-07-16" }),
        guest({ name: "NoDate", eventDate: undefined }),
        guest({ name: "Ben", eventDate: "2026-08-01" }),
      ],
      "desc"
    );
    expect(sorted.map((g) => g.name)).toEqual(["Ben", "Amy", "NoDate"]);
  });

  it("sorts oldest first", () => {
    const sorted = sortGuestsByEventDate(
      [
        guest({ name: "Ben", eventDate: "2026-08-01" }),
        guest({ name: "Amy", eventDate: "2026-07-16" }),
      ],
      "asc"
    );
    expect(sorted.map((g) => g.name)).toEqual(["Amy", "Ben"]);
  });
});
