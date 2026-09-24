import { describe, expect, it } from "vitest";
import { guestLtTermLabel } from "../lib/guestLtTerm";

describe("guestLtTermLabel", () => {
  it("labels dates before October 2026 as the 2nd LT", () => {
    expect(guestLtTermLabel("2026-03-12")).toBe("第 2 屆 LT");
    expect(guestLtTermLabel("2026-05-21")).toBe("第 2 屆 LT");
    expect(guestLtTermLabel("2026-09-30")).toBe("第 2 屆 LT");
  });

  it("labels October 2026 through the end of March as the 3rd LT", () => {
    expect(guestLtTermLabel("2026-10-01")).toBe("第 3 屆 LT");
    expect(guestLtTermLabel("2026-12-17")).toBe("第 3 屆 LT");
    expect(guestLtTermLabel("2027-03-31")).toBe("第 3 屆 LT");
  });

  it("advances one term every six months after March 2027", () => {
    expect(guestLtTermLabel("2027-04-01")).toBe("第 4 屆 LT");
    expect(guestLtTermLabel("2027-09-30")).toBe("第 4 屆 LT");
    expect(guestLtTermLabel("2027-10-01")).toBe("第 5 屆 LT");
    expect(guestLtTermLabel("2028-03-31")).toBe("第 5 屆 LT");
  });

  it("returns null when the date is missing", () => {
    expect(guestLtTermLabel(undefined)).toBeNull();
    expect(guestLtTermLabel("")).toBeNull();
  });
});
