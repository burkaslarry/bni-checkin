import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateQrFlyerPdfBlob } from "../lib/generateQrFlyerPdf";

const mockAddImage = vi.fn();
const mockOutput = vi.fn(() => new Blob(["pdf"], { type: "application/pdf" }));
const mockHtml2Canvas = vi.fn(async () => ({
  width: 1436,
  height: 2000,
  toDataURL: () => "data:image/png;base64,abc"
}));

vi.mock("html2canvas", () => ({
  default: (...args: unknown[]) => mockHtml2Canvas(...args)
}));

vi.mock("jspdf", () => ({
  jsPDF: class {
    addImage = mockAddImage;
    output = mockOutput;
  }
}));

describe("generateQrFlyerPdfBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fills A4 printable width regardless of narrow source element", async () => {
    const root = document.createElement("div");
    root.className = "qr-pdf-capture-root";
    root.style.visibility = "hidden";
    const element = document.createElement("div");
    element.className = "qr-pdf-capture";
    element.id = "qr-pdf";
    element.style.width = "320px";
    root.appendChild(element);
    document.body.appendChild(root);

    const blob = await generateQrFlyerPdfBlob(element);

    expect(mockHtml2Canvas).toHaveBeenCalledTimes(1);
    const options = mockHtml2Canvas.mock.calls[0][1] as { onclone?: (doc: Document, el: HTMLElement) => void };
    expect(options.onclone).toBeTypeOf("function");
    expect(root.style.visibility).toBe("hidden");

    expect(mockAddImage).toHaveBeenCalledTimes(1);
    const [, , x, , width] = mockAddImage.mock.calls[0];
    expect(x).toBe(10);
    expect(width).toBe(190);
    expect(blob.type).toBe("application/pdf");

    document.body.removeChild(root);
  });
});
