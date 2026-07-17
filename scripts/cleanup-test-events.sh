#!/usr/bin/env bash
# Soft-delete all events whose name contains a pattern (default: TEST).
# Usage:
#   ./scripts/cleanup-test-events.sh
#   PATTERN=Test BASE_URL=https://... ./scripts/cleanup-test-events.sh
set -euo pipefail

BASE_URL="${BASE_URL:-https://bni-anchor-checkin-backend.onrender.com}"
PATTERN="${PATTERN:-TEST}"

echo "Listing events from ${BASE_URL}..."
events_json="$(curl -sS "${BASE_URL}/api/events")"

python3 - <<PY
import json, os, subprocess, sys
pattern = os.environ["PATTERN"].upper()
events = json.loads('''${events_json}''')
matches = [e for e in events if pattern in e.get("name", "").upper()]
print(f"Found {len(matches)} event(s) matching '{pattern}'")
if not matches:
    sys.exit(0)
for e in matches:
    eid = e["id"]
    name = e.get("name", "")
    print(f"  id={eid} name={name}")
    url = f"${BASE_URL}/api/events/{eid}?force=true"
    out = subprocess.check_output(["curl", "-sS", "-X", "DELETE", url], text=True)
    print(f"    -> {out.strip()}")
print("Done.")
PY
