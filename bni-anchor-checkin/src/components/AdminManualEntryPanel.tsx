import { useState, useEffect } from "react";
import { checkIn, getMembers, getGuests, getCurrentEvent, MemberInfo, GuestInfo, AttendeeRole, type EventData } from "../api";

type AdminManualEntryPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

// Guest role options
type GuestRole = "GUEST" | "VIP" | "SPEAKER";

// Combined type for batch list
type BatchPerson = {
  name: string;
  domain: string;
  type: "member" | "guest";
  referrer?: string;
};

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
  const [mode, setMode] = useState<"single" | "batch">("batch"); // Default to batch
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [batchList, setBatchList] = useState<BatchPerson[]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [isGuest, setIsGuest] = useState(true); // Default to guest
  const [guestRole, setGuestRole] = useState<GuestRole>("GUEST");
  const [referrer, setReferrer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customTime, setCustomTime] = useState(formatDateTimeLocal(new Date()));
  
  // Batch check-in state
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Event check - must have a current/latest event
  const [noCurrentEvent, setNoCurrentEvent] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);

  // Fetch members and guests list (guests: only for current/latest event date; do not fetch all or past-date guests)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingEvent(true);
        const ev = await getCurrentEvent();
        setCurrentEvent(ev ?? null);
        const eventDate = ev?.date ?? "";
        setNoCurrentEvent(!eventDate);
        const membersData = await getMembers();
        const guestList = eventDate
          ? (await getGuests(eventDate)).guests ?? []
          : [];
        setMembers(membersData.members);
        setGuests(guestList);

        const combined: BatchPerson[] = [
          ...membersData.members.map(m => ({
            name: m.name,
            domain: m.domain,
            type: "member" as const
          })),
          ...guestList.map(g => ({
            name: g.name,
            domain: g.profession,
            type: "guest" as const,
            referrer: g.referrer
          }))
        ];
        setBatchList(combined);
      } catch {
        onNotify("無法載入名單", "error");
        setNoCurrentEvent(true);
        setCurrentEvent(null);
      } finally {
        setLoadingEvent(false);
      }
    };
    fetchData();
  }, [onNotify]);

  // Reset form when switching between guest and member
  useEffect(() => {
    setGuestRole("GUEST");
    setReferrer("");
  }, [isGuest]);

  const handleSubmit = async () => {
    const submitName = name.trim();
    const submitDomain = domain.trim();

    if (!submitName) {
      onNotify("請輸入姓名", "error");
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
        const typeLabel = isGuest ? (guestRole === "VIP" ? " (VIP嘉賓)" : guestRole === "SPEAKER" ? " (講者)" : " (嘉賓)") : " (會員)";
        onNotify(`✅ ${submitName}${typeLabel} 簽到成功！`, "success");
        setName("");
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

  // Batch check-in handlers
  const togglePersonSelection = (personKey: string) => {
    setSelectedPeople(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personKey)) {
        newSet.delete(personKey);
      } else {
        newSet.add(personKey);
      }
      return newSet;
    });
  };

  const selectAllMembers = () => {
    const memberKeys = batchList.filter(p => p.type === "member").map(p => `member:${p.name}`);
    setSelectedPeople(new Set(memberKeys));
  };

  const selectAllGuests = () => {
    const guestKeys = batchList.filter(p => p.type === "guest").map(p => `guest:${p.name}`);
    setSelectedPeople(new Set(guestKeys));
  };

  const selectAll = () => {
    setSelectedPeople(new Set(batchList.map(p => `${p.type}:${p.name}`)));
  };

  const clearAllSelections = () => {
    setSelectedPeople(new Set());
  };

  const handleBatchCheckIn = async () => {
    if (selectedPeople.size === 0) {
      onNotify("請至少選擇一位", "error");
      return;
    }

    setBatchSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    const selectedTime = new Date(customTime);
    const timeString = `${selectedTime.getFullYear()}-${String(selectedTime.getMonth() + 1).padStart(2, '0')}-${String(selectedTime.getDate()).padStart(2, '0')}T${String(selectedTime.getHours()).padStart(2, '0')}:${String(selectedTime.getMinutes()).padStart(2, '0')}:${String(selectedTime.getSeconds()).padStart(2, '0')}`;

    for (const personKey of selectedPeople) {
      try {
        const [type, ...nameParts] = personKey.split(":");
        const personName = nameParts.join(":");
        const person = batchList.find(p => p.name === personName && p.type === type);
        if (!person) continue;

        await checkIn({
          name: personName,
          type: person.type,
          domain: person.domain,
          currentTime: timeString,
          role: person.type === "member" ? "MEMBER" : "GUEST",
          referrer: person.referrer
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBatchSubmitting(false);
    clearAllSelections();
    
    if (failCount === 0) {
      onNotify(`✅ 批量簽到成功！已簽到 ${successCount} 位`, "success");
    } else {
      onNotify(`⚠️ 批量簽到完成：成功 ${successCount} 位，失敗 ${failCount} 位`, "info");
    }
  };

  if (!loadingEvent && noCurrentEvent) {
    return (
      <section className="section manual-entry-panel">
        <div
          style={{
            background: "#fef2f2",
            border: "2px solid #ef4444",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#b91c1c" }}>尚未建立活動</h3>
          <p style={{ margin: "0 0 1rem 0", color: "#991b1b" }}>
            請先在「📅 活動管理」建立活動後，再進行手動簽到。
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#7f1d1d" }}>
            Please ask the organizer to create the event first.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="section manual-entry-panel">
      <div className="section-header">
        <h2>✍️ 管理員手動輸入</h2>
        <p className="hint">
          直接新增簽到記錄
          {currentEvent?.date ? `（最新活動：${currentEvent.name} · ${currentEvent.date}）` : ""}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle-group">
        <button
          type="button"
          className={`mode-toggle-btn ${mode === "single" ? "active" : ""}`}
          onClick={() => setMode("single")}
        >
          單筆簽到
        </button>
        <button
          type="button"
          className={`mode-toggle-btn ${mode === "batch" ? "active" : ""}`}
          onClick={() => setMode("batch")}
        >
          批量簽到
        </button>
      </div>

      {mode === "single" ? (
        <>
          {/* Simple single entry - just name and profession */}
          <div className="form-group">
            <label htmlFor="admin-name">姓名 Name *</label>
            <input
              id="admin-name"
              className="input-field"
              placeholder="請輸入姓名..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-domain">專業領域 Domain *</label>
            <input
              id="admin-domain"
              className="input-field"
              placeholder="例如: 網頁設計、會計服務..."
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              autoComplete="off"
            />
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
            <p className="hint">勾選表示為嘉賓，否則為會員</p>
          </div>

          {isGuest && (
            <>
              {/* Role Selection for Guests */}
              <div className="form-group">
                <label>嘉賓身份 Role</label>
                <div className="role-selector">
                  <button
                    type="button"
                    className={`role-option ${guestRole === "GUEST" ? "active" : ""}`}
                    onClick={() => setGuestRole("GUEST")}
                  >
                    👤 一般
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
                <label htmlFor="admin-referrer">邀請人 (選填)</label>
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
          )}

          <div className="form-group">
            <label htmlFor="admin-time">簽到時間 (選填)</label>
            <input
              id="admin-time"
              className="input-field"
              type="datetime-local"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
            />
          </div>

          <button
            className="button submit-button"
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !domain.trim() || isSubmitting}
          >
            {isSubmitting ? "處理中..." : "✅ 確認新增"}
          </button>
        </>
      ) : (
        <>
          {/* Batch Check-in Mode */}
          <div className="form-group">
            <label htmlFor="batch-time">簽到時間 Check-in Time</label>
            <input
              id="batch-time"
              type="datetime-local"
              className="input-field"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
            />
          </div>

          <div className="batch-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <button type="button" className="ghost-button" onClick={selectAll}>
              ✓ 全選
            </button>
            <button type="button" className="ghost-button" onClick={selectAllMembers}>
              👤 全選會員
            </button>
            <button type="button" className="ghost-button" onClick={selectAllGuests}>
              🎫 全選嘉賓
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={clearAllSelections}
              disabled={selectedPeople.size === 0}
            >
              ✕ 清除
            </button>
          </div>

          <div className="selection-count" style={{ marginBottom: '1rem', padding: '0.5rem', background: 'var(--card-bg)', borderRadius: '8px' }}>
            已選擇 <strong>{selectedPeople.size}</strong> / {batchList.length} 位
            （會員 {batchList.filter(p => p.type === "member").length} 位 + 嘉賓 {batchList.filter(p => p.type === "guest").length} 位）
          </div>

          {/* Two columns: Members and Guests */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Members Column */}
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>👤</span> 會員 Members
                <span className="hint" style={{ fontWeight: 'normal' }}>({members.length})</span>
              </h4>
              <div className="batch-member-list" style={{ maxHeight: '400px', overflow: 'auto' }}>
                {members.length === 0 ? (
                  <div className="empty-state">
                    <p className="hint">載入中...</p>
                  </div>
                ) : (
                  members.map((member) => {
                    const key = `member:${member.name}`;
                    return (
                      <label
                        key={key}
                        className={`batch-member-item ${selectedPeople.has(key) ? "selected" : ""}`}
                        style={{ borderLeft: '3px solid #3b82f6' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPeople.has(key)}
                          onChange={() => togglePersonSelection(key)}
                        />
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="member-domain">{member.domain}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Guests Column */}
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🎫</span> 嘉賓 Guests
                <span className="hint" style={{ fontWeight: 'normal' }}>({guests.length})</span>
              </h4>
              <div className="batch-member-list" style={{ maxHeight: '400px', overflow: 'auto' }}>
                {guests.length === 0 ? (
                  <div className="empty-state">
                    <p className="hint">無嘉賓資料</p>
                  </div>
                ) : (
                  guests.map((guest) => {
                    const key = `guest:${guest.name}`;
                    return (
                      <label
                        key={key}
                        className={`batch-member-item ${selectedPeople.has(key) ? "selected" : ""}`}
                        style={{ borderLeft: '3px solid #22c55e' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPeople.has(key)}
                          onChange={() => togglePersonSelection(key)}
                        />
                        <div className="member-info">
                          <span className="member-name">{guest.name}</span>
                          <span className="member-domain">{guest.profession}</span>
                          {guest.referrer && (
                            <span className="hint" style={{ fontSize: '0.75rem' }}>邀請人: {guest.referrer}</span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <button
            className="button submit-button"
            type="button"
            onClick={handleBatchCheckIn}
            disabled={selectedPeople.size === 0 || batchSubmitting}
            style={{ marginTop: '1rem' }}
          >
            {batchSubmitting ? "批量處理中..." : `✅ 批量簽到 (${selectedPeople.size} 位)`}
          </button>
        </>
      )}
    </section>
  );
};

