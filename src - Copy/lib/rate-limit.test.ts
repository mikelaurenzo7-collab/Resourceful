import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Rate Limiter Error Scenarios ────────────────────────────────────────────
// Tests the in-memory fallback, IP extraction, and rate limiting responses.

// Mocks must be at top level for Vitest hoisting
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: () => Promise.reject(new Error('DB unavailable')),
  }),
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// We test the pure functions (checkMemoryRateLimit behavior via checkRateLimit,
// getClientIp) without needing a real database.

describe('getClientIp', () => {
  // Import lazily to avoid module-level side effects
  let getClientIp: (req: Request) => string;

  beforeEach(async () => {
    const mod = await import('./rate-limit');
    getClientIp = mod.getClientIp;
  });

  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178' },
    });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('extracts IP from x-real-ip header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.42' },
    });
    expect(getClientIp(req)).toBe('198.51.100.42');
  });

  it('falls back to 127.0.0.1 when no headers present', () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '10.0.0.1',
        'x-real-ip': '10.0.0.2',
      },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('trims whitespace from forwarded IPs', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('192.168.1.1');
  });
});

describe('applyRateLimit', () => {
  let applyRateLimit: typeof import('./rate-limit').applyRateLimit;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./rate-limit');
    applyRateLimit = mod.applyRateLimit;
  });

  it('returns null when under the limit', async () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    const result = await applyRateLimit(req, {
      prefix: 'test',
      limit: 10,
      windowSeconds: 60,
    });
    expect(result).toBeNull();
  });

  it('returns 429 when limit is exceeded', async () => {
    const config = { prefix: 'test-exceed', limit: 2, windowSeconds: 60 };
    const makeReq = () =>
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '5.6.7.8' },
      });

    // Use up the limit (DB falls back to memory after failures)
    await applyRateLimit(makeReq(), config);
    await applyRateLimit(makeReq(), config);

    // Third request should be rate limited
    const result = await applyRateLimit(makeReq(), config);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    
    const body = await result?.json();
    expect(body.error).toContain('Too many requests');
  });

  it('includes Retry-After header in 429 response', async () => {
    const config = { prefix: 'test-headers', limit: 1, windowSeconds: 60 };
    const makeReq = () =>
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '9.10.11.12' },
      });

    await applyRateLimit(makeReq(), config);
    const result = await applyRateLimit(makeReq(), config);
    
    expect(result?.headers.get('Retry-After')).toBeTruthy();
    expect(result?.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});
