import type { Guest, RankedTable, TableGroup } from "../types/seating";

// Environment variables (from .env.local or Vite config)
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || "deepseek-v3";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

type AIProvider = "deepseek" | "gemini" | null;

const buildPrompt = (guest: Guest, tables: TableGroup[]): string => {
  const tableDescriptions = tables
    .map((t) => {
      const professions = t.members.map((m) => m.profession).join(", ");
      return `Table ${t.tableNumber}: ${professions} (${t.members.length}/8 seats)`;
    })
    .join("\n");

  return `You are a strategic seating assistant for a BNI-style networking event.

Guest Profile:
- Name: ${guest.name}
- Profession: ${guest.profession}
- Target Profession: ${guest.targetProfession}
- Bottlenecks: ${guest.bottlenecks.join(", ")}
${guest.remarks ? `- Remarks: ${guest.remarks}` : ""}

Available Tables:
${tableDescriptions}

Instructions:
1. Rank ALL tables from best to worst based on "Referral Potential" and "Problem Solving" for this guest.
2. Consider which table members can help resolve the guest's bottlenecks or connect them with their target profession.
3. Prefer tables with available seats (under 8 people).
4. For each table, provide:
   - Table number
   - Match strength: "High", "Medium", or "Low"
   - Brief reason (1-2 sentences explaining the strategic match)

Response format (JSON array):
[
  { "tableNumber": 2, "matchStrength": "High", "reason": "..." },
  { "tableNumber": 1, "matchStrength": "Medium", "reason": "..." },
  ...
]`;
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
