# BNI Anchor 簽到系統前端 - 快速入門指南

## 📋 簡介

呢個係 BNI Anchor 分會會議出席簽到嘅 Progressive Web App (PWA)。

## 🎯 功能

### 簽到功能
- **👤 會員簽到**：由下拉選單選擇或掃描 QR 碼
- **🎫 來賓簽到**：手動輸入姓名或掃描 QR 碼
- **🚫 防止重複**：同一個人唔可以簽到兩次

### 管理工具（喺 `/admin`）
- **🔳 QR 碼生成器**：生成活動 QR 碼
- **📋 記錄管理**：查看、搜尋、篩選同刪除記錄
- **📥 CSV 匯出**：下載出席記錄做 CSV
- **🔍 會員搜尋**：搜尋出席歷史

## 🚀 快速開始

### 事前準備

- Node.js 18+
- npm 或 yarn

### 安裝

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build
```

### 開發網址

- 前端首頁：http://localhost:5173
- 管理頁面：http://localhost:5173/admin

## 📱 頁面說明

### 首頁 (`/`)

主要簽到介面，有兩個選項：
- **👤 會員簽到** - BNI Anchor 會員專用
- **🎫 來賓簽到** - 訪客簽到

### 管理頁面 (`/admin`)

管理工具：
- **🔳 產生 QR 碼** - 生成活動 QR 碼
- **📋 簽到記錄** - 查看同管理記錄
- **📥 匯出資料** - 匯出做 CSV

## 🌐 部署到 Vercel

### 方法一：用 Vercel CLI

```bash
# 進入前端目錄
cd bni-anchor-checkin

# 部署到 Vercel
npx vercel --prod

# 設定環境變數（用你嘅 Render 後端 URL）
npx vercel env add VITE_API_BASE production
# 輸入：https://bni-anchor-checkin-backend.onrender.com
```

### 方法二：用 Vercel Dashboard

1. 去 https://vercel.com/new
2. Import Git Repository
3. 選擇 **bni-anchor-checkin**
4. 設定環境變數：
   - **VITE_API_BASE** = `https://你嘅-render-url.onrender.com`
5. 撳 **Deploy**

## ⚙️ 環境變數設定

### 本機開發

創建 `.env.local` 檔案：

```env
VITE_API_BASE=http://localhost:8080
```

### 生產環境（Vercel）

喺 Vercel Dashboard 設定：

```env
VITE_API_BASE=https://bni-anchor-checkin-backend.onrender.com
```

## 🧪 測試流程

### 1. 會員簽到測試

1. 打開首頁 http://localhost:5173
2. 撳 **👤 會員簽到**
3. 由下拉選單選擇一位會員（例如：Larry Lo）
4. 撳 **✅ 確認簽到**
5. 應該見到成功通知

### 2. 來賓簽到測試

1. 撳 **🎫 來賓簽到**
2. 輸入來賓姓名
3. 撳 **✅ 確認簽到**

### 3. 重複簽到測試（應該失敗）

1. 再次嘗試簽到同一個人
2. 應該見到錯誤訊息：「已經簽到過了」

### 4. 管理功能測試

1. 去 http://localhost:5173/admin
2. 撳 **📋 簽到記錄** 查看所有記錄
3. 可以刪除個別記錄或清除全部

## 📁 專案結構

```
src/
├── App.tsx                    # 路由設定
├── api.ts                     # API 客戶端
├── main.tsx                   # 入口點
├── styles.css                 # 全域樣式
├── pages/
│   ├── HomePage.tsx           # 主要簽到頁面
│   └── AdminPage.tsx          # 管理儀表板
└── components/
    ├── MemberCheckinPanel.tsx # 會員簽到
    ├── GuestCheckinPanel.tsx  # 來賓簽到
    ├── QRGeneratorPanel.tsx   # QR 碼生成器
    ├── RecordsPanel.tsx       # 記錄管理
    └── ExportPanel.tsx        # CSV 匯出
```

## ❓ 常見問題

### Q: 點解會員名單係空嘅？
A: 確保後端伺服器正常運行，同埋 `VITE_API_BASE` 環境變數設定正確。

### Q: 點解 QR 掃描唔 work？
A: QR 掃描需要 HTTPS 或 localhost。確保喺支援嘅瀏覽器（Chrome、Edge）使用。

### Q: 點樣去管理頁面？
A: 直接輸入網址 `/admin`，例如 http://localhost:5173/admin

### Q: 點樣清除所有簽到記錄？
A: 去管理頁面 → 簽到記錄 → 撳「清除全部記錄」

## 🔗 相關連結

- [後端 API](../bni-anchor-checkin-backend) - Kotlin/Spring Boot 後端
- [Vercel Dashboard](https://vercel.com) - 前端部署平台
- [Render Dashboard](https://render.com) - 後端部署平台

