import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, isRetryableError } from './retry';

// ─── isRetryableError ────────────────────────────────────────────────────────

describe('isRetryableError', () => {
  describe('rate limit errors', () => {
    it('matches HTTP 429 in message', () => {
      expect(isRetryableError(new Error('Request failed with status 429'))).toBe(true);
    });

    it('matches "rate limit" in message', () => {
      expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
    });

    it('matches "too many requests" in message', () => {
      expect(isRetryableError(new Error('Too Many Requests'))).toBe(true);
    });
  });

  describe('server errors', () => {
    it('matches 500 internal server error', () => {
      expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
    });

    it('matches 502 bad gateway', () => {
      expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    });

    it('matches 503 service unavailable', () => {
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('matches 504 gateway timeout', () => {
      expect(isRetryableError(new Error('504 Gateway Timeout'))).toBe(true);
    });
  });

  describe('timeout / network errors', () => {
    it('matches 408 request timeout', () => {
      expect(isRetryableError(new Error('408 Request Timeout'))).toBe(true);
    });

    it('matches ECONNRESET', () => {
      expect(isRetryableError(new Error('read ECONNRESET'))).toBe(true);
    });

    it('matches ECONNREFUSED', () => {
      expect(isRetryableError(new Error('connect ECONNREFUSED 127.0.0.1:443'))).toBe(true);
    });

    it('matches ETIMEDOUT', () => {
      expect(isRetryableError(new Error('connect ETIMEDOUT'))).toBe(true);
    });

    it('matches generic timeout', () => {
      expect(isRetryableError(new Error('request timeout'))).toBe(true);
    });

    it('matches fetch failed', () => {
      expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    });
  });

  describe('non-retryable errors', () => {
    it('does not retry 400 bad request', () => {
      expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
    });

    it('does not retry 401 unauthorized', () => {
      expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    });

    it('does not retry 403 forbidden', () => {
      expect(isRetryableError(new Error('403 Forbidden'))).toBe(false);
    });

    it('does not retry 404 not found', () => {
      expect(isRetryableError(new Error('404 Not Found'))).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(isRetryableError('some string error')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(42)).toBe(false);
      expect(isRetryableError({ message: '503' })).toBe(false);
    });
  });
});

// ─── withRetry ───────────────────────────────────────────────────────────────

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result when fn succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxAttempts then throws last error', async () => {
    // Use baseDelayMs: 0 so we avoid fake-timer / unhandled-rejection interaction
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('503 always fails'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false })
    ).rejects.toThrow('503 always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry more than maxAttempts times', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('500'));

    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 0, jitter: false })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('stops immediately when retryOn returns false', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('400 Bad Request'));

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 0,
        jitter: false,
        retryOn: (e) => isRetryableError(e),
      })
    ).rejects.toThrow('400 Bad Request');

    // Should have thrown after first attempt — no retries
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when retryOn returns true', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce('success');

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      jitter: false,
      retryOn: () => true,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects maxDelayMs cap', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('503'));
    // baseDelayMs=1000, maxDelayMs=0 → Math.min(1000, 0) = 0ms actual delay
    // Verifies maxDelayMs cap is applied and correct attempt count is made
    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 0, jitter: false })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('works with default options', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
  });
});
