import { ReactNode } from "react";
import type { EventData } from "../api";

export function formatEventTime(time: string): string {
  if (!time) return time;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

type EventSummaryCardProps = {
  event: EventData;
  isCurrent?: boolean;
  onRefresh?: () => void;
  onSetActive?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  setActiveDisabled?: boolean;
  deleteDisabled?: boolean;
  activating?: boolean;
  deleting?: boolean;
  children?: ReactNode;
};

export function EventSummaryCard({
  event,
  isCurrent,
  onRefresh,
  onSetActive,
  onDelete,
  setActiveDisabled,
  deleteDisabled,
  activating,
  deleting,
  children
}: EventSummaryCardProps) {
  return (
    <div className={`event-card${isCurrent ? " event-card-current" : ""}`}>
      <div className="event-card-header">
        <h3>{event.name}</h3>
        <span className="event-id">ID: {event.id}</span>
      </div>

      <div className="event-info-grid">
        <div className="info-item">
          <span className="info-label">📆 活動日期</span>
          <span className="info-value">{event.date}</span>
        </div>
        <div className="info-item">
          <span className="info-label">🕐 登記開始</span>
          <span className="info-value">{formatEventTime(event.registrationStartTime)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">🚀 活動開始</span>
          <span className="info-value">{formatEventTime(event.startTime)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">⏰ 準時截止</span>
          <span className="info-value highlight">{formatEventTime(event.onTimeCutoff)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">🏁 活動結束</span>
          <span className="info-value">{formatEventTime(event.endTime)}</span>
        </div>
      </div>

      {(onRefresh || onSetActive || onDelete || children) && (
        <div className="event-actions event-actions-multiple">
          {onSetActive && (
            <button
              type="button"
              className="button"
              style={{ backgroundColor: setActiveDisabled ? "var(--border)" : "#059669" }}
              disabled={!!setActiveDisabled || !!activating}
              onClick={() => void onSetActive?.()}
            >
              {activating ? "⏳ 設定中..." : setActiveDisabled ? "✓ 當前活動" : "⭐ 設為當前活動"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="ghost-button danger-btn"
              disabled={deleteDisabled || deleting}
              onClick={() => void onDelete?.()}
            >
              {deleting ? "⏳ 刪除中..." : "🗑️ 刪除活動"}
            </button>
          )}
          {children}
          {onRefresh && (
            <button type="button" className="ghost-button refresh-btn" onClick={onRefresh}>
              🔄 重新整理
            </button>
          )}
        </div>
      )}
    </div>
  );
}
