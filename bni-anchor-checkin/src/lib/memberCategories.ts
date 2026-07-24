import type { MemberInfo } from "../api";

/** BNI profession groups — aligned with member list poster / init-database.sql */
export type MemberCategoryCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";

export type MemberCategory = {
  code: MemberCategoryCode | "OTHER";
  nameZh: string;
  nameEn: string;
  accent: string;
};

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

const CATEGORY_BY_CODE = Object.fromEntries(
  MEMBER_CATEGORIES.map((c) => [c.code, c])
) as Record<MemberCategoryCode, MemberCategory>;

const GROUP_NAME_TO_CODE: Record<string, MemberCategoryCode | "OTHER"> = {
  資訊及創新科技: "A",
  專業及企業服務: "B",
  建築工程及環境衛生: "C",
  生活品味及家庭服務: "D",
  市場推廣及展覽: "E",
  品牌及廠商: "F",
  食品及餐飲: "G",
  "醫療、健康及運動": "H",
  教育及培訓: "J",
  金融及投資: "I",
  "金融、投資及地產": "K",
};

export function resolveMemberCategoryCode(member: MemberInfo): MemberCategoryCode | "OTHER" {
  const raw = member.professionCode?.trim().toUpperCase();
  if (raw && raw in CATEGORY_BY_CODE) {
    return raw as MemberCategoryCode;
  }
  const fromName = member.professionGroupName?.trim();
  if (fromName && GROUP_NAME_TO_CODE[fromName]) {
    return GROUP_NAME_TO_CODE[fromName];
  }
  return "OTHER";
}

export function getMemberCategory(member: MemberInfo): MemberCategory {
  const code = resolveMemberCategoryCode(member);
  if (code === "OTHER") {
    return {
      code: "OTHER",
      nameZh: "未分類",
      nameEn: "Uncategorized",
      accent: "#64748b",
    };
  }
  return CATEGORY_BY_CODE[code];
}

export type MemberCategoryGroup = {
  category: MemberCategory;
  members: MemberInfo[];
};

/** Group members by poster profession category (A→K), then alphabetical within each group. */
export function groupMembersByCategory(members: MemberInfo[]): MemberCategoryGroup[] {
  const buckets = new Map<MemberCategoryCode | "OTHER", MemberInfo[]>();
  for (const member of members) {
    const code = resolveMemberCategoryCode(member);
    const list = buckets.get(code) ?? [];
    list.push(member);
    buckets.set(code, list);
  }

  const order: Array<MemberCategoryCode | "OTHER"> = [
    ...MEMBER_CATEGORIES.map((c) => c.code),
    "OTHER",
  ];

  return order
    .filter((code) => (buckets.get(code)?.length ?? 0) > 0)
    .map((code) => {
      const category =
        code === "OTHER"
          ? getMemberCategory({ name: "", domain: "" })
          : CATEGORY_BY_CODE[code as MemberCategoryCode];
      const groupMembers = [...(buckets.get(code) ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "zh-Hant")
      );
      return { category, members: groupMembers };
    });
}
