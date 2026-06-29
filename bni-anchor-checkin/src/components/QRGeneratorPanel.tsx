import { useState, useMemo, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createEvent, activateEvent, clearAllEventsAndAttendance, normalizeApiEventId, type EventData } from "../api";
import { generateQrFlyerPdfBlob } from "../lib/generateQrFlyerPdf";
import { QrFlyerContent } from "./QrFlyerContent";

type QRGeneratorPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

// Root website URL for QR codes - always points to production check-in site
const ROOT_WEBSITE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_URL) ||
  "https://bni-anchor-checkin.vercel.app";

// Helper function to add minutes to a time string (HH:mm format)
const addMinutesToTime = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
};

const formatLocalYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/*
 * Week = Monday–Sunday (typical chapter cadence). Return the calendar Thursday in the same week as `ref`.
 */
const thursdayOfWeekContaining = (ref: Date): Date => {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = d.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday + 3);
  return d;
};

export const QRGeneratorPanel = ({ onNotify }: QRGeneratorPanelProps) => {
  const meetingDefaults = useMemo(() => {
    const ymd = formatLocalYmd(thursdayOfWeekContaining(new Date()));
    return {
      name: `BNI Anchor Regular Meeting ${ymd}`,
      date: ymd
    };
  }, []);

  const [eventName, setEventName] = useState(meetingDefaults.name);
  const [eventDate, setEventDate] = useState(meetingDefaults.date);
  const [registrationStartTime, setRegistrationStartTime] = useState("06:30");
  const [startTime, setStartTime] = useState("07:00");
  const [onTimeCutoff, setOnTimeCutoff] = useState("07:05");
  const [endTime, setEndTime] = useState("09:00");
  const [isCreating, setIsCreating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSharingEmail, setIsSharingEmail] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [includeEventDateInPdf, setIncludeEventDateInPdf] = useState(true);

  // Auto-calculate times when registration start time changes
  const handleRegistrationStartChange = useCallback((newTime: string) => {
    setRegistrationStartTime(newTime);
    // Start Time = Registration Start + 30 minutes
    setStartTime(addMinutesToTime(newTime, 30));
    // On-time Cutoff = Registration Start + 35 minutes
    setOnTimeCutoff(addMinutesToTime(newTime, 35));
    // End Time = Registration Start + 150 minutes (2.5 hours)
    setEndTime(addMinutesToTime(newTime, 150));
  }, []);

  const handleClearAllEventsAndAttendance = async () => {
    setIsClearing(true);
    try {
      await clearAllEventsAndAttendance();
      onNotify("已清除所有活動和簽到記錄", "success");
      setShowClearConfirm(false);
    } catch (error) {
      onNotify("清除失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setIsClearing(false);
    }
  };

  const qrData = useMemo(() => {
    if (!eventName.trim() || !eventDate) return null;
    return {
      eventName: eventName.trim(),
      eventDate: eventDate,
      startTime: startTime,
      endTime: endTime,
      registrationStartTime: registrationStartTime,
      onTimeCutoff: onTimeCutoff
    };
  }, [eventName, eventDate, startTime, endTime, registrationStartTime, onTimeCutoff]);

  const qrString = qrData ? JSON.stringify(qrData) : "";

  /**
   * Persist a new event, then try to make it the server "current" event (check-in / guests / export follow that).
   *
   * - API id may be number or string; normalize before activate.
   * - If activate fails with 501 / "DB mode required" (in-memory backend), we still show success without treating it as an error.
   * - On success we keep the existing behaviour: download the PDF flyer next.
   */
  const handleCreateEvent = async () => {
    if (!qrData) {
      onNotify("請先輸入活動資訊", "error");
      return;
    }
    setIsCreating(true);
    try {
      const result = await createEvent(
        qrData.eventName,
        qrData.eventDate,
        qrData.startTime,
        qrData.endTime,
        qrData.registrationStartTime,
        qrData.onTimeCutoff
      );
      const newId = normalizeApiEventId((result.event as EventData | undefined)?.id);

      let becameCurrent = false;
      let activateFailMsg: string | null = null;
      if (newId !== undefined) {
        try {
          await activateEvent(newId, true);
          becameCurrent = true;
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          const noDbMode = /501|DB mode required|Not Implemented|not implemented/i.test(m);
          if (!noDbMode) activateFailMsg = m;
        }
      }

      if (activateFailMsg) {
        onNotify(
          `✅ 活動已建立成功，但未能設為當前活動：${activateFailMsg}`,
          "info"
        );
      } else {
        onNotify(
          becameCurrent
            ? "✅ 活動已建立成功，已設為當前活動（簽到／嘉賓／匯出會用此活動）。所有會員已設為預設缺席。"
            : "✅ 活動已建立成功！所有會員已設為預設缺席狀態。",
          "success"
        );
      }
      handleDownloadPDF()
    } catch (error) {
      onNotify("建立活動失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!qrString) {
      onNotify("請先輸入活動資訊", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(qrString);
      onNotify("QR 字串已複製到剪貼簿", "success");
    } catch {
      onNotify("複製失敗，請手動複製", "error");
    }
  };

  const handleDownload = () => {
    if (!qrString) {
      onNotify("請先輸入活動資訊", "error");
      return;
    }
    // Use the event check-in QR code
    const svg = document.getElementById("qr-code-website");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx?.drawImage(img, 0, 0, 300, 300);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Event-${eventDate}.png`;
      link.href = pngUrl;
      link.click();
      onNotify("QR 碼已下載", "success");
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const generatePDFBlob = async (): Promise<Blob> => {
    if (!qrString || !qrData) {
      throw new Error("請先輸入活動資訊");
    }

    const element = document.getElementById("qr-pdf");
    if (!element) {
      throw new Error("QR preview not found");
    }

    return generateQrFlyerPdfBlob(element);
  };

  const handleDownloadPDF = async () => {
    try {
      const pdfBlob = await generatePDFBlob();
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.download = `BNI-Anchor-${qrData?.eventDate || "event"}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onNotify("PDF 已下載", "success");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "PDF 生成失敗", "error");
    }
  };

  const handleShareWhatsApp = async () => {
    if (!qrData) {
      onNotify("請先輸入活動資訊", "error");
      return;
    }
    try {
      // Generate PDF
      const pdfBlob = await generatePDFBlob();
      const pdfFile = new File([pdfBlob], `BNI-Anchor-${qrData.eventDate}.pdf`, { type: "application/pdf" });

      const formattedDate = new Date(qrData.eventDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      const message = `🎯 EventXP for BNI Anchor Event Check-in\n\n` +
        `Event: ${qrData.eventName}\n` +
        `Date: ${formattedDate}\n` +
        `Registration: ${qrData.registrationStartTime}\n` +
        `Start: ${qrData.startTime}\n` +
        `On-time Cutoff: ${qrData.onTimeCutoff}\n\n` +
        `Please scan the QR code in the attached PDF to check in!`;

      // Try Web Share API first (supports file attachments on mobile/some browsers)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            title: `EventXP for BNI Anchor - ${formattedDate}`,
            text: message,
            files: [pdfFile]
          });
          onNotify("已透過系統分享功能分享 PDF", "success");
          return;
        } catch (shareError) {
          // User cancelled or share failed, fall through to WhatsApp web
          if ((shareError as Error).name !== "AbortError") {
            console.log("Web Share API failed, falling back to WhatsApp web");
          }
        }
      }

      // Fallback: Download PDF and open WhatsApp web
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.download = `BNI-Anchor-${qrData.eventDate}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      const encodedMessage = encodeURIComponent(message + `\n\n📄 The QR code PDF has been downloaded. Please attach it when sharing!`);
      
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
        onNotify("PDF 已下載，打開 WhatsApp 分享", "success");
      }, 500);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分享失敗", "error");
    }
  };

  const handleShareEmail = async () => {
    if (!qrData) {
      onNotify("請先輸入活動資訊", "error");
      return;
    }
    setIsSharingEmail(true);
    try {
      // Generate PDF
      const pdfBlob = await generatePDFBlob();
      const pdfFile = new File([pdfBlob], `BNI-Anchor-${qrData.eventDate}.pdf`, { type: "application/pdf" });

      const formattedDate = new Date(qrData.eventDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      const subject = `EventXP for BNI Anchor - Check-in ${formattedDate}`;
      const body = `Dear Members,\n\n` +
        `Please find the check-in details for our upcoming event:\n\n` +
        `Event: ${qrData.eventName}\n` +
        `Date: ${formattedDate}\n` +
        `Registration: ${qrData.registrationStartTime}\n` +
        `Start Time: ${qrData.startTime}\n` +
        `On-time Cutoff: ${qrData.onTimeCutoff}\n\n` +
        `Please scan the QR code in the attached PDF to check in at the event.\n\n` +
        `Best regards,\n` +
        `EventXP for BNI Anchor Team`;

      // Try Web Share API first (supports file attachments on mobile/some browsers)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            title: subject,
            text: body,
            files: [pdfFile]
          });
          onNotify("已透過系統分享功能分享 PDF", "success");
          return;
        } catch (shareError) {
          // User cancelled or share failed, fall through to mailto
          if ((shareError as Error).name !== "AbortError") {
            console.log("Web Share API failed, falling back to mailto");
          }
        }
      }

      // Fallback: Download PDF first, then open mailto
      // Note: mailto: protocol cannot attach files, so we download first
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.download = `BNI-Anchor-${qrData.eventDate}.pdf`;
      link.href = url;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Wait a bit longer to ensure download completes
      onNotify(`PDF 正在下載: BNI-Anchor-${qrData.eventDate}.pdf`, "info");
      
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(
        `Dear Members,\n\n` +
        `Please find the check-in details for our upcoming event:\n\n` +
        `Event: ${qrData.eventName}\n` +
        `Date: ${formattedDate}\n` +
        `Registration: ${qrData.registrationStartTime}\n` +
        `Start Time: ${qrData.startTime}\n` +
        `On-time Cutoff: ${qrData.onTimeCutoff}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📎 IMPORTANT: PDF ATTACHMENT REQUIRED\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `The QR code PDF file "BNI-Anchor-${qrData.eventDate}.pdf" has been downloaded to your computer.\n\n` +
        `⚠️ Please attach this file to your email before sending.\n` +
        `📁 Look in your Downloads folder for: BNI-Anchor-${qrData.eventDate}.pdf\n\n` +
        `Attendees can scan the QR code in the PDF to check in at the event.\n\n` +
        `Best regards,\n` +
        `EventXP for BNI Anchor Team`
      );
      
      // Longer delay to ensure download completes and user sees the notification
      setTimeout(() => {
        URL.revokeObjectURL(url);
        window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
        onNotify("PDF 已下載，郵件已開啟 - 請記得附加 PDF 檔案！", "success");
        setIsSharingEmail(false);
      }, 1500);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "分享失敗", "error");
      setIsSharingEmail(false);
    }
  };

  return (
    <section className="section qr-generator-panel">
      <div className="section-header">
        <h2>🔳 新增活動和二維碼</h2>
        <p className="hint">產生活動簽到用 QR Code</p>
      </div>

      <div className="form-group">
        <label htmlFor="event-name-input">活動名稱 Event Name</label>
        <input
          id="event-name-input"
          className="input-field"
          placeholder="例如: EventXP for BNI Anchor Meeting"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="date-input">活動日期 Event Date</label>
        <input
          id="date-input"
          className="input-field"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      <div className="form-group checkbox-group">
        <label className="checkbox-label" htmlFor="include-event-date-pdf">
          <input
            id="include-event-date-pdf"
            type="checkbox"
            checked={includeEventDateInPdf}
            onChange={(e) => setIncludeEventDateInPdf(e.target.checked)}
          />
          <span className="checkbox-text">PDF 顯示活動日期 Include 📆 活動日期 on check-in PDF</span>
        </label>
      </div>

      <div className="time-fields-grid">
        <div className="form-group">
          <label htmlFor="registration-start-input">登記開始時間 Registration Start (24 小時制)</label>
          <input
            id="registration-start-input"
            className="input-field"
            type="time"
            value={registrationStartTime}
            onChange={(e) => handleRegistrationStartChange(e.target.value)}
          />
          <span className="hint">變更此時間會自動調整其他時間</span>
        </div>

        <div className="form-group">
          <label htmlFor="start-time-input">活動開始時間 Start Time</label>
          <input
            id="start-time-input"
            className="input-field"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <span className="hint">登記開始 +30 分鐘</span>
        </div>

        <div className="form-group">
          <label htmlFor="on-time-cutoff-input">準時截止 On-time Cutoff</label>
          <input
            id="on-time-cutoff-input"
            className="input-field"
            type="time"
            value={onTimeCutoff}
            onChange={(e) => setOnTimeCutoff(e.target.value)}
          />
          <span className="hint">登記開始 +35 分鐘</span>
        </div>

        <div className="form-group">
          <label htmlFor="end-time-input">活動結束時間 End Time</label>
          <input
            id="end-time-input"
            className="input-field"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <span className="hint">登記開始 +150 分鐘</span>
        </div>
      </div>

      {qrData && (
        <>
          {/* Fixed-width off-screen DOM for device-independent PDF capture */}
          <div className="qr-pdf-capture-root" aria-hidden="true">
            <div className="qr-pdf-capture" id="qr-pdf">
              <QrFlyerContent
                data={qrData}
                includeEventDate={includeEventDateInPdf}
                websiteUrl={ROOT_WEBSITE_URL}
                qrCodeId="qr-code-website"
              />
            </div>
          </div>

          {/* Original single QR code container for backward compatibility */}
          <div className="qr-code-container" style={{ display: "none" }}>
            <QRCodeSVG
              id="qr-code-single"
              value={qrString}
              size={200}
              level="H"
              bgColor="#ffffff"
              fgColor="#030712"
              marginSize={2}
            />
          </div>
          <div className="qr-actions">
            <button 
              className="button create-event-btn" 
              type="button" 
              onClick={handleCreateEvent}
              disabled={isCreating}
            >
              {isCreating ? "⏳ 建立中..." : "🎯 建立活動"}
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowPreviewModal(true)}>
              👁️ 預覽簽到紙
            </button>
            <button className="button" type="button" onClick={handleDownloadPDF} style={{ backgroundColor: "#dc2626" }}>
              📄 下載 PDF
            </button>
            <button className="ghost-button" type="button" onClick={handleCopy}>
              📋 複製字串
            </button>
            <button className="ghost-button" type="button" onClick={handleDownload}>
              ⬇️ 下載 PNG
            </button>
          </div>
          <div className="qr-actions" style={{ marginTop: "10px" }}>
            <button className="button" type="button" onClick={handleShareWhatsApp} style={{ backgroundColor: "#25D366" }}>
              📱 WhatsApp 分享
            </button>
            <button 
              className="button" 
              type="button" 
              onClick={handleShareEmail} 
              disabled={isSharingEmail}
              style={{ backgroundColor: "#3b82f6", opacity: isSharingEmail ? 0.6 : 1 }}
            >
              {isSharingEmail ? "⏳ 準備中..." : "✉️ Email 分享"}
            </button>
          </div>
        </>
      )}

      {/* Modal: Check-in preview */}
      {showPreviewModal && qrData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "1.5rem",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
            }}
            className="qr-preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#000" }} >📄 簽到紙預覽 Check-in Preview</h3>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{ fontSize: "1.5rem", background: "none", border: "none", cursor: "pointer" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="qr-flyer-preview-frame">
              <div className="qr-pdf-capture qr-flyer-preview">
                <QrFlyerContent
                  data={qrData}
                  includeEventDate={includeEventDateInPdf}
                  websiteUrl={ROOT_WEBSITE_URL}
                  qrCodeId="qr-code-preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!qrData && (
        <div className="qr-placeholder">
          <div className="placeholder-icon">🔳</div>
          <p className="hint">輸入活動資訊後將顯示 QR 碼</p>
        </div>
      )}

      <div className="format-info">
        <h4>📝 QR 碼格式說明</h4>
        <p className="hint">
          格式包含活動名稱、日期及各時間設定
        </p>        
      </div>

      <div className="report-link-info">
        <h4>📊 即時報名狀態頁面</h4>
        <p className="hint">
          建立活動後，可開啟 <a href="/report" target="_blank" rel="noopener noreferrer" className="report-link">/report</a> 頁面查看即時簽到狀態
        </p>
      </div>

      <div className="danger-zone">
        <h4>⚠️ 危險區域</h4>
        {!showClearConfirm ? (
          <button 
            className="ghost-button danger-btn" 
            type="button" 
            onClick={() => setShowClearConfirm(true)}
          >
            🗑️ 清除所有活動和簽到記錄
          </button>
        ) : (
          <div className="clear-confirm">
            <p className="warning-text">確定要刪除所有活動和簽到記錄嗎？此操作無法復原！</p>
            <div className="confirm-buttons">
              <button 
                className="button danger-btn" 
                type="button" 
                onClick={handleClearAllEventsAndAttendance}
                disabled={isClearing}
              >
                {isClearing ? "⏳ 清除中..." : "確認刪除"}
              </button>
              <button 
                className="ghost-button" 
                type="button" 
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
