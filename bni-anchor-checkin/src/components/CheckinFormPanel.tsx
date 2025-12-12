import { useState, useEffect, useCallback, useRef } from "react";
import { checkIn, getMembers, MemberInfo, getCurrentEvent, EventData } from "../api";
import jsQR from "jsqr";

interface BarcodeDetectorOptions {
  formats?: string[];
}

interface BarcodeDetection {
  rawValue: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(source: ImageBitmapSource): Promise<BarcodeDetection[]>;
}

type CheckinType = "member" | "guest";

type CheckinFormPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export const CheckinFormPanel = ({ onNotify }: CheckinFormPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>("");
  const isCameraReadyRef = useRef(false);

  // Form state
  const [checkinType, setCheckinType] = useState<CheckinType>("member");
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestDomain, setGuestDomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportsDetector, setSupportsDetector] = useState(false);
  const [lastScanned, setLastScanned] = useState("");
  const [eventInfo, setEventInfo] = useState<{ eventName: string; eventDate: string } | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [isEventEnded, setIsEventEnded] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success">("idle");
  const [showQRScanner, setShowQRScanner] = useState(true);

  // Fetch members list
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await getMembers();
        setMembers(data.members);
      } catch {
        onNotify("無法載入會員名單", "error");
      }
    };
    fetchMembers();
  }, [onNotify]);

  // Fetch current event and check if ended
  useEffect(() => {
    const checkEventStatus = async () => {
      try {
        const event = await getCurrentEvent();
        setCurrentEvent(event);

        if (event) {
          const now = new Date();
          const eventDate = new Date(event.date);
          const [endHours, endMinutes] = event.endTime.split(":").map(Number);

          const eventEndTime = new Date(eventDate);
          eventEndTime.setHours(endHours, endMinutes, 0, 0);

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          eventDate.setHours(0, 0, 0, 0);

          if (today.getTime() === eventDate.getTime() && now > eventEndTime) {
            setIsEventEnded(true);
          } else {
            setIsEventEnded(false);
          }
        }
      } catch {
        // Silent fail
      }
    };

    checkEventStatus();
    const interval = setInterval(checkEventStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Initialize camera
  const initCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.log("getUserMedia not supported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.oncanplay = () => {
          isCameraReadyRef.current = true;
          console.log("Camera ready for scanning");
        };
        await videoRef.current.play();
      }
    } catch (err) {
      console.log("Camera not available:", err);
      onNotify("相機無法使用", "error");
    }
  }, [onNotify]);

  useEffect(() => {
    if (showQRScanner) {
      void initCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [initCamera, showQRScanner]);

  useEffect(() => {
    if ("BarcodeDetector" in window) {
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      setSupportsDetector(true);
    }
  }, []);

  // Process QR code data
  const processQRCode = useCallback(
    (qrData: string) => {
      if (qrData === lastScannedRef.current) {
        return;
      }

      lastScannedRef.current = qrData;
      setLastScanned(qrData);

      try {
        const parsed = JSON.parse(qrData);

        // Check if it's an event QR code
        if (parsed.eventName && parsed.eventDate) {
          setEventInfo({ eventName: parsed.eventName, eventDate: parsed.eventDate });
          setScanStatus("success");
          onNotify(`✅ 活動確認: ${parsed.eventName} (${parsed.eventDate})`, "success");
          setShowQRScanner(false);
          return true;
        }

        // Check if it's a member QR code
        if (parsed.name && parsed.type === "member") {
          const match = members.find(
            (m) => m.name.toLowerCase() === parsed.name.toLowerCase()
          );
          if (match) {
            setCheckinType("member");
            setSelectedMember(match.name);
            setScanStatus("success");
            onNotify(`✅ 已識別會員: ${match.name}`, "success");
            setShowQRScanner(false);
            return true;
          }
        }

        // Check if it's a guest QR code
        if (parsed.name && parsed.type === "guest") {
          setCheckinType("guest");
          setGuestName(parsed.name);
          setScanStatus("success");
          onNotify(`✅ 已識別來賓: ${parsed.name}`, "success");
          setShowQRScanner(false);
          return true;
        }
      } catch {
        // Not JSON, try simple format
        const parts = qrData.split("-");
        if (parts.length >= 2 && parts[1] === "ANCHOR") {
          const memberName = parts[0];
          const match = members.find(
            (m) => m.name.toLowerCase() === memberName.toLowerCase()
          );
          if (match) {
            setCheckinType("member");
            setSelectedMember(match.name);
            setScanStatus("success");
            onNotify(`✅ 已識別會員: ${match.name}`, "success");
            setShowQRScanner(false);
            return true;
          }
        }
      }

      return false;
    },
    [members, onNotify]
  );

  // Auto-scan function using jsQR (works in all browsers)
  const performAutoScan = useCallback(async () => {
    if (!videoRef.current || !isCameraReadyRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try BarcodeDetector first if supported
    if (supportsDetector && detectorRef.current) {
      try {
        const barcodes = await detectorRef.current.detect(canvas);
        if (barcodes.length > 0) {
          processQRCode(barcodes[0].rawValue);
          return;
        }
      } catch {
        // Fall through to jsQR
      }
    }

    // Fallback to jsQR (works in all browsers)
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      processQRCode(code.data);
    }
  }, [supportsDetector, processQRCode]);

  // Start auto-scanning when camera is ready
  useEffect(() => {
    if (!showQRScanner) return;

    scanIntervalRef.current = window.setInterval(() => {
      void performAutoScan();
    }, 300);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [performAutoScan, showQRScanner]);

  // Reset lastScannedRef when user clears selection
  useEffect(() => {
    if (!selectedMember && !guestName && !eventInfo) {
      lastScannedRef.current = "";
    }
  }, [selectedMember, guestName, eventInfo]);

  // Handle member submission
  const handleMemberSubmit = async () => {
    if (!selectedMember) {
      onNotify("請選擇會員", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const localTimeString = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(
        now.getHours()
      ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
        now.getSeconds()
      ).padStart(2, "0")}`;

      const result = await checkIn({
        name: selectedMember,
        type: "member",
        currentTime: localTimeString
      });

      if (result.status === "success") {
        onNotify(`✅ ${selectedMember} 簽到成功！`, "success");
        // Reset form
        setSelectedMember("");
        setEventInfo(null);
        setLastScanned("");
        setScanStatus("idle");
        setShowQRScanner(true);
      } else {
        onNotify(`❌ ${result.message}`, "error");
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

  // Handle guest submission
  const handleGuestSubmit = async () => {
    if (!guestName.trim()) {
      onNotify("請輸入來賓姓名", "error");
      return;
    }

    if (!guestDomain.trim()) {
      onNotify("請輸入專業領域", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const localTimeString = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(
        now.getHours()
      ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
        now.getSeconds()
      ).padStart(2, "0")}`;

      const result = await checkIn({
        name: guestName.trim(),
        type: "guest",
        domain: guestDomain.trim(),
        currentTime: localTimeString
      });

      if (result.status === "success") {
        onNotify(`✅ ${guestName} 簽到成功！`, "success");
        // Reset form
        setGuestName("");
        setGuestDomain("");
        setEventInfo(null);
        setLastScanned("");
        setScanStatus("idle");
        setShowQRScanner(true);
      } else {
        onNotify(`❌ ${result.message}`, "error");
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

  const isEventValid = eventInfo !== null;
  const isMemberFormValid = selectedMember.length > 0;
  const isGuestFormValid = guestName.trim().length > 0 && guestDomain.trim().length > 0;

  return (
    <section className="section checkin-form-panel">
      {/* QR Scanner Section */}
      {showQRScanner && (
        <div className="qr-scanner-section">
          <div className="section-header">
            <h2>📱 掃描 QR 碼簽到</h2>
            <p className="hint">掃描週例會 QR 碼開始簽到</p>
          </div>

          <div className="scanner-container">
            <div className="video-wrapper">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="camera-video"
              />
              <div className="qr-scan-overlay">
                <div className="qr-guide">
                  <svg
                    width="200"
                    height="200"
                    viewBox="0 0 200 200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M 10 30 L 10 10 L 30 10" />
                    <path d="M 170 30 L 170 10 L 150 10" />
                    <path d="M 10 170 L 10 190 L 30 190" />
                    <path d="M 170 170 L 170 190 L 150 190" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="scanner-hint">
              {lastScanned ? "✅ 已掃描，請檢查下方表單" : "⏳ 正在掃描..."}
            </p>
          </div>

          {isEventEnded && (
            <div className="alert alert-warning">
              ⚠️ 活動已結束，無法簽到
            </div>
          )}

          {eventInfo && (
            <div className="alert alert-success">
              ✅ 活動已識別: {eventInfo.eventName} ({eventInfo.eventDate})
            </div>
          )}
        </div>
      )}

      {/* Form Section - Show after QR scan or allow manual entry */}
      {(!showQRScanner || eventInfo) && (
        <div className="checkin-form-section">
          <div className="section-header">
            <h2>📋 簽到表單</h2>
            <p className="hint">確認您的身份進行簽到</p>
          </div>

          {/* Type Selection */}
          <div className="checkin-type-selector">
            <label className="radio-button">
              <input
                type="radio"
                name="checkin-type"
                value="member"
                checked={checkinType === "member"}
                onChange={(e) => {
                  setCheckinType(e.target.value as CheckinType);
                  setGuestName("");
                  setGuestDomain("");
                }}
              />
              <span className="radio-label">會員 👤</span>
            </label>
            <label className="radio-button">
              <input
                type="radio"
                name="checkin-type"
                value="guest"
                checked={checkinType === "guest"}
                onChange={(e) => {
                  setCheckinType(e.target.value as CheckinType);
                  setSelectedMember("");
                }}
              />
              <span className="radio-label">來賓 🎫</span>
            </label>
          </div>

          {/* Member Form */}
          {checkinType === "member" && (
            <div className="form-group">
              <label htmlFor="member-select" className="form-label">
                會員姓名
              </label>
              <select
                id="member-select"
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="form-select"
              >
                <option value="">-- 請選擇會員 --</option>
                {members.map((member) => (
                  <option key={member.name} value={member.name}>
                    {member.name} ({member.domain})
                  </option>
                ))}
              </select>
              {selectedMember && (
                <div className="form-help">
                  已選擇: <strong>{selectedMember}</strong>
                </div>
              )}
              <button
                type="button"
                className="button button-primary full-width"
                onClick={handleMemberSubmit}
                disabled={!isMemberFormValid || isSubmitting || isEventEnded}
              >
                {isSubmitting ? "⏳ 簽到中..." : "✅ 會員簽到"}
              </button>
            </div>
          )}

          {/* Guest Form */}
          {checkinType === "guest" && (
            <div className="form-group">
              <label htmlFor="guest-name" className="form-label">
                來賓姓名
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="輸入姓名"
                className="form-input"
              />

              <label htmlFor="guest-domain" className="form-label">
                專業領域 (專業)
              </label>
              <input
                id="guest-domain"
                type="text"
                value={guestDomain}
                onChange={(e) => setGuestDomain(e.target.value)}
                placeholder="例: 軟體開發、行銷、財務"
                className="form-input"
              />

              <button
                type="button"
                className="button button-primary full-width"
                onClick={handleGuestSubmit}
                disabled={!isGuestFormValid || isSubmitting || isEventEnded}
              >
                {isSubmitting ? "⏳ 簽到中..." : "✅ 來賓簽到"}
              </button>
            </div>
          )}

          <button
            type="button"
            className="button button-secondary full-width"
            onClick={() => {
              setShowQRScanner(true);
              setSelectedMember("");
              setGuestName("");
              setGuestDomain("");
              setEventInfo(null);
              setLastScanned("");
              setScanStatus("idle");
            }}
          >
            🔄 重新掃描
          </button>
        </div>
      )}
    </section>
  );
};
