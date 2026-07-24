import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getMembers, MemberInfo, MemberStanding, updateMember, deleteMember, createMember } from "../api";
import { groupMembersByCategory, MEMBER_CATEGORIES, resolveMemberCategoryCode, type MemberCategoryCode } from "../lib/memberCategories";
import { AnchorOnlyNotice } from "../components/AnchorOnlyNotice";
import { ClientAuthGate } from "../components/ClientAuthGate";
import { useChapter } from "../chapterContext";

type MembersPageProps = {};

export default function MembersPage({}: MembersPageProps) {
  return (
    <ClientAuthGate>
      <MembersPageInner />
    </ClientAuthGate>
  );
}

function MembersPageInner() {
  const { chapterTag, adminHref, isClientMode, isAuthenticated, authReady, chapter } = useChapter();
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<MemberInfo | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newStanding, setNewStanding] = useState<MemberStanding>("GREEN");
  const [newProfessionCode, setNewProfessionCode] = useState<MemberCategoryCode>("A");
  const [editDomain, setEditDomain] = useState("");
  const [editName, setEditName] = useState("");
  const [editStanding, setEditStanding] = useState<MemberStanding>("GREEN");
  const [editProfessionCode, setEditProfessionCode] = useState<MemberCategoryCode>("A");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (isClientMode && (!authReady || !isAuthenticated)) return;
    fetchMembers();
  }, [chapterTag, isClientMode, authReady, isAuthenticated]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await getMembers(chapterTag);
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
    setEditName(member.name);
    setEditDomain(member.domain);
    setEditStanding(member.standing || "GREEN");
    const code = resolveMemberCategoryCode(member);
    setEditProfessionCode(code === "OTHER" ? "A" : code);
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      showNotification("請填寫姓名", "error");
      return;
    }

    try {
      await updateMember(
        editingMember.name,
        {
          name: trimmedName,
          profession: editDomain,
          standing: editStanding,
          professionCode: editProfessionCode,
        },
        editingMember.id
      );

      const category = MEMBER_CATEGORIES.find((c) => c.code === editProfessionCode);
      const renamed = trimmedName !== editingMember.name;
      showNotification(
        renamed
          ? `已將 ${editingMember.name} 更名為 ${trimmedName}${category ? `，類別：${category.nameZh}` : ""}`
          : `已更新 ${trimmedName}${category ? `，類別：${category.nameZh}` : ""}`,
        "success"
      );
      setEditingMember(null);
      fetchMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新失敗";
      showNotification(message, "error");
    }
  };

  const handleCreateMember = async () => {
    const name = newName.trim();
    const profession = newDomain.trim();
    if (!name || !profession) {
      showNotification("請填寫姓名和專業領域", "error");
      return;
    }

    try {
      await createMember(
        { name, profession, standing: newStanding, professionCode: newProfessionCode },
        chapterTag
      );
      showNotification(`已新增會員 ${name}`, "success");
      setShowAddMember(false);
      setNewName("");
      setNewDomain("");
      setNewStanding("GREEN");
      setNewProfessionCode("A");
      fetchMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "新增失敗";
      showNotification(message, "error");
    }
  };

  const handleDeleteMember = async (member: MemberInfo) => {
    if (!window.confirm(`確定要刪除會員 ${member.name} 嗎？此操作無法復原！`)) {
      return;
    }

    try {
      await deleteMember(member.name, member.id);
      showNotification(`已刪除 ${member.name}`, "success");
      fetchMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "刪除失敗";
      showNotification(message, "error");
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

  const memberGroups = useMemo(() => groupMembersByCategory(members), [members]);

  const renderCategorySelect = (
    id: string,
    value: MemberCategoryCode,
    onChange: (code: MemberCategoryCode) => void
  ) => (
    <select
      id={id}
      className="input-field members-category-select"
      value={value}
      onChange={(e) => onChange(e.target.value as MemberCategoryCode)}
    >
      {MEMBER_CATEGORIES.map((category) => (
        <option key={category.code} value={category.code}>
          {category.nameEn} · {category.nameZh}
        </option>
      ))}
    </select>
  );

  const renderMemberRow = (member: MemberInfo) => (
    <tr key={member.id ?? member.name} className="members-table-row">
      <td className="members-table-name">{member.name}</td>
      <td className="members-table-domain">{member.domain}</td>
      <td className="members-table-standing">
        <span
          className="members-standing-pill"
          style={{
            background: `${getStandingColor(member.standing)}20`,
            color: getStandingColor(member.standing),
            borderColor: getStandingColor(member.standing),
          }}
        >
          {getStandingLabel(member.standing)}
        </span>
      </td>
      <td className="members-table-actions">
        <div className="members-row-actions">
          <button
            type="button"
            className="ghost-button members-action-btn"
            onClick={() => handleEdit(member)}
          >
            ✏️ 編輯
          </button>
          <button
            type="button"
            className="ghost-button members-action-btn members-action-btn--danger"
            onClick={() => handleDeleteMember(member)}
          >
            🗑️ 刪除
          </button>
        </div>
      </td>
    </tr>
  );

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
          <h1>👥 {isClientMode ? `${chapter?.displayName || chapterTag} 會員管理` : "EventXP for BNI Anchor 會員管理"}</h1>
          <p className="hint">Member Management · chapter={chapterTag}</p>
        </div>
        <div className="header-meta members-page-header-actions">
          <button
            type="button"
            className="button members-add-button"
            onClick={() => setShowAddMember(true)}
          >
            ➕ 新增會員
          </button>
          <Link to={adminHref("/admin")} className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <AnchorOnlyNotice />

      <section className="section members-page-section">
        <div className="section-header members-section-header">
          <div>
            <h2>會員列表</h2>
            <p className="hint">按 BNI 專業類別顯示（與會員名單海報一致）· 共 {members.length} 位</p>
          </div>
        </div>

        <div className="members-toolbar" role="toolbar" aria-label="會員管理操作">
          <button
            type="button"
            className="button members-add-button"
            onClick={() => setShowAddMember(true)}
          >
            ➕ 新增會員
          </button>
          <button
            type="button"
            className="ghost-button"
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
          <div className="members-by-category">
            {memberGroups.map(({ category, members: groupMembers }) => (
              <section
                key={category.code}
                className="member-category-section"
                style={{ "--category-accent": category.accent } as CSSProperties}
              >
                <header className="member-category-header">
                  <div className="member-category-bar" aria-hidden="true" />
                  <div className="member-category-titles">
                    <h3 className="member-category-title-en">{category.nameEn}</h3>
                    <p className="member-category-title-zh">
                      {category.nameZh}
                      <span className="member-category-count"> · {groupMembers.length} 位</span>
                    </p>
                  </div>
                </header>

                <div className="members-table-container">
                  <table className="members-table">
                    <thead>
                      <tr>
                        <th>姓名</th>
                        <th>專業領域</th>
                        <th>狀態</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>{groupMembers.map(renderMemberRow)}</tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        {members.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p className="hint">暫無會員資料</p>
          </div>
        )}
      </section>

      {/* Add Member Modal */}
      {showAddMember && (
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
        }} onClick={() => setShowAddMember(false)}>
          <div className="modal-content" style={{
            background: "var(--bg)",
            padding: "2rem",
            borderRadius: "12px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>新增會員</h3>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="new-name">姓名 Name *</label>
              <input
                id="new-name"
                className="input-field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="請輸入姓名"
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="new-domain">專業領域 Profession *</label>
              <input
                id="new-domain"
                className="input-field"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="例如：會計服務"
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="new-category">專業類別 Profession Category</label>
              {renderCategorySelect("new-category", newProfessionCode, setNewProfessionCode)}
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label>會員狀態 Member Standing</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                {(["GREEN", "YELLOW", "RED", "BLACK"] as MemberStanding[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`role-option ${newStanding === s ? "active" : ""}`}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: newStanding === s ? `2px solid ${getStandingColor(s)}` : "2px solid var(--border-color)",
                      background: newStanding === s ? `${getStandingColor(s)}20` : "transparent",
                      color: newStanding === s ? getStandingColor(s) : "inherit",
                      fontWeight: newStanding === s ? 600 : 400,
                      cursor: "pointer"
                    }}
                    onClick={() => setNewStanding(s)}
                  >
                    {getStandingLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="ghost-button" onClick={() => setShowAddMember(false)}>
                取消
              </button>
              <button className="button" onClick={handleCreateMember}>
                ✅ 新增
              </button>
            </div>
          </div>
        </div>
      )}

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
            <h3 style={{ marginTop: 0 }}>編輯會員</h3>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-name">姓名 Name *</label>
              <input
                id="edit-name"
                className="input-field"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="請輸入姓名"
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-category">專業類別 Profession Category</label>
              {renderCategorySelect("edit-category", editProfessionCode, setEditProfessionCode)}
              <p className="hint" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                轉類別後，會員會移至對應分類列表
              </p>
            </div>

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
