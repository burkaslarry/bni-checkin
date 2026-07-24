#!/usr/bin/env bash
# SRAA-aligned Render production deploy gate for Kotlin / Spring Boot (HK OGCIO-style practice):
#   SRA — OWASP Dependency-Check SCA; fail on High/Critical (CVSS >= 7.0)
#   SA  — unit tests + bootJar production artifact must pass before deploy
#
# Usage (from repo root):
#   ./scripts/deploy-render-production.sh
#   SKIP_RENDER=1 ./scripts/deploy-render-production.sh   # audit + tests + jar only
#   SKIP_OWASP=1 ./scripts/deploy-render-production.sh    # skip NVD scan (offline / no API key)
#
# Optional: export NVD_API_KEY=... to avoid NVD rate limits during dependencyCheckAnalyze.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/bni-anchor-checkin-backend"
AUDIT_LOG_DIR="${ROOT_DIR}/docs/security"
STAMP="$(date +%Y%m%d-%H%M%S)"
AUDIT_LOG="${AUDIT_LOG_DIR}/owasp-dependency-check-${STAMP}.txt"
RENDER_SERVICE_ID="${RENDER_SERVICE_ID:-srv-d4lvmf3uibrs7389dfj0}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "${GREEN}==>${NC} $*"; }
fail() { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }
warn() { echo -e "${YELLOW}WARN:${NC} $*"; }

cd "${BACKEND_DIR}"
mkdir -p "${AUDIT_LOG_DIR}"

step "1/5 Gradle dependency insight (runtime classpath inventory)"
{
  echo "=== gradle dependencies --configuration runtimeClasspath $(date -Iseconds) ==="
  ./gradlew -q dependencies --configuration runtimeClasspath
} | tee "${AUDIT_LOG}"

if [[ "${SKIP_OWASP:-0}" == "1" ]]; then
  warn "SKIP_OWASP=1 — skipping OWASP Dependency-Check (not for production release)"
else
  step "2/5 OWASP Dependency-Check — fail on CVSS >= 7.0 (High/Critical)"
  {
    echo ""
    echo "=== OWASP dependencyCheckAnalyze $(date -Iseconds) ==="
    if [[ -n "${NVD_API_KEY:-}" ]]; then
      echo "NVD_API_KEY is set"
    else
      echo "NVD_API_KEY unset — scan may be slow / rate-limited"
    fi
    ./gradlew dependencyCheckAnalyze --info
  } | tee -a "${AUDIT_LOG}"

  # Copy HTML/JSON reports beside the audit log when present
  REPORT_DIR="${BACKEND_DIR}/build/reports"
  if [[ -d "${REPORT_DIR}" ]]; then
    find "${REPORT_DIR}" -maxdepth 3 \( -name '*dependency-check*' -o -name 'dependency-check*' \) \
      \( -name '*.html' -o -name '*.json' \) -print0 2>/dev/null \
      | while IFS= read -r -d '' f; do
          cp -f "$f" "${AUDIT_LOG_DIR}/$(basename "$f" | sed "s/\\./-${STAMP}./")" 2>/dev/null || true
        done
  fi
fi

step "3/5 ./gradlew test (Security Audit — unit / integration tests)"
./gradlew test

step "4/5 ./gradlew bootJar (production artifact verification)"
./gradlew bootJar

if [[ "${SKIP_RENDER:-0}" == "1" ]]; then
  warn "SKIP_RENDER=1 — SRAA checks passed; skipping Render deploy"
  step "Audit log saved: ${AUDIT_LOG}"
  exit 0
fi

step "5/5 Push main (if needed) + Render deploy --wait"
# Prefer explicit deploy create so we wait for health even if auto-deploy already started
if command -v render >/dev/null 2>&1; then
  render deploys create "${RENDER_SERVICE_ID}" --confirm --wait
else
  fail "render CLI not found; install Render CLI or set SKIP_RENDER=1 after pushing main"
fi

step "Render production deploy complete"
echo "Audit log: ${AUDIT_LOG}"
echo "Verify: curl -sS https://bni-anchor-checkin-backend.onrender.com/api/chapters"
