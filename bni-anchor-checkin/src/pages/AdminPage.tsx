import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { NotificationStack } from "../components/NotificationStack";
import { NotificationEntry } from "../components/ScanPanel";
import { QRGeneratorPanel } from "../components/QRGeneratorPanel";
import { RecordsPanel } from "../components/RecordsPanel";
import { AdminManualEntryPanel } from "../components/AdminManualEntryPanel";

type AdminView = "home" | "generate" | "records" | "manual";

const navTargets: { id: AdminView; title: string; description: string; icon: string }[] = [
  {
    id: "generate",
    title: "產生 QR 碼",
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
  const [activeView, setActiveView] = useState<AdminView>("home");
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

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
          <p className="hint">BNI Anchor Checkin</p>
          <h1>🛠️ BNI Anchor Checkin 管理後台</h1>
          <p className="hint">Admin Dashboard</p>
        </div>
        <div className="header-meta">
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
