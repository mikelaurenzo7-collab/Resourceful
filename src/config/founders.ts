// ─── Founders Configuration ──────────────────────────────────────────────────
// Founder accounts get full access to all services at no cost.
// Add emails here to grant founder-level access.

export const FOUNDER_EMAILS: ReadonlySet<string> = new Set([
  'mikelaurenzo7@gmail.com',
]);

/**
 * Check if an email belongs to a founder account.
 * Case-insensitive comparison.
 */
export function isFounderEmail(email: string): boolean {
  return FOUNDER_EMAILS.has(email.toLowerCase().trim());
}
