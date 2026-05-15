#!/usr/bin/env bash
# Run API + Vite on localhost while connecting Spring Boot to a remote PostgreSQL database.
#
# Setup (repo root `.env` — never commit real passwords):
#   Render-hosted Postgres (default):
#     DATABASE_JDBC_URL=jdbc:postgresql://HOST:5432/DB?sslmode=require&connectTimeout=10
#     DATABASE_USERNAME=...
#     DATABASE_PASSWORD=...
#     REMOTE_DB_PROFILE=render   # optional; default
#
#   Supabase:
#     SUPABASE_DATABASE_JDBC_URL=...
#     SUPABASE_DATABASE_USERNAME=postgres
#     SUPABASE_DATABASE_PASSWORD=...
#     REMOTE_DB_PROFILE=supabase
#
#   Default application.properties only (no profile — same as ./run.sh DB wiring):
#     LOCAL_DATABASE_JDBC_URL=jdbc:postgresql://REMOTE_HOST:5432/...
#     LOCAL_DB_USER=...
#     LOCAL_DB_PASSWORD=...
#     REMOTE_DB_PROFILE=properties
#
# Frontend dev server uses Vite proxy → http://localhost:10000 (keep VITE_API_BASE unset for dev).
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/bni-anchor-checkin-backend"
FRONTEND_DIR="${ROOT_DIR}/bni-anchor-checkin"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Localhost UI + API → remote PostgreSQL${NC}"

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +a
  echo -e "${GREEN}✓ Loaded ${ROOT_DIR}/.env${NC}"
elif [ -f "${BACKEND_DIR}/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${BACKEND_DIR}/.env"
  set +a
  echo -e "${GREEN}✓ Loaded ${BACKEND_DIR}/.env${NC}"
else
  echo -e "${RED}No .env found. Copy .env.example to .env and set DATABASE_* or SUPABASE_DATABASE_*.${NC}"
  exit 1
fi

# Bridge Spring-standard datasource env (e.g. some dashboards) → application-render variables
if [ -z "${DATABASE_JDBC_URL:-}" ] && [ -n "${SPRING_DATASOURCE_URL:-}" ]; then
  export DATABASE_JDBC_URL="${SPRING_DATASOURCE_URL}"
  export DATABASE_USERNAME="${DATABASE_USERNAME:-${SPRING_DATASOURCE_USERNAME:-}}"
  export DATABASE_PASSWORD="${DATABASE_PASSWORD:-${SPRING_DATASOURCE_PASSWORD:-}}"
fi

PROFILE="${REMOTE_DB_PROFILE:-render}"
GRADLE_BOOTRUN_ARGS=()

case "$PROFILE" in
  render)
    if [ -z "${DATABASE_JDBC_URL:-}" ] || [ -z "${DATABASE_USERNAME:-}" ] || [ -z "${DATABASE_PASSWORD:-}" ]; then
      echo -e "${RED}profile=render needs DATABASE_JDBC_URL, DATABASE_USERNAME, DATABASE_PASSWORD${NC}"
      echo -e "${YELLOW}Tip: set REMOTE_DB_PROFILE=properties and use LOCAL_DATABASE_JDBC_URL + LOCAL_DB_USER (+ LOCAL_DB_PASSWORD) instead.${NC}"
      exit 1
    fi
    export SPRING_PROFILES_ACTIVE=render
    GRADLE_BOOTRUN_ARGS=(--args="--spring.profiles.active=render")
    ;;
  supabase)
    if [ -z "${SUPABASE_DATABASE_JDBC_URL:-}" ] || [ -z "${SUPABASE_DATABASE_PASSWORD:-}" ]; then
      echo -e "${RED}profile=supabase requires SUPABASE_DATABASE_JDBC_URL and SUPABASE_DATABASE_PASSWORD${NC}"
      exit 1
    fi
    export SPRING_PROFILES_ACTIVE=supabase
    GRADLE_BOOTRUN_ARGS=(--args="--spring.profiles.active=supabase")
    ;;
  properties)
    unset SPRING_PROFILES_ACTIVE
    if [ -z "${LOCAL_DATABASE_JDBC_URL:-}" ] || [ -z "${LOCAL_DB_USER:-}" ]; then
      echo -e "${RED}profile=properties needs LOCAL_DATABASE_JDBC_URL and LOCAL_DB_USER (LOCAL_DB_PASSWORD if required)${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ Using default application.properties + LOCAL_DATABASE_JDBC_URL (no Spring profile)${NC}"
    ;;
  *)
    echo -e "${RED}REMOTE_DB_PROFILE must be render, supabase, or properties (got: ${PROFILE})${NC}"
    exit 1
    ;;
esac

if [ "$PROFILE" != "properties" ]; then
  echo -e "${GREEN}✓ Spring profile: ${PROFILE}${NC}"
fi

echo -e "${YELLOW}🔄 Free ports 10000 / 5173...${NC}"
lsof -ti:10000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}📦 Backend (./gradlew bootRun)...${NC}"
(
  cd "${BACKEND_DIR}"
  if [ ${#GRADLE_BOOTRUN_ARGS[@]} -eq 0 ]; then
    ./gradlew bootRun > backend.log 2>&1
  else
    ./gradlew bootRun "${GRADLE_BOOTRUN_ARGS[@]}" > backend.log 2>&1
  fi
) &
BACKEND_PID=$!

echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
for _ in $(seq 1 45); do
  if grep -q "Started BniAnchorCheckinBackendApplication" "${BACKEND_DIR}/backend.log" 2>/dev/null; then
    echo -e "${GREEN}✅ Backend up http://localhost:10000${NC}"
    break
  fi
  sleep 1
  echo -n "."
done
echo ""

echo -e "${GREEN}🎨 Frontend (npm run dev)...${NC}"
(
  cd "${FRONTEND_DIR}"
  npm run dev > frontend.log 2>&1
) &
FRONTEND_PID=$!

echo -e "${GREEN}✅ Running${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Admin:    http://localhost:5173/admin"
echo "  API:      http://localhost:10000"
echo "  Logs:     ${BACKEND_DIR}/backend.log , ${FRONTEND_DIR}/frontend.log"

if command -v open >/dev/null 2>&1; then
  sleep 1
  open "http://localhost:5173/admin" 2>/dev/null || true
fi

trap 'kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true; echo -e "${RED}Stopped.${NC}"; exit 0' SIGINT SIGTERM
echo -e "${YELLOW}Ctrl+C to stop.${NC}"
wait
