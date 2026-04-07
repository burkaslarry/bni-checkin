## 點樣喺 Render.com / DBeaver 套用 DB migration（廣東話）

以下教你點樣將我哋新增嘅 schema update 檔案套用去 production DB：

- Migration 檔案：`docs/DB_MIGRATION_GUEST_CHECKIN_TIME.sql`
- 作用：為 `bni_anchor_guests` 加 `check_in_time`（TIMESTAMPTZ）同 index

---

## 0) 做之前要知

- **建議先做備份**：任何改 schema 都有風險。
- 呢個 migration 係 **idempotent**（用咗 `IF NOT EXISTS`），所以 **重複跑都唔會爆**。
- Render Postgres 通常係 **SSL 連線**，DBeaver 要開 SSL（大多數情況用 `require` 就得）。

---

## 方法 A：用 DBeaver（推薦）

### 1) 喺 Render 拎 DB 連線資料

入 Render dashboard → 你嘅 **PostgreSQL** 服務 → 搵到類似：

- **Host**
- **Port**
- **Database**
- **User**
- **Password**
- （可能有）**External Database URL** / **Connection String**

### 2) DBeaver 新增連線

1. 開 DBeaver → `Database` → `New Database Connection`
2. 揀 `PostgreSQL`
3. 填入 Render 提供嘅 Host/Port/DB/User/Password
4. 去 `SSL` tab：
   - **SSL mode**：揀 `require`（通常已經夠用）
5. `Test Connection` → 成功就 `Finish`

### 3) 開 SQL Editor，執行 migration

1. 右鍵你個 connection → `SQL Editor` → `New SQL Script`
2. 打開 repo 入面嘅檔案 `docs/DB_MIGRATION_GUEST_CHECKIN_TIME.sql`
3. Copy 全部內容貼去 DBeaver
4. 點 `Execute Script`（通常係閃電 icon）

### 4) 跑完點 verify

喺 DBeaver 再開一個 SQL script，執行：

```sql
-- 檢查欄位存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bni_anchor_guests'
  AND column_name = 'check_in_time';

-- 檢查 index 存在
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bni_anchor_guests'
  AND indexname = 'ix_bni_anchor_guests_event_date_check_in_time';
```

見到有 row 就代表成功。

---

## 方法 B：用 `psql`（你本機 terminal）

### 1) 確認你裝咗 psql

```bash
psql --version
```

### 2) 用 Render connection string 連線

Render 通常會提供一條 `postgres://...` URL。你可以：

```bash
psql "<render_external_database_url>"
```

連到之後，貼入 `docs/DB_MIGRATION_GUEST_CHECKIN_TIME.sql` 入面嘅 SQL 執行。

（或者你可以用 `-f` 直接跑檔案，但要確保你本機路徑對得上）

---

## 常見問題（FAQ）

### 1) 我跑 migration 話 permission denied？

- 可能你用咗 read-only user，或者 Render 個 DB user 權限唔夠。
- 用 Render 提供嘅 **主 DB user**（通常係 owner）再試。

### 2) DBeaver 連唔到，話 SSL / handshake error？

- 去 `SSL` 設定試下：
  - `SSL mode: require`
  - 或者 `verify-full`（如果你有 CA/cert）
- Render 端嘅 host/port 確認係 External 連線嗰組。

### 3) 跑完但 app 仲係舊行為？

- 呢個 migration 只係 schema；如果你同時更新咗 backend，記得 **deploy/restart backend**。

