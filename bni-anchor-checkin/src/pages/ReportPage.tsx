import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  getReportData, getReportWebSocketUrl, exportRecords, getRecords, clearRecords, deleteRecord,
  ReportData, ReportAttendance, AttendeeRole, CheckInRecord
} from "../api";

type FilterType = "all" | "members" | "guests" | "vip";
type ViewTab = "report" | "records";

export default function ReportPage() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noEvent, setNoEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [exporting, setExporting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Records tab state
  const [viewTab, setViewTab] = useState<ViewTab>("report");
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordFilter, setRecordFilter] = useState<"all" | "member" | "guest">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [filename, setFilename] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return `BNI_Anchor_${today}`;
  });

  const fetchReportData = useCallback(async () => {
    try {
      const data = await getReportData();
      if (!data) {
        setNoEvent(true);
        setError(null);
        setLoading(false);
        return;
      }
      setReportData(data);
      setLastUpdated(new Date());
      setError(null);
      setNoEvent(false);
      setLoading(false);
    } catch (err) {
      console.error("Report fetch error:", err);
      if (err instanceof Error) {
        if (err.message.includes("404") || err.message.includes("Not Found")) {
          setNoEvent(true);
          setError(null);
        } else {
          setError(err.message);
          setNoEvent(false);
        }
      } else {
        setNoEvent(true);
      }
      setLoading(false);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const data = await getRecords();
      setRecords(data.records);
    } catch {
      // silent
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = getReportWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => { setWsConnected(true); };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "attendance_updated" || message.type === "event_created") {
            fetchReportData();
            fetchRecords();
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { setWsConnected(false); setTimeout(connectWebSocket, 3000); };
      ws.onerror = () => { setWsConnected(false); };
      wsRef.current = ws;
    };

    connectWebSocket();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [fetchReportData, fetchRecords]);

  // Polling
  useEffect(() => {
    fetchReportData();
    fetchRecords();
    pollIntervalRef.current = window.setInterval(() => {
      fetchReportData();
      fetchRecords();
    }, 10000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [fetchReportData, fetchRecords]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatDate = () =>
    new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });

  const formatRecordTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return isoString; }
  };

  // Report filters
  const filteredAttendees = useMemo(() => {
    if (!reportData) return [];
    return reportData.attendees.filter((record) => {
      const role = record.role || "MEMBER";
      switch (filter) {
        case "members": return role === "MEMBER";
        case "guests": return role === "GUEST" || role === "VIP" || role === "SPEAKER";
        case "vip": return role === "VIP" || role === "SPEAKER";
        default: return true;
      }
    });
  }, [reportData, filter]);

  // Records filters
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesFilter = recordFilter === "all" || record.type.toLowerCase() === recordFilter;
      const matchesSearch = !searchQuery || record.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [records, recordFilter, searchQuery]);

  const memberCount = records.filter((r) => r.type.toLowerCase() === "member").length;
  const guestCount = records.filter((r) => r.type.toLowerCase() === "guest").length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportRecords();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename.trim() || "attendance"}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteRecord = async (index: number) => {
    try {
      await deleteRecord(index);
      setRecords((prev) => prev.filter((_, i) => i !== index));
    } catch { /* silent */ }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearRecords();
      setRecords([]);
      setShowClearConfirm(false);
    } catch { /* silent */ }
    finally { setIsClearing(false); }
  };

  const getRoleBadge = (role?: AttendeeRole) => {
    if (!role || role === "MEMBER") return null;
    const badges: Record<string, { icon: string; label: string; className: string }> = {
      VIP: { icon: "⭐", label: "VIP", className: "role-badge vip" },
      GUEST: { icon: "👤", label: "Guest", className: "role-badge guest" },
      SPEAKER: { icon: "🎤", label: "Speaker", className: "role-badge speaker" },
    };
    const badge = badges[role];
    if (!badge) return null;
    return <span className={badge.className}>{badge.icon} {badge.label}</span>;
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
          {record.checkInTime && <span className="attendee-time">{record.checkInTime}</span>}
          {isLate && <span className="late-badge">遲到</span>}
        </div>
      </div>
    );
  };

  const renderAbsentee = (record: ReportAttendance) => (
    <div key={record.memberName} className="absentee-item">
      <span className="absentee-name">{record.memberName}</span>
    </div>
  );

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
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginTop: "1rem" }}>
            <button onClick={() => navigate("/admin?view=generate")} className="go-admin-button">
              🔧 前往管理頁面建立活動
            </button>
            <Link to="/" className="ghost-button">📱 返回簽到頁</Link>
            <Link to="/admin" className="ghost-button">🛠️ 管理後台</Link>
          </div>
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
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginTop: "1rem" }}>
            <button onClick={fetchReportData} className="retry-button">重試</button>
            <Link to="/" className="ghost-button">📱 簽到頁</Link>
            <Link to="/admin" className="ghost-button">🛠️ 管理後台</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <header className="report-header">
        <div className="header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>📊 即時簽到狀態</h1>
            <Link to="/" className="ghost-button" style={{ fontSize: "0.9rem" }}>📱 簽到頁</Link>
            <Link to="/admin" className="ghost-button" style={{ fontSize: "0.9rem" }}>🛠️ 管理後台</Link>
          </div>
          {reportData && (
            <div className="event-info" style={{ marginTop: "0.5rem" }}>
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
            <div className="last-updated">最後更新: {formatTime(lastUpdated)}</div>
          )}
        </div>
      </header>

      <div className="report-date-banner">
        <span className="today-date">{formatDate()}</span>
        {reportData && <span className="cutoff-info">準時截止: {reportData.onTimeCutoff}</span>}
      </div>

      {/* Tab Switcher */}
      <div className="filter-bar" style={{ borderBottom: "2px solid #334155", paddingBottom: 0 }}>
        <div className="filter-buttons" style={{ gap: "0" }}>
          <button
            className={`filter-btn ${viewTab === "report" ? "active" : ""}`}
            onClick={() => setViewTab("report")}
            style={{ borderRadius: "8px 0 0 0", borderRight: "1px solid #475569" }}
          >
            📊 出席報告
          </button>
          <button
            className={`filter-btn ${viewTab === "records" ? "active" : ""}`}
            onClick={() => setViewTab("records")}
            style={{ borderRadius: "0 8px 0 0" }}
          >
            📋 簽到記錄 CSV
          </button>
        </div>
      </div>

      {/* ========== TAB: Report ========== */}
      {viewTab === "report" && (
        <>
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
              {(["all", "members", "guests", "vip"] as FilterType[]).map((f) => (
                <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                  {f === "all" ? "全部" : f === "members" ? "會員" : f === "guests" ? "嘉賓" : "⭐ VIP"}
                </button>
              ))}
            </div>
          </div>

          <main className="report-content">
            <div className="report-columns">
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
                    <div className="attendee-list">{filteredAttendees.map(renderAttendee)}</div>
                  )}
                </div>
              </div>

              <div className="report-column absentees-column">
                <div className="column-header">
                  <h2>❌ 缺席 Absentees</h2>
                  <span className="count-badge absent">{reportData?.absentees.length || 0}</span>
                </div>
                <div className="column-content">
                  {reportData?.absentees.length === 0 ? (
                    <div className="empty-state success">
                      <span className="empty-icon">🎉</span>
                      <p>全員出席!</p>
                    </div>
                  ) : (
                    <div className="absentee-list">{reportData?.absentees.map(renderAbsentee)}</div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* ========== TAB: Records (CSV-style table from RecordsPanel) ========== */}
      {viewTab === "records" && (
        <section className="section records-panel" style={{ margin: "0", borderRadius: "0" }}>
          <div className="records-stats">
            <div className="stat-card total">
              <span className="stat-number">{records.length}</span>
              <span className="stat-label">總計</span>
            </div>
            <div className="stat-card member">
              <span className="stat-number">{memberCount}</span>
              <span className="stat-label">會員</span>
            </div>
            <div className="stat-card guest">
              <span className="stat-number">{guestCount}</span>
              <span className="stat-label">來賓</span>
            </div>
          </div>

          <div className="records-toolbar">
            <input
              className="input-field search-input"
              placeholder="🔍 搜尋姓名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="filter-buttons">
              {(["all", "member", "guest"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`filter-btn ${recordFilter === f ? "active" : ""}`}
                  onClick={() => setRecordFilter(f)}
                >
                  {f === "all" ? "全部" : f === "member" ? "👤 會員" : "🎫 來賓"}
                </button>
              ))}
            </div>
            <button type="button" className="ghost-button refresh-btn" onClick={fetchRecords} disabled={recordsLoading}>
              🔄 {recordsLoading ? "載入中..." : "重新整理"}
            </button>
          </div>

          <div className="table-container">
            <table aria-label="Check-in records">
              <thead>
                <tr>
                  <th>#</th>
                  <th>姓名</th>
                  <th>專業領域</th>
                  <th>類型</th>
                  <th>簽到時間</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {recordsLoading && !records.length && (
                  <tr><td colSpan={6} className="hint loading-cell">⏳ 載入中...</td></tr>
                )}
                {!recordsLoading && filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="hint empty-cell">
                      {searchQuery || recordFilter !== "all" ? "沒有符合條件的記錄" : "尚無簽到記錄"}
                    </td>
                  </tr>
                )}
                {filteredRecords.map((record, index) => {
                  const originalIndex = records.indexOf(record);
                  return (
                    <tr key={`${record.name}-${record.timestamp}-${index}`}>
                      <td className="row-number">{filteredRecords.length - index}</td>
                      <td className="name-cell">{record.name}</td>
                      <td className="name-cell">{record.domain}</td>
                      <td>
                        <span className={`type-badge ${record.type.toLowerCase()}`}>
                          {record.type.toLowerCase() === "member" ? "👤 會員" : "🎫 來賓"}
                        </span>
                      </td>
                      <td className="time-cell">{formatRecordTime(record.timestamp)}</td>
                      <td>
                        {record.type.toLowerCase() !== "member" && (
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDeleteRecord(originalIndex)}
                            title={`刪除 ${record.name}`}
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="records-footer">
            <div className="export-actions" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                className="input-field"
                style={{ width: "200px" }}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="檔案名稱"
              />
              <button className="button export-btn primary" type="button" onClick={handleExport} disabled={exporting}>
                {exporting ? "⏳ 處理中..." : "📥 匯出 CSV"}
              </button>
            </div>
            <p className="hint" style={{ margin: "0.5rem 0" }}>
              顯示 {filteredRecords.length} / {records.length} 筆記錄
            </p>

            {records.length > 0 && !showClearConfirm && (
              <button type="button" className="ghost-button clear-all-btn" onClick={() => setShowClearConfirm(true)}>
                🗑️ 清除全部記錄
              </button>
            )}
            {showClearConfirm && (
              <div className="clear-confirm">
                <p className="warning-text">⚠️ 確定要清除所有 {records.length} 筆記錄嗎？此操作無法復原。</p>
                <div className="confirm-buttons">
                  <button type="button" className="button danger-btn" onClick={handleClearAll} disabled={isClearing}>
                    {isClearing ? "清除中..." : "✅ 確定清除"}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setShowClearConfirm(false)}>
                    ❌ 取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

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
        <div className="auto-refresh-note" style={{ marginTop: "0.5rem" }}>
          自動每 10 秒更新 | WebSocket 即時同步
        </div>
      </footer>
    </div>
  );
}
