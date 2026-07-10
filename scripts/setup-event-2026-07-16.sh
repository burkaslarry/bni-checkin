#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://bni-anchor-checkin-backend.onrender.com}"
DELETE_DATE="${DELETE_DATE:-2026-07-10}"
CREATE_DATE="${CREATE_DATE:-2026-07-16}"
EVENT_NAME="${EVENT_NAME:-BNI Anchor Regular Meeting}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

log() { printf "\n\033[1;33m%s\033[0m\n" "$*"; }
ok() { printf "\033[0;32m%s\033[0m\n" "$*"; }

# 1) Delete event on DELETE_DATE if present
log "Checking for event on ${DELETE_DATE}..."
FOR_DATE_JSON="$(curl -sS "${BASE_URL}/api/events/for-date?date=${DELETE_DATE}" || true)"
EVENT_ID="$(python3 - <<PY
import json,sys
raw = """${FOR_DATE_JSON}""".strip()
if not raw:
    print("")
    sys.exit(0)
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("")
    sys.exit(0)
print(data.get("id", ""))
PY
)"

if [[ -n "${EVENT_ID}" ]]; then
  log "Deleting event id=${EVENT_ID} (${DELETE_DATE})..."
  curl -sS -X DELETE "${BASE_URL}/api/events/${EVENT_ID}?force=true" | python3 -m json.tool
  ok "Deleted event ${EVENT_ID}."
else
  ok "No event found for ${DELETE_DATE} (nothing to delete)."
fi

# 2) Create event on CREATE_DATE if missing
log "Checking for event on ${CREATE_DATE}..."
FOR_CREATE_JSON="$(curl -sS "${BASE_URL}/api/events/for-date?date=${CREATE_DATE}" || true)"
NEW_ID="$(python3 - <<PY
import json,sys
raw = """${FOR_CREATE_JSON}""".strip()
if not raw:
    print("")
    sys.exit(0)
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("")
    sys.exit(0)
print(data.get("id", ""))
PY
)"

if [[ -z "${NEW_ID}" ]]; then
  log "Creating ${EVENT_NAME} on ${CREATE_DATE}..."
  CREATE_RESP="$(curl -sS -X POST "${BASE_URL}/api/events" \
    -H "Content-Type: application/json" \
    -d "$(python3 - <<PY
import json
print(json.dumps({
  "name": "${EVENT_NAME}",
  "date": "${CREATE_DATE}",
  "startTime": "07:00",
  "endTime": "09:00",
  "registrationStartTime": "06:30",
  "onTimeCutoff": "07:05",
}))
PY
)")"
  echo "${CREATE_RESP}" | python3 -m json.tool
  NEW_ID="$(echo "${CREATE_RESP}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('event',{}).get('id',''))")"
  ok "Created event id=${NEW_ID}."
else
  ok "Event already exists for ${CREATE_DATE} (id=${NEW_ID})."
fi

if [[ -n "${NEW_ID}" ]]; then
  log "Activating event id=${NEW_ID} (exclusive)..."
  curl -sS -X POST "${BASE_URL}/api/events/${NEW_ID}/activate" \
    -H "Content-Type: application/json" \
    -d '{"exclusive":true}' | python3 -m json.tool
fi

# 3) Bulk import members from poster PDF
log "Importing members from member list poster..."
MEMBERS_JSON="$(python3 "${ROOT_DIR}/scripts/import-members-from-poster-2026-07.py")"
IMPORT_RESP="$(curl -sS -X POST "${BASE_URL}/api/bulk-import-members" \
  -H "Content-Type: application/json" \
  -d "${MEMBERS_JSON}")"
echo "${IMPORT_RESP}" | python3 -m json.tool

log "Verify current event:"
curl -sS "${BASE_URL}/api/events/current" | python3 -m json.tool

log "Member count:"
curl -sS "${BASE_URL}/api/members" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('members',[])))"

ok "Done."
