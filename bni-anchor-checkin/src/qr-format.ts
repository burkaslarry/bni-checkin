/**
 * QR Code Data Format for BNI Anchor Attendance
 * 
 * Two types: "member" (BNI Anchor member) and "guest" (visitor)
 */

export interface MemberQRData {
  name: string;
  time: string;
  type: "member";
  membershipId: string;
}

export interface GuestQRData {
  name: string;
  time: string;
  type: "guest";
  referrer: string;
}

export type AttendanceQRData = MemberQRData | GuestQRData;

/**
 * Generate a member check-in payload
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
 * Generate a guest check-in payload
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

/**
 * Test payloads for quick testing
 */
export const TEST_PAYLOADS = {
  member: generateMemberPayload("larrylo", "ANCHOR-001"),
  guest: generateGuestPayload("karinyeung", "larrylo")
};
