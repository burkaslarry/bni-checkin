import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureEventForDate } from "../lib/meetingEventImport";

vi.mock("../api", () => ({
  createEvent: vi.fn(),
  getEventForDate: vi.fn(),
}));

import { createEvent, getEventForDate } from "../api";

describe("ensureEventForDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses the already-loaded current event when the date matches", async () => {
    const event = await ensureEventForDate(
      "2026-09-03",
      "anchor",
      1,
      "Anchor",
      { id: 21, name: "BNI Anchor Business Meeting 2026-09-03", date: "2026-09-03" }
    );

    expect(event).toEqual({ id: 21, name: "BNI Anchor Business Meeting 2026-09-03" });
    expect(getEventForDate).not.toHaveBeenCalled();
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("looks up by date when no current event is provided", async () => {
    vi.mocked(getEventForDate).mockResolvedValue({ id: 9, name: "Existing" });

    const event = await ensureEventForDate("2026-09-03", "anchor", 1, "Anchor");

    expect(event).toEqual({ id: 9, name: "Existing" });
    expect(createEvent).not.toHaveBeenCalled();
  });
});
