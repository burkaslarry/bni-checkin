import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ClientAdminLoginPanel } from "./ClientAdminLoginPanel";
import { useChapter } from "../chapterContext";

/** Require client login when visiting /admin/*?client=true */
export function ClientAuthGate({ children }: { children: ReactNode }) {
  const { isClientMode, isAuthenticated, authReady } = useChapter();

  if (!isClientMode) return <>{children}</>;

  if (!authReady) {
    return (
      <div className="app-shell">
        <header className="site-header">
          <div>
            <p className="hint">EventXP Client Admin</p>
            <h1>載入登入狀態…</h1>
          </div>
        </header>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <header className="site-header">
          <div>
            <p className="hint">EventXP Client Admin</p>
            <h1>其他 Chapter 管理入口</h1>
            <p className="hint">請先登入</p>
          </div>
          <div className="header-meta">
            <Link to="/admin" className="ghost-button back-home-btn">
              ← Anchor 管理後台
            </Link>
          </div>
        </header>
        <ClientAdminLoginPanel />
      </div>
    );
  }

  return <>{children}</>;
}
