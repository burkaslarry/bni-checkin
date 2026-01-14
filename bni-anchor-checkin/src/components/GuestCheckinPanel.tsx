import { useState, useEffect, useCallback, useRef } from "react";
import { checkIn, AttendeeRole } from "../api";

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

type GuestCheckinPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

// Guest role options for selection
type GuestRole = "GUEST" | "VIP" | "SPEAKER";

export const GuestCheckinPanel = ({ onNotify }: GuestCheckinPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  
  const [guestName, setGuestName] = useState("");
  const [domain, setDomain] = useState("");
  const [guestRole, setGuestRole] = useState<GuestRole>("GUEST");
  const [referrer, setReferrer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [supportsDetector, setSupportsDetector] = useState(false);
  const [lastScanned, setLastScanned] = useState("");

  // Initialize camera
  const initCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // Camera not available
    }
  }, []);

  useEffect(() => {
    void initCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [initCamera]);

  useEffect(() => {
    if ("BarcodeDetector" in window) {
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      setSupportsDetector(true);
    }
  }, []);

  // Handle QR scan
  const handleScan = async () => {
    if (!supportsDetector || !detectorRef.current || !videoRef.current) {
      onNotify("此裝置不支援 QR 掃描", "error");
      return;
    }

    setScanStatus("scanning");
    const video = videoRef.current;
    
    if (!video.videoWidth || !video.videoHeight) {
      onNotify("相機尚未準備好", "error");
      setScanStatus("idle");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const barcodes = await detectorRef.current.detect(canvas);
      if (!barcodes.length) {
        throw new Error("No QR code detected");
      }

      const qrData = barcodes[0].rawValue;
      setLastScanned(qrData);
      
      // Try to parse QR and extract guest name
      let extractedName = "";
      
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.name && parsed.type === "guest") {
          extractedName = parsed.name;
        }
      } catch {
        const parts = qrData.split("-");
        if (parts.length >= 2 && parts[1] === "GUEST") {
          extractedName = parts[0];
        } else {
          extractedName = qrData;
        }
      }

      if (extractedName) {
        setGuestName(extractedName);
        setScanStatus("success");
        onNotify(`已識別來賓: ${extractedName}`, "success");
      } else {
        setScanStatus("error");
        onNotify("QR 碼格式不正確", "error");
      }
    } catch {
      setScanStatus("error");
      onNotify("未偵測到 QR 碼", "error");
    }
  };

  // Submit check-in
  const handleSubmit = async () => {
    if (!guestName.trim()) {
      onNotify("請輸入來賓姓名", "error");
      return;
    }
    
    if (!domain.trim()) {
      onNotify("請輸入專業領域", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Use local time format instead of UTC ISO string
      const now = new Date();
      const localTimeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      const result = await checkIn({
        name: guestName.trim(),
        type: "guest",
        domain: domain.trim(),
        currentTime: localTimeString,
        role: guestRole as AttendeeRole,
        referrer: referrer.trim() || undefined
      });

      if (result.status === "success") {
        const roleLabel = guestRole === "VIP" ? "VIP 嘉賓" : guestRole === "SPEAKER" ? "講者" : "來賓";
        onNotify(`✅ ${guestName} (${roleLabel}) 簽到成功！`, "success");
        setGuestName("");
        setDomain("");
        setReferrer("");
        setGuestRole("GUEST");
        setLastScanned("");
        setScanStatus("idle");
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

  const isFormValid = guestName.trim().length > 0 && domain.trim().length > 0;

  return (
    <section className="section checkin-panel guest-checkin">
      <div className="section-header">
        <h2>🎫 來賓簽到</h2>
        <p className="hint">掃描 QR 碼或手動輸入來賓姓名</p>
      </div>

      {/* Camera Scanner */}
      <div className="scanner-section">
        <div className="video-wrapper compact">
          <video ref={videoRef} muted playsInline autoPlay />
        </div>
        <button
          className="button scan-button"
          type="button"
          onClick={handleScan}
          disabled={!supportsDetector || scanStatus === "scanning"}
        >
          {scanStatus === "scanning" ? "⏳ 掃描中..." : "📷 掃描 QR 碼"}
        </button>
        {lastScanned && (
          <p className="hint scanned-data">
            已掃描: <code>{lastScanned.substring(0, 50)}...</code>
          </p>
        )}
      </div>

      <div className="divider">
        <span>或手動輸入</span>
      </div>

      {/* Guest Inputs */}
      <div className="form-group">
        <label htmlFor="guest-name">來賓姓名 Name</label>
        <input
          id="guest-name"
          className="input-field"
          type="text"
          placeholder="請輸入來賓姓名..."
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="form-group">
        <label htmlFor="guest-domain">專業領域 Domain</label>
        <input
          id="guest-domain"
          className="input-field"
          type="text"
          placeholder="例如: 網頁設計、會計服務..."
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Role Selection */}
      <div className="form-group">
        <label>嘉賓身份 Role</label>
        <div className="role-selector">
          <button
            type="button"
            className={`role-option ${guestRole === "GUEST" ? "active" : ""}`}
            onClick={() => setGuestRole("GUEST")}
          >
            👤 一般來賓
          </button>
          <button
            type="button"
            className={`role-option vip ${guestRole === "VIP" ? "active" : ""}`}
            onClick={() => setGuestRole("VIP")}
          >
            ⭐ VIP 嘉賓
          </button>
          <button
            type="button"
            className={`role-option speaker ${guestRole === "SPEAKER" ? "active" : ""}`}
            onClick={() => setGuestRole("SPEAKER")}
          >
            🎤 講者
          </button>
        </div>
      </div>

      {/* Referrer (Optional) */}
      <div className="form-group">
        <label htmlFor="guest-referrer">邀請人 Referrer (選填)</label>
        <input
          id="guest-referrer"
          className="input-field"
          type="text"
          placeholder="邀請此來賓的會員..."
          value={referrer}
          onChange={(e) => setReferrer(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Preview & Submit */}
      {(guestName.trim() || domain.trim()) && (
        <div className={`checkin-preview ${guestRole === "VIP" ? "vip-preview" : guestRole === "SPEAKER" ? "speaker-preview" : ""}`}>
          <div className="preview-info">
            <span className="preview-icon">
              {guestRole === "VIP" ? "⭐" : guestRole === "SPEAKER" ? "🎤" : "🎫"}
            </span>
            <div>
              <strong>{guestName || "—"}</strong>
              <div className="hint">{domain || "—"}</div>
              <span className={`type-badge ${guestRole.toLowerCase()}`}>
                {guestRole === "VIP" ? "⭐ VIP 嘉賓" : guestRole === "SPEAKER" ? "🎤 講者" : "👤 來賓"}
              </span>
            </div>
          </div>
          {referrer && (
            <p className="hint referrer-info">
              邀請人: {referrer}
            </p>
          )}
          <p className="hint">
            簽到時間: {new Date().toLocaleString("zh-TW")}
          </p>
        </div>
      )}

      <button
        className="button submit-button"
        type="button"
        onClick={handleSubmit}
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? "⏳ 處理中..." : "✅ 確認簽到"}
      </button>
    </section>
  );
};
