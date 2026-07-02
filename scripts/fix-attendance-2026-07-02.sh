#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://bni-anchor-checkin-backend.onrender.com}"
EVENT_DATE="${EVENT_DATE:-2026-07-02}"

curl -sS -X POST "${BASE_URL}/api/events/attendance-corrections" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "eventDate": "${EVENT_DATE}",
  "removeCheckIns": [
    "Dr. Chow C.K.",
    "Elva Cheung",
    "Gigi Liu",
    "Li Ka Wai",
    "Kenson Tam",
    "Zoe Wu"
  ],
  "addCheckIns": [
    { "name": "Hayes Lam", "time": "08:45:00" }
  ]
}
EOF
)" | python3 -m json.tool
