/**
 * Strategic Networking Matchmaker types (guest, member, match results, seating plan API).
 */

/** Guest profile for matching (id, name, profession, targetProfession, bottlenecks, remarks). */
export type Guest = {
  id: string;
  name: string;
  profession: string;
  targetProfession?: string;
  bottlenecks: string[];
  remarks?: string;
};

/** Member profile (id, name, profession). */
export type Member = {
  id: string;
  name: string;
  profession: string;
};

/** Match strength level. */
export type MatchStrength = "High" | "Medium" | "Low";

/** One recommended member for a guest (member, matchStrength, reason). */
export type MemberMatch = {
  member: Member;
  matchStrength: MatchStrength;
  reason: string;
};

/** Full match result (overall strength, note, recommended members). */
export type MatchResult = {
  matchStrength: MatchStrength;
  matchNote: string;
  recommendedMembers: MemberMatch[];
};

/** Request for seating plan API (eventId, guests, members). */
export type SeatingPlanRequest = {
  eventId: number;
  guests: Guest[];
  members: Member[];
};

/** Response from seating plan API (eventId, planId, createdAt, assignments). */
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
