import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CheckinFormPanel } from "../components/CheckinFormPanel";

vi.mock("../api", () => ({
  getEventForDate: vi.fn().mockResolvedValue({ id: 1, name: "Test Event" }),
  getCurrentEvent: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Event",
    date: "2026-02-10",
    startTime: "07:00",
    endTime: "09:00",
    registrationStartTime: "06:30",
    onTimeCutoff: "07:01",
    createdAt: "2026-02-01"
  }),
  getMembers: vi.fn().mockResolvedValue({ members: [] }),
  getGuests: vi.fn().mockResolvedValue({ guests: [] }),
  logAttendance: vi.fn().mockResolvedValue({ status: "success", message: "OK" }),
  getReportWebSocketUrl: vi.fn().mockReturnValue("ws://localhost/ws/report"),
}));

describe("CheckinFormPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "WebSocket",
      class {
        static OPEN = 1;
        onopen: (() => void) | null = null;
        onclose: (() => void) | null = null;
        onmessage: ((e: { data: string }) => void) | null = null;
        close() {
          this.onclose?.();
        }
      }
    );
  });

  it("renders check-in form", async () => {
    render(
      <BrowserRouter>
        <CheckinFormPanel onNotify={() => {}} />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/EventXP for BNI Anchor 簽到/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/會員 Member/i)).toBeInTheDocument();
    expect(screen.getByText(/嘉賓 Guest/i)).toBeInTheDocument();
  });
});
