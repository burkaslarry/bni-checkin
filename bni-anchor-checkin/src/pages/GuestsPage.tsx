import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getGuests, GuestInfo, deleteGuest, updateGuest } from "../api";

type GuestsPageProps = {};

export default function GuestsPage({}: GuestsPageProps) {
  const navigate = useNavigate();
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventDate, setSelectedEventDate] = useState<string>("all");
  const [editingGuest, setEditingGuest] = useState<GuestInfo | null>(null);
  const [editProfession, setEditProfession] = useState("");
  const [editReferrer, setEditReferrer] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [loadFailedRedirect, setLoadFailedRedirect] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    fetchGuests();
  }, []);

  useEffect(() => {
    if (!loadFailedRedirect) return;
    setRedirectCountdown(3);
    countdownRef.current = window.setInterval(() => {
      setRedirectCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          navigate("/admin/import");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [loadFailedRedirect, navigate]);

  const fetchGuests = async () => {
    try {
      const data = await getGuests();
      setGuests(data.guests || []);
      setLoadFailedRedirect(false);
    } catch (error) {
      showNotification("無法載入嘉賓列表", "error");
      setLoadFailedRedirect(true);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleEdit = (guest: GuestInfo) => {
    setEditingGuest(guest);
    setEditProfession(guest.profession);
    setEditReferrer(guest.referrer || "");
    setEditEventDate(guest.eventDate || "");
  };

  const handleSaveEdit = async () => {
    if (!editingGuest) return;

    try {
      await updateGuest(editingGuest.name, {
        profession: editProfession,
        referrer: editReferrer || undefined,
        eventDate: editEventDate || undefined
      });

      showNotification(`已更新 ${editingGuest.name} 的資料`, "success");
      setEditingGuest(null);
      fetchGuests();
    } catch (error) {
      showNotification("更新失敗", "error");
    }
  };

  const handleDeleteGuest = async (guestName: string) => {
    if (!window.confirm(`確定要刪除嘉賓 ${guestName} 嗎？此操作無法復原！`)) {
      return;
    }

    try {
      await deleteGuest(guestName);
      showNotification(`已刪除 ${guestName}`, "success");
      fetchGuests();
    } catch (error) {
      showNotification("刪除失敗", "error");
    }
  };

  // Get unique event dates from guests
  const eventDates = Array.from(new Set(guests.map(g => g.eventDate).filter(Boolean))).sort().reverse();
  
  // Filter guests by selected event date
  const filteredGuests = selectedEventDate === "all" 
    ? guests 
    : guests.filter(g => g.eventDate === selectedEventDate);

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
          <h1>🎫 EventXP for BNI Anchor 嘉賓管理</h1>
          <p className="hint">Guest Management</p>
        </div>
        <div className="header-meta">
          <Link to="/admin" className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <section className="section">
        {loadFailedRedirect && (
          <div
            style={{
              background: "#fef2f2",
              border: "2px solid #ef4444",
              borderRadius: "12px",
              padding: "1.5rem",
              marginBottom: "2rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#b91c1c" }}>無法載入嘉賓列表</h3>
            <p style={{ margin: "0 0 0.5rem 0", color: "#991b1b" }}>
              請前往 <strong>📥 批量匯入</strong> 頁面，選擇 <strong>嘉賓</strong> 後上傳 CSV 匯入嘉賓資料。
            </p>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#7f1d1d" }}>
              Redirecting to import page in {redirectCountdown} seconds...
            </p>
            <button
              type="button"
              className="button"
              onClick={() => navigate("/admin/import")}
              style={{ marginTop: "1rem", background: "#dc2626" }}
            >
              📥 立即前往批量匯入
            </button>
          </div>
        )}

        <div className="section-header">
          <h2>🎫 嘉賓列表</h2>
          <p className="hint">Guest Management - 管理嘉賓資料</p>
        </div>

        {/* Summary Stats */}
        {!loading && !loadFailedRedirect && (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: "1rem", 
            marginBottom: "2rem" 
          }}>
            <div style={{ 
              padding: "1.5rem", 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px", 
              color: "white",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)"
            }}>
              <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{guests.length}</div>
              <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>總嘉賓數 Total Guests</div>
            </div>
            <div style={{ 
              padding: "1.5rem", 
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              borderRadius: "12px", 
              color: "white",
              boxShadow: "0 4px 12px rgba(245, 87, 108, 0.3)"
            }}>
              <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{eventDates.length}</div>
              <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>活動數量 Events</div>
            </div>
            {selectedEventDate !== "all" && (
              <div style={{ 
                padding: "1.5rem", 
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                borderRadius: "12px", 
                color: "white",
                boxShadow: "0 4px 12px rgba(79, 172, 254, 0.3)"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{filteredGuests.length}</div>
                <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>已篩選 Filtered</div>
              </div>
            )}
          </div>
        )}

        {/* Event Filter */}
        <div style={{ 
          background: "var(--card-bg)", 
          padding: "1.5rem", 
          borderRadius: "12px", 
          marginBottom: "2rem",
          border: "1px solid var(--border-color)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📅</span>
            <div style={{ flex: 1 }}>
              <label htmlFor="event-date-filter" style={{ 
                fontWeight: 600, 
                fontSize: "1rem",
                display: "block",
                marginBottom: "0.5rem"
              }}>
                篩選活動 Filter by Event
              </label>
              <select
                id="event-date-filter"
                className="input-field"
                value={selectedEventDate}
                onChange={(e) => setSelectedEventDate(e.target.value)}
                style={{ width: "100%", fontSize: "1rem" }}
              >
                <option value="all">📋 全部活動 All Events ({guests.length} 位嘉賓)</option>
                {eventDates.map(date => {
                  const count = guests.filter(g => g.eventDate === date).length;
                  const formattedDate = new Date(date as string).toLocaleDateString("zh-TW", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short"
                  });
                  return (
                    <option key={date} value={date}>
                      🎯 活動日期：{formattedDate} ({count} 位嘉賓)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <p className="hint" style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
            {selectedEventDate === "all" 
              ? `顯示所有 ${guests.length} 位嘉賓` 
              : `已篩選：${filteredGuests.length} 位嘉賓參加此活動`}
          </p>
        </div>

        {loading && !loadFailedRedirect ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>載入中...</p>
          </div>
        ) : !loadFailedRedirect ? (
          <div className="guests-table-container" style={{ overflowX: "auto" }}>
            <table className="guests-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card-bg)", borderBottom: "2px solid var(--border-color)" }}>
                  <th style={{ padding: "1rem", textAlign: "left" }}>姓名</th>
                  <th style={{ padding: "1rem", textAlign: "left" }}>專業領域</th>
                  <th style={{ padding: "1rem", textAlign: "left" }}>邀請人</th>
                  <th style={{ padding: "1rem", textAlign: "left" }}>活動日期</th>
                  <th style={{ padding: "1rem", textAlign: "center" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => (
                  <tr key={guest.name} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "1rem", fontWeight: 500 }}>{guest.name}</td>
                    <td style={{ padding: "1rem" }}>{guest.profession}</td>
                    <td style={{ padding: "1rem" }}>{guest.referrer || "-"}</td>
                    <td style={{ padding: "1rem" }}>
                      {guest.eventDate ? (
                        <span style={{ 
                          padding: "0.25rem 0.75rem", 
                          borderRadius: "12px", 
                          fontSize: "0.85rem",
                          background: "#eff6ff",
                          color: "#1e40af",
                          border: "1px solid #bfdbfe"
                        }}>
                          📅 {guest.eventDate}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                        <button
                          className="ghost-button"
                          onClick={() => handleEdit(guest)}
                          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                        >
                          ✏️ 編輯
                        </button>
                        <button
                          className="ghost-button"
                          onClick={() => handleDeleteGuest(guest.name)}
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
        ) : null}

        {!loadFailedRedirect && filteredGuests.length === 0 && !loading && guests.length > 0 && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p className="hint">此活動日期暫無嘉賓資料</p>
          </div>
        )}

        {!loadFailedRedirect && guests.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p className="hint">暫無嘉賓資料</p>
          </div>
        )}
      </section>

      {/* Edit Modal */}
      {editingGuest && (
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
        }} onClick={() => setEditingGuest(null)}>
          <div className="modal-content" style={{
            background: "var(--bg)",
            padding: "2rem",
            borderRadius: "12px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>編輯嘉賓 - {editingGuest.name}</h3>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-profession">專業領域 Profession</label>
              <input
                id="edit-profession"
                className="input-field"
                value={editProfession}
                onChange={(e) => setEditProfession(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-referrer">邀請人 Referrer</label>
              <input
                id="edit-referrer"
                className="input-field"
                value={editReferrer}
                onChange={(e) => setEditReferrer(e.target.value)}
                placeholder="選填 Optional"
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="edit-event-date">活動日期 Event Date</label>
              <input
                id="edit-event-date"
                type="date"
                className="input-field"
                value={editEventDate}
                onChange={(e) => setEditEventDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="ghost-button" onClick={() => setEditingGuest(null)}>
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
