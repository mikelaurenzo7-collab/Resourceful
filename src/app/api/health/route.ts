// ─── Health Check Endpoint ────────────────────────────────────────────────────
// GET /api/health — public liveness plus authenticated dependency diagnostics.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AI_PROVIDERS } from '@/config/ai';
import { getFastAiConfigSummary } from '@/lib/services/fast-ai';
import { verifyCronAuth } from '@/lib/utils/cron-auth';

interface ServiceStatus {
  status: 'ok' | 'error' | 'not_configured';
  message: string;
  latencyMs?: number;
}

const REQUIRED_STORAGE_BUCKETS = ['reports', 'photos'] as const;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: NextRequest) {
  // Public callers get liveness only. CRON_SECRET-authenticated callers receive
  // the dependency matrix without exposing configuration details publicly.
  const authFailure = verifyCronAuth(request);
  if (authFailure) {
    return NextResponse.json(
      { healthy: true, timestamp: new Date().toISOString() },
      { headers: NO_STORE_HEADERS }
    );
  }

  const results: Record<string, ServiceStatus> = {};

  // ── Supabase ──────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    results.supabase = { status: 'not_configured', message: 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' };
  } else {
    try {
      const start = Date.now();
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error } = await supabase.from('county_rules').select('county_fips').limit(1);
      const latency = Date.now() - start;

      results.supabase = error
        ? { status: 'error', message: `DB query failed: ${error.message}`, latencyMs: latency }
        : { status: 'ok', message: 'Connected', latencyMs: latency };

      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      if (storageError) {
        results.supabase_storage = { status: 'error', message: `Storage error: ${storageError.message}` };
      } else {
        const existingBuckets = new Set((buckets ?? []).map((bucket) => bucket.name));
        const missingBuckets = REQUIRED_STORAGE_BUCKETS.filter((bucket) => !existingBuckets.has(bucket));

        results.supabase_storage = missingBuckets.length > 0
          ? { status: 'error', message: `Missing required buckets: ${missingBuckets.join(', ')}` }
          : { status: 'ok', message: 'Storage accessible (required buckets present)' };
      }

      const { error: authError } = await supabase.auth.admin.listUsers({ perPage: 1 });
      results.supabase_auth = authError
        ? { status: 'error', message: `Auth error: ${authError.message}` }
        : { status: 'ok', message: 'Auth working' };
    } catch (err) {
      results.supabase = { status: 'error', message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // ── AI ────────────────────────────────────────────────────────────────
  results.anthropic = process.env.ANTHROPIC_API_KEY
    ? { status: 'ok', message: 'Key configured' }
    : { status: 'not_configured', message: 'ANTHROPIC_API_KEY missing' };

  results.groq = process.env.GROQ_API_KEY
    ? { status: 'ok', message: 'Key configured' }
    : { status: 'not_configured', message: 'GROQ_API_KEY missing (optional unless selected as FAST provider)' };

  const fastAi = getFastAiConfigSummary();
  const fastKeyPresent = AI_PROVIDERS.FAST === 'groq'
    ? Boolean(process.env.GROQ_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
  results.fast_ai = fastKeyPresent && Boolean(process.env.AI_MODEL_FAST)
    ? { status: 'ok', message: `${fastAi.provider} / ${fastAi.model}` }
    : { status: 'not_configured', message: `FAST provider ${fastAi.provider} is missing key or AI_MODEL_FAST` };

  // ── Billing and delivery ─────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    results.stripe = { status: 'not_configured', message: 'STRIPE_SECRET_KEY missing' };
  } else {
    const isTest = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    results.stripe = { status: 'ok', message: `Key configured (${isTest ? 'TEST mode' : 'LIVE mode'})` };
  }

  results.stripe_publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? { status: 'ok', message: 'Configured' }
    : { status: 'not_configured', message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing' };

  results.resend = process.env.RESEND_API_KEY
    ? { status: 'ok', message: `Configured. From: ${process.env.RESEND_FROM_ADDRESS ?? 'not set'}` }
    : { status: 'not_configured', message: 'RESEND_API_KEY missing (email delivery disabled)' };

  // ── Property-data vendors ────────────────────────────────────────────
  results.attom = process.env.ATTOM_API_KEY
    ? { status: 'ok', message: 'Configured' }
    : { status: 'not_configured', message: 'ATTOM_API_KEY missing — only lower-confidence public-record fallbacks are available' };

  results.azure_maps = process.env.AZURE_MAPS_SUBSCRIPTION_KEY
    ? { status: 'ok', message: 'Configured' }
    : { status: 'not_configured', message: 'AZURE_MAPS_SUBSCRIPTION_KEY missing (geocoding will use Census fallback)' };

  results.mapillary = process.env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN
    ? { status: 'ok', message: 'Configured' }
    : { status: 'not_configured', message: 'NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN missing (street imagery disabled)' };

  const hasDependencyError = Object.values(results).some((result) => result.status === 'error');

  return NextResponse.json(
    {
      healthy: !hasDependencyError,
      timestamp: new Date().toISOString(),
      services: results,
    },
    {
      status: hasDependencyError ? 503 : 200,
      headers: NO_STORE_HEADERS,
    }
  );
}
