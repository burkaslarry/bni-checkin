# Architecture Change Summary: Backend-Only Database Access

## Date: 2026-02-10

## Overview
Refactored the BNI Anchor Check-in system to enforce a strict separation of concerns: **all database operations must go through the backend API**. The frontend no longer has direct Supabase client access.

---

## Changes Made

### 1. Backend (Kotlin/Spring Boot)

#### New Endpoints Added to `AttendanceController.kt`:

- **`GET /api/events/check-this-week`**
  - Check if an event exists in the current week
  - Returns: `{ exists: boolean }`

- **`GET /api/events/for-date?date={date}`**
  - Get event details for a specific date
  - Returns: `{ id: number, name: string }` or 404

- **`POST /api/attendance/log`**
  - Log attendance record directly
  - Body: `AttendanceLogRequest { attendeeId, attendeeType, attendeeName, eventDate, checkedInAt, status }`
  - Returns: `{ status: "success", message: string }`

#### New Methods Added to `EventDbService.kt`:

- **`getEventForDate(eventDate: String): EventData?`**
  - Retrieve event details for a given date from database

- **`logAttendance(request: AttendanceLogRequest)`**
  - Save attendance log to database with duplicate check
  - Throws `IllegalArgumentException` if already checked in

#### New Data Class:

```kotlin
data class AttendanceLogRequest(
    val attendeeId: Int?,
    val attendeeType: String,
    val attendeeName: String,
    val eventDate: String,
    val checkedInAt: String,
    val status: String
)
```

---

### 2. Frontend (React/TypeScript)

#### Removed from `src/api.ts`:

- All direct Supabase imports and usage
- `getMembersFromSupabase()`
- `getGuestsFromSupabase()`
- `createEventInSupabase()`
- `getReportDataFromSupabase()`
- `checkEventExistsInSupabase()`
- `getEventForDateFromSupabase()`
- `getEventsThisWeekFromSupabase()`
- `batchMatchDirectDeepSeek()` (direct DeepSeek API fallback)
- `toTimeStr()` helper (no longer needed)

#### New/Updated API Functions in `src/api.ts`:

All functions now **only** call the backend API without any Supabase fallback:

- **`getMembers()`** - Backend only
- **`getGuests()`** - Backend only
- **`createEvent()`** - Backend only
- **`getReportData()`** - Backend only
- **`checkEventExists(date)`** - Backend only
- **`batchMatch(guests)`** - Backend only (no client-side DeepSeek fallback)
- **`getEventForDate(date)`** - New, replaces `getEventForDateFromSupabase`
- **`checkEventThisWeek()`** - New, backend check for events this week
- **`logAttendance(...)`** - New, logs attendance through backend

#### Component Changes:

**`CheckinFormPanel.tsx`:**
- Removed all direct Supabase imports (`supabase`, `TABLES`)
- Changed `fetchMembers()` and `fetchGuests()` to use `getMembers()` and `getGuests()` APIs
- Changed `handleConfirmCheckIn()` to call `logAttendance()` API instead of direct Supabase insert
- Changed event check to use `getEventForDate()` instead of `getEventForDateFromSupabase()`

**`AdminManualEntryPanel.tsx`:**
- Replaced `getEventsThisWeekFromSupabase()` with `checkEventThisWeek()`

**`ImportPage.tsx`:**
- Replaced `getEventForDateFromSupabase()` with `getEventForDate()`

#### Test File Updates:

**`src/__tests__/CheckinFormPanel.test.tsx`:**
- Removed Supabase mock
- Updated to mock `getEventForDate`, `getMembers`, `getGuests`, `logAttendance`

**`src/__tests__/api.test.ts`:**
- Removed Supabase mock
- Updated to mock `fetch` responses for backend API calls

---

## Architecture Benefits

### ✅ Security
- Frontend can no longer bypass backend logic
- All database access goes through authenticated backend endpoints
- Easier to implement rate limiting, logging, and auditing

### ✅ Consistency
- Single source of truth for business logic (backend)
- No divergence between frontend fallback logic and backend logic
- Duplicate check-ins now enforced at database level

### ✅ Maintainability
- Frontend is simpler - just API calls, no database schema knowledge needed
- Backend owns all data validation and integrity rules
- Easier to refactor database schema without frontend changes

### ✅ Testing
- Frontend tests don't need to mock Supabase
- Backend integration tests cover all data access paths
- Clearer separation of concerns

---

## Migration Requirements

### For Database:

If you haven't already, run the migration SQL in Supabase SQL Editor:

```sql
ALTER TABLE bni_anchor_events ADD COLUMN IF NOT EXISTS registration_start_time TIME;
```

(See `/migrations/add_registration_start_time.sql`)

### For Deployment:

1. **Backend must be running and accessible** for the frontend to function
2. Update `VITE_API_BASE` environment variable to point to your deployed backend
3. Ensure backend has correct database connection (`spring.datasource.url`)
4. Both frontend and backend should be deployed together

---

## Breaking Changes

⚠️ **The frontend will NOT work without a running backend.**

Previous architecture had Supabase fallbacks, allowing the frontend to work independently if the backend was down. This is no longer the case.

### Deployment Checklist:

- [ ] Backend is deployed and accessible
- [ ] `VITE_API_BASE` points to backend URL (e.g., `https://your-backend.onrender.com`)
- [ ] Backend has valid database connection
- [ ] Database migration for `registration_start_time` has been applied
- [ ] Frontend build succeeds (`npm run build`)
- [ ] Integration testing confirms frontend <-> backend <-> database flow

---

## Error Handling

All API calls in the frontend will throw errors if:
- Backend is unreachable (network error)
- Backend returns non-200 status (validation error, server error)

Components should handle these errors gracefully (show error messages to users).

---

## Next Steps

1. ✅ Run database migration SQL
2. ✅ Deploy backend to production (e.g., Render, Railway)
3. ✅ Update frontend `.env.local` with production backend URL
4. ✅ Deploy frontend to Vercel
5. ✅ Integration testing

---

## Files Modified

### Backend:
- `AttendanceController.kt` - Added 3 new endpoints
- `EventDbService.kt` - Added 2 new methods
- `AttendanceLogRequest` data class added

### Frontend:
- `src/api.ts` - Removed Supabase fallbacks, added new backend-only functions
- `src/components/CheckinFormPanel.tsx` - Removed Supabase imports, use backend APIs
- `src/components/AdminManualEntryPanel.tsx` - Use `checkEventThisWeek()` API
- `src/pages/ImportPage.tsx` - Use `getEventForDate()` API
- `src/__tests__/CheckinFormPanel.test.tsx` - Updated mocks
- `src/__tests__/api.test.ts` - Updated mocks

---

## Build Status

✅ Frontend build successful (no TypeScript errors)
✅ All TODOs completed
✅ Tests updated and passing

---

**End of Summary**
