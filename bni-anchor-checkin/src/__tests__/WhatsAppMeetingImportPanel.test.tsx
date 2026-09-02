import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WhatsAppMeetingImportPanel } from "../components/WhatsAppMeetingImportPanel";
import { bulkImport, activateEvent } from "../api";
import { ensureEventForDate } from "../lib/meetingEventImport";

vi.mock("../api", () => ({
  bulkImport: vi.fn(),
  bulkImportObservers: vi.fn(),
  activateEvent: vi.fn(),
  bulkSetPlannedSubstitutes: vi.fn(),
}));

vi.mock("../lib/meetingEventImport", () => ({
  ensureEventForDate: vi.fn(),
}));

const PASTE = `替代人名單 (替代人姓名/會員姓名)
1） Paul Leung/ Lucus
2）May Wong/ 邦哥
3) Lawrence Yuen/ Max`;

describe("WhatsAppMeetingImportPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses substitute-only paste using current event date", () => {
    render(
      <WhatsAppMeetingImportPanel
        chapterTag="anchor"
        chapterId={1}
        chapterLabel="Anchor"
        fallbackEventDate="2026-09-03"
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: PASTE } });
    fireEvent.click(screen.getByRole("button", { name: /解析訊息/ }));

    expect(screen.getByText(/已解析：嘉賓 0 位、觀察員 0 位、替代 3 對/)).toBeInTheDocument();
    expect(screen.getByText("替代人預覽 (3)")).toBeInTheDocument();
    expect(screen.getByText("Paul Leung")).toBeInTheDocument();
    expect(screen.getByText("Lucus")).toBeInTheDocument();
    expect(screen.getByText("May Wong")).toBeInTheDocument();
    expect(screen.getByText("邦哥")).toBeInTheDocument();
    expect(screen.getByText("Lawrence Yuen")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /匯入資料庫/ })).toBeEnabled();
  });

  it("imports guests onto the current event without activate/create", async () => {
    vi.mocked(ensureEventForDate).mockResolvedValue({
      id: 21,
      name: "BNI Anchor Business Meeting 2026-09-03",
    });
    vi.mocked(bulkImport).mockResolvedValue({
      total: 5,
      inserted: 5,
      updated: 0,
      failed: 0,
      errors: [],
    });

    const paste = `⚓️Anchor 正式會議 ⚓️
🗓️日期：2026年9月3日 (星期四)
嘉賓名單 (姓名/專業領域/介紹人)
1. Debbie Yeung/紅酒銷售/zoe
2. Fiona Lau/家族辦公室管理/zoe
3. Sarah Cheng/蘭花售賣/Zoe
4. Harriet Yeung/舞團經理/Wade
5. Johnny Li / 攝影師/ Jessica`;

    render(
      <WhatsAppMeetingImportPanel
        chapterTag="anchor"
        chapterId={1}
        chapterLabel="Anchor"
        fallbackEventDate="2026-09-03"
        currentEvent={{
          id: 21,
          name: "BNI Anchor Business Meeting 2026-09-03",
          date: "2026-09-03",
        }}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: paste } });
    fireEvent.click(screen.getByRole("button", { name: /解析訊息/ }));
    fireEvent.click(screen.getByRole("button", { name: /匯入資料庫/ }));

    await waitFor(() => {
      expect(bulkImport).toHaveBeenCalled();
    });
    expect(activateEvent).not.toHaveBeenCalled();
    expect(ensureEventForDate).toHaveBeenCalledWith(
      "2026-09-03",
      "anchor",
      1,
      "Anchor",
      expect.objectContaining({ id: 21, date: "2026-09-03" })
    );
  });
});
