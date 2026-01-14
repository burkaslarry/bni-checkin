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
};

export type MemberInfo = {
  name: string;
  domain: string;
};

// Kotlin backend running on port 10000
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:10000";

const jsonHeaders = {
  "Content-Type": "application/json"
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || "Attendance service returned an unexpected response."
    );
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

// Get list of members with domain info
export async function getMembers(): Promise<{ members: MemberInfo[] }> {
  const response = await fetch(`${API_BASE}/api/members`, { mode: "cors" });
  return handleResponse(response);
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

// Create event with time settings
export async function createEvent(
  name: string,
  date: string,
  startTime: string,
  endTime: string,
  registrationStartTime: string,
  onTimeCutoff: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ 
      name, 
      date, 
      startTime, 
      endTime, 
      registrationStartTime,
      onTimeCutoff 
    }),
    mode: "cors"
  });
  return handleResponse(response);
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

// Get report data for the current/latest event
export async function getReportData(): Promise<ReportData> {
  const response = await fetch(`${API_BASE}/api/report`, { mode: "cors" });
  console.log("report data response");
  console.log(response);
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
}

// Get previously generated insights for an event
export async function getEventInsights(
  eventId: number
): Promise<AIInsightResponse[]> {
  const response = await fetch(`${API_BASE}/api/insights/${eventId}`, {
    mode: "cors"
  });
  return handleResponse(response);
}

// Export AI-ready data for external processing
export async function exportAIReadyData(
  eventId: number
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}/api/insights/data-export/${eventId}`, {
    mode: "cors"
  });
  return handleResponse(response);
}

