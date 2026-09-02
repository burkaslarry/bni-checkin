# Source from simulation / api-test scripts. Sets EVENTXP_TOKEN for admin APIs.
# Usage:
#   BASE_URL=http://localhost:10000
#   ADMIN_LOGIN=anchor ADMIN_PASSWORD='...'
#   . scripts/lib/admin-auth.sh
#   curl -H "X-Client-Token: ${EVENTXP_TOKEN}" ...

eventxp_admin_login() {
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo "Set ADMIN_PASSWORD (and optionally ADMIN_LOGIN, default anchor) for admin API calls." >&2
    return 1
  fi
  local login_json
  login_json="$(curl -sS -X POST "${BASE_URL}/api/client/login" \
    -H "Content-Type: application/json" \
    -d "{\"AdminLogin\":\"${ADMIN_LOGIN:-anchor}\",\"AdminPassword\":\"${ADMIN_PASSWORD}\"}")"
  EVENTXP_TOKEN="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('token') or '')" <<<"${login_json}")"
  if [ -z "${EVENTXP_TOKEN}" ]; then
    echo "Admin login failed: ${login_json}" >&2
    return 1
  fi
  EVENTXP_AUTH_HEADER="X-Client-Token: ${EVENTXP_TOKEN}"
}
