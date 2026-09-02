type MemberInfo = { name: string; profession: string };

/**
 * Direct browser → DeepSeek is disabled: VITE_ keys ship in the public JS bundle.
 * Matching must go through the Render backend.
 */
export async function matchOneGuestDirect(
  _guestName: string,
  _guestProfession: string,
  _guestRemarks: string | undefined,
  _members: MemberInfo[]
): Promise<{ memberName: string; profession: string; matchStrength: string; reason: string }[]> {
  throw new Error("Direct DeepSeek from the browser is disabled. Matching goes through the backend.");
}
