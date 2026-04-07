/**
 * API service for Strategic Seating Matchmaker: /api/match-guest (guest + members → match result).
 */

import type { Guest, Member, MatchResult } from "../types/seating";

/** Request body for match-guest API. */
export type MatchGuestRequest = {
  guest: Guest;
  members: Member[];
};

/** Response: MatchResult plus optional provider. */
export type MatchGuestResponse = MatchResult & {
  provider?: "deepseek" | "gemini" | "keyword" | null;
};

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

/**
 * Call match-guest API for seating recommendations. Side effect: network.
 * @param {Guest} guest
 * @param {Member[]} members
 * @returns {Promise<MatchGuestResponse>}
 * @throws {Error} On HTTP error (status + body)
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
 * Health check for match-guest API (OPTIONS request). Side effect: network. Returns false on error.
 * @returns {Promise<boolean>}
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
 * Validate guest before API call. No side effects.
 * @param {Guest} guest
 * @returns {string[]} List of error messages (empty if valid)
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
 * Validate members array before API call. No side effects.
 * @param {Member[]} members
 * @returns {string[]} List of error messages (empty if valid)
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
 * Validate full request (guest + members). No side effects.
 * @param {Guest} guest
 * @param {Member[]} members
 * @returns {string[]} Combined errors from validateGuestData and validateMembersData
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
