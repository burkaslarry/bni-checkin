import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  clientLogin,
  clientLogout,
  fetchClientSession,
  type ChapterInfo
} from "./api";

const SESSION_KEY = "eventxp_client_session";

type StoredSession = {
  token: string;
  chapter: ChapterInfo;
  expiresAtEpochMs: number;
};

type ChapterContextValue = {
  isClientMode: boolean;
  isAnchorMode: boolean;
  chapterTag: string;
  chapter: ChapterInfo | null;
  clientToken: string | null;
  authReady: boolean;
  isAuthenticated: boolean;
  loginError: string | null;
  login: (adminLogin: string, adminPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Preserve client=true (and chapter) on admin links */
  adminHref: (path: string) => string;
};

const ChapterContext = createContext<ChapterContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.chapter?.tag) return null;
    if (parsed.expiresAtEpochMs && parsed.expiresAtEpochMs < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function ChapterProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isClientMode =
    location.pathname.startsWith("/admin") &&
    (searchParams.get("client") === "true" || searchParams.get("client") === "1");

  const [session, setSession] = useState<StoredSession | null>(() =>
    isClientMode ? readStoredSession() : null
  );
  const [authReady, setAuthReady] = useState(!isClientMode);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!isClientMode) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    const stored = readStoredSession();
    if (!stored) {
      setSession(null);
      setAuthReady(true);
      return;
    }
    (async () => {
      try {
        const remote = await fetchClientSession(stored.token);
        if (cancelled) return;
        const next: StoredSession = {
          token: stored.token,
          chapter: remote.chapter,
          expiresAtEpochMs: stored.expiresAtEpochMs
        };
        writeStoredSession(next);
        setSession(next);
      } catch {
        if (cancelled) return;
        writeStoredSession(null);
        setSession(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isClientMode]);

  const login = useCallback(async (adminLogin: string, adminPassword: string) => {
    setLoginError(null);
    try {
      const result = await clientLogin(adminLogin, adminPassword);
      const next: StoredSession = {
        token: result.token,
        chapter: result.chapter,
        expiresAtEpochMs: result.expiresAtEpochMs
      };
      writeStoredSession(next);
      setSession(next);
      return true;
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "登入失敗");
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    const token = session?.token;
    writeStoredSession(null);
    setSession(null);
    if (token) {
      try {
        await clientLogout(token);
      } catch {
        /* ignore */
      }
    }
  }, [session?.token]);

  const adminHref = useCallback(
    (path: string) => {
      if (!isClientMode) return path;
      const url = new URL(path, "http://local");
      url.searchParams.set("client", "true");
      if (session?.chapter?.tag) {
        url.searchParams.set("chapter", session.chapter.tag);
      }
      return `${url.pathname}${url.search}`;
    },
    [isClientMode, session?.chapter?.tag]
  );

  const value = useMemo<ChapterContextValue>(() => {
    const chapterTag = isClientMode
      ? session?.chapter?.tag || searchParams.get("chapter") || ""
      : "anchor";
    return {
      isClientMode,
      isAnchorMode: !isClientMode && location.pathname.startsWith("/admin"),
      chapterTag: chapterTag || "anchor",
      chapter: isClientMode ? session?.chapter ?? null : {
        id: 1,
        tag: "anchor",
        displayName: "BNI Anchor",
        timezone: "Asia/Hong_Kong",
        status: "active"
      },
      clientToken: isClientMode ? session?.token ?? null : null,
      authReady,
      isAuthenticated: !isClientMode || !!session?.token,
      loginError,
      login,
      logout,
      adminHref
    };
  }, [
    isClientMode,
    location.pathname,
    session,
    searchParams,
    authReady,
    loginError,
    login,
    logout,
    adminHref
  ]);

  return <ChapterContext.Provider value={value}>{children}</ChapterContext.Provider>;
}

export function useChapter(): ChapterContextValue {
  const ctx = useContext(ChapterContext);
  if (!ctx) {
    throw new Error("useChapter must be used within ChapterProvider");
  }
  return ctx;
}
