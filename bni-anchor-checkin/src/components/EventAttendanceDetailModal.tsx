import { useEffect, useState, useMemo } from "react";
import {
  getReportData,
  exportRecords,
  normalizeApiEventId,
  type EventData,
  type ReportAttendance,
  type ReportData,
} from "../api";
import { buildAttendanceCsvFilename } from "../lib/attendanceExportFilename";

type EventAttendanceDetailModalProps = {
  event: EventData;
  open: boolean;
  onClose: () => void;
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

function statusLabel(status: string): string {
  if (status === "on-time") return "準時";
  if (status === "late" || status === "late_with_code") return "遲到";
  if (status === "absent") return "缺席";
  return status;
}

function roleLabel(role?: string): string {
  const r = (role ?? "MEMBER").toUpperCase();
  if (r === "MEMBER") return "會員";
  if (r === "GUEST") return "嘉賓";
  if (r === "VIP") return "VIP";
  if (r === "SPEAKER") return "講員";
  return r;
}

type GridRow = {
  name: string;
  role: string;
  status: string;
  checkInTime: string;
  attendance: "出席" | "缺席";
};

export function EventAttendanceDetailModal({ event, open, onClose, onNotify }: EventAttendanceDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReport(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const id = normalizeApiEventId(event.id) ?? event.id;
        const data = await getReportData(id);
        if (cancelled) return;
        setReport(data);
        if (data === null) {
          setLoadError(
            `GET /api/report?eventId=${id} 回傳 404。常見原因：後端未連資料庫（需 spring.datasource.url）、或此活動在資料庫中找不到/已刪除。`
          );
        }
      } catch (e) {
        if (!cancelled) {
          setReport(null);
          const msg = e instanceof Error ? e.message : "載入報表失敗";
          setLoadError(msg);
          onNotify(msg, "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, event.id]);

  const rows = useMemo(() => {
    if (!report) return [];
    const present: GridRow[] = report.attendees.map((a: ReportAttendance) => ({
      name: a.memberName,
      role: roleLabel(a.role),
      status: statusLabel(a.status),
      checkInTime: a.checkInTime ?? "—",
      attendance: "出席" as const,
    }));
    const absent: GridRow[] = report.absentees.map((a: ReportAttendance) => ({
      name: a.memberName,
      role: roleLabel(a.role),
      status: "缺席",
      checkInTime: "—",
      attendance: "缺席" as const,
    }));
    const merged = [...present, ...absent];
    merged.sort((x, y) => x.name.localeCompare(y.name, "zh-Hant"));
    return merged;
  }, [report]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportRecords(normalizeApiEventId(event.id) ?? event.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildAttendanceCsvFilename(event.date, event.name);
      link.click();
      window.URL.revokeObjectURL(url);
      onNotify("已匯出 CSV", "success");
    } catch (e) {
      onNotify("匯出失敗: " + (e instanceof Error ? e.message : "未知錯誤"), "error");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-content event-attendance-detail-modal"
        style={{
          maxWidth: "960px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: "1rem",
          border: "1px solid var(--border)",
          background: "var(--panel)",
        }}
        role="dialog"
        aria-labelledby="event-attendance-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 id="event-attendance-modal-title" style={{ margin: 0, fontSize: "1.2rem" }}>
              📊 出席／缺席 — {event.name}
            </h2>
            <p className="hint" style={{ margin: "0.35rem 0 0 0" }}>
              {event.date} · ID {event.id}
              {report ? ` · 準時截止 ${report.onTimeCutoff}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="button" disabled={exporting || loading} onClick={() => void handleExport()}>
              {exporting ? "⏳ …" : "📥 匯出 CSV"}
            </button>
            <button type="button" className="ghost-button" onClick={onClose}>
              關閉
            </button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "0.75rem 1rem 1rem" }}>
          {loading ? (
            <p className="hint" style={{ textAlign: "center", padding: "2rem" }}>
              載入中…
            </p>
          ) : !report ? (
            <div className="hint" style={{ textAlign: "center", padding: "2rem", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 0.75rem 0", color: "var(--warn, #fbbf24)" }}>
                無法載入此活動的出席報表。
              </p>
              {loadError ? (
                <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.9 }}>{loadError}</p>
              ) : (
                <p style={{ margin: 0 }}>請稍後再試或確認後端日誌。</p>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                className="event-attendance-grid-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "0.65rem 0.5rem" }}>姓名</th>
                    <th style={{ padding: "0.65rem 0.5rem" }}>類別</th>
                    <th style={{ padding: "0.65rem 0.5rem" }}>出席／缺席</th>
                    <th style={{ padding: "0.65rem 0.5rem" }}>狀態</th>
                    <th style={{ padding: "0.65rem 0.5rem" }}>簽到時間</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={`${row.name}-${idx}`}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: row.attendance === "缺席" ? "rgba(239, 68, 68, 0.06)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "0.55rem 0.5rem", fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: "0.55rem 0.5rem" }}>{row.role}</td>
                      <td style={{ padding: "0.55rem 0.5rem" }}>{row.attendance}</td>
                      <td style={{ padding: "0.55rem 0.5rem" }}>{row.status}</td>
                      <td style={{ padding: "0.55rem 0.5rem", fontFamily: "monospace" }}>{row.checkInTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="hint" style={{ textAlign: "center", padding: "1.5rem" }}>
                  沒有列出的出席或缺席資料。
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
