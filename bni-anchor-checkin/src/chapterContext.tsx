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
  setActiveApiChapter,
  ANCHOR_CHAPTER_ID,
  CHAPTER_TAG_TO_ID,
  type ChapterInfo
} from "./api";

const SESSION_KEY = "eventxp_admin_session";
/** Legacy key from client-only login era */
const LEGACY_SESSION_KEY = "eventxp_client_session";

type StoredSession = {
  token: string;
  chapter: ChapterInfo;
  expiresAtEpochMs: number;
};

type ChapterContextValue = {
  /** True when on any /admin route */
  isAdminRoute: boolean;
  /** Non-anchor chapter (AMax / Dynasty / …) */
  isClientMode: boolean;
  /** Logged-in (or defaulting) as Anchor */
  isAnchorMode: boolean;
  chapterTag: string;
  chapterId: number;
  chapter: ChapterInfo | null;
  clientToken: string | null;
  authReady: boolean;
  isAuthenticated: boolean;
  loginError: string | null;
  login: (adminLogin: string, adminPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Preserve chapter context on admin links */
  adminHref: (path: string) => string;
};

const ChapterContext = createContext<ChapterContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.chapter?.tag) return null;
    if (parsed.expiresAtEpochMs && parsed.expiresAtEpochMs < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  localStorage.removeItem(LEGACY_SESSION_KEY);
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function ChapterProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  const [session, setSession] = useState<StoredSession | null>(() =>
    isAdminRoute ? readStoredSession() : null
  );
  const [authReady, setAuthReady] = useState(!isAdminRoute);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminRoute) {
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
  }, [isAdminRoute]);

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
      setActiveApiChapter({ id: result.chapter.id, tag: result.chapter.tag });
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
    setActiveApiChapter({ id: ANCHOR_CHAPTER_ID, tag: "anchor" });
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
      const tag = session?.chapter?.tag;
      if (!tag || tag === "anchor") return path;
      const url = new URL(path, "http://local");
      url.searchParams.set("client", "true");
      url.searchParams.set("chapter", tag);
      return `${url.pathname}${url.search}`;
    },
    [session?.chapter?.tag]
  );

  const value = useMemo<ChapterContextValue>(() => {
    const tagFromSession = session?.chapter?.tag;
    const tagFromQuery = searchParams.get("chapter")?.trim() || "";
    const chapterTag =
      tagFromSession ||
      (isAdminRoute ? tagFromQuery || "anchor" : "anchor");
    const chapterId =
      session?.chapter?.id ??
      CHAPTER_TAG_TO_ID[chapterTag] ??
      ANCHOR_CHAPTER_ID;
    const isAnchor = chapterTag === "anchor";
    return {
      isAdminRoute,
      isClientMode: isAdminRoute && !isAnchor,
      isAnchorMode: isAdminRoute && isAnchor && !!session?.token,
      chapterTag,
      chapterId,
      chapter: session?.chapter ?? null,
      clientToken: session?.token ?? null,
      authReady,
      isAuthenticated: !isAdminRoute || !!session?.token,
      loginError,
      login,
      logout,
      adminHref
    };
  }, [
    isAdminRoute,
    session,
    searchParams,
    authReady,
    loginError,
    login,
    logout,
    adminHref
  ]);

  // Keep module-level API scope in sync for both admin session and public `/?chapter=`.
  // Previously non-admin routes always cleared the tag, which wiped HomePage's amax binding
  // and caused check-in to load Anchor members/events.
  useEffect(() => {
    if (isAdminRoute) {
      if (session?.chapter) {
        setActiveApiChapter({ id: session.chapter.id, tag: session.chapter.tag });
      } else {
        const tagFromQuery = (searchParams.get("chapter") || "anchor").trim().toLowerCase() || "anchor";
        setActiveApiChapter({
          id: CHAPTER_TAG_TO_ID[tagFromQuery] ?? ANCHOR_CHAPTER_ID,
          tag: tagFromQuery
        });
      }
      return;
    }
    const publicTag = (searchParams.get("chapter") || "anchor").trim().toLowerCase() || "anchor";
    setActiveApiChapter({
      id: CHAPTER_TAG_TO_ID[publicTag] ?? ANCHOR_CHAPTER_ID,
      tag: publicTag
    });
  }, [isAdminRoute, session?.chapter, searchParams]);

  return <ChapterContext.Provider value={value}>{children}</ChapterContext.Provider>;
}

export function useChapter(): ChapterContextValue {
  const ctx = useContext(ChapterContext);
  if (!ctx) {
    throw new Error("useChapter must be used within ChapterProvider");
  }
  return ctx;
}
