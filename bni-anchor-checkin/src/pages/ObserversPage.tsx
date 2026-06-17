import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import {
  getObservers,
  ObserverInfo,
  deleteObserver,
  updateObserver,
  createObserver,
  exportObservers,
  bulkImportObservers,
  getCurrentEvent,
  ImportRecord,
} from "../api";

type ImportRow = {
  name: string;
  profession: string;
  eventDate: string;
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

export default function ObserversPage() {
  const [observers, setObservers] = useState<ObserverInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventDate, setSelectedEventDate] = useState<string>("all");
  const [currentEventDate, setCurrentEventDate] = useState<string>("");
  const [editingObserver, setEditingObserver] = useState<ObserverInfo | null>(null);
  const [editProfession, setEditProfession] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProfession, setNewProfession] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchObservers = async () => {
    try {
      const data = await getObservers();
      setObservers(data.observers || []);
    } catch {
      showNotification("無法載入觀察員列表", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchObservers();
    void getCurrentEvent()
      .then((evt) => {
        if (evt?.date) {
          setCurrentEventDate(evt.date);
          setNewEventDate(evt.date);
        }
      })
      .catch(() => {});
  }, []);

  const eventDates = Array.from(
    new Set(observers.map((o) => o.eventDate).filter(Boolean))
  ).sort().reverse();

  const filteredObservers =
    selectedEventDate === "all"
      ? observers
      : observers.filter((o) => o.eventDate === selectedEventDate);

  const exportDate =
    selectedEventDate !== "all" ? selectedEventDate : currentEventDate;

  const parseCsvFile = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as Record<string, unknown>[];
        const data: ImportRow[] = rawData.map((row) => ({
          name: pickValue(row, ["name"]),
          profession: pickValue(row, ["profession", "category"]),
          eventDate: normalizeEventDate(pickValue(row, ["event_date", "eventdate"])),
        }));
        const validationErrors: string[] = [];
        data.forEach((row, index) => {
          if (!row.name) validationErrors.push(`第 ${index + 1} 行：缺少姓名 (name)`);
          if (!row.profession) validationErrors.push(`第 ${index + 1} 行：缺少專業領域 (profession)`);
          if (!row.eventDate) validationErrors.push(`第 ${index + 1} 行：缺少活動日期 (event_date)`);
        });
        setImportData(data);
        setImportErrors(validationErrors);
      },
      error: () => showNotification("CSV 解析失敗", "error"),
    });
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) parseCsvFile(file);
    },
    [parseCsvFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  const downloadTemplate = () => {
    const today = currentEventDate || new Date().toISOString().split("T")[0];
    const csvContent =
      "name,profession,event_date\n" +
      `Dr. Amy Chan,Education Consultant,${today}\n` +
      `Mr. Ben Lee,Legal Advisory,${today}\n` +
      `Ms. Clara Wong,HR Training,${today}\n`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "observer-import-template.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    showNotification("已下載觀察員 CSV 範本", "success");
  };

  const handleBulkImport = async () => {
    if (importErrors.length > 0 || importData.length === 0) return;
    setIsImporting(true);
    try {
      const records: ImportRecord[] = importData.map((row) => ({
        name: row.name,
        profession: row.profession,
        eventDate: row.eventDate,
      }));
      const result = await bulkImportObservers(records);
      showNotification(
        `匯入完成：新增 ${result.inserted}、更新 ${result.updated}、失敗 ${result.failed}`,
        result.failed > 0 ? "error" : "success"
      );
      setImportData([]);
      setImportErrors([]);
      void fetchObservers();
    } catch (error) {
      showNotification(
        `匯入失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
        "error"
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    if (!exportDate) {
      showNotification("請先選擇活動日期或設定當前活動", "error");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportObservers(exportDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `observer-attendance-${exportDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification(`已匯出 ${exportDate} 觀察員出席`, "success");
    } catch {
      showNotification("匯出失敗", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    const profession = newProfession.trim();
    if (!name || !profession) {
      showNotification("請填寫姓名及專業領域", "error");
      return;
    }
    try {
      await createObserver({
        name,
        profession,
        eventDate: newEventDate || currentEventDate || undefined,
      });
      showNotification(`已新增觀察員 ${name}`, "success");
      setNewName("");
      setNewProfession("");
      setShowAddForm(false);
      void fetchObservers();
    } catch {
      showNotification("新增失敗", "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingObserver) return;
    try {
      await updateObserver(editingObserver.name, {
        profession: editProfession,
        eventDate: editEventDate || undefined,
      });
      showNotification(`已更新 ${editingObserver.name}`, "success");
      setEditingObserver(null);
      void fetchObservers();
    } catch {
      showNotification("更新失敗", "error");
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`確定要刪除觀察員 ${name} 嗎？`)) return;
    try {
      await deleteObserver(name);
      showNotification(`已刪除 ${name}`, "success");
      void fetchObservers();
    } catch {
      showNotification("刪除失敗", "error");
    }
  };

  const attendedCount = filteredObservers.filter((o) => o.attended).length;

  return (
    <div className="app-shell">
      {notification && (
        <div
          className={`notification notification-${notification.type}`}
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "1rem 1.5rem",
            borderRadius: "8px",
            background:
              notification.type === "success"
                ? "#22c55e"
                : notification.type === "error"
                  ? "#ef4444"
                  : "#3b82f6",
            color: "white",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {notification.message}
        </div>
      )}

      <header className="site-header">
        <div>
          <p className="hint">EventXP for BNI Anchor</p>
          <h1>👁️ EventXP 觀察員管理</h1>
          <p className="hint">Observer Maintenance</p>
        </div>
        <div className="header-meta">
          <Link to="/admin" className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="section-header">
          <h2>觀察員列表</h2>
          <p className="hint">
            管理當日活動觀察員名單；簽到頁可標記出席（不記錄簽到時間）。可匯入／匯出 CSV。
          </p>
        </div>

        <div
          style={{
            marginBottom: "2rem",
            padding: "1.25rem 1.5rem",
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(109, 40, 217, 0.06) 100%)",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>📋 觀察員 CSV 匯入步驟</h3>
          <ol style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: 2, color: "var(--text-muted)", fontSize: "0.95rem" }}>
            <li><strong>下載 CSV 範本</strong> — 欄位：<code>name</code>, <code>profession</code>, <code>event_date</code>（YYYY-MM-DD）</li>
            <li><strong>填寫觀察員名單</strong> — 同一活動日期可有多行；同名同日期會更新專業領域（不會重置出席狀態）</li>
            <li><strong>儲存為 UTF-8 CSV</strong> — 可用 Excel「另存新檔 → CSV UTF-8」</li>
            <li><strong>上傳 CSV 並確認預覽</strong> — 無錯誤後按「開始匯入」</li>
          </ol>
          <p className="hint" style={{ marginTop: "0.75rem", marginBottom: 0, color: "#b91c1c" }}>
            ⚠️ 匯入前請先在管理頁面建立對應日期的活動；<code>event_date</code> 須與該活動開始日期一致。
          </p>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <button type="button" className="button" onClick={downloadTemplate} style={{ width: "100%", marginBottom: "0.75rem" }}>
            📥 下載觀察員 CSV 範本
          </button>
          <p className="hint" style={{ textAlign: "center", margin: 0 }}>
            範例：<code>name,profession,event_date</code>
            {currentEventDate ? ` · 建議使用當前活動日期 ${currentEventDate}` : ""}
          </p>
        </div>

        <div
          {...getRootProps()}
          style={{
            border: "2px dashed var(--border-color)",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            cursor: "pointer",
            background: isDragActive ? "rgba(139, 92, 246, 0.05)" : "var(--card-bg)",
            marginBottom: "2rem",
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📂</div>
          {isDragActive ? (
            <p>放開以上傳 CSV…</p>
          ) : (
            <>
              <p style={{ marginBottom: "0.25rem" }}>拖放 CSV 到此，或點擊選擇檔案</p>
              <p className="hint">支援 .csv</p>
            </>
          )}
        </div>

        {importData.length > 0 && (
          <div
            style={{
              marginBottom: "2rem",
              padding: "1.5rem",
              background: "var(--card-bg)",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>預覽 ({importData.length} 筆)</h3>
            {importErrors.length > 0 && (
              <div style={{ color: "#dc2626", marginBottom: "1rem", fontSize: "0.875rem" }}>
                {importErrors.slice(0, 8).map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </div>
            )}
            <div style={{ maxHeight: "200px", overflow: "auto", marginBottom: "1rem" }}>
              <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>姓名</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>專業</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>活動日期</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 10).map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "0.5rem" }}>{row.name}</td>
                      <td style={{ padding: "0.5rem" }}>{row.profession}</td>
                      <td style={{ padding: "0.5rem" }}>{row.eventDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="button submit-button"
              onClick={() => void handleBulkImport()}
              disabled={importErrors.length > 0 || isImporting}
              style={{ width: "100%" }}
            >
              {isImporting ? "⏳ 匯入中…" : `🚀 開始匯入 ${importData.length} 筆觀察員`}
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1.5rem",
            alignItems: "center",
          }}
        >
          <button type="button" className="button" onClick={() => setShowAddForm((v) => !v)}>
            ➕ 新增觀察員
          </button>
          <button
            type="button"
            className="button"
            onClick={handleExport}
            disabled={exporting || !exportDate}
            style={{ background: "#8b5cf6" }}
          >
            {exporting ? "匯出中…" : `📤 匯出觀察員出席${exportDate ? ` (${exportDate})` : ""}`}
          </button>
        </div>

        {showAddForm && (
          <div
            style={{
              background: "var(--card-bg)",
              padding: "1.5rem",
              borderRadius: "12px",
              marginBottom: "1.5rem",
              border: "1px solid var(--border-color)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>新增觀察員</h3>
            <div style={{ display: "grid", gap: "1rem", maxWidth: "480px" }}>
              <input
                className="input-field"
                placeholder="姓名 Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="input-field"
                placeholder="專業領域 Profession"
                value={newProfession}
                onChange={(e) => setNewProfession(e.target.value)}
              />
              <input
                type="date"
                className="input-field"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="button" onClick={handleAdd}>
                  儲存
                </button>
                <button type="button" className="ghost-button" onClick={() => setShowAddForm(false)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            background: "var(--card-bg)",
            padding: "1.5rem",
            borderRadius: "12px",
            marginBottom: "2rem",
            border: "1px solid var(--border-color)",
          }}
        >
          <label htmlFor="observer-event-filter" style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
            篩選活動 Filter by Event
          </label>
          <select
            id="observer-event-filter"
            className="input-field"
            value={selectedEventDate}
            onChange={(e) => setSelectedEventDate(e.target.value)}
            style={{ width: "100%", maxWidth: "480px" }}
          >
            <option value="all">全部活動 ({observers.length})</option>
            {eventDates.map((date) => (
              <option key={date} value={date}>
                {date} ({observers.filter((o) => o.eventDate === date).length} 位)
              </option>
            ))}
          </select>
          {selectedEventDate !== "all" && (
            <p className="hint" style={{ marginTop: "0.75rem" }}>
              已出席 {attendedCount} / {filteredObservers.length} 位
            </p>
          )}
        </div>

        {loading ? (
          <p style={{ textAlign: "center" }}>載入中...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                  <th style={{ padding: "1rem", textAlign: "left" }}>姓名</th>
                  <th style={{ padding: "1rem", textAlign: "left" }}>專業領域</th>
                  <th style={{ padding: "1rem", textAlign: "left" }}>活動日期</th>
                  <th style={{ padding: "1rem", textAlign: "left" }}>出席</th>
                  <th style={{ padding: "1rem", textAlign: "center" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredObservers.map((observer) => (
                  <tr key={`${observer.id}-${observer.name}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "1rem", fontWeight: 500 }}>{observer.name}</td>
                    <td style={{ padding: "1rem" }}>{observer.profession}</td>
                    <td style={{ padding: "1rem" }}>{observer.eventDate}</td>
                    <td style={{ padding: "1rem" }}>
                      {observer.attended ? (
                        <span style={{ color: "#15803d", fontWeight: 600 }}>✓ 出席</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>缺席</span>
                      )}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            setEditingObserver(observer);
                            setEditProfession(observer.profession);
                            setEditEventDate(observer.eventDate);
                          }}
                        >
                          ✏️ 編輯
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleDelete(observer.name)}
                          style={{ color: "#ef4444", borderColor: "#ef4444" }}
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredObservers.length === 0 && (
          <p className="hint" style={{ textAlign: "center", padding: "2rem" }}>
            暫無觀察員資料。請使用上方 CSV 匯入或手動新增。
          </p>
        )}
      </section>

      {editingObserver && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingObserver(null)}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg)",
              padding: "2rem",
              borderRadius: "12px",
              maxWidth: "500px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>編輯觀察員 - {editingObserver.name}</h3>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="edit-observer-profession">專業領域</label>
              <input
                id="edit-observer-profession"
                className="input-field"
                value={editProfession}
                onChange={(e) => setEditProfession(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-observer-date">活動日期</label>
              <input
                id="edit-observer-date"
                type="date"
                className="input-field"
                value={editEventDate}
                onChange={(e) => setEditEventDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="ghost-button" onClick={() => setEditingObserver(null)}>
                取消
              </button>
              <button type="button" className="button" onClick={() => void handleSaveEdit()}>
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

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
