/** Safe fragment for filenames (Windows/macOS/Linux). */
function sanitizeEventNameForFile(name: string): string {
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "event";
}

/** Basename without `.csv` (e.g. `2026-04-07_Workshop_A_attendance`). */
export function buildAttendanceCsvBasename(eventDate: string, eventName: string): string {
  return `${eventDate}_${sanitizeEventNameForFile(eventName)}_attendance`;
}

/** Full download filename: `{YYYY-MM-DD}_{EventName}_attendance.csv`. */
export function buildAttendanceCsvFilename(eventDate: string, eventName: string): string {
  return `${buildAttendanceCsvBasename(eventDate, eventName)}.csv`;
}
