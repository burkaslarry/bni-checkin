/**
 * Direct DeepSeek API call for matching when backend is unreachable (e.g. production frontend, local backend).
 */

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

type MemberInfo = { name: string; profession: string };

/**
 * Build prompt text for DeepSeek matching. No side effects.
 * @param {string} guestName
 * @param {string} guestProfession
 * @param {string} [guestRemarks]
 * @param {string} memberList - Formatted list of members
 * @returns {string}
 */
function buildMatchPrompt(
  guestName: string,
  guestProfession: string,
  guestRemarks: string | undefined,
  memberList: string
): string {
  return `You are an elite strategic networking consultant for a BNI business event. Identify HIGH-VALUE connections.

【來賓 Guest】${guestName} - ${guestProfession}
${guestRemarks ? `備註 Remarks: ${guestRemarks}` : ""}

【可配對會員 Available Members】
${memberList}

【Output】Return JSON only, no other text:
{"matches": [
  {"memberName": "會員姓名", "matchStrength": "High", "reason": "具體配對原因"},
  ...
]}

- matchStrength: "High" | "Medium" | "Low"
- Recommend up to 10 members, sorted by value
- reason must be specific and in Traditional Chinese`;
}

/**
 * Match one guest to members via direct DeepSeek API. Requires VITE_DEEPSEEK_API_KEY.
 * Side effect: network call to api.deepseek.com.
 * @param {string} guestName
 * @param {string} guestProfession
 * @param {string} [guestRemarks]
 * @param {MemberInfo[]} members
 * @returns {Promise<Array<{ memberName: string; profession: string; matchStrength: string; reason: string }>>}
 * @throws {Error} If API key missing or API returns error / invalid JSON
 */
export async function matchOneGuestDirect(
  guestName: string,
  guestProfession: string,
  guestRemarks: string | undefined,
  members: MemberInfo[]
): Promise<{ memberName: string; profession: string; matchStrength: string; reason: string }[]> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string;
  if (!apiKey || apiKey.startsWith("your_")) {
    throw new Error("DeepSeek API key not configured. Please set VITE_DEEPSEEK_API_KEY in .env.local");
  }

  const memberList = members.map((m) => `- ${m.name} (${m.profession})`).join("\n");
  const prompt = buildMatchPrompt(guestName, guestProfession, guestRemarks, memberList);

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "你是一個專業的商業配對顧問。請務必只返回有效的 JSON 格式，不要包含任何其他說明文字。"
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from DeepSeek API");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid JSON in DeepSeek response");

  const parsed = JSON.parse(jsonMatch[0]) as { matches?: Array<{ memberName: string; matchStrength: string; reason: string }> };
  const matches = parsed.matches ?? [];
  if (!Array.isArray(matches)) throw new Error("Invalid matches format");

  return matches.map((m) => ({
    memberName: m.memberName ?? "",
    profession: members.find((x) => x.name === m.memberName)?.profession ?? "",
    matchStrength: m.matchStrength ?? "Low",
    reason: m.reason ?? ""
  }));
}
