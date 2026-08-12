import { useState } from "react";
import {
  bulkImport,
  bulkImportObservers,
  activateEvent,
  bulkSetPlannedSubstitutes,
  type ImportRecord,
} from "../api";
import { ensureEventForDate } from "../lib/meetingEventImport";
import {
  parseWhatsAppMeetingMessage,
  guestListToCsv,
  observerListToCsv,
  substituteListToCsv,
  downloadCsv,
  type ParsedMeetingMessage,
} from "../lib/parseWhatsAppMeetingMessage";

type WhatsAppMeetingImportPanelProps = {
  chapterTag: string;
  chapterId: number;
  chapterLabel: string;
  onImported?: () => void;
};

export function WhatsAppMeetingImportPanel({
  chapterTag,
  chapterId,
  chapterLabel,
  onImported,
}: WhatsAppMeetingImportPanelProps) {
  const [message, setMessage] = useState("");
  const [parsed, setParsed] = useState<ParsedMeetingMessage | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotice = (text: string) => {
    setNotification(text);
    window.setTimeout(() => setNotification(null), 5000);
  };

  const handleExtract = () => {
    const result = parseWhatsAppMeetingMessage(message);
    setParsed(result);
    if (result.errors.length > 0 && result.guests.length === 0 && result.observers.length === 0 && result.substitutes.length === 0) {
      showNotice(result.errors[0] ?? "解析失敗");
    } else {
      showNotice(
        `已解析：嘉賓 ${result.guests.length} 位、觀察員 ${result.observers.length} 位、替代 ${result.substitutes.length} 對` +
          (result.eventDate ? `（${result.eventDate}）` : "")
      );
    }
  };

  const handleDownloadGuestCsv = () => {
    if (!parsed?.guests.length) return;
    downloadCsv(`guest_list_${parsed.eventDate || "export"}.csv`, guestListToCsv(parsed.guests));
  };

  const handleDownloadObserverCsv = () => {
    if (!parsed?.observers.length) return;
    downloadCsv(
      `observer_list_${parsed.eventDate || "export"}.csv`,
      observerListToCsv(parsed.observers)
    );
  };

  const handleDownloadSubstituteCsv = () => {
    if (!parsed?.substitutes.length) return;
    downloadCsv(
      `substitute_list_${parsed.eventDate || "export"}.csv`,
      substituteListToCsv(parsed.substitutes)
    );
  };

  const handleImportAll = async () => {
    if (!parsed?.eventDate) {
      showNotice("缺少活動日期，無法匯入");
      return;
    }
    if (parsed.guests.length === 0 && parsed.observers.length === 0 && parsed.substitutes.length === 0) {
      showNotice("沒有可匯入的嘉賓、觀察員或替代人");
      return;
    }

    setIsWorking(true);
    try {
      const event = await ensureEventForDate(
        parsed.eventDate,
        chapterTag,
        chapterId,
        chapterLabel
      );
      await activateEvent(event.id, true, chapterTag, chapterId);

      let guestSummary = "";
      if (parsed.guests.length > 0) {
        const guestRecords: ImportRecord[] = parsed.guests.map((g) => ({
          name: g.name,
          profession: g.profession,
          phoneNumber: "",
          referrer: g.referrer,
          eventDate: g.eventDate,
          chapter: chapterTag,
        }));
        const guestResult = await bulkImport(
          { type: "guest", records: guestRecords },
          chapterTag,
          chapterId
        );
        guestSummary = `嘉賓 新增 ${guestResult.inserted}、更新 ${guestResult.updated}`;
      }

      let observerSummary = "";
      if (parsed.observers.length > 0) {
        const observerRecords: ImportRecord[] = parsed.observers.map((o) => ({
          name: o.name,
          profession: o.profession,
          eventDate: o.eventDate,
        }));
        const observerResult = await bulkImportObservers(observerRecords, chapterTag, chapterId);
        observerSummary = `觀察員 新增 ${observerResult.inserted}、更新 ${observerResult.updated}`;
      }

      let substituteSummary = "";
      if (parsed.substitutes.length > 0) {
        const subResult = await bulkSetPlannedSubstitutes(
          parsed.eventDate,
          parsed.substitutes.map((s) => ({
            memberName: s.memberName,
            substituteName: s.substituteName,
          })),
          chapterTag,
          chapterId
        );
        substituteSummary = `替代人 設定 ${subResult.updated} 對`;
      }

      showNotice(
        `✅ 已匯入 ${parsed.eventDate}：${[guestSummary, observerSummary, substituteSummary].filter(Boolean).join("；")}`
      );
      setMessage("");
      setParsed(null);
      onImported?.();
    } catch (error) {
      showNotice(`匯入失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className="section" style={{ marginTop: "2rem" }}>
      <div className="section-header">
        <h2>📱 WhatsApp 訊息批量匯入</h2>
        <p className="hint">
          貼上 Anchor 正式會議 WhatsApp 公告，自動提取嘉賓名單與觀察員、匯出 CSV、寫入資料庫（chapter={chapterTag}）
        </p>
      </div>

      {notification && (
        <p className="hint" style={{ color: "#15803d", marginBottom: "1rem" }}>
          {notification}
        </p>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="貼上 WhatsApp 會議公告（含 嘉賓名單、觀察員 段落）…"
        rows={12}
        style={{
          width: "100%",
          padding: "1rem",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          lineHeight: 1.6,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
        <button type="button" className="button" onClick={handleExtract} disabled={!message.trim()}>
          🔍 解析訊息
        </button>
        {parsed && parsed.guests.length > 0 && (
          <button type="button" className="ghost-button" onClick={handleDownloadGuestCsv}>
            📥 下載嘉賓 CSV
          </button>
        )}
        {parsed && parsed.observers.length > 0 && (
          <button type="button" className="ghost-button" onClick={handleDownloadObserverCsv}>
            📥 下載觀察員 CSV
          </button>
        )}
        {parsed && parsed.substitutes.length > 0 && (
          <button type="button" className="ghost-button" onClick={handleDownloadSubstituteCsv}>
            📥 下載替代人 CSV
          </button>
        )}
        {parsed && (parsed.guests.length > 0 || parsed.observers.length > 0 || parsed.substitutes.length > 0) && (
          <button
            type="button"
            className="button submit-button"
            onClick={() => void handleImportAll()}
            disabled={isWorking || !parsed.eventDate}
          >
            {isWorking ? "⏳ 匯入中…" : "🚀 匯入資料庫（嘉賓 + 觀察員 + 替代人）"}
          </button>
        )}
      </div>

      {parsed && (
        <div style={{ marginTop: "1.5rem" }}>
          {parsed.errors.length > 0 && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "1rem",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                fontSize: "0.875rem",
              }}
            >
              <strong>解析提示：</strong>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                {parsed.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.eventDate && (
            <p className="hint" style={{ marginBottom: "1rem" }}>
              活動日期：<strong>{parsed.eventDate}</strong>
            </p>
          )}

          {parsed.guests.length > 0 && (
            <>
              <h3 style={{ fontSize: "1rem" }}>嘉賓預覽 ({parsed.guests.length})</h3>
              <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>姓名</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>專業</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>介紹人</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.guests.map((g) => (
                    <tr key={g.name} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "0.5rem" }}>{g.name}</td>
                      <td style={{ padding: "0.5rem" }}>{g.profession}</td>
                      <td style={{ padding: "0.5rem" }}>{g.referrer || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {parsed.observers.length > 0 && (
            <>
              <h3 style={{ fontSize: "1rem" }}>觀察員預覽 ({parsed.observers.length})</h3>
              <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>姓名</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>專業</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.observers.map((o) => (
                    <tr key={o.name} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "0.5rem" }}>{o.name}</td>
                      <td style={{ padding: "0.5rem" }}>{o.profession}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {parsed.substitutes.length > 0 && (
            <>
              <h3 style={{ fontSize: "1rem" }}>替代人預覽 ({parsed.substitutes.length})</h3>
              <p className="hint" style={{ marginBottom: "0.75rem" }}>
                簽到頁會顯示 <strong>會員 (替代人)</strong>（例如 Zoe Wu (Wendy Cheung)）
              </p>
              <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>替代人</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>會員</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.substitutes.map((s) => (
                    <tr key={`${s.substituteName}-${s.memberName}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "0.5rem" }}>{s.substituteName}</td>
                      <td style={{ padding: "0.5rem" }}>{s.memberName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </section>
  );
}
