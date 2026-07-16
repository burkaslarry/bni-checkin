#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://bni-anchor-checkin-backend.onrender.com}"
EVENT_DATE="${EVENT_DATE:-2026-07-02}"
TMP_CSV="$(mktemp /tmp/fix-attendance-XXXX.csv)"

cat > "${TMP_CSV}" <<EOF
姓名,專業領域,類別,出席狀態,簽到時間
Dr. Chow C.K.,,member,缺席,
Elva Cheung,,member,缺席,
Gigi Liu,,member,缺席,
Li Ka Wai,,member,缺席,
Zoe Wu,,member,缺席,
Jason Wong/Hayes Lam,,member,準時,08:45:00
EOF

echo "Clearing stale in-memory check-ins..."
curl -sS -X DELETE "${BASE_URL}/api/records" | python3 -m json.tool

echo "Applying CSV attendance corrections for ${EVENT_DATE}..."
curl -sS -X POST "${BASE_URL}/api/events/import-attendance-csv?eventDate=${EVENT_DATE}" \
  -F "file=@${TMP_CSV};type=text/csv" | python3 -m json.tool

rm -f "${TMP_CSV}"

echo "Done. Verify: ${BASE_URL}/api/report?eventId=37"
