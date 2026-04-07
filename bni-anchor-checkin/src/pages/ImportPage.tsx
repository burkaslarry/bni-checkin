import { useState } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { bulkImport, ImportRecord, getEventForDate, getCurrentEvent } from "../api";

type ImportType = "member" | "guest";

type ImportRow = {
  name: string;
  profession: string;
  email?: string;
  phone?: string;
  referrer?: string;
  standing?: string;
  eventDate?: string;
};

const normalizeHeader = (key: string): string =>
  key.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]/g, "_");

const aliasSet = (aliases: string[]) => new Set(aliases.map(normalizeHeader));

const pickValue = (row: Record<string, unknown>, aliases: string[]): string => {
  const keys = aliasSet(aliases);
  for (const [k, v] of Object.entries(row)) {
    if (!keys.has(normalizeHeader(k))) continue;
    if (v == null) return "";
    return String(v).trim();
  }
  return "";
};

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("guest");
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as Record<string, unknown>[];
        const data: ImportRow[] = rawData.map((row) => ({
          name: pickValue(row, ["name"]),
          profession: pickValue(row, ["profession", "category"]),
          email: pickValue(row, ["email"]) || "",
          phone: pickValue(row, ["phone"]) || "",
          referrer: pickValue(row, ["referrer"]),
          standing: pickValue(row, ["standing"]),
          eventDate: pickValue(row, ["event_date", "eventdate"])
        }));
        const validationErrors: string[] = [];

        // Validate data
        data.forEach((row, index) => {
          if (!row.name) {
            validationErrors.push(`第 ${index + 1} 行：缺少姓名 (Name)`);
          }
          if (!row.profession) {
            validationErrors.push(`第 ${index + 1} 行：缺少專業領域 (profession)`);
          }
          
          // Validate email format if provided
          if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            validationErrors.push(`第 ${index + 1} 行：無效的電郵格式`);
          }
        });

        setErrors(validationErrors);
        setImportData(data);

        if (validationErrors.length > 0) {
          showNotification(`發現 ${validationErrors.length} 個格式錯誤`, "error");
        } else {
          showNotification(`成功讀取 ${data.length} 筆資料`, "success");
        }
      },
      error: (error) => {
        showNotification(`讀取失敗: ${error.message}`, "error");
      }
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false
  });

  const handleBulkImport = async () => {
    if (importData.length === 0 || errors.length > 0) {
      showNotification("請先修正格式錯誤", "error");
      return;
    }

    setIsImporting(true);

    try {
      // For guest import: default empty eventDate to latest event (onsite support), then verify event exists
      let guestEventDateDefault = "";
      if (importType === "guest") {
        const currentEvent = await getCurrentEvent();
        if (currentEvent?.date) guestEventDateDefault = currentEvent.date;
        const eventDates = [...new Set(importData.map((r) => (r.eventDate || guestEventDateDefault).trim()).filter(Boolean))];
        for (const d of eventDates) {
          if (!d) continue;
          const normalized = d.includes("-") ? d : `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
          const event = await getEventForDate(normalized);
          if (!event) {
            showNotification(`活動日期 ${d} 尚未建立活動，請先建立活動後再匯入嘉賓`, "error");
            setIsImporting(false);
            return;
          }
        }
      }
      const records: ImportRecord[] = importData.map((row) => {
        const eventDate = (row.eventDate || "").trim() || (importType === "guest" ? guestEventDateDefault : "");
        return {
          name: row.name,
          profession: row.profession || "",
          email: row.email || "",
          phoneNumber: row.phone || "",
          referrer: row.referrer || "",
          standing: row.standing || "GREEN",
          eventDate
        };
      });

      const result = await bulkImport({
        type: importType,
        records
      });

      setImportData([]);
      setErrors([]);

      if (result.failed === 0) {
        showNotification(
          `✅ 成功匯入 ${result.inserted} 筆新資料，更新 ${result.updated} 筆現有資料！`,
          "success"
        );
      } else {
        const errMsg = result.errors?.[0] ?? "未知錯誤";
        showNotification(
          `⚠️ 匯入完成：新增 ${result.inserted} 筆，更新 ${result.updated} 筆，失敗 ${result.failed} 筆。${errMsg}`,
          "info"
        );
        if (result.errors?.length) {
          console.error("Import errors:", result.errors);
        }
      }
    } catch (error) {
      showNotification("匯入失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = importType === "member"
      ? "name,profession"
      : "name,profession,phone,referrer,event_date";
    
    const today = new Date().toISOString().split("T")[0];
    const sampleRow = importType === "member"
      ? "\nJohn Doe,Software Development"
      : `\nJane Smith,Marketing Consultant,87654321,Larry Lo,${today}`;
    
    const csvContent = headers + sampleRow;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${importType}_template.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    showNotification(`已下載 ${importType === "member" ? "會員" : "嘉賓"} 範本`, "success");
  };

  return (
    <div className="app-shell">
      {notification && (
        <div className={`notification notification-${notification.type}`} style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          padding: "1rem 1.5rem",
          borderRadius: "8px",
          background: notification.type === "success" ? "#22c55e" : notification.type === "error" ? "#ef4444" : "#3b82f6",
          color: "white",
          zIndex: 1000,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
        }}>
          {notification.message}
        </div>
      )}

      <header className="site-header">
        <div>
        <p className="hint">EventXP for BNI Anchor</p>
          <h1>📥 批量匯入會員或嘉賓資料</h1>
          <p className="hint">Bulk Import Members & Guests</p>
        </div>
        <div className="header-meta">
          <Link to="/admin" className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="section-header">
          <h2>CSV 批量匯入</h2>
          <p className="hint">上傳 CSV 檔案以批量新增會員或嘉賓</p>
        </div>

        <div className="import-type-selector" style={{ marginBottom: "2rem" }}>
          <div className="checkin-type-selector">
            <label className="radio-button">
              <input
                type="radio"
                checked={importType === "member"}
                onChange={() => {
                  setImportType("member");
                  setImportData([]);
                  setErrors([]);
                }}
              />
              <span className="radio-label">匯入會員 👤</span>
            </label>
            <label className="radio-button">
              <input
                type="radio"
                checked={importType === "guest"}
                onChange={() => {
                  setImportType("guest");
                  setImportData([]);
                  setErrors([]);
                }}
              />
              <span className="radio-label">匯入嘉賓 🎫</span>
            </label>
          </div>
        </div>

        {importType === "guest" && (
          <div
            style={{
              marginBottom: "2rem",
              padding: "1.25rem 1.5rem",
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.06) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              borderRadius: "12px"
            }}
          >
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "var(--text)" }}>
              📋 嘉賓匯入步驟 Reminder
            </h3>
            <ol style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: 2, color: "var(--text-muted)", fontSize: "0.95rem" }}>
              <li><strong>下載 CSV 範本</strong> Download CSV Template</li>
              <li><strong>編輯嘉賓名單與活動日期</strong> Edit guest list and EventDate（須與目標活動開始日期一致 match target event start date）</li>
              <li><strong>將步驟 2 的內容儲存為 CSV 格式</strong> Save work at step 2 as CSV format</li>
              <li><strong>上傳步驟 3 的 CSV 檔案</strong> Upload CSV from step 3</li>
            </ol>
            <p className="hint" style={{ marginTop: "0.75rem", marginBottom: 0, color: "#b91c1c" }}>
              ⚠️ 匯入前請先在管理頁面建立對應日期的活動
            </p>
          </div>
        )}

        <div style={{ marginBottom: "2rem" }}>
          <button className="button" onClick={downloadTemplate} style={{ width: "100%", marginBottom: "1rem" }}>
            📥 下載 CSV 範本
          </button>
          <p className="hint" style={{ textAlign: "center" }}>
            {importType === "member" 
              ? "會員範本包含：name, profession" 
              : "嘉賓範本包含：name, profession, phone, referrer, event_date"}
          </p>
        </div>

        <div
          {...getRootProps()}
          style={{
            border: "2px dashed var(--border-color)",
            borderRadius: "12px",
            padding: "3rem 2rem",
            textAlign: "center",
            cursor: "pointer",
            background: isDragActive ? "rgba(59, 130, 246, 0.05)" : "var(--card-bg)",
            transition: "all 0.2s"
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📂</div>
          {isDragActive ? (
            <p style={{ fontSize: "1.1rem" }}>放開以上傳 CSV 檔案...</p>
          ) : (
            <>
              <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                拖放 CSV 檔案到此處，或點擊選擇檔案
              </p>
              <p className="hint">支援 .csv 格式</p>
            </>
          )}
        </div>

        {importData.length > 0 && (
          <div style={{ marginTop: "2rem", padding: "1.5rem", background: "var(--card-bg)", borderRadius: "12px" }}>
            <h3 style={{ marginTop: 0 }}>預覽資料</h3>
            <p className="hint">準備匯入 {importData.length} 筆資料</p>

            {errors.length > 0 && (
              <div style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                maxHeight: "150px",
                overflow: "auto"
              }}>
                <strong style={{ color: "#dc2626" }}>⚠️ 發現 {errors.length} 個錯誤：</strong>
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem", color: "#dc2626" }}>
                  {errors.slice(0, 10).map((error, i) => (
                    <li key={i} style={{ fontSize: "0.875rem" }}>{error}</li>
                  ))}
                  {errors.length > 10 && (
                    <li style={{ fontSize: "0.875rem" }}>... 還有 {errors.length - 10} 個錯誤</li>
                  )}
                </ul>
              </div>
            )}

            <div style={{ marginTop: "1rem", maxHeight: "300px", overflow: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "2px solid var(--border-color)" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>#</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>姓名</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>
                      {importType === "member" ? "專業領域" : "專業"}
                    </th>
                    {importType === "guest" && (
                      <>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>邀請人</th>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>活動日期</th>
                      </>
                    )}
                    {importType === "member" && (
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>狀態</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 10).map((row, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "0.5rem" }}>{index + 1}</td>
                      <td style={{ padding: "0.5rem" }}>{row.name}</td>
                      <td style={{ padding: "0.5rem" }}>{row.profession}</td>
                      {importType === "guest" && (
                        <>
                          <td style={{ padding: "0.5rem" }}>{row.referrer || "-"}</td>
                          <td style={{ padding: "0.5rem" }}>{row.eventDate || "-"}</td>
                        </>
                      )}
                      {importType === "member" && (
                        <td style={{ padding: "0.5rem" }}>{row.standing || "GREEN"}</td>
                      )}
                    </tr>
                  ))}
                  {importData.length > 10 && (
                    <tr>
                      <td colSpan={importType === "guest" ? 6 : 5} style={{ padding: "0.5rem", textAlign: "center", fontStyle: "italic" }}>
                        ... 還有 {importData.length - 10} 筆資料
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="button submit-button"
              onClick={handleBulkImport}
              disabled={errors.length > 0 || isImporting}
              style={{ marginTop: "1.5rem", width: "100%" }}
            >
              {isImporting ? "⏳ 匯入中..." : `🚀 開始匯入 ${importData.length} 筆資料`}
            </button>
          </div>
        )}
      </section>

      <footer className="site-footer">
        <p>
          Powered by{" "}
          <a href="https://innovatexp.co" target="_blank" rel="noopener noreferrer">
            InnovateXP Limited
          </a>
        </p>
      </footer>
    </div>
  );
}
