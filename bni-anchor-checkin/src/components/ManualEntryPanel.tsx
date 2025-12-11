import { useState, useEffect } from "react";
import { checkIn, getMembers, MemberInfo } from "../api";

type ManualEntryPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export const ManualEntryPanel = ({ onNotify }: ManualEntryPanelProps) => {
  const [name, setName] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await getMembers();
        setMembers(data.members);
      } catch {
        // Members list is optional, fail silently
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    if (name.trim().length >= 2 && members.length > 0) {
      const filtered = members.filter((m) =>
        m.name.toLowerCase().includes(name.toLowerCase())
      );
      setFilteredMembers(filtered.slice(0, 5));
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredMembers([]);
      setShowSuggestions(false);
    }
  }, [name, members]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      onNotify("請輸入姓名", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const result = await checkIn({
        name: name.trim(),
        type: isExternal ? "guest" : "member",
        currentTime
      });

      if (result.status === "success") {
        onNotify(`✅ ${name} 簽到成功！`, "success");
        setName("");
        setIsExternal(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "簽到失敗";
      onNotify(`❌ ${message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectMember = (memberName: string) => {
    setName(memberName);
    setShowSuggestions(false);
    setIsExternal(false);
  };

  const currentTime = new Date().toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  return (
    <section className="section manual-entry-panel">
      <div className="section-header">
        <h2>✍️ 手動簽到</h2>
        <p className="hint">當 QR 掃描不可用時的備用方案</p>
      </div>

      <div className="form-group autocomplete-container">
        <label htmlFor="manual-name">姓名 Name</label>
        <input
          id="manual-name"
          className="input-field"
          placeholder="輸入姓名..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => filteredMembers.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          autoComplete="off"
        />
        {showSuggestions && filteredMembers.length > 0 && (
          <ul className="suggestions-list">
            {filteredMembers.map((member) => (
              <li key={member.name}>
                <button
                  type="button"
                  className="suggestion-item"
                  onClick={() => handleSelectMember(member.name)}
                >
                  👤 {member.name} - {member.domain}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isExternal}
            onChange={(e) => setIsExternal(e.target.checked)}
          />
          <span className="checkbox-text">外部來賓 External Guest</span>
        </label>
      </div>

      <div className="form-group">
        <label>簽到時間 Check-in Time</label>
        <div className="time-display">
          🕐 {currentTime}
        </div>
        <p className="hint">系統將自動記錄當前時間</p>
      </div>

      <div className="preview-card">
        <h4>📋 簽到預覽</h4>
        <div className="preview-row">
          <span className="preview-label">姓名:</span>
          <span className="preview-value">{name || "—"}</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">類型:</span>
          <span className={`type-badge ${isExternal ? "guest" : "member"}`}>
            {isExternal ? "🎫 來賓" : "👤 會員"}
          </span>
        </div>
      </div>

      <button
        className="button submit-button"
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || isSubmitting}
      >
        {isSubmitting ? "處理中..." : "✅ 確認簽到"}
      </button>

      <div className="tips-section">
        <h4>💡 使用提示</h4>
        <ul className="tips-list">
          <li>輸入姓名時會自動顯示會員建議</li>
          <li>勾選「外部來賓」標記非會員訪客</li>
          <li>簽到成功後會即時同步到記錄</li>
        </ul>
      </div>
    </section>
  );
};
