/**
 * Generates and copies an invite link to the clipboard.
 * Phase 1 workaround for email invitations (before Resend is wired up).
 */
export function buildInviteLink(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/invite/${token}`;
}

/**
 * Copies the invite link for a given token to the clipboard.
 * Returns true on success, false if clipboard API is unavailable.
 */
export async function copyInviteLink(token: string): Promise<boolean> {
  const link = buildInviteLink(token);
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}
