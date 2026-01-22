import type { Guest, RankedTable, TableGroup } from "../types/seating";

// Simple keyword-based matching as fallback
export const rankTablesByKeyword = (
  guest: Guest,
  tables: TableGroup[]
): RankedTable[] => {
  const targetKeywords = guest.targetProfession 
    ? guest.targetProfession.toLowerCase().split(/\s+/)
    : [];
  const bottleneckKeywords = guest.bottlenecks
    .join(" ")
    .toLowerCase()
    .split(/\s+/);

  const scored = tables.map((table) => {
    let score = 0;
    const professions = table.members
      .map((m) => m.profession.toLowerCase())
      .join(" ");

    // Check target profession match (if specified)
    targetKeywords.forEach((keyword) => {
      if (professions.includes(keyword)) score += 3;
    });

    // Check bottleneck resolution potential
    bottleneckKeywords.forEach((keyword) => {
      if (professions.includes(keyword)) score += 2;
    });

    // Prefer tables with space
    const seatsAvailable = 8 - table.members.length;
    score += seatsAvailable;

    let matchStrength: RankedTable["matchStrength"] = "Low";
    if (score >= 8) matchStrength = "High";
    else if (score >= 4) matchStrength = "Medium";

    const matchedProfessions = targetKeywords.length > 0
      ? table.members
          .filter((m) =>
            targetKeywords.some((kw) => m.profession.toLowerCase().includes(kw))
          )
          .map((m) => m.profession)
      : [];

    const reason =
      matchedProfessions.length > 0
        ? `Contains ${matchedProfessions.join(", ")} which aligns with your target profession`
        : `${seatsAvailable} seats available, general networking opportunity`;

    return {
      tableNumber: table.tableNumber,
      matchStrength,
      reason,
      score,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
};

export const buildKeywordNote = (
  guest: Guest,
  rankedTables: RankedTable[]
): string => {
  if (rankedTables.length === 0) {
    return "No suitable tables found. Please add more members or tables.";
  }

  const best = rankedTables[0];
  return `(Keyword Matching) Placed at Table ${best.tableNumber} because ${best.reason}`;
};
