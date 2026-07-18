import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_URL, getAppUrl } from './app-url';

describe('getAppUrl', () => {
  it('uses the production fallback when no value is configured', () => {
    expect(getAppUrl(undefined)).toBe(DEFAULT_APP_URL);
  });

  it('adds https to a scheme-less application hostname', () => {
    expect(getAppUrl('resourceful-7x38.vercel.app')).toBe(
      'https://resourceful-7x38.vercel.app'
    );
  });

  it('rejects a Vercel dashboard project URL', () => {
    expect(getAppUrl('vercel.com/revaluate/resourceful-7x38')).toBe(DEFAULT_APP_URL);
  });

  it('removes trailing slashes, query strings, and fragments', () => {
    expect(getAppUrl('https://example.com/?preview=1#top')).toBe('https://example.com');
  });

  it('rejects invalid or non-http URLs', () => {
    expect(getAppUrl('javascript:alert(1)')).toBe(DEFAULT_APP_URL);
    expect(getAppUrl('not a valid host')).toBe(DEFAULT_APP_URL);
  });
});
