/**
 * Integration test utilities for API matching endpoints
 */

import type { Guest, Member } from "../types/seating";

export async function callMatchGuestAPI(
  guest: Guest,
  members: Member[],
  baseUrl: string = "http://localhost:5173"
): Promise<any> {
  const response = await fetch(`${baseUrl}/api/match-guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ guest, members }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} - ${response.statusText}`);
  }

  return response.json();
}

export const createTestGuest = (overrides: Partial<Guest> = {}): Guest => {
  return {
    id: "test-guest-" + Date.now(),
    name: "Test Guest",
    profession: "Entrepreneur",
    targetProfession: "Contractor",
    bottlenecks: ["Need contractors"],
    ...overrides,
  };
};

export const createTestMember = (overrides: Partial<Member> = {}): Member => {
  return {
    id: "test-member-" + Date.now(),
    name: "Test Member",
    profession: "Designer",
    tableNumber: 1,
    ...overrides,
  };
};

export const createTestScenario = (
  memberCount: number = 12,
  tableCount: number = 3
) => {
  const members: Member[] = [];
  const professions = [
    "Contractor",
    "Designer",
    "Marketing Expert",
    "IT Consultant",
    "Financial Planner",
    "Brand Consultant",
    "HR Consultant",
    "Accountant",
  ];

  for (let i = 0; i < memberCount; i++) {
    members.push({
      id: `member-${i}`,
      name: `Member ${i}`,
      profession: professions[i % professions.length],
      tableNumber: (i % tableCount) + 1,
    });
  }

  return members;
};
