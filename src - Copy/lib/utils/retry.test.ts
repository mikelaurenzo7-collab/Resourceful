import { describe, it, expect, vi } from 'vitest';

// Mock logger before importing the module under test
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { withRetry, isRetryableError } from './retry';

// ─── Retry Utility Error Scenarios ──────────────────────────────────────────

describe('withRetry', () => {
  it('succeeds on first attempt', async () => {
    const fn = async () => 42;
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe(42);
  });

  it('retries and succeeds on later attempt', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient failure');
      return 'success';
    };
    
    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 20,
    });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = async () => { throw new Error('permanent failure'); };
    
    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 20 })
    ).rejects.toThrow('permanent failure');
  });

  it('respects custom retryOn predicate', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error(attempts === 1 ? 'retryable' : 'not-retryable');
    };

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseDelayMs: 10,
        retryOn: (err) => err instanceof Error && err.message === 'retryable',
      })
    ).rejects.toThrow('not-retryable');
    expect(attempts).toBe(2);
  });

  it('applies exponential backoff delay', async () => {
    const timestamps: number[] = [];
    let attempts = 0;
    
    const fn = async () => {
      timestamps.push(Date.now());
      attempts++;
      if (attempts < 3) throw new Error('retry');
      return 'done';
    };

    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 500,
      jitter: false,
    });

    // Second attempt should have ~50ms delay, third ~100ms
    const delay1 = timestamps[1] - timestamps[0];
    const delay2 = timestamps[2] - timestamps[1];
    
    expect(delay1).toBeGreaterThan(30);  // ~50ms with some tolerance
    expect(delay2).toBeGreaterThan(60);  // ~100ms with some tolerance
    expect(delay2).toBeGreaterThan(delay1); // Exponential growth
  });
});

describe('isRetryableError', () => {
  it('returns true for 429 rate limit errors', () => {
    expect(isRetryableError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
  });

  it('returns true for 500 server errors', () => {
    expect(isRetryableError(new Error('HTTP 500 Internal Server Error'))).toBe(true);
  });

  it('returns true for 503 service unavailable', () => {
    expect(isRetryableError(new Error('HTTP 503 Service Unavailable'))).toBe(true);
  });

  it('returns false for 400 client errors', () => {
    expect(isRetryableError(new Error('HTTP 400 Bad Request'))).toBe(false);
  });

  it('returns false for 404 not found', () => {
    expect(isRetryableError(new Error('HTTP 404 Not Found'))).toBe(false);
  });

  it('returns true for network errors', () => {
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
  });

  it('returns false for non-Error values', () => {
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });
});
