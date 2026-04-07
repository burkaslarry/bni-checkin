import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listEvents } from "../api";

type Props = {};

export default function AdminPublicGuestLinkPage({}: Props) {
  const [eventId, setEventId] = useState<string>("");
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [events, setEvents] = useState<{ id: number; name: string; date: string; startTime: string }[]>([]);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const res = await listEvents();
        const safe = Array.isArray(res) ? res : [];
        if (!cancelled) {
          setEvents(
            safe.map((e) => ({
              id: e.id,
              name: e.name,
              date: e.date,
              startTime: e.startTime
            }))
          );
          if (!eventId && safe[0]?.id) {
            setEventId(String(safe[0].id));
          }
        }
      } catch (e) {
        if (!cancelled) setEventsError(e instanceof Error ? e.message : "無法載入活動清單");
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publicUrl = useMemo(() => {
    const base = origin ? `${origin}/public/guest` : "/public/guest";
    const id = Number(eventId);
    if (Number.isFinite(id) && id > 0) {
      return `${base}?eventID=${encodeURIComponent(String(id))}`;
    }
    return base;
  }, [eventId, origin]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      alert("已複製公開連結");
    } catch {
      alert("複製失敗，請手動複製");
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="hint">EventXP for BNI Anchor</p>
          <h1>🔗 公開嘉賓登記連結</h1>
          <p className="hint">教你點樣分享俾人填（有驗證題目防 bot）</p>
        </div>
        <div className="header-meta">
          <Link to="/admin" className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="section-header">
          <h2>1) 選擇活動（建議）</h2>
          <p className="hint">分享時用 `?eventID=123`，公開頁會顯示活動資料（只顯示、不俾改）。</p>
        </div>

        <div style={{ display: "grid", gap: "0.75rem", maxWidth: 680 }}>
          <div className="form-group">
            <label>活動（用於生成公開連結）</label>
            <select className="input-field" value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={eventsLoading}>
              <option value="">
                {eventsLoading ? "載入活動清單中..." : events.length ? "（請選擇活動）" : "沒有活動資料"}
              </option>
              {events.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  #{e.id} · {e.name} · {e.date} {e.startTime}
                </option>
              ))}
            </select>
            {eventsError && (
              <p className="hint" style={{ margin: 0, color: "var(--danger, #ef4444)" }}>
                {eventsError}
              </p>
            )}
          </div>

          <div className="form-group">
            <label>2) 公開連結（複製後 WhatsApp/Signal/Email 發出去）</label>
            <input className="input-field" value={publicUrl} readOnly />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="button" type="button" onClick={() => void copy()} style={{ background: "#10b981" }}>
                📋 複製連結
              </button>
              <a className="ghost-button" href={publicUrl} target="_blank" rel="noopener noreferrer">
                🔎 預覽公開頁
              </a>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              對方需要填：姓名、專業、電話、活動日期 + 驗證題目答案（防 bot）。邀請人會用下拉選單（Anchor 會員名單）。
            </p>
          </div>

          <div className="form-group">
            <label>3) 管理員點樣睇到結果？</label>
            <p className="hint" style={{ margin: 0 }}>
              公開表單提交後，嘉賓會寫入資料庫，去「🎫 嘉賓管理」就會見到（可用 eventDate filter）。
            </p>
          </div>
        </div>
      </section>

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

