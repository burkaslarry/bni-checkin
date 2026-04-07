import type { Guest, Member, MemberMatch } from "../types/seating";

/**
 * Keyword-based member matching fallback: scores members by targetProfession and bottlenecks keywords; returns top 10.
 * No side effects. Purely synchronous.
 * @param {Guest} guest - targetProfession and bottlenecks used for scoring
 * @param {Member[]} members
 * @returns {MemberMatch[]} Up to 10 matches sorted by score (High ≥8, Medium ≥3)
 * @example const matches = matchMembersByKeyword(guest, members);
 */
export const matchMembersByKeyword = (
  guest: Guest,
  members: Member[]
): MemberMatch[] => {
  const targetKeywords = guest.targetProfession 
    ? guest.targetProfession.toLowerCase().split(/\s+/)
    : [];
  const bottleneckKeywords = guest.bottlenecks
    .join(" ")
    .toLowerCase()
    .split(/\s+/);

  const scored = members.map((member) => {
    let score = 0;
    const profession = member.profession.toLowerCase();

    // Check target profession match (if specified)
    targetKeywords.forEach((keyword) => {
      if (profession.includes(keyword)) score += 5;
    });

    // Check bottleneck resolution potential
    bottleneckKeywords.forEach((keyword) => {
      if (profession.includes(keyword)) score += 3;
    });

    let matchStrength: "High" | "Medium" | "Low" = "Low";
    if (score >= 8) matchStrength = "High";
    else if (score >= 3) matchStrength = "Medium";

    // Build reason based on matches
    const targetMatches = targetKeywords.filter((kw) => profession.includes(kw));
    const bottleneckMatches = bottleneckKeywords.filter((kw) => profession.includes(kw));

    let reason = "";
    if (targetMatches.length > 0 && bottleneckMatches.length > 0) {
      reason = `${member.name} (${member.profession}) 的專業領域符合你的目標對接需求，並且可能協助解決你的瓶頸。`;
    } else if (targetMatches.length > 0) {
      reason = `${member.name} (${member.profession}) 是你的目標對接對象，值得深入交流。`;
    } else if (bottleneckMatches.length > 0) {
      reason = `${member.name} (${member.profession}) 可能協助解決你提到的瓶頸問題。`;
    } else {
      reason = `${member.name} (${member.profession}) 可提供一般人脈拓展機會。`;
    }

    return {
      member,
      matchStrength,
      reason,
      score,
    };
  });

  // Return top 10 matches, sorted by score
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
};

/**
 * Build a short note summarizing keyword match results (counts of High/Medium).
 * No side effects.
 * @param {Guest} guest - unused but kept for API consistency
 * @param {MemberMatch[]} memberMatches
 * @returns {string} Human-readable note in Traditional Chinese
 */
export const buildKeywordNote = (
  guest: Guest,
  memberMatches: MemberMatch[]
): string => {
  if (memberMatches.length === 0) {
    return "未找到合適的配對會員。建議提供更多具體的目標或瓶頸資訊。";
  }

  const highMatches = memberMatches.filter(m => m.matchStrength === "High").length;
  const mediumMatches = memberMatches.filter(m => m.matchStrength === "Medium").length;
  
  return `(關鍵字配對) 找到 ${memberMatches.length} 位推薦會員：${highMatches} 位高度匹配、${mediumMatches} 位中度匹配。建議優先與高度匹配的會員交流。`;
};
