#!/bin/bash
# API test: Event Creation and Larry Lo check-in
# Usage: ./scripts/api-test.sh [base_url]
# Default base_url: http://localhost:10000

BASE_URL="${1:-http://localhost:10000}"
EVENT_DATE="2026-03-02"

echo "=========================================="
echo "BNI Anchor API Test"
echo "Base URL: $BASE_URL"
echo "=========================================="

# Test 1: Create Event
echo ""
echo "1. Creating event..."
CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BNI Anchor Meeting",
    "date": "'"$EVENT_DATE"'",
    "startTime": "07:00",
    "endTime": "09:00",
    "registrationStartTime": "06:30",
    "onTimeCutoff": "07:05",
    "createdAt": "'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'"
  }')

HTTP_CODE=$(echo "$CREATE_RESP" | tail -n1)
BODY=$(echo "$CREATE_RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Event created successfully (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
else
  echo "   ❌ Event creation failed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
  exit 1
fi

# Test 2: Larry Lo check-in via /api/checkin (in-memory)
echo ""
echo "2. Larry Lo check-in (via /api/checkin)..."
NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
CHECKIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/checkin" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Larry Lo",
    "type": "member",
    "currentTime": "'"$NOW"'",
    "domain": "客戶服務系統"
  }')

HTTP_CODE=$(echo "$CHECKIN_RESP" | tail -n1)
BODY=$(echo "$CHECKIN_RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Larry Lo check-in successful (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
else
  echo "   ❌ Larry Lo check-in failed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi

# Test 3: Larry Lo check-in via /api/attendance/log (database) - if event exists
echo ""
echo "3. Larry Lo check-in (via /api/attendance/log - database)..."
# Get members to find Larry Lo's ID (optional - use 1 as placeholder for first member)
LOG_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/attendance/log" \
  -H "Content-Type: application/json" \
  -d '{
    "attendeeId": 1,
    "attendeeType": "member",
    "attendeeName": "Larry Lo",
    "eventDate": "'"$EVENT_DATE"'",
    "checkedInAt": "'"$NOW"'",
    "status": "on-time"
  }')

HTTP_CODE=$(echo "$LOG_RESP" | tail -n1)
BODY=$(echo "$LOG_RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Larry Lo attendance log successful (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
elif [ "$HTTP_CODE" = "400" ] && echo "$BODY" | grep -q "已經簽到"; then
  echo "   ⚠️  Already checked in (expected if duplicate)"

else
  echo "   Response (HTTP $HTTP_CODE): $BODY"
  echo "   (May fail if attendeeId 1 is not Larry Lo or DB not configured)"
fi

# Test 4: Fetch member list (and verify Larry Lo is present)
echo ""
echo "4. Fetching member list..."
MEMBERS_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/members")
HTTP_CODE=$(echo "$MEMBERS_RESP" | tail -n1)
BODY=$(echo "$MEMBERS_RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Members retrieved (HTTP $HTTP_CODE)"
  if echo "$BODY" | grep -q "Larry Lo"; then
    echo "   ✅ 'Larry Lo' found in member list"
  else
    echo "   ⚠️  'Larry Lo' not in member list (check DB/CSV)"
  fi
else
  echo "   ❌ Members fetch failed (HTTP $HTTP_CODE): $BODY"
fi

# Test 5: Get report and verify Larry Lo attendance
echo ""
echo "5. Getting report and verifying attendance..."
REPORT_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/report")
HTTP_CODE=$(echo "$REPORT_RESP" | tail -n1)
BODY=$(echo "$REPORT_RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Report retrieved (HTTP $HTTP_CODE)"
  if echo "$BODY" | grep -q '"memberName":"Larry Lo"' || echo "$BODY" | grep -q '"memberName": "Larry Lo"'; then
    echo "   ✅ Larry Lo found in report attendees (record exists in bni_anchor_attendances / attendance_logs)"
  else
    echo "   Response (attendees): $(echo "$BODY" | head -c 400)..."
  fi
else
  echo "   Response (HTTP $HTTP_CODE): $BODY"
fi

echo ""
echo "=========================================="
echo "API test complete"
echo "=========================================="
