import { useState, useMemo, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createEvent, clearAllEventsAndAttendance } from "../api";

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

  return (
    <section className="section qr-generator-panel">
      <div className="section-header">
        <h2>🔳 產生活動 QR 碼</h2>
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
            <button className="ghost-button" type="button" onClick={handleCopy}>
              📋 複製字串
            </button>
            <button className="ghost-button" type="button" onClick={handleDownload}>
              ⬇️ 下載 PNG
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
