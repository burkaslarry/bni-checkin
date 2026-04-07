import { useState, useEffect, useCallback } from "react";
import {
  getCurrentEvent,
  EventData,
  exportRecords,
  listEvents,
  activateEvent,
  deleteEvent
} from "../api";
import { EventSummaryCard } from "./EventSummaryCard";
import { EventAttendanceDetailModal } from "./EventAttendanceDetailModal";
import { buildAttendanceCsvFilename } from "../lib/attendanceExportFilename";

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
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [gridEvent, setGridEvent] = useState<EventData | null>(null);

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
        <p className="hint">查看和管理目前的活動</p>
      </div>

      {gridEvent && (
        <EventAttendanceDetailModal
          event={gridEvent}
          open
          onClose={() => setGridEvent(null)}
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
            {allEvents.map((ev) => (
              <EventSummaryCard
                key={ev.id}
                event={ev}
                isCurrent={currentEvent?.id === ev.id}
                onRefresh={fetchCurrentEvent}
                onSetActive={() => void handleActivate(ev.id)}
                setActiveDisabled={currentEvent?.id === ev.id}
                activating={activatingId === ev.id}
                onDelete={() => void handleDeleteClick(ev.id)}
                deleting={deletingId === ev.id}
              >
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
                {currentEvent?.id === ev.id ? (
                  <a
                    href={`/admin/guests?eventDate=${encodeURIComponent(currentEvent.date)}`}
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
