import { useState, useMemo, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createEvent, clearAllEventsAndAttendance } from "../api";
import { jsPDF } from "jspdf";

type QRGeneratorPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

// Helper function to add minutes to a time string (HH:mm format)
const addMinutesToTime = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
};

export const QRGeneratorPanel = ({ onNotify }: QRGeneratorPanelProps) => {
  const [eventName, setEventName] = useState("BNI Anchor Meeting");
  const [eventDate, setEventDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [registrationStartTime, setRegistrationStartTime] = useState("06:30");
  const [startTime, setStartTime] = useState("07:00");
  const [onTimeCutoff, setOnTimeCutoff] = useState("07:05");
  const [endTime, setEndTime] = useState("09:00");
  const [isCreating, setIsCreating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSharingEmail, setIsSharingEmail] = useState(false);

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

  const handleCreateEvent = async () => {
    if (!qrData) {
      onNotify("請先輸入活動資訊", "error");
      return;
    }
    setIsCreating(true);
    try {
      await createEvent(
        qrData.eventName,
        qrData.eventDate,
        qrData.startTime,
        qrData.endTime,
        qrData.registrationStartTime,
        qrData.onTimeCutoff
      );
      onNotify("活動已建立，所有會員已設為預設缺席狀態", "success");
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
    const svg = document.getElementById("qr-code-svg");
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

  // Helper function to generate PDF as blob
  const generatePDFBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!qrString || !qrData) {
        reject(new Error("請先輸入活動資訊"));
        return;
      }
      const svg = document.getElementById("qr-code-svg");
      if (!svg) {
        reject(new Error("QR code not found"));
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        canvas.width = 300;
        canvas.height = 300;
        ctx?.drawImage(img, 0, 0, 300, 300);
        const qrImageData = canvas.toDataURL("image/png");

        // Create PDF
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        // Add title
        pdf.setFontSize(24);
        pdf.setFont("helvetica", "bold");
        pdf.text("BNI Anchor", 105, 30, { align: "center" });

        // Add event name
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "normal");
        pdf.text(qrData.eventName, 105, 45, { align: "center" });

        // Add date
        pdf.setFontSize(14);
        const formattedDate = new Date(qrData.eventDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });
        pdf.text(`Date: ${formattedDate}`, 105, 55, { align: "center" });

        // Add times
        pdf.setFontSize(12);
        pdf.text(`Registration: ${qrData.registrationStartTime}`, 105, 65, { align: "center" });
        pdf.text(`Start Time: ${qrData.startTime}`, 105, 72, { align: "center" });
        pdf.text(`On-time Cutoff: ${qrData.onTimeCutoff}`, 105, 79, { align: "center" });

        // Add QR code (centered)
        const qrSize = 100; // 100mm
        const xPos = (210 - qrSize) / 2; // Center on A4 width (210mm)
        pdf.addImage(qrImageData, "PNG", xPos, 95, qrSize, qrSize);

        // Add footer
        pdf.setFontSize(10);
        pdf.setTextColor(128, 128, 128);
        pdf.text("Scan this QR code to check in to the event", 105, 210, { align: "center" });

        // Get PDF as blob
        const pdfBlob = pdf.output("blob");
        resolve(pdfBlob);
      };

      img.onerror = () => reject(new Error("Failed to load QR code image"));
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });
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
      const message = `🎯 BNI Anchor Event Check-in\n\n` +
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
            title: `BNI Anchor Event - ${formattedDate}`,
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
      const subject = `BNI Anchor Event Check-in - ${formattedDate}`;
      const body = `Dear Members,\n\n` +
        `Please find the check-in details for our upcoming event:\n\n` +
        `Event: ${qrData.eventName}\n` +
        `Date: ${formattedDate}\n` +
        `Registration: ${qrData.registrationStartTime}\n` +
        `Start Time: ${qrData.startTime}\n` +
        `On-time Cutoff: ${qrData.onTimeCutoff}\n\n` +
        `Please scan the QR code in the attached PDF to check in at the event.\n\n` +
        `Best regards,\n` +
        `BNI Anchor Team`;

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
        `BNI Anchor Team`
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
          placeholder="例如: BNI Anchor Meeting"
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

      <div className="time-fields-grid">
        <div className="form-group">
          <label htmlFor="registration-start-input">登記開始時間 Registration Start</label>
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
        <div className="qr-preview">
          <div className="qr-code-container">
            <QRCodeSVG
              id="qr-code-svg"
              value={qrString}
              size={200}
              level="H"
              bgColor="#ffffff"
              fgColor="#030712"
              marginSize={2}
            />
          </div>
          <div className="qr-info-display">
            <div className="qr-info-row">
              <span className="qr-info-label">📅 活動名稱:</span>
              <span className="qr-info-value">{qrData.eventName}</span>
            </div>
            <div className="qr-info-row">
              <span className="qr-info-label">📆 活動日期:</span>
              <span className="qr-info-value">{qrData.eventDate}</span>
            </div>
            <div className="qr-info-row">
              <span className="qr-info-label">🕐 登記開始:</span>
              <span className="qr-info-value">{qrData.registrationStartTime}</span>
            </div>
            <div className="qr-info-row">
              <span className="qr-info-label">🚀 活動開始:</span>
              <span className="qr-info-value">{qrData.startTime}</span>
            </div>
            <div className="qr-info-row">
              <span className="qr-info-label">⏰ 準時截止:</span>
              <span className="qr-info-value">{qrData.onTimeCutoff}</span>
            </div>
            <div className="qr-info-row">
              <span className="qr-info-label">🏁 活動結束:</span>
              <span className="qr-info-value">{qrData.endTime}</span>
            </div>
          </div>
          <div className="qr-string-display">
            <code>{qrString}</code>
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
        <div className="format-example-box">
          <code>{`{"eventName":"BNI Anchor Meeting","eventDate":"2025-11-30","startTime":"07:00","endTime":"09:00","registrationStartTime":"06:30","onTimeCutoff":"07:01"}`}</code>
        </div>
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
