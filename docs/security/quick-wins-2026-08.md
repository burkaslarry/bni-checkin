# EventXP security quick wins (Aug–Sep 2026)

Status of the AppSec audit follow-up. **Code is in the working tree; production Render/Vercel still served the old image as of 1 Sep 2026** (`GET /health` 500, `GET /api/report` 200 without a token, `GET /api/members` still returned `email` / `phoneNumber`).

Do not commit secrets. This note does not record plaintext chapter passwords.

## Intent

Close the three audit quick wins without changing the Render **free** plan:

1. Authenticate admin APIs; stop using `/api/members` as a health check; strip PII from public member list.
2. Lock CORS, Vercel headers, Swagger, multipart size, captcha secret handling.
3. Stop shipping MD5 as the only hash; stop browser DeepSeek; stop unauthenticated attendance-email `force=true`.

Explicit exceptions from the product owner (2 Sep 2026):

- Do **not** set Render `CAPTCHA_SECRET`.
- Keep Vercel `VITE_DEEPSEEK_API_KEY` (do not delete). Frontend code must still **not** call DeepSeek with that key (bundle leak).
- Production chapter admin passwords were rotated in Render Postgres (MD5 of the new shared password). After the bcrypt backend deploys, first successful login rehashes to bcrypt.

## What shipped in code

### Authn / access

| Piece | Behaviour |
|---|---|
| `ApiAccessPolicy` | Public allowlist: `/health`, `/ws/*`, `/api/public/*`, login/logout/session, chapters resolve, kiosk GET members/guests/observers/profession-groups/current-event/check/for-date/numeric event id, POST check-in/scan/log/substitute, POST `/api/matching/quick`, GET matching health, OPTIONS. |
| `AdminAuthFilter` | Everything else under `/api` needs `X-Client-Token` resolved by `ChapterService.resolveChapterFromSession`. |
| `LoginRateLimiter` | 5 POSTs to `/api/client/login` per IP per 5 minutes → 429. Uses left-most `X-Forwarded-For`. |
| `HealthController` | `GET /health` → `{ "status": "ok" }` (no DB, no PII). |
| `render.yaml` | `healthCheckPath: /health` (plan remains `free`; auto-deploy still off). |
| `GET /api/members` | `email` / `phoneNumber` only when the session token is valid. |

Not public (need token): event list/create/activate/delete/clear-all, report/export/records, bulk-import, traffic-light, send-attendance-email, member mutations, observers export, matching members/batch, insights.

Frontend: `fetchWithTimeout` attaches `X-Client-Token`. `/admin` and `/report` use `ClientAuthGate`. `/admin/public-guest` is gated the same way.

Simulation scripts login first (`scripts/lib/admin-auth.sh`). Set `ADMIN_PASSWORD`.

### Perimeter

- `CorsConfig` / `WebSocketConfig`: `https://bni-anchor-checkin.vercel.app`, `http://localhost:*`, `http://127.0.0.1:*` (not `*`).
- `bni-anchor-checkin/vercel.json`: HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, CSP (`connect-src` includes Render HTTPS + WSS).
- `application-render.properties`: springdoc off, multipart 2MB, `captcha.secret=${CAPTCHA_SECRET:}`.
- `CaptchaService`: blank secret → random UUID **per process** (walk-in captcha breaks across Render spin-down unless `CAPTCHA_SECRET` is set; owner chose not to set it).

### Crypto / secrets / email

- `spring-security-crypto` bcrypt. Login: bcrypt if stored hash starts `$2…`, else MD5; **rehash to bcrypt on success**.
- New admin passwords: min **12** characters; reject `root1234` (case-insensitive). UI: `ChapterPasswordPanel`.
- Login errors are generic (`Invalid login or password`) so unknown logins are not enumerated.
- Browser DeepSeek disabled (`aiClient.ts`, `directDeepSeekMatch.ts`). Matching goes through Render `DEEPSEEK_API_KEY`.
- `AttendanceEmailController` `force` default **false**.
- `.env.example` / `env.example`: no `VITE_DEEPSEEK_API_KEY`. Vercel env var may still exist unused.

### Tests

- Backend: `ApiAccessPolicyTest`, `LoginRateLimiterTest`, `ChapterPasswordValidationTest` (length, `root1234`, bcrypt round-trip, legacy MD5 verify). `./gradlew test` passed after KDoc `*/` compile fixes.
- Frontend: `npm test -- --run` — 41 passed.

## Production DB (1–2 Sep 2026)

Table `bni_eventxp_chapters`: `anchor`, `amax`, `dynasty` `admin_password_md5` updated from the seed MD5 (`aabb…` / `root1234`) to the MD5 of the owner-chosen password.

Verified live: all three `POST /api/client/login` 200 with the new password; seed password 401.

Until the new backend is deployed, hashes stay MD5-shaped (32 hex). The new `ChapterService` will upgrade them to bcrypt on next login.

## Still open (not in this pass)

- Push + Render deploy (`./scripts/deploy-render-production.sh`) then Vercel (`./scripts/deploy-vercel-production.sh`). GitHub push does **not** auto-deploy the backend.
- Point Render Dashboard health check at `/health` if Blueprint YAML is not applied.
- Spring Security, hashed session table, Postgres RLS / least-privilege DB role.
- Kiosk GETs still return member **names** (no contact). `/ws/records` is still public for live check-in.
- Owner declined `CAPTCHA_SECRET` and declined removing `VITE_DEEPSEEK_API_KEY` from Vercel.

## Deploy reminder

Backend first, frontend second. SRAA: OWASP Dependency-Check on backend (fail High/Critical); `npm audit --audit-level=high` on frontend. Optional `SKIP_OWASP=1` is not for a production release.

After deploy, curl:

```bash
curl -sS https://bni-anchor-checkin-backend.onrender.com/health
# expect {"status":"ok"}

curl -sS -o /dev/null -w "%{http_code}\n" https://bni-anchor-checkin-backend.onrender.com/api/report
# expect 401
```

Public check-in `/` must still work without login.
