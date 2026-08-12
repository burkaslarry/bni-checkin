import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import {
  bulkImport,
  bulkImportObservers,
  bulkSetPlannedSubstitutes,
  ImportRecord,
  getCurrentEvent,
  activateEvent,
  type EventData,
} from "../api";
import { AnchorOnlyNotice } from "../components/AnchorOnlyNotice";
import { ClientAuthGate } from "../components/ClientAuthGate";
import { WhatsAppMeetingImportPanel } from "../components/WhatsAppMeetingImportPanel";
import { ObserverManagementPanel } from "../components/ObserverManagementPanel";
import { SubstituteManagementPanel } from "../components/SubstituteManagementPanel";
import { useChapter } from "../chapterContext";
import { ensureEventForDate } from "../lib/meetingEventImport";

type ImportType = "member" | "guest" | "observer" | "substitute";

type ImportRow = {
  name: string;
  profession: string;
  chapter?: string;
  email?: string;
  phone?: string;
  referrer?: string;
  standing?: string;
  eventDate?: string;
  membershipId?: string;
  professionCode?: string;
  position?: string;
  substituteName?: string;
  substituteMemberName?: string;
};

const normalizeHeader = (key: string): string =>
  key.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]/g, "_");

const aliasSet = (aliases: string[]) => new Set(aliases.map(normalizeHeader));

const normalizeEventDate = (raw: string): string => {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  return t;
};

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
  return (
    <ClientAuthGate>
      <ImportPageInner />
    </ClientAuthGate>
  );
}

function ImportPageInner() {
  const { chapterTag, chapterId, adminHref, isClientMode, chapter } = useChapter();
  const [searchParams] = useSearchParams();
  const chapterLabel = chapter?.displayName?.replace(/^BNI\s+/i, "") || chapterTag || "Anchor";
  const initialType = searchParams.get("type");
  const [importType, setImportType] = useState<ImportType>(
    initialType === "member" || initialType === "guest" || initialType === "observer" || initialType === "substitute"
      ? initialType
      : "guest"
  );
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [targetEvent, setTargetEvent] = useState<EventData | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [observerPanelKey, setObserverPanelKey] = useState(0);
  const [substitutePanelKey, setSubstitutePanelKey] = useState(0);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const preferredGuestEventDate = targetEvent?.date || "";

  const refreshTargetEvent = useCallback(async () => {
    setEventLoading(true);
    try {
      let current = await getCurrentEvent(chapterTag, chapterId);
      setTargetEvent(current);
    } catch (error) {
      console.error("Failed to load target event:", error);
      setTargetEvent(null);
    } finally {
      setEventLoading(false);
    }
  }, [chapterTag, chapterId, chapterLabel]);

  useEffect(() => {
    refreshTargetEvent();
  }, [refreshTargetEvent]);

  useEffect(() => {
    if (initialType === "observer") {
      const el = document.getElementById("observer-management");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (initialType === "substitute") {
      const el = document.getElementById("substitute-management");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialType]);

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const parseCsvFile = useCallback(
    (file: File) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rawData = results.data as Record<string, unknown>[];
          const data: ImportRow[] = rawData.map((row) => ({
            name: pickValue(row, ["name"]),
            profession: pickValue(row, ["profession", "category"]),
            chapter: pickValue(row, ["chapter"]) || "",
            email: pickValue(row, ["email"]) || "",
            phone: pickValue(row, ["phone", "phone_number", "phonenumber"]) || "",
            referrer: pickValue(row, ["referrer"]),
            standing: pickValue(row, ["standing"]),
            eventDate: pickValue(row, ["event_date", "eventdate"]),
            membershipId: pickValue(row, ["membership_id", "membershipid", "id"]),
            professionCode: pickValue(row, ["profession_code", "professioncode", "code"]),
            position: pickValue(row, ["position", "title"]),
            substituteName: pickValue(row, ["substitute_name", "substitutename", "substitute"]),
            substituteMemberName: pickValue(row, ["member_name", "membername", "member"]),
          }));
          const validationErrors: string[] = [];

          data.forEach((row, index) => {
            if (importType === "substitute") {
              if (!row.substituteName) {
                validationErrors.push(`第 ${index + 1} 行：缺少替代人姓名 (substitute_name)`);
              }
              if (!row.substituteMemberName) {
                validationErrors.push(`第 ${index + 1} 行：缺少會員姓名 (member_name)`);
              }
              const ed = normalizeEventDate((row.eventDate || "").trim());
              if (!ed && !preferredGuestEventDate) {
                validationErrors.push(`第 ${index + 1} 行：缺少活動日期 (event_date)`);
              }
              return;
            }
            if (!row.name) {
              validationErrors.push(`第 ${index + 1} 行：缺少姓名 (Name)`);
            }
            if (!row.profession) {
              validationErrors.push(`第 ${index + 1} 行：缺少專業領域 (profession)`);
            }
            if (importType === "member") {
              if (row.chapter && !/^[a-z][a-z0-9_-]*$/i.test(row.chapter.trim())) {
                validationErrors.push(`第 ${index + 1} 行：無效的 chapter（例如 anchor、amax）`);
              }
              if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
                validationErrors.push(`第 ${index + 1} 行：無效的電郵格式`);
              }
            }
            if (importType === "observer") {
              const ed = normalizeEventDate((row.eventDate || "").trim());
              if (!ed && !preferredGuestEventDate) {
                validationErrors.push(`第 ${index + 1} 行：缺少活動日期 (event_date)`);
              }
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
        },
      });
    },
    [importType, preferredGuestEventDate]
  );

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    parseCsvFile(file);
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
      let eventDateDefault = preferredGuestEventDate;
      if ((importType === "guest" || importType === "observer" || importType === "substitute") && !eventDateDefault) {
        const currentEvent = await getCurrentEvent(chapterTag, chapterId);
        if (currentEvent?.date) eventDateDefault = currentEvent.date;
      }

      if (importType === "guest" || importType === "observer" || importType === "substitute") {
        const eventDates = [
          ...new Set(
            importData
              .map((r) =>
                normalizeEventDate((r.eventDate || eventDateDefault).trim())
              )
              .filter(Boolean)
          ),
        ];

        for (const d of eventDates) {
          const event = await ensureEventForDate(
            normalizeEventDate(d),
            chapterTag,
            chapterId,
            chapterLabel
          );
          if (d === eventDateDefault || d === preferredGuestEventDate) {
            await activateEvent(event.id, true, chapterTag, chapterId);
          }
        }
      }

      if (importType === "substitute") {
        const byDate = new Map<string, { substituteName: string; memberName: string }[]>();
        for (const row of importData) {
          const eventDate = normalizeEventDate((row.eventDate || eventDateDefault).trim());
          if (!eventDate) continue;
          const list = byDate.get(eventDate) ?? [];
          list.push({
            substituteName: (row.substituteName || "").trim(),
            memberName: (row.substituteMemberName || "").trim(),
          });
          byDate.set(eventDate, list);
        }
        let totalUpdated = 0;
        let totalFailed = 0;
        for (const [eventDate, entries] of byDate) {
          await ensureEventForDate(eventDate, chapterTag, chapterId, chapterLabel);
          const result = await bulkSetPlannedSubstitutes(eventDate, entries, chapterTag, chapterId);
          totalUpdated += result.updated;
          totalFailed += result.failed;
        }
        setImportData([]);
        setErrors([]);
        setSubstitutePanelKey((k) => k + 1);
        await refreshTargetEvent();
        showNotification(
          totalFailed === 0
            ? `✅ 替代人匯入：設定 ${totalUpdated} 對`
            : `⚠️ 替代人匯入：設定 ${totalUpdated} 對、失敗 ${totalFailed}`,
          totalFailed === 0 ? "success" : "info"
        );
        return;
      }

      if (importType === "observer") {
        const records: ImportRecord[] = importData.map((row) => ({
          name: row.name,
          profession: row.profession || "",
          eventDate: normalizeEventDate((row.eventDate || eventDateDefault).trim()),
        }));
        const result = await bulkImportObservers(records, chapterTag, chapterId);
        setImportData([]);
        setErrors([]);
        setObserverPanelKey((k) => k + 1);
        await refreshTargetEvent();
        showNotification(
          result.failed === 0
            ? `✅ 觀察員匯入：新增 ${result.inserted}、更新 ${result.updated}`
            : `⚠️ 觀察員匯入：新增 ${result.inserted}、更新 ${result.updated}、失敗 ${result.failed}`,
          result.failed === 0 ? "success" : "info"
        );
        return;
      }

      let guestEventDateDefault = eventDateDefault;
      const records: ImportRecord[] = importData.map((row) => {
        const rawDate =
          (row.eventDate || "").trim() ||
          (importType === "guest" ? guestEventDateDefault : "");
        const eventDate = rawDate ? normalizeEventDate(rawDate) : "";
        return {
          name: row.name,
          profession: row.profession || "",
          chapter: (row.chapter || "").trim() || chapterTag || undefined,
          email: row.email || "",
          phoneNumber: row.phone || "",
          referrer: row.referrer || "",
          standing: row.standing || "GREEN",
          eventDate,
          membershipId: row.membershipId || undefined,
          professionCode: row.professionCode || undefined,
          position: row.position || undefined
        };
      });

      const result = await bulkImport(
        {
          type: importType,
          records
        },
        chapterTag,
        chapterId
      );

      setImportData([]);
      setErrors([]);
      await refreshTargetEvent();

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
    const today = preferredGuestEventDate || new Date().toISOString().split("T")[0];
    let headers: string;
    let sampleRow: string;
    let label: string;

    if (importType === "member") {
      headers = "name,profession,chapter";
      sampleRow = `\nJohn Doe,Software Development,${chapterTag || "anchor"}`;
      label = "會員";
    } else if (importType === "observer") {
      headers = "name,profession,event_date";
      sampleRow = `\nDr. Amy Chan,Education Consultant,${today}`;
      label = "觀察員";
    } else if (importType === "substitute") {
      headers = "substitute_name,member_name,event_date";
      sampleRow = `\nWendy Cheung,Zoe,${today}`;
      label = "替代人";
    } else {
      headers = "name,profession,phone,referrer,event_date";
      sampleRow = `\nJane Smith,Marketing Consultant,87654321,Larry Lo,${today}`;
      label = "嘉賓";
    }

    const csvContent = headers + sampleRow;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${importType}_template.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    showNotification(`已下載${label}範本`, "success");
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
        <p className="hint">{isClientMode ? `EventXP · ${chapter?.displayName || chapterTag}` : "EventXP for BNI Anchor"}</p>
          <h1>📥 批量匯入</h1>
          <p className="hint">
            CSV 匯入會員、嘉賓、觀察員 · chapter={chapterTag} (id={chapterId})
            {importType === "member"
              ? "（會員會寫入此 chapter）"
              : eventLoading
                ? " · 載入活動中…"
                : targetEvent
                  ? ` · 目標活動：${targetEvent.name} (${targetEvent.date})`
                  : preferredGuestEventDate
                    ? ` · 預設活動日期：${preferredGuestEventDate}`
                    : ""}
          </p>
        </div>
        <div className="header-meta">
          <Link to={adminHref("/admin")} className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <AnchorOnlyNotice />

      <section className="section">
        <div className="section-header">
          <h2>CSV 批量匯入</h2>
          <p className="hint">上傳 CSV 檔案以批量新增會員、嘉賓或觀察員</p>
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
            <label className="radio-button">
              <input
                type="radio"
                checked={importType === "observer"}
                onChange={() => {
                  setImportType("observer");
                  setImportData([]);
                  setErrors([]);
                }}
              />
              <span className="radio-label">匯入觀察員 👁️</span>
            </label>
            <label className="radio-button">
              <input
                type="radio"
                checked={importType === "substitute"}
                onChange={() => {
                  setImportType("substitute");
                  setImportData([]);
                  setErrors([]);
                }}
              />
              <span className="radio-label">匯入替代人 🔄</span>
            </label>
          </div>
        </div>

        {(importType === "guest" || importType === "observer" || importType === "substitute") && (
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
              {importType === "guest"
                ? "📋 嘉賓匯入步驟 Reminder"
                : importType === "observer"
                  ? "📋 觀察員 CSV 匯入步驟"
                  : "📋 替代人 CSV 匯入步驟"}
            </h3>
            {importType === "guest" ? (
            <ol style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: 2, color: "var(--text-muted)", fontSize: "0.95rem" }}>
              <li><strong>下載 CSV 範本</strong> Download CSV Template</li>
              <li><strong>編輯嘉賓名單與活動日期</strong> Edit guest list and EventDate（須與目標活動開始日期一致 match target event start date）</li>
              <li><strong>將步驟 2 的內容儲存為 CSV 格式</strong> Save work at step 2 as CSV format</li>
              <li><strong>上傳步驟 3 的 CSV 檔案</strong> Upload CSV from step 3</li>
            </ol>
            ) : importType === "observer" ? (
            <ol style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: 2, color: "var(--text-muted)", fontSize: "0.95rem" }}>
              <li><strong>下載 CSV 範本</strong> — 欄位：<code>name</code>, <code>profession</code>, <code>event_date</code></li>
              <li><strong>填寫觀察員名單</strong> — 同名同日期會更新專業領域（不會重置出席狀態）</li>
              <li><strong>儲存為 UTF-8 CSV</strong> 並上傳</li>
            </ol>
            ) : (
            <ol style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: 2, color: "var(--text-muted)", fontSize: "0.95rem" }}>
              <li><strong>下載 CSV 範本</strong> — 欄位：<code>substitute_name</code>, <code>member_name</code>, <code>event_date</code></li>
              <li><strong>填寫替代人名單</strong> — 格式同 WhatsApp「替代人名單」（替代人 / 被替代會員）</li>
              <li><strong>儲存為 UTF-8 CSV</strong> 並上傳；簽到頁會顯示「Wendy Cheung / Zoe」</li>
            </ol>
            )}
            <p className="hint" style={{ marginTop: "0.75rem", marginBottom: 0, color: "var(--text-muted)" }}>
              匯入時會自動對應 <strong>{chapterTag}</strong> chapter 的活動；空白 event_date 會使用目前活動日期
              {preferredGuestEventDate ? `（${preferredGuestEventDate}）` : ""}。若該日活動不存在會自動建立並設為進行中。
            </p>
          </div>
        )}

        <div style={{ marginBottom: "2rem" }}>
          <button className="button" onClick={downloadTemplate} style={{ width: "100%", marginBottom: "1rem" }}>
            📥 下載 CSV 範本
          </button>
          <p className="hint" style={{ textAlign: "center" }}>
            {importType === "member"
              ? "會員範本：name, profession, chapter（chapter 可留空，預設為目前登入 chapter）"
              : importType === "observer"
                ? "觀察員範本：name, profession, event_date"
                : importType === "substitute"
                  ? "替代人範本：substitute_name, member_name, event_date"
                  : "嘉賓範本：name, profession, phone, referrer, event_date"}
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
                    {importType === "observer" && (
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>活動日期</th>
                    )}
                    {importType === "member" && (
                      <>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>Chapter</th>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>狀態</th>
                      </>
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
                          <td style={{ padding: "0.5rem" }}>{row.eventDate || preferredGuestEventDate || "-"}</td>
                        </>
                      )}
                      {importType === "observer" && (
                        <td style={{ padding: "0.5rem" }}>{row.eventDate || preferredGuestEventDate || "-"}</td>
                      )}
                      {importType === "member" && (
                        <>
                          <td style={{ padding: "0.5rem" }}>{row.chapter || chapterTag || "anchor"}</td>
                          <td style={{ padding: "0.5rem" }}>{row.standing || "GREEN"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {importData.length > 10 && (
                    <tr>
                      <td colSpan={6} style={{ padding: "0.5rem", textAlign: "center", fontStyle: "italic" }}>
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

      <WhatsAppMeetingImportPanel
        chapterTag={chapterTag}
        chapterId={chapterId}
        chapterLabel={chapterLabel}
        onImported={() => {
          void refreshTargetEvent();
          setObserverPanelKey((k) => k + 1);
          setSubstitutePanelKey((k) => k + 1);
        }}
      />

      <SubstituteManagementPanel
        key={substitutePanelKey}
        onChanged={() => setSubstitutePanelKey((k) => k + 1)}
      />

      <ObserverManagementPanel
        key={observerPanelKey}
        onChanged={() => setObserverPanelKey((k) => k + 1)}
      />

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
