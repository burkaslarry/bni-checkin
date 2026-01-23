import type { Guest } from "../types/seating";

/**
 * 範例來賓資料 - 展示如何精準填寫以獲得 High Match
 * 
 * 填寫技巧:
 * 1. 職業: 寫具體職稱，如「高淨值客戶財富管理師」而非「金融業」
 * 2. 目標職業: 寫具體對象，如「法律事務所合夥人」而非「律師」
 * 3. 瓶頸: 寫出具體缺什麼、誰能幫忙
 * 4. 備註: 使用「我有X、我想找Y、我能提供Z」公式
 */

export const sampleGuests: Guest[] = [
  {
    id: "sample-1",
    name: "Kazel Lau",
    profession: "中小企業資安合規顧問 (SME Cybersecurity Compliance Consultant)",
    targetProfession: "連鎖零售業老闆、電商平台創辦人、或擁有大量企業客戶的保險經紀人",
    bottlenecks: [
      "缺乏進入連鎖零售業的管道",
      "需要能處理ISO 27001認證的合作夥伴",
      "尋找有企業客戶資源的轉介紹夥伴"
    ],
    remarks: "我有超過10年的企業防駭經驗，專注於AI驅動的資安防禦。我手上有準備好的免費資安風險評估方案，可為桌友的客戶提供初步檢測。如果你有客戶擔心數據洩漏或想降低網路保險費，我可以作為你的技術後盾，並提供業界最新的資安趨勢分享。"
  },
  {
    id: "sample-2",
    name: "Michael Chen",
    profession: "家族辦公室財富管理師 (Family Office Wealth Manager)",
    targetProfession: "移民顧問、跨國稅務律師、或正在尋求海外資產配置的企業主",
    bottlenecks: [
      "缺乏與高端法律服務的異業結盟",
      "需要能處理跨國稅務的合作夥伴",
      "尋找有高淨值客戶的轉介來源"
    ],
    remarks: "我手上有超過50位具備海外投資需求的準客戶，正在尋找專業律師和移民顧問合作。我能分享最新的家族辦公室設立趨勢、全球資產配置策略，並提供客戶轉介紹。我的客戶平均資產在500萬美元以上，適合需要高端客源的專業人士。"
  },
  {
    id: "sample-3",
    name: "Sarah Wong",
    profession: "企業數位轉型顧問 (Digital Transformation Consultant for SMEs)",
    targetProfession: "傳統製造業老闆、正在擴張的連鎖餐飲業主、或有大量中小企客戶的會計師",
    bottlenecks: [
      "缺乏傳統產業的信任建立管道",
      "需要能提供ERP系統整合的技術合作夥伴",
      "尋找有製造業人脈的引薦者"
    ],
    remarks: "我專注於協助年營收1000萬-1億的傳統企業進行數位化升級。我可以提供免費的數位成熟度評估（價值3萬），並分享10個實際成功案例。如果你的客戶正在為流程效率、庫存管理、或客戶管理系統煩惱，我能提供即時解決方案，並樂意分潤或建立長期合作關係。"
  }
];
