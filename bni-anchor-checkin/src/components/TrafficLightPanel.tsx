import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  generateTrafficLightReminder,
  getMembers,
  getTrafficLightReport,
  listTrafficLightReports,
  uploadTrafficLightExcel,
  type MemberInfo,
  type TrafficLightHistoryItem,
  type TrafficLightReminder,
  type TrafficLightReport,
} from "../api";
import {
  analyzeGaps,
  buildChapterLtStats,
  buildReminderTexts,
  formatGreenPctDelta,
  formatUploadAt,
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

/** Map API row onto scoring helpers (light is already GREEN|YELLOW|RED|BLACK). */
function rowToMetrics(r: TrafficLightReport["rows"][number]): TrafficLightMetrics {
  return { ...r, light: r.light };
}

function formatHkd(n: number): string {
  return `HK$${Math.round(n).toLocaleString("en-US")}`;
}

function rateOk(value: number, goal: number): boolean {
  return value + 1e-9 >= goal;
}

/**
 * Admin: upload Anchor Traffic Light Excel, pick a historical snapshot, show LT board-pack
 * stats, then coach per member (WhatsApp / email drafts).
 *
 * Side effects: POST upload, GET reports/latest-by-id, GET members, POST reminder.
 * Does not send WhatsApp/email itself. Viewing history does not rewrite member standing.
 *
 * @param onNotify toast for upload/reminder success or error
 */
export function TrafficLightPanel({
  onNotify,
}: {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
}) {
  const { chapterTag, isAnchorMode } = useChapter();
  const [history, setHistory] = useState<TrafficLightHistoryItem[]>([]);
  const [report, setReport] = useState<TrafficLightReport | null>(null);
  const [previousRows, setPreviousRows] = useState<TrafficLightMetrics[] | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [reminder, setReminder] = useState<TrafficLightReminder | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);

  const applySnapshot = useCallback(
    async (id: number, items: TrafficLightHistoryItem[]) => {
      const idx = items.findIndex((h) => h.id === id);
      const older = idx >= 0 ? items[idx + 1] : undefined;
      const [full, prev] = await Promise.all([
        getTrafficLightReport(id, chapterTag),
        older
          ? getTrafficLightReport(older.id, chapterTag).catch(() => null)
          : Promise.resolve(null),
      ]);
      setReport(full);
      setPreviousRows(prev ? prev.rows.map(rowToMetrics) : null);
      setSelected(null);
      setReminder(null);
    },
    [chapterTag]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, memberRes] = await Promise.all([
        listTrafficLightReports(chapterTag),
        getMembers(chapterTag).catch(() => ({ members: [] as MemberInfo[] })),
      ]);
      setHistory(items);
      setMembers(memberRes.members);
      if (items[0]) {
        await applySnapshot(items[0].id, items);
      } else {
        setReport(null);
        setPreviousRows(null);
      }
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "載入紅綠燈失敗", "error");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, chapterTag, onNotify]);

  useEffect(() => {
    if (isAnchorMode) void load();
  }, [isAnchorMode, load]);

  const memberByName = useMemo(() => {
    const map = new Map<string, MemberInfo>();
    for (const m of members) map.set(m.name.trim().toLowerCase(), m);
    return map;
  }, [members]);

  const metricsRows = useMemo(
    () => (report?.rows ?? []).map(rowToMetrics),
    [report]
  );

  const stats = useMemo(
    () => buildChapterLtStats(metricsRows, members.map((m) => m.name), previousRows),
    [metricsRows, members, previousRows]
  );

  const latestId = history[0]?.id ?? null;
  const isLatest = report != null && latestId != null && report.id === latestId;

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
        onNotify(saved.message, "success");
        const items = await listTrafficLightReports(chapterTag);
        setHistory(items);
        setReport(saved.report);
        const older = items.find((h) => h.id !== saved.report.id);
        if (older) {
          const prev = await getTrafficLightReport(older.id, chapterTag).catch(() => null);
          setPreviousRows(prev ? prev.rows.map(rowToMetrics) : null);
        } else {
          setPreviousRows(null);
        }
        setSelected(null);
        setReminder(null);
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
      const ai = await generateTrafficLightReminder(name, chapterTag, report.periodLabel, report.id);
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
  const greenDelta = stats.vsPrev
    ? formatGreenPctDelta(stats.pct.GREEN, stats.pct.GREEN - stats.vsPrev.greenPctPts)
    : null;

  return (
    <section className="section traffic-light-panel">
      <div className="section-header">
        <h2>🚦 Anchor 會員紅綠燈</h2>
        <p className="hint">
          上傳 BNI Member Traffic Light Excel。綠燈 ≥70 分：少缺席、準時、每週 1.5 筆引薦、0.75 位嘉賓、每週 1 次 1-2-1、2 個 Skills Module、TYFCB HK$500,000。
          再 upload 同一月份會新增一筆歷史，畫面只計你揀嘅嗰份，唔會加疊人數。
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
          <div className="traffic-board">
            <div className="traffic-history">
              <h3>上傳歷史</h3>
              <p className="hint">揀一份 Excel 睇統計。PDF 唔會存。會員 standing 只喺最新 upload 先更新。</p>
              <ul>
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`traffic-history-row${report.id === item.id ? " is-selected" : ""}`}
                      onClick={() => void applySnapshot(item.id, history)}
                    >
                      <span className="traffic-history-title">{item.periodLabel}</span>
                      <span className="traffic-history-meta">
                        {item.filename || "（無檔名）"}
                        {item.createdAt ? ` · ${formatUploadAt(item.createdAt)}` : ""}
                        {` · ${item.rowCount} 人`}
                        {latestId === item.id ? " · 最新" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="traffic-lt">
              <p className="traffic-period">
                <strong>{report.periodLabel}</strong>
                {report.filename ? ` · ${report.filename}` : ""}
                {report.createdAt ? ` · 上傳 ${formatUploadAt(report.createdAt)}` : ""}
                {!isLatest ? " · 睇緊歷史" : ""}
              </p>
              {greenDelta ? <p className="hint">{greenDelta}{stats.vsPrev ? ` · 轉好 ${stats.vsPrev.improved} 人 · 轉差 ${stats.vsPrev.worsened} 人` : ""}</p> : null}

              <div className="traffic-lt-grid">
                <div className="traffic-lt-stat">
                  <span>綠燈</span>
                  <strong>{stats.pct.GREEN}%</strong>
                  <em>{stats.counts.GREEN} 人</em>
                </div>
                <div className="traffic-lt-stat">
                  <span>黃燈</span>
                  <strong>{stats.pct.YELLOW}%</strong>
                  <em>{stats.counts.YELLOW} 人</em>
                </div>
                <div className="traffic-lt-stat">
                  <span>紅燈</span>
                  <strong>{stats.pct.RED}%</strong>
                  <em>{stats.counts.RED} 人</em>
                </div>
                <div className="traffic-lt-stat">
                  <span>黑燈</span>
                  <strong>{stats.pct.BLACK}%</strong>
                  <em>{stats.counts.BLACK} 人</em>
                </div>
                <div className="traffic-lt-stat">
                  <span>出席率</span>
                  <strong>{stats.attendanceRatePct}%</strong>
                  <em>P / 會議次數</em>
                </div>
                <div className={`traffic-lt-stat${rateOk(stats.referralsPerWeek, 1.5) ? " is-ok" : ""}`}>
                  <span>引薦 / 週</span>
                  <strong>{stats.referralsPerWeek.toFixed(2)}</strong>
                  <em>目標 1.5</em>
                </div>
                <div className={`traffic-lt-stat${rateOk(stats.visitorsPerWeek, 0.75) ? " is-ok" : ""}`}>
                  <span>嘉賓 / 週</span>
                  <strong>{stats.visitorsPerWeek.toFixed(2)}</strong>
                  <em>目標 0.75</em>
                </div>
                <div className={`traffic-lt-stat${rateOk(stats.oneToOnesPerWeek, 1) ? " is-ok" : ""}`}>
                  <span>1-2-1 / 週</span>
                  <strong>{stats.oneToOnesPerWeek.toFixed(2)}</strong>
                  <em>目標 1.0</em>
                </div>
                <div className="traffic-lt-stat">
                  <span>TYFCB 總額</span>
                  <strong>{formatHkd(stats.tyfcbTotal)}</strong>
                  <em>中位數 {formatHkd(stats.tyfcbMedian)}</em>
                </div>
                <div className={`traffic-lt-stat${stats.trainingPct >= 80 ? " is-ok" : ""}`}>
                  <span>≥2 Skills Module</span>
                  <strong>{stats.trainingPct}%</strong>
                  <em>{stats.weeks} 週口徑</em>
                </div>
              </div>

              <div className="traffic-lt-lists">
                <div>
                  <h4>At-risk（紅 + 黑）</h4>
                  {stats.atRisk.length === 0 ? (
                    <p className="hint">呢份報告冇紅/黑燈。</p>
                  ) : (
                    <ul>
                      {stats.atRisk.map((m) => (
                        <li key={m.name}>
                          <button type="button" className="linkish" onClick={() => void openMember(m.name)}>
                            {m.name} · {lightLabelZh(m.light)} · {m.totalPts} 分
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4>引薦失衡（收 − 俾 ≥ 5）</h4>
                  {stats.referralImbalance.length === 0 ? (
                    <p className="hint">冇明顯失衡。</p>
                  ) : (
                    <ul>
                      {stats.referralImbalance.map((m) => (
                        <li key={m.name}>
                          {m.name}：收 {m.received} / 俾 {m.given}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4>對唔到名</h4>
                  <p className="hint">
                    Excel 冇喺會員名單：{stats.unmatchedExcel.length ? stats.unmatchedExcel.join("、") : "無"}
                  </p>
                  <p className="hint">
                    會員名單冇喺 Excel：{stats.unmatchedRoster.length ? stats.unmatchedRoster.join("、") : "無"}
                  </p>
                </div>
              </div>
            </div>
          </div>

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
                  : ` ${stats.counts[f.id]}`}
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
        <p className="hint">未有報告。請上傳 Member Traffic Light Excel（.xlsx）。</p>
      )}
    </section>
  );
}
