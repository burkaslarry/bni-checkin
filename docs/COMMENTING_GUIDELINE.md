# Commenting Guideline

This document defines block-comment standards for the BNI Anchor Check-in codebase (TypeScript/React and Kotlin/Spring Boot). **Do not change runtime behavior** when adding or updating comments.

---

## Documentation inventory (priority)

| Priority | Scope | Status |
|----------|--------|--------|
| **P1** | Public API (TS: `api.ts`, `lib/*.ts`, `types/seating.ts`, `qr-format.ts`, `hooks/useOfflineQueue.ts`, `supabase.ts`) | JSDoc added |
| **P1** | Kotlin: `AttendanceController`, `AttendanceService`, `MatchingController`, `DeepSeekService`, `AttendanceRepository`, `DataClasses` | KDoc added |
| **P2** | TS: `lib/matchGuestAPI.ts`, `lib/directDeepSeekMatch.ts`, `lib/sampleData.ts` | JSDoc added |
| **P2** | Traffic Light (TS: `lib/trafficLight.ts`, `api.ts` traffic-light exports, `TrafficLightPanel.tsx`; Kotlin: `TrafficLight*` + `NextMeetingPlanner`) | JSDoc/KDoc added |
| **P3** | TS: components (`*.tsx`), pages; Kotlin: other controllers, services, repos, entities, config | Add per PR when touching |

---

## A) TypeScript / Node / React (JSDoc)

### Standard
- Use **JSDoc-style** block comments: `/** ... */`
- Document: every **exported** function/class/type, and every **non-trivial internal** function.

### Per-block content (when applicable)
1. **One-line summary** — what it does
2. **`@param`** — for each parameter (include shape for objects)
3. **`@returns`** — description (or Promise resolve value)
4. **Side effects** — DB writes, network calls, cache writes, logging, time, filesystem
5. **Errors / exceptions** — thrown or returned error type / union
6. **Examples** — at least one realistic usage snippet
7. **Notes** — tricky logic, edge cases

### Rules
- Keep comments concise and specific; no fluff
- If a function name is misleading, document the actual behavior; do not rename unless required for accuracy
- Do not refactor code except when needed to make the comment accurate

---

## B) Kotlin + Spring Boot (KDoc)

### Standard
- Use **KDoc-style** block comments: `/** ... */`
- Document: public classes, interfaces, objects; public methods; and Spring components where behavior matters:
  - `@RestController` endpoints
  - `@Service` business logic
  - `@Repository` / DAO DB access
  - `@Configuration` beans
  - `@Component` (scheduled jobs, listeners, consumers)
- Document non-trivial **private** functions (complex or tricky logic)

### Per-block content (when applicable)
1. **One-line summary** — business meaning, not just “does X”
2. **Detail** — what it guarantees and what it assumes
3. **`@param`** — constraints, nullability, units (e.g. time)
4. **`@return`** — for non-Unit functions
5. **`@throws`** — exceptions that can realistically bubble up
6. **Side effects** — DB writes (entity/table), external API calls, message queue, cache, filesystem, logging, time, transactions
7. **Security/permissions** — especially for controllers
8. **Examples** — short Kotlin snippet or HTTP example for controllers

### Spring Boot specifics
- **Controllers**: endpoint path + method (GET/POST/PUT/DELETE), request schema (query/path/body), response schema (success + error), auth assumptions, common status codes (200/201/400/401/403/404/409/500)
- **Services**: transactional behavior; whether `@Transactional` is required; isolation/consistency assumptions
- **Repositories**: query intent, performance risks (e.g. full scan), paging expectations

### Rules
- Do not change runtime behavior or Spring annotations unless required for truthful docs
- Do not reformat code beyond what is needed to insert comments

---

## C) Lint / CI (practical)

- **TypeScript**: ESLint with a JSDoc plugin (e.g. `eslint-plugin-jsdoc`) — recommend `require-jsdoc` for public API; warn for missing `@param`/`@returns` where applicable
- **Kotlin**: Rely on **Detekt** + **ktlint** for style; doc coverage mostly via **PR checklist** (see below). Optional: custom Detekt rule to flag public functions without KDoc in selected packages

---

## D) PR checklist (docs gate)

- [ ] New or changed **public** API (TS or Kotlin) has block comments (JSDoc/KDoc)
- [ ] Controllers: endpoint, method, request/response, auth and status codes documented
- [ ] Services: side effects (DB, API, cache) and transactional behavior noted
- [ ] Repositories: query intent and performance notes (e.g. full scan, paging) where relevant
- [ ] No comment-only PRs that change behavior; comments reflect actual behavior
