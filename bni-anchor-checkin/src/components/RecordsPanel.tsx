import { useState, useEffect, useCallback } from "react";
import { exportRecords, getRecords, clearRecords, deleteRecord, CheckInRecord } from "../api";

type RecordsPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export const RecordsPanel = ({ onNotify }: RecordsPanelProps) => {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [filter, setFilter] = useState<"all" | "member" | "guest">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [filename, setFilename] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return `BNI_Anchor_${today}`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getRecords();
      setRecords(data.records);
    } catch {
      onNotify("無法載入簽到記錄", "error");
    } finally {
      setIsLoading(false);
    }
  }, [onNotify]);

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearRecords();
      setRecords([]);
      onNotify("✅ 所有記錄已清除", "success");
      setShowClearConfirm(false);
    } catch {
      onNotify("❌ 清除失敗", "error");
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportFromServer = async () => {
    if (!filename.trim()) {
      onNotify("請輸入檔案名稱", "error");
      return;
    }

    setIsExporting(true);
    try {
      const blob = await exportRecords();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename.trim()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      onNotify(`✅ ${filename}.csv 已下載`, "success");
    } catch {
      onNotify("❌ 從伺服器匯出失敗", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteRecord = async (index: number, name: string) => {
    try {
      await deleteRecord(index);
      setRecords((prev) => prev.filter((_, i) => i !== index));
      onNotify(`✅ 已刪除 ${name}`, "success");
    } catch {
      onNotify("❌ 刪除失敗", "error");
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchRecords, 10000);
    return () => clearInterval(interval);
  }, [fetchRecords]);

  const filteredRecords = records.filter((record) => {
    const matchesFilter =
      filter === "all" || record.type.toLowerCase() === filter;
    const matchesSearch =
      !searchQuery ||
      record.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const memberCount = records.filter((r) => r.type.toLowerCase() === "member").length;
  const guestCount = records.filter((r) => r.type.toLowerCase() === "guest").length;

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  return (
    <section className="section records-panel">
      <div className="section-header">
        <h2>📋 簽到記錄</h2>
        <p className="hint">即時顯示所有簽到資料（每 10 秒自動更新）</p>
      </div>

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
          <button
            type="button"
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            全部
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === "member" ? "active" : ""}`}
            onClick={() => setFilter("member")}
          >
            👤 會員
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === "guest" ? "active" : ""}`}
            onClick={() => setFilter("guest")}
          >
            🎫 來賓
          </button>
        </div>
        <button
          type="button"
          className="ghost-button refresh-btn"
          onClick={fetchRecords}
          disabled={isLoading}
        >
          🔄 {isLoading ? "載入中..." : "重新整理"}
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
            {isLoading && !records.length && (
              <tr>
                <td colSpan={5} className="hint loading-cell">
                  ⏳ 載入中...
                </td>
              </tr>
            )}
            {!isLoading && filteredRecords.length === 0 && (
              <tr>
                <td colSpan={5} className="hint empty-cell">
                  {searchQuery || filter !== "all"
                    ? "沒有符合條件的記錄"
                    : "尚無簽到記錄"}
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
                    <span
                      className={`type-badge ${record.type.toLowerCase()}`}
                    >
                      {record.type.toLowerCase() === "member" ? "👤 會員" : "🎫 來賓"}
                    </span>
                  </td>
                  <td className="time-cell">{formatTime(record.timestamp)}</td>
                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteRecord(originalIndex, record.name)}
                      title={`刪除 ${record.name}`}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="records-footer">

        <div className="export-actions">

        {records.length > 0 && ( 
          <button
          className="button export-btn primary"
          type="button"
          onClick={handleExportFromServer}
          disabled={isExporting}
        >
          {isExporting ? "⏳ 處理中..." : "📥 從伺服器匯出"}
        </button>        
        )}
        </div>
        <p className="hint">
          顯示 {filteredRecords.length} / {records.length} 筆記錄
        </p>
        
        {records.length > 0 && !showClearConfirm && (
          <button
            type="button"
            className="ghost-button clear-all-btn"
            onClick={() => setShowClearConfirm(true)}
          >
            🗑️ 清除全部記錄
          </button>
        )}

        {showClearConfirm && (
          <div className="clear-confirm">
            <p className="warning-text">⚠️ 確定要清除所有 {records.length} 筆記錄嗎？此操作無法復原。</p>
            <div className="confirm-buttons">
              <button
                type="button"
                className="button danger-btn"
                onClick={handleClearAll}
                disabled={isClearing}
              >
                {isClearing ? "清除中..." : "✅ 確定清除"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowClearConfirm(false)}
              >
                ❌ 取消
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

