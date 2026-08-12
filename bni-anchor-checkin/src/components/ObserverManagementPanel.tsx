import { useState, useEffect, useCallback } from "react";
import {
  getObservers,
  ObserverInfo,
  deleteObserver,
  updateObserver,
  createObserver,
  exportObservers,
  getCurrentEvent,
} from "../api";
import { useChapter } from "../chapterContext";

type ObserverManagementPanelProps = {
  onChanged?: () => void;
};

export function ObserverManagementPanel({ onChanged }: ObserverManagementPanelProps) {
  const { chapterTag, chapterId } = useChapter();
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
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchObservers = useCallback(async () => {
    try {
      const data = await getObservers(undefined, chapterTag);
      setObservers(data.observers || []);
    } catch {
      showNotification("無法載入觀察員列表", "error");
    } finally {
      setLoading(false);
    }
  }, [chapterTag]);

  useEffect(() => {
    void fetchObservers();
    void getCurrentEvent(chapterTag, chapterId)
      .then((evt) => {
        if (evt?.date) {
          setCurrentEventDate(evt.date);
          setNewEventDate(evt.date);
        }
      })
      .catch(() => {});
  }, [fetchObservers, chapterTag, chapterId]);

  const eventDates = Array.from(
    new Set(observers.map((o) => o.eventDate).filter(Boolean))
  ).sort().reverse();

  const filteredObservers =
    selectedEventDate === "all"
      ? observers
      : observers.filter((o) => o.eventDate === selectedEventDate);

  const exportDate =
    selectedEventDate !== "all" ? selectedEventDate : currentEventDate;

  const attendedCount = filteredObservers.filter((o) => o.attended).length;

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
      onChanged?.();
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
      onChanged?.();
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
      onChanged?.();
    } catch {
      showNotification("刪除失敗", "error");
    }
  };

  return (
    <section className="section" id="observer-management">
      {notification && (
        <p
          className="hint"
          style={{
            color: notification.type === "error" ? "#dc2626" : "#15803d",
            marginBottom: "1rem",
          }}
        >
          {notification.message}
        </p>
      )}

      <div className="section-header">
        <h2>👁️ 觀察員管理</h2>
        <p className="hint">
          管理當日活動觀察員名單；簽到頁可標記出席（不記錄簽到時間）。CSV 匯入請使用上方「匯入觀察員」或 WhatsApp 訊息匯入。
        </p>
      </div>

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
          onClick={() => void handleExport()}
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
              <button type="button" className="button" onClick={() => void handleAdd()}>
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
          暫無觀察員資料。請使用上方 CSV 或 WhatsApp 匯入，或手動新增。
        </p>
      )}

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
    </section>
  );
}
