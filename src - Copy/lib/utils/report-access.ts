import crypto from 'crypto';

const TOKEN_VERSION = 1;
const DEFAULT_REPORT_ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

type ReportAccessPayload = {
  v: number;
  reportId: string;
  exp: number;
};

function getSigningSecret(): string {
  // REPORT_ACCESS_TOKEN_SECRET must be explicitly set in production. Conflating
  // it with SUPABASE_SERVICE_ROLE_KEY means rotating one forces rotating the
  // other, and any compromise of access tokens would force a DB key rotation.
  const explicit = process.env.REPORT_ACCESS_TOKEN_SECRET;
  if (explicit) return explicit;
  if (process.env.NODE_ENV === 'production') return '';
  // Dev-only fallback keeps local testing friction-free.
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function encodeBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function decodeBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function generateReportAccessToken(
  reportId: string,
  expiresInSeconds: number = DEFAULT_REPORT_ACCESS_TTL_SECONDS
): string {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error('Missing REPORT_ACCESS_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY');
  }

  const payload: ReportAccessPayload = {
    v: TOKEN_VERSION,
    reportId,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyReportAccessToken(token: string | null | undefined, reportId: string): boolean {
  if (!token) {
    return false;
  }

  const secret = getSigningSecret();
  if (!secret) {
    return false;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8')) as ReportAccessPayload;
    if (payload.v !== TOKEN_VERSION) {
      return false;
    }
    if (payload.reportId !== reportId) {
      return false;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}