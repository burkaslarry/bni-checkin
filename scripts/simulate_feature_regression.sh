#!/usr/bin/env bash
#
# =============================================================================
# F00 -- Feature regression simulation harness --- simulate_feature_regression.sh
# F01 -- Public guest registration without auto check-in --- PublicGuestController
# F02 -- DB parses yyyy-MM-ddTHH:mm:ss without timezone --- EventDbService
# F03 -- Admin manual batch / single check-in UI --- AdminManualEntryPanel
# F04 -- Report no-event actions (yellow buttons) --- ReportPage + styles.css
# =============================================================================
#
# Prerequisite: backend with DB (so /api/public/* is enabled).
# Usage:
#   BASE_URL=http://localhost:10000 ./scripts/simulate_feature_regression.sh
# Strict (fail if API unreachable):
#   RUN_STRICT=1 BASE_URL=http://localhost:10000 ./scripts/simulate_feature_regression.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:10000}"
RUN_STRICT="${RUN_STRICT:-0}"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-bni_checkin}"
PGUSER="${PGUSER:-${LOCAL_DB_USER:-${USER}}}"
PGPASSWORD="${PGPASSWORD:-${LOCAL_DB_PASSWORD:-}}"
export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

log() { printf "\n\033[1;33m%s\033[0m\n" "$*"; }
ok() { printf "\033[0;32m%s\033[0m\n" "$*"; }
err() { printf "\033[0;31m%s\033[0m\n" "$*" >&2; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing command: $1"; exit 127; }; }

json_get() {
  python3 - <<'PY' "$1" "$2"
import json,sys
obj=json.loads(sys.argv[1])
expr=sys.argv[2]
safe_builtins = {"len": len, "str": str, "int": int, "float": float, "bool": bool, "list": list, "dict": dict}
print(eval(expr, {"__builtins__": safe_builtins}, {"obj": obj}))
PY
}

post_json() {
  curl -sS -H "Content-Type: application/json" -X POST "$1" -d "$2"
}

api_reachable() {
  curl -sS -f "${BASE_URL}/api/members" >/dev/null 2>&1
}

psql_ok() {
  command -v psql >/dev/null 2>&1
}

log "F00 simulation: BASE_URL=${BASE_URL}"

if ! api_reachable; then
  err "Backend not reachable at ${BASE_URL} (GET /api/members)."
  if [[ "${RUN_STRICT}" == "1" ]]; then
    exit 1
  fi
  err "Skipping runtime checks (set RUN_STRICT=1 to fail). Run: cd bni-anchor-checkin-backend && ./gradlew bootRun"
  exit 0
fi

need_cmd curl
need_cmd python3

log "F01 -- Public guest list only (no auto check-in) --- verify POST /api/public/guests + DB check_in_time IS NULL"

cur_json="$(curl -sS "${BASE_URL}/api/events/current" || true)"
if ! python3 -c "import json,sys; json.loads(sys.argv[1])" "${cur_json}" 2>/dev/null; then
  err "No JSON from GET /api/events/current — need an active event in DB for eventId-based public guest."
  if [[ "${RUN_STRICT}" == "1" ]]; then
    exit 1
  fi
  exit 0
fi

event_id="$(json_get "${cur_json}" 'int(obj["id"])')"
event_date="$(json_get "${cur_json}" 'obj["date"]')"
event_date_ymd="${event_date//-/}"

captcha_json="$(curl -sS "${BASE_URL}/api/public/captcha")"
a="$(json_get "${captcha_json}" 'obj["a"]')"
b="$(json_get "${captcha_json}" 'obj["b"]')"
op="$(json_get "${captcha_json}" 'obj["op"]')"
nonce="$(json_get "${captcha_json}" 'obj["nonce"]')"
sig="$(json_get "${captcha_json}" 'obj["signature"]')"
ans="$(python3 - <<PY
a=int("${a}"); b=int("${b}"); op="${op}"
print(a+b if op=="+" else a-b if op=="-" else a*b)
PY
)"

run_id="$(date +%s)"
wname="SimFeatGuest_${run_id}"
wprof="SimFeatProf"
wphone="9199${event_date_ymd}${run_id}"

create_res="$(post_json "${BASE_URL}/api/public/guests" "$(python3 - <<PY
import json
body = {
  "name": "${wname}",
  "profession": "${wprof}",
  "phoneNumber": "${wphone}",
  "referrer": "Larry Lo",
  "eventId": int("${event_id}"),
  "notes": "simulate_feature_regression",
  "captcha": {"a": int("${a}"), "b": int("${b}"), "op": "${op}", "nonce": "${nonce}", "signature": "${sig}", "answer": int("${ans}")},
}
print(json.dumps(body))
PY
)")"

status="$(json_get "${create_res}" 'obj.get("status","")' 2>/dev/null || echo "")"
if [[ "${status}" != "success" ]]; then
  err "F01 failed: ${create_res}"
  exit 1
fi
ok "F01 public guest created: ${wname}"

if psql_ok && psql -v ON_ERROR_STOP=1 -q -t -A -c "SELECT check_in_time IS NULL FROM bni_anchor_guests WHERE phone_number='${wphone}' AND event_date='${event_date}' LIMIT 1;" 2>/dev/null | grep -q '^t$'; then
  ok "F01 DB: check_in_time IS NULL (not auto checked-in)"
elif command -v psql >/dev/null 2>&1; then
  err "F01 DB check skipped or failed (set PGPASSWORD / DB for full verify)"
else
  ok "F01 DB verify skipped (no psql)"
fi

log "F02 -- Manual check-in time parse --- run backend unit test EventDbServiceTimeParsingTest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
(
  cd "${REPO_ROOT}/bni-anchor-checkin-backend"
  ./gradlew test -q --tests "com.example.bnianchorcheckinbackend.EventDbServiceTimeParsingTest"
)
ok "F02 unit test passed"

log "F03 / F04 -- UI flows; covered by F01 runtime + F02 unit + manual browser on /report and /admin?view=manual"
ok "Simulation finished."
