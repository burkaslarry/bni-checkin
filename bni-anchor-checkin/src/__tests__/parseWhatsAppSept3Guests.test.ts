import { describe, expect, it } from "vitest";
import { parseWhatsAppMeetingMessage } from "../lib/parseWhatsAppMeetingMessage";

const SEPT3_GUEST_MESSAGE = `⚓️Anchor 正式會議 ⚓️
🗓️日期：2026年9月3日 (星期四)
⏰時間：早上6:30-9:00am
📍地點： 尖沙咀麼地道72號千禧新世界La Table 1/F
🕴衣着：商務正裝
💰費用：$450(包精美早餐及飲品) 早鳥優惠＄400(12/8)前
⚠️ 各會員務必出席 ⚠️

兩位7分鐘分享會員：
Zoe Wu 
（花藝師）
Dr. Wade Suen  
（港研健康產品）

嘉賓名單 (姓名/專業領域/介紹人)
1.⁠ ⁠Debbie Yeung/紅酒銷售/zoe 💰
2.⁠ ⁠Fiona Lau/家族辦公室管理/zoe 💰
3.⁠ ⁠⁠Sarah Cheng/蘭花售賣/Zoe💰
4.⁠ ⁠⁠Harriet Yeung/舞團經理/Wade
5.⁠ ⁠Johnny Li / 攝影師/ Jessica 💰`;

describe("parseWhatsAppMeetingMessage — 2026-09-03 guest announcement", () => {
  it("extracts five guests and the meeting date without observers", () => {
    const result = parseWhatsAppMeetingMessage(SEPT3_GUEST_MESSAGE);

    expect(result.eventDate).toBe("2026-09-03");
    expect(result.guests).toHaveLength(5);
    expect(result.observers).toHaveLength(0);
    expect(result.substitutes).toHaveLength(0);
    expect(result.guests.map((g) => g.name)).toEqual([
      "Debbie Yeung",
      "Fiona Lau",
      "Sarah Cheng",
      "Harriet Yeung",
      "Johnny Li",
    ]);
    expect(result.guests[0]).toMatchObject({
      profession: "紅酒銷售",
      referrer: "zoe",
      eventDate: "2026-09-03",
    });
    expect(result.guests[4]).toMatchObject({
      profession: "攝影師",
      referrer: "Jessica",
    });
    expect(result.errors).toEqual([]);
  });
});
