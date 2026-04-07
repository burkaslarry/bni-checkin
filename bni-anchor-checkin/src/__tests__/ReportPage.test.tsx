import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ReportPage from "../pages/ReportPage";

vi.mock("../api", () => ({
  getCurrentEvent: vi.fn().mockResolvedValue({ id: 1, name: "BNI Anchor Meeting", date: "2026-02-10" }),
  getReportData: vi.fn().mockResolvedValue({
    eventId: 1,
    eventName: "BNI Anchor Meeting",
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

describe("ReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders report with export button when data loaded", async () => {
    render(
      <BrowserRouter>
        <ReportPage />
      </BrowserRouter>
    );
    // Wait for async data
    await screen.findByText(/即時簽到狀態/i);
    // Export button lives under the "📋 簽到記錄 CSV" tab
    expect(screen.getByText(/簽到記錄 CSV/i)).toBeInTheDocument();
  });
});
