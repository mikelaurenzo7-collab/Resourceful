// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Distributed rate limiting via Supabase. Works correctly across multiple
// Vercel serverless instances because state lives in Postgres, not memory.
//
// Uses a simple fixed-window approach with atomic upsert+increment.
// Each (prefix, identifier, window) gets one row in rate_limit_entries.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RateLimitConfig {
  /** Unique prefix for this limiter (e.g. 'api-reports') */
  prefix: string;
  /** Maximum requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

// Track consecutive DB failures for observability.
// Resets on success. Serverless instances each have their own counter,
// but even a per-instance count is useful for log-based alerting.
let consecutiveFailures = 0;

/**
 * Check and consume a rate limit token for the given identifier (typically IP).
 * Uses Supabase RPC for atomic check-and-increment across all serverless instances.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const windowKey = `${key}:${windowStart}`;

  try {
    const supabase = createAdminClient();

    // Atomic upsert + increment using Postgres ON CONFLICT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('increment_rate_limit', {
      p_key: windowKey,
      p_window_expires: new Date(resetAt).toISOString(),
    });

    if (error) {
      // Fail open: blocking all users on a DB outage is worse than allowing
      // unthrottled traffic temporarily. Log at error level for alerting.
      consecutiveFailures++;
      console.error(
        `[rate-limit] DB error (consecutive: ${consecutiveFailures}), failing open:`,
        { prefix: config.prefix, error: error.message }
      );
      return { success: true, limit: config.limit, remaining: config.limit, resetAt };
    }

    consecutiveFailures = 0;
    const count = (data as number) ?? 1;

    if (count > config.limit) {
      return { success: false, limit: config.limit, remaining: 0, resetAt };
    }

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - count,
      resetAt,
    };
  } catch (err) {
    consecutiveFailures++;
    console.error(
      `[rate-limit] Unexpected error (consecutive: ${consecutiveFailures}), failing open:`,
      { prefix: config.prefix, error: err instanceof Error ? err.message : String(err) }
    );
    return { success: true, limit: config.limit, remaining: config.limit, resetAt: now + windowMs };
  }
}

/**
 * Extract client IP from request headers (works on Vercel and standard proxies).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}

/**
 * Apply rate limiting and return a 429 response if exceeded.
 * Returns null if the request is within limits.
 */
export async function applyRateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const result = await checkRateLimit(ip, config);

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
