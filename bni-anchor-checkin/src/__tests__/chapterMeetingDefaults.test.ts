import { describe, expect, it } from "vitest";
import {
  buildMeetingDefaults,
  defaultBusinessMeetingName,
  nextWeekdayOnOrAfter,
  resolveMeetingWeekday,
} from "../lib/chapterMeetingDefaults";

describe("chapterMeetingDefaults", () => {
  it("resolves Anchor Thursday and AMax/Dynasty Wednesday", () => {
    expect(resolveMeetingWeekday(undefined, "anchor")).toBe(4);
    expect(resolveMeetingWeekday(undefined, "amax")).toBe(3);
    expect(resolveMeetingWeekday(undefined, "dynasty")).toBe(3);
    expect(resolveMeetingWeekday(2, "amax")).toBe(2);
  });

  it("picks upcoming weekday on or after today", () => {
    // Wednesday 2026-07-22
    const wed = new Date(2026, 6, 22);
    expect(nextWeekdayOnOrAfter(wed, 3).getDate()).toBe(22);
    expect(nextWeekdayOnOrAfter(wed, 4).getDate()).toBe(23);
    // Friday → next Wednesday
    const fri = new Date(2026, 6, 24);
    const nextWed = nextWeekdayOnOrAfter(fri, 3);
    expect(nextWed.getFullYear()).toBe(2026);
    expect(nextWed.getMonth()).toBe(6);
    expect(nextWed.getDate()).toBe(29);
  });

  it("builds AMax Business Meeting title for next Wednesday", () => {
    const d = buildMeetingDefaults({
      displayName: "BNI AMax",
      tag: "amax",
      meetingWeekday: 3,
      from: new Date(2026, 6, 24), // Friday
    });
    expect(d.weekday).toBe(3);
    expect(d.date).toBe("2026-07-29");
    expect(d.name).toBe("BNI AMax Business Meeting 2026-07-29");
    expect(defaultBusinessMeetingName("BNI Anchor", "2026-07-30")).toBe(
      "BNI Anchor Business Meeting 2026-07-30"
    );
  });
});
