import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { NotificationEntry } from "../components/ScanPanel";
import { NotificationStack } from "../components/NotificationStack";
import { CheckinFormPanel } from "../components/CheckinFormPanel";
import { AppVersionFooter } from "../components/AppVersionFooter";
import { setActiveApiChapterTag } from "../api";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** Public check-in: bare `/` → Anchor; `/?chapter=amax` → that chapter. */
export default function HomePage() {
  const [searchParams] = useSearchParams();
  const chapterTag = (searchParams.get("chapter") || "anchor").trim().toLowerCase() || "anchor";
  const isAnchor = chapterTag === "anchor";

  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setActiveApiChapterTag(chapterTag);
    return () => setActiveApiChapterTag(null);
  }, [chapterTag]);

  const pushNotification = useCallback((note: NotificationEntry) => {
    setNotifications((current) => [...current, note]);
    setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== note.id));
    }, 4500);
  }, []);

  const notifyMessage = useCallback(
    (message: string, type: NotificationEntry["type"] = "info") => {
      pushNotification({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        type,
        message
      });
    },
    [pushNotification]
  );

  const handleInstall = useCallback(async () => {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    notifyMessage(
      choice.outcome === "accepted"
        ? "Add to home screen accepted."
        : "Install prompt dismissed.",
      choice.outcome === "accepted" ? "success" : "info"
    );
    setInstallPrompt(null);
  }, [installPrompt, notifyMessage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handlePanelNotification = useCallback(
    (message: string, type: "success" | "error" | "info") => notifyMessage(message, type),
    [notifyMessage]
  );

  const brandLabel = isAnchor ? "EventXP for BNI Anchor" : `EventXP · ${chapterTag}`;

  return (
    <div className="app-shell">
      <NotificationStack notifications={notifications} />
      <header className="site-header">
        <div>
          <p className="hint">{brandLabel}</p>
          <h1>📱 活動簽到</h1>
          <p className="hint">
            掃描 QR 碼快速簽到
            {!isAnchor && (
              <>
                {" "}
                · chapter=<code>{chapterTag}</code>
              </>
            )}
          </p>
        </div>
        <div className="header-meta">
          <span className={`connection-pill ${isOnline ? "online" : "offline"}`}>
            {isOnline ? "線上" : "離線"}
          </span>
          <Link to="/report" className="ghost-button" style={{ textDecoration: "none" }}>
            📊 即時報告
          </Link>
          {installPrompt && (
            <button className="ghost-button install-cta" type="button" onClick={handleInstall}>
              新增到首頁
            </button>
          )}
        </div>
      </header>

      <CheckinFormPanel onNotify={handlePanelNotification} />

      <p className="hint status-hint">
        {isOnline
          ? "✅ 連線正常，簽到將即時記錄"
          : "⚠️ 離線模式，簽到將在連線後同步"}
      </p>

      <footer className="site-footer">
        <p>
          Powered by{" "}
          <a href="https://innovatexp.co" target="_blank" rel="noopener noreferrer">
            InnovateXP Limited
          </a>
        </p>
        <AppVersionFooter />
      </footer>
    </div>
  );
}
