import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CheckinFormPanel } from "../components/CheckinFormPanel";

vi.mock("../api", () => ({
  getEventForDate: vi.fn().mockResolvedValue({ id: 1, name: "Test Event" }),
  getMembers: vi.fn().mockResolvedValue({ members: [] }),
  getGuests: vi.fn().mockResolvedValue({ guests: [] }),
  logAttendance: vi.fn().mockResolvedValue({ status: "success", message: "OK" }),
  getReportWebSocketUrl: vi.fn().mockReturnValue("ws://localhost/ws/report"),
}));

describe("CheckinFormPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL with event param
    Object.defineProperty(window, "location", {
      value: { search: "?event=2026-02-10" },
      writable: true,
    });
  });

  it("renders check-in form", async () => {
    render(
      <BrowserRouter>
        <CheckinFormPanel onNotify={() => {}} />
      </BrowserRouter>
    );
    expect(screen.getByText(/EventXP for BNI Anchor 簽到/i)).toBeInTheDocument();
    expect(screen.getByText(/會員 Member/i)).toBeInTheDocument();
    expect(screen.getByText(/嘉賓 Guest/i)).toBeInTheDocument();
  });
});
