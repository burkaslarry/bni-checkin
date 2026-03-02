# 🗄️ Supabase Database Setup Guide

## ✅ Database Information

**Database Name:** `bni-anchor-checking-system`  
**Project URL:** https://xovzbkrxxuthjczcrnwz.supabase.co  
**Project Reference:** `xovzbkrxxuthjczcrnwz`

---

## 📊 Current Database Status

**Tables Created:**
- ✅ `profession_groups` (10 rows) - 專業組別
- ✅ `members` (46 rows) - 會員資料 **[已更新 +3]**
- ✅ `guests` (0 rows) - 嘉賓資料
- ✅ `events` (0 rows) - 活動記錄
- ✅ `attendances` (0 rows) - 簽到記錄

**最新新增會員 (2026-02-10):**
- ✅ Kevin Cheung (ANCHOR-044) - 中式海鮮酒家 (Group G)
- ✅ Enoch Hung (ANCHOR-045) - 物理治療師 (Group H)
- ✅ Gabbie Ng (ANCHOR-046) - 小家電 (Group F)

**Indexes Created:**
- ✅ `idx_members_name` - 會員姓名索引
- ✅ `idx_members_standing` - 會員狀態索引
- ✅ `idx_guests_event_date` - 嘉賓活動日期索引
- ✅ `idx_attendances_member` - 簽到會員索引
- ✅ `idx_attendances_event` - 簽到活動索引

---

## 🔧 Backend Connection Setup

### Step 1: Get Your Database Password

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `bni-anchor-checking-system`
3. Navigate to: **Settings** → **Database**
4. Find the **Database password** section
5. Copy your password (or reset if forgotten)

### Step 2: Set Environment Variable

**Option A: Using .env file (Recommended)**
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your password
# SUPABASE_DB_PASSWORD=your_actual_password_here

# Load environment variables before running
export $(cat .env | xargs)
./run.sh
```

**Option B: Export directly**
```bash
export SUPABASE_DB_PASSWORD=your_actual_password_here
./run.sh
```

**Option C: Edit application.properties directly**
```properties
spring.datasource.password=your_actual_password_here
```

### Step 3: Verify Connection

After starting the backend, check the logs:
```bash
tail -f bni-anchor-checkin-backend/backend.log
```

You should see:
```
✅ HikariPool-1 - Start completed.
✅ Started BniAnchorCheckinBackendApplicationKt
```

---

## 🔑 API Keys (for frontend integration)

**Supabase URL:**
```
https://xovzbkrxxuthjczcrnwz.supabase.co
```

**Publishable API Key (Anon):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvdnpia3J4eHV0aGpjemNybnd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTIxMzgsImV4cCI6MjA4NDU4ODEzOH0.xUTHFiLxH19vgYEEGLucboo9ib7fGbvuI9QkqdZMXC8
```

**Modern Publishable Key:**
```
sb_publishable_kXvmAVQmUPkUI7m8NtOs9A_thVfzOrG
```

---

## 📋 Database Schema

### Members Table
```sql
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    profession TEXT,
    profession_code CHAR(1) NOT NULL,
    position TEXT DEFAULT 'Member',
    membership_id TEXT UNIQUE,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    standing TEXT DEFAULT 'GREEN',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profession_code) REFERENCES profession_groups(code)
);
```

### Guests Table
```sql
CREATE TABLE guests (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    profession TEXT NOT NULL,
    referrer TEXT,
    email TEXT,
    phone_number TEXT,
    event_date TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Quick Start

```bash
# 1. Set your Supabase password
export SUPABASE_DB_PASSWORD=your_password

# 2. Start the application
./run.sh

# 3. Access the application
# Frontend: http://localhost:5173
# Backend: http://localhost:10000
```

---

## 🔍 Verify Connection

Test the database connection:
```bash
# Check members count
curl http://localhost:10000/api/members | jq '.members | length'

# Should return: 46
```

---

## 📝 Notes

- ✅ Database schema is already created in Supabase
- ✅ 46 members already inserted (updated 2026-02-10)
  - New members: Kevin Cheung, Enoch Hung, Gabbie Ng
- ✅ Ready for guest imports
- ⚠️ **Security:** Never commit your .env file or actual password
- 💡 Use environment variables in production

---

## 🆘 Troubleshooting

**Issue:** Connection timeout
- Check if your Supabase project is paused
- Visit the dashboard to wake it up

**Issue:** Authentication failed
- Verify your password is correct
- Try resetting the password in Supabase Dashboard

**Issue:** "Failed to initialize pool"
- Check your network/firewall settings
- Ensure port 5432 is not blocked

---

Generated: 2026-02-10
