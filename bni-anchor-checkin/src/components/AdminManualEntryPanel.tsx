import { memo, useState, useEffect, useCallback, useMemo } from "react";
import {
  checkIn,
  createGuest,
  createObserver,
  getMembers,
  getGuests,
  getObservers,
  getCurrentEvent,
  logAttendance,
  MemberInfo,
  GuestInfo,
  ObserverInfo,
  AttendeeRole,
  type EventData,
} from "../api";

type AdminManualEntryPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

type AttendeeKind = "member" | "guest" | "observer";
type GuestRole = "GUEST" | "VIP" | "SPEAKER";

type BatchPerson = {
  name: string;
  domain: string;
  type: AttendeeKind;
  referrer?: string;
  id?: number;
};

type BatchRowPerson = BatchPerson & {
  key: string;
  attended?: boolean;
};

const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const personKey = (type: AttendeeKind, name: string) => `${type}:${name}`;

const CATEGORY_LABELS: Record<AttendeeKind, { emoji: string; label: string }> = {
  member: { emoji: "👤", label: "會員" },
  guest: { emoji: "🎫", label: "嘉賓" },
  observer: { emoji: "👁️", label: "觀察員" },
};

const BatchPersonRow = memo(function BatchPersonRow({
  person,
  selected,
  onToggle,
}: {
  person: BatchRowPerson;
  selected: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <label
      className={`batch-member-item batch-member-item--${person.type} ${selected ? "selected" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(person.key)}
        aria-label={`${person.name} ${selected ? "已選" : "未選"}`}
      />
      <div className="member-info">
        <span className="member-name">
          <span className="batch-row-type-badge" aria-hidden="true">
            {CATEGORY_LABELS[person.type].emoji}
          </span>
          {person.name}
        </span>
        <span className="member-domain">{person.domain}</span>
        {person.type === "guest" && person.referrer && (
          <span className="hint batch-item-meta">邀請人: {person.referrer}</span>
        )}
        {person.type === "observer" && person.attended && (
          <span className="hint batch-item-meta">已出席</span>
        )}
      </div>
    </label>
  );
});

export const AdminManualEntryPanel = ({ onNotify }: AdminManualEntryPanelProps) => {
  const [mode, setMode] = useState<"single" | "batch">("batch");
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [observers, setObservers] = useState<ObserverInfo[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [batchList, setBatchList] = useState<BatchPerson[]>([]);
  const [visibleTypes, setVisibleTypes] = useState<Set<AttendeeKind>>(
    () => new Set<AttendeeKind>(["member", "guest", "observer"])
  );
  const [singleType, setSingleType] = useState<AttendeeKind>("guest");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [walkInCheckIn, setWalkInCheckIn] = useState(true);
  const [guestRole, setGuestRole] = useState<GuestRole>("GUEST");
  const [referrer, setReferrer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customTime, setCustomTime] = useState(formatDateTimeLocal(new Date()));
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [noCurrentEvent, setNoCurrentEvent] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const reloadLists = useCallback(async () => {
    try {
      setListLoading(true);
      const ev = await getCurrentEvent();
      setCurrentEvent(ev ?? null);
      const eventDate = ev?.date ?? "";
      setNoCurrentEvent(!eventDate);

      const membersData = await getMembers();
      const guestList = eventDate ? (await getGuests(eventDate)).guests ?? [] : [];
      const observerList = eventDate ? (await getObservers(eventDate)).observers ?? [] : [];

      setMembers(membersData.members);
      setGuests(guestList);
      setObservers(observerList);

      setBatchList([
        ...membersData.members.map((m) => ({
          name: m.name,
          domain: m.domain,
          type: "member" as const,
        })),
        ...guestList.map((g) => ({
          name: g.name,
          domain: g.profession,
          type: "guest" as const,
          referrer: g.referrer,
        })),
        ...observerList.map((o) => ({
          name: o.name,
          domain: o.profession,
          type: "observer" as const,
          id: o.id,
        })),
      ]);
    } catch {
      onNotify("無法載入名單", "error");
      setNoCurrentEvent(true);
      setCurrentEvent(null);
    } finally {
      setLoadingEvent(false);
      setListLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void reloadLists();
  }, [reloadLists]);

  useEffect(() => {
    if (mode === "batch") {
      void reloadLists();
    }
  }, [mode, reloadLists]);

  useEffect(() => {
    setGuestRole("GUEST");
    setReferrer("");
    setWalkInCheckIn(true);
  }, [singleType]);

  const eventDate = currentEvent?.date ?? "";

  const visiblePeople = useMemo((): BatchRowPerson[] => {
    const rows: BatchRowPerson[] = [];
    if (visibleTypes.has("member")) {
      for (const member of members) {
        rows.push({
          name: member.name,
          domain: member.domain,
          type: "member",
          key: personKey("member", member.name),
        });
      }
    }
    if (visibleTypes.has("guest")) {
      for (const guest of guests) {
        rows.push({
          name: guest.name,
          domain: guest.profession,
          type: "guest",
          referrer: guest.referrer,
          key: personKey("guest", guest.name),
        });
      }
    }
    if (visibleTypes.has("observer")) {
      for (const observer of observers) {
        rows.push({
          name: observer.name,
          domain: observer.profession,
          type: "observer",
          id: observer.id,
          attended: observer.attended,
          key: personKey("observer", observer.name),
        });
      }
    }
    return rows;
  }, [visibleTypes, members, guests, observers]);

  const pageSelectedCount = useMemo(
    () => visiblePeople.filter((p) => selectedPeople.has(p.key)).length,
    [visiblePeople, selectedPeople]
  );

  const showCheckInTime = visibleTypes.has("member") || visibleTypes.has("guest");
  const onlyObserversVisible =
    visibleTypes.has("observer") && !visibleTypes.has("member") && !visibleTypes.has("guest");

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
    if (!eventDate) {
      onNotify("尚未設定當前活動", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedTime = new Date(customTime);
      const timeString = `${selectedTime.getFullYear()}-${String(selectedTime.getMonth() + 1).padStart(2, "0")}-${String(selectedTime.getDate()).padStart(2, "0")}T${String(selectedTime.getHours()).padStart(2, "0")}:${String(selectedTime.getMinutes()).padStart(2, "0")}:${String(selectedTime.getSeconds()).padStart(2, "0")}`;

      if (singleType === "observer") {
        if (!walkInCheckIn) {
          await createObserver({ name: submitName, profession: submitDomain, eventDate });
          onNotify(`✅ ${submitName} (觀察員) 已加入名單（未標記出席）`, "success");
        } else {
          await createObserver({ name: submitName, profession: submitDomain, eventDate });
          const obs = (await getObservers(eventDate)).observers?.find(
            (o) => o.name.toLowerCase() === submitName.toLowerCase()
          );
          await logAttendance(
            obs?.id ?? null,
            "observer",
            submitName,
            submitDomain,
            eventDate,
            "",
            "present"
          );
          onNotify(`✅ ${submitName} (觀察員) 已標記出席`, "success");
        }
        setName("");
        setDomain("");
        setWalkInCheckIn(true);
        void reloadLists();
        return;
      }

      if (singleType === "guest" && !walkInCheckIn) {
        const createResult = await createGuest({
          name: submitName,
          profession: submitDomain,
          referrer: referrer.trim() ? referrer.trim() : undefined,
          eventDate,
        });
        if (createResult.status !== "success") {
          throw new Error(createResult.message);
        }
        onNotify(`✅ ${submitName} (嘉賓) 已加入名單（未簽到）`, "success");
        setName("");
        setDomain("");
        setGuestRole("GUEST");
        setReferrer("");
        setWalkInCheckIn(true);
        setCustomTime(formatDateTimeLocal(new Date()));
        void reloadLists();
        return;
      }

      const result = await checkIn({
        name: submitName,
        type: singleType === "guest" ? "guest" : "member",
        domain: submitDomain,
        currentTime: timeString,
        role: singleType === "guest" ? (guestRole as AttendeeRole) : "MEMBER",
        referrer: singleType === "guest" && referrer.trim() ? referrer.trim() : undefined,
      });

      if (result.status === "success") {
        const typeLabel =
          singleType === "guest"
            ? guestRole === "VIP"
              ? " (VIP嘉賓)"
              : guestRole === "SPEAKER"
                ? " (講者)"
                : " (嘉賓)"
            : " (會員)";
        onNotify(`✅ ${submitName}${typeLabel} 簽到成功！`, "success");
        setName("");
        setDomain("");
        setGuestRole("GUEST");
        setReferrer("");
        setWalkInCheckIn(true);
        setCustomTime(formatDateTimeLocal(new Date()));
        void reloadLists();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      let message = "處理失敗";
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

  const togglePersonSelection = useCallback((key: string) => {
    setSelectedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleVisibleType = (type: AttendeeKind) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const clearAllSelections = () => {
    setSelectedPeople(new Set());
  };

  const handleBatchCheckIn = async () => {
    if (selectedPeople.size === 0) {
      onNotify("請至少選擇一位", "error");
      return;
    }
    if (!eventDate) {
      onNotify("尚未設定當前活動", "error");
      return;
    }

    setBatchSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    const selectedTime = new Date(customTime);
    const timeString = `${selectedTime.getFullYear()}-${String(selectedTime.getMonth() + 1).padStart(2, "0")}-${String(selectedTime.getDate()).padStart(2, "0")}T${String(selectedTime.getHours()).padStart(2, "0")}:${String(selectedTime.getMinutes()).padStart(2, "0")}:${String(selectedTime.getSeconds()).padStart(2, "0")}`;

    for (const key of selectedPeople) {
      try {
        const [type, ...nameParts] = key.split(":");
        const personName = nameParts.join(":");
        const person = batchList.find((p) => p.name === personName && p.type === type);
        if (!person) continue;

        if (person.type === "observer") {
          await logAttendance(
            person.id ?? null,
            "observer",
            personName,
            person.domain,
            eventDate,
            "",
            "present"
          );
        } else {
          await checkIn({
            name: personName,
            type: person.type,
            domain: person.domain,
            currentTime: timeString,
            role: person.type === "member" ? "MEMBER" : "GUEST",
            referrer: person.referrer,
          });
        }
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBatchSubmitting(false);
    clearAllSelections();
    void reloadLists();

    if (failCount === 0) {
      onNotify(`✅ 批量處理成功！已完成 ${successCount} 位`, "success");
    } else {
      onNotify(`⚠️ 批量處理完成：成功 ${successCount} 位，失敗 ${failCount} 位`, "info");
    }
  };

  const renderBatchList = () => {
    if (listLoading) {
      return (
        <div className="empty-state">
          <p className="hint">載入中...</p>
        </div>
      );
    }

    if (visiblePeople.length === 0) {
      return (
        <div className="empty-state">
          <p className="hint">所選類別暫無名單，請勾選其他類型或重新載入</p>
        </div>
      );
    }

    return visiblePeople.map((person) => (
      <BatchPersonRow
        key={person.key}
        person={person}
        selected={selectedPeople.has(person.key)}
        onToggle={togglePersonSelection}
      />
    ));
  };

  if (!loadingEvent && noCurrentEvent) {
    return (
      <section className="section manual-entry-panel">
        <div className="manual-entry-no-event">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#b91c1c" }}>尚未建立活動</h3>
          <p style={{ margin: "0 0 1rem 0", color: "#991b1b" }}>
            請先在「📅 活動管理」建立活動後，再進行手動簽到。
          </p>
        </div>
      </section>
    );
  }

  const memberCount = members.length;
  const guestCount = guests.length;
  const observerCount = observers.length;

  return (
    <section className={`section manual-entry-panel ${mode === "batch" ? "manual-entry-panel--batch" : ""}`}>
      <div className="section-header">
        <h2>✍️ 管理員手動輸入</h2>
        <p className="hint">
          直接新增簽到記錄
          {currentEvent?.date ? `（當前活動：${currentEvent.name} · ${currentEvent.date}）` : ""}
        </p>
      </div>

      <div className="mode-toggle-group">
        <button type="button" className={`mode-toggle-btn ${mode === "single" ? "active" : ""}`} onClick={() => setMode("single")}>
          單筆輸入
        </button>
        <button type="button" className={`mode-toggle-btn ${mode === "batch" ? "active" : ""}`} onClick={() => setMode("batch")}>
          批量輸入
        </button>
      </div>

      {mode === "single" ? (
        <>
          <div className="checkin-type-selector manual-entry-type-selector" role="radiogroup" aria-label="簽到類型">
            <label className={`radio-button ${singleType === "member" ? "is-checked-member" : ""}`}>
              <input type="radio" name="single-type" value="member" checked={singleType === "member"} onChange={() => setSingleType("member")} />
              <span className="radio-label">會員 Member</span>
            </label>
            <label className={`radio-button ${singleType === "guest" ? "is-checked-guest" : ""}`}>
              <input type="radio" name="single-type" value="guest" checked={singleType === "guest"} onChange={() => setSingleType("guest")} />
              <span className="radio-label">嘉賓 Guest</span>
            </label>
            <label className={`radio-button ${singleType === "observer" ? "is-checked-observer" : ""}`}>
              <input type="radio" name="single-type" value="observer" checked={singleType === "observer"} onChange={() => setSingleType("observer")} />
              <span className="radio-label">觀察員 Observer</span>
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="admin-name">姓名 Name *</label>
            <input id="admin-name" className="input-field" placeholder="請輸入姓名..." value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>

          <div className="form-group">
            <label htmlFor="admin-domain">專業領域 Domain *</label>
            <input id="admin-domain" className="input-field" placeholder="例如: 網頁設計、會計服務..." value={domain} onChange={(e) => setDomain(e.target.value)} autoComplete="off" />
          </div>

          {singleType === "guest" && (
            <>
              <div className="form-group">
                <label>嘉賓身份 Role</label>
                <div className="role-selector">
                  <button type="button" className={`role-option ${guestRole === "GUEST" ? "active" : ""}`} onClick={() => setGuestRole("GUEST")}>👤 一般</button>
                  <button type="button" className={`role-option vip ${guestRole === "VIP" ? "active" : ""}`} onClick={() => setGuestRole("VIP")}>⭐ VIP</button>
                  <button type="button" className={`role-option speaker ${guestRole === "SPEAKER" ? "active" : ""}`} onClick={() => setGuestRole("SPEAKER")}>🎤 講者</button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="admin-referrer">邀請人 (選填)</label>
                <input id="admin-referrer" className="input-field" placeholder="邀請此來賓的會員..." value={referrer} onChange={(e) => setReferrer(e.target.value)} autoComplete="off" />
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={walkInCheckIn} onChange={(e) => setWalkInCheckIn(e.target.checked)} />
                  <span className="checkbox-text">🚶 Walk-in（即時簽到）</span>
                </label>
                <p className="hint">{walkInCheckIn ? "ON：新增後即時簽到" : "OFF：只加入嘉賓名單，不簽到"}</p>
              </div>
            </>
          )}

          {singleType === "observer" && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={walkInCheckIn} onChange={(e) => setWalkInCheckIn(e.target.checked)} />
                <span className="checkbox-text">✅ 標記出席 Mark attendance</span>
              </label>
              <p className="hint">
                {walkInCheckIn ? "ON：加入名單並標記出席（不記錄時間）" : "OFF：只加入觀察員名單，不標記出席"}
              </p>
            </div>
          )}

          {singleType !== "observer" && (
            <div className="form-group">
              <label htmlFor="admin-time">簽到時間 (選填)</label>
              <input id="admin-time" className="input-field" type="datetime-local" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
            </div>
          )}

          <button
            className="button submit-button"
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !domain.trim() || isSubmitting}
          >
            {isSubmitting
              ? "處理中..."
              : singleType === "observer"
                ? walkInCheckIn
                  ? "✅ 確認標記出席"
                  : "✅ 確認加入名單"
                : singleType === "guest" && !walkInCheckIn
                  ? "✅ 確認加入名單"
                  : "✅ 確認簽到"}
          </button>
        </>
      ) : (
        <div className="manual-entry-batch-layout">
          <div className="manual-entry-batch-scroll">
            <div
              className="batch-type-filter-row"
              role="group"
              aria-label="顯示名單類型"
            >
              {(["member", "guest", "observer"] as const).map((type) => {
                const meta = CATEGORY_LABELS[type];
                const count = type === "member" ? memberCount : type === "guest" ? guestCount : observerCount;
                return (
                  <label
                    key={type}
                    className={`batch-type-filter-chip batch-type-filter-chip--${type} ${visibleTypes.has(type) ? "is-on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={visibleTypes.has(type)}
                      onChange={() => toggleVisibleType(type)}
                    />
                    <span className="batch-type-filter-label">
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="batch-type-count">{count}</span>
                  </label>
                );
              })}
            </div>

            {showCheckInTime && (
              <div className="form-group">
                <label htmlFor="batch-time">簽到時間 Check-in Time</label>
                <input id="batch-time" type="datetime-local" className="input-field" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
              </div>
            )}

            {onlyObserversVisible && (
              <p className="hint manual-entry-observer-note">觀察員批量操作只標記出席，不記錄簽到時間。</p>
            )}

            <div className="batch-controls manual-entry-batch-controls">
              <button type="button" className="ghost-button" onClick={clearAllSelections} disabled={selectedPeople.size === 0}>✕ 清除選項</button>
              <button type="button" className="ghost-button" onClick={() => void reloadLists()} disabled={listLoading}>🔄 重新載入</button>
            </div>

            <div className="selection-count manual-entry-selection-count">
              已選 <strong>{selectedPeople.size}</strong> 位
              {" · "}
              此頁 {pageSelectedCount}/{visiblePeople.length}
              {" · "}
              會員 {memberCount} / 嘉賓 {guestCount} / 觀察員 {observerCount}
            </div>

            <div className="manual-entry-batch-list-wrap">
              <div className="batch-member-list manual-entry-batch-list">{renderBatchList()}</div>
            </div>
          </div>

          <div className="manual-entry-batch-sticky">
            <button
              className="button submit-button manual-entry-batch-submit"
              type="button"
              onClick={handleBatchCheckIn}
              disabled={selectedPeople.size === 0 || batchSubmitting}
            >
              {batchSubmitting ? "批量處理中..." : `✅ 批量簽到 / 標記出席 (${selectedPeople.size} 位)`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
