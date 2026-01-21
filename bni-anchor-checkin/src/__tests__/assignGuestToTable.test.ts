/**
 * Unit Tests for Strategic Seating Matchmaker
 * Tests the core matching logic, constraints, and fallback mechanisms
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Guest, Member, MatchResult } from "../types/seating";
import { assignGuestToTable } from "../lib/assignGuestToTable";
import { rankTablesByKeyword } from "../lib/keywordMatch";

describe("Strategic Seating Matchmaker", () => {
  let testMembers: Member[];
  let testGuest: Guest;

  beforeEach(() => {
    // Setup: Create test data with 3 tables
    testMembers = [
      // Table 1: Contractors, Designers
      { id: "m1", name: "John Contractor", profession: "Contractor", tableNumber: 1 },
      { id: "m2", name: "Jane Designer", profession: "Interior Designer", tableNumber: 1 },
      { id: "m3", name: "Bob Builder", profession: "Contractor", tableNumber: 1 },

      // Table 2: Marketing, IT, Finance
      { id: "m4", name: "Alice Marketing", profession: "Digital Marketing Expert", tableNumber: 2 },
      { id: "m5", name: "Charlie IT", profession: "IT Consultant", tableNumber: 2 },
      { id: "m6", name: "Diana Finance", profession: "Financial Planner", tableNumber: 2 },

      // Table 3: Brand, HR (partial)
      { id: "m7", name: "Eve Brand", profession: "Brand Consultant", tableNumber: 3 },
      { id: "m8", name: "Frank HR", profession: "HR Consultant", tableNumber: 3 },
    ];

    testGuest = {
      id: "g1",
      name: "Test Guest",
      profession: "Entrepreneur",
      targetProfession: "Contractor",
      bottlenecks: ["Need contractors", "Design help"],
      remarks: "Building new office space",
    };
  });

  describe("Core Matching Logic", () => {
    it("should assign guest to best matching table with target profession", async () => {
      const result = await assignGuestToTable(testGuest, testMembers);

      expect(result).toBeDefined();
      expect(result.assignedTableNumber).toBeLessThanOrEqual(3);
      expect(result.assignedTableNumber).toBeGreaterThanOrEqual(1);
      expect(result.matchStrength).toBeDefined();
      expect(["High", "Medium", "Low"]).toContain(result.matchStrength);
    });

    it("should return match note explaining the assignment", async () => {
      const result = await assignGuestToTable(testGuest, testMembers);

      expect(result.matchNote).toBeDefined();
      expect(result.matchNote.length).toBeGreaterThan(0);
      expect(typeof result.matchNote).toBe("string");
    });

    it("should provide ranked table options", async () => {
      const result = await assignGuestToTable(testGuest, testMembers);

      expect(result.rankedTables).toBeDefined();
      expect(Array.isArray(result.rankedTables)).toBe(true);
      expect(result.rankedTables.length).toBeGreaterThan(0);
    });
  });

  describe("Constraints", () => {
    it("should respect max 8 people per table constraint", async () => {
      // Create a table with 8 people (full)
      const fullTable: Member[] = [
        { id: "m1", name: "P1", profession: "Contractor", tableNumber: 1 },
        { id: "m2", name: "P2", profession: "Contractor", tableNumber: 1 },
        { id: "m3", name: "P3", profession: "Contractor", tableNumber: 1 },
        { id: "m4", name: "P4", profession: "Contractor", tableNumber: 1 },
        { id: "m5", name: "P5", profession: "Contractor", tableNumber: 1 },
        { id: "m6", name: "P6", profession: "Contractor", tableNumber: 1 },
        { id: "m7", name: "P7", profession: "Contractor", tableNumber: 1 },
        { id: "m8", name: "P8", profession: "Contractor", tableNumber: 1 },
        // Table 2: Available
        { id: "m9", name: "P9", profession: "Designer", tableNumber: 2 },
      ];

      const result = await assignGuestToTable(testGuest, fullTable);

      // Guest should be assigned to Table 2 (Table 1 is full)
      expect(result.assignedTableNumber).toBe(2);
    });

    it("should prefer tables with available seats", async () => {
      const result = await assignGuestToTable(testGuest, testMembers);
      const assigned = result.assignedTableNumber;

      if (assigned !== null) {
        const assignedTableSize = testMembers.filter(m => m.tableNumber === assigned).length;
        expect(assignedTableSize).toBeLessThan(8);
      }
    });
  });

  describe("Keyword Matching Fallback", () => {
    it("should fallback to keyword matching when AI is unavailable", () => {
      const ranked = rankTablesByKeyword(testGuest, [
        { tableNumber: 1, members: testMembers.filter(m => m.tableNumber === 1) },
        { tableNumber: 2, members: testMembers.filter(m => m.tableNumber === 2) },
        { tableNumber: 3, members: testMembers.filter(m => m.tableNumber === 3) },
      ]);

      expect(ranked).toBeDefined();
      expect(ranked.length).toBeGreaterThan(0);
      // Should rank Table 1 highest (contains Contractors)
      expect(ranked[0].tableNumber).toBe(1);
    });

    it("should assign high strength to tables with target profession", () => {
      const ranked = rankTablesByKeyword(testGuest, [
        { tableNumber: 1, members: testMembers.filter(m => m.tableNumber === 1) },
        { tableNumber: 2, members: testMembers.filter(m => m.tableNumber === 2) },
        { tableNumber: 3, members: testMembers.filter(m => m.tableNumber === 3) },
      ]);

      // Table 1 should have high strength (has Contractors)
      const table1 = ranked.find(t => t.tableNumber === 1);
      expect(table1).toBeDefined();
      expect(table1?.matchStrength).toBe("High");
    });

    it("should assign medium/low strength to tables without target profession", () => {
      const ranked = rankTablesByKeyword(testGuest, [
        { tableNumber: 1, members: testMembers.filter(m => m.tableNumber === 1) },
        { tableNumber: 2, members: testMembers.filter(m => m.tableNumber === 2) },
        { tableNumber: 3, members: testMembers.filter(m => m.tableNumber === 3) },
      ]);

      // Table 3 should have medium/low strength (no Contractors)
      const table3 = ranked.find(t => t.tableNumber === 3);
      expect(table3).toBeDefined();
      expect(["Medium", "Low"]).toContain(table3?.matchStrength);
    });
  });

  describe("Match Result Structure", () => {
    it("should return well-formed MatchResult", async () => {
      const result = await assignGuestToTable(testGuest, testMembers);

      expect(result).toHaveProperty("assignedTableNumber");
      expect(result).toHaveProperty("matchStrength");
      expect(result).toHaveProperty("matchNote");
      expect(result).toHaveProperty("rankedTables");
    });

    it("should have valid match strength values", async () => {
      const result = await assignGuestToTable(testGuest, testMembers);

      expect(["High", "Medium", "Low"]).toContain(result.matchStrength);
    });

    it("should track AI provider used for matching", async () => {
      const result = await assignGuestToTable(testGuest, testMembers);

      if (result.provider) {
        expect(["deepseek", "gemini", "keyword", null]).toContain(result.provider);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle guest with no bottlenecks", async () => {
      const guestNoBN: Guest = {
        ...testGuest,
        bottlenecks: [],
      };

      const result = await assignGuestToTable(guestNoBN, testMembers);

      expect(result).toBeDefined();
      expect(result.assignedTableNumber).toBeDefined();
    });

    it("should handle guest with empty members list gracefully", async () => {
      const result = await assignGuestToTable(testGuest, []);

      expect(result).toBeDefined();
      expect(result.assignedTableNumber).toBeNull();
      expect(result.matchNote).toBeDefined();
    });

    it("should handle single member scenario", async () => {
      const singleMember: Member[] = [
        { id: "m1", name: "Solo", profession: "Contractor", tableNumber: 1 },
      ];

      const result = await assignGuestToTable(testGuest, singleMember);

      expect(result).toBeDefined();
      expect(result.assignedTableNumber).toBe(1);
    });

    it("should handle guest with special characters in fields", async () => {
      const specialGuest: Guest = {
        ...testGuest,
        name: "Jean-Paul O'Connor",
        profession: "CEO/Founder",
        bottlenecks: ["缺乏承包商", "Need 'designer'"],
      };

      const result = await assignGuestToTable(specialGuest, testMembers);

      expect(result).toBeDefined();
      expect(result.assignedTableNumber).toBeDefined();
    });
  });

  describe("Table Grouping", () => {
    it("should group members by table number correctly", async () => {
      const mixedMembers: Member[] = [
        { id: "m1", name: "A", profession: "Contractor", tableNumber: 2 },
        { id: "m2", name: "B", profession: "Designer", tableNumber: 1 },
        { id: "m3", name: "C", profession: "Designer", tableNumber: 2 },
        { id: "m4", name: "D", profession: "Marketing", tableNumber: 1 },
      ];

      const result = await assignGuestToTable(testGuest, mixedMembers);
      const ranked = result.rankedTables;

      // Should have 2 tables in ranking
      expect(ranked.length).toBe(2);
      expect(ranked.map(t => t.tableNumber).sort()).toEqual([1, 2]);
    });
  });

  describe("Performance", () => {
    it("should handle 10+ tables efficiently", async () => {
      const manyTablesMembers: Member[] = [];
      for (let t = 1; t <= 10; t++) {
        for (let m = 0; m < 4; m++) {
          manyTablesMembers.push({
            id: `m${t}-${m}`,
            name: `Person ${t}-${m}`,
            profession: t % 2 === 0 ? "Contractor" : "Designer",
            tableNumber: t,
          });
        }
      }

      const startTime = Date.now();
      const result = await assignGuestToTable(testGuest, manyTablesMembers);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle batch assignments", async () => {
      const guests: Guest[] = [
        testGuest,
        {
          id: "g2",
          name: "Guest 2",
          profession: "Designer",
          targetProfession: "Marketing Expert",
          bottlenecks: ["Marketing"],
          remarks: "",
        },
      ];

      const results = await Promise.all(
        guests.map(g => assignGuestToTable(g, testMembers))
      );

      expect(results.length).toBe(2);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.assignedTableNumber).toBeDefined();
      });
    });
  });
});
