import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { NotificationStack } from "../components/NotificationStack";
import { NotificationEntry } from "../components/ScanPanel";
import { QRGeneratorPanel } from "../components/QRGeneratorPanel";
import { AdminManualEntryPanel } from "../components/AdminManualEntryPanel";
import { EventManagementPanel } from "../components/EventManagementPanel";
import { StrategicPlanningPanel } from "../components/StrategicPlanningPanel";
import { AppVersionFooter } from "../components/AppVersionFooter";
import { AnchorOnlyNotice } from "../components/AnchorOnlyNotice";
import { ClientAdminLoginPanel } from "../components/ClientAdminLoginPanel";
import { useChapter } from "../chapterContext";
import { getCurrentEvent, type EventData } from "../api";

type AdminView = "home" | "generate" | "manual" | "event" | "strategic";

const navTargets: { id: AdminView; title: string; description: string; icon: string }[] = [
  {
    id: "strategic",
    title: "Strategic Seating",
    description: "為來賓配對最佳座位",
    icon: "🎯"
  },
  {
    id: "generate",
    title: "新增活動和二維碼",
    description: "產生活動簽到用 QR Code",
    icon: "🔳"
  },
  {
    id: "manual",
    title: "手動輸入",
    description: "管理員手動新增記錄",
    icon: "✍️"
  }
];

const createNotificationId = () =>
  crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isClientMode,
    isAuthenticated,
    authReady,
    chapter,
    adminHref,
    logout
  } = useChapter();
  const [activeView, setActiveView] = useState<AdminView>("home");
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [homeCurrentEvent, setHomeCurrentEvent] = useState<EventData | null>(null);
  const [homeEventLoading, setHomeEventLoading] = useState(false);

  const loadHomeCurrentEvent = useCallback(async () => {
    setHomeEventLoading(true);
    try {
      setHomeCurrentEvent(await getCurrentEvent());
    } catch {
      setHomeCurrentEvent(null);
    } finally {
      setHomeEventLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === "home" && isAuthenticated) {
      void loadHomeCurrentEvent();
    }
  }, [activeView, loadHomeCurrentEvent, isAuthenticated]);

  // Handle URL parameter for direct navigation (keep client=true / chapter)
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam && ["generate", "manual", "event", "strategic"].includes(viewParam)) {
      setActiveView(viewParam as AdminView);
      const next = new URLSearchParams();
      if (searchParams.get("client") === "true" || searchParams.get("client") === "1") {
        next.set("client", "true");
      }
      const chapterTag = searchParams.get("chapter");
      if (chapterTag) next.set("chapter", chapterTag);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const pushNotification = useCallback((note: NotificationEntry) => {
    setNotifications((current) => [...current, note]);
    setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== note.id));
    }, 4500);
  }, []);

  const notifyMessage = useCallback(
    (message: string, type: NotificationEntry["type"] = "info") => {
      pushNotification({
        id: createNotificationId(),
        type,
        message
      });
    },
    [pushNotification]
  );

  const handlePanelNotification = useCallback(
    (message: string, type: "success" | "error" | "info") => notifyMessage(message, type),
    [notifyMessage]
  );

  const renderView = () => {
    switch (activeView) {
      case "event":
        return (
          <EventManagementPanel
            onNotify={handlePanelNotification}
            onNavigateToGenerate={() => setActiveView("generate")}
          />
        );
      case "strategic":
        return <StrategicPlanningPanel onNotify={handlePanelNotification} />;
      case "generate":
        return <QRGeneratorPanel onNotify={handlePanelNotification} />;
      case "manual":
        return <AdminManualEntryPanel onNotify={handlePanelNotification} />;
      default:
        return null;
    }
  };

  const title = `🛠️ EventXP — ${chapter?.displayName || "Chapter"} 管理後台`;
  const subtitle = `Admin · ${chapter?.tag || "login required"}`;

  if (!authReady) {
    return (
      <div className="app-shell">
        <header className="site-header">
          <div>
            <p className="hint">EventXP Admin</p>
            <h1>載入登入狀態…</h1>
          </div>
        </header>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <NotificationStack notifications={notifications} />
        <header className="site-header">
          <div>
            <p className="hint">EventXP Admin</p>
            <h1>管理後台登入</h1>
            <p className="hint">BNI Anchor 及其他 chapter 請由此登入</p>
          </div>
        </header>
        <ClientAdminLoginPanel />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <NotificationStack notifications={notifications} />
      
      <header className="site-header">
        <div>
          <p className="hint">EventXP Admin</p>
          <h1>{title}</h1>
          <p className="hint">{subtitle}</p>
        </div>
        <div className="header-meta">
          <button
            type="button"
            className="ghost-button"
            style={{ marginRight: "0.5rem" }}
            onClick={() => void logout()}
          >
            登出
          </button>
          <Link to="/report" className="ghost-button" style={{ marginRight: "0.5rem" }}>
            📊 即時報告
          </Link>
          <Link to={adminHref("/admin")} className="ghost-button back-home-btn">
            ← 返回首頁
          </Link>
        </div>
      </header>

      <AnchorOnlyNotice />

      {activeView === "home" && (
        <section className="section admin-panel">
          <div className="section-header">
            <h2>選擇功能</h2>
            <p className="hint admin-home-current-event-line">
              {homeEventLoading ? (
                "載入當前活動…"
              ) : homeCurrentEvent ? (
                <>
                  當前活動：<strong>{homeCurrentEvent.name}</strong>{" "}
                  <span className="admin-home-current-date">({homeCurrentEvent.date})</span>
                  {" · "}
                  <button
                    type="button"
                    className="admin-link-to-events"
                    onClick={() => setActiveView("event")}
                  >
                    前往活動管理
                  </button>
                </>
              ) : (
                <>
                  當前活動：<span className="admin-home-current-date">未設定</span>
                  {" · "}
                  <button
                    type="button"
                    className="admin-link-to-events"
                    onClick={() => setActiveView("event")}
                  >
                    前往活動管理
                  </button>
                </>
              )}
            </p>
          </div>
          <div className="nav-grid">
            <button
              type="button"
              className="nav-card"
              onClick={() => setActiveView("event")}
            >
              <span className="nav-icon">📅</span>
              <strong className="nav-title">活動管理</strong>
              <span className="hint">查看／切換當前活動</span>
            </button>

            {navTargets.map((item) => (
              <button
                key={item.id}
                type="button"
                className="nav-card"
                onClick={() => setActiveView(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <strong className="nav-title">{item.title}</strong>
                <span className="hint">{item.description}</span>
              </button>
            ))}

            <a
              href="/report"
              className="nav-card"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <span className="nav-icon">📊</span>
              <strong className="nav-title">出席報表 / 匯出</strong>
              <span className="hint">直接前往報表頁（包含匯出 CSV）</span>
            </a>
            
            <Link to={adminHref("/admin/members")} className="nav-card" style={{ textDecoration: "none" }}>
              <span className="nav-icon">👥</span>
              <strong className="nav-title">會員管理</strong>
              <span className="hint">管理會員資料和狀態</span>
            </Link>
            
            <Link to={adminHref("/admin/guests")} className="nav-card" style={{ textDecoration: "none" }}>
              <span className="nav-icon">🎫</span>
              <strong className="nav-title">嘉賓管理</strong>
              <span className="hint">管理嘉賓資料</span>
            </Link>

            <Link to={adminHref("/admin/observers")} className="nav-card" style={{ textDecoration: "none" }}>
              <span className="nav-icon">👁️</span>
              <strong className="nav-title">觀察員管理</strong>
              <span className="hint">維護觀察員名單及匯出出席</span>
            </Link>
            
            <Link to={adminHref("/admin/import")} className="nav-card" style={{ textDecoration: "none" }}>
              <span className="nav-icon">📥</span>
              <strong className="nav-title">批量匯入</strong>
              <span className="hint">CSV 批量新增會員/嘉賓</span>
            </Link>

            <Link to={adminHref("/admin/public-guest")} className="nav-card" style={{ textDecoration: "none" }}>
              <span className="nav-icon">🔗</span>
              <strong className="nav-title">公開嘉賓登記連結</strong>
              <span className="hint">教你點樣 share /public/guest 俾人填</span>
            </Link>
          </div>
        </section>
      )}

      {activeView !== "home" && (
        <div className="section back-action">
          <button className="ghost-button" type="button" onClick={() => setActiveView("home")}>
            ← 返回管理首頁
          </button>
        </div>
      )}

      {renderView()}

      {activeView !== "manual" && (
        <footer className="site-footer">
          <p>
            Powered by{" "}
            <a href="https://innovatexp.co" target="_blank" rel="noopener noreferrer">
              InnovateXP Limited
            </a>
          </p>
          <AppVersionFooter />
        </footer>
      )}
    </div>
  );
}
