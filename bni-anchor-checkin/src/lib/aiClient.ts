import type { Guest, RankedTable, TableGroup } from "../types/seating";

// Environment variables (from .env.local or Vite config)
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || "deepseek-v3";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

type AIProvider = "deepseek" | "gemini" | "keyword" | null;

const buildPrompt = (guest: Guest, tables: TableGroup[]): string => {
  const tableDescriptions = tables
    .map((t) => {
      const professions = t.members.map((m) => `${m.name} (${m.profession})`).join(", ");
      return `Table ${t.tableNumber}: ${professions} (${t.members.length}/8 seats)`;
    })
    .join("\n");

  return `You are an elite strategic seating consultant for a BNI-style business networking event. Your mission is to create HIGH-VALUE connections that lead to immediate referrals and long-term partnerships.

【來賓檔案 Guest Profile】
姓名: ${guest.name}
職業: ${guest.profession}
${guest.targetProfession ? `目標對接: ${guest.targetProfession}` : ""}
瓶頸/需求: ${guest.bottlenecks.length > 0 ? guest.bottlenecks.join(", ") : "未指定"}
${guest.remarks ? `價值交換: ${guest.remarks}` : ""}

【可用座位 Available Tables】
${tableDescriptions}

【核心配對原則 Core Matching Principles】
1. **價值互補 (Value Complementarity)**: 優先配對能解決來賓「瓶頸」的專業人士
2. **目標對接 (Target Alignment)**: 如果來賓有明確的「目標職業」，尋找該領域或能引薦該領域的會員
3. **資源交換 (Resource Exchange)**: 關注備註中的「價值提供」，配對能產生雙向價值的人脈
4. **行業互補 (Industry Synergy)**: 尋找上下游產業鏈、異業合作機會
5. **座位可用性 (Seat Availability)**: 優先選擇有空位的桌次 (<8人)

【配對策略 Matching Strategy】
- **High Match**: 桌上有2位以上會員能直接解決來賓瓶頸，或其職業正是來賓的目標對接對象
- **Medium Match**: 桌上有1位會員能提供相關協助，或行業高度相關
- **Low Match**: 桌上會員可提供一般人脈拓展，但無直接業務契合點

【輸出要求 Output Format】
請為每張桌次評分並排序（最佳配對在前），以 JSON 格式回應：

[
  {
    "tableNumber": 2,
    "matchStrength": "High",
    "reason": "桌上有 [會員名稱] ([職業]) 能直接解決來賓的 [具體瓶頸]，並且 [會員名稱2] 在 [目標行業] 有豐富人脈，可提供精準引薦。"
  },
  ...
]

**重要提醒**: 請確保每個 reason 具體說明「誰」能提供「什麼價值」給來賓，而非泛泛而談。`;
};

const callDeepSeek = async (
  prompt: string
): Promise<RankedTable[] | null> => {
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
        max_tokens: 1000,
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found in DeepSeek response");

    return JSON.parse(jsonMatch[0]) as RankedTable[];
  } catch (error) {
    console.error("DeepSeek API failed:", error);
    return null;
  }
};

const callGemini = async (prompt: string): Promise<RankedTable[] | null> => {
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

    return JSON.parse(jsonMatch[0]) as RankedTable[];
  } catch (error) {
    console.error("Gemini API failed:", error);
    return null;
  }
};

export const rankTablesWithAI = async (
  guest: Guest,
  tables: TableGroup[]
): Promise<{ ranked: RankedTable[]; provider: AIProvider }> => {
  const prompt = buildPrompt(guest, tables);

  // Try DeepSeek first
  const deepseekResult = await callDeepSeek(prompt);
  if (deepseekResult && deepseekResult.length > 0) {
    return { ranked: deepseekResult, provider: "deepseek" };
  }

  // Fallback to Gemini
  const geminiResult = await callGemini(prompt);
  if (geminiResult && geminiResult.length > 0) {
    return { ranked: geminiResult, provider: "gemini" };
  }

  // Both failed
  return { ranked: [], provider: null };
};
