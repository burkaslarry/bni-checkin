import type { EventData } from "../api";
import { generateQrFlyerPdfBlob } from "./generateQrFlyerPdf";
import type { QrFlyerEventData } from "../components/QrFlyerContent";

export function eventToQrFlyerData(event: EventData): QrFlyerEventData {
  return {
    eventName: event.name,
    eventDate: event.date,
    registrationStartTime: event.registrationStartTime,
    startTime: event.startTime,
    onTimeCutoff: event.onTimeCutoff,
    endTime: event.endTime
  };
}

/** Download QR check-in flyer PDF for an event (element must already be in the DOM). */
export async function downloadEventQrFlyerPdf(
  event: EventData,
  captureElementId = "qr-pdf"
): Promise<void> {
  const element = document.getElementById(captureElementId);
  if (!element) {
    throw new Error("QR preview not found");
  }
  const pdfBlob = await generateQrFlyerPdfBlob(element);
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.download = `BNI-Anchor-${event.date}.pdf`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
