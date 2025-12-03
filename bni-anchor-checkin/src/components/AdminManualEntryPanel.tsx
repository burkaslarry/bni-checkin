import { useState } from "react";
import { checkIn } from "../api";

type AdminManualEntryPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export const AdminManualEntryPanel = ({ onNotify }: AdminManualEntryPanelProps) => {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentTime = new Date().toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const handleSubmit = async () => {
    if (!name.trim()) {
      onNotify("請輸入姓名", "error");
      return;
    }
    if (!domain.trim()) {
      onNotify("請輸入專業領域", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await checkIn({
        name: name.trim(),
        type: isGuest ? "guest" : "member",
        domain: domain.trim(),
        currentTime: new Date().toISOString()
      });

      if (result.status === "success") {
        onNotify(`✅ ${name} 簽到成功！`, "success");
        setName("");
        setDomain("");
        setIsGuest(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      let message = "簽到失敗";
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          message = parsed.message || error.message;
        } catch {
          message = error.message;
        }
      }
      onNotify(`❌ ${message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = name.trim().length > 0 && domain.trim().length > 0;

  return (
    <section className="section manual-entry-panel">
      <div className="section-header">
        <h2>✍️ 管理員手動輸入</h2>
        <p className="hint">直接新增簽到記錄</p>
      </div>

      <div className="form-group">
        <label htmlFor="admin-name">姓名 Name *</label>
        <input
          id="admin-name"
          className="input-field"
          placeholder="請輸入姓名..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="form-group">
        <label htmlFor="admin-domain">專業領域 Domain *</label>
        <input
          id="admin-domain"
          className="input-field"
          placeholder="例如: 網頁設計、會計服務..."
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isGuest}
            onChange={(e) => setIsGuest(e.target.checked)}
          />
          <span className="checkbox-text">🎫 嘉賓 Guest</span>
        </label>
        <p className="hint">勾選表示為嘉賓，否則為會員</p>
      </div>

      <div className="form-group">
        <label>簽到時間 Check-in Time</label>
        <div className="time-display">
          🕐 {currentTime}
        </div>
        <p className="hint">系統將自動記錄當前時間</p>
      </div>

      <div className="preview-card">
        <h4>📋 簽到預覽</h4>
        <div className="preview-row">
          <span className="preview-label">姓名:</span>
          <span className="preview-value">{name || "—"}</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">專業領域:</span>
          <span className="preview-value">{domain || "—"}</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">類型:</span>
          <span className={`type-badge ${isGuest ? "guest" : "member"}`}>
            {isGuest ? "🎫 嘉賓" : "👤 會員"}
          </span>
        </div>
      </div>

      <button
        className="button submit-button"
        type="button"
        onClick={handleSubmit}
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? "處理中..." : "✅ 確認新增"}
      </button>
    </section>
  );
};

