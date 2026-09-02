import { ReactNode } from "react";
import { ClientAdminLoginPanel } from "./ClientAdminLoginPanel";
import { useChapter } from "../chapterContext";

/** Require login for /admin/* and /report. */
export function ClientAuthGate({ children }: { children: ReactNode }) {
  const { requiresLogin, isAuthenticated, authReady } = useChapter();

  if (!requiresLogin) return <>{children}</>;

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
        <header className="site-header">
          <div>
            <p className="hint">EventXP Admin</p>
            <h1>管理後台登入</h1>
            <p className="hint">BNI Anchor 及其他 chapter 請由此登入；CSV 匯入會員、嘉賓、觀察員</p>
          </div>
        </header>
        <ClientAdminLoginPanel />
      </div>
    );
  }

  return <>{children}</>;
}
