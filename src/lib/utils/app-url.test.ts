import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_URL, getAppUrl } from './app-url';

describe('getAppUrl', () => {
  it('uses the production fallback when the configured value is empty', () => {
    expect(getAppUrl('')).toBe(DEFAULT_APP_URL);
  });

  it('adds https to a scheme-less application hostname', () => {
    expect(getAppUrl('resourceful-7x38.vercel.app')).toBe(
      'https://resourceful-7x38.vercel.app'
    );
  });

  it.each([
    'vercel.com/revaluate/resourceful-7x38',
    'https://www.vercel.com/revaluate/resourceful-7x38',
  ])('rejects Vercel dashboard URL %s', (value) => {
    expect(getAppUrl(value)).toBe(DEFAULT_APP_URL);
  });

  it('returns an origin without paths, query strings, fragments, or trailing slashes', () => {
    expect(getAppUrl('https://example.com/app/?preview=1#top')).toBe('https://example.com');
  });

  it('preserves an explicit local development port', () => {
    expect(getAppUrl('http://localhost:3000/start')).toBe('http://localhost:3000');
  });

  it('rejects credential-bearing URLs', () => {
    expect(getAppUrl('https://user:password@example.com')).toBe(DEFAULT_APP_URL);
  });

  it('rejects invalid or non-http URLs', () => {
    expect(getAppUrl('javascript:alert(1)')).toBe(DEFAULT_APP_URL);
    expect(getAppUrl('not a valid host')).toBe(DEFAULT_APP_URL);
  });
});
