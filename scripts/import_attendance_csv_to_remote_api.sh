#!/usr/bin/env bash
# POST an export-format attendance CSV to a running backend (writes PostgreSQL when DB mode is enabled).
# Usage:
#   BASE_URL=https://your-backend.example.com EVENT_DATE=2026-05-14 ./scripts/import_attendance_csv_to_remote_api.sh /path/to/attendance.csv
set -euo pipefail

BASE_URL="${BASE_URL:?Set BASE_URL to your API origin (no trailing slash)}"
EVENT_DATE="${EVENT_DATE:?Set EVENT_DATE as YYYY-MM-DD matching the event row in the DB}"
CSV_PATH="${1:?Pass path to CSV}"

curl -sS -X POST "${BASE_URL}/api/events/import-attendance-csv" \
  -F "eventDate=${EVENT_DATE}" \
  -F "file=@${CSV_PATH};type=text/csv;charset=utf-8"
echo
