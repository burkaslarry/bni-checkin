import { ROOT_WEBSITE_URL } from "./publicSiteUrl";

/** Filename: "{Display-Name}-{YYYY-MM-DD}.pdf" (spaces → hyphens). */
export function buildChapterPdfFilename(displayName: string, eventDate: string): string {
  const base =
    displayName
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[/\\?%*:|"<>]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "BNI-Chapter";
  const date = (eventDate || "event").trim().slice(0, 10);
  return `${base}-${date}.pdf`;
}

/** Public check-in URL for QR (non-anchor chapters get ?chapter=). */
export function chapterCheckInUrl(chapterTag?: string | null): string {
  const tag = (chapterTag || "anchor").trim().toLowerCase() || "anchor";
  if (tag === "anchor") return ROOT_WEBSITE_URL;
  const sep = ROOT_WEBSITE_URL.includes("?") ? "&" : "?";
  return `${ROOT_WEBSITE_URL}${sep}chapter=${encodeURIComponent(tag)}`;
}

/** Same-origin logo path for PDF capture (html2canvas). */
export function chapterPdfLogoSrc(chapterTag?: string | null): string | null {
  const tag = (chapterTag || "anchor").trim().toLowerCase();
  if (tag === "amax") return "/bni-amax-hk.jpg";
  return null;
}
