#!/usr/bin/env python3
"""Import BNI Anchor members from the Jul 2026 member list poster (BNI Member List_NEW.pdf)."""
import json
import sys

# Profession codes: A IT, B Professional, C Construction, D Lifestyle, E Marketing, G F&B, H Medical, K Finance
MEMBERS = [
    {"name": "Max Chan", "profession": "區塊鏈系統開發", "professionCode": "A", "position": "Member"},
    {"name": "Larry Lo", "profession": "客戶管理系統", "professionCode": "A", "position": "網絡統籌"},
    {"name": "Johnny Li", "profession": "會計及審計", "professionCode": "B", "position": "Member"},
    {"name": "Leo Lam", "profession": "外勞輸入", "professionCode": "B", "position": "Member"},
    {"name": "One Chan", "profession": "商業活動策劃", "professionCode": "B", "position": "Member"},
    {"name": "Ace Nau", "profession": "室內設計及裝修", "professionCode": "C", "position": "Member"},
    {"name": "Joanne Chan", "profession": "商業及家居清潔", "professionCode": "C", "position": "Member"},
    {"name": "Andrew Fong", "profession": "手錶買賣", "professionCode": "D", "position": "活動統籌"},
    {"name": "Joe Li", "profession": "風水玄學", "professionCode": "D", "position": "Member"},
    {"name": "Zoe Wu", "profession": "花藝師", "professionCode": "D", "position": "來賓接待"},
    {"name": "Jessica Cheung", "profession": "陪月服務", "professionCode": "D", "position": "主席"},
    {"name": "Phoebe Lin", "profession": "催乳及紮肚服務", "professionCode": "D", "position": "Member"},
    {"name": "Eddy Wong", "profession": "汽車買賣", "professionCode": "D", "position": "Member"},
    {"name": "Cherry Xu", "profession": "中港車服務", "professionCode": "D", "position": "Member"},
    {"name": "Elva Cheung", "profession": "客製化歌曲訂製", "professionCode": "D", "position": "Member"},
    {"name": "Fan Lam", "profession": "韓國女性及孕婦時裝", "professionCode": "D", "position": "Member"},
    {"name": "Yoko Sin", "profession": "催債服務", "professionCode": "D", "position": "Member"},
    {"name": "Charlotte Kamta", "profession": "鮮花批發零售", "professionCode": "D", "position": "Member"},
    {"name": "Jayden Wong", "profession": "活動場地佈置", "professionCode": "E", "position": "Member"},
    {"name": "Jason Wong/Hayes Lam", "profession": "品牌公關", "professionCode": "E", "position": "Member"},
    {"name": "Raymond Chan", "profession": "禮品訂製", "professionCode": "E", "position": "Member"},
    {"name": "Steve Ho", "profession": "節慶食品製造商", "professionCode": "G", "position": "Member"},
    {"name": "Stan Wang", "profession": "台式居酒屋", "professionCode": "G", "position": "分會增長協調"},
    {"name": "Ada Hau", "profession": "食品代理及批發", "professionCode": "G", "position": "Member"},
    {"name": "Kevin Cheung", "profession": "中式海鮮酒家", "professionCode": "G", "position": "Member"},
    {"name": "Eric Ho", "profession": "康體會所營運管理", "professionCode": "H", "position": "Member"},
    {"name": "Chris Lee", "profession": "無創檢測", "professionCode": "H", "position": "Member"},
    {"name": "Frankie Ng", "profession": "目經一眼藥水及護眼素", "professionCode": "H", "position": "財務秘書"},
    {"name": "Li Ka Wai", "profession": "居家安老服務", "professionCode": "H", "position": "Member"},
    {"name": "Dr. Chow C.K.", "profession": "醫學美容", "professionCode": "H", "position": "Member"},
    {"name": "Locus Lam", "profession": "長者運動訓練", "professionCode": "H", "position": "Member"},
    {"name": "Steves Tse", "profession": "健身教練", "professionCode": "H", "position": "Member"},
    {"name": "Kate Woo", "profession": "中醫", "professionCode": "H", "position": "Member"},
    {"name": "Gigi Liu", "profession": "日本小顏術", "professionCode": "H", "position": "Member"},
    {"name": "Enoch Hung", "profession": "物理治療師", "professionCode": "H", "position": "Member"},
    {"name": "Vincent Chung", "profession": "專科醫療中心", "professionCode": "H", "position": "Member"},
    {"name": "Bill Chung", "profession": "銀行服務", "professionCode": "K", "position": "Member"},
    {"name": "Raymond Kuo", "profession": "個人保險(理財及儲蓄)", "professionCode": "K", "position": "教育統籌"},
    {"name": "Wayne Lo", "profession": "一般保險", "professionCode": "K", "position": "Member"},
    {"name": "Cyrus Koo", "profession": "個人保險(健康及保障)", "professionCode": "K", "position": "新會員輔導"},
    {"name": "Richard Wong", "profession": "強積金", "professionCode": "K", "position": "副主席"},
]

POSTER_NAMES = {m["name"].casefold() for m in MEMBERS}

# Local legacy names that should map to poster entries before cleanup.
RENAME_ALIASES = {
    "Dr. Chow Chong Kwan": "Dr. Chow C.K.",
}

if __name__ == "__main__":
    print(json.dumps(MEMBERS, ensure_ascii=False, indent=2))
    print(f"# total: {len(MEMBERS)}", file=sys.stderr)
