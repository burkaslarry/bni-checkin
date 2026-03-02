-- ============================================================
-- BNI Anchor Check-in System - Database Initialization Script
-- ============================================================

-- Drop existing objects if re-running
DROP MATERIALIZED VIEW IF EXISTS bni_anchor_member_attendance_summary;
DROP TABLE IF EXISTS bni_anchor_attendances;
DROP TABLE IF EXISTS bni_anchor_events;
DROP TABLE IF EXISTS bni_anchor_guests;
DROP TABLE IF EXISTS bni_anchor_members;
DROP TABLE IF EXISTS bni_anchor_profession_groups;


-- 1. Profession groups
CREATE TABLE bni_anchor_profession_groups (
    code CHAR(1) PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

INSERT INTO bni_anchor_profession_groups (code, name) VALUES
('A', '資訊及創新科技'),
('B', '專業及企業服務'),
('C', '建築工程及環境衛生'),
('D', '生活品味及家庭服務'),
('E', '市場推廣及展覽'),
('F', '品牌及廠商'),
('G', '食品及餐飲'),
('H', '醫療、健康及運動'),
('J', '教育及培訓'),
('K', '金融、投資及地產');


-- 2. Members
CREATE TABLE bni_anchor_members (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    profession TEXT,
    profession_code CHAR(1) NOT NULL,
    position TEXT DEFAULT 'Member',
    membership_id TEXT UNIQUE,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    standing TEXT DEFAULT 'GREEN' CHECK (standing IN ('GREEN', 'YELLOW', 'RED', 'BLACK')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profession_code) REFERENCES bni_anchor_profession_groups(code)
);

INSERT INTO bni_anchor_members (name, profession, profession_code, position, membership_id) VALUES
-- (A)
('Larry Lo', '客戶服務系統', 'A', 'Member', 'ANCHOR-007'),
('Gigi Liu', '餐飲採購資訊平台', 'A', 'Member', 'ANCHOR-012'),
('Eddie Chou', '區塊鏈系統開發', 'A', 'Member', 'ANCHOR-020'),
('Kevin Ho', '電動車充電設備及安裝', 'A', 'Member', 'ANCHOR-041'),
-- (B)
('Chester Law', '審計服務', 'B', 'Member', 'ANCHOR-010'),
('Leo Lam', '外勞輸入', 'B', 'Member', 'ANCHOR-014'),
('Summer Ha', '稅務規劃', 'B', 'Member', 'ANCHOR-029'),
-- (C)
('Alfred Lau', '住宅裝修工程', 'C', 'Member', 'ANCHOR-017'),
('Joanne Chan', '商業清潔', 'C', 'Member', 'ANCHOR-026'),
-- (D)
('Jessica Cheung', '陪月服務', 'D', '金章會員', 'ANCHOR-001'),
('Tam O Yan', '內外抗衰老顧問', 'D', '來賓接待', 'ANCHOR-002'),
('Joe Li', '風水玄學', 'D', '新會員輔導', 'ANCHOR-006'),
('Zoe Wu', '花藝師', 'D', 'Member', 'ANCHOR-008'),
('Charlotte Kamta', '鮮花批發零售', 'D', '副主席', 'ANCHOR-009'),
('Andrew Fong', '手錶買賣', 'D', 'Member', 'ANCHOR-027'),
('Eddy Wong', '汽車買賣', 'D', 'Member', 'ANCHOR-028'),
('Fan Lam', '女性及孕婦時裝', 'D', 'Member', 'ANCHOR-036'),
('Phoebe Lin', '催乳及紓肚服務', 'D', 'Member', 'ANCHOR-037'),
('Cherry Xu', '中港車服務', 'D', 'Member', 'ANCHOR-038'),
('Ling Wan', '僱傭服務', 'D', 'Member', 'ANCHOR-039'),
-- (E)
('Jayden Wong', '活動場地佈置', 'E', 'Member', 'ANCHOR-023'),
('Raymond Chan', '禮品訂製', 'E', 'Member', 'ANCHOR-024'),
('Elva Cheung', '活動策劃', 'E', '網絡統籌', 'ANCHOR-025'),
('Jason Wong', '品牌規劃', 'E', 'Member', 'ANCHOR-034'),
-- (F)
('Gabbie Ng', '小家電', 'F', 'Member', 'ANCHOR-046'),
-- (G)
('Stan Wang', '台式居酒屋', 'G', '活動統籌', 'ANCHOR-011'),
('Steve Ho', '節慶食品製造商', 'G', 'Member', 'ANCHOR-018'),
('Ada Hau', '食品代理及批發', 'G', 'Member', 'ANCHOR-030'),
('Kevin Cheung', '中式海鮮酒家', 'G', 'Member', 'ANCHOR-044'),
-- (H)
('Eric Ho', '康體會所營運管理', 'H', '分會增長協調員', 'ANCHOR-004'),
('Chris Lee', '無創檢測', 'H', 'Member', 'ANCHOR-015'),
('Frankie Ng', '目經眼藥水及護眼素', 'H', '財務秘書', 'ANCHOR-019'),
('Hing Wong', '泰拳教練', 'H', 'Member', 'ANCHOR-022'),
('Dr. Chow Chong Kwan', '醫學美容', 'H', 'Member', 'ANCHOR-031'),
('Kate Woo', '中醫', 'H', 'Member', 'ANCHOR-033'),
('Li Ka Wai', '居家安老服務', 'H', 'Member', 'ANCHOR-035'),
('Sunny Wong', '健身教練', 'H', 'Member', 'ANCHOR-040'),
('Locus Lam', '長者運動訓練', 'H', 'Member', 'ANCHOR-043'),
('Enoch Hung', '物理治療師', 'H', 'Member', 'ANCHOR-045'),
-- (J)
('Eric Su', '升學移民', 'J', 'Member', 'ANCHOR-013'),
('Eison Chiang', '科技教育', 'J', 'Member', 'ANCHOR-042'),
-- (K)
('Cyrus Koo', '個人保險(健康及保障)', 'K', '教育統籌', 'ANCHOR-003'),
('Raymond Kuo', '個人保險(理財及儲蓄)', 'K', '主席', 'ANCHOR-005'),
('Bill Chung', '銀行服務', 'K', 'Member', 'ANCHOR-016'),
('Richard Wong', '強積金', 'K', 'Member', 'ANCHOR-021'),
('Catherine Suen', '一般保險', 'K', 'Member', 'ANCHOR-032');


-- 2b. Guests
CREATE TABLE bni_anchor_guests (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    profession TEXT NOT NULL,
    referrer TEXT,
    email TEXT,
    phone_number TEXT,
    event_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 3. Events
CREATE TABLE bni_anchor_events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    create_date DATE NOT NULL DEFAULT CURRENT_DATE,
    registration_start_time TIME NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    on_time_cutoff_time TIME NOT NULL,
    late_cutoff_time TIME
);


-- 4. Attendances (member_id FK, not member_name)
CREATE TABLE bni_anchor_attendances (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES bni_anchor_members(id),
    event_id INTEGER NOT NULL REFERENCES bni_anchor_events(id),
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('on-time', 'late', 'absent', 'late_with_code')),
    late_code_used BOOLEAN DEFAULT FALSE,
    UNIQUE (member_id, event_id)
);


-- 5. Materialized view for reporting
CREATE MATERIALIZED VIEW bni_anchor_member_attendance_summary AS
SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.profession,
    m.profession_code,
    pg.name AS profession_group_name,
    m.position,
    e.id AS event_id,
    e.name AS event_name,
    e.event_date,
    a.check_in_time,
    a.status AS attendance_status,
    a.late_code_used
FROM
    bni_anchor_members m
JOIN
    bni_anchor_profession_groups pg ON m.profession_code = pg.code
JOIN
    bni_anchor_attendances a ON m.id = a.member_id
JOIN
    bni_anchor_events e ON a.event_id = e.id
ORDER BY
    e.event_date DESC, m.name;
