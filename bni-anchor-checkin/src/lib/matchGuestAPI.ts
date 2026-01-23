/**
 * API Service for Strategic Seating Matchmaker
 * Handles communication with /api/match-guest endpoint
 */

import type { Guest, Member, MatchResult } from "../types/seating";

export type MatchGuestRequest = {
  guest: Guest;
  members: Member[];
};

export type MatchGuestResponse = MatchResult & {
  provider?: "deepseek" | "gemini" | "keyword" | null;
};

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

/**
 * Call the match-guest API endpoint to get seating recommendations
 */
export async function callMatchGuestAPI(
  guest: Guest,
  members: Member[]
): Promise<MatchGuestResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/match-guest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ guest, members } as MatchGuestRequest),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `API Error ${response.status}: ${errorData || response.statusText}`
      );
    }

    const data: MatchGuestResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Match Guest API failed:", error);
    throw error;
  }
}

/**
 * Health check for the API endpoint
 */
export async function checkMatchGuestAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/match-guest`, {
      method: "OPTIONS",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Validate guest data before sending to API
 */
export function validateGuestData(guest: Guest): string[] {
  const errors: string[] = [];

  if (!guest.id || guest.id.trim() === "") {
    errors.push("Guest ID is required");
  }
  if (!guest.name || guest.name.trim() === "") {
    errors.push("Guest name is required");
  }
  if (!guest.profession || guest.profession.trim() === "") {
    errors.push("Guest profession is required");
  }
  // Target profession is now optional
  if (!Array.isArray(guest.bottlenecks)) {
    errors.push("Bottlenecks must be an array");
  }

  return errors;
}

/**
 * Validate members data before sending to API
 */
export function validateMembersData(members: Member[]): string[] {
  const errors: string[] = [];

  if (!Array.isArray(members)) {
    errors.push("Members must be an array");
    return errors;
  }

  if (members.length === 0) {
    errors.push("At least one member is required");
  }

  members.forEach((member, index) => {
    if (!member.id || member.id.trim() === "") {
      errors.push(`Member ${index}: ID is required`);
    }
    if (!member.name || member.name.trim() === "") {
      errors.push(`Member ${index}: Name is required`);
    }
    if (!member.profession || member.profession.trim() === "") {
      errors.push(`Member ${index}: Profession is required`);
    }
  });

  return errors;
}

/**
 * Validate complete request payload
 */
export function validateMatchGuestRequest(
  guest: Guest,
  members: Member[]
): string[] {
  return [
    ...validateGuestData(guest),
    ...validateMembersData(members),
  ];
}
