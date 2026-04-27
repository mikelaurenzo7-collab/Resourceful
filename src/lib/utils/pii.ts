/**
 * Utility for masking Personally Identifiable Information (PII).
 * Primary use case is scrubbing logs and Sentry payloads.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Mask email addresses anywhere in a string.
 * Returns '[EMAIL]' in place of any matched email pattern.
 */
export function maskEmails(input: string | undefined | null): string | undefined {
  if (!input) return input ?? undefined;
  return input.replace(EMAIL_RE, '[EMAIL]');
}
