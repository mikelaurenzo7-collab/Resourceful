export const DEFAULT_APP_URL = 'https://resourceful-7x38.vercel.app';

function hasProtocol(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

/**
 * Returns a safe, canonical application origin for metadata, redirects, and SEO.
 *
 * Vercel dashboard links are not deployable application origins. Treat them as
 * configuration mistakes and fall back to the canonical production hostname.
 */
export function getAppUrl(rawValue = process.env.NEXT_PUBLIC_APP_URL): string {
  const candidate = rawValue?.trim();
  if (!candidate) return DEFAULT_APP_URL;

  try {
    const parsed = new URL(hasProtocol(candidate) ? candidate : `https://${candidate}`);

    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      return DEFAULT_APP_URL;
    }

    if (parsed.hostname === 'vercel.com' && parsed.pathname !== '/') {
      return DEFAULT_APP_URL;
    }

    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_APP_URL;
  }
}
