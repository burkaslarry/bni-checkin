import type { MemberInfo } from "../api";

/** Profession category code letter (chapter-defined; Anchor A–K, AMax A–I, …). */
export type MemberCategoryCode = string;

export type MemberCategory = {
  code: MemberCategoryCode | "OTHER";
  nameZh: string;
  nameEn: string;
  accent: string;
};

/** Fallback accents by code letter when chapter groups are loaded from API. */
const ACCENT_BY_CODE: Record<string, string> = {
  A: "#ef4444",
  B: "#f97316",
  C: "#eab308",
  D: "#22c55e",
  E: "#84cc16",
  F: "#a3a3a3",
  G: "#38bdf8",
  H: "#1d4ed8",
  I: "#dc2626",
  J: "#6366f1",
  K: "#a855f7",
};

/** BNI Anchor defaults — used when profession-groups API is unavailable. */
export const MEMBER_CATEGORIES: MemberCategory[] = [
  { code: "A", nameZh: "資訊及創新科技", nameEn: "Information Technology", accent: "#ef4444" },
  { code: "B", nameZh: "專業及企業服務", nameEn: "Professional & Corporate Services", accent: "#f97316" },
  { code: "C", nameZh: "建築工程及環境衛生", nameEn: "Construction & Engineering", accent: "#eab308" },
  { code: "D", nameZh: "生活品味及家庭服務", nameEn: "Lifestyle & Family Services", accent: "#22c55e" },
  { code: "E", nameZh: "市場推廣及展覽", nameEn: "Marketing & Exhibition", accent: "#84cc16" },
  { code: "F", nameZh: "品牌及廠商", nameEn: "Brand & Vendor", accent: "#a3a3a3" },
  { code: "G", nameZh: "食品及餐飲", nameEn: "Food & Beverage", accent: "#38bdf8" },
  { code: "H", nameZh: "醫療、健康及運動", nameEn: "Medical, Health & Sports", accent: "#1d4ed8" },
  { code: "I", nameZh: "金融及投資", nameEn: "Finance & Investment", accent: "#dc2626" },
  { code: "J", nameZh: "教育及培訓", nameEn: "Education & Training", accent: "#6366f1" },
  { code: "K", nameZh: "金融、投資及地產", nameEn: "Finance, Investment & Property", accent: "#a855f7" },
];

const OTHER_CATEGORY: MemberCategory = {
  code: "OTHER",
  nameZh: "未分類",
  nameEn: "Uncategorized",
  accent: "#64748b",
};

/** Map API profession groups → UI categories for the active chapter. */
export function categoriesFromProfessionGroups(
  groups: Array<{ code: string; name: string }>
): MemberCategory[] {
  return groups
    .map((g) => {
      const code = g.code.trim().toUpperCase();
      return {
        code,
        nameZh: g.name,
        nameEn: g.name,
        accent: ACCENT_BY_CODE[code] ?? "#64748b",
      } satisfies MemberCategory;
    })
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

function categoryByCode(
  categories: MemberCategory[],
  code: string
): MemberCategory | undefined {
  return categories.find((c) => c.code === code);
}

export function resolveMemberCategoryCode(
  member: MemberInfo,
  categories: MemberCategory[] = MEMBER_CATEGORIES
): MemberCategoryCode | "OTHER" {
  const raw = member.professionCode?.trim().toUpperCase();
  if (raw && categoryByCode(categories, raw)) {
    return raw;
  }
  const fromName = member.professionGroupName?.trim();
  if (fromName) {
    const hit = categories.find((c) => c.nameZh === fromName || c.nameEn === fromName);
    if (hit && hit.code !== "OTHER") return hit.code;
  }
  // Still bucket by letter code even if chapter catalog is incomplete
  if (raw && /^[A-Z]$/.test(raw)) return raw;
  return "OTHER";
}

export function getMemberCategory(
  member: MemberInfo,
  categories: MemberCategory[] = MEMBER_CATEGORIES
): MemberCategory {
  const code = resolveMemberCategoryCode(member, categories);
  if (code === "OTHER") return OTHER_CATEGORY;
  return (
    categoryByCode(categories, code) ?? {
      code,
      nameZh: member.professionGroupName?.trim() || code,
      nameEn: member.professionGroupName?.trim() || code,
      accent: ACCENT_BY_CODE[code] ?? "#64748b",
    }
  );
}

export type MemberCategoryGroup = {
  category: MemberCategory;
  members: MemberInfo[];
};

/**
 * Group members by chapter profession category code, then alphabetical within each group.
 * Pass `categories` from GET /api/profession-groups for the active chapter.
 */
export function groupMembersByCategory(
  members: MemberInfo[],
  categories: MemberCategory[] = MEMBER_CATEGORIES
): MemberCategoryGroup[] {
  const buckets = new Map<string, MemberInfo[]>();
  for (const member of members) {
    const code = resolveMemberCategoryCode(member, categories);
    const list = buckets.get(code) ?? [];
    list.push(member);
    buckets.set(code, list);
  }

  const knownCodes = categories.map((c) => String(c.code));
  const extraCodes = [...buckets.keys()]
    .filter((code) => code !== "OTHER" && !knownCodes.includes(code))
    .sort((a, b) => a.localeCompare(b));
  const order = [...knownCodes, ...extraCodes, "OTHER"];

  return order
    .filter((code) => (buckets.get(code)?.length ?? 0) > 0)
    .map((code) => {
      const category =
        code === "OTHER"
          ? OTHER_CATEGORY
          : categoryByCode(categories, code) ?? {
              code,
              nameZh: code,
              nameEn: code,
              accent: ACCENT_BY_CODE[code] ?? "#64748b",
            };
      const groupMembers = [...(buckets.get(code) ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "zh-Hant")
      );
      return { category, members: groupMembers };
    });
}
