// ─── Health Check Endpoint ────────────────────────────────────────────────────
// GET /api/health — diagnoses connectivity to all services.
// Use this to verify Supabase, Stripe, and AI are properly configured.

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

export async function GET(request: NextRequest) {
  // ── Public: minimal boolean status (no env introspection, no DB calls) ─
  // Authed requests (CRON_SECRET) get the full service matrix.
  const authFailure = verifyCronAuth(request);
  if (authFailure) {
    return NextResponse.json({
      healthy: true,
      timestamp: new Date().toISOString(),
    });
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
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Test DB query
      const { error } = await supabase.from('county_rules').select('county_fips').limit(1);
      const latency = Date.now() - start;

      if (error) {
        results.supabase = { status: 'error', message: `DB query failed: ${error.message}`, latencyMs: latency };
      } else {
        results.supabase = { status: 'ok', message: 'Connected', latencyMs: latency };
      }

      // Test Storage (connectivity only, don't leak bucket names)
      const { error: storageError } = await supabase.storage.listBuckets();
      if (storageError) {
        results.supabase_storage = { status: 'error', message: `Storage error: ${storageError.message}` };
      } else {
        results.supabase_storage = { status: 'ok', message: 'Storage accessible' };
      }

      // Test Auth (connectivity only, don't leak user count)
      const { error: authError } = await supabase.auth.admin.listUsers({ perPage: 1 });
      if (authError) {
        results.supabase_auth = { status: 'error', message: `Auth error: ${authError.message}` };
      } else {
        results.supabase_auth = { status: 'ok', message: 'Auth working' };
      }
    } catch (err) {
      results.supabase = { status: 'error', message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // ── Anthropic AI ──────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    results.anthropic = { status: 'not_configured', message: 'ANTHROPIC_API_KEY missing' };
  } else {
    results.anthropic = { status: 'ok', message: 'Key configured' };
  }

  // ── Groq AI ───────────────────────────────────────────────────────────
  if (!process.env.GROQ_API_KEY) {
    results.groq = { status: 'not_configured', message: 'GROQ_API_KEY missing' };
  } else {
    results.groq = { status: 'ok', message: 'Key configured' };
  }

  // ── Active FAST AI Route ──────────────────────────────────────────────
  const fastAi = getFastAiConfigSummary();
  const fastKeyPresent = AI_PROVIDERS.FAST === 'groq'
    ? Boolean(process.env.GROQ_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
  results.fast_ai = fastKeyPresent && Boolean(process.env.AI_MODEL_FAST)
    ? { status: 'ok', message: `${fastAi.provider} / ${fastAi.model}` }
    : { status: 'not_configured', message: `FAST provider ${fastAi.provider} is missing key or AI_MODEL_FAST` };

  // ── Stripe ────────────────────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    results.stripe = { status: 'not_configured', message: 'STRIPE_SECRET_KEY missing' };
  } else {
    const isTest = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    results.stripe = { status: 'ok', message: `Key configured (${isTest ? 'TEST mode' : 'LIVE mode'})` };
  }

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    results.stripe_publishable = { status: 'not_configured', message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing' };
  } else {
    results.stripe_publishable = { status: 'ok', message: 'Configured' };
  }

  // ── Azure Maps ────────────────────────────────────────────────────────
  if (!process.env.AZURE_MAPS_SUBSCRIPTION_KEY) {
    results.azure_maps = { status: 'not_configured', message: 'AZURE_MAPS_SUBSCRIPTION_KEY missing (geocoding will use Census fallback)' };
  } else {
    results.azure_maps = { status: 'ok', message: 'Configured' };
  }

  // ── Mapillary ─────────────────────────────────────────────────────────
  if (!process.env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN) {
    results.mapillary = { status: 'not_configured', message: 'NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN missing (street imagery disabled)' };
  } else {
    results.mapillary = { status: 'ok', message: 'Configured' };
  }

  // ── Resend Email ──────────────────────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    results.resend = { status: 'not_configured', message: 'RESEND_API_KEY missing (email delivery disabled)' };
  } else {
    results.resend = { status: 'ok', message: `Configured. From: ${process.env.RESEND_FROM_ADDRESS ?? 'not set'}` };
  }

  // ── ATTOM (optional) ─────────────────────────────────────────────────
  if (!process.env.ATTOM_API_KEY) {
    results.attom = { status: 'not_configured', message: 'Not configured — falling back to public records enrichment' };
  } else {
    results.attom = { status: 'ok', message: 'Configured' };
  }

  // ── Overall ───────────────────────────────────────────────────────────
  const allOk = Object.values(results).every(r => r.status === 'ok' || r.status === 'not_configured');

  return NextResponse.json({
    healthy: allOk,
    timestamp: new Date().toISOString(),
    services: results,
  });
}
