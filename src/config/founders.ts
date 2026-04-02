// ─── Founders Configuration ──────────────────────────────────────────────────
// Founder accounts get full access to all services at no cost.
// Set FOUNDER_EMAILS env var as a comma-separated list of emails.

const founderList = (process.env.FOUNDER_EMAILS ?? '')
  .split(',')
  .map(e => e.toLowerCase().trim())
  .filter(Boolean);

export const FOUNDER_EMAILS: ReadonlySet<string> = new Set(founderList);

/**
 * Check if an email belongs to a founder account.
 * Case-insensitive comparison.
 */
export function isFounderEmail(email: string): boolean {
  return FOUNDER_EMAILS.has(email.toLowerCase().trim());
}
