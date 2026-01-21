import type { Guest, MatchResult, Member, RankedTable } from "../types/seating";
import { rankTablesWithAI } from "./aiClient";
import { rankTablesByKeyword, buildKeywordNote } from "./keywordMatch";

const MAX_TABLE_SIZE = 8;

const groupMembersByTable = (members: Member[]) => {
  const map = new Map<number, Member[]>();
  for (const member of members) {
    const list = map.get(member.tableNumber) ?? [];
    list.push(member);
    map.set(member.tableNumber, list);
  }
  return [...map.entries()]
    .map(([tableNumber, tableMembers]) => ({
      tableNumber,
      members: tableMembers,
    }))
    .sort((a, b) => a.tableNumber - b.tableNumber);
};

const pickAssignedTable = (
  rankedTables: RankedTable[],
  tableSizes: Map<number, number>
) => {
  for (const ranked of rankedTables) {
    const size = tableSizes.get(ranked.tableNumber) ?? 0;
    if (size < MAX_TABLE_SIZE) return ranked;
  }
  return null;
};

export async function assignGuestToTable(
  guest: Guest,
  members: Member[]
): Promise<MatchResult & { provider?: "deepseek" | "gemini" | "keyword" | null }> {
  const tables = groupMembersByTable(members);
  const tableSizes = new Map(
    tables.map((table) => [table.tableNumber, table.members.length])
  );

  // Try AI matching first
  const aiResult = await rankTablesWithAI(guest, tables);
  let rankedTables = aiResult.ranked;
  let matchNote = "";
  let provider = aiResult.provider;

  // Fallback to keyword matching if AI fails
  if (!rankedTables || rankedTables.length === 0) {
    rankedTables = rankTablesByKeyword(guest, tables);
    matchNote = buildKeywordNote(guest, rankedTables);
    provider = "keyword";
  }

  const assigned = rankedTables ? pickAssignedTable(rankedTables, tableSizes) : null;

  // Handle full tables
  if (!assigned && rankedTables?.length) {
    const smallest = [...tableSizes.entries()].sort((a, b) => a[1] - b[1])[0];
    matchNote =
      matchNote ||
      "All tables are full. Please open a new table or expand seating.";
    return {
      assignedTableNumber: smallest ? smallest[0] : null,
      matchStrength: rankedTables[0]?.matchStrength ?? "Low",
      matchNote,
      rankedTables,
      provider,
    };
  }

  // Generate match note if not already set
  if (assigned && !matchNote) {
    const providerLabel = 
      provider === "deepseek" ? "[DeepSeek AI]" :
      provider === "gemini" ? "[Gemini AI]" :
      "[Keyword Match]";
    matchNote = `${providerLabel} Placed at Table ${assigned.tableNumber} because ${assigned.reason}`;
  }

  return {
    assignedTableNumber: assigned?.tableNumber ?? null,
    matchStrength: assigned?.matchStrength ?? "Low",
    matchNote:
      matchNote ||
      "No strong match found. Consider adding more members or tables.",
    rankedTables: rankedTables ?? [],
    provider,
  };
}
