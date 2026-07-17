// ─── Shared Public Page Fetcher ──────────────────────────────────────────────
// Deduplicates approved public URL fetches across public-records, comparable,
// county-enrichment, and research services. Rejects private-network targets,
// validates every redirect, caps response size, and caches bounded plain text.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PAGE_CACHE = new Map<string, { text: string | null; ts: number }>();
const TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 200;
const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 1_000_000;

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.home.arpa')
  );
}

export function isPrivateOrReservedIp(address: string): boolean {
  const normalized = normalizeHostname(address);
  const version = isIP(normalized);

  if (version === 4) {
    const octets = normalized.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return true;
    }

    const [a, b, c] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (version === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:') ||
      normalized === '2001:db8::' ||
      normalized.startsWith('::ffff:')
    );
  }

  return true;
}

function parsePublicHttpUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Credential-bearing URLs are not allowed');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Local or internal hostnames are not allowed');
  }

  return parsed;
}

async function assertPublicNetworkTarget(url: URL): Promise<void> {
  const hostname = normalizeHostname(url.hostname);

  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('Private or reserved IP targets are not allowed');
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error('Hostname did not resolve');
  }

  if (addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
    throw new Error('Hostname resolves to a private or reserved IP');
  }
}

function isReadableContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const normalized = contentType.toLowerCase();

  return (
    normalized.startsWith('text/') ||
    normalized.includes('application/xhtml+xml') ||
    normalized.includes('application/xml') ||
    normalized.includes('application/json')
  );
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('Response exceeds the maximum allowed size');
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Response exceeds the maximum allowed size');
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

async function fetchPublicText(rawUrl: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = parsePublicHttpUrl(rawUrl);

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      await assertPublicNetworkTarget(currentUrl);

      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResourcefulBot/1.0; evidence-research)',
          Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.8',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect response did not include a location');
        if (redirectCount === MAX_REDIRECTS) throw new Error('Too many redirects');
        currentUrl = parsePublicHttpUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`Public page returned ${response.status}`);
      }

      if (!isReadableContentType(response.headers.get('content-type'))) {
        throw new Error('Unsupported response content type');
      }

      return readLimitedText(response);
    }

    throw new Error('Too many redirects');
  } finally {
    clearTimeout(timer);
  }
}

function pruneCache(): void {
  if (PAGE_CACHE.size <= MAX_CACHE_SIZE) return;

  const now = Date.now();
  PAGE_CACHE.forEach((entry, key) => {
    if (now - entry.ts > TTL_MS) PAGE_CACHE.delete(key);
  });

  if (PAGE_CACHE.size > MAX_CACHE_SIZE) {
    const entries = Array.from(PAGE_CACHE.entries()).sort((a, b) => a[1].ts - b[1].ts);
    const excess = PAGE_CACHE.size - MAX_CACHE_SIZE;
    for (let index = 0; index < excess; index += 1) {
      PAGE_CACHE.delete(entries[index][0]);
    }
  }
}

/**
 * Fetch a public URL, strip markup to bounded plain text, and cache the result.
 * Returns null when validation, DNS resolution, fetching, or parsing fails.
 */
export async function fetchPageText(
  rawUrl: string,
  maxChars: number = 12_000,
  timeoutMs: number = 12_000
): Promise<string | null> {
  let cacheKey: string;

  try {
    cacheKey = parsePublicHttpUrl(rawUrl).toString();
  } catch {
    return null;
  }

  const cached = PAGE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.text ? cached.text.slice(0, maxChars) : null;
  }

  try {
    const html = await fetchPublicText(cacheKey, timeoutMs);
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    PAGE_CACHE.set(cacheKey, { text, ts: Date.now() });
    pruneCache();
    return text.slice(0, Math.max(0, maxChars));
  } catch {
    PAGE_CACHE.set(cacheKey, { text: null, ts: Date.now() });
    pruneCache();
    return null;
  }
}
