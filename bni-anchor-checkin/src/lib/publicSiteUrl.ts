/** Production check-in site URL embedded in QR flyers. */
export const ROOT_WEBSITE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_URL) ||
  "https://bni-anchor-checkin.vercel.app";
