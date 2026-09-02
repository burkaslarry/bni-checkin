#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:10000}"
TODAY="${TODAY:-$(date +%F)}"
TOMORROW="${TOMORROW:-$(date -v+1d +%F 2>/dev/null || python3 - <<'PY'
import datetime
print((datetime.date.today()+datetime.timedelta(days=1)).isoformat())
PY
)}"

log() { printf "\n\033[1;33m%s\033[0m\n" "$*"; }
ok() { printf "\033[0;32m%s\033[0m\n" "$*"; }
err() { printf "\033[0;31m%s\033[0m\n" "$*" >&2; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing command: $1"; exit 127; }; }
need_cmd curl
need_cmd python3

# shellcheck source=scripts/lib/admin-auth.sh
. "$(cd "$(dirname "$0")" && pwd)/lib/admin-auth.sh"
eventxp_admin_login

api_ok() { curl -sS "${BASE_URL}/api/events/current" >/dev/null 2>&1; }

if ! api_ok; then
  err "Backend not reachable at ${BASE_URL}. Start it first."
  exit 1
fi

log "0) Clear all events + attendance"
curl -sS -X DELETE -H "${EVENTXP_AUTH_HEADER}" "${BASE_URL}/api/events/clear-all" >/dev/null
ok "Cleared."

log "Phase 1: Event 1 lifecycle"
event1_json="$(curl -sS -H 'Content-Type: application/json' -H "${EVENTXP_AUTH_HEADER}" -X POST "${BASE_URL}/api/events" -d "{\"name\":\"Workshop A\",\"date\":\"${TODAY}\",\"startTime\":\"07:00\",\"endTime\":\"09:00\",\"registrationStartTime\":\"06:30\",\"onTimeCutoff\":\"07:01\"}")"
event1_id="$(python3 - <<'PY' "$event1_json"
import json,sys
obj=json.loads(sys.argv[1]); print(obj["event"]["id"])
PY
)"
ok "Created event1 id=${event1_id}, date=${TODAY}"

# Member check-in (event1): use attendance/log with explicit date
curl -sS -H 'Content-Type: application/json' -X POST "${BASE_URL}/api/attendance/log" -d "{\"attendeeId\":null,\"attendeeType\":\"member\",\"attendeeName\":\"Larry Lo\",\"attendeeProfession\":\"客戶服務系統\",\"eventDate\":\"${TODAY}\",\"checkedInAt\":\"${TODAY}T06:59:00+08:00\",\"status\":\"on-time\"}" >/dev/null

# Guest check-in (event1): use /api/checkin, current active event should be today's event
curl -sS -H 'Content-Type: application/json' -X POST "${BASE_URL}/api/checkin" -d "{\"name\":\"Guest_01\",\"type\":\"guest\",\"currentTime\":\"${TODAY}T07:00:00+08:00\",\"domain\":\"Consulting\",\"role\":\"GUEST\"}" >/dev/null

csv1="$(mktemp)"
curl -sS -H "${EVENTXP_AUTH_HEADER}" "${BASE_URL}/api/export?eventId=${event1_id}" -o "${csv1}"
count1="$(python3 - <<'PY' "$csv1"
import csv,sys
path=sys.argv[1]
non_absent=0
with open(path, encoding='utf-8-sig', newline='') as f:
    r=csv.reader(f)
    next(r, None)
    for row in r:
        if len(row) >= 4 and row[3] != '缺席':
            non_absent += 1
print(non_absent)
PY
)"
echo "event1_non_absent_count=${count1}"
[[ "${count1}" -eq 2 ]] || { err "Event1 expected non-absent=2, got ${count1}"; exit 1; }
ok "Phase1 export validation passed."

log "Phase 2: Event 2 lifecycle (integrity test)"
event2_json="$(curl -sS -H 'Content-Type: application/json' -H "${EVENTXP_AUTH_HEADER}" -X POST "${BASE_URL}/api/events" -d "{\"name\":\"Workshop B\",\"date\":\"${TOMORROW}\",\"startTime\":\"07:00\",\"endTime\":\"09:00\",\"registrationStartTime\":\"06:30\",\"onTimeCutoff\":\"07:01\"}")"
event2_id="$(python3 - <<'PY' "$event2_json"
import json,sys
obj=json.loads(sys.argv[1]); print(obj["event"]["id"])
PY
)"
ok "Created event2 id=${event2_id}, date=${TOMORROW}"

# Member check-in for event2 (explicit date)
curl -sS -H 'Content-Type: application/json' -X POST "${BASE_URL}/api/attendance/log" -d "{\"attendeeId\":null,\"attendeeType\":\"member\",\"attendeeName\":\"Larry Lo\",\"attendeeProfession\":\"客戶服務系統\",\"eventDate\":\"${TOMORROW}\",\"checkedInAt\":\"${TOMORROW}T06:59:00+08:00\",\"status\":\"on-time\"}" >/dev/null

csv2="$(mktemp)"
curl -sS -H "${EVENTXP_AUTH_HEADER}" "${BASE_URL}/api/export?eventId=${event2_id}" -o "${csv2}"
count2="$(python3 - <<'PY' "$csv2"
import csv,sys
path=sys.argv[1]
non_absent=0
with open(path, encoding='utf-8-sig', newline='') as f:
    r=csv.reader(f)
    next(r, None)
    for row in r:
        if len(row) >= 4 and row[3] != '缺席':
            non_absent += 1
print(non_absent)
PY
)"
echo "event2_non_absent_count=${count2}"
[[ "${count2}" -eq 1 ]] || { err "Event2 expected non-absent=1, got ${count2}"; exit 1; }

# Re-export event1 to verify no overwrite/data leakage
csv1_again="$(mktemp)"
curl -sS -H "${EVENTXP_AUTH_HEADER}" "${BASE_URL}/api/export?eventId=${event1_id}" -o "${csv1_again}"
count1_again="$(python3 - <<'PY' "$csv1_again"
import csv,sys
path=sys.argv[1]
non_absent=0
with open(path, encoding='utf-8-sig', newline='') as f:
    r=csv.reader(f)
    next(r, None)
    for row in r:
        if len(row) >= 4 and row[3] != '缺席':
            non_absent += 1
print(non_absent)
PY
)"
echo "event1_again_non_absent_count=${count1_again}"
[[ "${count1_again}" -eq 2 ]] || { err "Event1 re-export expected non-absent=2, got ${count1_again}"; exit 1; }

ok "Integrity test passed: Event1 preserved while Event2 initialized."
echo "event1_id=${event1_id}, event2_id=${event2_id}"

