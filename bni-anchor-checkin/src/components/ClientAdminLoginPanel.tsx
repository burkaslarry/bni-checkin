import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useChapter } from "../chapterContext";

/** Unified admin login for Anchor and other chapters. */
export function ClientAdminLoginPanel() {
  const { login, loginError } = useChapter();
  const [searchParams] = useSearchParams();
  const suggested =
    searchParams.get("chapter")?.trim() ||
    (searchParams.get("client") === "true" || searchParams.get("client") === "1"
      ? "amax"
      : "anchor");
  const [adminLogin, setAdminLogin] = useState(suggested);
  const [adminPassword, setAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(adminLogin.trim(), adminPassword);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section admin-panel client-login-panel">
      <div className="section-header">
        <h2>EventXP 管理登入</h2>
        <p className="hint">
          請輸入分會 AdminLogin / AdminPassword。例如 Anchor 用 <code>anchor</code>，AMax 用{" "}
          <code>amax</code>。
        </p>
      </div>
      <form className="client-login-form" onSubmit={onSubmit}>
        <label>
          AdminLogin
          <input
            className="input-field"
            value={adminLogin}
            onChange={(e) => setAdminLogin(e.target.value)}
            autoComplete="username"
            placeholder="anchor"
            required
          />
        </label>
        <label>
          AdminPassword
          <input
            className="input-field"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </label>
        {loginError && <p className="error-text">{loginError}</p>}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "登入中…" : "登入"}
        </button>
      </form>
    </section>
  );
}
