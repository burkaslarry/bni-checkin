import type { Guest, MatchResult, Member } from "../types/seating";
import { matchMembersWithAI } from "./aiClient";
import { matchMembersByKeyword, buildKeywordNote } from "./keywordMatch";

/**
 * Match guest with recommended members for networking
 * No table assignment - pure member-to-member recommendations
 */
export async function matchGuestWithMembers(
  guest: Guest,
  members: Member[]
): Promise<MatchResult & { provider?: "deepseek" | "gemini" | "keyword" | null }> {
  
  // Try AI matching first (DeepSeek or Gemini)
  const aiResult = await matchMembersWithAI(guest, members);
  let recommendedMembers = aiResult.matches;
  let matchNote = "";
  let provider = aiResult.provider;

  // Fallback to keyword matching if AI fails
  if (!recommendedMembers || recommendedMembers.length === 0) {
    recommendedMembers = matchMembersByKeyword(guest, members);
    matchNote = buildKeywordNote(guest, recommendedMembers);
    provider = "keyword";
  }

  // Determine overall match strength
  const highCount = recommendedMembers.filter(m => m.matchStrength === "High").length;
  const mediumCount = recommendedMembers.filter(m => m.matchStrength === "Medium").length;
  
  let overallMatchStrength: "High" | "Medium" | "Low" = "Low";
  if (highCount >= 2) {
    overallMatchStrength = "High";
  } else if (highCount >= 1 || mediumCount >= 3) {
    overallMatchStrength = "Medium";
  }

  // Generate match note if not already set
  if (!matchNote) {
    const providerLabel = 
      provider === "deepseek" ? "🤖 DeepSeek AI" :
      provider === "gemini" ? "🤖 Gemini AI" :
      "🔍 關鍵字配對";
    
    if (recommendedMembers.length === 0) {
      matchNote = `${providerLabel}: 未找到高度匹配的會員。建議提供更具體的目標職業或瓶頸資訊。`;
    } else {
      matchNote = `${providerLabel}: 找到 ${recommendedMembers.length} 位推薦會員（${highCount} 位高度匹配、${mediumCount} 位中度匹配）。建議優先與高度匹配的會員深入交流。`;
    }
  }

  return {
    matchStrength: overallMatchStrength,
    matchNote,
    recommendedMembers,
    provider,
  };
}
