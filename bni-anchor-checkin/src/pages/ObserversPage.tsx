import { Link } from "react-router-dom";
import { AnchorOnlyNotice } from "../components/AnchorOnlyNotice";
import { ClientAuthGate } from "../components/ClientAuthGate";
import { ObserverManagementPanel } from "../components/ObserverManagementPanel";
import { useChapter } from "../chapterContext";

/** Admin list for adding and deleting observers on an event date. */
export default function ObserversPage() {
  return (
    <ClientAuthGate>
      <ObserversPageInner />
    </ClientAuthGate>
  );
}

function ObserversPageInner() {
  const { adminHref, isClientMode, chapter } = useChapter();
  const title = isClientMode
    ? `${chapter?.displayName || "Chapter"} 觀察員管理`
    : "EventXP for BNI Anchor 觀察員管理";

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="hint">{isClientMode ? `EventXP · ${chapter?.displayName || "Chapter"}` : "EventXP for BNI Anchor"}</p>
          <h1>👁️ {title}</h1>
          <p className="hint">新增或刪除觀察員。可勾選多位後一次刪除。</p>
        </div>
        <div className="header-meta">
          <Link to={adminHref("/admin")} className="ghost-button back-home-btn">
            ← 返回管理頁
          </Link>
        </div>
      </header>

      <AnchorOnlyNotice />
      <ObserverManagementPanel />

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
