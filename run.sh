#!/bin/bash

# 定義顏色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 正在啟動 BNI Anchor Check-in 系統...${NC}"

# 1. 停止現有服務
echo -e "${YELLOW}🔄 清理佔用的埠口...${NC}"
lsof -ti:10000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 2. 載入 .env (可選：僅用於 LOCAL_DB_PASSWORD 等，不啟用 production profile)
if [ -f ".env" ]; then
  set -a; source .env; set +a
  echo -e "${GREEN}✓ 已載入 .env${NC}"
elif [ -f "bni-anchor-checkin-backend/.env" ]; then
  set -a; source bni-anchor-checkin-backend/.env; set +a
  echo -e "${GREEN}✓ 已載入 backend .env${NC}"
fi
# 強制使用「預設 profile」= 本地 PostgreSQL（不採用 .env 的 SPRING_PROFILES_ACTIVE）
unset SPRING_PROFILES_ACTIVE
echo -e "${GREEN}✓ 使用本地 PostgreSQL 進行測試 (localhost:5432/bni_checkin)${NC}"
echo -e "${YELLOW}  請確認已建立 DB 並執行 init-database.sql；密碼可設 LOCAL_DB_PASSWORD${NC}"

# 3. 啟動後端（不帶 profile = 使用 application.properties 的本地 DB）
echo -e "${GREEN}📦 啟動後端 (Spring Boot)...${NC}"
cd bni-anchor-checkin-backend
./gradlew bootRun > backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo -e "${YELLOW}⏳ 等待後端啟動 (約需 15-25 秒)...${NC}"
# 簡單的等待機制，檢查 backend.log 是否出現 "Started"
MAX_RETRIES=30
count=0
while [ $count -lt $MAX_RETRIES ]; do
    if grep -q "Started BniAnchorCheckinBackendApplication" bni-anchor-checkin-backend/backend.log; then
        echo -e "${GREEN}✅ 後端已啟動！${NC}"
        break
    fi
    sleep 1
    echo -n "."
    count=$((count+1))
done

if [ $count -eq $MAX_RETRIES ]; then
    echo -e "${RED}⚠️  後端啟動超時，請檢查 bni-anchor-checkin-backend/backend.log${NC}"
fi

# 4. 啟動前端
echo -e "${GREEN}🎨 啟動前端 (Vite)...${NC}"
cd bni-anchor-checkin
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✅ 服務已在背景執行！${NC}"
echo -e "前端: http://localhost:5173"
echo -e "後端: http://localhost:10000"
echo -e "日誌: bni-anchor-checkin-backend/backend.log 和 bni-anchor-checkin/frontend.log"

# 5. 開啟瀏覽器
sleep 2
open "http://localhost:5173"
open "http://localhost:5173/admin"

# 等待使用者按 Ctrl+C 停止
echo -e "${YELLOW}按 Ctrl+C 停止所有服務${NC}"
trap "kill $BACKEND_PID $FRONTEND_PID; echo -e '${RED}🛑 服務已停止${NC}'; exit" SIGINT SIGTERM

wait

