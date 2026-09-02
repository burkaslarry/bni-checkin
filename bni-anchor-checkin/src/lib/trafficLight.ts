/**
 * BNI Anchor Member Traffic Light scoring and reminder copy (6-month report).
 *
 * Cutoffs match backend `TrafficLightScoring`: green ≥ 70, yellow 40–69, red 30–39, black < 30.
 * Excel “Green Goal: 60” is a chapter KPI banner, not the row cutoff.
 *
 * @example
 * lightFromPts(65) // "YELLOW"
 * toWhatsAppPhone("9123 4567") // "85291234567"
 */

/** Row colour from Excel fill or total points. */
export type TrafficLight = "GREEN" | "YELLOW" | "RED" | "BLACK";

/** One member’s Traffic Light Report metrics (Excel columns P/A/L/M/S … Total PTs). */
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

/** One scoring category vs green-path max, with a Cantonese next-step line. */
export type CategoryGap = {
  key: string;
  labelZh: string;
  currentScore: number;
  maxScore: number;
  currentLabel: string;
  suggestionZh: string;
};

/** Green-path point floor (not the Excel “Green Goal: 60” KPI). */
export const GREEN_PTS = 70;
export const YELLOW_PTS = 40;
export const RED_PTS = 30;

/**
 * Map total points to a traffic light.
 * @param pts Excel Total PTs
 */
export function lightFromPts(pts: number): TrafficLight {
  if (pts >= GREEN_PTS) return "GREEN";
  if (pts >= YELLOW_PTS) return "YELLOW";
  if (pts >= RED_PTS) return "RED";
  return "BLACK";
}

/** Traditional Chinese label for UI filters and copy. */
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

/**
 * Excel theme fills used on Traffic Light Report rows (`FF` alpha optional).
 * @returns colour or `null` so callers fall back to [lightFromPts]
 */
export function lightFromFill(rgb: string | null | undefined): TrafficLight | null {
  if (!rgb) return null;
  const u = rgb.replace(/^#/, "").replace(/^FF/i, "").toUpperCase();
  if (u === "CCFFCC" || u === "92D050" || u === "C6EFCE") return "GREEN";
  if (u === "FFFF99" || u === "FFFF00" || u === "FFEB9C") return "YELLOW";
  if (u === "FF99CC" || u === "FFC7CE" || u === "FF0000") return "RED";
  if (u === "CCCCCC" || u === "BFBFBF" || u === "000000") return "BLACK";
  return null;
}

/** Absence points: 0 absences = 15, 1 = 10, 2 = 5, else 0. */
export function scoreAbsences(absent: number): number {
  if (absent > 2) return 0;
  if (absent === 2) return 5;
  if (absent === 1) return 10;
  return 15;
}

/** Punctuality: 0 lates = 10, 1 = 5, ≥2 = 0. */
export function scoreLates(late: number): number {
  if (late >= 2) return 0;
  if (late === 1) return 5;
  return 10;
}

/** Referrals given per week; green path is ≥ 1.5 (20 pts). */
export function scoreReferralsPerWeek(rate: number): number {
  if (rate >= 1.5) return 20;
  if (rate >= 1.2) return 15;
  if (rate >= 1.0) return 10;
  if (rate >= 0.75) return 5;
  return 0;
}

/** Visitors per week; green path is ≥ 0.75 (20 pts). */
export function scoreVisitorsPerWeek(rate: number): number {
  if (rate >= 0.75) return 20;
  if (rate >= 0.5) return 15;
  if (rate >= 0.25) return 10;
  if (rate >= 0.1) return 5;
  return 0;
}

/** 1-2-1s per week; green path is ≥ 1 (10 pts). */
export function scoreOneToOnesPerWeek(rate: number): number {
  if (rate >= 1) return 10;
  if (rate > 0.5) return 5;
  return 0;
}

/** Skills modules completed; green path is ≥ 2 (10 pts). */
export function scoreTraining(modules: number): number {
  if (modules >= 2) return 10;
  if (modules === 1) return 5;
  return 0;
}

/** TYFCB / Biz Give (HK$); green path is ≥ 500_000 (15 pts). */
export function scoreBizGive(value: number): number {
  if (value >= 500_000) return 15;
  if (value >= 200_000) return 10;
  if (value >= 100_000) return 5;
  return 0;
}

/**
 * Weeks for per-week rates: attendance-ish columns, or Excel “Perfect” present count.
 * Never returns 0 (avoids divide-by-zero).
 */
export function meetingWeeks(m: Pick<TrafficLightMetrics, "present" | "absent" | "late" | "medical" | "substitute">, perfectPresent?: number): number {
  const attendedish = m.present + m.absent + m.late + m.medical + m.substitute;
  return Math.max(1, perfectPresent || attendedish || 26);
}

/**
 * Per-category score vs green-path max, with Cantonese suggestions (gaps and already-met).
 * @param weeks from [meetingWeeks]
 */
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

/**
 * One-line Cantonese summary: already green, or points short plus top 3 gap actions.
 * Side effects: none.
 */
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

/**
 * Template email + WhatsApp text (used when DeepSeek is down or as the UI preview seed).
 * @returns subject/body/whatsapp; does not send mail or open WhatsApp
 */
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

/**
 * Normalise a HK/MO phone for `wa.me`.
 * @returns digits including country code, or `null` if unusable
 */
export function toWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 8) return `852${d}`;
  if (d.startsWith("852") && d.length === 11) return d;
  if (d.startsWith("853") && d.length === 11) return d;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
}

/** Click-to-chat URL; `text` is URI-encoded. */
export function whatsappHref(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** `mailto:` with encoded subject/body (opens the user’s mail client). */
export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Headcount by light for one snapshot (not summed across uploads). */
export type LightCounts = Record<TrafficLight, number>;

/** One member on the at-risk / imbalance lists. */
export type LtNamedLight = {
  name: string;
  light: TrafficLight;
  totalPts: number;
};

/** Referral given vs received gap (positive delta = received more than given). */
export type ReferralImbalance = {
  name: string;
  given: number;
  received: number;
  delta: number;
};

/**
 * Chapter board-pack stats for a single Traffic Light snapshot.
 * [vsPrev] compares green % and name-matched light rank vs the previous upload.
 */
export type ChapterLtStats = {
  memberCount: number;
  weeks: number;
  counts: LightCounts;
  pct: LightCounts;
  vsPrev: {
    greenPctPts: number;
    improved: number;
    worsened: number;
  } | null;
  atRisk: LtNamedLight[];
  attendanceRatePct: number;
  referralsPerWeek: number;
  visitorsPerWeek: number;
  oneToOnesPerWeek: number;
  tyfcbTotal: number;
  tyfcbMedian: number;
  trainingPct: number;
  referralImbalance: ReferralImbalance[];
  unmatchedExcel: string[];
  unmatchedRoster: string[];
};

const EMPTY_COUNTS: LightCounts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };

function lightRank(light: TrafficLight): number {
  switch (light) {
    case "GREEN":
      return 3;
    case "YELLOW":
      return 2;
    case "RED":
      return 1;
    case "BLACK":
      return 0;
  }
}

/** Count GREEN/YELLOW/RED/BLACK in one snapshot. */
export function countLights(rows: Array<{ light: TrafficLight }>): LightCounts {
  const c = { ...EMPTY_COUNTS };
  for (const r of rows) {
    if (r.light in c) c[r.light] += 1;
  }
  return c;
}

/** Integer percents; 0 when the snapshot is empty. */
export function lightPct(counts: LightCounts, total: number): LightCounts {
  if (total <= 0) return { ...EMPTY_COUNTS };
  return {
    GREEN: Math.round((counts.GREEN / total) * 100),
    YELLOW: Math.round((counts.YELLOW / total) * 100),
    RED: Math.round((counts.RED / total) * 100),
    BLACK: Math.round((counts.BLACK / total) * 100),
  };
}

/** Median of a numeric list; 0 if empty. */
export function medianNumber(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Hong Kong wall-clock for upload `createdAt`.
 * @param iso ISO-8601 from the API
 */
export function formatUploadAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Green-share delta vs previous snapshot, in percentage points.
 * @returns null when there is no previous upload
 */
export function formatGreenPctDelta(nowPct: number, prevPct: number | null | undefined): string | null {
  if (prevPct == null) return null;
  const d = nowPct - prevPct;
  if (d === 0) return "綠燈% 持平";
  return d > 0 ? `綠燈% ↑ ${d} 個百分點` : `綠燈% ↓ ${Math.abs(d)} 個百分點`;
}

/**
 * LT dashboard numbers for one Excel snapshot vs optional previous snapshot and EventXP roster.
 * Side effects: none.
 */
export function buildChapterLtStats(
  rows: TrafficLightMetrics[],
  rosterNames: string[],
  previousRows?: TrafficLightMetrics[] | null
): ChapterLtStats {
  const memberCount = rows.length;
  const counts = countLights(rows);
  const pct = lightPct(counts, memberCount);
  const weeks = Math.max(1, ...rows.map((r) => meetingWeeks(r)), 1);
  const present = rows.reduce((s, r) => s + r.present, 0);
  const attendedish = rows.reduce(
    (s, r) => s + r.present + r.absent + r.late + r.medical + r.substitute,
    0
  );
  const given = rows.reduce((s, r) => s + r.referralsGiven, 0);
  const visitors = rows.reduce((s, r) => s + r.visitors, 0);
  const oneToOnes = rows.reduce((s, r) => s + r.oneToOnes, 0);
  const tyfcb = rows.map((r) => r.bizGive);
  const roster = new Set(rosterNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const excel = new Set(rows.map((r) => r.name.trim().toLowerCase()).filter(Boolean));

  let vsPrev: ChapterLtStats["vsPrev"] = null;
  if (previousRows && previousRows.length > 0) {
    const prevPct = lightPct(countLights(previousRows), previousRows.length);
    const prevByName = new Map(previousRows.map((r) => [r.name.trim().toLowerCase(), r]));
    let improved = 0;
    let worsened = 0;
    for (const row of rows) {
      const prev = prevByName.get(row.name.trim().toLowerCase());
      if (!prev) continue;
      const delta = lightRank(row.light) - lightRank(prev.light);
      if (delta > 0) improved += 1;
      if (delta < 0) worsened += 1;
    }
    vsPrev = {
      greenPctPts: pct.GREEN - prevPct.GREEN,
      improved,
      worsened,
    };
  }

  const unmatchedExcel = rows
    .filter((r) => !roster.has(r.name.trim().toLowerCase()))
    .map((r) => r.name);
  const unmatchedRoster = rosterNames.filter((n) => {
    const key = n.trim().toLowerCase();
    return key.length > 0 && !excel.has(key);
  });

  return {
    memberCount,
    weeks,
    counts,
    pct,
    vsPrev,
    atRisk: rows
      .filter((r) => r.light === "RED" || r.light === "BLACK")
      .sort((a, b) => a.totalPts - b.totalPts)
      .map((r) => ({ name: r.name, light: r.light, totalPts: r.totalPts })),
    attendanceRatePct: attendedish > 0 ? Math.round((present / attendedish) * 100) : 0,
    referralsPerWeek: given / weeks,
    visitorsPerWeek: visitors / weeks,
    oneToOnesPerWeek: oneToOnes / weeks,
    tyfcbTotal: tyfcb.reduce((s, v) => s + v, 0),
    tyfcbMedian: medianNumber(tyfcb),
    trainingPct:
      memberCount > 0 ? Math.round((rows.filter((r) => r.training >= 2).length / memberCount) * 100) : 0,
    referralImbalance: rows
      .map((r) => ({
        name: r.name,
        given: r.referralsGiven,
        received: r.referralsReceived,
        delta: r.referralsReceived - r.referralsGiven,
      }))
      .filter((x) => x.delta >= 5)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8),
    unmatchedExcel,
    unmatchedRoster,
  };
}
