// ─── PII Masking Utilities ───────────────────────────────────────────────────
// Centralized logic for scrubbing sensitive information from logs and reports.

export const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Mask email addresses in a string to prevent PII leakage to log aggregators.
 */
export function maskEmails(input: string | undefined | null): string | undefined {
  if (!input) return input ?? undefined;
  return input.replace(EMAIL_RE, '[EMAIL]');
}
