import { useState, useEffect } from "react";
import { exportRecords, getRecords, CheckInRecord } from "../api";

type ExportPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export const ExportPanel = ({ onNotify }: ExportPanelProps) => {
  const [filename, setFilename] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return `BNI_Anchor_${today}`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const data = await getRecords();
        setRecords(data.records);
      } catch {
        // Silent fail for preview
      } finally {
        setIsLoadingPreview(false);
      }
    };
    fetchPreview();
  }, []);

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

  const handleExportLocal = () => {
    if (!filename.trim()) {
      onNotify("請輸入檔案名稱", "error");
      return;
    }

    if (records.length === 0) {
      onNotify("沒有記錄可匯出", "error");
      return;
    }

    // Generate CSV locally
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headers = ["姓名", "專業領域", "類別", "Check-in Time"];
    const rows = records.map((r) => [
      escapeCSV(r.name),
      escapeCSV(r.domain),
      escapeCSV(r.type),
      escapeCSV(r.timestamp)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename.trim()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    onNotify(`✅ ${filename}.csv 已下載（本地生成）`, "success");
  };

  const memberCount = records.filter((r) => r.type.toLowerCase() === "member").length;
  const guestCount = records.filter((r) => r.type.toLowerCase() === "guest").length;

  return (
    <section className="section export-panel">
      <div className="section-header">
        <h2>📥 匯出資料</h2>
        <p className="hint">將簽到記錄匯出為 CSV 格式</p>
      </div>

      <div className="export-preview">
        <h4>📊 匯出預覽</h4>
        {isLoadingPreview ? (
          <p className="hint">載入中...</p>
        ) : (
          <div className="preview-stats">
            <div className="preview-stat">
              <span className="stat-icon">📋</span>
              <span className="stat-value">{records.length}</span>
              <span className="stat-label">總記錄</span>
            </div>
            <div className="preview-stat">
              <span className="stat-icon">👤</span>
              <span className="stat-value">{memberCount}</span>
              <span className="stat-label">會員</span>
            </div>
            <div className="preview-stat">
              <span className="stat-icon">🎫</span>
              <span className="stat-value">{guestCount}</span>
              <span className="stat-label">來賓</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="filename-input">檔案名稱</label>
        <div className="filename-input-group">
          <input
            id="filename-input"
            className="input-field"
            placeholder="輸入檔案名稱"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
          <span className="file-extension">.csv</span>
        </div>
        <p className="hint">
          預覽檔名: <code>{filename || "attendance"}.csv</code>
        </p>
      </div>

      <div className="export-actions">
        <button
          className="button export-btn primary"
          type="button"
          onClick={handleExportFromServer}
          disabled={isExporting}
        >
          {isExporting ? "⏳ 處理中..." : "📥 從伺服器匯出"}
        </button>
        <button
          className="button export-btn secondary"
          type="button"
          onClick={handleExportLocal}
          disabled={records.length === 0}
        >
          💾 本地匯出
        </button>
      </div>

      <div className="csv-format-info">
        <h4>📄 CSV 格式說明</h4>
        <div className="format-table">
          <div className="format-header">
            <span>Name</span>
            <span>Profession</span>
            <span>Type</span>
            <span>Check-in Time</span>
          </div>
          <div className="format-example">
            <span>Jessica Cheung</span>
            <span>陪月服務</span>
            <span>member</span>
            <span>2025-11-26T09:30:00</span>
          </div>
        </div>
      </div>

      <div className="tips-section">
        <h4>💡 使用提示</h4>
        <ul className="tips-list">
          <li>
            <strong>從伺服器匯出</strong>: 直接從後端下載最新資料
          </li>
          <li>
            <strong>本地匯出</strong>: 使用已載入的資料生成 CSV
          </li>
          <li>CSV 檔案包含 UTF-8 BOM，Excel 可正確顯示中文</li>
          <li>建議使用有意義的檔名，如活動日期或名稱</li>
        </ul>
      </div>
    </section>
  );
};

