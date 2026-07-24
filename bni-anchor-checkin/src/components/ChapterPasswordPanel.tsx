import { FormEvent, useEffect, useState } from "react";
import {
  listChapters,
  updateChapterAdminPassword,
  type ChapterInfo
} from "../api";
import { useChapter } from "../chapterContext";

type ChapterPasswordPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

/** Anchor-only: reset AdminPassword for other chapters. */
export function ChapterPasswordPanel({ onNotify }: ChapterPasswordPanelProps) {
  const { clientToken, isAnchorMode } = useChapter();
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetTag, setTargetTag] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await listChapters();
        if (cancelled) return;
        const others = (result.chapters ?? []).filter(
          (c) => c.tag.toLowerCase() !== "anchor"
        );
        setChapters(others);
        if (others.length > 0) {
          setTargetTag((prev) => prev || others[0].tag);
        }
      } catch (e) {
        if (!cancelled) {
          onNotify(
            `無法載入 chapter 列表: ${e instanceof Error ? e.message : "錯誤"}`,
            "error"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onNotify]);

  if (!isAnchorMode) {
    return (
      <section className="section admin-panel">
        <p className="error-text">只有 Anchor 管理員可以重設其他 chapter 密碼。</p>
      </section>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientToken) {
      onNotify("未登入或 session 已失效，請重新登入", "error");
      return;
    }
    if (!targetTag) {
      onNotify("請選擇 chapter", "error");
      return;
    }
    if (password.length < 8) {
      onNotify("密碼至少 8 個字元", "error");
      return;
    }
    if (password !== confirm) {
      onNotify("兩次輸入的密碼不一致", "error");
      return;
    }
    setSubmitting(true);
    try {
      const result = await updateChapterAdminPassword(clientToken, targetTag, password);
      onNotify(
        `已更新 ${result.chapter.displayName || result.chapter.tag} 的 AdminPassword`,
        "success"
      );
      setPassword("");
      setConfirm("");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "更新失敗", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section admin-panel client-login-panel">
      <div className="section-header">
        <h2>Chapter 密碼管理</h2>
        <p className="hint">
          以 Anchor 身份重設其他 chapter 的 AdminPassword（例如 <code>amax</code>）。不會改動 AdminLogin。
        </p>
      </div>
      {loading ? (
        <p className="hint">載入 chapter 列表…</p>
      ) : chapters.length === 0 ? (
        <p className="hint">目前沒有其他 active chapter 可重設。</p>
      ) : (
        <form className="client-login-form" onSubmit={onSubmit}>
          <label>
            Chapter
            <select
              className="input-field"
              value={targetTag}
              onChange={(e) => setTargetTag(e.target.value)}
              required
            >
              {chapters.map((c) => (
                <option key={c.tag} value={c.tag}>
                  {c.displayName} ({c.tag})
                </option>
              ))}
            </select>
          </label>
          <label>
            新 AdminPassword
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="至少 8 個字元"
              minLength={8}
              required
            />
          </label>
          <label>
            確認密碼
            <input
              className="input-field"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="再輸入一次"
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "更新中…" : "更新密碼"}
          </button>
        </form>
      )}
    </section>
  );
}
