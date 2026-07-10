import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import {
  CheckinFormPanel,
  getHktDateString,
  isSameCalendarDayAsEvent,
} from "../components/CheckinFormPanel";
import * as api from "../api";

const { logAttendance } = vi.hoisted(() => ({
  logAttendance: vi.fn().mockResolvedValue({ status: "success", message: "OK" }),
}));

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
  getMembers: vi.fn().mockResolvedValue({
    members: [{ id: 1, name: "Alice", domain: "IT", standing: "GREEN" }],
  }),
  getGuests: vi.fn().mockResolvedValue({ guests: [] }),
  getObservers: vi.fn().mockResolvedValue({ observers: [] }),
  logAttendance,
  getReportWebSocketUrl: vi.fn().mockReturnValue("ws://localhost/ws/report"),
}));

describe("CheckinFormPanel date helpers", () => {
  it("matches event date on the same HKT calendar day", () => {
    expect(isSameCalendarDayAsEvent("2026-02-10", new Date("2026-02-10T01:30:00+08:00"))).toBe(true);
  });

  it("rejects check-in when HKT calendar day differs from event date", () => {
    expect(isSameCalendarDayAsEvent("2026-02-10", new Date("2026-02-11T00:30:00+08:00"))).toBe(false);
  });

  it("formats HKT date as YYYY-MM-DD", () => {
    expect(getHktDateString(new Date("2026-02-10T23:30:00+08:00"))).toBe("2026-02-10");
  });
});

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

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("shows warning and blocks check-in when today is not the event date", async () => {
    vi.mocked(api.getCurrentEvent).mockResolvedValueOnce({
      id: 1,
      name: "Future Event",
      date: "2099-01-01",
      startTime: "07:00",
      endTime: "09:00",
      registrationStartTime: "06:30",
      onTimeCutoff: "07:01",
      createdAt: "2099-01-01",
    });

    render(
      <BrowserRouter>
        <CheckinFormPanel onNotify={() => {}} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Alice/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Alice/i));
    expect(screen.getByRole("button", { name: /非活動日無法簽到/i })).toBeDisabled();
    expect(screen.getByText(/2099-01-01/i)).toBeInTheDocument();
    expect(logAttendance).not.toHaveBeenCalled();
  });
});
