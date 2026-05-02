// ─── Retry with Exponential Backoff ──────────────────────────────────────────
// Shared utility for retrying async operations with exponential backoff + jitter.
// Used by: Anthropic API, Resend email, web fetches.

import { logger } from '@/lib/logger';

export interface RetryOptions {
  maxAttempts?: number;       // Default: 3
  baseDelayMs?: number;       // Default: 1000 (1s)
  maxDelayMs?: number;        // Default: 30000 (30s)
  jitter?: boolean;           // Default: true
  retryOn?: (error: unknown) => boolean; // Custom retry condition
}

/**
 * Retry an async function with exponential backoff.
 * Delay: baseDelay * 2^attempt (with optional jitter).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitter = true,
    retryOn,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this specific error
      if (retryOn && !retryOn(error)) {
        throw error; // Non-retryable error
      }

      if (attempt === maxAttempts) {
        break; // Out of retries
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

      // Add jitter (±25%) to prevent thundering herd
      if (jitter) {
        const jitterRange = delay * 0.25;
        delay += (Math.random() - 0.5) * jitterRange;
      }

      logger.warn(
        { attempt, maxAttempts, delayMs: Math.round(delay), error: error instanceof Error ? error.message : String(error) },
        'Retry attempt failed, scheduling retry'
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if an error is a rate limit (HTTP 429) or server error (5xx).
 * Use as retryOn condition for API calls.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Rate limited
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) return true;
    // Server errors
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
    // Request timeout
    if (msg.includes('408') || msg.includes('request timeout')) return true;
    // Network errors
    if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('etimedout') || msg.includes('timeout') || msg.includes('fetch failed')) return true;
  }
  return false; // Don't retry client errors (400, 401, 403, etc.)
}
