export type MemberAttendance = {
  eventName: string;
  eventDate: string;
  status: string;
};

export type EventAttendance = {
  memberName: string;
  membershipId?: string;
  status: string;
};

export type CheckInRecord = {
  name: string;
  domain: string;
  type: string;
  timestamp: string;
  receivedAt: string;
  role?: AttendeeRole;
  tags?: string[];
  referrer?: string;
};

// Role types for attendees
export type AttendeeRole = "MEMBER" | "GUEST" | "VIP" | "SPEAKER";

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

export type MemberStanding = "GREEN" | "YELLOW" | "RED" | "BLACK";

export type MemberInfo = {
  id?: number;
  name: string;
  domain: string;
  standing?: MemberStanding;
  professionGroupName?: string; // from bni_anchor_profession_groups join
};

// Backend API: in dev uses Vite proxy (''), in prod uses VITE_API_BASE
const API_BASE = import.meta.env.DEV
  ? ""
  : ((import.meta.env.VITE_API_BASE as string) || "http://localhost:10000");

const jsonHeaders = {
  "Content-Type": "application/json"
};

const FETCH_TIMEOUT_MS = 25000;

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

const RETRY_DELAYS_MS = [0, 1000, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function isRetriableNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === "AbortError" || e.message.includes("fetch") || e.message.includes("NetworkError");
}

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

// Get list of members with domain info (backend only)
export async function getMembers(): Promise<{ members: MemberInfo[] }> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/api/members`, { mode: "cors" }, 12000, 3);
    return handleResponse(response);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("連線逾時，請確認後端已啟動並重試");
    }
    throw e;
  }
}

// Guest info type
export type GuestInfo = {
  name: string;
  profession: string;
  referrer: string;
  eventDate?: string;
};

// Get list of pre-registered guests (backend only)
export async function getGuests(): Promise<{ guests: GuestInfo[] }> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/api/guests`, { mode: "cors" }, 12000, 3);
    return handleResponse(response);
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("連線逾時，請確認後端已啟動並重試");
    }
    throw e;
  }
}

// Check-in (manual entry)
export async function checkIn(
  request: CheckInRequest
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/checkin`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

// Get all check-in records
export async function getRecords(): Promise<{ records: CheckInRecord[] }> {
  const response = await fetch(`${API_BASE}/api/records`, { mode: "cors" });
  return handleResponse(response);
}

// Clear all records
export async function clearRecords(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/records`, {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

// Delete a specific record by index
export async function deleteRecord(index: number): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/records/${index}`, {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

// Export records as CSV (returns blob URL)
export async function exportRecords(): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/export`, { mode: "cors" });
  if (!response.ok) {
    throw new Error("Failed to export records");
  }
  return response.blob();
}

// Helper: convert "Failed to fetch" / network errors to a clearer message
function wrapNetworkError(e: unknown, fallback: string): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "Failed to fetch" || msg.includes("fetch") || msg.includes("NetworkError")) {
    throw new Error(
      "無法連接後端服務。請確認：(1) 後端已啟動 (執行 ./run.sh 或 cd bni-anchor-checkin-backend && ./gradlew bootRun) (2) VITE_API_BASE 設定正確"
    );
  }
  throw e instanceof Error ? e : new Error(fallback);
}

// Create event with time settings (backend only).
// Times must be HH:mm or HH:mm:ss; date must be YYYY-MM-DD.
export async function createEvent(
  name: string,
  date: string,
  startTime: string,
  endTime: string,
  registrationStartTime: string,
  onTimeCutoff: string
): Promise<{ status: string; message: string; event?: unknown }> {
  try {
    const response = await fetch(`${API_BASE}/api/events`, {
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

// Delete all events and attendance records
export async function clearAllEventsAndAttendance(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/events/clear-all`, {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

// Event data type
export type EventData = {
  id: number;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  registrationStartTime: string;
  onTimeCutoff: string;
  createdAt: string;
};

// Get current event
export async function getCurrentEvent(): Promise<EventData | null> {
  try {
    const response = await fetch(`${API_BASE}/api/events/current`, { mode: "cors" });
    if (response.status === 404) {
      return null;
    }
    return handleResponse(response);
  } catch {
    return null;
  }
}

// Report page types
export type AttendanceStatus = "on-time" | "late" | "absent";

export type ReportAttendance = {
  memberName: string;
  status: AttendanceStatus;
  checkInTime?: string;
  role?: AttendeeRole;
  tags?: string[];
  sessionId?: string;
};

// Statistics for the report dashboard
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

export type ReportData = {
  eventId: number;
  eventName: string;
  eventDate: string;
  onTimeCutoff: string;
  attendees: ReportAttendance[];
  absentees: ReportAttendance[];
  stats?: ReportStats;
};

// AI Insight types for future integration
export type AIInsightRequest = {
  eventId: number;
  analysisType: "interest" | "retention" | "target_audience";
};

export type InsightItem = {
  title: string;
  description: string;
  confidence: number;
  dataPoints: Record<string, unknown>;
};

export type AIInsightResponse = {
  eventId: number;
  analysisType: string;
  generatedAt: string;
  insights: InsightItem[];
  recommendations: string[];
};

// Get report data for the current/latest event (backend only)
export async function getReportData(): Promise<ReportData | null> {
  const response = await fetch(`${API_BASE}/api/report`, { mode: "cors" });
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

// Check if event exists for a date (backend only)
export async function checkEventExists(date: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/events/check?date=${encodeURIComponent(date)}`, { mode: "cors" });
  if (response.ok) {
    const data = await response.json();
    return !!data?.exists;
  }
  return false;
}

// Get event for date (backend only)
export async function getEventForDate(date: string): Promise<{ id: number; name: string } | null> {
  try {
    const response = await fetchWithRetry(
      `${API_BASE}/api/events/for-date?date=${encodeURIComponent(date)}`,
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

// Check if event exists this week (backend only)
export async function checkEventThisWeek(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/events/check-this-week`, { mode: "cors" });
    if (response.ok) {
      const data = await response.json();
      return !!data?.exists;
    }
  } catch {
    // Return false if backend is unreachable
  }
  return false;
}

// Log attendance directly (backend only)
export async function logAttendance(
  attendeeId: number | null,
  attendeeType: string,
  attendeeName: string,
  attendeeProfession: string,
  eventDate: string,
  checkedInAt: string,
  status: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/attendance/log`, {
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

// Get WebSocket URL for report updates
export function getReportWebSocketUrl(): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/ws/report`;
}

// ===== AI Insights API (Phase 2) =====

// Generate AI insights for an event
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
}// Get previously generated insights for an event
export async function getEventInsights(
  eventId: number
): Promise<AIInsightResponse[]> {
  const response = await fetch(`${API_BASE}/api/insights/${eventId}`, {
    mode: "cors"
  });
  return handleResponse(response);
}// Export AI-ready data for external processing
export async function exportAIReadyData(
  eventId: number
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}/api/insights/data-export/${eventId}`, {
    mode: "cors"
  });
  return handleResponse(response);
}

// ===== Strategic Matching API =====

// Quick match for guest check-in
export type QuickMatchResult = {
  matches: string;
  provider: string;
};

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

// Batch matching for multiple guests
export type BatchGuestInfo = {
  name: string;
  profession: string;
  remarks?: string;
};

export type MatchedMember = {
  memberName: string;
  profession: string;
  matchStrength: string;
  reason: string;
};

export type BatchMatchResult = {
  guestName: string;
  guestProfession: string;
  matchedMembers: MatchedMember[];
};

export type BatchMatchResponse = {
  results: BatchMatchResult[];
  provider: string;
};

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
};

export type BulkImportRequest = {
  type: "member" | "guest";
  records: ImportRecord[];
};

export type ImportResult = {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
};

export async function bulkImport(
  request: BulkImportRequest
): Promise<ImportResult> {
  try {
    const endpoint =
      request.type === "member"
        ? `${API_BASE}/api/bulk-import-members`
        : `${API_BASE}/api/bulk-import-guest`;
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

// ===== Member Management API =====

export type UpdateMemberRequest = {
  profession?: string;
  standing?: string;
};

export async function updateMember(
  name: string,
  request: UpdateMemberRequest
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/members/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

export type UpdateGuestRequest = {
  profession?: string;
  referrer?: string;
  eventDate?: string;
};

export async function updateGuest(
  name: string,
  request: UpdateGuestRequest
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/guests/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(request),
    mode: "cors"
  });
  return handleResponse(response);
}

export async function deleteMember(
  name: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/members/${encodeURIComponent(name)}`, {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}

export async function deleteGuest(
  name: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/guests/${encodeURIComponent(name)}`, {
    method: "DELETE",
    mode: "cors"
  });
  return handleResponse(response);
}