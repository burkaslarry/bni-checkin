import { useState, useEffect, useMemo, useRef } from "react";
import { getEventForDate, getMembers, getGuests, logAttendance, getReportWebSocketUrl } from "../api";

type CheckinType = "member" | "guest";

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

type CheckinFormPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export const CheckinFormPanel = ({ onNotify }: CheckinFormPanelProps) => {
  const [checkinType, setCheckinType] = useState<CheckinType>("member");
  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [isLoading, setIsLoading] = useState(true); // Show loading until first fetch completes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [noEventForDate, setNoEventForDate] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Read event date from URL param (?event=2026-03-05)
  const eventDate = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get("event");
    if (param) return param;
    // Fallback: today's date
    return new Date().toISOString().split("T")[0];
  }, []);

  // Fetch members from backend (bni-anchor-checkin-backend /api/members)
  const fetchMembers = async () => {
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
  };

  // Fetch guests from backend filtered by event_date
  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const result = await getGuests();
      const filteredGuests = (result.guests ?? [])
        .filter((g) => g.eventDate === eventDate)
        .map((g, idx) => ({
          id: idx + 1,
          name: g.name,
          profession: g.profession,
          referrer: g.referrer,
          event_date: g.eventDate,
        }));
      setGuests(filteredGuests);
    } catch (error) {
      onNotify("無法載入嘉賓列表", "error");
    }
    setIsLoading(false);
  };

  // Check if event exists for eventDate
  useEffect(() => {
    let cancelled = false;
    getEventForDate(eventDate).then((event) => {
      if (!cancelled) {
        setNoEventForDate(!event);
      }
    });
    return () => { cancelled = true; };
  }, [eventDate]);

  useEffect(() => {
    if (checkinType === "member") {
      fetchMembers();
    } else {
      fetchGuests();
    }
    setSelectedId(null);
    setSelectedName("");
    setSearchQuery("");
    setCheckInSuccess(false);
    setAlreadyCheckedIn(false);
  }, [checkinType, eventDate]);

  // Poll every 30 seconds
  useEffect(() => {
    const refresh = () => {
      if (checkinType === "member") fetchMembers();
      else fetchGuests();
    };
    const id = window.setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [checkinType, eventDate]);

  // WebSocket for real-time sync
  useEffect(() => {
    const ws = new WebSocket(getReportWebSocketUrl());
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "attendance_updated" || msg.type === "event_created") {
          getEventForDate(eventDate).then((event) => setNoEventForDate(!event));
          if (checkinType === "member") fetchMembers();
          else fetchGuests();
        }
      } catch (_) {}
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [checkinType, eventDate]);

  // Filter list by search query
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (checkinType === "member") {
      return members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.profession.toLowerCase().includes(q)
      );
    } else {
      return guests.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.profession.toLowerCase().includes(q)
      );
    }
  }, [checkinType, members, guests, searchQuery]);

  const handleSelect = (id: number, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setCheckInSuccess(false);
    setAlreadyCheckedIn(false);
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedId || !selectedName) return;

    setIsSubmitting(true);

    // Determine on-time vs late (can be enhanced with event cutoff logic)
    const now = new Date();
    const status = "on-time";

    try {
      const selected =
        checkinType === "member"
          ? members.find((m) => m.id === selectedId)
          : guests.find((g) => g.id === selectedId);
      await logAttendance(
        selectedId,
        checkinType,
        selectedName,
        selected?.profession ?? "",
        eventDate,
        now.toISOString(),
        status
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

  if (noEventForDate) {
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
            尚未建立活動 No Event Created
          </h2>
          <p style={{ margin: "0 0 1rem 0", color: "#991b1b" }}>
            此日期 ({eventDate}) 尚未建立活動。請主辦單位先在管理頁面建立活動後再進行簽到。
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#7f1d1d" }}>
            Please ask the organizer to create the event first at the admin page.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="section checkin-form-panel">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>✅ EventXP for BNI Anchor 簽到 Check-in</h2>
        <p className="hint" style={{ margin: "0.25rem 0 0 0" }}>
          活動日期 Event Date:{" "}
          <strong>
            {new Date(eventDate).toLocaleDateString("zh-TW", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </strong>
        </p>
      </div>

      {/* Step 1: Member / Guest Selector */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => setCheckinType("member")}
          style={{
            padding: "1.25rem",
            borderRadius: "12px",
            border: `2px solid ${checkinType === "member" ? "#3b82f6" : "var(--border-color)"}`,
            background:
              checkinType === "member"
                ? "linear-gradient(135deg, #eff6ff, #dbeafe)"
                : "var(--card-bg)",
            color: checkinType === "member" ? "#1e40af" : "inherit",
            fontWeight: checkinType === "member" ? 700 : 500,
            fontSize: "1rem",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>👤</div>
          <div>會員 Member</div>
        </button>

        <button
          type="button"
          onClick={() => setCheckinType("guest")}
          style={{
            padding: "1.25rem",
            borderRadius: "12px",
            border: `2px solid ${checkinType === "guest" ? "#22c55e" : "var(--border-color)"}`,
            background:
              checkinType === "guest"
                ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
                : "var(--card-bg)",
            color: checkinType === "guest" ? "#15803d" : "inherit",
            fontWeight: checkinType === "guest" ? 700 : 500,
            fontSize: "1rem",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>🎫</div>
          <div>嘉賓 Guest</div>
        </button>
      </div>

      {/* Step 2: Search + Reload */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: "1rem",
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
            placeholder={`搜尋${checkinType === "member" ? "會員" : "嘉賓"}姓名或專業...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "2.75rem", width: "100%" }}
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={() => (checkinType === "member" ? fetchMembers() : fetchGuests())}
          disabled={isLoading}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            background: "var(--card-bg)",
            cursor: isLoading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
          title="重新載入"
        >
          🔄
        </button>
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
            {searchQuery ? "🔍" : checkinType === "guest" ? "🎫" : "👤"}
          </div>
          <p className="hint">
            {searchQuery
              ? `找不到「${searchQuery}」`
              : checkinType === "guest"
              ? `今日 (${eventDate}) 暫無嘉賓登記`
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
                      : "#f0fdf4"
                    : idx % 2 === 0
                    ? "#1e293b"
                    : "#0f172a",
                  border: "none",
                  borderBottom: "1px solid var(--border-color)",
                  borderLeft: isSelected
                    ? `4px solid ${checkinType === "member" ? "#3b82f6" : "#22c55e"}`
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
                        : "linear-gradient(135deg, #22c55e, #15803d)",
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
                        ? checkinType === "member"
                          ? "#1e40af"
                          : "#15803d"
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
            border: `2px solid ${checkinType === "member" ? "#3b82f6" : "#22c55e"}`,
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: "0 0 1rem 0", fontWeight: 600 }}>
            確認簽到 Confirm Check-in:
          </p>
          <p
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              margin: "0 0 1rem 0",
              color: checkinType === "member" ? "#77a6f2" : "#4ce684",
            }}
          >
            {checkinType === "member" ? "👤" : "🎫"} {selectedName}
          </p>
          <button
            type="button"
            className="button submit-button"
            onClick={handleConfirmCheckIn}
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem",
              background: checkinType === "member" ? "#3b82f6" : "#22c55e",
              border: "none",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "⏳ 處理中..." : "✅ 確認簽到"}
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
            background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
            border: "2px solid #22c55e",
            borderRadius: "16px",
            padding: "2rem",
            textAlign: "center",
            animation: "fadeIn 0.4s ease",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
          <h2 style={{ margin: "0 0 0.5rem 0", color: "#15803d" }}>
            簽到成功！Check-in Successful!
          </h2>
          <p
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              color: "#166534",
              margin: "0 0 0.5rem 0",
            }}
          >
            {selectedName}
          </p>
          <p style={{ color: "#15803d", margin: "0 0 1.5rem 0", fontSize: "0.9rem" }}>
            {checkinType === "member" ? "會員" : "嘉賓"} ·{" "}
            {new Date().toLocaleTimeString("zh-TW", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
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
              : `顯示 ${filteredList.length} / ${checkinType === "member" ? members.length : guests.length} 位${checkinType === "member" ? "會員" : "嘉賓"}`}
          </p>
          <p className="hint" style={{ fontSize: "0.8rem", marginTop: "0.25rem", opacity: 0.8 }}>
            自動每 30 秒更新 | WebSocket 即時同步{wsConnected ? "" : " (重新連線中...)"}
          </p>
        </div>
      )}
    </section>
  );
};
