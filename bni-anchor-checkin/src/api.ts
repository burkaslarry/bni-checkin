/** Attendance summary for a member across events. */
export type MemberAttendance = {
  eventName: string;
  eventDate: string;
  status: string;
};

/** Single event attendance entry (member name, optional ID, status). */
export type EventAttendance = {
  memberName: string;
  membershipId?: string;
  status: string;
};

/** One check-in record (name, domain, type, timestamps, role, tags, referrer, substituteFor). */
export type CheckInRecord = {
  name: string;
  domain: string;
  type: string;
  timestamp: string;
  receivedAt: string;
  role?: AttendeeRole;
  tags?: string[];
  referrer?: string;
  substituteFor?: string;
};

/** Role types for attendees. */
export type AttendeeRole = "MEMBER" | "GUEST" | "VIP" | "SPEAKER";

/** Request body for manual check-in (name, type, currentTime, domain, role, tags, standing). */
export type CheckInRequest = {
  name: string;
  type: string;
  currentTime: string;
  domain?: string;
  role?: AttendeeRole;
  tags?: string[];
  referrer?: string;
  standing?: MemberStanding;
};

/** Member standing / status. */
export type MemberStanding = "GREEN" | "YELLOW" | "RED" | "BLACK";

/** Member list item (id, name, domain, standing, profession group). */
export type MemberInfo = {
  id?: number;
  name: string;
  domain: string;
  standing?: MemberStanding;
  professionCode?: string;
  professionGroupName?: string; // from bni_anchor_profession_groups join
  membershipId?: string;
  position?: string;
  chapterId?: number;
};

export type ChapterInfo = {
  id: number;
  tag: string;
  displayName: string;
  timezone: string;
  status: string;
  /** Preferred meeting weekday: 0=Sunday … 6=Saturday. */
  meetingWeekday?: number;
};

// Backend API: in dev uses Vite proxy (''), in prod uses VITE_API_BASE
const API_BASE = import.meta.env.DEV
  ? ""
  : ((import.meta.env.VITE_API_BASE as string) || "http://localhost:10000");

const jsonHeaders = {
  "Content-Type": "application/json"
};

/** Default public chapter: Anchor (id=1). */
export const ANCHOR_CHAPTER_ID = 1;
export const ANCHOR_CHAPTER_TAG = "anchor";

/** Known chapter tags → ids (matches bni_eventxp_chapters seed). */
export const CHAPTER_TAG_TO_ID: Record<string, number> = {
  anchor: 1,
  amax: 2,
  dynasty: 3
};

/** Append ?chapter= / ?chapterId= for multi-chapter API scope. */
let activeApiChapterTag: string | null = ANCHOR_CHAPTER_TAG;
let activeApiChapterId: number | null = ANCHOR_CHAPTER_ID;

/** Sync chapter scope for API calls (public `/` defaults to Anchor id=1). */
export function setActiveApiChapter(scope: { id?: number | null; tag?: string | null }) {
  if (scope.id !== undefined) {
    activeApiChapterId = scope.id != null && scope.id > 0 ? scope.id : null;
  }
  if (scope.tag !== undefined) {
    const t = scope.tag?.trim();
    activeApiChapterTag = t && t.length > 0 ? t : null;
    if (activeApiChapterId == null && t) {
      const mapped = CHAPTER_TAG_TO_ID[t.toLowerCase()];
      if (mapped) activeApiChapterId = mapped;
    }
  }
}

/** Sync from ChapterProvider so admin APIs scope to the logged-in chapter. */
export function setActiveApiChapterTag(tag: string | null | undefined) {
  setActiveApiChapter({ tag });
}

export function getActiveApiChapterTag(): string | null {
  return activeApiChapterTag;
}

export function getActiveApiChapterId(): number | null {
  return activeApiChapterId;
}

function withChapterQuery(url: string, chapter?: string | null, chapterId?: number | null): string {
  const tag = (chapter !== undefined && chapter !== null ? chapter : activeApiChapterTag)?.trim();
  const id =
    chapterId !== undefined && chapterId !== null
      ? chapterId
      : activeApiChapterId;
  const params = new URLSearchParams();
  if (id != null && id > 0) params.set("chapterId", String(id));
  if (tag) params.set("chapter", tag);
  if ([...params.keys()].length === 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${params.toString()}`;
}

const FETCH_TIMEOUT_MS = 25000;

/*
 * Backend payloads may expose event ids as JSON numbers or numeric strings; query params are always strings.
 * Use before activate/delete/export partitioning and when comparing `events/current` ↔ list items so `"21"` and `21`
 * behave as the same key.
 */
export function normalizeApiEventId(eventId?: number | string | null): number | undefined {
  if (eventId === undefined || eventId === null || eventId === "") return undefined;
  if (typeof eventId === "number" && Number.isFinite(eventId)) return Math.trunc(eventId);
  const n = Number.parseInt(String(eventId).trim(), 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Fetch with abort after timeout. Side effect: network I/O. Does not throw on HTTP errors.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

const RETRY_DELAYS_MS = [0, 1000, 3000];

/**
 * Resolves after given milliseconds. No side effects.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True if HTTP status is retriable (5xx or 429). */
function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/** True if error looks like a transient network/abort error. */
function isRetriableNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === "AbortError" || e.message.includes("fetch") || e.message.includes("NetworkError");
}

/**
 * Fetch with timeout and retries on 5xx/429 or retriable network errors.
 * Side effect: network I/O. Throws last error after maxAttempts.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @param {number} [maxAttempts]
 * @returns {Promise<Response>}
 * @throws {Error} After retries exhausted
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
  maxAttempts = 3
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)] + Math.floor(Math.random() * 300);
    if (delay > 0) await sleep(delay);
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.ok || !isRetriableStatus(response.status) || attempt === maxAttempts) {
        return response;
      }
    } catch (e) {
      lastError = e;
      if (!isRetriableNetworkError(e) || attempt === maxAttempts) {
        throw e;
      }
    }
  }
  throw (lastError instanceof Error ? lastError : new Error("Request failed after retries"));
}

/**
 * Parse JSON from response; if !response.ok throws Error with backend message.
 * Side effect: consumes response body.
 * @param {Response} response
 * @returns {Promise<T>} Parsed JSON
 * @throws {Error} When response.ok is false (message from body or status)
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    let msg = `後端回傳錯誤 (${response.status})`;
    if (text) {
      try {
        const json = JSON.parse(text) as { message?: string; error?: string };
        msg = json.message ?? json.error ?? text;
      } catch {
        msg = text.length > 200 ? text.slice(0, 200) + "..." : text || msg;
      }
    }
    throw new Error(msg);
  }
  return response.json();
}

/**
 * Record attendance using a QR scan payload. POST /api/attendance/scan.
 * Side effect: network call to backend.
 * @param {string} qrPayload - JSON string from QR (member or guest payload)
 * @returns {Promise<{ message: string }>}
 * @throws {Error} On HTTP error or invalid payload (message from backend)
 * @example const res = await recordAttendance(JSON.stringify({ name: "Alice", type: "member", membershipId: "X" }));
 */
export async function recordAttendance(
  qrPayload: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/api/attendance/scan`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ qrPayload }),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Search attendance history by member name. GET /api/attendance/member?name=...
 * Side effect: network call.
 * @param {string} name - Member name (query)
 * @param {AbortSignal} [signal] - Optional abort for request
 * @returns {Promise<MemberAttendance[]>}
 * @throws {Error} On HTTP error
 */
export async function searchMemberAttendance(
  name: string,
  signal?: AbortSignal
): Promise<MemberAttendance[]> {
  const response = await fetch(
    `${API_BASE}/api/attendance/member?name=${encodeURIComponent(name)}`,
    { signal, mode: "cors" }
  );
  return handleResponse(response);
}

/**
 * Get attendance roster for an event date. GET /api/attendance/event?date=...
 * Side effect: network call.
 * @param {string} date - Event date (YYYY-MM-DD)
 * @param {AbortSignal} [signal]
 * @returns {Promise<EventAttendance[]>}
 * @throws {Error} On HTTP error
 */
export async function searchEventAttendance(
  date: string,
  signal?: AbortSignal
): Promise<EventAttendance[]> {
  const response = await fetch(
    `${API_BASE}/api/attendance/event?date=${encodeURIComponent(date)}`,
    { signal, mode: "cors" }
  );
  return handleResponse(response);
}

/**
 * Get list of members with domain/standing (backend only). GET /api/members. Uses retry.
 * Side effect: network call.
 * @returns {Promise<{ members: MemberInfo[] }>}
 * @throws {Error} On failure; AbortError mapped to 連線逾時 message
 */
export async function getMembers(chapter?: string | null): Promise<{ members: MemberInfo[] }> {
  try {
    const response = await fetchWithRetry(
      withChapterQuery(`${API_BASE}/api/members`, chapter),
      { mode: "cors" },
      12000,
      3
    );
    return handleResponse(response);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("連線逾時，請確認後端已啟動並重試");
    }
    throw e;
  }
}

export async function clientLogin(
  adminLogin: string,
  adminPassword: string
): Promise<{ token: string; chapter: ChapterInfo; expiresAtEpochMs: number }> {
  const response = await fetch(`${API_BASE}/api/client/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ AdminLogin: adminLogin, AdminPassword: adminPassword }),
    mode: "cors"
  });
  const data = await handleResponse<{
    status: string;
    token: string;
    chapter: ChapterInfo;
    expiresAtEpochMs: number;
    message?: string;
  }>(response);
  if (!data.token || !data.chapter) {
    throw new Error(data.message || "Login failed");
  }
  return {
    token: data.token,
    chapter: data.chapter,
    expiresAtEpochMs: data.expiresAtEpochMs
  };
}

export async function clientLogout(token: string): Promise<void> {
  await fetch(`${API_BASE}/api/client/logout`, {
    method: "POST",
    headers: { ...jsonHeaders, "X-Client-Token": token },
    mode: "cors"
  });
}

export async function fetchClientSession(
  token: string
): Promise<{ chapter: ChapterInfo }> {
  const response = await fetch(`${API_BASE}/api/client/session`, {
    headers: { "X-Client-Token": token },
    mode: "cors"
  });
  return handleResponse(response);
}

export async function listChapters(): Promise<{ chapters: ChapterInfo[] }> {
  const response = await fetch(`${API_BASE}/api/chapters`, { mode: "cors" });
  return handleResponse(response);
}

export type ProfessionGroupInfo = {
  code: string;
  name: string;
  chapterId: number;
};

/** Chapter-scoped profession groups (AMax chapterId=2 uses different labels than Anchor). */
export async function getProfessionGroups(
  chapter?: string | null,
  chapterId?: number | null
): Promise<{ professionGroups: ProfessionGroupInfo[] }> {
  const response = await fetch(
    withChapterQuery(`${API_BASE}/api/profession-groups`, chapter, chapterId),
    { mode: "cors" }
  );
  return handleResponse(response);
}

/** Anchor-only: reset another chapter's AdminPassword. */
export async function updateChapterAdminPassword(
  token: string,
  tag: string,
  adminPassword: string
): Promise<{ status: string; chapter: { tag: string; displayName: string } }> {
  const response = await fetch(
    `${API_BASE}/api/chapters/${encodeURIComponent(tag)}/admin-password`,
    {
      method: "PUT",
      headers: { ...jsonHeaders, "X-Client-Token": token },
      body: JSON.stringify({ AdminPassword: adminPassword }),
      mode: "cors"
    }
  );
  return handleResponse(response);
}

/**
 * Pre-registered guest item (name, profession, referrer, optional eventDate).
 * @typedef {Object} GuestInfo
 */
export type GuestInfo = {
  name: string;
  profession: string;
  referrer: string;
  eventDate?: string;
  phoneNumber?: string;
};

/**
 * Get list of pre-registered guests (backend only). GET /api/guests. Optional eventDate returns only guests for that event (onsite support).
 * Side effect: network call.
 * @param eventDate Optional YYYY-MM-DD; when set, returns only guests for this event (e.g. latest event for check-in form).
 * @returns {Promise<{ guests: GuestInfo[] }>}
 * @throws {Error} AbortError → 連線逾時 message
 */
export async function getGuests(
  eventDate?: string,
  chapter?: string | null
): Promise<{ guests: GuestInfo[] }> {
  try {
    const url = eventDate
      ? withChapterQuery(`${API_BASE}/api/guests?eventDate=${encodeURIComponent(eventDate)}`, chapter)
      : withChapterQuery(`${API_BASE}/api/guests`, chapter);
    const response = await fetchWithRetry(url, { mode: "cors" }, 12000, 3);
    return handleResponse(response);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("連線逾時，請確認後端已啟動並重試");
    }
    throw e;
  }
}

export type PublicCaptchaChallenge = {
  a: number;
  b: number;
  op: string;
  nonce: string;
  signature: string;
};

export type PublicGuestCreateRequest = {
  name: string;
  profession: string;
  phoneNumber: string;
  referrer?: string;
  eventDate?: string;
  eventId?: number;
  notes?: string;
  /** When true, backend sets check-in time and records guest attendance */
  isWalkIn?: boolean;
  captcha: {
    a: number;
    b: number;
    op: string;
    nonce: string;
    signature: string;
    answer: number;
  };
};

/** Issue a server-signed CAPTCHA challenge for public forms. GET /api/public/captcha. */
export async function getPublicCaptcha(): Promise<PublicCaptchaChallenge> {
  const response = await fetch(`${API_BASE}/api/public/captcha`, { mode: "cors" });
  return handleResponse(response);
}

/**
 * Public walk-in guest registration. POST /api/public/guests.
 * Side effect: network; backend inserts into bni_anchor_guests.
 * @throws {Error} 403 captcha_failed, 409 duplicate_guest_phone_event, 400 validation errors
 */
export async function createPublicGuest(request: PublicGuestCreateRequest): Promise<{
  status: string;
  guest: { id?: number; name: string };
}> {
  const response = await fetch(`${API_BASE}/api/public/guests`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

/** Get one event by id. GET /api/events/{id}. Side effect: network. */
export async function getEventById(eventId: number): Promise<EventData> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events/${encodeURIComponent(String(eventId))}`), { mode: "cors" });
  return handleResponse(response);
}

/**
 * Manual check-in. POST /api/checkin. Side effect: network; backend may persist member to DB.
 * @param {CheckInRequest} request
 * @returns {Promise<{ status: string; message: string }>}
 * @throws {Error} On HTTP error or duplicate check-in (已經簽到)
 */
export async function checkIn(
  request: CheckInRequest
): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/checkin`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Get all check-in records (DB + in-memory merged). GET /api/records.
 * Side effect: network call.
 * @returns {Promise<{ records: CheckInRecord[] }>}
 * @throws {Error} On HTTP error
 */
export async function getRecords(): Promise<{ records: CheckInRecord[] }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/records`), { mode: "cors" });
  return handleResponse(response);
}

/**
 * Clear all check-in records. DELETE /api/records. Side effect: network; backend clears in-memory (and may DB).
 * @returns {Promise<{ status: string; message: string }>}
 * @throws {Error} On HTTP error
 */
export async function clearRecords(): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/records`), {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Delete one record by index. DELETE /api/records/:index. Side effect: network.
 * @param {number} index - 0-based index in records list
 * @returns {Promise<{ status: string; message: string }>}
 * @throws {Error} On HTTP error or 404
 */
export async function deleteRecord(index: number): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/records/${index}`, {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

/** Mark attendee absent and clear check-in. POST /api/events/attendance-corrections */
export async function markAttendanceAbsent(
  eventDate: string,
  name: string
): Promise<{ status: string; removed?: number; warnings?: string[] }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events/attendance-corrections`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      eventDate: eventDate.trim(),
      removeCheckIns: [name.trim()],
      addCheckIns: []
    }),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Export records as CSV blob. GET /api/export. Side effect: network.
 * @returns {Promise<Blob>} CSV file blob
 * @throws {Error} "Failed to export records" when !response.ok
 */
export async function exportRecords(eventId?: number | string | null): Promise<Blob> {
  const id = normalizeApiEventId(eventId);
  const q = id !== undefined ? `?eventId=${encodeURIComponent(String(id))}` : "";
  const response = await fetch(`${API_BASE}/api/export${q}`, { mode: "cors" });
  if (!response.ok) {
    throw new Error("Failed to export records");
  }
  return response.blob();
}

/** Response from POST /api/events/:id/send-attendance-email */
export type SendAttendanceEmailResult = {
  status: string;
  message?: string;
  eventId?: number;
  eventName?: string;
  eventDate?: string;
  filename?: string;
  rowCount?: number;
  recipient?: string;
};

/**
 * Email attendance CSV for an event via Resend (admin test / manual).
 * POST /api/events/{eventId}/send-attendance-email?force=true
 */
export async function sendAttendanceEmail(
  eventId: number | string,
  force: boolean = true
): Promise<SendAttendanceEmailResult> {
  const id = normalizeApiEventId(eventId);
  if (id === undefined) {
    throw new Error("Invalid event id");
  }
  const response = await fetch(
    withChapterQuery(`${API_BASE}/api/events/${encodeURIComponent(String(id))}/send-attendance-email?force=${force ? "true" : "false"}`),
    {
      method: "POST",
      mode: "cors",
      headers: jsonHeaders
    }
  );
  return handleResponse(response);
}

/**
 * Clear attendance-email-sent flag for an event.
 * DELETE /api/events/{eventId}/attendance-email
 */
export async function resetAttendanceEmail(
  eventId: number | string
): Promise<SendAttendanceEmailResult> {
  const id = normalizeApiEventId(eventId);
  if (id === undefined) {
    throw new Error("Invalid event id");
  }
  const response = await fetch(
    withChapterQuery(`${API_BASE}/api/events/${encodeURIComponent(String(id))}/attendance-email`),
    {
      method: "DELETE",
      mode: "cors",
      headers: jsonHeaders
    }
  );
  return handleResponse(response);
}

/** Response from POST /api/events/import-attendance-csv (multipart). */
export type ImportAttendanceCsvResult = {
  status: string;
  message?: string;
  eventId?: number;
  eventDate?: string;
  memberRowsApplied?: number;
  guestRowsApplied?: number;
  warnings?: string[];
};

/**
 * Import attendance from export-format CSV for an event date. POST /api/events/import-attendance-csv.
 * Requires backend database mode. Side effect: network.
 */
export async function importAttendanceCsv(eventDate: string, file: File): Promise<ImportAttendanceCsvResult> {
  const form = new FormData();
  form.append("eventDate", eventDate.trim());
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch(withChapterQuery(`${API_BASE}/api/events/import-attendance-csv`), {
      method: "POST",
      body: form,
      mode: "cors"
    });
  } catch (e: unknown) {
    wrapNetworkError(e, "匯入失敗");
  }
  const text = await response.text();
  let data: ImportAttendanceCsvResult & { message?: string };
  try {
    data = JSON.parse(text) as ImportAttendanceCsvResult & { message?: string };
  } catch {
    throw new Error(text.slice(0, 240) || `HTTP ${response.status}`);
  }
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

/**
 * Rethrow with a clearer 無法連接後端服務 message when error looks like network/fetch failure.
 * Side effect: none (throws).
 * @param {unknown} e
 * @param {string} fallback - Used if not a network error
 * @throws {Error} Always (either wrapped message or e/fallback)
 */
function wrapNetworkError(e: unknown, fallback: string): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "Failed to fetch" || msg.includes("fetch") || msg.includes("NetworkError")) {
    throw new Error(
      "無法連接後端服務。請確認：(1) 後端已啟動 (執行 ./run.sh 或 cd bni-anchor-checkin-backend && ./gradlew bootRun) (2) VITE_API_BASE 設定正確"
    );
  }
  throw e instanceof Error ? e : new Error(fallback);
}

/**
 * Create event with time settings (backend only). POST /api/events. Times: HH:mm or HH:mm:ss; date: YYYY-MM-DD.
 * Side effect: network. With PostgreSQL, inserts one absent row per member in `bni_anchor_attendances` when members exist.
 * @param {string} name - Event name
 * @param {string} date - YYYY-MM-DD
 * @param {string} startTime
 * @param {string} endTime
 * @param {string} registrationStartTime
 * @param {string} onTimeCutoff
 * @returns {Promise<{ status: string; message: string; event?: unknown }>}
 * @throws {Error} On HTTP error or invalid format; network errors wrapped via wrapNetworkError
 */
export async function createEvent(
  name: string,
  date: string,
  startTime: string,
  endTime: string,
  registrationStartTime: string,
  onTimeCutoff: string
): Promise<{ status: string; message: string; event?: unknown }> {
  try {
    const response = await fetch(withChapterQuery(`${API_BASE}/api/events`), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        name,
        date,
        registrationStartTime: registrationStartTime || "06:30",
        startTime: startTime || "07:00",
        onTimeCutoff: onTimeCutoff || "07:05",
        endTime: endTime || "09:00",
        createdAt: new Date().toISOString()
      }),
      mode: "cors"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = (data as { message?: string }).message ?? `HTTP ${response.status}`;
      if (import.meta.env.DEV) console.error("Create event failed:", response.status, data);
      throw new Error(msg);
    }
    return data as { status: string; message: string; event?: unknown };
  } catch (e) {
    wrapNetworkError(e, "建立活動失敗");
  }
}

/**
 * Delete all events and attendance records. DELETE /api/events/clear-all. Side effect: network.
 * @returns {Promise<{ status: string; message: string }>}
 * @throws {Error} On HTTP error
 */
export async function clearAllEventsAndAttendance(): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events/clear-all`), {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Event metadata (id, name, date, times, createdAt).
 * @typedef {Object} EventData
 */
export type EventData = {
  id: number;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  registrationStartTime: string;
  onTimeCutoff: string;
  createdAt: string;
  /** ISO timestamp when attendance CSV was emailed; null/undefined if never sent. */
  attendanceEmailSentAt?: string | null;
  chapterId?: number;
};

/** List all events (latest first). GET /api/events. Side effect: network. */
export async function listEvents(): Promise<EventData[]> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events`), { mode: "cors" });
  return handleResponse(response);
}

/**
 * Get current event. GET /api/events/current. Returns null on 404 or network error.
 * Side effect: network.
 * @returns {Promise<EventData | null>}
 */
export async function getCurrentEvent(chapter?: string | null, chapterId?: number | null): Promise<EventData | null> {
  try {
    const response = await fetch(withChapterQuery(`${API_BASE}/api/events/current`, chapter, chapterId), { mode: "cors" });
    if (response.status === 404) {
      return null;
    }
    return handleResponse(response);
  } catch {
    return null;
  }
}

/**
 * Set event as active for check-in. POST /api/events/{id}/activate. exclusive=true clears is_active on other events.
 */
export async function activateEvent(
  eventId: number,
  exclusive = true
): Promise<{ status: string; exclusive?: boolean; event?: unknown; message?: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events/${eventId}/activate`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ exclusive }),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Soft-delete one event. DELETE /api/events/{id}?force=true cascades attendance rows.
 */
export async function deleteEvent(
  eventId: number,
  force = false
): Promise<{ status: string; message?: string }> {
  const q = force ? "?force=true" : "?force=false";
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events/${eventId}${q}`), {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

/** Update event name, start time, and/or end time. PUT /api/events/{id}. Returns updated event. */
export async function updateEvent(
  eventId: number,
  patch: { name?: string; startTime?: string; endTime?: string }
): Promise<EventData> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events/${eventId}`), {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(patch),
    mode: "cors"
  });
  const data = await handleResponse<{ status: string; event: EventData }>(response);
  if (!data.event) {
    throw new Error("Update succeeded but no event returned");
  }
  return data.event;
}

/** Report page: attendance status. */
export type AttendanceStatus = "on-time" | "late" | "absent";

/**
 * Single attendee in report (name, status, checkInTime, role, tags, sessionId).
 * @typedef {Object} ReportAttendance
 */
export type ReportAttendance = {
  memberName: string;
  status: AttendanceStatus;
  checkInTime?: string;
  role?: AttendeeRole;
  tags?: string[];
  sessionId?: string;
  substituteFor?: string;
};

/** Report dashboard statistics. */
export type ReportStats = {
  totalAttendees: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  guestCount: number;
  vipCount: number;
  vipArrivedCount: number;
  speakerCount: number;
};

/**
 * Full report for current event (event info, attendees, absentees, stats).
 * @typedef {Object} ReportData
 */
export type ReportData = {
  eventId: number;
  eventName: string;
  eventDate: string;
  onTimeCutoff: string;
  attendees: ReportAttendance[];
  absentees: ReportAttendance[];
  stats?: ReportStats;
};

/** Request for AI insights (eventId + analysisType). */
export type AIInsightRequest = {
  eventId: number;
  analysisType: "interest" | "retention" | "target_audience";
};

/** Single insight item (title, description, confidence, dataPoints). */
export type InsightItem = {
  title: string;
  description: string;
  confidence: number;
  dataPoints: Record<string, unknown>;
};

/** AI insight response (eventId, analysisType, generatedAt, insights, recommendations). */
export type AIInsightResponse = {
  eventId: number;
  analysisType: string;
  generatedAt: string;
  insights: InsightItem[];
  recommendations: string[];
};

/**
 * Get report data for current/latest event (backend only). GET /api/report. Returns null on 404.
 * Side effect: network. Errors other than 404 throw.
 * @returns {Promise<ReportData | null>}
 * @throws {Error} On non-404 HTTP error
 */
export async function getReportData(eventId?: number | string | null): Promise<ReportData | null> {
  const id = normalizeApiEventId(eventId);
  const q = id !== undefined ? `?eventId=${encodeURIComponent(String(id))}` : "";
  const response = await fetch(withChapterQuery(`${API_BASE}/api/report${q}`), { mode: "cors" });
  if (response.ok) {
    return handleResponse(response);
  }
  if (response.status === 404) {
    return null;
  }
  const text = await response.text();
  let msg = `無法載入報告 (${response.status})`;
  try {
    const json = JSON.parse(text) as { message?: string };
    if (json.message) msg = json.message;
  } catch {
    if (text) msg = text.slice(0, 200);
  }
  throw new Error(msg);
}

/**
 * Check if an event exists for a date. GET /api/events/check?date=... Returns false on error.
 * Side effect: network.
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
export async function checkEventExists(date: string): Promise<boolean> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/events/check?date=${encodeURIComponent(date)}`), { mode: "cors" });
  if (response.ok) {
    const data = await response.json();
    return !!data?.exists;
  }
  return false;
}

/**
 * Get event for date (backend only). GET /api/events/for-date?date=... Uses retry. Null on 404 or timeout.
 * Side effect: network. AbortError → throws 連線逾時.
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<{ id: number; name: string } | null>}
 */
export async function getEventForDate(
  date: string,
  chapter?: string | null
): Promise<{ id: number; name: string } | null> {
  try {
    const response = await fetchWithRetry(
      withChapterQuery(`${API_BASE}/api/events/for-date?date=${encodeURIComponent(date)}`, chapter),
      { mode: "cors" },
      10000,
      3
    );
    if (response.status === 404) {
      return null;
    }
    return handleResponse(response);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("連線逾時，請確認後端已啟動並重試");
    }
    return null;
  }
}

/**
 * Check if an event exists in the current week. GET /api/events/check-this-week. Returns false on error.
 * Side effect: network.
 * @returns {Promise<boolean>}
 */
export async function checkEventThisWeek(): Promise<boolean> {
  try {
    const response = await fetch(withChapterQuery(`${API_BASE}/api/events/check-this-week`), { mode: "cors" });
    if (response.ok) {
      const data = await response.json();
      return !!data?.exists;
    }
  } catch {
    // Return false if backend is unreachable
  }
  return false;
}

/**
 * Log attendance directly (backend only). POST /api/attendance/log. Members → DB; guests → in-memory + DB `check_in_time` when a guest row resolves.
 * Side effect: network.
 * @param {number | null} attendeeId
 * @param {string} attendeeType - "member" | "guest" | "vip" | "speaker"
 * @param {string} attendeeName
 * @param {string} attendeeProfession
 * @param {string} eventDate - YYYY-MM-DD
 * @param {string} checkedInAt - ISO or time
 * @param {string} status - e.g. "on-time" | "late"
 * @returns {Promise<{ status: string; message: string }>}
 * @throws {Error} On HTTP error; 409 for already checked in
 */
export async function logAttendance(
  attendeeId: number | null,
  attendeeType: string,
  attendeeName: string,
  attendeeProfession: string,
  eventDate: string,
  checkedInAt: string,
  status: string,
  chapter?: string | null
): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/attendance/log`, chapter), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      attendeeId,
      attendeeType,
      attendeeName,
      attendeeProfession,
      eventDate,
      checkedInAt,
      status
    }),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Set or clear substitute attendee on a member attendance row. POST /api/attendance/substitute-for.
 */
export async function updateAttendanceSubstitute(
  eventDate: string,
  memberName: string,
  substituteName?: string,
  chapter?: string | null
): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/attendance/substitute-for`, chapter), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      eventDate: eventDate.trim(),
      memberName: memberName.trim(),
      substituteName: substituteName?.trim() || null
    }),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Get WebSocket URL for report live updates (derived from API_BASE). No side effects.
 * @returns {string} e.g. ws://localhost:10000/ws/report
 */
export function getReportWebSocketUrl(): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/ws/report`;
}

// ===== AI Insights API (Phase 2) =====

/**
 * Generate AI insights for an event. POST /api/insights/generate. Side effect: network.
 * @param {AIInsightRequest} request
 * @returns {Promise<AIInsightResponse>}
 * @throws {Error} On HTTP error
 */
export async function generateAIInsights(
  request: AIInsightRequest
): Promise<AIInsightResponse> {
  const response = await fetch(`${API_BASE}/api/insights/generate`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Get previously generated insights for an event. GET /api/insights/:eventId. Side effect: network.
 * @param {number} eventId
 * @returns {Promise<AIInsightResponse[]>}
 * @throws {Error} On HTTP error
 */
export async function getEventInsights(
  eventId: number
): Promise<AIInsightResponse[]> {
  const response = await fetch(`${API_BASE}/api/insights/${eventId}`, {
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Export AI-ready data for an event. GET /api/insights/data-export/:eventId. Side effect: network.
 * @param {number} eventId
 * @returns {Promise<Record<string, unknown>>}
 * @throws {Error} On HTTP error
 */
export async function exportAIReadyData(
  eventId: number
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}/api/insights/data-export/${eventId}`, {
    mode: "cors"
  });
  return handleResponse(response);
}

// ===== Strategic Matching API =====

/** Quick match result (matches JSON string, provider name). */
export type QuickMatchResult = {
  matches: string;
  provider: string;
};

/**
 * Quick match for guest check-in. POST /api/matching/quick. Side effect: network (DeepSeek).
 * @param {string} guestName
 * @param {string} guestProfession
 * @returns {Promise<QuickMatchResult>}
 * @throws {Error} On HTTP error
 */
export async function quickMatch(
  guestName: string,
  guestProfession: string
): Promise<QuickMatchResult> {
  const response = await fetch(`${API_BASE}/api/matching/quick`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ guestName, guestProfession }),
    mode: "cors"
  });
  return handleResponse(response);
}

/** Single guest for batch match. */
export type BatchGuestInfo = {
  name: string;
  profession: string;
  remarks?: string;
};

/** One matched member in batch result. */
export type MatchedMember = {
  memberName: string;
  profession: string;
  matchStrength: string;
  reason: string;
};

/** Per-guest batch match result. */
export type BatchMatchResult = {
  guestName: string;
  guestProfession: string;
  matchedMembers: MatchedMember[];
};

/** Batch match response (results + provider). */
export type BatchMatchResponse = {
  results: BatchMatchResult[];
  provider: string;
};

/**
 * Batch matching for multiple guests. POST /api/matching/batch. Side effect: network (DeepSeek per guest).
 * @param {BatchGuestInfo[]} guests
 * @returns {Promise<BatchMatchResponse>}
 * @throws {Error} On HTTP error
 */
export async function batchMatch(
  guests: BatchGuestInfo[]
): Promise<BatchMatchResponse> {
  const response = await fetch(`${API_BASE}/api/matching/batch`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ guests }),
    mode: "cors"
  });
  return handleResponse(response);
}

// ===== Bulk Import API =====

/** Single row for bulk import (member or guest fields). */
export type ImportRecord = {
  name: string;
  profession: string;
  email?: string;
  phoneNumber?: string;
  referrer?: string;
  standing?: string;
  professionCode?: string;
  position?: string;
  membershipId?: string;
  eventDate?: string;
  /** Chapter tag; empty uses logged-in chapter (anchor default) or ?chapter= query. */
  chapter?: string;
};

/** Bulk import request (type + records). */
export type BulkImportRequest = {
  type: "member" | "guest";
  records: ImportRecord[];
};

/** Bulk import result (counts + error messages). */
export type ImportResult = {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
};

/**
 * Bulk import members or guests. POST /api/bulk-import-members or /api/bulk-import-guest. Uses retry.
 * Side effect: network; backend DB writes.
 * @param {BulkImportRequest} request
 * @returns {Promise<ImportResult>}
 * @throws {Error} AbortError → 連線逾時
 */
export async function bulkImport(
  request: BulkImportRequest,
  chapter?: string | null
): Promise<ImportResult> {
  try {
    const endpoint =
      request.type === "member"
        ? withChapterQuery(`${API_BASE}/api/bulk-import-members`, chapter)
        : withChapterQuery(`${API_BASE}/api/bulk-import-guest`);
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: jsonHeaders,
      // Dedicated endpoints accept List<ImportRecord>
      body: JSON.stringify(request.records),
      mode: "cors"
    }, 15000, 3);
    return handleResponse(response);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("連線逾時，請確認後端已啟動並重試");
    }
    throw e;
  }
}

/**
 * Bulk import observers. POST /api/bulk-import-observers.
 */
export async function bulkImportObservers(
  records: ImportRecord[]
): Promise<ImportResult> {
  try {
    const response = await fetchWithRetry(
      withChapterQuery(`${API_BASE}/api/bulk-import-observers`),
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(records),
        mode: "cors",
      },
      15000,
      3
    );
    return handleResponse(response);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("連線逾時，請確認後端已啟動並重試");
    }
    throw e;
  }
}

// ===== Member Management API =====

/** Update member payload (name, profession, standing, professionCode). */
export type UpdateMemberRequest = {
  name?: string;
  profession?: string;
  standing?: string;
  professionCode?: string;
};

export type CreateMemberRequest = {
  name: string;
  profession: string;
  standing?: MemberStanding;
  professionCode?: string;
  membershipId?: string;
  position?: string;
};

/**
 * Create a member registration record without checking in. POST /api/members.
 * Side effect: network; backend DB insert.
 */
export async function createMember(
  request: CreateMemberRequest,
  chapter?: string | null
): Promise<{ status: string; message: string; member?: MemberInfo }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/members`, chapter), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

function isMemberFetchNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const msg = error.message;
  return msg === "Failed to fetch" || msg.includes("NetworkError");
}

/**
 * Update member by id (preferred) or current name. PUT /api/members?memberId= or ?currentName=
 */
export async function updateMember(
  currentName: string,
  request: UpdateMemberRequest,
  memberId?: number
): Promise<{ status: string; message: string }> {
  const body = JSON.stringify(request);
  const putMember = (params: URLSearchParams) =>
    fetch(`${API_BASE}/api/members?${params.toString()}`, {
      method: "PUT",
      headers: jsonHeaders,
      body,
      mode: "cors"
    });

  if (memberId != null) {
    try {
      return await handleResponse(await putMember(new URLSearchParams({ memberId: String(memberId) })));
    } catch (error) {
      if (!isMemberFetchNetworkError(error)) throw error;
    }
  }

  return handleResponse(
    await putMember(new URLSearchParams({ currentName }))
  );
}

/** Update guest payload (name, profession, referrer, eventDate). */
export type UpdateGuestRequest = {
  name?: string;
  profession?: string;
  referrer?: string;
  eventDate?: string;
};

export type CreateGuestRequest = {
  name: string;
  profession: string;
  referrer?: string;
  eventDate?: string;
};

/**
 * Update guest by name. PUT /api/guests/:name. Side effect: network; backend DB update.
 * @param {string} name - Guest name (path)
 * @param {UpdateGuestRequest} request
 * @returns {Promise<{ status: string; message: string }>}
 * @throws {Error} On HTTP error
 */
export async function updateGuest(
  currentName: string,
  request: UpdateGuestRequest,
  currentEventDate?: string
): Promise<{ status: string; message: string }> {
  const params = new URLSearchParams({ currentName });
  if (currentEventDate?.trim()) {
    params.set("currentEventDate", currentEventDate.trim());
  }
  const response = await fetch(withChapterQuery(`${API_BASE}/api/guests?${params.toString()}`), {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Create a guest registration record without checking in. POST /api/guests.
 * Side effect: network; backend DB insert/update.
 */
export async function createGuest(
  request: CreateGuestRequest
): Promise<{ status: string; message: string; guest?: GuestInfo }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/guests`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

/**
 * Delete member by id (preferred) or name. DELETE /api/members?memberId= or ?name=
 */
export async function deleteMember(
  name: string,
  memberId?: number
): Promise<{ status: string; message: string }> {
  const deleteMemberRequest = (params: URLSearchParams) =>
    fetch(`${API_BASE}/api/members?${params.toString()}`, {
      method: "DELETE",
      mode: "cors"
    });

  if (memberId != null) {
    try {
      return await handleResponse(await deleteMemberRequest(new URLSearchParams({ memberId: String(memberId) })));
    } catch (error) {
      if (!isMemberFetchNetworkError(error)) throw error;
    }
  }

  return handleResponse(await deleteMemberRequest(new URLSearchParams({ name })));
}

/**
 * Delete guest by name. DELETE /api/guests/:name. Side effect: network; backend DB delete.
 * @param {string} name - Guest name (path)
 * @returns {Promise<{ status: string; message: string }>}
 * @throws {Error} On HTTP error
 */
export async function deleteGuest(
  name: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/guests/${encodeURIComponent(name)}`), {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

export type ObserverInfo = {
  id: number;
  name: string;
  profession: string;
  eventDate: string;
  attended: boolean;
};

export type CreateObserverRequest = {
  name: string;
  profession: string;
  eventDate?: string;
};

export type UpdateObserverRequest = {
  profession?: string;
  eventDate?: string;
};

export async function getObservers(
  eventDate?: string,
  chapter?: string | null
): Promise<{ observers: ObserverInfo[] }> {
  const q = eventDate ? `?eventDate=${encodeURIComponent(eventDate)}` : "";
  const response = await fetch(withChapterQuery(`${API_BASE}/api/observers${q}`, chapter), { mode: "cors" });
  return handleResponse(response);
}

export async function createObserver(
  request: CreateObserverRequest
): Promise<{ status: string; message: string; observer?: ObserverInfo }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/observers`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

export async function updateObserver(
  name: string,
  request: UpdateObserverRequest
): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/observers/${encodeURIComponent(name)}`), {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

export async function deleteObserver(
  name: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(withChapterQuery(`${API_BASE}/api/observers/${encodeURIComponent(name)}`), {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

export async function exportObservers(eventDate: string): Promise<Blob> {
  const response = await fetch(
    withChapterQuery(`${API_BASE}/api/observers/export?eventDate=${encodeURIComponent(eventDate)}`),
    { mode: "cors" }
  );
  if (!response.ok) {
    throw new Error("Failed to export observer attendance");
  }
  return response.blob();
}