import { useEffect, useMemo, useState } from "react";
import { createPublicGuest, getEventById, getMembers, getPublicCaptcha, type EventData, MemberInfo, PublicCaptchaChallenge } from "../api";

type Props = {};

export default function PublicGuestWalkinPage({}: Props) {
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [referrer, setReferrer] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const [eventId, setEventId] = useState<number | null>(null);
  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [eventDetailsLoading, setEventDetailsLoading] = useState(false);

  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const [captcha, setCaptcha] = useState<PublicCaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  const captchaQuestion = useMemo(() => {
    if (!captcha) return "";
    return `${captcha.a} ${captcha.op} ${captcha.b} = ?`;
  }, [captcha]);

  const refreshCaptcha = async () => {
    setCaptchaLoading(true);
    setError(null);
    try {
      const c = await getPublicCaptcha();
      setCaptcha(c);
      setCaptchaAnswer("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法載入驗證題目");
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    void refreshCaptcha();
  }, []);

  // Optional: prefer eventID via public link: /public/guest?eventID=123
  // Backward compatibility: still allow old ?eventDate=YYYY-MM-DD links.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get("eventID") ?? params.get("eventId");
    const id = rawId ? Number(rawId) : NaN;
    if (Number.isFinite(id) && id > 0) {
      setEventId(id);
      return;
    }
    const d = params.get("eventDate");
    if (d && /^\\d{4}-\\d{2}-\\d{2}$/.test(d)) setEventDate(d);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEvent = async () => {
      if (!eventId) return;
      setEventDetailsLoading(true);
      setError(null);
      try {
        const ev = await getEventById(eventId);
        if (!cancelled) {
          setEventDetails(ev);
          if (ev?.date) setEventDate(ev.date);
        }
      } catch (e) {
        if (!cancelled) {
          setEventDetails(null);
          setError(e instanceof Error ? e.message : "無法載入活動資料");
        }
      } finally {
        if (!cancelled) setEventDetailsLoading(false);
      }
    };
    void loadEvent();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      setMembersLoading(true);
      try {
        const res = await getMembers();
        if (!cancelled) setMembers(res.members ?? []);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    };
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedProfession = profession.trim();
    const trimmedPhone = phoneNumber.trim();
    const trimmedEventDate = eventDate.trim();
    const trimmedReferrer = referrer.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedName || !trimmedProfession || !trimmedPhone || (!eventId && !trimmedEventDate)) {
      setError("請填寫必填欄位：姓名、專業、電話、活動");
      return;
    }
    if (!captcha) {
      setError("驗證題目未準備好，請重試");
      return;
    }

    const answer = Number(captchaAnswer);
    if (!Number.isFinite(answer)) {
      setError("請輸入驗證題目的答案（數字）");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createPublicGuest({
        name: trimmedName,
        profession: trimmedProfession,
        phoneNumber: trimmedPhone,
        referrer: trimmedReferrer || undefined,
        eventId: eventId ?? undefined,
        eventDate: eventId ? undefined : trimmedEventDate,
        notes: trimmedNotes || undefined,
        captcha: {
          a: captcha.a,
          b: captcha.b,
          op: captcha.op,
          nonce: captcha.nonce,
          signature: captcha.signature,
          answer
        }
      });
      setSuccessName(res.guest.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失敗");
      // Refresh captcha on any failure to reduce replay/bot attempts
      await refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  if (successName) {
    return (
      <div className="app-shell">
        <header className="site-header">
          <div>
            <p className="hint">EventXP for BNI Anchor</p>
            <h1>✅ 已成功登記</h1>
            <p className="hint">多謝 {successName}！你已完成嘉賓登記。</p>
          </div>
        </header>
        <section className="section">
          <p className="hint">你可以關閉此頁面。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="hint">EventXP for BNI Anchor</p>
          <h1>🎫 嘉賓現場登記</h1>
          <p className="hint">Public link（無需登入）</p>
        </div>
      </header>

      <section className="section">
        <div className="section-header">
          <h2>填寫資料</h2>
          <p className="hint">請確保係人手填寫（驗證題目必填）</p>
        </div>

        {error && (
          <div className="notification notification-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: 560 }}>
          <div className="form-group">
            <label>活動資料（只顯示）</label>
            <div className="input-field" style={{ display: "grid", gap: "0.25rem", background: "rgba(255,255,255,0.04)" }}>
              {eventId ? (
                eventDetailsLoading ? (
                  <div className="hint">載入活動資料中...</div>
                ) : eventDetails ? (
                  <>
                    <div>
                      <strong>{eventDetails.name}</strong>
                    </div>
                    <div className="hint" style={{ margin: 0 }}>
                      日期：{eventDetails.date}　開始：{eventDetails.startTime}
                    </div>
                  </>
                ) : (
                  <div className="hint">未能載入活動資料（請檢查連結 eventId）</div>
                )
              ) : (
                <div className="hint">未指定 eventId（可用 link 參數：?eventID=123）</div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>姓名 Full Name *</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label>專業 / 公司職能 Profession *</label>
            <input className="input-field" value={profession} onChange={(e) => setProfession(e.target.value)} />
          </div>

          <div className="form-group">
            <label>電話 Phone *</label>
            <input className="input-field" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} inputMode="tel" />
          </div>

          <div className="form-group">
            <label>邀請人 Referrer</label>
            <select
              className="input-field"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              disabled={membersLoading}
            >
              <option value="">{membersLoading ? "載入會員名單中..." : "（選填）請選擇邀請人"}</option>
              {members
                .map((m) => m.name)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, "zh-Hant"))
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
            <p className="hint" style={{ margin: 0 }}>
              會從 Anchor 會員名單載入；如載入失敗可稍後重試。
            </p>
          </div>

          {!eventId && (
            <div className="form-group">
              <label>活動日期 Event Date *</label>
            <input
              className="input-field"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              disabled={!!eventId}
              title={eventId ? "此欄位由 eventId 決定（只讀）" : undefined}
            />
            {eventId && (
              <p className="hint" style={{ margin: 0 }}>
                已使用 eventId 固定活動日期（只讀）。
              </p>
            )}
            </div>
          )}

          <div className="form-group">
            <label>備註 Notes</label>
            <textarea className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="form-group">
            <label>驗證題目（防止機械人）*</label>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderRadius: 10,
                  border: "1px solid var(--border-color)",
                  background: "var(--card-bg)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>請計算（填右邊答案）</div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: 0.3 }}>
                    {captchaLoading ? "載入中…" : captchaQuestion || "未載入題目（請按重新出題）"}
                  </div>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void refreshCaptcha()}
                  disabled={captchaLoading}
                  style={{ whiteSpace: "nowrap" }}
                >
                  重新出題
                </button>
              </div>

              <input
                className="input-field"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                inputMode="numeric"
                placeholder="答案（例如：12）"
              />
              <p className="hint" style={{ margin: 0 }}>
                例子：如果顯示「7 + 5 = ?」，就輸入 <strong>12</strong>。
              </p>
            </div>
          </div>

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "提交中..." : captchaLoading ? "載入驗證題目中..." : "提交登記"}
          </button>
        </form>
      </section>
    </div>
  );
}

