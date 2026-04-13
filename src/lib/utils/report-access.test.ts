import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateReportAccessToken, verifyReportAccessToken } from './report-access';

describe('report access tokens', () => {
  afterEach(() => {
    delete process.env.REPORT_ACCESS_TOKEN_SECRET;
    vi.useRealTimers();
  });

  it('verifies a valid token for the matching report', () => {
    process.env.REPORT_ACCESS_TOKEN_SECRET = 'test-secret';

    const token = generateReportAccessToken('report-123', 300);

    expect(verifyReportAccessToken(token, 'report-123')).toBe(true);
  });

  it('rejects a token for a different report', () => {
    process.env.REPORT_ACCESS_TOKEN_SECRET = 'test-secret';

    const token = generateReportAccessToken('report-123', 300);

    expect(verifyReportAccessToken(token, 'report-456')).toBe(false);
  });

  it('rejects an expired token', () => {
    process.env.REPORT_ACCESS_TOKEN_SECRET = 'test-secret';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T20:00:00Z'));

    const token = generateReportAccessToken('report-123', 60);
    vi.setSystemTime(new Date('2026-04-13T20:02:00Z'));

    expect(verifyReportAccessToken(token, 'report-123')).toBe(false);
  });
});