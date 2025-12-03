import { useState, useEffect, useCallback, useRef } from "react";
import { checkIn } from "../api";

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

export const GuestCheckinPanel = ({ onNotify }: GuestCheckinPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  
  const [guestName, setGuestName] = useState("");
  const [domain, setDomain] = useState("");
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
      const result = await checkIn({
        name: guestName.trim(),
        type: "guest",
        domain: domain.trim(),
        currentTime: new Date().toISOString()
      });

      if (result.status === "success") {
        onNotify(`✅ ${guestName} 簽到成功！`, "success");
        setGuestName("");
        setDomain("");
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

      {/* Preview & Submit */}
      {(guestName.trim() || domain.trim()) && (
        <div className="checkin-preview">
          <div className="preview-info">
            <span className="preview-icon">🎫</span>
            <div>
              <strong>{guestName || "—"}</strong>
              <div className="hint">{domain || "—"}</div>
              <span className="type-badge guest">來賓</span>
            </div>
          </div>
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
