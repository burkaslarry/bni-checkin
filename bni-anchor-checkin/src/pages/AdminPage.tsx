import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { NotificationStack } from "../components/NotificationStack";
import { NotificationEntry } from "../components/ScanPanel";
import { QRGeneratorPanel } from "../components/QRGeneratorPanel";
import { RecordsPanel } from "../components/RecordsPanel";
import { AdminManualEntryPanel } from "../components/AdminManualEntryPanel";
import { EventManagementPanel } from "../components/EventManagementPanel";
import { StrategicPlanningPanel } from "../components/StrategicPlanningPanel";

type AdminView = "home" | "generate" | "records" | "manual" | "event" | "strategic";

const navTargets: { id: AdminView; title: string; description: string; icon: string }[] = [
  {
    id: "event",
    title: "活動管理",
    description: "查看和管理目前活動",
    icon: "📅"
  },
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
    id: "records",
    title: "簽到記錄 & 匯出",
    description: "查看記錄並匯出 CSV",
    icon: "📋"
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
  const [activeView, setActiveView] = useState<AdminView>("home");
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

  // Handle URL parameter for direct navigation
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam && ["generate", "records", "manual", "event", "strategic"].includes(viewParam)) {
      setActiveView(viewParam as AdminView);
      // Clear the URL parameter after navigating
      setSearchParams({}, { replace: true });
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
            onNavigateToStrategic={() => setActiveView("strategic")}
            onNavigateToGenerate={() => setActiveView("generate")}
          />
        );
      case "strategic":
        return <StrategicPlanningPanel onNotify={handlePanelNotification} />;
      case "generate":
        return <QRGeneratorPanel onNotify={handlePanelNotification} />;
      case "records":
        return <RecordsPanel onNotify={handlePanelNotification} />;
      case "manual":
        return <AdminManualEntryPanel onNotify={handlePanelNotification} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      <NotificationStack notifications={notifications} />
      
      <header className="site-header">
        <div>
          <p className="hint">EventXP for BNI Anchor</p>
          <h1>🛠️ EventXP for BNI Anchor 管理後台</h1>
          <p className="hint">Admin Dashboard</p>
        </div>
        <div className="header-meta">
          <Link to="/report" className="ghost-button" style={{ marginRight: "0.5rem" }}>
            📊 即時報告
          </Link>
          <Link to="/admin" className="ghost-button back-home-btn">
            ← 返回首頁
          </Link>
        </div>
      </header>

      {activeView === "home" && (
        <section className="section admin-panel">
          <div className="section-header">
            <h2>選擇功能</h2>
            <p className="hint">管理與匯出功能</p>
          </div>
          <div className="nav-grid">
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
            
            {/* External Links to New Pages */}
            <Link to="/admin/members" className="nav-card" style={{ textDecoration: 'none' }}>
              <span className="nav-icon">👥</span>
              <strong className="nav-title">會員管理</strong>
              <span className="hint">管理會員資料和狀態</span>
            </Link>
            
            <Link to="/admin/guests" className="nav-card" style={{ textDecoration: 'none' }}>
              <span className="nav-icon">🎫</span>
              <strong className="nav-title">嘉賓管理</strong>
              <span className="hint">管理嘉賓資料</span>
            </Link>
            
            <Link to="/admin/import" className="nav-card" style={{ textDecoration: 'none' }}>
              <span className="nav-icon">📥</span>
              <strong className="nav-title">批量匯入</strong>
              <span className="hint">CSV 批量新增會員/嘉賓</span>
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
