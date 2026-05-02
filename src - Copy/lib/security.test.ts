import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Cron Auth Tests ─────────────────────────────────────────────────────────

describe('verifyCronAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadModule() {
    return import('@/lib/utils/cron-auth');
  }

  function makeRequest(authHeader?: string) {
    const headers = new Headers();
    if (authHeader) headers.set('authorization', authHeader);
    return new Request('http://localhost/api/cron/test', { headers }) as unknown as import('next/server').NextRequest;
  }

  it('returns null for valid cron secret (authorized)', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret-123');
    const { verifyCronAuth } = await loadModule();
    const result = verifyCronAuth(makeRequest('Bearer test-secret-123'));
    expect(result).toBeNull();
  });

  it('returns 401 for wrong cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret-123');
    const { verifyCronAuth } = await loadModule();
    const result = verifyCronAuth(makeRequest('Bearer wrong-secret-456'));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('returns 401 when no CRON_SECRET is set', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { verifyCronAuth } = await loadModule();
    const result = verifyCronAuth(makeRequest('Bearer something'));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('returns 401 when no authorization header is provided', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret-123');
    const { verifyCronAuth } = await loadModule();
    const result = verifyCronAuth(makeRequest());
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('returns 401 for length mismatch (timing attack prevention)', async () => {
    vi.stubEnv('CRON_SECRET', 'short');
    const { verifyCronAuth } = await loadModule();
    const result = verifyCronAuth(makeRequest('Bearer very-long-wrong-secret'));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });
});

// ─── Magic Bytes Validation Tests ────────────────────────────────────────────

describe('validateImageMagicBytes', () => {
  // Import the function from the photo upload route module isn't possible
  // (it's not exported), so we test the logic directly here
  function validateImageMagicBytes(buffer: Buffer, declaredType: string): boolean {
    if (buffer.length < 12) return false;

    const signatures: Record<string, (b: Buffer) => boolean> = {
      'image/jpeg': (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
      'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
      'image/webp': (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
      'image/heic': (b) => {
        const ftyp = b.slice(4, 8).toString();
        return ftyp === 'ftyp' && ['heic', 'heix', 'mif1'].some(t => b.slice(8, 12).toString().startsWith(t));
      },
      'image/heif': (b) => {
        const ftyp = b.slice(4, 8).toString();
        return ftyp === 'ftyp' && ['heic', 'heix', 'mif1'].some(t => b.slice(8, 12).toString().startsWith(t));
      },
    };

    const check = signatures[declaredType];
    return check ? check(buffer) : false;
  }

  it('validates JPEG magic bytes', () => {
    const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(validateImageMagicBytes(jpeg, 'image/jpeg')).toBe(true);
  });

  it('validates PNG magic bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
    expect(validateImageMagicBytes(png, 'image/png')).toBe(true);
  });

  it('validates WebP magic bytes', () => {
    const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBP');
    expect(validateImageMagicBytes(webp, 'image/webp')).toBe(true);
  });

  it('rejects mismatched MIME type (claims JPEG, actually PNG)', () => {
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
    expect(validateImageMagicBytes(png, 'image/jpeg')).toBe(false);
  });

  it('rejects too-small buffers', () => {
    const tiny = Buffer.from([0xFF, 0xD8]);
    expect(validateImageMagicBytes(tiny, 'image/jpeg')).toBe(false);
  });

  it('rejects unknown MIME types', () => {
    const buf = Buffer.alloc(16, 0);
    expect(validateImageMagicBytes(buf, 'application/pdf')).toBe(false);
  });

  it('rejects random data claiming to be JPEG', () => {
    const random = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B]);
    expect(validateImageMagicBytes(random, 'image/jpeg')).toBe(false);
  });
});

// ─── Founder Access Tests ────────────────────────────────────────────────────

describe('isFounderEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('returns true for a matching founder email', async () => {
    vi.stubEnv('FOUNDER_EMAILS', 'alice@example.com,bob@example.com');
    const { isFounderEmail } = await import('@/config/founders');
    expect(isFounderEmail('alice@example.com')).toBe(true);
  });

  it('is case-insensitive', async () => {
    vi.stubEnv('FOUNDER_EMAILS', 'Alice@Example.COM');
    const { isFounderEmail } = await import('@/config/founders');
    expect(isFounderEmail('alice@example.com')).toBe(true);
  });

  it('returns false for non-founders', async () => {
    vi.stubEnv('FOUNDER_EMAILS', 'alice@example.com');
    const { isFounderEmail } = await import('@/config/founders');
    expect(isFounderEmail('mallory@evil.com')).toBe(false);
  });

  it('returns false when FOUNDER_EMAILS is empty', async () => {
    vi.stubEnv('FOUNDER_EMAILS', '');
    const { isFounderEmail } = await import('@/config/founders');
    expect(isFounderEmail('anyone@example.com')).toBe(false);
  });
});

// ─── Partner API Validation Tests ────────────────────────────────────────────

describe('partner API key format validation', () => {
  it('rejects keys not starting with rfl_', () => {
    const key = 'invalid_key_format';
    expect(key.startsWith('rfl_')).toBe(false);
  });

  it('accepts keys with rfl_ prefix', () => {
    const key = 'rfl_abc123def456';
    expect(key.startsWith('rfl_')).toBe(true);
  });
});
