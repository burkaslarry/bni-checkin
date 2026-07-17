import { useEffect, useMemo, useState } from "react";
import { updateEvent, type EventData } from "../api";
import { QrFlyerContent } from "./QrFlyerContent";
import { ROOT_WEBSITE_URL } from "../lib/publicSiteUrl";
import { downloadEventQrFlyerPdf, eventToQrFlyerData } from "../lib/eventQrFlyerPdf";

type EventEditModalProps = {
  event: EventData;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: EventData) => void;
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export function EventEditModal({ event, open, onClose, onSaved, onNotify }: EventEditModalProps) {
  const [name, setName] = useState(event.name);
  const [startTime, setStartTime] = useState(event.startTime);
  const [endTime, setEndTime] = useState(event.endTime);
  const [saving, setSaving] = useState(false);
  const [includeEventDateInPdf, setIncludeEventDateInPdf] = useState(true);
  const [pdfCaptureEvent, setPdfCaptureEvent] = useState<EventData | null>(null);

  useEffect(() => {
    if (open) {
      setName(event.name);
      setStartTime(event.startTime);
      setEndTime(event.endTime);
      setPdfCaptureEvent(null);
    }
  }, [open, event]);

  const previewEvent: EventData = useMemo(
    () => pdfCaptureEvent ?? {
      ...event,
      name: name.trim() || event.name,
      startTime: startTime || event.startTime,
      endTime: endTime || event.endTime
    },
    [event, name, startTime, endTime, pdfCaptureEvent]
  );

  const qrData = useMemo(() => eventToQrFlyerData(previewEvent), [previewEvent]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      onNotify("活動名稱不可為空", "error");
      return;
    }
    if (!startTime) {
      onNotify("請設定活動開始時間", "error");
      return;
    }
    if (!endTime) {
      onNotify("請設定活動結束時間", "error");
      return;
    }
    const payload: { name?: string; startTime?: string; endTime?: string } = {};
    if (trimmedName !== event.name) payload.name = trimmedName;
    if (startTime !== event.startTime) payload.startTime = startTime;
    if (endTime !== event.endTime) payload.endTime = endTime;
    if (!payload.name && !payload.startTime && !payload.endTime) {
      onNotify("沒有變更", "info");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateEvent(event.id, payload);
      onSaved(updated);
      onNotify("活動已更新，正在產生 PDF…", "info");
      setPdfCaptureEvent(updated);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await downloadEventQrFlyerPdf(updated, "event-edit-qr-pdf");
      onNotify("活動已更新，PDF 已下載", "success");
      onClose();
    } catch (error) {
      onNotify("更新失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="modal-overlay event-edit-modal-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem"
        }}
        onClick={onClose}
      >
        <div
          className="modal-content event-edit-modal"
          style={{
            background: "var(--bg)",
            color: "var(--text)",
            borderRadius: "12px",
            padding: "1.5rem",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            border: "1px solid var(--border)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, color: "#fff" }}>✏️ 編輯活動</h3>
            <button type="button" className="ghost-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="edit-event-name" style={{ color: "var(--text)" }}>活動名稱</label>
            <input
              id="edit-event-name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ color: "var(--text)", background: "var(--panel)" }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-event-start" style={{ color: "var(--text)" }}>活動開始時間 Start Time</label>
            <input
              id="edit-event-start"
              className="input-field"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ color: "var(--text)", background: "var(--panel)" }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-event-end" style={{ color: "var(--text)" }}>🏁 活動結束 End Time</label>
            <input
              id="edit-event-end"
              className="input-field"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ color: "var(--text)", background: "var(--panel)" }}
            />
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label" htmlFor="edit-include-date-pdf">
              <input
                id="edit-include-date-pdf"
                type="checkbox"
                checked={includeEventDateInPdf}
                onChange={(e) => setIncludeEventDateInPdf(e.target.checked)}
              />
              <span className="checkbox-text">PDF 顯示活動日期</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "⏳ 儲存中…" : "💾 儲存並下載 PDF"}
            </button>
            <button type="button" className="ghost-button" disabled={saving} onClick={onClose}>
              取消
            </button>
          </div>
        </div>
      </div>

      {/* Off-screen DOM for PDF capture after save */}
      <div className="qr-pdf-capture-root" aria-hidden="true">
        <div className="qr-pdf-capture" id="event-edit-qr-pdf">
          <QrFlyerContent
            data={qrData}
            includeEventDate={includeEventDateInPdf}
            websiteUrl={ROOT_WEBSITE_URL}
            qrCodeId="qr-code-event-edit"
          />
        </div>
      </div>
    </>
  );
}
