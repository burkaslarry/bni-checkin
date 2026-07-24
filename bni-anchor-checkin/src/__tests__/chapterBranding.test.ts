import { describe, expect, it } from "vitest";
import {
  buildChapterPdfFilename,
  chapterCheckInUrl,
  chapterPdfLogoSrc,
} from "../lib/chapterBranding";

describe("chapterBranding", () => {
  it("builds PDF filename from display name and date", () => {
    expect(buildChapterPdfFilename("BNI AMax", "2026-07-29")).toBe("BNI-AMax-2026-07-29.pdf");
    expect(buildChapterPdfFilename("BNI Anchor", "2026-07-30")).toBe("BNI-Anchor-2026-07-30.pdf");
    expect(buildChapterPdfFilename("BNI Dynasty", "2026-08-05")).toBe("BNI-Dynasty-2026-08-05.pdf");
  });

  it("scopes check-in URL for non-anchor chapters", () => {
    expect(chapterCheckInUrl("anchor")).toBe("https://bni-anchor-checkin.vercel.app");
    expect(chapterCheckInUrl("amax")).toBe("https://bni-anchor-checkin.vercel.app?chapter=amax");
  });

  it("returns AMax logo path only for amax", () => {
    expect(chapterPdfLogoSrc("amax")).toBe("/bni-amax-hk.jpg");
    expect(chapterPdfLogoSrc("anchor")).toBeNull();
  });
});
