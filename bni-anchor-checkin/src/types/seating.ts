// Strategic Networking Matchmaker Types

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
};

export type MatchStrength = "High" | "Medium" | "Low";

// Recommended member combination for the guest
export type MemberMatch = {
  member: Member;
  matchStrength: MatchStrength;
  reason: string;
};

export type MatchResult = {
  matchStrength: MatchStrength;
  matchNote: string;
  recommendedMembers: MemberMatch[];
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
