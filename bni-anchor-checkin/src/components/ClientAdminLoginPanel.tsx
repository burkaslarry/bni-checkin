import { FormEvent, useState } from "react";
import { useChapter } from "../chapterContext";

export function ClientAdminLoginPanel() {
  const { login, loginError } = useChapter();
  const [adminLogin, setAdminLogin] = useState("");
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
        <h2>其他 Chapter 管理登入</h2>
        <p className="hint">
          此入口供非 Anchor chapter（例如 AMax、Dynasty）使用。請輸入章節 AdminLogin / AdminPassword。
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
            placeholder="amax"
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
