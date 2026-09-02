import { describe, it, expect, vi, beforeEach } from "vitest";
import { isBrowserNetworkError } from "../api";

describe("isBrowserNetworkError", () => {
  it("treats Safari Load failed as a network error", () => {
    expect(isBrowserNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isBrowserNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isBrowserNetworkError(new Error("boom"))).toBe(false);
  });
});

describe("API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("checkEventExists returns boolean", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ exists: true }),
    } as Response);
    const { checkEventExists } = await import("../api");
    const result = await checkEventExists("2026-02-10");
    expect(typeof result).toBe("boolean");
  });

  it("getMembers returns members array", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ members: [{ name: "Test", domain: "Dev", standing: "GREEN" }] }),
    } as Response);
    const { getMembers } = await import("../api");
    const result = await getMembers();
    expect(result).toHaveProperty("members");
    expect(Array.isArray(result.members)).toBe(true);
  });

  it("getReportData appends eventId for string ids", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        eventId: 9,
        eventName: "Test",
        eventDate: "2026-02-10",
        onTimeCutoff: "07:05",
        attendees: [],
        absentees: [],
        stats: {}
      }),
    } as Response);
    const { getReportData } = await import("../api");
    await getReportData("9" as unknown as number);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/report\?eventId=9&chapterId=1&chapter=anchor$/),
      expect.anything()
    );
  });

  it("getGuests returns guests array", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ guests: [{ name: "Guest", profession: "Design", referrer: "", eventDate: "2026-02-10" }] }),
    } as Response);
    const { getGuests } = await import("../api");
    const result = await getGuests();
    expect(result).toHaveProperty("guests");
    expect(Array.isArray(result.guests)).toBe(true);
  });
});
