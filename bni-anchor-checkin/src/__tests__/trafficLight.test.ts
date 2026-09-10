import { describe, expect, it } from "vitest";
import {
  analyzeGaps,
  buildReminderTexts,
  greenPathSummary,
  lightFromFill,
  lightFromPts,
  meetingWeeks,
  scoreAbsences,
  scoreBizGive,
  scoreReferralsPerWeek,
  toWhatsAppPhone,
  buildChapterLtStats,
  trafficLightNamesMatch,
  trafficLightPtsByRosterName,
  trafficLightPtsForName,
} from "../lib/trafficLight";

describe("trafficLight scoring", () => {
  it("maps points to lights used on Anchor exports", () => {
    expect(lightFromPts(90)).toBe("GREEN");
    expect(lightFromPts(70)).toBe("GREEN");
    expect(lightFromPts(65)).toBe("YELLOW");
    expect(lightFromPts(40)).toBe("YELLOW");
    expect(lightFromPts(35)).toBe("RED");
    expect(lightFromPts(25)).toBe("BLACK");
  });

  it("reads Excel fill colors", () => {
    expect(lightFromFill("FFCCFFCC")).toBe("GREEN");
    expect(lightFromFill("FFFFFF99")).toBe("YELLOW");
    expect(lightFromFill("FFFF99CC")).toBe("RED");
    expect(lightFromFill("FFCCCCCC")).toBe("BLACK");
  });

  it("scores absences and referrals from the Scoring sheet", () => {
    expect(scoreAbsences(0)).toBe(15);
    expect(scoreAbsences(3)).toBe(0);
    expect(scoreReferralsPerWeek(1.5)).toBe(20);
    expect(scoreReferralsPerWeek(0.8)).toBe(5);
    expect(scoreBizGive(500_000)).toBe(15);
  });

  it("explains how Larry can move from yellow toward green", () => {
    const m = {
      name: "Larry Lo",
      present: 20,
      absent: 0,
      late: 1,
      medical: 0,
      substitute: 1,
      referralsGiven: 20,
      referralsReceived: 3,
      visitors: 2,
      oneToOnes: 43,
      training: 7,
      bizGive: 1_309_353,
      plsPct: 100,
      totalPts: 60,
      light: "YELLOW" as const,
    };
    const weeks = meetingWeeks(m, 22);
    const gaps = analyzeGaps(m, weeks);
    expect(gaps.find((g) => g.key === "L")?.currentScore).toBe(5);
    expect(gaps.find((g) => g.key === "G")?.suggestionZh).toMatch(/引薦/);
    expect(greenPathSummary(m, weeks)).toMatch(/黃燈/);
    const texts = buildReminderTexts(m, "2026-01-01 - 2026-07-31 (6 Months)", weeks);
    expect(texts.whatsappText).toContain("Larry Lo");
    expect(texts.emailSubject).toContain("黃燈");
  });

  it("normalizes HK mobile numbers for wa.me", () => {
    expect(toWhatsAppPhone("9310 3031")).toBe("85293103031");
    expect(toWhatsAppPhone("+852 93103031")).toBe("85293103031");
    expect(toWhatsAppPhone("12")).toBeNull();
  });

  it("builds LT chapter stats without double-counting a previous snapshot", () => {
    const yellow = {
      name: "Ada",
      present: 20,
      absent: 2,
      late: 0,
      medical: 0,
      substitute: 0,
      referralsGiven: 10,
      referralsReceived: 20,
      visitors: 4,
      oneToOnes: 20,
      training: 2,
      bizGive: 100_000,
      plsPct: 90,
      totalPts: 50,
      light: "YELLOW" as const,
    };
    const red = {
      ...yellow,
      name: "Ben",
      light: "RED" as const,
      totalPts: 32,
      training: 0,
      referralsGiven: 1,
      referralsReceived: 20,
    };
    const prev = [{ ...yellow, light: "GREEN" as const, totalPts: 80 }];
    const stats = buildChapterLtStats([yellow, red], ["Ada", "Ben", "Cara"], prev);
    expect(stats.memberCount).toBe(2);
    expect(stats.counts.YELLOW).toBe(1);
    expect(stats.counts.RED).toBe(1);
    expect(stats.pct.YELLOW).toBe(50);
    expect(stats.atRisk.map((a) => a.name)).toEqual(["Ben"]);
    expect(stats.unmatchedRoster).toEqual(["Cara"]);
    expect(stats.referralImbalance[0]?.name).toBe("Ben");
    expect(stats.vsPrev?.worsened).toBe(1);
    expect(stats.trainingPct).toBe(50);
  });

  it("maps Excel aliases Chow Chong Kwan, Wade Suen, and Eddie Chou to roster names", () => {
    const row = {
      name: "Ada",
      present: 20,
      absent: 0,
      late: 0,
      medical: 0,
      substitute: 0,
      referralsGiven: 10,
      referralsReceived: 10,
      visitors: 4,
      oneToOnes: 20,
      training: 2,
      bizGive: 100_000,
      plsPct: 90,
      totalPts: 50,
      light: "YELLOW" as const,
    };
    expect(trafficLightNamesMatch("Chow Chong Kwan", "Dr. Chow C.K.")).toBe(true);
    expect(trafficLightNamesMatch("Wade Suen", "Dr. Wade Suen")).toBe(true);
    expect(trafficLightNamesMatch("Eddie Chou", "Max Chan/William Lai/Eddie Chou")).toBe(true);
    expect(trafficLightNamesMatch("Wayne Lo", "Catherine Suen/Wayne Lo")).toBe(false);

    const stats = buildChapterLtStats(
      [
        { ...row, name: "Chow Chong Kwan" },
        { ...row, name: "Wade Suen" },
        { ...row, name: "Eddie Chou" },
        { ...row, name: "Wayne Lo" },
        { ...row, name: "Kevin Ho" },
        { ...row, name: "Michelle Wong" },
        { ...row, name: "Summer Ha" },
        { ...row, name: "Jayden Wong" },
      ],
      [
        "Dr. Chow C.K.",
        "Dr. Wade Suen",
        "Max Chan/William Lai/Eddie Chou",
        "Catherine Suen/Wayne Lo",
        "Jimmy Ho",
        "Johnny Li",
        "Raymond Chan",
        "Steve Ho",
      ]
    );
    expect(stats.unmatchedExcel).toEqual([
      "Wayne Lo",
      "Kevin Ho",
      "Michelle Wong",
      "Summer Ha",
      "Jayden Wong",
    ]);
    expect(stats.unmatchedRoster).toEqual([
      "Catherine Suen/Wayne Lo",
      "Jimmy Ho",
      "Johnny Li",
      "Raymond Chan",
      "Steve Ho",
    ]);
  });

  it("looks up Total PTs from Excel rows onto roster names", () => {
    const pts = trafficLightPtsByRosterName([
      { name: "Chow Chong Kwan", totalPts: 88 },
      { name: "Dr. Ronnie Chan", totalPts: 90 },
    ]);
    expect(trafficLightPtsForName("Dr. Chow C.K.", pts)).toBe(88);
    expect(trafficLightPtsForName("Dr. Ronnie Chan", pts)).toBe(90);
    expect(trafficLightPtsForName("Unknown", pts)).toBeUndefined();
  });
});
