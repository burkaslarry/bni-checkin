/**
 * QR Code data format for BNI Anchor attendance: "member" (BNI member) or "guest" (visitor).
 */

/** Member QR payload (name, time, type "member", membershipId). */
export interface MemberQRData {
  name: string;
  time: string;
  type: "member";
  membershipId: string;
}

/** Guest QR payload (name, time, type "guest", referrer). */
export interface GuestQRData {
  name: string;
  time: string;
  type: "guest";
  referrer: string;
}

/** Union of member or guest QR payload. */
export type AttendanceQRData = MemberQRData | GuestQRData;

/**
 * Generate a member check-in JSON payload. Side effect: uses current time (new Date()).
 * @param {string} name - Trimmed
 * @param {string} membershipId - Trimmed
 * @returns {string} JSON string for QR / API
 * @example generateMemberPayload("Alice", "ANCHOR-001")
 */
export function generateMemberPayload(
  name: string,
  membershipId: string
): string {
  const payload: MemberQRData = {
    name: name.trim(),
    time: new Date().toISOString(),
    type: "member",
    membershipId: membershipId.trim()
  };
  return JSON.stringify(payload);
}

/**
 * Generate a guest check-in JSON payload. Side effect: uses current time (new Date()).
 * @param {string} name - Trimmed
 * @param {string} referrer - Trimmed
 * @returns {string} JSON string for QR / API
 */
export function generateGuestPayload(
  name: string,
  referrer: string
): string {
  const payload: GuestQRData = {
    name: name.trim(),
    time: new Date().toISOString(),
    type: "guest",
    referrer: referrer.trim()
  };
  return JSON.stringify(payload);
}

/** Pre-built test payloads for member and guest (quick testing). */
export const TEST_PAYLOADS = {
  member: generateMemberPayload("larrylo", "ANCHOR-001"),
  guest: generateGuestPayload("karinyeung", "larrylo")
};
