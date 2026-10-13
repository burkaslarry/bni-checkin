import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventManagementPanel } from "../components/EventManagementPanel";
import { getAttendanceEmailSettings, updateAttendanceEmailSettings } from "../api";

vi.mock("../api", () => ({
  getCurrentEvent: vi.fn().mockResolvedValue(null),
  listEvents: vi.fn().mockResolvedValue([]),
  getAttendanceEmailSettings: vi.fn(),
  updateAttendanceEmailSettings: vi.fn(),
  exportRecords: vi.fn(),
  importAttendanceCsv: vi.fn(),
  activateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  sendAttendanceEmail: vi.fn(),
  resetAttendanceEmail: vi.fn(),
  normalizeApiEventId: (value: unknown) => value,
}));

describe("EventManagementPanel attendance email recipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAttendanceEmailSettings).mockResolvedValue({
      status: "success",
      recipients: ["Raymondkuo88@gmail.com"],
    });
    vi.mocked(updateAttendanceEmailSettings).mockResolvedValue({
      status: "success",
      recipients: ["Raymondkuo88@gmail.com", "team@example.com"],
    });
  });

  it("allows one to three attendance CSV recipients to be saved", async () => {
    const onNotify = vi.fn();
    render(<EventManagementPanel onNotify={onNotify} />);

    expect(await screen.findByLabelText("CSV 收件人 1")).toHaveValue("Raymondkuo88@gmail.com");
    fireEvent.click(screen.getByRole("button", { name: /加收件人/ }));
    fireEvent.change(screen.getByLabelText("CSV 收件人 2"), { target: { value: "team@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存收件人" }));

    await waitFor(() => {
      expect(updateAttendanceEmailSettings).toHaveBeenCalledWith([
        "Raymondkuo88@gmail.com",
        "team@example.com",
      ]);
      expect(onNotify).toHaveBeenCalledWith("已儲存 2 位 CSV 收件人", "success");
    });
  });
});
