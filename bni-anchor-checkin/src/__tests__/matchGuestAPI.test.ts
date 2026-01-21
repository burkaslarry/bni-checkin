/**
 * Test suite for matchGuestAPI client-side API service
 */

import { describe, it, expect } from "vitest";
import {
  validateGuestData,
  validateMembersData,
  validateMatchGuestRequest,
} from "../lib/matchGuestAPI";
import type { Guest, Member } from "../types/seating";

describe("matchGuestAPI Validation", () => {
  describe("validateGuestData", () => {
    it("should pass validation for valid guest", () => {
      const guest: Guest = {
        id: "g1",
        name: "John Doe",
        profession: "Entrepreneur",
        targetProfession: "Contractor",
        bottlenecks: ["Need contractors"],
      };

      const errors = validateGuestData(guest);
      expect(errors).toHaveLength(0);
    });

    it("should fail validation when id is missing", () => {
      const guest: Partial<Guest> = {
        name: "John Doe",
        profession: "Entrepreneur",
        targetProfession: "Contractor",
        bottlenecks: [],
      };

      const errors = validateGuestData(guest as Guest);
      expect(errors.some((e) => e.includes("ID"))).toBe(true);
    });

    it("should fail validation when name is missing", () => {
      const guest: Partial<Guest> = {
        id: "g1",
        profession: "Entrepreneur",
        targetProfession: "Contractor",
        bottlenecks: [],
      };

      const errors = validateGuestData(guest as Guest);
      expect(errors.some((e) => e.includes("name"))).toBe(true);
    });

    it("should fail validation when profession is missing", () => {
      const guest: Partial<Guest> = {
        id: "g1",
        name: "John Doe",
        targetProfession: "Contractor",
        bottlenecks: [],
      };

      const errors = validateGuestData(guest as Guest);
      expect(errors.some((e) => e.includes("profession"))).toBe(true);
    });

    it("should fail validation when targetProfession is missing", () => {
      const guest: Partial<Guest> = {
        id: "g1",
        name: "John Doe",
        profession: "Entrepreneur",
        bottlenecks: [],
      };

      const errors = validateGuestData(guest as Guest);
      expect(errors.some((e) => e.includes("Target profession"))).toBe(true);
    });

    it("should fail validation when bottlenecks is not an array", () => {
      const guest = {
        id: "g1",
        name: "John Doe",
        profession: "Entrepreneur",
        targetProfession: "Contractor",
        bottlenecks: "some string",
      } as any as Guest;

      const errors = validateGuestData(guest);
      expect(errors.some((e) => e.includes("array"))).toBe(true);
    });
  });

  describe("validateMembersData", () => {
    it("should pass validation for valid members array", () => {
      const members: Member[] = [
        {
          id: "m1",
          name: "Jane Smith",
          profession: "Designer",
          tableNumber: 1,
        },
        {
          id: "m2",
          name: "Bob Johnson",
          profession: "Developer",
          tableNumber: 2,
        },
      ];

      const errors = validateMembersData(members);
      expect(errors).toHaveLength(0);
    });

    it("should fail validation when members is not an array", () => {
      const errors = validateMembersData(null as any);
      expect(errors.some((e) => e.includes("array"))).toBe(true);
    });

    it("should fail validation when members array is empty", () => {
      const errors = validateMembersData([]);
      expect(errors.some((e) => e.includes("At least one member"))).toBe(true);
    });

    it("should fail validation when member has no id", () => {
      const members = [
        {
          name: "Jane Smith",
          profession: "Designer",
          tableNumber: 1,
        } as any as Member,
      ];

      const errors = validateMembersData(members);
      expect(errors.some((e) => e.includes("ID"))).toBe(true);
    });

    it("should fail validation when member has no name", () => {
      const members = [
        {
          id: "m1",
          profession: "Designer",
          tableNumber: 1,
        } as any as Member,
      ];

      const errors = validateMembersData(members);
      expect(errors.some((e) => e.includes("Name"))).toBe(true);
    });

    it("should fail validation when member has no profession", () => {
      const members = [
        {
          id: "m1",
          name: "Jane Smith",
          tableNumber: 1,
        } as any as Member,
      ];

      const errors = validateMembersData(members);
      expect(errors.some((e) => e.includes("Profession"))).toBe(true);
    });

    it("should fail validation when tableNumber is invalid", () => {
      const members = [
        {
          id: "m1",
          name: "Jane Smith",
          profession: "Designer",
          tableNumber: 0,
        },
      ];

      const errors = validateMembersData(members);
      expect(errors.some((e) => e.includes("Table number"))).toBe(true);
    });

    it("should fail validation for multiple member errors", () => {
      const members = [
        {
          id: "m1",
          name: "Jane Smith",
          profession: "Designer",
          tableNumber: 1,
        },
        {
          name: "Bob",
          profession: "Developer",
          tableNumber: -1,
        } as any as Member,
      ];

      const errors = validateMembersData(members);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateMatchGuestRequest", () => {
    it("should combine guest and members validation", () => {
      const guest: Guest = {
        id: "g1",
        name: "John Doe",
        profession: "Entrepreneur",
        targetProfession: "Contractor",
        bottlenecks: ["Need contractors"],
      };

      const members: Member[] = [
        {
          id: "m1",
          name: "Jane Smith",
          profession: "Designer",
          tableNumber: 1,
        },
      ];

      const errors = validateMatchGuestRequest(guest, members);
      expect(errors).toHaveLength(0);
    });

    it("should report all validation errors", () => {
      const guest = {
        name: "John Doe",
        profession: "Entrepreneur",
        bottlenecks: "not an array",
      } as any as Guest;

      const members = [
        {
          name: "Jane",
          tableNumber: -1,
        } as any as Member,
      ];

      const errors = validateMatchGuestRequest(guest, members);
      expect(errors.length).toBeGreaterThan(2);
    });
  });
});
