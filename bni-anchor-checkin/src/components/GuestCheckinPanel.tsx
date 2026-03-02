import { useState, useEffect, useCallback, useRef } from "react";
import { checkIn, AttendeeRole, quickMatch, getGuests, GuestInfo } from "../api";

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

  // Matching popup state
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [matchingResults, setMatchingResults] = useState<Array<{
    memberName: string;
    profession: string;
    matchStrength: string;
  }>>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [checkedInGuestName, setCheckedInGuestName] = useState("");

  // Pre-registered guest list state
  const [guestList, setGuestList] = useState<GuestInfo[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string>("");
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");

  // Initialize camera with better error handling
  const initCamera = useCallback(async () => {
    setCameraError("");
    
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("此瀏覽器不支援相機功能");
      return;
    }
    
    try {
      // Check if we're on HTTPS or localhost
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        setCameraError("相機功能需要 HTTPS 連接");
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraError("");
      }
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setCameraError("請允許相機權限以使用掃描功能");
        } else if (err.name === 'NotFoundError') {
          setCameraError("找不到相機裝置");
        } else if (err.name === 'NotReadableError') {
          setCameraError("相機被其他應用程式佔用");
        } else {
          setCameraError("無法啟動相機: " + err.message);
        }
      } else {
        setCameraError("相機初始化失敗");
      }
    }
  }, []);

  // Load pre-registered guests
  useEffect(() => {
    const loadGuests = async () => {
      setIsLoadingGuests(true);
      try {
        const data = await getGuests();
        setGuestList(data.guests || []);
      } catch (error) {
        console.error("Failed to load guests:", error);
        setGuestList([]);
      } finally {
        setIsLoadingGuests(false);
      }
    };
    loadGuests();
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

  // Handle guest selection from dropdown
  const handleGuestSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    setSelectedGuestId(selectedName);
    
    if (selectedName) {
      const guest = guestList.find(g => g.name === selectedName);
      if (guest) {
        setGuestName(guest.name);
        setDomain(guest.profession);
        setReferrer(guest.referrer);
      }
    }
  };

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
        
        // Save guest info for matching popup
        const savedGuestName = guestName.trim();
        const savedDomain = domain.trim();
        setCheckedInGuestName(savedGuestName);
        
        // Reset form
        setGuestName("");
        setDomain("");
        setReferrer("");
        setGuestRole("GUEST");
        setLastScanned("");
        setScanStatus("idle");
        
        // Call quick match API for recommendations
        setIsLoadingMatches(true);
        setShowMatchPopup(true);
        
        try {
          const matchResult = await quickMatch(savedGuestName, savedDomain);
          const parsed = JSON.parse(matchResult.matches);
          const matches = parsed.matches || parsed;
          
          if (Array.isArray(matches) && matches.length > 0) {
            setMatchingResults(matches.slice(0, 5).map((m: { memberName?: string; name?: string; profession?: string; matchStrength?: string }) => ({
              memberName: m.memberName || m.name || '',
              profession: m.profession || '',
              matchStrength: m.matchStrength || 'Medium'
            })));
          } else {
            setMatchingResults([]);
          }
        } catch (error) {
          console.error("Matching error:", error);
          setMatchingResults([]);
        } finally {
          setIsLoadingMatches(false);
        }
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
          {cameraError && (
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.8)',
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#ff6b6b'
            }}>
              <p>{cameraError}</p>
              <button 
                className="button small" 
                onClick={initCamera}
                style={{ marginTop: '0.5rem' }}
              >
                🔄 重試
              </button>
            </div>
          )}
        </div>
        <button
          className="button scan-button"
          type="button"
          onClick={handleScan}
          disabled={!supportsDetector || scanStatus === "scanning" || !!cameraError}
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
        <span>或選擇/輸入來賓資料</span>
      </div>

      {/* Pre-registered Guest Dropdown */}
      {guestList.length > 0 && (
        <div className="form-group">
          <label htmlFor="guest-select">選擇預登記來賓 Select Pre-registered Guest</label>
          <select
            id="guest-select"
            className="input-field"
            value={selectedGuestId}
            onChange={handleGuestSelect}
            style={{ cursor: 'pointer' }}
          >
            <option value="">-- 選擇來賓 / 或手動輸入 --</option>
            {guestList.map((guest, idx) => (
              <option key={idx} value={guest.name}>
                {guest.name} - {guest.profession} ({guest.referrer})
              </option>
            ))}
          </select>
          {isLoadingGuests && (
            <span className="hint">⏳ 載入中...</span>
          )}
        </div>
      )}

      {/* Guest Inputs */}
      <div className="form-group">
        <label htmlFor="guest-name">來賓姓名 Name *</label>
        <input
          id="guest-name"
          className="input-field"
          type="text"
          placeholder="請輸入來賓姓名..."
          value={guestName}
          onChange={(e) => {
            setGuestName(e.target.value);
            // Clear dropdown selection if manually typing
            if (selectedGuestId && e.target.value !== guestList.find(g => g.name === selectedGuestId)?.name) {
              setSelectedGuestId("");
            }
          }}
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

      {/* Matching Popup */}
      {showMatchPopup && (
        <div 
          className="match-popup-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowMatchPopup(false)}
        >
          <div 
            className="match-popup-content"
            style={{
              background: 'var(--card-bg, #1a1a2e)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>🎯 推薦配對會員</h3>
              <button 
                onClick={() => setShowMatchPopup(false)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer',
                  color: 'var(--text, white)'
                }}
              >
                ×
              </button>
            </div>
            
            <p style={{ color: 'var(--muted, #888)', marginBottom: '1rem' }}>
              為 <strong>{checkedInGuestName}</strong> 推薦的會員：
            </p>

            {isLoadingMatches ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                <p>正在分析配對中...</p>
              </div>
            ) : matchingResults.length > 0 ? (
              <div className="match-list">
                {matchingResults.map((match, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '0.75rem 1rem',
                      background: match.matchStrength === 'High' 
                        ? 'rgba(34, 197, 94, 0.15)' 
                        : match.matchStrength === 'Medium'
                          ? 'rgba(234, 179, 8, 0.15)'
                          : 'rgba(148, 163, 184, 0.1)',
                      borderRadius: '8px',
                      marginBottom: '0.5rem',
                      borderLeft: `3px solid ${
                        match.matchStrength === 'High' 
                          ? '#22c55e' 
                          : match.matchStrength === 'Medium'
                            ? '#eab308'
                            : '#94a3b8'
                      }`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>
                        {match.matchStrength === 'High' ? '🔥' : match.matchStrength === 'Medium' ? '⚡' : '💡'}
                      </span>
                      <strong>{match.memberName}</strong>
                    </div>
                    <div style={{ color: 'var(--muted, #888)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      {match.profession}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted, #888)' }}>
                <p>暫無推薦配對</p>
              </div>
            )}

            <button
              onClick={() => setShowMatchPopup(false)}
              className="button"
              style={{ width: '100%', marginTop: '1rem' }}
            >
              確定
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
