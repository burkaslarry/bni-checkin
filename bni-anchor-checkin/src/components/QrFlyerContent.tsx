import { QRCodeSVG } from "qrcode.react";

/** A4 printable content width at ~96 DPI (190mm with 10mm margins). Device-independent PDF capture. */
export const PDF_CAPTURE_WIDTH_PX = 718;
export const PDF_QR_SIZE = Math.round(PDF_CAPTURE_WIDTH_PX * 0.55);

export type QrFlyerEventData = {
  eventName: string;
  eventDate: string;
  registrationStartTime: string;
  startTime: string;
  onTimeCutoff: string;
  endTime: string;
};

type QrFlyerContentProps = {
  data: QrFlyerEventData;
  includeEventDate: boolean;
  websiteUrl: string;
  qrCodeId?: string;
};

/*
 * PDF export uses html2canvas with allowTaint: false. The public `/bni-anchor.svg` from Illustrator embeds
 * foreignObject / PGF metadata; loaded as <img> it taints the canvas and canvas.toDataURL throws SecurityError.
 * This component inlines a geometry-only subset of the mark + "ANCHOR" wordmark for safe rasterisation.
 */
function BniAnchorLogoForPdfCapture() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="150 330 310 210"
      role="img"
      aria-label="BNI Anchor Logo"
      style={{ maxWidth: "300px", height: "auto", display: "inline-block" }}
    >
      <polygon
        fill="#C32529"
        fillRule="evenodd"
        clipRule="evenodd"
        points="306.1,392.7 351.5,449.9 380.6,449.9 380.6,342.1 348.2,342.1 348.2,395.5 306.1,342.1 273.5,342.1 273.5,449.9 306.1,449.9"
      />
      <path
        fill="#C32529"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M165.2,449.9l44.5,0.1l12.7,0c9.1,0,17.5-1.4,25.2-5.9c17.1-10,18.6-31.9,6.2-43.7c-6.6-5.8-11-6.8-14-7.7c4.2-2.1,8.2-4.9,11.2-8.5c3.1-3.6,5-9,4.8-15.2c-0.7-22.3-20.3-26.9-35.9-26.9h-15.5l-39.1,0.1V449.9z M198.6,366.9h12.6c6.7,0,11.5,1.9,11.4,8.8c-0.2,6-5.4,8.3-11.4,8.3h-12.6V366.9z M198.6,408.1l17.2,0c7.7,0,12.9,2.8,12.8,8.7c-0.2,5.6-4.7,8.2-10.9,8.2h-19.1L198.6,408.1z"
      />
      <polygon fill="#C32529" fillRule="evenodd" clipRule="evenodd" points="427.6,354.9 394.5,387.7 394.5,449.9 427.6,449.9" />
      <polygon fill="#C32529" fillRule="evenodd" clipRule="evenodd" points="394.5,375 427.6,342.1 394.5,342.1" />
      <path
        fill="#C32529"
        d="M444.2,440.1c-0.9-0.9-2.2-1.5-3.6-1.5c-1.4,0-2.7,0.6-3.6,1.5c-0.9,0.9-1.5,2.2-1.5,3.6c0,1.4,0.6,2.7,1.5,3.6c0.9,0.9,2.2,1.5,3.6,1.5c1.4,0,2.7-0.6,3.6-1.5c0.9-0.9,1.5-2.2,1.5-3.6C445.7,442.3,445.2,441.1,444.2,440.1 M440.6,437.6c1.7,0,3.2,0.7,4.3,1.8c1.1,1.1,1.8,2.6,1.8,4.3c0,1.7-0.7,3.2-1.8,4.3c-1.1,1.1-2.6,1.8-4.3,1.8c-1.7,0-3.2-0.7-4.3-1.8c-1.1-1.1-1.8-2.6-1.8-4.3c0-1.7,0.7-3.2,1.8-4.3C437.4,438.3,438.9,437.6,440.6,437.6z"
      />
      <path
        fill="#C32529"
        d="M439.2,441.3h1.3c0.9,0,1.9,0.1,1.9,1.1c0,1.1-1.3,1.1-2.3,1.1h-0.8V441.3z M438.2,447.2h0.9v-3h1.2l2.1,3h1.1l-2.2-3.1c1.2-0.2,1.9-0.8,1.9-1.8c0-1.6-1.6-1.8-3.1-1.8h-2V447.2z"
      />
      <text x="302" y="516" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="64" fontWeight="900" fill="#6D6E71">
        ANCHOR
      </text>
    </svg>
  );
}

export function QrFlyerContent({ data, includeEventDate, websiteUrl, qrCodeId = "qr-code-website" }: QrFlyerContentProps) {
  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <BniAnchorLogoForPdfCapture />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "2rem",
          marginBottom: "2rem"
        }}
      >
        <div style={{ textAlign: "center", display: "flex", justifyContent: "center" }}>
          <QRCodeSVG
            id={qrCodeId}
            value={websiteUrl}
            size={PDF_QR_SIZE}
            level="H"
            bgColor="#ffffff"
            fgColor="#030712"
            marginSize={0}
            style={{ width: PDF_QR_SIZE, height: PDF_QR_SIZE }}
          />
        </div>
      </div>

      <div
        style={{
          background: "#eff6ff",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #bfdbfe",
          color: "#000"
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "#000" }}>
          📱 簽到步驟 Check-in Instructions:
        </div>
        <ol style={{ margin: "0", paddingLeft: "1.5rem", color: "#000" }}>
          <li>掃描 QR碼進入簽到網站 (Scan Step 1 to load website)</li>
        </ol>
      </div>

      <div className="qr-info-display" style={{ marginTop: "1.5rem", fontSize: "14px", color: "#000" }}>
        <div className="qr-info-row">
          <span className="qr-info-label">📅 活動名稱:</span>
          <span className="qr-info-value">{data.eventName}</span>
        </div>
        {includeEventDate && (
          <div className="qr-info-row" data-testid="qr-flyer-event-date">
            <span className="qr-info-label">📆 活動日期:</span>
            <span className="qr-info-value">{data.eventDate}</span>
          </div>
        )}
        <div className="qr-info-row">
          <span className="qr-info-label">🕐 登記開始:</span>
          <span className="qr-info-value">{data.registrationStartTime}</span>
        </div>
        <div className="qr-info-row">
          <span className="qr-info-label">🚀 活動開始:</span>
          <span className="qr-info-value">{data.startTime}</span>
        </div>
        <div className="qr-info-row">
          <span className="qr-info-label">⏰ 準時截止:</span>
          <span className="qr-info-value">{data.onTimeCutoff}</span>
        </div>
        <div className="qr-info-row">
          <span className="qr-info-label">🏁 活動結束:</span>
          <span className="qr-info-value">{data.endTime}</span>
        </div>
      </div>
    </>
  );
}
