import { ReactNode } from "react";
import { ClientAdminLoginPanel } from "./ClientAdminLoginPanel";
import { useChapter } from "../chapterContext";

/** Require login for all /admin/* routes (Anchor and other chapters). */
export function ClientAuthGate({ children }: { children: ReactNode }) {
  const { isAdminRoute, isAuthenticated, authReady } = useChapter();

  if (!isAdminRoute) return <>{children}</>;

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
            <p className="hint">BNI Anchor 及其他 chapter 請由此登入</p>
          </div>
        </header>
        <ClientAdminLoginPanel />
      </div>
    );
  }

  return <>{children}</>;
}
