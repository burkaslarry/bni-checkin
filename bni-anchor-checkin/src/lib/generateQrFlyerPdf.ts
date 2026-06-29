import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { PDF_CAPTURE_WIDTH_PX } from "../components/QrFlyerContent";

const A4_PAGE_WIDTH_MM = 210;
const A4_PAGE_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 10;

function prepareCaptureRootForHtml2Canvas(element: HTMLElement): (() => void) {
  const root = element.closest(".qr-pdf-capture-root") as HTMLElement | null;
  if (!root) {
    return () => undefined;
  }

  const previous = {
    visibility: root.style.visibility,
    opacity: root.style.opacity,
    left: root.style.left,
    top: root.style.top,
    position: root.style.position,
    zIndex: root.style.zIndex
  };

  root.style.visibility = "visible";
  root.style.opacity = "1";
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.zIndex = "999999";

  return () => {
    root.style.visibility = previous.visibility;
    root.style.opacity = previous.opacity;
    root.style.left = previous.left;
    root.style.top = previous.top;
    root.style.position = previous.position;
    root.style.zIndex = previous.zIndex;
  };
}

function prepareClonedCaptureTree(clonedEl: HTMLElement): void {
  clonedEl.style.width = `${PDF_CAPTURE_WIDTH_PX}px`;
  clonedEl.style.boxSizing = "border-box";
  clonedEl.style.background = "#ffffff";

  let node: HTMLElement | null = clonedEl;
  while (node) {
    node.style.visibility = "visible";
    node.style.opacity = "1";
    if (node.classList.contains("qr-pdf-capture-root")) {
      node.style.position = "static";
      node.style.left = "0";
      node.style.top = "0";
      node.style.width = `${PDF_CAPTURE_WIDTH_PX}px`;
    }
    node = node.parentElement;
  }
}

/**
 * Rasterise the fixed-width `#qr-pdf` DOM with html2canvas, then pack into an A4 PDF blob.
 * Capture width is device-independent so mobile and desktop produce identical PDFs.
 */
export async function generateQrFlyerPdfBlob(element: HTMLElement): Promise<Blob> {
  const restoreCaptureRoot = prepareCaptureRootForHtml2Canvas(element);

  try {
    // Let SVG/QR paint before rasterising (helps mobile WebKit).
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: false,
      windowWidth: PDF_CAPTURE_WIDTH_PX,
      onclone: (_doc, clonedEl) => {
        prepareClonedCaptureTree(clonedEl);
      }
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("PDF capture failed: empty canvas");
    }

    const imgData = canvas.toDataURL("image/png");
    if (!imgData || imgData === "data:,") {
      throw new Error("PDF capture failed: empty image data");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const availableWidth = A4_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
    const availableHeight = A4_PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2;
    const imgAspectRatio = canvas.width / canvas.height;

    const imgWidth = availableWidth;
    const imgHeight = imgWidth / imgAspectRatio;
    const xPosition = PDF_MARGIN_MM;
    const yPosition = PDF_MARGIN_MM + Math.max(0, (availableHeight - imgHeight) / 2);

    pdf.addImage(imgData, "PNG", xPosition, yPosition, imgWidth, imgHeight);

    return pdf.output("blob");
  } finally {
    restoreCaptureRoot();
  }
}
