import { describe, it, expect } from 'vitest';
import { getClientIp } from './rate-limit';

// ─── getClientIp ────────────────────────────────────────────────────────────
// Pure function — no DB or network dependencies.

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('https://example.com', {
      headers: new Headers(headers),
    });
  }

  it('extracts first IP from x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('handles single IP in x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('trims whitespace from forwarded IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  203.0.113.50  , 10.0.0.1' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('falls back to x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.23' });
    expect(getClientIp(req)).toBe('198.51.100.23');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.50',
      'x-real-ip': '198.51.100.23',
    });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('falls back to 127.0.0.1 when no headers present', () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('handles IPv6 in x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '::1, 203.0.113.50' });
    expect(getClientIp(req)).toBe('::1');
  });
});
