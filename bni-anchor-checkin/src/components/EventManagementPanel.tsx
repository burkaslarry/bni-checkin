import { useState, useEffect, useCallback } from "react";
import { getCurrentEvent, clearAllEventsAndAttendance, EventData } from "../api";

type EventManagementPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
  onNavigateToStrategic?: () => void;
};

export const EventManagementPanel = ({ onNotify, onNavigateToStrategic }: EventManagementPanelProps) => {
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCurrentEvent = useCallback(async () => {
    setLoading(true);
    try {
      const event = await getCurrentEvent();
      setCurrentEvent(event);
    } catch {
      setCurrentEvent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentEvent();
  }, [fetchCurrentEvent]);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await clearAllEventsAndAttendance();
      setCurrentEvent(null);
      setShowDeleteConfirm(false);
      onNotify("已清除所有活動和簽到記錄", "success");
    } catch (error) {
      onNotify("清除失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (time: string) => {
    return time;
  };

  return (
    <section className="section event-management-panel">
      <div className="section-header">
        <h2>📅 活動管理</h2>
        <p className="hint">查看和管理目前的活動</p>
      </div>

      {loading ? (
        <div className="loading-state">
          <span>載入中...</span>
        </div>
      ) : currentEvent ? (
        <div className="event-details">
          <div className="event-card">
            <div className="event-card-header">
              <h3>{currentEvent.name}</h3>
              <span className="event-id">ID: {currentEvent.id}</span>
            </div>
            
            <div className="event-info-grid">
              <div className="info-item">
                <span className="info-label">📆 活動日期</span>
                <span className="info-value">{currentEvent.date}</span>
              </div>
              <div className="info-item">
                <span className="info-label">🕐 登記開始</span>
                <span className="info-value">{formatTime(currentEvent.registrationStartTime)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">🚀 活動開始</span>
                <span className="info-value">{formatTime(currentEvent.startTime)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">⏰ 準時截止</span>
                <span className="info-value highlight">{formatTime(currentEvent.onTimeCutoff)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">🏁 活動結束</span>
                <span className="info-value">{formatTime(currentEvent.endTime)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">📝 建立時間</span>
                <span className="info-value small">{new Date(currentEvent.createdAt).toLocaleString("zh-TW")}</span>
              </div>
            </div>

            <div className="event-actions">
              <a 
                href="/report" 
                target="_blank" 
                rel="noopener noreferrer"
                className="button view-report-btn"
              >
                📊 查看即時報告
              </a>
              {onNavigateToStrategic && (
                <button
                  className="button strategic-btn"
                  type="button"
                  onClick={onNavigateToStrategic}
                  style={{ backgroundColor: "#8b5cf6" }}
                >
                  🎯 Strategic Seating
                </button>
              )}
              <button
                className="ghost-button refresh-btn"
                type="button"
                onClick={fetchCurrentEvent}
              >
                🔄 重新整理
              </button>
            </div>
          </div>

          <div className="danger-zone">
            <h4>⚠️ 危險區域</h4>
            <p className="hint">刪除活動將同時清除所有簽到記錄</p>
            {!showDeleteConfirm ? (
              <button
                className="ghost-button danger-btn"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
              >
                🗑️ 刪除此活動
              </button>
            ) : (
              <div className="delete-confirm">
                <p className="warning-text">確定要刪除此活動和所有簽到記錄嗎？此操作無法復原！</p>
                <div className="confirm-buttons">
                  <button
                    className="button danger-btn"
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "⏳ 刪除中..." : "確認刪除"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
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

