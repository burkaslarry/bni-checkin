import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getEventForDate, getMembers, getGuests, getObservers, getCurrentEvent, logAttendance, getReportWebSocketUrl } from "../api";

type CheckinType = "member" | "guest" | "observer";

/** Resolved event for check-in UI: always from backend (current event or 3-day fallback), never from URL. */
type EventSnapshot = { id: number; date: string; name: string };

async function resolveActiveEventForCheckin(): Promise<EventSnapshot | null> {
  const current = await getCurrentEvent();
  if (current?.date) {
    return { id: current.id, date: current.date, name: current.name };
  }
  const base = new Date();
  for (let delta = 0; delta <= 2; delta++) {
    const d = new Date(base);
    d.setDate(base.getDate() + delta);
    const dateStr = d.toISOString().split("T")[0];
    const evt = await getEventForDate(dateStr);
    if (evt) {
      return { id: evt.id, date: dateStr, name: evt.name };
    }
  }
  return null;
}

/** WS payload types → 觸發一次與手動 🔄 相同的同步（後端亦會在嘉賓／當前活動變更時廣播）。 */
const CHECKIN_FORM_WS_TYPES = new Set([
  "attendance_updated",
  "event_created",
  "new_checkin",
  "records_cleared",
  "record_deleted",
  "all_cleared",
  "guest_registry_updated",
  "observer_registry_updated",
  "current_event_changed",
  "member_registry_updated",
]);

type Member = {
  id: number;
  name: string;
  profession: string;
  standing?: string;
};

type Guest = {
  id: number;
  name: string;
  profession: string;
  referrer?: string;
  event_date?: string;
};

type Observer = {
  id: number;
  name: string;
  profession: string;
  event_date?: string;
  attended?: boolean;
};

type CheckinFormPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

/** YYYY-MM-DD in Hong Kong time (matches backend event dates). */
export function getHktDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameCalendarDayAsEvent(eventDate: string, now: Date = new Date()): boolean {
  const normalizedEvent = eventDate.trim().slice(0, 10);
  return getHktDateString(now) === normalizedEvent;
}

export const CheckinFormPanel = ({ onNotify }: CheckinFormPanelProps) => {
  const [checkinType, setCheckinType] = useState<CheckinType>("member");
  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [observers, setObservers] = useState<Observer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [isLoading, setIsLoading] = useState(true); // Show loading until first fetch completes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [noEventForDate, setNoEventForDate] = useState(false);
  const [eventSnapshot, setEventSnapshot] = useState<EventSnapshot | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pushRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkinTypeRef = useRef(checkinType);
  checkinTypeRef.current = checkinType;
  const fetchMembersRef = useRef<() => Promise<void>>(async () => {});
  const fetchGuestsForDateRef = useRef<(d: string) => Promise<void>>(async () => {});
  const fetchObserversForDateRef = useRef<(d: string) => Promise<void>>(async () => {});

  const eventContextKey = eventSnapshot ? `${eventSnapshot.id}:${eventSnapshot.date}` : "";

  // Fetch members from backend (bni-anchor-checkin-backend /api/members)
  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getMembers();
      const mappedMembers = (result.members ?? []).map((m, idx) => ({
        id: typeof m.id === "number" ? m.id : idx + 1,
        name: m.name,
        profession: m.domain ?? "",
        standing: m.standing,
      }));
      setMembers(mappedMembers);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "無法連接後端";
      onNotify(`無法載入會員列表: ${msg}`, "error");
    }
    setIsLoading(false);
  }, [onNotify]);

  const fetchGuestsForDate = useCallback(
    async (forDate: string) => {
      setIsLoading(true);
      try {
        const result = await getGuests(forDate);
        const mappedGuests = (result.guests ?? []).map((g, idx) => ({
          id: idx + 1,
          name: g.name,
          profession: g.profession,
          referrer: g.referrer,
          event_date: g.eventDate,
        }));
        setGuests(mappedGuests);
      } catch {
        onNotify("無法載入嘉賓列表", "error");
      }
      setIsLoading(false);
    },
    [onNotify]
  );

  const fetchObserversForDate = useCallback(
    async (forDate: string) => {
      setIsLoading(true);
      try {
        const result = await getObservers(forDate);
        const mappedObservers = (result.observers ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          profession: o.profession,
          event_date: o.eventDate,
          attended: o.attended,
        }));
        setObservers(mappedObservers);
      } catch {
        onNotify("無法載入觀察員列表", "error");
      }
      setIsLoading(false);
    },
    [onNotify]
  );

  fetchMembersRef.current = () => fetchMembers();
  fetchGuestsForDateRef.current = (d: string) => fetchGuestsForDate(d);
  fetchObserversForDateRef.current = (d: string) => fetchObserversForDate(d);

  const applyResolvedSnapshot = useCallback((snap: EventSnapshot | null) => {
    setEventSnapshot((prev) => {
      if (!snap && !prev) return prev;
      if (snap && prev && snap.id === prev.id && snap.date === prev.date) return prev;
      return snap;
    });
    setNoEventForDate(!snap);
  }, []);

  // First load: resolve event from API only (admin「當前活動」或三日後備)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await resolveActiveEventForCheckin();
        if (cancelled) return;
        applyResolvedSnapshot(snap);
      } catch {
        if (!cancelled) {
          applyResolvedSnapshot(null);
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyResolvedSnapshot]);

  // When current event changes (id/date) or tab switches member/guest: reset selection and reload lists
  useEffect(() => {
    if (hydrating || !eventSnapshot) return;
    if (checkinType === "member") {
      void fetchMembers();
    } else if (checkinType === "guest") {
      void fetchGuestsForDate(eventSnapshot.date);
    } else {
      void fetchObserversForDate(eventSnapshot.date);
    }
    setSelectedId(null);
    setSelectedName("");
    setSearchQuery("");
    setCheckInSuccess(false);
    setAlreadyCheckedIn(false);
  }, [checkinType, eventContextKey, hydrating, eventSnapshot, fetchMembers, fetchGuestsForDate, fetchObserversForDate]);

  const runPushRefresh = useCallback(async () => {
    try {
      const snap = await resolveActiveEventForCheckin();
      applyResolvedSnapshot(snap);
      const ct = checkinTypeRef.current;
      if (ct === "member") void fetchMembersRef.current();
      else if (ct === "guest" && snap?.date) void fetchGuestsForDateRef.current(snap.date);
      else if (ct === "observer" && snap?.date) void fetchObserversForDateRef.current(snap.date);
    } catch {
      applyResolvedSnapshot(null);
    }
  }, [applyResolvedSnapshot]);

  const schedulePushRefresh = useCallback(() => {
    if (pushRefreshDebounceRef.current) clearTimeout(pushRefreshDebounceRef.current);
    pushRefreshDebounceRef.current = setTimeout(() => {
      pushRefreshDebounceRef.current = null;
      void runPushRefresh();
    }, 400);
  }, [runPushRefresh]);

  // WebSocket：嘉賓／當前活動／簽到等變更時，合併為一次刷新（等同手動按 🔄）
  useEffect(() => {
    const ws = new WebSocket(getReportWebSocketUrl());
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type?: string };
        if (!msg.type || !CHECKIN_FORM_WS_TYPES.has(msg.type)) return;
        schedulePushRefresh();
      } catch (_) {}
    };
    wsRef.current = ws;
    return () => {
      if (pushRefreshDebounceRef.current) {
        clearTimeout(pushRefreshDebounceRef.current);
        pushRefreshDebounceRef.current = null;
      }
      ws.close();
    };
  }, [schedulePushRefresh]);

  // Filter list by search query
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (checkinType === "member") {
      return members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.profession.toLowerCase().includes(q)
      );
    }
    if (checkinType === "guest") {
      return guests.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.profession.toLowerCase().includes(q)
      );
    }
    return observers.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.profession.toLowerCase().includes(q)
    );
  }, [checkinType, members, guests, observers, searchQuery]);

  const handleSelect = (id: number, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setCheckInSuccess(false);
    setAlreadyCheckedIn(false);
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedId || !selectedName || !eventSnapshot?.date) return;

    if (checkinType === "guest" && guests.length === 0) {
      onNotify("此活動沒有嘉賓名單，無法簽到", "error");
      return;
    }

    const now = new Date();
    if (!isSameCalendarDayAsEvent(eventSnapshot.date, now)) {
      const todayHkt = getHktDateString(now);
      onNotify(
        `今日 (${todayHkt}) 並非活動日期 (${eventSnapshot.date.slice(0, 10)})，無法簽到`,
        "error"
      );
      return;
    }

    setIsSubmitting(true);

    // Determine on-time vs late (can be enhanced with event cutoff logic)
    const status = "on-time";

    try {
      const selected =
        checkinType === "member"
          ? members.find((m) => m.id === selectedId)
          : checkinType === "guest"
            ? guests.find((g) => g.id === selectedId)
            : observers.find((o) => o.id === selectedId);
      await logAttendance(
        selectedId,
        checkinType,
        selectedName,
        selected?.profession ?? "",
        eventSnapshot.date,
        checkinType === "observer" ? "" : now.toISOString(),
        checkinType === "observer" ? "present" : status
      );
      setCheckInSuccess(true);
    } catch (error) {
      if (error instanceof Error && error.message.includes("已經簽到")) {
        setAlreadyCheckedIn(true);
      } else {
        onNotify(`簽到失敗: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      }
    }

    setIsSubmitting(false);
  };

  const standingColor: Record<string, string> = {
    GREEN: "#22c55e",
    YELLOW: "#eab308",
    RED: "#ef4444",
    BLACK: "#374151",
  };

  if (hydrating) {
    return (
      <section className="section checkin-form-panel">
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          <p>載入活動資料...</p>
        </div>
      </section>
    );
  }

  if (noEventForDate || !eventSnapshot) {
    return (
      <section className="section checkin-form-panel">
        <div
          style={{
            background: "#fef2f2",
            border: "2px solid #ef4444",
            borderRadius: "16px",
            padding: "2rem",
            textAlign: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>⚠️</div>
          <h2 style={{ margin: "0 0 0.5rem 0", color: "#b91c1c" }}>
            暫時未有活動 No Upcoming Events
          </h2>
          <p style={{ margin: "0 0 1rem 0", color: "#991b1b" }}>
            後端未有「當前活動」，且 3 日內亦找不到活動。請管理員在後台建立活動或設為當前活動。
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#7f1d1d" }}>
            Please ask the organizer to create the event first at the admin page.
          </p>
        </div>
      </section>
    );
  }

  const typeLabel =
    checkinType === "member" ? "會員" : checkinType === "guest" ? "嘉賓" : "觀察員";
  const typeAccent =
    checkinType === "member" ? "#3b82f6" : checkinType === "guest" ? "#22c55e" : "#8b5cf6";
  const typeAccentDark =
    checkinType === "member" ? "#1e40af" : checkinType === "guest" ? "#15803d" : "#6d28d9";
  const typeEmoji =
    checkinType === "member" ? "👤" : checkinType === "guest" ? "🎫" : "👁️";
  const listTotal =
    checkinType === "member"
      ? members.length
      : checkinType === "guest"
        ? guests.length
        : observers.length;
  const canCheckInToday = isSameCalendarDayAsEvent(eventSnapshot.date);
  const eventDateLabel = eventSnapshot.date.slice(0, 10);
  const todayHktLabel = getHktDateString();

  return (
    <section className="section checkin-form-panel">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>✅ EventXP for BNI Anchor 簽到 Check-in</h2>
        <p className="hint" style={{ margin: "0.25rem 0 0 0" }}>
          <strong>{eventSnapshot.name}</strong>
          {" · "}
          活動日期 Event Date:{" "}
          <strong>
            {new Date(eventSnapshot.date).toLocaleDateString("zh-TW", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </strong>
        </p>
      </div>

      {!canCheckInToday && (
        <div
          style={{
            background: "#fef2f2",
            border: "2px solid #ef4444",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <p style={{ margin: 0, color: "#b91c1c", fontWeight: 600 }}>
            今日 ({todayHktLabel}) 並非活動日期 ({eventDateLabel})，無法簽到
          </p>
          <p style={{ margin: "0.35rem 0 0 0", color: "#991b1b", fontSize: "0.9rem" }}>
            Check-in is only allowed on the event day (HKT).
          </p>
        </div>
      )}

      {/* Step 1: Member / Guest / Observer */}
      <div
        className="checkin-type-selector"
        role="radiogroup"
        aria-label="簽到類型 Check-in type"
      >
        <label
          className={`radio-button ${checkinType === "member" ? "is-checked-member" : ""}`}
        >
          <input
            type="radio"
            name="checkin-type"
            value="member"
            checked={checkinType === "member"}
            onChange={() => setCheckinType("member")}
          />
          <span className="radio-label">會員 Member</span>
        </label>
        <label
          className={`radio-button ${checkinType === "guest" ? "is-checked-guest" : ""}`}
        >
          <input
            type="radio"
            name="checkin-type"
            value="guest"
            checked={checkinType === "guest"}
            onChange={() => setCheckinType("guest")}
          />
          <span className="radio-label">嘉賓 Guest</span>
        </label>
        <label
          className={`radio-button ${checkinType === "observer" ? "is-checked-observer" : ""}`}
        >
          <input
            type="radio"
            name="checkin-type"
            value="observer"
            checked={checkinType === "observer"}
            onChange={() => setCheckinType("observer")}
          />
          <span className="radio-label">觀察員 Observer</span>
        </label>
      </div>

      {/* Step 2: Search（獨立區塊）+ Refresh（隔開） */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          className="checkin-form-search-wrap"
          style={{
            flex: 1,
            minWidth: 0,
            position: "relative",
            borderRadius: "10px",
            border: "1px solid var(--border-color)",
            background: "var(--card-bg)",
            padding: "2px",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "calc(0.75rem + 2px)",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "1.1rem",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            className="input-field"
            placeholder={`搜尋${typeLabel}姓名或專業...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: "2.75rem",
              width: "100%",
              marginTop: 0,
              border: "none",
              background: "transparent",
              boxShadow: "none",
            }}
            autoFocus
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            paddingLeft: "0.25rem",
            borderLeft: "1px solid var(--border-color)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (checkinType === "member") void fetchMembers();
              else if (checkinType === "guest") void fetchGuestsForDate(eventSnapshot.date);
              else void fetchObserversForDate(eventSnapshot.date);
            }}
            disabled={isLoading}
            aria-label="重新載入名單"
            title="重新載入名單"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              padding: 0,
              borderRadius: "10px",
              border: "1px solid var(--border-color)",
              background: "var(--card-bg)",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.55 : 1,
            }}
          >
            <img
              src="/icons8-refresh-64.svg"
              alt=""
              width={28}
              height={28}
              style={{ display: "block", pointerEvents: "none" }}
            />
          </button>
        </div>
      </div>

      {/* Step 3: Name List */}
      {isLoading ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          <p>載入中...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
            {searchQuery ? "🔍" : typeEmoji}
          </div>
          <p className="hint">
            {searchQuery
              ? `找不到「${searchQuery}」`
              : checkinType === "guest"
                ? `此活動 (${eventSnapshot.date}) 暫無嘉賓登記`
                : checkinType === "observer"
                  ? `此活動 (${eventSnapshot.date}) 暫無觀察員`
                  : "暫無會員資料"}
          </p>
        </div>
      ) : (
        <div
          style={{
            maxHeight: "380px",
            overflowY: "auto",
            borderRadius: "12px",
            border: "1px solid #334155",
            marginBottom: "1.5rem",
          }}
        >
          {filteredList.map((item, idx) => {
            const isSelected = selectedId === item.id;
            const standing = (item as Member).standing;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id, item.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  width: "100%",
                  padding: "1rem 1.25rem",
                  textAlign: "left",
                  background: isSelected
                    ? checkinType === "member"
                      ? "#eff6ff"
                      : checkinType === "guest"
                        ? "#f0fdf4"
                        : "#f5f3ff"
                    : idx % 2 === 0
                    ? "#1e293b"
                    : "#0f172a",
                  border: "none",
                  borderBottom: "1px solid var(--border-color)",
                  borderLeft: isSelected
                    ? `4px solid ${typeAccent}`
                    : "4px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background:
                      checkinType === "member"
                        ? "linear-gradient(135deg, #3b82f6, #1e40af)"
                        : checkinType === "guest"
                          ? "linear-gradient(135deg, #22c55e, #15803d)"
                          : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "1rem",
                    flexShrink: 0,
                  }}
                >
                  {item.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      color: isSelected
                        ? typeAccentDark
                        : "#ffffff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: isSelected ? "var(--text-muted)" : "rgba(255,255,255,0.7)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.profession}
                    {checkinType === "guest" && (item as Guest).referrer && (
                      <span style={{ marginLeft: "0.5rem", opacity: 0.8 }}>
                        · 邀請人: {(item as Guest).referrer}
                      </span>
                    )}
                    {checkinType === "observer" && (item as Observer).attended && (
                      <span style={{ marginLeft: "0.5rem", color: "#a78bfa" }}>
                        · 已出席
                      </span>
                    )}
                  </div>
                </div>

                {/* Standing badge for members */}
                {checkinType === "member" && standing && (
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: standingColor[standing] ?? "#94a3b8",
                      flexShrink: 0,
                    }}
                  />
                )}

                {isSelected && (
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Step 4: Confirm Check-In */}
      {selectedId && !checkInSuccess && !alreadyCheckedIn && (
        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: "12px",
            padding: "1.5rem",
            border: `2px solid ${typeAccent}`,
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: "0 0 1rem 0", fontWeight: 600 }}>
            {checkinType === "observer" ? "確認出席 Confirm Attendance:" : "確認簽到 Confirm Check-in:"}
          </p>
          <p
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              margin: "0 0 1rem 0",
              color: typeAccent,
            }}
          >
            {typeEmoji} {selectedName}
          </p>
          <button
            type="button"
            className="button submit-button"
            onClick={handleConfirmCheckIn}
            disabled={isSubmitting || !canCheckInToday}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem",
              background: typeAccent,
              border: "none",
              opacity: isSubmitting || !canCheckInToday ? 0.7 : 1,
            }}
          >
            {!canCheckInToday
              ? "❌ 非活動日無法簽到"
              : isSubmitting
                ? "⏳ 處理中..."
                : checkinType === "observer"
                  ? "✅ 確認出席"
                  : "✅ 確認簽到"}
          </button>
        </div>
      )}

      {/* Already checked in */}
      {alreadyCheckedIn && (
        <div
          style={{
            background: "#fefce8",
            border: "2px solid #eab308",
            borderRadius: "12px",
            padding: "1.5rem",
            textAlign: "center",
            marginBottom: "1rem",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>⚠️</div>
          <h3 style={{ margin: "0 0 0.25rem 0", color: "#a16207" }}>
            已簽到 Already Checked In
          </h3>
          <p style={{ margin: 0, color: "#854d0e" }}>
            <strong>{selectedName}</strong> 今日已完成簽到。
          </p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setAlreadyCheckedIn(false);
              setSelectedId(null);
              setSelectedName("");
            }}
            style={{ marginTop: "1rem" }}
          >
            返回 Back
          </button>
        </div>
      )}

      {/* Success State */}
      {checkInSuccess && (
        <div
          style={{
            background:
              checkinType === "observer"
                ? "linear-gradient(135deg, #f5f3ff, #ede9fe)"
                : "linear-gradient(135deg, #f0fdf4, #dcfce7)",
            border: `2px solid ${checkinType === "observer" ? "#8b5cf6" : "#22c55e"}`,
            borderRadius: "16px",
            padding: "2rem",
            textAlign: "center",
            animation: "fadeIn 0.4s ease",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
          <h2 style={{ margin: "0 0 0.5rem 0", color: checkinType === "observer" ? "#6d28d9" : "#15803d" }}>
            {checkinType === "observer" ? "出席已記錄！Attendance Recorded!" : "簽到成功！Check-in Successful!"}
          </h2>
          <p
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              color: checkinType === "observer" ? "#5b21b6" : "#166534",
              margin: "0 0 0.5rem 0",
            }}
          >
            {selectedName}
          </p>
          {checkinType !== "observer" && (
            <p style={{ color: "#15803d", margin: "0 0 1.5rem 0", fontSize: "0.9rem" }}>
              {typeLabel} ·{" "}
              {new Date().toLocaleTimeString("zh-TW", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {checkinType === "observer" && (
            <p style={{ color: "#6d28d9", margin: "0 0 1.5rem 0", fontSize: "0.9rem" }}>
              觀察員 · 不記錄簽到時間
            </p>
          )}
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setCheckInSuccess(false);
              setSelectedId(null);
              setSelectedName("");
              setSearchQuery("");
            }}
            style={{ borderColor: "#22c55e", color: "#15803d" }}
          >
            返回 Back to List
          </button>
        </div>
      )}

      {/* Count bar + status */}
      {!checkInSuccess && !alreadyCheckedIn && (
        <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
          <p className="hint">
            {isLoading
              ? "載入中..."
              : `顯示 ${filteredList.length} / ${listTotal} 位${typeLabel}`}
          </p>
          <p className="hint" style={{ fontSize: "0.8rem", marginTop: "0.25rem", opacity: 0.8 }}>
            WebSocket 推送時自動更新（嘉賓／當前活動／簽到）· 亦可手按 🔄{wsConnected ? "" : " (WS 重新連線中…)"}
          </p>
        </div>
      )}
    </section>
  );
};
