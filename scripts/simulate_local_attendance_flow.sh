#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:10000}"
EVENT_DATE="${EVENT_DATE:-2025-03-27}" # YYYY-MM-DD
EVENT_DATE_YYYYMMDD="${EVENT_DATE//-/}"
EVENT_NAME="${EVENT_NAME:-EventXP for BNI Anchor Meeting ${EVENT_DATE_YYYYMMDD}}"

# Backend lifecycle (local simulation convenience)
RESTART_BACKEND="${RESTART_BACKEND:-1}"          # 1=restart backend automatically (localhost only)
STOP_BACKEND_ON_EXIT="${STOP_BACKEND_ON_EXIT:-1}" # 1=stop backend process started by this script

# DB connection (matches application.properties defaults)
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-bni_checkin}"
PGUSER="${PGUSER:-${LOCAL_DB_USER:-${USER}}}"
PGPASSWORD="${PGPASSWORD:-${LOCAL_DB_PASSWORD:-}}"
export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

CLEAR_ALL="${CLEAR_ALL:-1}" # 1=clear events/attendance before simulation

log() { printf "\n\033[1;33m%s\033[0m\n" "$*"; }
ok() { printf "\033[0;32m%s\033[0m\n" "$*"; }
err() { printf "\033[0;31m%s\033[0m\n" "$*" >&2; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "Missing command: $1"; exit 127; }
}

backend_pid=""
cleanup() {
  if [[ -n "${backend_pid}" && "${STOP_BACKEND_ON_EXIT}" == "1" ]]; then
    log "Stopping backend pid=${backend_pid}"
    kill "${backend_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

json_get() {
  # json_get "<json>" "<python expr that prints value>"
  python3 - <<'PY' "$1" "$2"
import json,sys
obj=json.loads(sys.argv[1])
expr=sys.argv[2]
safe_builtins = {
  "len": len,
  "str": str,
  "int": int,
  "float": float,
  "bool": bool,
  "list": list,
  "dict": dict,
}
print(eval(expr, {"__builtins__": safe_builtins}, {"obj": obj}))
PY
}

curl_json() {
  curl -sS -H "Content-Type: application/json" "$@"
}

post_json() {
  local url="$1"
  local body="$2"
  curl_json -X POST "${url}" -d "${body}"
}

api_healthcheck() {
  curl -sS "${BASE_URL}/api/events/current" >/dev/null 2>&1
}

psql_ok() {
  command -v psql >/dev/null 2>&1
}

restart_backend_if_needed() {
  # Only safe for local default BASE_URL
  if [[ "${RESTART_BACKEND}" != "1" ]]; then
    return 0
  fi

  if [[ "${BASE_URL}" != "http://localhost:10000" && "${BASE_URL}" != "http://127.0.0.1:10000" ]]; then
    log "RESTART_BACKEND=1 but BASE_URL is not localhost; skipping restart for safety."
    return 0
  fi

  need_cmd lsof

  log "0) Restarting backend (local): ensure port 10000 is free"
  local pids
  pids="$(lsof -ti:10000 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    ok "Killing existing process(es) on :10000: ${pids//$'\n'/ }"
    # shellcheck disable=SC2086
    kill -9 ${pids} >/dev/null 2>&1 || true
    sleep 1
  fi

  log "0) Starting backend via Gradle (bootRun)"
  local backend_dir="/Users/larrylo/SourceProject/bni-checkin/bni-anchor-checkin-backend"
  if [[ ! -d "${backend_dir}" ]]; then
    err "Backend directory not found: ${backend_dir}"
    exit 1
  fi

  # Force local DB behavior (avoid accidentally using prod env vars)
  unset SPRING_PROFILES_ACTIVE DATABASE_URL DATABASE_PASSWORD SUPABASE_DB_PASSWORD

  (cd "${backend_dir}" && ./gradlew bootRun > /tmp/bni-backend-sim.log 2>&1) &
  backend_pid="$!"
  ok "Backend started pid=${backend_pid} (log: /tmp/bni-backend-sim.log)"

  log "0) Waiting for backend readiness"
  for i in {1..40}; do
    if api_healthcheck; then
      ok "Backend ready."
      return 0
    fi
    sleep 1
  done

  err "Backend did not become ready in time. See /tmp/bni-backend-sim.log"
  exit 1
}

compute_captcha_answer() {
  # args: a op b
  python3 - <<'PY' "$1" "$2" "$3"
a=int(sys.argv[1]); op=sys.argv[2]; b=int(sys.argv[3])
if op=="+": print(a+b)
elif op=="-": print(a-b)
elif op=="*": print(a*b)
else: raise SystemExit(f"Unsupported op: {op}")
PY
}

need_cmd curl
need_cmd python3

restart_backend_if_needed

log "1) Checking backend is reachable: ${BASE_URL}"
if ! api_healthcheck; then
  err "Backend not reachable at ${BASE_URL}. Start it first (e.g. sh run.sh)."
  exit 1
fi
ok "Backend reachable."

if [[ "${CLEAR_ALL}" == "1" ]]; then
  log "0a) Cleaning prior simulation guests (safe delete by pattern + event_date)"
  if ! psql_ok; then
    err "psql not found; cannot clean prior simulated guests."
    exit 1
  fi
  psql -v ON_ERROR_STOP=1 -q -c "DELETE FROM bni_anchor_guests WHERE event_date='${EVENT_DATE}' AND (name LIKE 'Sim Guest %' OR name LIKE 'Walkin Guest %' OR phone_number LIKE '9000${EVENT_DATE_YYYYMMDD}%' OR phone_number LIKE '9111${EVENT_DATE_YYYYMMDD}%');" >/dev/null
  ok "Cleaned prior simulated guests (if any)."

  log "0) Clearing all events + attendance (DB + memory): DELETE /api/events/clear-all"
  curl -sS -X DELETE "${BASE_URL}/api/events/clear-all" >/dev/null
  ok "Cleared."
fi

log "2) Creating event: ${EVENT_NAME} (${EVENT_DATE})"
create_event_res="$(
  post_json "${BASE_URL}/api/events" "$(cat <<EOF
{"name":"${EVENT_NAME}","date":"${EVENT_DATE}","startTime":"07:00","endTime":"09:00","registrationStartTime":"06:30","onTimeCutoff":"07:01"}
EOF
)"
)"
event_id="$(json_get "${create_event_res}" 'obj["event"]["id"]')"
ok "Created event_id=${event_id}"

log "3) Fetching members, then logging 30 on-time + 5 late"
members_json="$(curl -sS "${BASE_URL}/api/members")"
member_count="$(json_get "${members_json}" 'len(obj.get("members", []))')"
if [[ "${member_count}" -lt 35 ]]; then
  err "Expected >=35 members, got ${member_count}."
  exit 1
fi
ok "Members available: ${member_count}"

python3 - <<'PY' "${BASE_URL}" "${EVENT_DATE}" "${members_json}"
import json,sys,random,datetime
base=sys.argv[1]; event_date=sys.argv[2]
obj=json.loads(sys.argv[3])
members=obj.get("members", [])
pick=members[:35]
on_time=pick[:30]
late=pick[30:35]

def post(body):
  import urllib.request
  req=urllib.request.Request(base+"/api/attendance/log", data=json.dumps(body).encode("utf-8"), headers={"Content-Type":"application/json"})
  with urllib.request.urlopen(req, timeout=10) as r:
    r.read()

tz="+08:00"
on_time_at=f"{event_date}T06:59:00{tz}"
late_at=f"{event_date}T07:10:00{tz}"

for m in on_time:
  post({
    "attendeeId": int(m["id"]),
    "attendeeType": "member",
    "attendeeName": m["name"],
    "attendeeProfession": m.get("domain") or m.get("profession") or "",
    "eventDate": event_date,
    "checkedInAt": on_time_at,
    "status": "on-time"
  })
for m in late:
  post({
    "attendeeId": int(m["id"]),
    "attendeeType": "member",
    "attendeeName": m["name"],
    "attendeeProfession": m.get("domain") or m.get("profession") or "",
    "eventDate": event_date,
    "checkedInAt": late_at,
    "status": "late"
  })
print("OK")
PY
ok "Logged member attendance."

log "4) Creating 6 pre-registered guests in local DB (bni_anchor_guests)"
if ! psql_ok; then
  err "psql not found; cannot insert/query local DB. Install PostgreSQL client tools, or run with CLEAR_ALL=0 and create guests via UI."
  exit 1
fi

guest_sql="$(cat <<EOF
WITH to_insert AS (
  SELECT
    unnest(ARRAY[
      'Sim Guest 01','Sim Guest 02','Sim Guest 03','Sim Guest 04','Sim Guest 05','Sim Guest 06'
    ]) AS name,
    unnest(ARRAY[
      'Sim Profession 01','Sim Profession 02','Sim Profession 03','Sim Profession 04','Sim Profession 05','Sim Profession 06'
    ]) AS profession,
    unnest(ARRAY[
      '9000${EVENT_DATE_YYYYMMDD}01','9000${EVENT_DATE_YYYYMMDD}02','9000${EVENT_DATE_YYYYMMDD}03',
      '9000${EVENT_DATE_YYYYMMDD}04','9000${EVENT_DATE_YYYYMMDD}05','9000${EVENT_DATE_YYYYMMDD}06'
    ]) AS phone_number,
    unnest(ARRAY[
      'Larry Lo','Larry Lo','Larry Lo','Larry Lo','Larry Lo','Larry Lo'
    ]) AS referrer
)
INSERT INTO bni_anchor_guests (name, profession, referrer, phone_number, event_date)
SELECT name, profession, referrer, phone_number, '${EVENT_DATE}'
FROM to_insert;
EOF
)"
psql -v ON_ERROR_STOP=1 -q -c "${guest_sql}"
ok "Inserted 6 guests for event_date=${EVENT_DATE}"

log "5) Checking-in 4 of the 6 guests (in-memory records) via POST /api/checkin"
for i in 1 2 3 4; do
  gname="Sim Guest 0${i}"
  gprof="Sim Profession 0${i}"
  post_json "${BASE_URL}/api/checkin" "$(cat <<EOF
{"name":"${gname}","type":"guest","currentTime":"${EVENT_DATE}T06:58:0${i}+08:00","domain":"${gprof}","role":"GUEST","referrer":"Larry Lo"}
EOF
)" >/dev/null
done
ok "Checked-in 4 pre-registered guests."

log "6) Walk-in 2 guests via PUBLIC form (CAPTCHA); list-only (no auto check-in); optional /api/checkin below"
run_nonce="$(date +%s | tail -c 6)"
for i in 1 2; do
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

  wname="Walkin Guest 0${i}"
  wprof="Walkin Profession 0${i}"
  wphone="9111${EVENT_DATE_YYYYMMDD}${run_nonce}0${i}"
  create_public_res="$(
    post_json "${BASE_URL}/api/public/guests" "$(cat <<EOF
{"name":"${wname}","profession":"${wprof}","phoneNumber":"${wphone}","referrer":"Larry Lo","eventId":${event_id},"notes":"simulation","captcha":{"a":${a},"b":${b},"op":"${op}","nonce":"${nonce}","signature":"${sig}","answer":${ans}}}
EOF
)"
  )"
  status="$(json_get "${create_public_res}" 'obj.get("status","")')"
  if [[ "${status}" != "success" ]]; then
    err "Public guest create failed: ${create_public_res}"
    exit 1
  fi
done
ok "Created 2 walk-in guests on the guest list (not auto checked-in)."

log "6b) Mark walk-in guests as arrived via /api/checkin (optional manual step for sim)"
for i in 1 2; do
  wname="Walkin Guest 0${i}"
  wprof="Walkin Profession 0${i}"
  post_json "${BASE_URL}/api/checkin" "$(cat <<EOF
{"name":"${wname}","type":"guest","currentTime":"${EVENT_DATE}T07:00:0${i}+08:00","domain":"${wprof}","role":"GUEST","referrer":"Larry Lo"}
EOF
)" >/dev/null || true
done
ok "Attempted /api/checkin for 2 walk-in guests (ignore if duplicate)."

log "7) Export attendance CSV: GET /api/export (expect filename attendance_${EVENT_DATE_YYYYMMDD}.csv)"
tmp_body="$(mktemp)"
curl -sS -o "${tmp_body}" "${BASE_URL}/api/export"
filename="attendance_${EVENT_DATE_YYYYMMDD}.csv"
mv "${tmp_body}" "./${filename}"
ok "Saved CSV: ./${filename}"

log "8) Crosscheck local DB (latest event) and print SQL for manual verification"
verify_sql="$(cat <<'EOF'
-- Latest event
SELECT id, name, event_date, start_time, on_time_cutoff_time
FROM bni_anchor_events
ORDER BY id DESC
LIMIT 1;

-- Member attendance counts for latest event
WITH latest AS (
  SELECT id FROM bni_anchor_events ORDER BY id DESC LIMIT 1
)
SELECT a.status, COUNT(*) AS cnt
FROM bni_anchor_attendances a
JOIN latest e ON e.id = a.event_id
GROUP BY a.status
ORDER BY a.status;

-- Hard check: latest event should have 1 attendance row per member
WITH latest AS (
  SELECT id FROM bni_anchor_events ORDER BY id DESC LIMIT 1
),
members AS (
  SELECT COUNT(*)::int AS member_cnt FROM bni_anchor_members
),
att AS (
  SELECT COUNT(*)::int AS attendance_cnt
  FROM bni_anchor_attendances a
  JOIN latest e ON e.id = a.event_id
)
SELECT members.member_cnt, att.attendance_cnt, (members.member_cnt - att.attendance_cnt) AS missing_rows
FROM members, att;

-- Any members missing attendance row? (should return 0 rows)
WITH latest AS (
  SELECT id FROM bni_anchor_events ORDER BY id DESC LIMIT 1
)
SELECT m.id, m.name
FROM bni_anchor_members m
LEFT JOIN bni_anchor_attendances a
  ON a.member_id = m.id
 AND a.event_id = (SELECT id FROM latest)
WHERE a.id IS NULL
ORDER BY m.name;

-- Sample member attendance rows (latest event)
WITH latest AS (
  SELECT id FROM bni_anchor_events ORDER BY id DESC LIMIT 1
)
SELECT m.name, a.status, a.check_in_time
FROM bni_anchor_attendances a
JOIN latest e ON e.id = a.event_id
JOIN bni_anchor_members m ON m.id = a.member_id
ORDER BY a.status, m.name
LIMIT 40;

-- Guests for the simulated event date (from public + pre-registered)
SELECT id, name, profession, referrer, phone_number, event_date, created_at
FROM bni_anchor_guests
WHERE event_date = :'event_date'
ORDER BY id DESC;
EOF
)"

echo ""
echo "==================== SQL (copy/paste to verify) ===================="
echo "${verify_sql}"
echo "===================================================================="
echo ""

log "9) Running the SQL now (prints results below)"
psql -v ON_ERROR_STOP=1 -v event_date="${EVENT_DATE}" <<EOF
${verify_sql}
EOF
ok "Simulation completed."

