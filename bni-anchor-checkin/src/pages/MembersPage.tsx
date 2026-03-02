import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMembers, MemberInfo, MemberStanding, updateMember, deleteMember } from "../api";

type MembersPageProps = {};

export default function MembersPage({}: MembersPageProps) {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<MemberInfo | null>(null);
  const [editDomain, setEditDomain] = useState("");
  const [editStanding, setEditStanding] = useState<MemberStanding>("GREEN");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const data = await getMembers();
      setMembers(data.members);
    } catch (error) {
      showNotification("無法載入會員列表", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleEdit = (member: MemberInfo) => {
    setEditingMember(member);
    setEditDomain(member.domain);
    setEditStanding(member.standing || "GREEN");
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;

    try {
      await updateMember(editingMember.name, {
        profession: editDomain,
        standing: editStanding
      });

      showNotification(`已更新 ${editingMember.name} 的資料`, "success");
      setEditingMember(null);
      fetchMembers();
    } catch (error) {
      showNotification("更新失敗", "error");
    }
  };

  const handleDeleteMember = async (memberName: string) => {
    if (!window.confirm(`確定要刪除會員 ${memberName} 嗎？此操作無法復原！`)) {
      return;
    }

    try {
      await deleteMember(memberName);
      showNotification(`已刪除 ${memberName}`, "success");
      fetchMembers();
    } catch (error) {
      showNotification("刪除失敗", "error");
    }
  };

  const getStandingColor = (standing?: MemberStanding) => {
    switch (standing) {
      case "GREEN": return "#22c55e";
      case "YELLOW": return "#eab308";
      case "RED": return "#ef4444";
      case "BLACK": return "#1f2937";
      default: return "#94a3b8";
    }
  };

  const getStandingLabel = (standing?: MemberStanding) => {
    switch (standing) {
      case "GREEN": return "🟢 正常";
      case "YELLOW": return "🟡 觀察";
      case "RED": return "🔴 停權";
      case "BLACK": return "⚫ 已離會";
      default: return "⚪ 未設定";
    }
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
          <h1>👥 EventXP for BNI Anchor 會員管理</h1>
          <p className="hint">Member Management</p>
        </div>
        <div className="header-meta">
          <Link to="/admin" className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2>EventXP for BNI Anchor 會員列表</h2>
            <p className="hint">管理會員資料和狀態（從資料庫載入）</p>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => {
              setLoading(true);
              fetchMembers();
            }}
            disabled={loading}
          >
            🔄 重新載入
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>載入中...</p>
          </div>
        ) : (
          <div className="members-table-container" style={{ overflowX: "auto" }}>
            <table className="members-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card-bg)", borderBottom: "2px solid var(--border-color)" }}>
                  <th style={{ padding: "1rem", textAlign: "left" }}>姓名</th>
                  <th style={{ padding: "1rem", textAlign: "left" }}>專業領域</th>
                  <th style={{ padding: "1rem", textAlign: "center" }}>狀態</th>
                  <th style={{ padding: "1rem", textAlign: "center" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.name} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "1rem", fontWeight: 500 }}>{member.name}</td>
                    <td style={{ padding: "1rem" }}>{member.domain}</td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <span style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "12px",
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        background: `${getStandingColor(member.standing)}20`,
                        color: getStandingColor(member.standing),
                        border: `1.5px solid ${getStandingColor(member.standing)}`
                      }}>
                        {getStandingLabel(member.standing)}
                      </span>
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                        <button
                          className="ghost-button"
                          onClick={() => handleEdit(member)}
                          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                        >
                          ✏️ 編輯
                        </button>
                        <button
                          className="ghost-button"
                          onClick={() => handleDeleteMember(member.name)}
                          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", color: "#ef4444", borderColor: "#ef4444" }}
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

        {members.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p className="hint">暫無會員資料</p>
          </div>
        )}
      </section>

      {/* Edit Modal */}
      {editingMember && (
        <div className="modal-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }} onClick={() => setEditingMember(null)}>
          <div className="modal-content" style={{
            background: "var(--bg)",
            padding: "2rem",
            borderRadius: "12px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>編輯會員 - {editingMember.name}</h3>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-domain">專業領域 Profession</label>
              <input
                id="edit-domain"
                className="input-field"
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label>會員狀態 Member Standing</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                {(["GREEN", "YELLOW", "RED", "BLACK"] as MemberStanding[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`role-option ${editStanding === s ? "active" : ""}`}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: editStanding === s ? `2px solid ${getStandingColor(s)}` : "2px solid var(--border-color)",
                      background: editStanding === s ? `${getStandingColor(s)}20` : "transparent",
                      color: editStanding === s ? getStandingColor(s) : "inherit",
                      fontWeight: editStanding === s ? 600 : 400,
                      cursor: "pointer"
                    }}
                    onClick={() => setEditStanding(s)}
                  >
                    {getStandingLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="ghost-button" onClick={() => setEditingMember(null)}>
                取消
              </button>
              <button className="button" onClick={handleSaveEdit}>
                ✅ 儲存
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
