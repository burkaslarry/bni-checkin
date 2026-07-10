#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:10000}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/import-members-from-poster-2026-07.py"

log() { printf "\n\033[1;33m%s\033[0m\n" "$*"; }
ok() { printf "\033[0;32m%s\033[0m\n" "$*"; }

log "Rename legacy aliases to poster names"
python3 - <<'PY' "${BASE_URL}"
import json, sys, urllib.parse, urllib.request

base = sys.argv[1]
aliases = {
    "Dr. Chow Chong Kwan": "Dr. Chow C.K.",
}
for old, new in aliases.items():
    payload = json.dumps({"name": new}).encode()
    req = urllib.request.Request(
        f"{base}/api/members/{urllib.parse.quote(old)}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode())
            print(f"renamed {old} -> {new}: {body.get('status')}")
    except Exception as e:
        print(f"skip rename {old}: {e}")
PY

log "Bulk import poster members → ${BASE_URL}"
MEMBERS_JSON="$(python3 "${SCRIPT}")"
IMPORT_RESP="$(curl -sS -X POST "${BASE_URL}/api/bulk-import-members" \
  -H "Content-Type: application/json" \
  -d "${MEMBERS_JSON}")"
echo "${IMPORT_RESP}" | python3 -m json.tool

log "Remove local members not on poster"
python3 - <<'PY' "${BASE_URL}" "${SCRIPT}"
import importlib.util, json, sys, urllib.parse, urllib.request

base, script = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location("poster", script)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
poster_names = {m["name"].casefold() for m in mod.MEMBERS}

with urllib.request.urlopen(f"{base}/api/members") as resp:
    members = json.loads(resp.read().decode()).get("members", [])

removed = []
for member in members:
    name = member["name"]
    if name.casefold() in poster_names:
        continue
    req = urllib.request.Request(
        f"{base}/api/members/{urllib.parse.quote(name)}",
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            json.loads(resp.read().decode())
            removed.append(name)
            print(f"deleted: {name}")
    except Exception as e:
        print(f"failed delete {name}: {e}")

print(f"removed {len(removed)} legacy members")
PY

# Tomcat rejects '/' in URL paths — remove known slash legacy rows via local SQL.
if command -v psql >/dev/null 2>&1; then
  psql -h localhost -p 5432 -U "${LOCAL_DB_USER:-${USER}}" -d bni_checkin -v ON_ERROR_STOP=1 -c \
    "DELETE FROM bni_anchor_attendances WHERE member_id IN (SELECT id FROM bni_anchor_members WHERE name = 'Eddie Chou/Max Chan');
     DELETE FROM bni_anchor_members WHERE name = 'Eddie Chou/Max Chan';" \
    >/dev/null 2>&1 && ok "Removed legacy Eddie Chou/Max Chan via SQL." || true
fi

log "Final member count"
curl -sS "${BASE_URL}/api/members" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('members',[])))"

ok "Local member list synced from poster."
