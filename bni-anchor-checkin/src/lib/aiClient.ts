import type { Guest, Member, MemberMatch } from "../types/seating";

// Backend API URL
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://localhost:10000";

type AIProvider = "deepseek" | "gemini" | "keyword" | null;

type AIMatchResponse = {
  memberName: string;
  matchStrength: "High" | "Medium" | "Low";
  reason: string;
};


const callDeepSeekViaBackend = async (
  guest: Guest,
  members: Member[]
): Promise<AIMatchResponse[] | null> => {
  console.log("🤖 Calling Backend DeepSeek API...");
  console.log("📊 Guest:", guest.name, guest.profession);
  console.log("📊 Members count:", members.length);

  try {
    const requestBody = {
      guestName: guest.name,
      guestProfession: guest.profession,
      guestTargetProfession: guest.targetProfession || null,
      guestBottlenecks: guest.bottlenecks || [],
      guestRemarks: guest.remarks || null,
      members: members.map(m => ({
        name: m.name,
        profession: m.profession
      }))
    };

    const response = await fetch(`${BACKEND_API_URL}/api/matching/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Backend API HTTP error:", response.status, errorText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Backend response received:", data);
    
    // Parse the matches JSON string
    const matches = JSON.parse(data.matches) as AIMatchResponse[];
    console.log(`✅ Parsed ${matches.length} member matches from Backend`);
    return matches;
  } catch (error) {
    console.error("❌ Backend DeepSeek API failed:", error);
    return null;
  }
};

// Gemini fallback is deprecated - all AI calls should go through backend
// Keeping this for backwards compatibility only
const callGeminiDEPRECATED = async (): Promise<AIMatchResponse[] | null> => {
  console.warn("⚠️ Gemini direct API is deprecated. Using backend API instead.");
  return null;
};

export const matchMembersWithAI = async (
  guest: Guest,
  members: Member[]
): Promise<{ matches: MemberMatch[]; provider: AIProvider }> => {
  
  // Call backend DeepSeek API
  const backendResult = await callDeepSeekViaBackend(guest, members);
  if (backendResult && backendResult.length > 0) {
    // Convert AI response to MemberMatch format
    const matches: MemberMatch[] = backendResult
      .map((aiMatch) => {
        const member = members.find((m) => m.name === aiMatch.memberName);
        if (!member) {
          console.warn(`⚠️ Member not found: ${aiMatch.memberName}`);
          return null;
        }
        return {
          member,
          matchStrength: aiMatch.matchStrength,
          reason: aiMatch.reason,
        };
      })
      .filter((match): match is MemberMatch => match !== null);
    
    console.log(`✅ Converted ${matches.length} AI matches to MemberMatch format`);
    return { matches, provider: "deepseek" };
  }

  console.log("⚠️ Backend AI matching failed or returned no results");
  return { matches: [], provider: null };
};
