import { describe, expect, it } from "vitest";
import {
  categoriesFromProfessionGroups,
  groupMembersByCategory,
  resolveMemberCategoryCode,
} from "../lib/memberCategories";
import type { MemberInfo } from "../api";

const member = (overrides: Partial<MemberInfo>): MemberInfo => ({
  name: "Test",
  domain: "Domain",
  ...overrides,
});

describe("memberCategories", () => {
  it("groups members by professionCode in poster order", () => {
    const members: MemberInfo[] = [
      member({ name: "Zoe", professionCode: "K", domain: "Finance" }),
      member({ name: "Amy", professionCode: "A", domain: "IT" }),
      member({ name: "Bob", professionCode: "G", domain: "Food" }),
    ];

    const groups = groupMembersByCategory(members);
    expect(groups.map((g) => g.category.code)).toEqual(["A", "G", "K"]);
    expect(groups[0].members.map((m) => m.name)).toEqual(["Amy"]);
    expect(groups[2].members.map((m) => m.name)).toEqual(["Zoe"]);
  });

  it("falls back to professionGroupName when code is missing", () => {
    const m = member({ name: "Cal", professionGroupName: "食品及餐飲", domain: "Catering" });
    expect(resolveMemberCategoryCode(m)).toBe("G");
  });

  it("puts unknown members in OTHER", () => {
    const m = member({ name: "Legacy", domain: "Unknown" });
    expect(resolveMemberCategoryCode(m)).toBe("OTHER");
    const groups = groupMembersByCategory([m]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category.code).toBe("OTHER");
  });

  it("groups amax members with chapterId=2 profession group labels", () => {
    const amaxCategories = categoriesFromProfessionGroups([
      { code: "A", name: "生活品味" },
      { code: "B", name: "醫療保健" },
      { code: "H", name: "企業服務" },
    ]);
    const members: MemberInfo[] = [
      member({ name: "Ada Li", professionCode: "H", professionGroupName: "企業服務", domain: "物理治療" }),
      member({ name: "Anthony Lau", professionCode: "A", professionGroupName: "生活品味", domain: "酒" }),
    ];
    const groups = groupMembersByCategory(members, amaxCategories);
    expect(groups.map((g) => g.category.nameZh)).toEqual(["生活品味", "企業服務"]);
    expect(groups[0].members.map((m) => m.name)).toEqual(["Anthony Lau"]);
    expect(groups[1].members.map((m) => m.name)).toEqual(["Ada Li"]);
  });
});
