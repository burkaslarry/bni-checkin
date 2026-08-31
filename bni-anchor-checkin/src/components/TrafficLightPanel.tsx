import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  generateTrafficLightReminder,
  getLatestTrafficLight,
  getMembers,
  uploadTrafficLightExcel,
  type MemberInfo,
  type TrafficLightReminder,
  type TrafficLightReport,
} from "../api";
import {
  analyzeGaps,
  buildReminderTexts,
  greenPathSummary,
  lightLabelZh,
  mailtoHref,
  meetingWeeks,
  toWhatsAppPhone,
  whatsappHref,
  type TrafficLight,
  type TrafficLightMetrics,
} from "../lib/trafficLight";
import { useChapter } from "../chapterContext";

type Filter = "ALL" | TrafficLight;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "全部" },
  { id: "GREEN", label: "綠燈" },
  { id: "YELLOW", label: "黃燈" },
  { id: "RED", label: "紅燈" },
  { id: "BLACK", label: "黑燈" },
];

function rowToMetrics(r: TrafficLightReport["rows"][number]): TrafficLightMetrics {
  return { ...r, light: r.light };
}

export function TrafficLightPanel({
  onNotify,
}: {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
}) {
  const { chapterTag, isAnchorMode } = useChapter();
  const [report, setReport] = useState<TrafficLightReport | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [reminder, setReminder] = useState<TrafficLightReminder | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [latest, memberRes] = await Promise.all([
        getLatestTrafficLight(chapterTag),
        getMembers(chapterTag).catch(() => ({ members: [] as MemberInfo[] })),
      ]);
      setReport(latest);
      setMembers(memberRes.members);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "載入紅綠燈失敗", "error");
    } finally {
      setLoading(false);
    }
  }, [chapterTag, onNotify]);

  useEffect(() => {
    if (isAnchorMode) void load();
  }, [isAnchorMode, load]);

  const memberByName = useMemo(() => {
    const map = new Map<string, MemberInfo>();
    for (const m of members) map.set(m.name.trim().toLowerCase(), m);
    return map;
  }, [members]);

  const counts = useMemo(() => {
    const c = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
    for (const r of report?.rows ?? []) c[r.light] += 1;
    return c;
  }, [report]);

  const visible = useMemo(() => {
    const rows = report?.rows ?? [];
    return filter === "ALL" ? rows : rows.filter((r) => r.light === filter);
  }, [report, filter]);

  const selectedRow = visible.find((r) => r.name === selected) ?? report?.rows.find((r) => r.name === selected);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      try {
        const saved = await uploadTrafficLightExcel(file, chapterTag);
        setReport(saved.report);
        onNotify(saved.message, "success");
      } catch (e) {
        onNotify(e instanceof Error ? e.message : "匯入失敗", "error");
      } finally {
        setUploading(false);
      }
    },
    [chapterTag, onNotify]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: uploading,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
  });

  const openMember = async (name: string) => {
    setSelected(name);
    setReminder(null);
    const row = report?.rows.find((r) => r.name === name);
    if (!row || !report) return;
    const metrics = rowToMetrics(row);
    const weeks = meetingWeeks(metrics, undefined);
    setReminder({
      name,
      light: row.light,
      totalPts: row.totalPts,
      ...buildReminderTexts(metrics, report.periodLabel, weeks),
      source: "template",
    });
    setReminderLoading(true);
    try {
      const ai = await generateTrafficLightReminder(name, chapterTag, report.periodLabel);
      setReminder(ai);
    } catch {
      /* keep template */
    } finally {
      setReminderLoading(false);
    }
  };

  if (!isAnchorMode) {
    return (
      <section className="section">
        <h2>🚦 會員紅綠燈</h2>
        <p className="hint">Member Traffic Light Excel 只開放俾 Anchor chapter。</p>
      </section>
    );
  }

  const contact = selected
    ? memberByName.get(selected.trim().toLowerCase())
    : undefined;
  const waPhone = toWhatsAppPhone(contact?.phoneNumber);
  const metrics = selectedRow ? rowToMetrics(selectedRow) : null;
  const weeks = metrics ? meetingWeeks(metrics) : 26;
  const gaps = metrics ? analyzeGaps(metrics, weeks) : [];

  return (
    <section className="section traffic-light-panel">
      <div className="section-header">
        <h2>🚦 Anchor 會員紅綠燈</h2>
        <p className="hint">
          上傳 BNI Member Traffic Light Excel。綠燈 ≥70 分：少缺席、準時、每週 1.5 筆引薦、0.75 位嘉賓、每週 1 次 1-2-1、2 個 Skills Module、TYFCB HK$500,000。
        </p>
      </div>

      <div {...getRootProps()} className={`traffic-dropzone${isDragActive ? " is-active" : ""}`}>
        <input {...getInputProps()} />
        {uploading ? "匯入中…" : "拖放或點擊上傳 Member Traffic Light Excel（.xlsx）— 只限 Anchor"}
      </div>

      {loading ? (
        <p className="hint">載入中…</p>
      ) : report ? (
        <>
          <p className="traffic-period">
            <strong>{report.periodLabel}</strong>
            {report.filename ? ` · ${report.filename}` : ""}
          </p>
          <div className="traffic-summary">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`traffic-chip traffic-chip--${f.id.toLowerCase()}${filter === f.id ? " is-on" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {f.id === "ALL"
                  ? ` ${report.rows.length}`
                  : ` ${counts[f.id]}`}
              </button>
            ))}
          </div>

          <div className="traffic-layout">
            <ul className="traffic-list">
              {visible.map((row) => (
                <li key={row.name}>
                  <button
                    type="button"
                    className={`traffic-row${selected === row.name ? " is-selected" : ""}`}
                    onClick={() => void openMember(row.name)}
                  >
                    <span className={`traffic-dot traffic-dot--${row.light.toLowerCase()}`} />
                    <span className="traffic-name">{row.name}</span>
                    <span className="traffic-pts">{row.totalPts} 分</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="traffic-detail">
              {selectedRow && metrics && reminder ? (
                <>
                  <h3>
                    <span className={`traffic-dot traffic-dot--${selectedRow.light.toLowerCase()}`} />
                    {selectedRow.name} · {lightLabelZh(selectedRow.light)} · {selectedRow.totalPts} 分
                  </h3>
                  <p className="hint">{greenPathSummary(metrics, weeks)}</p>
                  <ul className="traffic-gaps">
                    {gaps.map((g) => (
                      <li key={g.key}>
                        <strong>
                          {g.labelZh} {g.currentScore}/{g.maxScore}
                        </strong>
                        <span>
                          {g.currentLabel} — {g.suggestionZh}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="hint">
                    {reminderLoading ? "DeepSeek 撰寫緊建議…" : `通知稿來源：${reminder.source === "deepseek" ? "DeepSeek" : "範本"}`}
                  </p>
                  <textarea
                    className="input-field traffic-draft"
                    readOnly
                    rows={8}
                    value={reminder.whatsappText}
                  />
                  <div className="traffic-actions">
                    {waPhone ? (
                      <a
                        className="button button-whatsapp"
                        href={whatsappHref(waPhone, reminder.whatsappText)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp 通知
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => {
                          void navigator.clipboard.writeText(reminder.whatsappText);
                          onNotify("已複製 WhatsApp 訊息；會員未有電話，請喺會員管理補上", "info");
                        }}
                      >
                        複製 WhatsApp 訊息
                      </button>
                    )}
                    {contact?.email ? (
                      <a className="button" href={mailtoHref(contact.email, reminder.emailSubject, reminder.emailBody)}>
                        Email 通知
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            `${reminder.emailSubject}\n\n${reminder.emailBody}`
                          );
                          onNotify("已複製電郵稿；會員未有 email", "info");
                        }}
                      >
                        複製電郵稿
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="hint">揀一位會員，睇點樣做到綠燈，再用 WhatsApp / Email 逐位通知。</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="hint">未有報告。請上傳 2026-05 / 06 / 07 嘅 Member Traffic Light Excel。</p>
      )}
    </section>
  );
}
