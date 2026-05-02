// ─── Founders Configuration ──────────────────────────────────────────────────
// Founder accounts get full access to all services at no cost.
// Set FOUNDER_EMAILS env var as a comma-separated list of emails.

import { logger } from '@/lib/logger';

let warnedEmpty = false;

/**
 * Build the founder set from env var.
 * Re-read on every call so changes to .env.local are picked up after
 * a dev-server restart without needing a full rebuild.
 */
function getFounderEmails(): ReadonlySet<string> {
  const raw = process.env.FOUNDER_EMAILS ?? '';
  const list = raw
    .split(',')
    .map(e => e.toLowerCase().trim())
    .filter(Boolean);
  return new Set(list);
}

/**
 * Check if an email belongs to a founder account.
 * Case-insensitive comparison.
 */
export function isFounderEmail(email: string): boolean {
  const founders = getFounderEmails();
  if (founders.size === 0 && !warnedEmpty) {
    warnedEmpty = true;
    logger.warn('[founders] FOUNDER_EMAILS env var is empty — no founder bypass is active');
  }
  return founders.has(email.toLowerCase().trim());
}
