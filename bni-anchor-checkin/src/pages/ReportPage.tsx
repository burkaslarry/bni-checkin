import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getReportData, getReportWebSocketUrl, ReportData, ReportAttendance, AttendeeRole } from "../api";

type FilterType = "all" | "members" | "guests" | "vip";

export default function ReportPage() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noEvent, setNoEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const fetchReportData = useCallback(async () => {
    try {
      const data = await getReportData();
      setReportData(data);
      setLastUpdated(new Date());
      setError(null);
      setNoEvent(false);
    } catch (err) {
      console.log("fetch report data error");
      console.log(err);
      if (err instanceof Error && err.message.includes("404")) {
        setNoEvent(true);
        setError(null);
      } else {
        setNoEvent(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = getReportWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "attendance_updated" || message.type === "event_created") {
            // Refresh data when attendance is updated
            fetchReportData();
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setWsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setWsConnected(false);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchReportData]);

  // Polling every 10 seconds as fallback
  useEffect(() => {
    fetchReportData();

    pollIntervalRef.current = window.setInterval(() => {
      fetchReportData();
    }, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchReportData]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = () => {
    return new Date().toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Filter attendees based on selected filter
  const filteredAttendees = useMemo(() => {
    if (!reportData) return [];
    
    return reportData.attendees.filter((record) => {
      const role = record.role || "MEMBER";
      switch (filter) {
        case "members":
          return role === "MEMBER";
        case "guests":
          return role === "GUEST" || role === "VIP" || role === "SPEAKER";
        case "vip":
          return role === "VIP" || role === "SPEAKER";
        default:
          return true;
      }
    });
  }, [reportData, filter]);

  // Get role badge component
  const getRoleBadge = (role?: AttendeeRole) => {
    if (!role || role === "MEMBER") return null;
    
    const badges: Record<string, { icon: string; label: string; className: string }> = {
      VIP: { icon: "⭐", label: "VIP", className: "role-badge vip" },
      GUEST: { icon: "👤", label: "Guest", className: "role-badge guest" },
      SPEAKER: { icon: "🎤", label: "Speaker", className: "role-badge speaker" },
    };
    
    const badge = badges[role];
    if (!badge) return null;
    
    return (
      <span className={badge.className}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const renderAttendee = (record: ReportAttendance) => {
    const isLate = record.status === "late";
    const role = record.role || "MEMBER";
    const isVIP = role === "VIP" || role === "SPEAKER";
    const isGuest = role === "GUEST";
    
    return (
      <div 
        key={`${record.memberName}-${role}`} 
        className={`attendee-item ${isLate ? "late" : "on-time"} ${isVIP ? "vip-highlight" : ""} ${isGuest ? "guest-highlight" : ""}`}
      >
        <div className="attendee-info">
          <span className="attendee-name" style={isLate ? { color: "#fb923c" } : {}}>
            {record.memberName}
          </span>
          {getRoleBadge(record.role)}
        </div>
        <div className="attendee-meta">
          {record.checkInTime && (
            <span className="attendee-time">
              {record.checkInTime}
            </span>
          )}
          {isLate && <span className="late-badge">遲到</span>}
        </div>
      </div>
    );
  };

  const renderAbsentee = (record: ReportAttendance) => {
    return (
      <div key={record.memberName} className="absentee-item">
        <span className="absentee-name">{record.memberName}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="report-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  if (noEvent) {
    return (
      <div className="report-page">
        <div className="no-event-container">
          <div className="no-event-icon">📅</div>
          <h2>尚未建立活動</h2>
          <p>請先在管理頁面建立今日活動</p>
          <button 
            onClick={() => navigate("/admin")} 
            className="go-admin-button"
          >
            🔧 前往管理頁面建立活動
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchReportData} className="retry-button">
            重試
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <header className="report-header">
        <div className="header-content">
          <h1>📊 即時簽到狀態</h1>
          {reportData && (
            <div className="event-info">
              <span className="event-name">{reportData.eventName}</span>
              <span className="event-date">{reportData.eventDate}</span>
            </div>
          )}
        </div>
        <div className="header-meta">
          <div className={`connection-status ${wsConnected ? "connected" : "disconnected"}`}>
            <span className="status-dot"></span>
            {wsConnected ? "即時連線中" : "重新連線中..."}
          </div>
          {lastUpdated && (
            <div className="last-updated">
              最後更新: {formatTime(lastUpdated)}
            </div>
          )}
        </div>
      </header>

      <div className="report-date-banner">
        <span className="today-date">{formatDate()}</span>
        {reportData && (
          <span className="cutoff-info">
            準時截止: {reportData.onTimeCutoff}
          </span>
        )}
      </div>

      {/* Stats Dashboard */}
      {reportData?.stats && (
        <div className="stats-dashboard">
          <div className="stat-item total">
            <span className="stat-number">{reportData.stats.totalAttendees}</span>
            <span className="stat-label">總出席</span>
          </div>
          <div className="stat-item on-time">
            <span className="stat-number">{reportData.stats.onTimeCount}</span>
            <span className="stat-label">準時</span>
          </div>
          <div className="stat-item late">
            <span className="stat-number">{reportData.stats.lateCount}</span>
            <span className="stat-label">遲到</span>
          </div>
          <div className="stat-item absent">
            <span className="stat-number">{reportData.stats.absentCount}</span>
            <span className="stat-label">缺席</span>
          </div>
          {(reportData.stats.vipCount > 0 || reportData.stats.guestCount > 0) && (
            <>
              <div className="stat-divider"></div>
              <div className="stat-item vip">
                <span className="stat-number">
                  {reportData.stats.vipArrivedCount}/{reportData.stats.vipCount}
                </span>
                <span className="stat-label">⭐ VIP 到場</span>
              </div>
              <div className="stat-item guest">
                <span className="stat-number">{reportData.stats.guestCount}</span>
                <span className="stat-label">👤 嘉賓</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filter Buttons */}
      <div className="filter-bar">
        <span className="filter-label">篩選:</span>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            全部
          </button>
          <button
            className={`filter-btn ${filter === "members" ? "active" : ""}`}
            onClick={() => setFilter("members")}
          >
            會員
          </button>
          <button
            className={`filter-btn ${filter === "guests" ? "active" : ""}`}
            onClick={() => setFilter("guests")}
          >
            嘉賓
          </button>
          <button
            className={`filter-btn ${filter === "vip" ? "active" : ""}`}
            onClick={() => setFilter("vip")}
          >
            ⭐ VIP
          </button>
        </div>
      </div>

      <main className="report-content">
        <div className="report-columns">
          {/* Attendees Column */}
          <div className="report-column attendees-column">
            <div className="column-header">
              <h2>✅ 出席 Attendees</h2>
              <div className="count-badges">
                <span className="count-badge">
                  {filteredAttendees.length}
                  {filter !== "all" && ` / ${reportData?.attendees.length || 0}`}
                </span>
                {filter !== "all" && (
                  <span className="filter-indicator">
                    {filter === "members" && "會員"}
                    {filter === "guests" && "嘉賓"}
                    {filter === "vip" && "VIP"}
                  </span>
                )}
              </div>
            </div>
            <div className="column-content">
              {filteredAttendees.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">👤</span>
                  <p>{filter === "all" ? "尚無簽到記錄" : `沒有符合的${filter === "members" ? "會員" : filter === "guests" ? "嘉賓" : "VIP"}`}</p>
                </div>
              ) : (
                <div className="attendee-list">
                  {filteredAttendees.map(renderAttendee)}
                </div>
              )}
            </div>
          </div>

          {/* Absentees Column */}
          <div className="report-column absentees-column">
            <div className="column-header">
              <h2>❌ 缺席 Absentees</h2>
              <span className="count-badge absent">
                {reportData?.absentees.length || 0}
              </span>
            </div>
            <div className="column-content">
              {reportData?.absentees.length === 0 ? (
                <div className="empty-state success">
                  <span className="empty-icon">🎉</span>
                  <p>全員出席!</p>
                </div>
              ) : (
                <div className="absentee-list">
                  {reportData?.absentees.map(renderAbsentee)}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="report-footer">
        <div className="legend">
          {reportData?.onTimeCutoff && (
            <>
              <div className="legend-item">
                <span className="legend-dot on-time"></span>
                <span>準時 (Before {reportData.onTimeCutoff})</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot late"></span>
                <span>遲到 (After {reportData.onTimeCutoff})</span>
              </div>
            </>
          )}
        </div>
        <div className="auto-refresh-note">
          自動每 10 秒更新 | WebSocket 即時同步
        </div>
      </footer>
    </div>
  );
}

