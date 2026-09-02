import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportPage from "../pages/ReportPage";
import { ChapterProvider } from "../chapterContext";

vi.mock("../api", () => ({
  ANCHOR_CHAPTER_ID: 1,
  CHAPTER_TAG_TO_ID: { anchor: 1, amax: 2, dynasty: 3 },
  setActiveApiChapter: vi.fn(),
  setClientAuthToken: vi.fn(),
  clientLogin: vi.fn(),
  clientLogout: vi.fn(),
  fetchClientSession: vi.fn().mockResolvedValue({
    chapter: { id: 2, tag: "amax", displayName: "BNI AMax" },
  }),
  getCurrentEvent: vi.fn().mockResolvedValue({ id: 1, name: "BNI AMax Meeting", date: "2026-02-10" }),
  getReportData: vi.fn().mockResolvedValue({
    eventId: 1,
    eventName: "BNI AMax Meeting",
    eventDate: "2026-02-10",
    onTimeCutoff: "07:05",
    attendees: [{ memberName: "Alice", status: "on-time", checkInTime: "07:00", role: "MEMBER" }],
    absentees: [{ memberName: "Bob", status: "absent", role: "MEMBER" }],
    stats: { totalAttendees: 1, onTimeCount: 1, lateCount: 0, absentCount: 1 },
  }),
  getRecords: vi.fn().mockResolvedValue({ records: [] }),
  clearRecords: vi.fn().mockResolvedValue({ status: "success", message: "ok" }),
  deleteRecord: vi.fn().mockResolvedValue({ status: "success", message: "ok" }),
  exportRecords: vi.fn().mockResolvedValue(new Blob(["x"], { type: "text/csv" })),
  getReportWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:10000/ws/report"),
}));

function renderReport(path = "/report") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChapterProvider>
        <ReportPage />
      </ChapterProvider>
    </MemoryRouter>
  );
}

describe("ReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("requires login before showing attendance data", async () => {
    renderReport();
    expect(await screen.findByText(/管理後台登入/i)).toBeInTheDocument();
  });

  it("renders report with export button when data loaded", async () => {
    localStorage.setItem(
      "eventxp_admin_session",
      JSON.stringify({
        token: "t",
        chapter: { id: 1, tag: "anchor", displayName: "BNI Anchor" },
        expiresAtEpochMs: Date.now() + 60_000,
      })
    );
    renderReport();
    await screen.findByText(/即時簽到狀態/i);
    expect(screen.getByText(/簽到記錄 CSV/i)).toBeInTheDocument();
  });

  it("scopes report APIs to amax when admin session is amax", async () => {
    const { getCurrentEvent, getReportData } = await import("../api");
    localStorage.setItem(
      "eventxp_admin_session",
      JSON.stringify({
        token: "t",
        chapter: { id: 2, tag: "amax", displayName: "BNI AMax" },
        expiresAtEpochMs: Date.now() + 60_000,
      })
    );

    renderReport("/report");

    await screen.findByText(/chapter=amax/i);
    await waitFor(() => {
      expect(getCurrentEvent).toHaveBeenCalledWith("amax", 2);
      expect(getReportData).toHaveBeenCalledWith(1, "amax", 2);
    });
  });
});
