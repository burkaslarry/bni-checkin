#!/usr/bin/env bash
# Copy monorepo prefixes into the GitHub deploy repos (Vercel / Render).
#
# Source of truth for GitHub Flow is burkaslarry/bni-checkin (master).
# Nested .git dirs in bni-anchor-checkin/ and bni-anchor-checkin-backend/ are
# deploy remotes only — do not create feature branches there.
#
# Usage (from monorepo root):
#   ./scripts/sync-github-deploy-repos.sh              # commit locally in clones
#   PUSH=1 ./scripts/sync-github-deploy-repos.sh       # also push to origin/main
#   TARGET=frontend ./scripts/sync-github-deploy-repos.sh
#   TARGET=backend ./scripts/sync-github-deploy-repos.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${TARGET:-all}"
PUSH="${PUSH:-0}"
FRONTEND_REMOTE="${FRONTEND_REMOTE:-https://github.com/burkaslarry/bni-anchor-checkin.git}"
BACKEND_REMOTE="${BACKEND_REMOTE:-https://github.com/burkaslarry/bni-anchor-checkin-backend.git}"
MONOREPO_SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
MSG="Sync from bni-checkin@${MONOREPO_SHA}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

step() { echo -e "${GREEN}==>${NC} $*"; }
fail() { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

sync_prefix() {
  local name="$1"
  local prefix="$2"
  local remote="$3"
  local work
  work="$(mktemp -d "${TMPDIR:-/tmp}/eventxp-${name}-XXXX")"
  trap 'rm -rf "${work}"' RETURN

  step "Clone ${remote} (main)"
  git clone --depth 20 --branch main "${remote}" "${work}"

  step "Copy ${prefix}/ → ${name} (excluding nested .git, build artifacts)"
  rsync -a --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude 'build/' \
    --exclude '.gradle/' \
    --exclude '.vercel/' \
    "${ROOT_DIR}/${prefix}/" "${work}/"

  git -C "${work}" add -A
  if git -C "${work}" diff --cached --quiet; then
    step "${name}: already in sync"
    return 0
  fi

  git -C "${work}" commit -m "${MSG}"
  if [[ "${PUSH}" == "1" ]]; then
    step "Push ${name} origin/main"
    git -C "${work}" push origin main
  else
    step "${name}: committed in ${work} (PUSH=1 to publish)"
  fi
}

cd "${ROOT_DIR}"
git rev-parse --is-inside-work-tree >/dev/null || fail "Run from the bni-checkin monorepo"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "master" || "${ALLOW_NON_MASTER:-0}" == "1" ]] \
  || fail "Checkout master (or set ALLOW_NON_MASTER=1) before syncing deploy repos"

case "${TARGET}" in
  frontend) sync_prefix frontend bni-anchor-checkin "${FRONTEND_REMOTE}" ;;
  backend) sync_prefix backend bni-anchor-checkin-backend "${BACKEND_REMOTE}" ;;
  all)
    sync_prefix frontend bni-anchor-checkin "${FRONTEND_REMOTE}"
    sync_prefix backend bni-anchor-checkin-backend "${BACKEND_REMOTE}"
    ;;
  *) fail "TARGET must be frontend, backend, or all" ;;
esac
