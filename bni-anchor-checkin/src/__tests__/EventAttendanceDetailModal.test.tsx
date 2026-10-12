import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventAttendanceDetailModal } from "../components/EventAttendanceDetailModal";
import { getReportData, updateAttendanceCheckInTime } from "../api";

vi.mock("../api", () => ({
  normalizeApiEventId: (value: number | string) => Number(value),
  getReportData: vi.fn(),
  exportRecords: vi.fn(),
  updateAttendanceCheckInTime: vi.fn(),
}));

describe("EventAttendanceDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReportData).mockResolvedValue({
      eventId: 9,
      eventName: "LT Meeting",
      eventDate: "2026-10-08",
      onTimeCutoff: "07:05",
      attendees: [{ memberName: "Amy Chan", role: "MEMBER", status: "on-time", checkInTime: "06:58:00" }],
      absentees: [],
    });
    vi.mocked(updateAttendanceCheckInTime).mockResolvedValue({ status: "success", added: 1 });
  });

  it("allows an attended member's check-in time to be changed", async () => {
    const onNotify = vi.fn();
    render(
      <EventAttendanceDetailModal
        event={{
          id: 9,
          name: "LT Meeting",
          date: "2026-10-08",
          startTime: "07:00",
          endTime: "09:00",
          registrationStartTime: "06:30",
          onTimeCutoff: "07:05",
          createdAt: "2026-10-01T00:00:00Z",
        }}
        open
        onClose={vi.fn()}
        onNotify={onNotify}
      />
    );
    await screen.findByText("Amy Chan");
    fireEvent.click(screen.getByRole("button", { name: "修改時間" }));
    fireEvent.change(screen.getByLabelText("Amy Chan 簽到時間"), { target: { value: "07:12" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(updateAttendanceCheckInTime).toHaveBeenCalledWith("2026-10-08", "Amy Chan", "07:12");
      expect(getReportData).toHaveBeenCalledTimes(2);
      expect(onNotify).toHaveBeenCalledWith("已更新 Amy Chan 的簽到時間", "success");
    });
  });
});
