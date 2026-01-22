// Strategic Seating Matchmaker Types

export type Guest = {
  id: string;
  name: string;
  profession: string;
  targetProfession?: string;
  bottlenecks: string[];
  remarks?: string;
};

export type Member = {
  id: string;
  name: string;
  profession: string;
  tableNumber: number;
};

export type MatchStrength = "High" | "Medium" | "Low";

export type RankedTable = {
  tableNumber: number;
  matchStrength: MatchStrength;
  reason: string;
  score?: number;
};

export type MatchResult = {
  assignedTableNumber: number | null;
  matchStrength: MatchStrength;
  matchNote: string;
  rankedTables: RankedTable[];
};

export type TableGroup = {
  tableNumber: number;
  members: Member[];
};

// API request/response types for seating
export type SeatingPlanRequest = {
  eventId: number;
  guests: Guest[];
  members: Member[];
};

export type SeatingPlanResponse = {
  eventId: number;
  planId: string;
  createdAt: string;
  assignments: {
    guestId: string;
    guestName: string;
    assignedTable: number | null;
    matchStrength: MatchStrength;
    matchNote: string;
  }[];
};
