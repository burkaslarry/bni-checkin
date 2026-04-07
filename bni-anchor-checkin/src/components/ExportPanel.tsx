import { useState, useEffect } from "react";
import { exportRecords, getRecords, CheckInRecord, getReportData, ReportData } from "../api";
import { buildAttendanceCsvBasename, buildAttendanceCsvFilename } from "../lib/attendanceExportFilename";

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
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const [recordsData, report] = await Promise.all([
          getRecords(),
          getReportData().catch(() => null)
        ]);
        setRecords(recordsData.records);
        setReportData(report);
      } catch {
        // Silent fail for preview
      } finally {
        setIsLoadingPreview(false);
      }
    };
    fetchPreview();
  }, []);

  useEffect(() => {
    if (reportData) {
      setFilename(buildAttendanceCsvBasename(reportData.eventDate, reportData.eventName));
    }
  }, [reportData?.eventId, reportData?.eventDate, reportData?.eventName]);

  const handleExportFromServer = async () => {
    if (!filename.trim()) {
      onNotify("請輸入檔案名稱", "error");
      return;
    }

    setIsExporting(true);
    const downloadName = reportData
      ? buildAttendanceCsvFilename(reportData.eventDate, reportData.eventName)
      : `${filename.trim()}.csv`;
    try {
      const blob = await exportRecords(reportData?.eventId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      onNotify(`✅ ${downloadName} 已下載`, "success");
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

  const guestCount = records.filter((r) => r.type.toLowerCase() === "guest").length;
  
  // Calculate attendance stats from report data
  const onTimeCount = reportData?.attendees.filter(a => a.status === "on-time").length || 0;
  const lateCount = reportData?.attendees.filter(a => a.status === "late").length || 0;
  const absentCount = reportData?.absentees.length || 0;
  const totalAttendees = onTimeCount + lateCount + guestCount;

  return (
    <section className="section export-panel">
      <div className="section-header">
        <h2>📥 匯出出席報告</h2>
        <p className="hint">將出席記錄匯出為 CSV 格式（包含狀態：準時/遲到/缺席）</p>
      </div>

      <div className="export-preview">
        <h4>📊 出席統計</h4>
        {isLoadingPreview ? (
          <p className="hint">載入中...</p>
        ) : reportData ? (
          <div className="preview-stats">
            <div className="preview-stat on-time">
              <span className="stat-icon">✅</span>
              <span className="stat-value">{onTimeCount}</span>
              <span className="stat-label">準時</span>
            </div>
            <div className="preview-stat late">
              <span className="stat-icon">⏰</span>
              <span className="stat-value">{lateCount}</span>
              <span className="stat-label">遲到</span>
            </div>
            <div className="preview-stat absent">
              <span className="stat-icon">❌</span>
              <span className="stat-value">{absentCount}</span>
              <span className="stat-label">缺席</span>
            </div>
            <div className="preview-stat guest">
              <span className="stat-icon">🎫</span>
              <span className="stat-value">{guestCount}</span>
              <span className="stat-label">來賓</span>
            </div>
          </div>
        ) : (
          <div className="preview-stats">
            <div className="preview-stat">
              <span className="stat-icon">📋</span>
              <span className="stat-value">{records.length}</span>
              <span className="stat-label">總簽到</span>
            </div>
            <p className="hint" style={{ marginTop: "0.5rem", color: "var(--warn)" }}>
              ⚠️ 尚未建立活動，無法顯示出席狀態
            </p>
          </div>
        )}
        
        {reportData && (
          <div className="total-summary">
            <span>總出席: <strong>{totalAttendees}</strong> 人</span>
            <span className="divider">|</span>
            <span>總人數: <strong>{onTimeCount + lateCount + absentCount + guestCount}</strong> 人</span>
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
            <span>姓名</span>
            <span>專業領域</span>
            <span>類別</span>
            <span>出席狀態</span>
            <span>簽到時間</span>
          </div>
          <div className="format-example on-time-row">
            <span>Jessica Cheung</span>
            <span>陪月服務</span>
            <span>member</span>
            <span>準時</span>
            <span>06:55:30</span>
          </div>
          <div className="format-example late-row">
            <span>John Wong</span>
            <span>保險顧問</span>
            <span>member</span>
            <span>遲到</span>
            <span>07:15:22</span>
          </div>
          <div className="format-example absent-row">
            <span>Mary Chan</span>
            <span>律師</span>
            <span>member</span>
            <span>缺席</span>
            <span></span>
          </div>
        </div>
      </div>

      <div className="tips-section">
        <h4>💡 出席狀態說明</h4>
        <ul className="tips-list">
          <li>
            <strong>✅ 準時</strong>: 在截止時間前簽到
          </li>
          <li>
            <strong>⏰ 遲到</strong>: 在截止時間後簽到
          </li>
          <li>
            <strong>❌ 缺席</strong>: 未簽到
          </li>
          <li>CSV 檔案包含 UTF-8 BOM，Excel 可正確顯示中文</li>
        </ul>
      </div>
    </section>
  );
};

