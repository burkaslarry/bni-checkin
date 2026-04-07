#!/usr/bin/env bash
#
# End-to-end simulation against a backend that uses your real/remote DB.
# Prerequisite: backend running with JDBC pointing at that DB (e.g. run_prod.sh + DATABASE_* in .env).
#
# Usage:
#   BASE_URL=http://localhost:10000 ./scripts/simulate_remote_two_events_flow.sh
#   BASE_URL=https://your-api.example.com ./scripts/simulate_remote_two_events_flow.sh
#
# Optional:
#   SIM_CLEAR_ALL=1   — DELETE /api/events/clear-all first (DESTRUCTIVES all events + attendance in DB)
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:10000}"
SIM_CLEAR_ALL="${SIM_CLEAR_ALL:-0}"

log() { printf "\n\033[1;33m%s\033[0m\n" "$*"; }
ok() { printf "\033[0;32m%s\033[0m\n" "$*"; }
err() { printf "\033[0;31m%s\033[0m\n" "$*" >&2; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing command: $1"; exit 127; }; }
need_cmd curl
need_cmd python3

api_get() { curl -sS "${BASE_URL}$1"; }
api_post_json() {
  curl -sS -H "Content-Type: application/json" -X POST "${BASE_URL}$1" -d "$2"
}

if ! curl -sS -f "${BASE_URL}/api/members" >/dev/null 2>&1; then
  err "Backend not reachable at ${BASE_URL} (GET /api/members failed). Start backend linked to remote DB first."
  exit 1
fi

RUN_ID="$(date +%s)"
PREFIX="SimFlow${RUN_ID}"

DATES="$(python3 - <<'PY'
import datetime
import random
random.seed()
delta = random.randint(45, 120)
d1 = datetime.date.today() + datetime.timedelta(days=delta)
d2 = d1 + datetime.timedelta(days=1)
print(d1.isoformat(), d2.isoformat())
PY
)"
D1="${DATES%% *}"
D2="${DATES##* }"

log "Simulation run: prefix=${PREFIX} D1=${D1} D2=${D2} BASE_URL=${BASE_URL}"

if [[ "${SIM_CLEAR_ALL}" == "1" ]]; then
  log "SIM_CLEAR_ALL=1: DELETE /api/events/clear-all (destructive)"
  curl -sS -X DELETE "${BASE_URL}/api/events/clear-all" >/dev/null
  ok "Cleared all events + attendance."
fi

REFERRER="$(api_get "/api/members" | python3 -c "import json,sys; o=json.load(sys.stdin); m=o.get('members')or[]; print(m[0]['name'] if m else 'Sim Host')")"
MEMBERS_JSON="$(api_get "/api/members")"
MEMBER_COUNT="$(python3 -c "import json,sys; print(len(json.loads(sys.argv[1]).get('members') or []))" "${MEMBERS_JSON}")"
if [[ "${MEMBER_COUNT}" -lt 15 ]]; then
  err "Need at least 15 members in DB for this simulation (got ${MEMBER_COUNT})."
  exit 1
fi
ok "Referrer for guest imports: ${REFERRER} (${MEMBER_COUNT} members)"

# --- Phase 1: Event A ---
log "Phase 1: Create event A (${D1})"
CREATE_A="$(api_post_json "/api/events" "$(python3 - <<PY
import json
prefix = "${PREFIX}"
body = {
  "name": f"Sim Event A {prefix}",
  "date": "${D1}",
  "startTime": "07:00",
  "endTime": "09:00",
  "registrationStartTime": "06:30",
  "onTimeCutoff": "07:05",
}
print(json.dumps(body))
PY
)")"
EVENT_A_ID="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['event']['id'])" "${CREATE_A}")"
ok "event_a id=${EVENT_A_ID}"

log "Phase 1: Activate event A (exclusive)"
ACT_A="$(api_post_json "/api/events/${EVENT_A_ID}/activate" '{"exclusive":true}')"
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert d.get('status')=='success', d" "${ACT_A}" || { err "activate A failed: ${ACT_A}"; exit 1; }
ok "Event A is current (exclusive)."

log "Phase 1: Bulk-import 3 random guests"
GJSON_A="$(python3 - <<PY
import json
prefix = "${PREFIX}"
d = "${D1}"
ref = """${REFERRER}"""
recs = []
for i in range(1, 4):
    recs.append({
        "name": f"{prefix} GA{i:02d}",
        "profession": f"Prof A{i}",
        "referrer": ref,
        "phoneNumber": f"9000{prefix[-6:]}{i:02d}",
        "eventDate": d,
    })
print(json.dumps(recs))
PY
)"
IMP_A="$(api_post_json "/api/bulk-import/guests" "${GJSON_A}")"
python3 -c "import json,sys; r=json.loads(sys.argv[1]); assert r.get('failed',1)==0, r" "${IMP_A}" || { err "bulk import A failed: ${IMP_A}"; exit 1; }
ok "Imported 3 guests: ${IMP_A}"

log "Phase 1: Check in 3 guests (/api/checkin)"
for i in 1 2 3; do
  N="${PREFIX} GA$(printf '%02d' "$i")"
  P="Prof A${i}"
  api_post_json "/api/checkin" "$(python3 - <<PY
import json
print(json.dumps({
  "name": "${N}",
  "type": "guest",
  "currentTime": "${D1}T06:58:0${i}+08:00",
  "domain": "${P}",
  "role": "GUEST",
  "referrer": """${REFERRER}""",
}))
PY
)" >/dev/null
done
ok "Checked in 3 guests."

log "Phase 1: Random check-in 10 members (/api/attendance/log)"
python3 - <<PY "${BASE_URL}" "${D1}" "${MEMBERS_JSON}"
import json,sys,random
base, event_date, mj = sys.argv[1], sys.argv[2], sys.argv[3]
members = json.loads(mj).get("members") or []
random.seed()
pick = random.sample(members, 10)
import urllib.request
for m in pick:
    body = {
        "attendeeId": int(m["id"]),
        "attendeeType": "member",
        "attendeeName": m["name"],
        "attendeeProfession": m.get("domain") or "",
        "eventDate": event_date,
        "checkedInAt": f"{event_date}T06:59:00+08:00",
        "status": "on-time",
    }
    req = urllib.request.Request(
        base + "/api/attendance/log",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()
print("OK")
PY
ok "Logged 10 members for event A."

CSV_A="$(mktemp)"
curl -sS "${BASE_URL}/api/export?eventId=${EVENT_A_ID}" -o "${CSV_A}"
RPT_A="$(api_get "/api/report?eventId=${EVENT_A_ID}")"
EVT_LIST="$(api_get "/api/events")"
python3 - <<PY "${EVENT_A_ID}" "${D1}" "${RPT_A}" "${EVT_LIST}" "${CSV_A}"
import json,sys,csv
eid = int(sys.argv[1])
d1 = sys.argv[2]
report = json.loads(sys.argv[3])
events = json.loads(sys.argv[4])
csv_path = sys.argv[5]
assert report.get("eventId") == eid, report
assert report.get("eventDate") == d1, report
ids = [e["id"] for e in events]
assert eid in ids, f"event {eid} not in /api/events list"
# Non-absent CSV rows (attended): column index 3 出席狀態 != 缺席
non_abs = 0
with open(csv_path, encoding="utf-8-sig", newline="") as f:
    r = csv.reader(f)
    next(r, None)
    for row in r:
        if len(row) >= 4 and row[3].strip() != "缺席":
            non_abs += 1
# At least 10 members + 3 guests
assert non_abs >= 13, f"expected >=13 attended rows in export, got {non_abs}"
print("phase1_ok non_absent_rows=", non_abs)
PY
ok "Phase 1 OK: export + report + /api/events list."

# --- Phase 2: Event B, switch current ---
log "Phase 2: Create event B (${D2})"
CREATE_B="$(api_post_json "/api/events" "$(python3 - <<PY
import json
prefix = "${PREFIX}"
body = {
  "name": f"Sim Event B {prefix}",
  "date": "${D2}",
  "startTime": "07:00",
  "endTime": "09:00",
  "registrationStartTime": "06:30",
  "onTimeCutoff": "07:05",
}
print(json.dumps(body))
PY
)")"
EVENT_B_ID="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['event']['id'])" "${CREATE_B}")"
ok "event_b id=${EVENT_B_ID}"

log "Phase 2: Set current event to B (exclusive)"
ACT_B="$(api_post_json "/api/events/${EVENT_B_ID}/activate" '{"exclusive":true}')"
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert d.get('status')=='success', d" "${ACT_B}" || { err "activate B failed: ${ACT_B}"; exit 1; }
CUR="$(api_get "/api/events/current")"
python3 -c "import json,sys; e=json.loads(sys.argv[1]); assert int(e['id'])==${EVENT_B_ID}, e" "${CUR}" || { err "current event not B: ${CUR}"; exit 1; }
ok "Current event is B."

log "Phase 2: Bulk-import 5 guests"
GJSON_B="$(python3 - <<PY
import json
prefix = "${PREFIX}"
d = "${D2}"
ref = """${REFERRER}"""
recs = []
for i in range(1, 6):
    recs.append({
        "name": f"{prefix} GB{i:02d}",
        "profession": f"Prof B{i}",
        "referrer": ref,
        "phoneNumber": f"9001{prefix[-6:]}{i:02d}",
        "eventDate": d,
    })
print(json.dumps(recs))
PY
)"
IMP_B="$(api_post_json "/api/bulk-import/guests" "${GJSON_B}")"
python3 -c "import json,sys; r=json.loads(sys.argv[1]); assert r.get('failed',1)==0, r" "${IMP_B}" || { err "bulk import B failed: ${IMP_B}"; exit 1; }
ok "Imported 5 guests."

log "Phase 2: Check in 3 of 5 guests"
for i in 1 2 3; do
  N="${PREFIX} GB$(printf '%02d' "$i")"
  P="Prof B${i}"
  api_post_json "/api/checkin" "$(python3 - <<PY
import json
print(json.dumps({
  "name": "${N}",
  "type": "guest",
  "currentTime": "${D2}T06:58:0${i}+08:00",
  "domain": "${P}",
  "role": "GUEST",
  "referrer": """${REFERRER}""",
}))
PY
)" >/dev/null
done
ok "Checked in 3 guests for B."

log "Phase 2: Random check-in 10 members (different sample if possible)"
python3 - <<PY "${BASE_URL}" "${D2}" "${MEMBERS_JSON}"
import json,sys,random
base, event_date, mj = sys.argv[1], sys.argv[2], sys.argv[3]
members = json.loads(mj).get("members") or []
random.seed(42)
pick = random.sample(members, 10)
import urllib.request
for m in pick:
    body = {
        "attendeeId": int(m["id"]),
        "attendeeType": "member",
        "attendeeName": m["name"],
        "attendeeProfession": m.get("domain") or "",
        "eventDate": event_date,
        "checkedInAt": f"{event_date}T07:00:00+08:00",
        "status": "on-time",
    }
    req = urllib.request.Request(
        base + "/api/attendance/log",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()
print("OK")
PY
ok "Logged 10 members for event B."

CSV_B="$(mktemp)"
curl -sS "${BASE_URL}/api/export?eventId=${EVENT_B_ID}" -o "${CSV_B}"
RPT_B="$(api_get "/api/report?eventId=${EVENT_B_ID}")"
EVT_LIST2="$(api_get "/api/events")"
python3 - <<PY "${EVENT_A_ID}" "${EVENT_B_ID}" "${D2}" "${RPT_B}" "${EVT_LIST2}" "${CSV_B}"
import json,sys,csv
ida, idb = int(sys.argv[1]), int(sys.argv[2])
d2 = sys.argv[3]
report = json.loads(sys.argv[4])
events = json.loads(sys.argv[5])
csv_path = sys.argv[6]
assert report.get("eventId") == idb, report
assert report.get("eventDate") == d2, report
ids = [e["id"] for e in events]
assert ida in ids and idb in ids, f"missing events in list: {ida}, {idb}"
non_abs = 0
with open(csv_path, encoding="utf-8-sig", newline="") as f:
    r = csv.reader(f)
    next(r, None)
    for row in r:
        if len(row) >= 4 and row[3].strip() != "缺席":
            non_abs += 1
assert non_abs >= 13, f"expected >=13 attended rows for B export, got {non_abs}"
print("phase2_ok non_absent_rows=", non_abs)
PY

# Re-verify A untouched in export
CSV_A2="$(mktemp)"
curl -sS "${BASE_URL}/api/export?eventId=${EVENT_A_ID}" -o "${CSV_A2}"
python3 - <<PY "${CSV_A}" "${CSV_A2}"
import sys,csv
p1,p2=sys.argv[1],sys.argv[2]
def count_non_abs(path):
    n=0
    with open(path, encoding="utf-8-sig", newline="") as f:
        r=csv.reader(f)
        next(r,None)
        for row in r:
            if len(row)>=4 and row[3].strip()!="缺席":
                n+=1
    return n
c1=count_non_abs(p1); c2=count_non_abs(p2)
assert c1==c2, (c1,c2)
print("event_a_export_stable", c1)
PY
ok "Phase 2 OK: B export/report + both events still listable; A export row count unchanged."

ok "All simulation steps completed."
echo ""
echo "event_a_id=${EVENT_A_ID} date=${D1}"
echo "event_b_id=${EVENT_B_ID} date=${D2}"
echo "Admin: open Events / Reports and search ids or dates above."
