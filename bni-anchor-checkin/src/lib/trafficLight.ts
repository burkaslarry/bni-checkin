/** BNI Anchor Member Traffic Light scoring (6-month report). */

export type TrafficLight = "GREEN" | "YELLOW" | "RED" | "BLACK";

export type TrafficLightMetrics = {
  name: string;
  present: number;
  absent: number;
  late: number;
  medical: number;
  substitute: number;
  referralsGiven: number;
  referralsReceived: number;
  visitors: number;
  oneToOnes: number;
  training: number;
  bizGive: number;
  plsPct: number;
  totalPts: number;
  light: TrafficLight;
};

export type CategoryGap = {
  key: string;
  labelZh: string;
  currentScore: number;
  maxScore: number;
  currentLabel: string;
  suggestionZh: string;
};

export const GREEN_PTS = 70;
export const YELLOW_PTS = 40;
export const RED_PTS = 30;

export function lightFromPts(pts: number): TrafficLight {
  if (pts >= GREEN_PTS) return "GREEN";
  if (pts >= YELLOW_PTS) return "YELLOW";
  if (pts >= RED_PTS) return "RED";
  return "BLACK";
}

export function lightLabelZh(light: TrafficLight): string {
  switch (light) {
    case "GREEN":
      return "綠燈";
    case "YELLOW":
      return "黃燈";
    case "RED":
      return "紅燈";
    case "BLACK":
      return "黑燈";
  }
}

/** Excel theme fills used on Traffic Light Report rows. */
export function lightFromFill(rgb: string | null | undefined): TrafficLight | null {
  if (!rgb) return null;
  const u = rgb.replace(/^#/, "").replace(/^FF/i, "").toUpperCase();
  if (u === "CCFFCC" || u === "92D050" || u === "C6EFCE") return "GREEN";
  if (u === "FFFF99" || u === "FFFF00" || u === "FFEB9C") return "YELLOW";
  if (u === "FF99CC" || u === "FFC7CE" || u === "FF0000") return "RED";
  if (u === "CCCCCC" || u === "BFBFBF" || u === "000000") return "BLACK";
  return null;
}

export function scoreAbsences(absent: number): number {
  if (absent > 2) return 0;
  if (absent === 2) return 5;
  if (absent === 1) return 10;
  return 15;
}

export function scoreLates(late: number): number {
  if (late >= 2) return 0;
  if (late === 1) return 5;
  return 10;
}

export function scoreReferralsPerWeek(rate: number): number {
  if (rate >= 1.5) return 20;
  if (rate >= 1.2) return 15;
  if (rate >= 1.0) return 10;
  if (rate >= 0.75) return 5;
  return 0;
}

export function scoreVisitorsPerWeek(rate: number): number {
  if (rate >= 0.75) return 20;
  if (rate >= 0.5) return 15;
  if (rate >= 0.25) return 10;
  if (rate >= 0.1) return 5;
  return 0;
}

export function scoreOneToOnesPerWeek(rate: number): number {
  if (rate >= 1) return 10;
  if (rate > 0.5) return 5;
  return 0;
}

export function scoreTraining(modules: number): number {
  if (modules >= 2) return 10;
  if (modules === 1) return 5;
  return 0;
}

export function scoreBizGive(value: number): number {
  if (value >= 500_000) return 15;
  if (value >= 200_000) return 10;
  if (value >= 100_000) return 5;
  return 0;
}

export function meetingWeeks(m: Pick<TrafficLightMetrics, "present" | "absent" | "late" | "medical" | "substitute">, perfectPresent?: number): number {
  const attendedish = m.present + m.absent + m.late + m.medical + m.substitute;
  return Math.max(1, perfectPresent || attendedish || 26);
}

export function analyzeGaps(m: TrafficLightMetrics, weeks: number): CategoryGap[] {
  const gRate = m.referralsGiven / weeks;
  const vRate = m.visitors / weeks;
  const oRate = m.oneToOnes / weeks;
  const needG = Math.max(0, Math.ceil(1.5 * weeks - m.referralsGiven));
  const needV = Math.max(0, Math.ceil(0.75 * weeks - m.visitors));
  const needO = Math.max(0, Math.ceil(1 * weeks - m.oneToOnes));
  const needT = Math.max(0, 2 - m.training);
  const needBiz = Math.max(0, 500_000 - m.bizGive);

  return [
    {
      key: "A",
      labelZh: "出席（缺席）",
      currentScore: scoreAbsences(m.absent),
      maxScore: 15,
      currentLabel: `缺席 ${m.absent} 次`,
      suggestionZh:
        m.absent < 1
          ? "保持 0 缺席（15 分）"
          : `下個週期缺席少過 1 次先有滿分；而家缺席 ${m.absent} 次`,
    },
    {
      key: "L",
      labelZh: "準時",
      currentScore: scoreLates(m.late),
      maxScore: 10,
      currentLabel: `遲到 ${m.late} 次`,
      suggestionZh: m.late === 0 ? "保持 0 遲到（10 分）" : "下個週期 0 遲到可以多 5–10 分",
    },
    {
      key: "G",
      labelZh: "引薦（每週）",
      currentScore: scoreReferralsPerWeek(gRate),
      maxScore: 20,
      currentLabel: `${m.referralsGiven} 筆（${gRate.toFixed(2)}/週）`,
      suggestionZh:
        needG === 0
          ? "已達每週 1.5 筆引薦（20 分）"
          : `綠燈目標：每週 ≥1.5 筆引薦，大約再多 ${needG} 筆`,
    },
    {
      key: "V",
      labelZh: "嘉賓（每週）",
      currentScore: scoreVisitorsPerWeek(vRate),
      maxScore: 20,
      currentLabel: `${m.visitors} 位（${vRate.toFixed(2)}/週）`,
      suggestionZh:
        needV === 0
          ? "已達每週 0.75 位嘉賓（20 分）"
          : `綠燈目標：每週 ≥0.75 位嘉賓，大約再帶 ${needV} 位`,
    },
    {
      key: "121",
      labelZh: "1-2-1",
      currentScore: scoreOneToOnesPerWeek(oRate),
      maxScore: 10,
      currentLabel: `${m.oneToOnes} 次（${oRate.toFixed(2)}/週）`,
      suggestionZh:
        needO === 0 ? "已達每週 1 次 1-2-1（10 分）" : `綠燈目標：每週 ≥1 次 1-2-1，大約再約 ${needO} 次`,
    },
    {
      key: "T",
      labelZh: "技能訓練",
      currentScore: scoreTraining(m.training),
      maxScore: 10,
      currentLabel: `${m.training} 個 module`,
      suggestionZh: needT === 0 ? "已完成 ≥2 個 Skills Module（10 分）" : `再完成 ${needT} 個 Skills Module`,
    },
    {
      key: "BIZ",
      labelZh: "成交生意（Biz Give）",
      currentScore: scoreBizGive(m.bizGive),
      maxScore: 15,
      currentLabel: `HK$${Math.round(m.bizGive).toLocaleString()}`,
      suggestionZh:
        needBiz === 0
          ? "已達 HK$500,000 TYFCB（15 分）"
          : `綠燈目標：TYFCB ≥ HK$500,000，尚欠約 HK$${Math.round(needBiz).toLocaleString()}`,
    },
  ];
}

export function greenPathSummary(m: TrafficLightMetrics, weeks: number): string {
  if (m.light === "GREEN") {
    return `${m.name} 已係綠燈（${m.totalPts} 分）。保持出席、每週 1.5 筆引薦、0.75 位嘉賓同每週 1 次 1-2-1。`;
  }
  const gaps = analyzeGaps(m, weeks)
    .filter((g) => g.currentScore < g.maxScore)
    .sort((a, b) => b.maxScore - b.currentScore - (a.maxScore - a.currentScore));
  const ptsShort = Math.max(0, GREEN_PTS - m.totalPts);
  const top = gaps.slice(0, 3).map((g) => g.suggestionZh);
  return `${m.name} 而家 ${lightLabelZh(m.light)}（${m.totalPts} 分），距離綠燈仲差約 ${ptsShort} 分。優先：${top.join("；")}`;
}

export function buildReminderTexts(
  m: TrafficLightMetrics,
  periodLabel: string,
  weeks: number
): { emailSubject: string; emailBody: string; whatsappText: string } {
  const summary = greenPathSummary(m, weeks);
  const gaps = analyzeGaps(m, weeks);
  const emailSubject = `BNI Anchor 紅綠燈提醒 — ${m.name}（${lightLabelZh(m.light)}）`;
  const emailBody = [
    `你好 ${m.name}，`,
    "",
    `Anchor Member Traffic Light（${periodLabel}）你而家係${lightLabelZh(m.light)}，總分 ${m.totalPts}。`,
    `綠燈門檻係 ${GREEN_PTS} 分（黃燈 ${YELLOW_PTS}、紅燈 ${RED_PTS}）。`,
    "",
    summary,
    "",
    "分項：",
    ...gaps.map((g) => `• ${g.labelZh}：${g.currentLabel} → ${g.currentScore}/${g.maxScore} 分。${g.suggestionZh}`),
    "",
    "有問題可以搵 Membership Committee / VP。",
    "BNI Anchor",
  ].join("\n");
  const whatsappText = [
    `Hi ${m.name}，Anchor 紅綠燈（${periodLabel}）你而家係${lightLabelZh(m.light)}（${m.totalPts}分）。`,
    summary,
    "有問題搵 VP / Membership Committee 啦。",
  ].join("\n");
  return { emailSubject, emailBody, whatsappText };
}

export function toWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 8) return `852${d}`;
  if (d.startsWith("852") && d.length === 11) return d;
  if (d.startsWith("853") && d.length === 11) return d;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
}

export function whatsappHref(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
