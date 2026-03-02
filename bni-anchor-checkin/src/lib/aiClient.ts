import type { Guest, Member, MemberMatch } from "../types/seating";

// Backend API URL (same as api.ts)
const BACKEND_API_URL = import.meta.env.VITE_API_BASE || "http://localhost:10000";

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
  console.log("🤖 [Frontend] Calling Backend DeepSeek API...");
  console.log("📊 [Frontend] Guest:", guest.name, guest.profession);
  console.log("📊 [Frontend] Target:", guest.targetProfession);
  console.log("📊 [Frontend] Bottlenecks:", guest.bottlenecks);
  console.log("📊 [Frontend] Members count:", members.length);

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

    console.log("📤 [Frontend] Sending request to:", `${BACKEND_API_URL}/api/matching/members`);
    console.log("📤 [Frontend] Request body preview:", JSON.stringify(requestBody).substring(0, 200) + "...");

    const response = await fetch(`${BACKEND_API_URL}/api/matching/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("📥 [Frontend] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [Frontend] Backend API HTTP error:", response.status, errorText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ [Frontend] Backend response received:", data);
    console.log("📄 [Frontend] Matches string preview:", data.matches.substring(0, 200) + "...");
    
    // Check if response contains error
    if (data.matches.includes('"error"')) {
      console.error("❌ [Frontend] Backend returned error:", data.matches);
      return null;
    }
    
    // Parse the matches JSON string
    const matches = JSON.parse(data.matches) as AIMatchResponse[];
    console.log(`✅ [Frontend] Parsed ${matches.length} member matches from Backend`);
    
    // Log first match for debugging
    if (matches.length > 0) {
      console.log("📋 [Frontend] First match example:", matches[0]);
    }
    
    return matches;
  } catch (error) {
    console.error("❌ [Frontend] Backend DeepSeek API failed:", error);
    if (error instanceof Error) {
      console.error("❌ [Frontend] Error details:", error.message, error.stack);
    }
    return null;
  }
};

// Direct DeepSeek API when backend unreachable
const callDeepSeekDirect = async (
  guest: Guest,
  members: Member[]
): Promise<AIMatchResponse[] | null> => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string;
  if (!apiKey || apiKey.startsWith("your_")) return null;

  const memberList = members.map((m) => `- ${m.name} (${m.profession})`).join("\n");
  const prompt = `You are a BNI networking consultant. Match guest to members.

Guest: ${guest.name} - ${guest.profession}
${guest.targetProfession ? `Target: ${guest.targetProfession}` : ""}
${guest.bottlenecks?.length ? `Bottlenecks: ${guest.bottlenecks.join(", ")}` : ""}
${guest.remarks ? `Remarks: ${guest.remarks}` : ""}

Members:
${memberList}

Return JSON only: {"matches": [{"memberName": "name", "matchStrength": "High"|"Medium"|"Low", "reason": "..."}]}`;

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { matches?: AIMatchResponse[] };
    return parsed.matches ?? null;
  } catch {
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
  
  // Call backend DeepSeek API first
  let backendResult = await callDeepSeekViaBackend(guest, members);
  // Fallback: direct DeepSeek when backend unreachable
  if (!backendResult || backendResult.length === 0) {
    backendResult = await callDeepSeekDirect(guest, members);
  }
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
