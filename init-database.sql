-- 建議：如果在重新執行此腳本時遇到錯誤，可以先刪除相關表格和視圖。

-- DROP MATERIALIZED VIEW IF EXISTS member_attendance_summary;
-- DROP TABLE IF EXISTS attendances;
-- DROP TABLE IF EXISTS events;
-- DROP TABLE IF EXISTS members;
-- DROP TABLE IF EXISTS profession_groups;


-- 1. 建立 profession_groups 表 (專業組別資料)
-- 儲存 BNI Anchor 的專業組別代碼及對應的中文名稱。
CREATE TABLE profession_groups (
    code CHAR(1) PRIMARY KEY,           -- 專業組別代碼 (例如：'A', 'B', 'C' 等)
    name TEXT NOT NULL UNIQUE           -- 專業組別的中文名稱
);

-- 插入專業組別資料
INSERT INTO profession_groups (code, name) VALUES
('A', '資訊及創新科技'),
('B', '專業及企業服務'),
('C', '建築工程及環境衛生'),
('D', '生活品味及家庭服務'),
('E', '市場推廣及展覽'),
('F', '品牌及廠商'), -- 根據圖片OCR結果
('G', '食品及餐飲'),
('H', '醫療、健康及運動'),
('J', '教育及培訓'),
('K', '金融、投資及地產');


-- 2. 建立 members 表 (會員資料)
-- 儲存 BNI Anchor 每位會員的資訊。
CREATE TABLE members (
    id SERIAL PRIMARY KEY,              -- 會員唯一識別碼，自動遞增
    name TEXT NOT NULL,                 -- 會員姓名，不可為空
    profession TEXT,                    -- 會員專業/行業
    profession_code CHAR(1) NOT NULL,   -- 會員所屬的專業分組代碼 (例如：'A', 'B', 'C' 等)
    position TEXT DEFAULT 'Member',     -- 會員職位，預設為 'Member'。可根據圖片中的藍色文字更新
    email TEXT UNIQUE,                  -- 會員電子郵件，若有則應唯一，可為空
    phone_number TEXT UNIQUE,           -- 會員電話號碼，若有則應唯一，可為空
    -- 添加外鍵約束，確保 profession_code 存在於 profession_groups 表中
    FOREIGN KEY (profession_code) REFERENCES profession_groups(code)
);

-- 插入 BNI Anchor 成員資料
INSERT INTO members (name, profession, profession_code, position) VALUES
-- (A) 資訊及創新科技
('Gigi Liu', '餐飲採購資訊平台', 'A', 'Member'),
('Eddie Chou', '區塊鏈系統開發', 'A', 'Member'),
('Larry Lo', '客戶服務系統', 'A', 'Member'),

-- (B) 專業及企業服務
('Chester Law', '審計服務', 'B', 'Member'),
('Leo Lam', '外勞輸入', 'B', 'Member'),
('Summer Ha', '稅務規劃', 'B', 'Member'),

-- (C) 建築工程及環境衛生
('Alfred Lau', '住宅裝修工程', 'C', 'Member'),
('Joanne Chan', '商業清潔', 'C', 'Member'),

-- (D) 生活品味及家庭服務
('Tam O Yan', '抗衰老顧問', 'D', '來賓接待'),
('Jessica Cheung', '陪月服務', 'D', '金章會員'),
('Andrew Fong', '手錶買賣', 'D', 'Member'),
('Phoebe Lin', '催乳及紮肚服務', 'D', 'Member'),
('Elaine Tang', '專業按摩團隊', 'D', 'Member'),
('Joe Li', '風水玄學', 'D', '新會員輔導'),
('Angel Liu', '珠寶批發', 'D', 'Member'),
('Zoe Wu', '花藝師', 'D', 'Member'),
('Eddy Wong', '汽車買賣', 'D', 'Member'),
('Fan Lam', '韓國女性及孕婦時裝', 'D', 'Member'),
('Charlotte Kamta', '鮮花批發零售', 'D', '副主席'),
('Cherry Xu', '中港車服務', 'D', 'Member'),
('Ling Wan', '僱傭服務', 'D', 'Member'),

-- (E) 市場推廣及展覽
('Jayden Wong', '活動場地佈置', 'E', 'Member'),
('Raymond Chan', '禮品訂製', 'E', 'Member'),
('Elva Cheung', '活動策劃', 'E', '網絡統籌'),
('Jason Wong', '品牌公關', 'E', 'Member'),

-- (G) 食品及餐飲 (注意：圖片中沒有F組的成員，直接跳到G組)
('Steve Ho', '節慶食品製造商', 'G', 'Member'),
('Stan Wang', '台式居酒屋', 'G', '活動統籌'),
('Ada Hau', '食品代理及批發', 'G', 'Member'),

-- (H) 醫療、健康及運動
('Eric Ho', '康體會所營運管理', 'H', '分會增長協調員'),
('Dr. Chow C.K.', '醫學美容', 'H', 'Member'),
('Chris Lee', '無創檢測', 'H', 'Member'),
('Kate Woo', '中醫', 'H', 'Member'),
('Frankie Ng', '目經眼藥水及護眼素', 'H', '財務秘書'),
('Locus Lam', '長者運動訓練', 'H', 'Member'),
('Li Ka Wai', '居家安老服務', 'H', 'Member'),
('Sunny Wong', '健身教練', 'H', 'Member'),

-- (J) 教育及培訓
('Eric Su', '升學移民', 'J', 'Member'),
('Eison Chiang', '科技教育', 'J', 'Member'),

-- (K) 金融、投資及地產
('Bill Chung', '銀行服務', 'K', 'Member'),
('Richard Wong', '強積金', 'K', 'Member'),
('Raymond Kuo', '個人理財及儲蓄保險', 'K', '主席'),
('Alfred Wong', '團體醫療保險', 'K', 'Member'),
('Cyrus Koo', '個人健康及保障保險', 'K', '教育統籌'),
('Wayne Lo', '一般保險', 'K', 'Member'),
('Dave Law', '住宅物業代理', 'K', 'Member');


-- 3. 建立 events 表 (活動資料)
-- 儲存每個 BNI Anchor 活動/會議的資訊。
CREATE TABLE events (
    id SERIAL PRIMARY KEY,                                  -- 活動唯一識別碼，自動遞增
    name TEXT NOT NULL,                                     -- 活動名稱，不可為空
    create_date DATE NOT NULL DEFAULT CURRENT_DATE,         -- 此活動記錄的建立日期，預設為當前日期
    event_date DATE NOT NULL,                               -- 活動實際舉行的日期
    start_time TIME NOT NULL,                               -- 活動的官方開始時間
    end_time TIME,                                          -- 活動的官方結束時間 (可選)
    on_time_cutoff_time TIME NOT NULL,                      -- 準時簽到的截止時間點
    late_cutoff_time TIME                                   -- 遲到簽到的截止時間點 (可選)。
                                                            -- 如果為 NULL，則在 on_time_cutoff_time 之後的簽到都視為 'late'。
);

-- 4. 建立 attendances 表 (簽到記錄)
-- 記錄每位會員在特定活動的簽到情況。
CREATE TABLE attendances (
    id SERIAL PRIMARY KEY,                                      -- 簽到記錄唯一識別碼，自動遞增
    member_id INTEGER NOT NULL REFERENCES members(id),          -- 簽到會員的 ID，外部鍵參考 members 表
    event_id INTEGER NOT NULL REFERENCES events(id),            -- 簽到所屬活動的 ID，外部鍵參考 events 表
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,            -- 會員實際簽到的精確時間戳 (包含日期、時間和時區)
    status TEXT NOT NULL CHECK (status IN ('on-time', 'late', 'absent', 'late_with_code')), -- 簽到狀態
    late_code_used BOOLEAN DEFAULT FALSE,                       -- 布林值，指示是否使用了特殊的遲到碼
    UNIQUE (member_id, event_id)                                -- 確保每個會員在每個活動中只能有一條簽到記錄
);

-- 5. 建立 member_attendance_summary 實體化視圖 (Materialized View)
-- 此視圖預先計算並儲存會員、活動和簽到狀態的聯結結果，用於快速報告。
CREATE MATERIALIZED VIEW member_attendance_summary AS
SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.profession,
    m.profession_code,
    pg.name AS profession_group_name, -- 從 profession_groups 表獲取完整的組別名稱
    m.position,
    e.id AS event_id,
    e.name AS event_name,
    e.event_date,
    a.check_in_time,
    a.status AS attendance_status,
    a.late_code_used
FROM
    members m
JOIN
    profession_groups pg ON m.profession_code = pg.code -- 聯結 profession_groups 表
JOIN
    attendances a ON m.id = a.member_id
JOIN
    events e ON a.event_id = e.id
ORDER BY
    e.event_date DESC, m.name;

-- 如何刷新實體化視圖 (當基礎數據有變動時，需要手動或定期刷新)
-- REFRESH MATERIALIZED VIEW member_attendance_summary;

-- 範例：如何查詢您想要的 "name | event 1 name | event 2 name | ..." 格式
-- 這種跨多列的動態報告通常在應用程式層處理，或使用更複雜的 SQL 查詢。
-- 以下是一個使用條件聚合 (Conditional Aggregation) 的範例，用於查詢特定幾個活動的簽到狀態：
/*
SELECT
    m.name AS member_name,
    -- 針對第一個活動的狀態
    MAX(CASE WHEN e.name = 'BNI Anchor 例會 2023-10-26' THEN a.status ELSE 'absent' END) AS "BNI Anchor 例會 2023-10-26_status",
    -- 針對第二個活動的狀態
    MAX(CASE WHEN e.name = 'BNI Anchor 專題分享會 2023-11-02' THEN a.status ELSE 'absent' END) AS "BNI Anchor 專題分享會 2023-11-02_status"
FROM
    members m
LEFT JOIN
    attendances a ON m.id = a.member_id
LEFT JOIN
    events e ON a.event_id = e.id
WHERE
    e.name IN ('BNI Anchor 例會 2023-10-26', 'BNI Anchor 專題分享會 2023-11-02') OR e.id IS NULL -- 確保所有會員都包含在內，即使他們沒有參加這些活動
GROUP BY
    m.name
ORDER BY
    m.name;
*/

