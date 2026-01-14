import { useState, useEffect } from "react";
import { checkIn, getMembers, MemberInfo, AttendeeRole } from "../api";

type AdminManualEntryPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

// Guest role options
type GuestRole = "GUEST" | "VIP" | "SPEAKER";

// Helper to format date for datetime-local input
const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const AdminManualEntryPanel = ({ onNotify }: AdminManualEntryPanelProps) => {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [guestRole, setGuestRole] = useState<GuestRole>("GUEST");
  const [referrer, setReferrer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customTime, setCustomTime] = useState(formatDateTimeLocal(new Date()));

  // Fetch members list
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await getMembers();
        setMembers(data.members);
      } catch {
        onNotify("無法載入會員名單", "error");
      }
    };
    fetchMembers();
  }, [onNotify]);

  // Update selected member's domain when member changes
  useEffect(() => {
    if (!isGuest && selectedMember) {
      const member = members.find(m => m.name === selectedMember);
      if (member) {
        setDomain(member.domain);
      }
    }
  }, [selectedMember, members, isGuest]);

  // Reset fields when switching between guest and member
  useEffect(() => {
    setSelectedMember("");
    setName("");
    setDomain("");
    setGuestRole("GUEST");
    setReferrer("");
  }, [isGuest]);

  const handleSubmit = async () => {
    const submitName = isGuest ? name.trim() : selectedMember;
    const submitDomain = domain.trim();

    if (!submitName) {
      onNotify(isGuest ? "請輸入姓名" : "請選擇會員", "error");
      return;
    }
    if (!submitDomain) {
      onNotify("請輸入專業領域", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse custom time and format it
      const selectedTime = new Date(customTime);
      const timeString = `${selectedTime.getFullYear()}-${String(selectedTime.getMonth() + 1).padStart(2, '0')}-${String(selectedTime.getDate()).padStart(2, '0')}T${String(selectedTime.getHours()).padStart(2, '0')}:${String(selectedTime.getMinutes()).padStart(2, '0')}:${String(selectedTime.getSeconds()).padStart(2, '0')}`;

      const result = await checkIn({
        name: submitName,
        type: isGuest ? "guest" : "member",
        domain: submitDomain,
        currentTime: timeString,
        role: isGuest ? guestRole as AttendeeRole : "MEMBER",
        referrer: isGuest && referrer.trim() ? referrer.trim() : undefined
      });

      if (result.status === "success") {
        const roleLabel = isGuest ? (guestRole === "VIP" ? " (VIP)" : guestRole === "SPEAKER" ? " (講者)" : "") : "";
        onNotify(`✅ ${submitName}${roleLabel} 簽到成功！`, "success");
        setName("");
        setSelectedMember("");
        setDomain("");
        setIsGuest(false);
        setGuestRole("GUEST");
        setReferrer("");
        setCustomTime(formatDateTimeLocal(new Date()));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      let message = "簽到失敗";
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          message = parsed.message || error.message;
        } catch {
          message = error.message;
        }
      }
      onNotify(`❌ ${message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = isGuest 
    ? (name.trim().length > 0 && domain.trim().length > 0)
    : (selectedMember.length > 0 && domain.trim().length > 0);
  
  const displayName = isGuest ? name : selectedMember;
  const selectedMemberInfo = members.find(m => m.name === selectedMember);

  return (
    <section className="section manual-entry-panel">
      <div className="section-header">
        <h2>✍️ 管理員手動輸入</h2>
        <p className="hint">直接新增簽到記錄</p>
      </div>


      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isGuest}
            onChange={(e) => setIsGuest(e.target.checked)}
          />
          <span className="checkbox-text">🎫 嘉賓 Guest</span>
        </label>
        <p className="hint">勾選表示為嘉賓，否則為會員（下拉選單）</p>
      </div>

      {/* Member dropdown or Guest text input */}
      {isGuest ? (
        <>
          <div className="form-group">
            <label htmlFor="admin-name">姓名 Name *</label>
            <input
              id="admin-name"
              className="input-field"
              placeholder="請輸入嘉賓姓名..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Role Selection for Guests */}
          <div className="form-group">
            <label>嘉賓身份 Role</label>
            <div className="role-selector">
              <button
                type="button"
                className={`role-option ${guestRole === "GUEST" ? "active" : ""}`}
                onClick={() => setGuestRole("GUEST")}
              >
                👤 一般來賓
              </button>
              <button
                type="button"
                className={`role-option vip ${guestRole === "VIP" ? "active" : ""}`}
                onClick={() => setGuestRole("VIP")}
              >
                ⭐ VIP
              </button>
              <button
                type="button"
                className={`role-option speaker ${guestRole === "SPEAKER" ? "active" : ""}`}
                onClick={() => setGuestRole("SPEAKER")}
              >
                🎤 講者
              </button>
            </div>
          </div>

          {/* Referrer for Guests */}
          <div className="form-group">
            <label htmlFor="admin-referrer">邀請人 Referrer (選填)</label>
            <input
              id="admin-referrer"
              className="input-field"
              placeholder="邀請此來賓的會員..."
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              autoComplete="off"
            />
          </div>
        </>
      ) : (
        <div className="form-group">
          <label htmlFor="admin-member-select">選擇會員 Select Member *</label>
          <select
            id="admin-member-select"
            className="select-field"
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
          >
            <option value="">-- 請選擇會員 --</option>
            {members.map((member) => (
              <option key={member.name} value={member.name}>
                {member.name} - {member.domain}
              </option>
            ))}
          </select>
          <p className="hint">共 {members.length} 位會員</p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="admin-domain">專業領域 Domain *</label>
        <input
          id="admin-domain"
          className="input-field"
          placeholder="例如: 網頁設計、會計服務..."
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          autoComplete="off"
          readOnly={!isGuest && !!selectedMember}
          />
        {!isGuest && selectedMember && (
          <p className="hint">已自動填入會員的專業領域</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="admin-time">簽到時間 Check-in Time</label>
        <input
          id="admin-time"
          className="input-field"
          type="datetime-local"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
        />
        <p className="hint">可選擇自訂時間，預設為當前時間</p>
      </div>

      <div className={`preview-card ${isGuest && guestRole === "VIP" ? "vip-preview" : isGuest && guestRole === "SPEAKER" ? "speaker-preview" : ""}`}>
        <h4>📋 簽到預覽</h4>
        <div className="preview-row">
          <span className="preview-label">姓名:</span>
          <span className="preview-value">{displayName || "—"}</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">專業領域:</span>
          <span className="preview-value">{domain || "—"}</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">類型:</span>
          <span className={`type-badge ${isGuest ? guestRole.toLowerCase() : "member"}`}>
            {isGuest 
              ? (guestRole === "VIP" ? "⭐ VIP" : guestRole === "SPEAKER" ? "🎤 講者" : "👤 來賓")
              : "👤 會員"}
          </span>
        </div>
        {isGuest && referrer && (
          <div className="preview-row">
            <span className="preview-label">邀請人:</span>
            <span className="preview-value">{referrer}</span>
          </div>
        )}
        <div className="preview-row">
          <span className="preview-label">簽到時間:</span>
          <span className="preview-value">
            {new Date(customTime).toLocaleString("zh-TW")}
          </span>
        </div>
      </div>

      <button
        className="button submit-button"
        type="button"
        onClick={handleSubmit}
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? "處理中..." : "✅ 確認新增"}
      </button>
    </section>
  );
};

