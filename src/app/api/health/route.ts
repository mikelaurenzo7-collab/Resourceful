// ─── Health Check Endpoint ────────────────────────────────────────────────────
// GET /api/health — diagnoses connectivity to all services.
// Use this to verify Supabase, Stripe, and AI are properly configured.

import { NextResponse } from 'next/server';

interface ServiceStatus {
  status: 'ok' | 'error' | 'not_configured';
  message: string;
  latencyMs?: number;
}

export async function GET() {
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
      const { data, error } = await supabase.from('county_rules').select('county_fips').limit(1);
      const latency = Date.now() - start;

      if (error) {
        results.supabase = { status: 'error', message: `DB query failed: ${error.message}`, latencyMs: latency };
      } else {
        results.supabase = { status: 'ok', message: `Connected. ${data?.length ?? 0} county_rules rows accessible.`, latencyMs: latency };
      }

      // Test Storage
      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      if (storageError) {
        results.supabase_storage = { status: 'error', message: `Storage error: ${storageError.message}` };
      } else {
        const bucketNames = buckets?.map(b => b.name) ?? [];
        results.supabase_storage = { status: 'ok', message: `Buckets: ${bucketNames.join(', ') || 'none'}` };
      }

      // Test Auth
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1 });
      if (authError) {
        results.supabase_auth = { status: 'error', message: `Auth error: ${authError.message}` };
      } else {
        results.supabase_auth = { status: 'ok', message: `Auth working. ${authData?.users?.length ?? 0} users found.` };
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

  // ── Google Maps ───────────────────────────────────────────────────────
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    results.google_maps = { status: 'not_configured', message: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing (geocoding will fail)' };
  } else {
    results.google_maps = { status: 'ok', message: 'Configured' };
  }

  // ── Resend Email ──────────────────────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    results.resend = { status: 'not_configured', message: 'RESEND_API_KEY missing (email delivery disabled)' };
  } else {
    results.resend = { status: 'ok', message: `Configured. From: ${process.env.RESEND_FROM_ADDRESS ?? 'not set'}` };
  }

  // ── ATTOM (optional) ─────────────────────────────────────────────────
  if (!process.env.ATTOM_API_KEY) {
    results.attom = { status: 'not_configured', message: 'Not configured — using free public records instead (this is fine)' };
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
