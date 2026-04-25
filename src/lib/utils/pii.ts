/**
 * Mask email addresses anywhere in a string to keep PII out of error payloads.
 */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function maskEmails(input: string | undefined | null): string | undefined {
  if (!input) return input ?? undefined;
  return input.replace(EMAIL_RE, '[EMAIL]');
}
