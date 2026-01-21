// Sample data for Strategic Seating Matchmaker demo

import type { Guest, Member } from "../types/seating";

export const sampleMembers: Member[] = [
  // Table 1
  { id: "m1", name: "張三豐", profession: "室內設計師 Interior Designer", tableNumber: 1 },
  { id: "m2", name: "李四海", profession: "會計師 Accountant", tableNumber: 1 },
  { id: "m3", name: "王五", profession: "律師 Lawyer", tableNumber: 1 },
  { id: "m4", name: "趙六", profession: "保險經紀 Insurance Broker", tableNumber: 1 },

  // Table 2
  { id: "m5", name: "陳大文", profession: "建築承包商 Contractor", tableNumber: 2 },
  { id: "m6", name: "林小明", profession: "數碼營銷專家 Digital Marketing Expert", tableNumber: 2 },
  { id: "m7", name: "黃美麗", profession: "房地產經紀 Real Estate Agent", tableNumber: 2 },
  { id: "m8", name: "周志強", profession: "IT 顧問 IT Consultant", tableNumber: 2 },
  { id: "m9", name: "吳靜雯", profession: "人力資源顧問 HR Consultant", tableNumber: 2 },

  // Table 3
  { id: "m10", name: "鄭家豪", profession: "財務策劃師 Financial Planner", tableNumber: 3 },
  { id: "m11", name: "梁詩琪", profession: "品牌顧問 Brand Consultant", tableNumber: 3 },
  { id: "m12", name: "蔡智勇", profession: "攝影師 Photographer", tableNumber: 3 },
  { id: "m13", name: "何嘉欣", profession: "活動策劃 Event Planner", tableNumber: 3 },
  { id: "m14", name: "馬俊傑", profession: "印刷服務 Printing Services", tableNumber: 3 },
  { id: "m15", name: "葉文軒", profession: "物流顧問 Logistics Consultant", tableNumber: 3 },
];

export const sampleGuests: Guest[] = [
  {
    id: "g1",
    name: "劉建國",
    profession: "創業家 Entrepreneur",
    targetProfession: "建築承包商 Contractor",
    bottlenecks: ["缺乏可靠的建築承包商", "需要室內設計合作夥伴"],
    remarks: "正在開發新的共享辦公空間項目",
  },
  {
    id: "g2",
    name: "蘇雅婷",
    profession: "網店店主 E-commerce Owner",
    targetProfession: "數碼營銷專家 Digital Marketing",
    bottlenecks: ["線上廣告效果不佳", "社交媒體觸及率低"],
    remarks: "經營時尚配飾網店，希望拓展客源",
  },
  {
    id: "g3",
    name: "許志明",
    profession: "餐廳老闆 Restaurant Owner",
    targetProfession: "品牌顧問 Brand Consultant",
    bottlenecks: ["品牌形象需要提升", "缺乏有效的市場定位"],
    remarks: "計劃開設第二家分店",
  },
];

export const getRandomGuest = (): Guest => {
  const index = Math.floor(Math.random() * sampleGuests.length);
  return sampleGuests[index];
};
