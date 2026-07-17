import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  getCurrentEvent,
  EventData,
  exportRecords,
  importAttendanceCsv,
  listEvents,
  activateEvent,
  deleteEvent,
  normalizeApiEventId
} from "../api";
import { EventSummaryCard } from "./EventSummaryCard";
import { EventAttendanceDetailModal } from "./EventAttendanceDetailModal";
import { EventEditModal } from "./EventEditModal";
import { buildAttendanceCsvFilename } from "../lib/attendanceExportFilename";

/*
 * Admin「活動管理」：載入 `GET /events/current` + `GET /events`，可啟用、匯入／匯出簽到 CSV、刪除活動。
 *
 * 「當前活動」置頂顯示；與後端現時活動比較 id 時必須經過 normalizeApiEventId（JSON 可能係 number 或數字字串）。
 * 若在本地／記憶體模式唔存在任何活動，可經 props 自動導去「產生 QR」頁。
 */
type EventManagementPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
  onNavigateToGenerate?: () => void;
};

export const EventManagementPanel = ({ onNotify, onNavigateToGenerate }: EventManagementPanelProps) => {
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingEventId, setExportingEventId] = useState<number | null>(null);
  const [importingEventId, setImportingEventId] = useState<number | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ eventId: number; date: string } | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [gridEvent, setGridEvent] = useState<EventData | null>(null);
  const [editEvent, setEditEvent] = useState<EventData | null>(null);

  const fetchCurrentEvent = useCallback(async () => {
    setLoading(true);
    try {
      const event = await getCurrentEvent();
      setCurrentEvent(event);
      const events = await listEvents();
      setAllEvents(Array.isArray(events) ? events : []);
    } catch {
      setCurrentEvent(null);
      setAllEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentEvent();
  }, [fetchCurrentEvent]);

  useEffect(() => {
    if (!loading && !currentEvent && allEvents.length === 0 && onNavigateToGenerate) {
      const timer = setTimeout(() => {
        onNotify("尚未建立活動，正在導向新增活動頁面...", "info");
        onNavigateToGenerate();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, currentEvent, allEvents.length, onNavigateToGenerate, onNotify]);

  const handleActivate = async (eventId: number) => {
    setActivatingId(eventId);
    try {
      await activateEvent(eventId, true);
      onNotify("已設為當前活動", "success");
      await fetchCurrentEvent();
    } catch (error) {
      onNotify("設定失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setActivatingId(null);
    }
  };

  const tryDeleteEvent = async (eventId: number, force: boolean, options?: { closeDangerConfirm?: boolean }) => {
    await deleteEvent(eventId, force);
    onNotify(force ? "已刪除活動及關聯簽到記錄" : "已刪除活動", "success");
    if (options?.closeDangerConfirm) setShowDeleteConfirm(false);
    await fetchCurrentEvent();
  };

  const handleDeleteClick = async (eventId: number) => {
    if (!window.confirm("確定要刪除此活動？")) return;
    setDeletingId(eventId);
    try {
      try {
        await tryDeleteEvent(eventId, false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("attendance") || msg.includes("force")) {
          if (!window.confirm("此活動已有簽到記錄。強制刪除會一併清除簽到資料，確定？")) {
            return;
          }
          await tryDeleteEvent(eventId, true);
        } else {
          throw e;
        }
      }
    } catch (error) {
      onNotify("刪除失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDangerZoneDelete = async () => {
    if (!currentEvent) return;
    setIsDeleting(true);
    try {
      await tryDeleteEvent(currentEvent.id, true, { closeDangerConfirm: true });
    } catch (error) {
      onNotify("刪除失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  /** 「當前活動」一定置頂：先挑出與後端 `/events/current` 相同 id，再將其餘維持原 API 順序（通常係 id 大到細）。 */
  const sortedEvents = useMemo(() => {
    if (!allEvents.length) return allEvents;
    const cid = normalizeApiEventId(currentEvent?.id);
    if (cid === undefined) return allEvents;

    let currentEv: EventData | undefined;
    const rest: EventData[] = [];
    for (const ev of allEvents) {
      if (normalizeApiEventId(ev.id) === cid) {
        if (!currentEv) currentEv = ev;
        else rest.push(ev);
      } else {
        rest.push(ev);
      }
    }
    return currentEv ? [currentEv, ...rest] : [...allEvents];
  }, [allEvents, currentEvent?.id]);

  const isSameEventCurrent = (ev: EventData) =>
    normalizeApiEventId(ev.id) === normalizeApiEventId(currentEvent?.id);

  const handlePickImportFile = (ev: EventData) => {
    setPendingImport({ eventId: ev.id, date: ev.date });
    importFileRef.current?.click();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = pendingImport;
    e.target.value = "";
    setPendingImport(null);
    if (!file || !target) return;
    setImportingEventId(target.eventId);
    try {
      const result = await importAttendanceCsv(target.date, file);
      const w = result.warnings?.length ?? 0;
      const detail = [
        `會員 ${result.memberRowsApplied ?? 0} 筆`,
        `嘉賓 ${result.guestRowsApplied ?? 0} 筆`,
        w > 0 ? `警告 ${w} 則（詳見 console）` : null
      ]
        .filter(Boolean)
        .join("；");
      onNotify(`已匯入簽到 CSV（${detail}）`, w > 0 ? "info" : "success");
      if (w > 0 && result.warnings?.length) {
        console.warn("[import-attendance-csv]", result.warnings);
      }
      await fetchCurrentEvent();
    } catch (err) {
      onNotify("匯入失敗: " + (err instanceof Error ? err.message : "未知錯誤"), "error");
    } finally {
      setImportingEventId(null);
    }
  };

  const handleExportEvent = async (ev: EventData) => {
    setExportingEventId(ev.id);
    try {
      const blob = await exportRecords(ev.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildAttendanceCsvFilename(ev.date, ev.name);
      link.click();
      window.URL.revokeObjectURL(url);
      onNotify("已匯出 CSV（包含缺席名單）", "success");
    } catch (e) {
      onNotify("匯出失敗: " + (e instanceof Error ? e.message : "未知錯誤"), "error");
    } finally {
      setExportingEventId(null);
    }
  };

  return (
    <section className="section event-management-panel">
      <div className="section-header">
        <h2>📅 活動管理</h2>
        <p className="hint">查看和管理目前的活動；可匯入與「匯出 CSV」相同格式的簽到檔（須後端資料庫模式）。</p>
      </div>

      <input
        ref={importFileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        aria-hidden
        onChange={(e) => void handleImportFileChange(e)}
      />

      {gridEvent && (
        <EventAttendanceDetailModal
          event={gridEvent}
          open
          onClose={() => setGridEvent(null)}
          onNotify={onNotify}
        />
      )}

      {editEvent && (
        <EventEditModal
          event={editEvent}
          open
          onClose={() => setEditEvent(null)}
          onSaved={() => void fetchCurrentEvent()}
          onNotify={onNotify}
        />
      )}

      {loading ? (
        <div className="loading-state">
          <span>載入中...</span>
        </div>
      ) : allEvents.length > 0 ? (
        <div className="event-details">
          <div className="event-card-stack">
            {sortedEvents.map((ev) => (
              <EventSummaryCard
                key={ev.id}
                event={ev}
                isCurrent={isSameEventCurrent(ev)}
                onRefresh={fetchCurrentEvent}
                onSetActive={() => void handleActivate(ev.id)}
                setActiveDisabled={isSameEventCurrent(ev)}
                activating={activatingId === ev.id}
                onDelete={() => void handleDeleteClick(ev.id)}
                deleting={deletingId === ev.id}
              >
                <button
                  type="button"
                  className="button"
                  style={{ backgroundColor: "#8b5cf6" }}
                  onClick={() => setEditEvent(ev)}
                >
                  ✏️ 編輯
                </button>
                <button
                  type="button"
                  className="button"
                  style={{ backgroundColor: "#6366f1" }}
                  onClick={() => setGridEvent(ev)}
                >
                  📊 出席／缺席
                </button>
                <button
                  type="button"
                  className="button"
                  style={{ backgroundColor: "#0ea5e9" }}
                  disabled={exportingEventId === ev.id}
                  onClick={() => void handleExportEvent(ev)}
                >
                  {exportingEventId === ev.id ? "⏳ 匯出中..." : "📥 匯出 CSV"}
                </button>
                <button
                  type="button"
                  className="button"
                  style={{ backgroundColor: "#d97706" }}
                  disabled={importingEventId === ev.id || exportingEventId === ev.id}
                  onClick={() => handlePickImportFile(ev)}
                >
                  {importingEventId === ev.id ? "⏳ 匯入中..." : "📤 匯入簽到 CSV"}
                </button>
                {isSameEventCurrent(ev) ? (
                  <a
                    href={`/admin/guests?eventDate=${encodeURIComponent(ev.date)}`}
                    className="button"
                    style={{ backgroundColor: "#10b981" }}
                  >
                    🎫 本活動嘉賓名單
                  </a>
                ) : null}
              </EventSummaryCard>
            ))}
          </div>

          
        </div>
      ) : (
        <div className="no-event-state">
          <div className="empty-icon">📅</div>
          <h3>尚未建立活動</h3>
          <p className="hint">請先使用「產生 QR 碼」功能建立新活動</p>
        </div>
      )}
    </section>
  );
};
