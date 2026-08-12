import { describe, expect, it } from "vitest";
import {
  parseWhatsAppMeetingMessage,
  guestListToCsv,
  observerListToCsv,
  substituteListToCsv,
  splitPersonLine,
  splitSubstituteLine,
  parseMeetingEventDate,
} from "../lib/parseWhatsAppMeetingMessage";
import { formatMemberCheckinLabel } from "../components/CheckinFormPanel";

const SAMPLE_MESSAGE = `⚓️Anchor 正式會議 ⚓️
🗓️日期：2026年8月13日 (星期四)
⏰時間：早上6:30-9:00am
📍地點： 尖沙咀麼地道72號千禧新世界La Table 1/F
🕴🏻衣着：商務正裝
💰費用：$450(包精美早餐及飲品) 早鳥優惠＄400(12/8)前
⚠️ 各會員務必出席 ⚠️

兩位7分鐘分享會員：
Vincent Chung 
（專科醫療中心）
Chan One 
（商業活動策劃）
嘉賓名單 (姓名/專業領域/介紹人)
1.⁠ ⁠Yuri Lo/ 醫務中心/Vincent
2.⁠ ⁠⁠Andy Mao/房地產中介／CK💰
3.⁠ ⁠Angela Chan/ 珠寶買賣／CK💰
4.⁠ ⁠Vincent Ng/心胸肺外科醫生/Vincent
5.⁠ ⁠⁠Alan Tam/AI 人流分析/Vincent

觀察員
1.⁠ ⁠Vincent Woo(Insight)/會計師樓老闆(上市策劃/收購合併)/Vincent
2.⁠ ⁠⁠Eddie Cheng(Insight)/ Marketing 公司老闆/Vincent
⁠ ⁠
替代人名單 (替代人姓名/會員姓名)
1.⁠ ⁠Wendy Cheung / Zoe`;

describe("parseMeetingEventDate", () => {
  it("parses Chinese date format", () => {
    expect(parseMeetingEventDate("🗓️日期：2026年8月13日 (星期四)")).toBe("2026-08-13");
  });
});

describe("splitPersonLine", () => {
  it("splits guest line with emoji referrer", () => {
    expect(splitPersonLine("2. Andy Mao/房地產中介／CK💰")).toEqual({
      name: "Andy Mao",
      profession: "房地產中介",
      referrer: "CK",
    });
  });

  it("splits observer line with slashes inside profession parentheses", () => {
    expect(
      splitPersonLine("1. Vincent Woo(Insight)/會計師樓老闆(上市策劃/收購合併)/Vincent")
    ).toEqual({
      name: "Vincent Woo(Insight)",
      profession: "會計師樓老闆(上市策劃/收購合併)",
      referrer: "Vincent",
    });
  });
});

describe("splitSubstituteLine", () => {
  it("splits substitute / member pair", () => {
    expect(splitSubstituteLine("1. Wendy Cheung / Zoe")).toEqual({
      substituteName: "Wendy Cheung",
      memberName: "Zoe",
    });
  });
});

describe("formatMemberCheckinLabel", () => {
  it("formats planned substitute display", () => {
    expect(formatMemberCheckinLabel("Zoe", "Wendy Cheung")).toBe("Wendy Cheung / Zoe");
    expect(formatMemberCheckinLabel("Zoe")).toBe("Zoe");
  });
});

describe("parseWhatsAppMeetingMessage", () => {
  it("extracts guests and observers matching expected CSV rows", () => {
    const result = parseWhatsAppMeetingMessage(SAMPLE_MESSAGE);

    expect(result.eventDate).toBe("2026-08-13");
    expect(result.guests).toHaveLength(5);
    expect(result.observers).toHaveLength(2);
    expect(result.substitutes).toHaveLength(1);
    expect(result.substitutes[0]).toMatchObject({
      substituteName: "Wendy Cheung",
      memberName: "Zoe",
      eventDate: "2026-08-13",
    });

    expect(result.guests[0]).toMatchObject({
      name: "Yuri Lo",
      profession: "醫務中心",
      referrer: "Vincent",
      eventDate: "2026-08-13",
    });
    expect(result.guests[1]).toMatchObject({
      name: "Andy Mao",
      profession: "房地產中介",
      referrer: "CK",
    });
    expect(result.guests[2]).toMatchObject({
      name: "Angela Chan",
      profession: "珠寶買賣",
      referrer: "CK",
    });

    expect(result.observers[0]).toMatchObject({
      name: "Vincent Woo(Insight)",
      profession: "會計師樓老闆(上市策劃/收購合併)",
      eventDate: "2026-08-13",
    });
    expect(result.observers[1]).toMatchObject({
      name: "Eddie Cheng(Insight)",
      profession: "Marketing 公司老闆",
    });
  });

  it("exports CSV matching guest and observer templates", () => {
    const result = parseWhatsAppMeetingMessage(SAMPLE_MESSAGE);
    const guestCsv = guestListToCsv(result.guests);
    const observerCsv = observerListToCsv(result.observers);

    expect(guestCsv).toContain("name,profession,phone,referrer,event_date");
    expect(guestCsv).toContain("Yuri Lo,醫務中心,,Vincent,2026-08-13");
    expect(guestCsv).toContain("Andy Mao,房地產中介,,CK,2026-08-13");

    expect(observerCsv).toContain("name,profession,event_date");
    expect(observerCsv).toContain("Vincent Woo(Insight),會計師樓老闆(上市策劃/收購合併),2026-08-13");
    expect(observerCsv).toContain("Eddie Cheng(Insight),Marketing 公司老闆,2026-08-13");
  });
});
