import { useState, useEffect, useCallback } from "react";
import {
  getPlannedSubstitutes,
  bulkSetPlannedSubstitutes,
  updateAttendanceSubstitute,
  getCurrentEvent,
  type PlannedSubstitute,
} from "../api";
import { useChapter } from "../chapterContext";

type SubstituteManagementPanelProps = {
  onChanged?: () => void;
};

export function SubstituteManagementPanel({ onChanged }: SubstituteManagementPanelProps) {
  const { chapterTag, chapterId } = useChapter();
  const [substitutes, setSubstitutes] = useState<PlannedSubstitute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventDate, setSelectedEventDate] = useState<string>("");
  const [currentEventDate, setCurrentEventDate] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubstituteName, setNewSubstituteName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [editing, setEditing] = useState<PlannedSubstitute | null>(null);
  const [editSubstituteName, setEditSubstituteName] = useState("");
  const [editMemberName, setEditMemberName] = useState("");
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchSubstitutes = useCallback(
    async (eventDate: string) => {
      if (!eventDate) {
        setSubstitutes([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getPlannedSubstitutes(eventDate, chapterTag, chapterId);
        setSubstitutes(data.substitutes ?? []);
      } catch {
        showNotification("無法載入替代人列表", "error");
      } finally {
        setLoading(false);
      }
    },
    [chapterTag, chapterId]
  );

  useEffect(() => {
    void getCurrentEvent(chapterTag, chapterId)
      .then((evt) => {
        if (evt?.date) {
          setCurrentEventDate(evt.date);
          setSelectedEventDate(evt.date);
        }
      })
      .catch(() => {});
  }, [chapterTag, chapterId]);

  useEffect(() => {
    if (selectedEventDate) void fetchSubstitutes(selectedEventDate);
  }, [selectedEventDate, fetchSubstitutes]);

  const handleAdd = async () => {
    const substituteName = newSubstituteName.trim();
    const memberName = newMemberName.trim();
    const eventDate = selectedEventDate || currentEventDate;
    if (!substituteName || !memberName || !eventDate) {
      showNotification("請填寫替代人、會員姓名及活動日期", "error");
      return;
    }
    try {
      await bulkSetPlannedSubstitutes(eventDate, [{ substituteName, memberName }], chapterTag, chapterId);
      showNotification(`已設定 ${substituteName} 替代 ${memberName}`, "success");
      setNewSubstituteName("");
      setNewMemberName("");
      setShowAddForm(false);
      void fetchSubstitutes(eventDate);
      onChanged?.();
    } catch {
      showNotification("新增失敗（請確認會員姓名存在）", "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const eventDate = selectedEventDate || currentEventDate;
    const substituteName = editSubstituteName.trim();
    const memberName = editMemberName.trim();
    if (!substituteName || !memberName || !eventDate) {
      showNotification("請填寫替代人及會員姓名", "error");
      return;
    }
    try {
      if (editing.memberName !== memberName) {
        await updateAttendanceSubstitute(eventDate, editing.memberName, undefined, chapterTag);
      }
      await updateAttendanceSubstitute(eventDate, memberName, substituteName, chapterTag);
      showNotification(`已更新 ${memberName} 的替代人`, "success");
      setEditing(null);
      void fetchSubstitutes(eventDate);
      onChanged?.();
    } catch {
      showNotification("更新失敗", "error");
    }
  };

  const handleDelete = async (entry: PlannedSubstitute) => {
    const eventDate = selectedEventDate || currentEventDate;
    if (!eventDate) return;
    if (!window.confirm(`確定要移除 ${entry.substituteName} 替代 ${entry.memberName} 嗎？`)) return;
    try {
      await updateAttendanceSubstitute(eventDate, entry.memberName, undefined, chapterTag);
      showNotification(`已移除 ${entry.memberName} 的替代人`, "success");
      void fetchSubstitutes(eventDate);
      onChanged?.();
    } catch {
      showNotification("刪除失敗", "error");
    }
  };

  return (
    <section className="section" id="substitute-management">
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
        <h2>🔄 替代人管理</h2>
        <p className="hint">
          預先設定替代人名單（格式：替代人 / 會員，會員可填簡稱如 Zoe）；簽到頁會顯示「Zoe Wu (Wendy Cheung)」。CSV 匯入請使用上方「匯入替代人」或 WhatsApp 訊息匯入。
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
          ➕ 新增替代人
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
          <h3 style={{ marginTop: 0 }}>新增替代人</h3>
          <div style={{ display: "grid", gap: "1rem", maxWidth: "480px" }}>
            <input
              className="input-field"
              placeholder="替代人姓名 Substitute"
              value={newSubstituteName}
              onChange={(e) => setNewSubstituteName(e.target.value)}
            />
            <input
              className="input-field"
              placeholder="被替代會員 Member"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
            />
            <input
              type="date"
              className="input-field"
              value={selectedEventDate || currentEventDate}
              onChange={(e) => setSelectedEventDate(e.target.value)}
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
        <label htmlFor="substitute-event-filter" style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
          活動日期 Event Date
        </label>
        <input
          id="substitute-event-filter"
          type="date"
          className="input-field"
          value={selectedEventDate}
          onChange={(e) => setSelectedEventDate(e.target.value)}
          style={{ width: "100%", maxWidth: "480px" }}
        />
        {selectedEventDate && (
          <p className="hint" style={{ marginTop: "0.75rem" }}>
            共 {substitutes.length} 對替代人
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
                <th style={{ padding: "1rem", textAlign: "left" }}>替代人</th>
                <th style={{ padding: "1rem", textAlign: "left" }}>被替代會員</th>
                <th style={{ padding: "1rem", textAlign: "left" }}>簽到顯示</th>
                <th style={{ padding: "1rem", textAlign: "center" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {substitutes.map((entry) => (
                <tr
                  key={`${entry.substituteName}-${entry.memberName}`}
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <td style={{ padding: "1rem", fontWeight: 500 }}>{entry.substituteName}</td>
                  <td style={{ padding: "1rem" }}>{entry.memberName}</td>
                  <td style={{ padding: "1rem", color: "var(--text-muted)" }}>
                    {entry.memberName} ({entry.substituteName})
                  </td>
                  <td style={{ padding: "1rem", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setEditing(entry);
                          setEditSubstituteName(entry.substituteName);
                          setEditMemberName(entry.memberName);
                        }}
                      >
                        ✏️ 編輯
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleDelete(entry)}
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

      {!loading && substitutes.length === 0 && selectedEventDate && (
        <p className="hint" style={{ textAlign: "center", padding: "2rem" }}>
          此活動暫無替代人。請使用上方 CSV、WhatsApp 匯入，或手動新增。
        </p>
      )}

      {editing && (
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
          onClick={() => setEditing(null)}
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
            <h3 style={{ marginTop: 0 }}>編輯替代人</h3>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="edit-substitute-name">替代人</label>
              <input
                id="edit-substitute-name"
                className="input-field"
                value={editSubstituteName}
                onChange={(e) => setEditSubstituteName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-member-name">被替代會員</label>
              <input
                id="edit-member-name"
                className="input-field"
                value={editMemberName}
                onChange={(e) => setEditMemberName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="ghost-button" onClick={() => setEditing(null)}>
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
