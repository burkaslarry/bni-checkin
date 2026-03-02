import { describe, it, expect, vi, beforeEach } from "vitest";

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
