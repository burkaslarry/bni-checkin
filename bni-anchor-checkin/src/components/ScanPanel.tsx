import { useCallback, useEffect, useRef, useState } from "react";
import { recordAttendance } from "../api";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { TEST_PAYLOADS } from "../qr-format";

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

export type NotificationEntry = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

type ScanPanelProps = {
  onNotify: (notification: NotificationEntry) => void;
};

type ScanStatus = "Ready" | "Scanning…" | "Success" | "Error";

export const ScanPanel = ({ onNotify }: ScanPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("Ready");
  const [hint, setHint] = useState("Move closer/farther if QR isn’t detected.");
  const [manualValue, setManualValue] = useState("");
  const [supportsDetector, setSupportsDetector] = useState(false);
  const { enqueue, pendingCount, flushQueue } = useOfflineQueue();

  const initCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHint("Camera not available.");
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
      setHint("Camera active. Frame the QR code inside the dashed box.");
    } catch (error) {
      setHint("Camera access denied or unavailable.");
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

  const submitScan = useCallback(
    async (payload: string) => {
      try {
        if (!navigator.onLine) {
          throw new Error("offline");
        }
        await recordAttendance(payload);
        setScanStatus("Success");
        setHint("Attendance Recorded. Thanks!");
        onNotify({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          type: "success",
          message: "Attendance recorded successfully."
        });
        if (pendingCount > 0) {
          const { flushed } = await flushQueue();
          if (flushed) {
            onNotify({
              id:
                crypto.randomUUID
                  ? crypto.randomUUID()
                  : Math.random().toString(36).slice(2),
              type: "info",
              message: `${flushed} queued scan${flushed > 1 ? "s" : ""} synced.`
            });
          }
        }
      } catch (error) {
        enqueue(payload);
        setScanStatus("Error");
        setHint("Queued scan for sync. Check network before retrying.");
        onNotify({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          type: "error",
          message: "Scan couldn’t reach the server. Saved locally."
        });
      }
    },
    [enqueue, flushQueue, onNotify, pendingCount]
  );

  const handleScan = async () => {
    if (!supportsDetector || !detectorRef.current || !videoRef.current) {
      setScanStatus("Error");
      setHint("Auto-scanning isn’t supported. Use manual entry.");
      return;
    }
    setScanStatus("Scanning…");
    setHint("Scanning...");
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setHint("Camera warming up. Try again in a moment.");
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
      await submitScan(barcodes[0].rawValue);
    } catch (error) {
      setScanStatus("Error");
      setHint("Move closer/farther if QR isn’t detected.");
      onNotify({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        type: "error",
        message: "No QR code was found. Try again."
      });
    }
  };

  const handleManualSubmit = async () => {
    if (!manualValue.trim()) {
      return;
    }
    await submitScan(manualValue.trim());
    setManualValue("");
  };

  return (
    <section className="section scan-panel">
      <div className="section-header">
        <h2>Scan QR Code</h2>
        <p className="hint">
          Large touch targets keep the scanning flow fast on mobile devices.
        </p>
      </div>
      <div className="video-wrapper">
        <video ref={videoRef} muted playsInline autoPlay />
      </div>
      <div className="status-row">
        <span className={`status-chip ${scanStatus === "Success" ? "success" : ""} ${scanStatus === "Error" ? "error" : ""}`}>
          {scanStatus}
        </span>
        <span className="hint">{pendingCount ? `${pendingCount} scan${pendingCount > 1 ? "s" : ""} waiting to sync.` : "Ready to start scanning."}</span>
      </div>
      <p className="hint">{hint}</p>
      <div className="status-row">
        <button className="button" type="button" onClick={handleScan}>
          Scan QR Code
        </button>
        <button className="ghost-button button" type="button" onClick={initCamera}>
          Try focusing
        </button>
      </div>
      <p className="hint">Manual payload (copy QR data if auto-scan fails)</p>
      <div className="status-row">
        <input
          className="input-field"
          placeholder="QR data or attendance token"
          value={manualValue}
          onChange={(event) => setManualValue(event.target.value)}
        />
        <button
          className="button"
          type="button"
          onClick={handleManualSubmit}
          disabled={!manualValue.trim()}
        >
          Submit
        </button>
      </div>
      
      <div className="test-payloads">
        <p className="hint"><strong>Quick Test Payloads:</strong> Click to auto-fill the field above</p>
        <div className="payload-buttons">
          <button
            className="ghost-button"
            type="button"
            title="BNI member check-in"
            onClick={() => {
              setManualValue(TEST_PAYLOADS.member);
              navigator.clipboard.writeText(TEST_PAYLOADS.member);
              onNotify({
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                type: "info",
                message: "Member payload copied"
              });
            }}
          >
            👤 Member (larrylo)
          </button>
          <button
            className="ghost-button"
            type="button"
            title="Guest check-in"
            onClick={() => {
              setManualValue(TEST_PAYLOADS.guest);
              navigator.clipboard.writeText(TEST_PAYLOADS.guest);
              onNotify({
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                type: "info",
                message: "Guest payload copied"
              });
            }}
          >
            👥 Guest (karinyeung)
          </button>
        </div>
      </div>
    </section>
  );
};

