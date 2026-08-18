// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Distributed rate limiting via Supabase. Works correctly across multiple
// Vercel serverless instances because state lives in Postgres, not memory.
//
// Uses a simple fixed-window approach with atomic upsert+increment.
// Each (prefix, identifier, window) gets one row in rate_limit_entries.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiLogger } from '@/lib/logger';
import { incrementRateLimit } from '@/lib/supabase/rpc';

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

// ─── In-Memory Fallback ──────────────────────────────────────────────────────
// When the DB is down, we fall back to per-instance in-memory rate limiting.
// Less accurate than distributed (each serverless instance tracks separately),
// but prevents wide-open abuse during outages. The fallback is deliberately
// temporary: warm instances periodically probe Postgres so a transient outage
// cannot leave them permanently degraded until the process is recycled.
const memoryStore = new Map<string, { count: number; expiresAt: number }>();
const MAX_MEMORY_ENTRIES = 50_000; // Hard cap to prevent OOM under attack
let dbFailureCount = 0;
const DB_FAILURE_THRESHOLD = 3;
let lastDbFailureAt = 0;
const DB_RECOVERY_PROBE_INTERVAL_MS = 30_000;
let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60_000; // Prune expired entries every 60s

function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();

  // Periodically prune expired entries to prevent unbounded memory growth
  if (now - lastCleanup > CLEANUP_INTERVAL_MS || memoryStore.size >= MAX_MEMORY_ENTRIES) {
    lastCleanup = now;
    memoryStore.forEach((v, k) => {
      if (now >= v.expiresAt) memoryStore.delete(k);
    });
    // If still at cap after pruning expired, evict oldest entries
    if (memoryStore.size >= MAX_MEMORY_ENTRIES) {
      const toDelete = memoryStore.size - Math.floor(MAX_MEMORY_ENTRIES * 0.8);
      let deleted = 0;
      const keys = Array.from(memoryStore.keys());
      for (let i = 0; i < keys.length && deleted < toDelete; i++) {
        memoryStore.delete(keys[i]);
        deleted++;
      }
    }
  }

  const windowMs = config.windowSeconds * 1000;
  const resetAt = Math.floor(now / windowMs) * windowMs + windowMs;

  const entry = memoryStore.get(key);
  if (!entry || now >= entry.expiresAt) {
    memoryStore.set(key, { count: 1, expiresAt: resetAt });
    return { success: true, limit: config.limit, remaining: config.limit - 1, resetAt };
  }

  entry.count++;
  if (entry.count > config.limit) {
    return { success: false, limit: config.limit, remaining: 0, resetAt };
  }
  return { success: true, limit: config.limit, remaining: config.limit - entry.count, resetAt };
}

/**
 * Check and consume a rate limit token for the given identifier (typically IP).
 * Uses Supabase RPC for atomic check-and-increment across all serverless instances.
 * Falls back to in-memory rate limiting if the database is unavailable, while
 * periodically probing the database to restore distributed enforcement.
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

  const fallbackActive = dbFailureCount >= DB_FAILURE_THRESHOLD;
  const recoveryProbeDue =
    lastDbFailureAt === 0 ||
    now - lastDbFailureAt >= DB_RECOVERY_PROBE_INTERVAL_MS;

  if (fallbackActive && !recoveryProbeDue) {
    return checkMemoryRateLimit(key, config);
  }

  try {
    const supabase = createAdminClient();

    // Atomic upsert + increment using Postgres ON CONFLICT
    const { data, error } = await incrementRateLimit(
      supabase,
      windowKey,
      new Date(resetAt).toISOString()
    );

    if (error) {
      dbFailureCount++;
      lastDbFailureAt = Date.now();
      apiLogger.error(
        {
          err: error.message,
          dbFailureCount,
          threshold: DB_FAILURE_THRESHOLD,
          recoveryProbeIntervalMs: DB_RECOVERY_PROBE_INTERVAL_MS,
        },
        '[rate-limit] Database check failed; using bounded in-memory fallback'
      );
      return checkMemoryRateLimit(key, config);
    }

    // DB succeeded — immediately restore distributed enforcement.
    if (dbFailureCount >= DB_FAILURE_THRESHOLD) {
      apiLogger.info(
        { previousDbFailureCount: dbFailureCount },
        '[rate-limit] Database recovered; distributed rate limiting restored'
      );
    }
    dbFailureCount = 0;
    lastDbFailureAt = 0;

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
  } catch (error) {
    dbFailureCount++;
    lastDbFailureAt = Date.now();
    apiLogger.error(
      {
        err: error instanceof Error ? error.message : String(error),
        dbFailureCount,
        threshold: DB_FAILURE_THRESHOLD,
        recoveryProbeIntervalMs: DB_RECOVERY_PROBE_INTERVAL_MS,
      },
      '[rate-limit] Unexpected database error; using bounded in-memory fallback'
    );
    return checkMemoryRateLimit(key, config);
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
    apiLogger.warn(
      {
        prefix: config.prefix,
        ip,
        limit: config.limit,
        windowSeconds: config.windowSeconds,
      },
      '[rate-limit] Request limit exceeded'
    );
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
