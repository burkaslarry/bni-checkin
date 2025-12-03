import { useState, useEffect, useCallback, useRef } from "react";
import { checkIn, getMembers, MemberInfo } from "../api";

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

type MemberCheckinPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};

export const MemberCheckinPanel = ({ onNotify }: MemberCheckinPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [supportsDetector, setSupportsDetector] = useState(false);
  const [lastScanned, setLastScanned] = useState("");
  const [eventInfo, setEventInfo] = useState<{ eventName: string; eventDate: string } | null>(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);

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
      setShowAdminDialog(true);
      return;
    }

    setScanStatus("scanning");
    const video = videoRef.current;
    
    if (!video.videoWidth || !video.videoHeight) {
      onNotify("相機尚未準備好", "error");
      setScanStatus("idle");
      setShowAdminDialog(true);
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
      
      // Try to parse QR code
      try {
        const parsed = JSON.parse(qrData);
        
        // Check if it's an event QR code
        if (parsed.eventName && parsed.eventDate) {
          setEventInfo({ eventName: parsed.eventName, eventDate: parsed.eventDate });
          setScanStatus("success");
          onNotify(`✅ 活動確認: ${parsed.eventName} (${parsed.eventDate})`, "success");
          // Show member selection after successful event scan
          return;
        }
        
        // Check if it's a member QR code
        if (parsed.name && parsed.type === "member") {
          const match = members.find(
            (m) => m.name.toLowerCase() === parsed.name.toLowerCase()
          );
          if (match) {
            setSelectedMember(match.name);
            setScanStatus("success");
            onNotify(`✅ 已識別會員: ${match.name}`, "success");
            return;
          }
        }
      } catch {
        // Not JSON, try other formats
        const parts = qrData.split("-");
        if (parts.length >= 2 && parts[1] === "ANCHOR") {
          const memberName = parts[0];
          const match = members.find(
            (m) => m.name.toLowerCase() === memberName.toLowerCase()
          );
          if (match) {
            setSelectedMember(match.name);
            setScanStatus("success");
            onNotify(`✅ 已識別會員: ${match.name}`, "success");
            return;
          }
        }
      }

      // QR code not recognized
      setScanStatus("error");
      onNotify("⚠️ QR 碼格式無法識別", "error");
      setShowAdminDialog(true);
    } catch {
      setScanStatus("error");
      onNotify("⚠️ 未偵測到 QR 碼", "error");
      setShowAdminDialog(true);
    }
  };

  // Submit check-in
  const handleSubmit = async () => {
    if (!selectedMember) {
      onNotify("請選擇會員", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await checkIn({
        name: selectedMember,
        type: "member",
        currentTime: new Date().toISOString()
      });

      if (result.status === "success") {
        onNotify(`✅ ${selectedMember} 簽到成功！`, "success");
        setSelectedMember("");
        setLastScanned("");
        setScanStatus("idle");
        setEventInfo(null);
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

  const selectedMemberInfo = members.find(m => m.name === selectedMember);

  return (
    <section className="section checkin-panel member-checkin">
      <div className="section-header">
        <h2>👤 會員簽到</h2>
        <p className="hint">掃描活動 QR 碼，然後選擇會員</p>
      </div>

      {/* Event Info Display */}
      {eventInfo && (
        <div className="event-info-banner">
          <span className="event-icon">📅</span>
          <div>
            <strong>{eventInfo.eventName}</strong>
            <span className="event-date">{eventInfo.eventDate}</span>
          </div>
        </div>
      )}

      {/* Camera Scanner */}
      <div className="scanner-section">
        <div className="video-wrapper compact">
          <video ref={videoRef} muted playsInline autoPlay />
        </div>
        <button
          className="button scan-button"
          type="button"
          onClick={handleScan}
          disabled={scanStatus === "scanning"}
        >
          {scanStatus === "scanning" ? "⏳ 掃描中..." : "📷 掃描 QR 碼"}
        </button>
        {lastScanned && (
          <p className="hint scanned-data">
            已掃描: <code>{lastScanned.substring(0, 50)}{lastScanned.length > 50 ? "..." : ""}</code>
          </p>
        )}
      </div>

      {/* Admin Warning Dialog */}
      {showAdminDialog && (
        <div className="admin-warning-dialog">
          <div className="warning-content">
            <span className="warning-icon">⚠️</span>
            <h3>QR 掃描失敗</h3>
            <p>請從下方選單手動選擇會員進行簽到</p>
            <button 
              className="button" 
              type="button"
              onClick={() => setShowAdminDialog(false)}
            >
              確定
            </button>
          </div>
        </div>
      )}

      <div className="divider">
        <span>選擇會員</span>
      </div>

      {/* Member Dropdown */}
      <div className="form-group">
        <label htmlFor="member-select">選擇會員</label>
        <select
          id="member-select"
          className="select-field"
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
        >
          <option value="">-- 請選擇會員 --</option>
          {members.map((member) => (
            <option key={member.name} value={member.name}>
              {member.name} - {member.domain}
            </option>
          ))}
        </select>
        <p className="hint">共 {members.length} 位會員</p>
      </div>

      {/* Preview & Submit */}
      {selectedMember && (
        <div className="checkin-preview">
          <div className="preview-info">
            <span className="preview-icon">👤</span>
            <div>
              <strong>{selectedMember}</strong>
              {selectedMemberInfo && (
                <span className="domain-text">{selectedMemberInfo.domain}</span>
              )}
              <span className="type-badge member">會員</span>
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
        disabled={!selectedMember || isSubmitting}
      >
        {isSubmitting ? "⏳ 處理中..." : "✅ 確認簽到"}
      </button>
    </section>
  );
};
