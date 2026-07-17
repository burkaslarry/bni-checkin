#!/usr/bin/env bash
# SRAA-aligned Vercel production deploy gate (Hong Kong OGCIO practice):
#   SRA — npm audit fix + vulnerability scan before release
#   SA  — production build must succeed; tests run; deploy only after pass
#
# Usage (from repo root):
#   ./scripts/deploy-vercel-production.sh
#   SKIP_VERCEL=1 ./scripts/deploy-vercel-production.sh   # audit + build only
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/bni-anchor-checkin"
AUDIT_LOG_DIR="${ROOT_DIR}/docs/security"
AUDIT_LOG="${AUDIT_LOG_DIR}/npm-audit-$(date +%Y%m%d-%H%M%S).txt"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "${GREEN}==>${NC} $*"; }
fail() { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }
warn() { echo -e "${YELLOW}WARN:${NC} $*"; }

cd "${FRONTEND_DIR}"

step "1/5 npm audit fix (auto-remediate known vulnerabilities)"
npm audit fix

step "2/5 npm audit scan — fail on high/critical (SRAA security risk assessment)"
mkdir -p "${AUDIT_LOG_DIR}"
{
  echo "=== npm audit $(date -Iseconds) ==="
  npm audit
  echo ""
  echo "=== npm audit --omit=dev (production dependencies only) ==="
  npm audit --omit=dev
} | tee "${AUDIT_LOG}" 

npm audit --audit-level=high
npm audit --omit=dev --audit-level=high

step "3/5 npm run test -- --run"
npm run test -- --run

step "4/5 npm run build (production bundle verification)"
npm run build

if [[ "${SKIP_VERCEL:-0}" == "1" ]]; then
  warn "SKIP_VERCEL=1 — audit/build passed; skipping Vercel deploy"
  step "Audit log saved: ${AUDIT_LOG}"
  exit 0
fi

step "5/5 npx vercel --prod --yes"
npx vercel --prod --yes

step "Vercel production deploy complete"
echo "Audit log: ${AUDIT_LOG}"
