import type { Guest, Member, MemberMatch } from "../types/seating";

// Environment variables (from .env.local or Vite config)
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || "deepseek-v3";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

type AIProvider = "deepseek" | "gemini" | "keyword" | null;

type AIMatchResponse = {
  memberName: string;
  matchStrength: "High" | "Medium" | "Low";
  reason: string;
};

const buildPrompt = (guest: Guest, members: Member[]): string => {
  const memberList = members
    .map((m) => `- ${m.name} (${m.profession})`)
    .join("\n");

  return `You are an elite strategic networking consultant for a BNI-style business event. Your mission is to identify HIGH-VALUE connections that lead to immediate referrals and long-term partnerships.

【來賓檔案 Guest Profile】
姓名: ${guest.name}
職業: ${guest.profession}
${guest.targetProfession ? `目標對接: ${guest.targetProfession}` : ""}
瓶頸/需求: ${guest.bottlenecks.length > 0 ? guest.bottlenecks.join(", ") : "未指定"}
${guest.remarks ? `價值交換: ${guest.remarks}` : ""}

【可配對會員列表 Available Members】
${memberList}

【核心配對原則 Core Matching Principles】
1. **價值互補 (Value Complementarity)**: 優先推薦能解決來賓「瓶頸」的專業人士
2. **目標對接 (Target Alignment)**: 如果來賓有明確的「目標職業」，尋找該領域或能引薦該領域的會員
3. **資源交換 (Resource Exchange)**: 關注備註中的「價值提供」，推薦能產生雙向價值的人脈
4. **行業互補 (Industry Synergy)**: 尋找上下游產業鏈、異業合作機會

【配對策略 Matching Strategy】
- **High Match**: 會員能直接解決來賓瓶頸，或其職業正是來賓的目標對接對象
- **Medium Match**: 會員能提供相關協助，或行業高度相關
- **Low Match**: 會員可提供一般人脈拓展，但無直接業務契合點

【輸出要求 Output Format】
請推薦最適合與來賓配對的會員（最多10位），並說明配對原因。以 JSON 格式回應：

[
  {
    "memberName": "會員姓名",
    "matchStrength": "High",
    "reason": "[會員姓名] ([職業]) 能直接解決來賓的 [具體瓶頸]，或在 [目標領域] 有豐富資源，可提供精準引薦和業務合作機會。"
  },
  ...
]

**重要提醒**: 
- 只推薦真正有價值的配對（不一定要推薦全部會員）
- 每個 reason 必須具體說明該會員能提供什麼價值給來賓
- 按照配對價值排序（最佳在前）`;
};

const callDeepSeek = async (
  prompt: string
): Promise<AIMatchResponse[] | null> => {
  if (!DEEPSEEK_API_KEY) return null;

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found in DeepSeek response");

    return JSON.parse(jsonMatch[0]) as AIMatchResponse[];
  } catch (error) {
    console.error("DeepSeek API failed:", error);
    return null;
  }
};

const callGemini = async (prompt: string): Promise<AIMatchResponse[] | null> => {
  if (!GEMINI_API_KEY) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found in Gemini response");

    return JSON.parse(jsonMatch[0]) as AIMatchResponse[];
  } catch (error) {
    console.error("Gemini API failed:", error);
    return null;
  }
};

export const matchMembersWithAI = async (
  guest: Guest,
  members: Member[]
): Promise<{ matches: MemberMatch[]; provider: AIProvider }> => {
  const prompt = buildPrompt(guest, members);

  // Try DeepSeek first
  const deepseekResult = await callDeepSeek(prompt);
  if (deepseekResult && deepseekResult.length > 0) {
    // Convert AI response to MemberMatch format
    const matches: MemberMatch[] = deepseekResult
      .map((aiMatch) => {
        const member = members.find((m) => m.name === aiMatch.memberName);
        if (!member) return null;
        return {
          member,
          matchStrength: aiMatch.matchStrength,
          reason: aiMatch.reason,
        };
      })
      .filter((match): match is MemberMatch => match !== null);
    
    return { matches, provider: "deepseek" };
  }

  // Fallback to Gemini
  const geminiResult = await callGemini(prompt);
  if (geminiResult && geminiResult.length > 0) {
    const matches: MemberMatch[] = geminiResult
      .map((aiMatch) => {
        const member = members.find((m) => m.name === aiMatch.memberName);
        if (!member) return null;
        return {
          member,
          matchStrength: aiMatch.matchStrength,
          reason: aiMatch.reason,
        };
      })
      .filter((match): match is MemberMatch => match !== null);
    
    return { matches, provider: "gemini" };
  }

  // Both failed
  return { matches: [], provider: null };
};
