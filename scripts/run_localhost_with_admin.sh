#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/bni-anchor-checkin-backend"
FRONTEND_DIR="${ROOT_DIR}/bni-anchor-checkin"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🚀 啟動 localhost（含 admin 頁）...${NC}"

# 1) 清理埠口
lsof -ti:10000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 2) 載入 .env（可選）
if [ -f "${ROOT_DIR}/.env" ]; then
  set -a; source "${ROOT_DIR}/.env"; set +a
  echo -e "${GREEN}✓ 已載入 .env${NC}"
elif [ -f "${BACKEND_DIR}/.env" ]; then
  set -a; source "${BACKEND_DIR}/.env"; set +a
  echo -e "${GREEN}✓ 已載入 backend .env${NC}"
fi

# 強制本地 DB
unset SPRING_PROFILES_ACTIVE DATABASE_URL DATABASE_PASSWORD SUPABASE_DB_PASSWORD

# 3) 起 backend
echo -e "${GREEN}📦 啟動後端...${NC}"
(cd "${BACKEND_DIR}" && ./gradlew bootRun > backend.log 2>&1) &
BACKEND_PID=$!

echo -e "${YELLOW}⏳ 等待後端 ready...${NC}"
for _ in {1..40}; do
  if curl -sS -f "http://localhost:10000/api/events/current" >/dev/null 2>&1 || \
     curl -sS -f "http://localhost:10000/actuator/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 後端已啟動${NC}"
    break
  fi
  sleep 1
done

# 4) 起 frontend
echo -e "${GREEN}🎨 啟動前端...${NC}"
(cd "${FRONTEND_DIR}" && npm run dev > frontend.log 2>&1) &
FRONTEND_PID=$!

echo -e "${YELLOW}⏳ 等待前端 ready...${NC}"
for _ in {1..25}; do
  if curl -sS -I "http://localhost:5173" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端已啟動${NC}"
    break
  fi
  sleep 1
done

echo -e "${GREEN}✅ 已啟動${NC}"
echo "前端: http://localhost:5173"
echo "管理頁: http://localhost:5173/admin"
echo "後端: http://localhost:10000"

# 5) 打開 browser
open "http://localhost:5173"
open "http://localhost:5173/admin"

echo -e "${YELLOW}按 Ctrl+C 停止服務${NC}"
trap "kill ${BACKEND_PID} ${FRONTEND_PID} 2>/dev/null || true; echo -e '${RED}🛑 已停止${NC}'; exit" SIGINT SIGTERM
wait

