// ─── Health Check Endpoint ────────────────────────────────────────────────────
// GET /api/health — public liveness and deployment identity plus authenticated
// dependency diagnostics.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AI_MODELS } from '@/config/ai';
import { getFastAiConfigSummary } from '@/lib/services/fast-ai';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { getDeploymentIdentity } from '@/lib/utils/deployment-identity';

interface ServiceStatus {
  status: 'ok' | 'error' | 'not_configured';
  message: string;
  latencyMs?: number;
}

const REQUIRED_STORAGE_BUCKETS = ['reports', 'photos'] as const;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: NextRequest) {
  const authFailure = verifyCronAuth(request);
  if (authFailure) {
    return NextResponse.json(
      {
        healthy: true,
        timestamp: new Date().toISOString(),
        deployment: getDeploymentIdentity(),
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  const results: Record<string, ServiceStatus> = {};
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    results.supabase = {
      status: 'not_configured',
      message: 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing',
    };
  } else {
    try {
      const start = Date.now();
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error } = await supabase
        .from('county_rules')
        .select('county_fips')
        .limit(1);
      const latency = Date.now() - start;

      results.supabase = error
        ? { status: 'error', message: `DB query failed: ${error.message}`, latencyMs: latency }
        : { status: 'ok', message: 'Connected', latencyMs: latency };

      const [reportSchema, propertySchema, jurisdictionSchema] = await Promise.all([
        supabase
          .from('reports')
          .select('outcome_followup_claimed_at,is_retrospective_assignment,valuation_effective_date,valuation_effective_date_source')
          .limit(1),
        supabase
          .from('property_data')
          .select('unit_count,unit_count_source_type,unit_count_source_reference')
          .limit(1),
        supabase
          .from('county_rules')
          .select('jurisdiction_plugin_key,jurisdiction_plugin_version')
          .limit(1),
      ]);
      const schemaErrors = [
        reportSchema.error ? `reports: ${reportSchema.error.message}` : null,
        propertySchema.error ? `property_data: ${propertySchema.error.message}` : null,
        jurisdictionSchema.error ? `county_rules: ${jurisdictionSchema.error.message}` : null,
      ].filter((message): message is string => Boolean(message));

      results.supabase_schema = schemaErrors.length > 0
        ? {
            status: 'error',
            message: `Required delivery and report-workfile schema is missing or inaccessible: ${schemaErrors.join('; ')}`,
          }
        : {
            status: 'ok',
            message: 'Delivery, follow-up, valuation-date provenance, evidence provenance, and jurisdiction-plugin schema is current',
          };

      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      if (storageError) {
        results.supabase_storage = {
          status: 'error',
          message: `Storage error: ${storageError.message}`,
        };
      } else {
        const existingBuckets = new Set((buckets ?? []).map((bucket) => bucket.name));
        const missingBuckets = REQUIRED_STORAGE_BUCKETS.filter(
          (bucket) => !existingBuckets.has(bucket)
        );

        results.supabase_storage = missingBuckets.length > 0
          ? {
              status: 'error',
              message: `Missing required buckets: ${missingBuckets.join(', ')}`,
            }
          : {
              status: 'ok',
              message: 'Storage accessible (required buckets present)',
            };
      }

      const { error: authError } = await supabase.auth.admin.listUsers({ perPage: 1 });
      results.supabase_auth = authError
        ? { status: 'error', message: `Auth error: ${authError.message}` }
        : { status: 'ok', message: 'Auth working' };
    } catch (error) {
      results.supabase = {
        status: 'error',
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  results.openai = openAiConfigured
    ? { status: 'ok', message: 'Key configured' }
    : { status: 'not_configured', message: 'OPENAI_API_KEY missing' };
  results.ai_appraiser = openAiConfigured
    ? { status: 'ok', message: `OpenAI / ${AI_MODELS.PRIMARY}` }
    : {
        status: 'not_configured',
        message: `OpenAI appraiser ${AI_MODELS.PRIMARY} cannot run without OPENAI_API_KEY`,
      };
  results.ai_vision = openAiConfigured
    ? { status: 'ok', message: `OpenAI / ${AI_MODELS.VISION}` }
    : {
        status: 'not_configured',
        message: `OpenAI vision ${AI_MODELS.VISION} cannot run without OPENAI_API_KEY`,
      };
  results.ai_document = openAiConfigured
    ? { status: 'ok', message: `OpenAI / ${AI_MODELS.DOCUMENT}` }
    : {
        status: 'not_configured',
        message: `OpenAI document model ${AI_MODELS.DOCUMENT} cannot run without OPENAI_API_KEY`,
      };

  const fastAi = getFastAiConfigSummary();
  results.fast_ai = fastAi.configured
    ? { status: 'ok', message: `${fastAi.provider} / ${fastAi.model}` }
    : {
        status: 'not_configured',
        message: `FAST model ${fastAi.model} cannot run without OPENAI_API_KEY`,
      };

  if (!process.env.STRIPE_SECRET_KEY) {
    results.stripe = { status: 'not_configured', message: 'STRIPE_SECRET_KEY missing' };
  } else {
    const isTest = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    results.stripe = {
      status: 'ok',
      message: `Key configured (${isTest ? 'TEST mode' : 'LIVE mode'})`,
    };
  }

  results.stripe_publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? { status: 'ok', message: 'Configured' }
    : {
        status: 'not_configured',
        message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing',
      };
  results.resend = process.env.RESEND_API_KEY
    ? {
        status: 'ok',
        message: `Configured. From: ${process.env.RESEND_FROM_ADDRESS ?? 'not set'}`,
      }
    : {
        status: 'not_configured',
        message: 'RESEND_API_KEY missing (email delivery disabled)',
      };

  results.google_maps =
    process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? {
          status: 'ok',
          message: 'Primary geocoding, address search, static maps, and Street View configured',
        }
      : {
          status: 'not_configured',
          message: 'Google Maps key missing — Census and transitional map fallbacks will be used',
        };
  results.attom = process.env.ATTOM_API_KEY
    ? { status: 'ok', message: 'Structured property enrichment configured' }
    : {
        status: 'not_configured',
        message: 'ATTOM_API_KEY missing — only lower-confidence public-record fallbacks are available',
      };
  results.serper = process.env.SERPER_API_KEY
    ? { status: 'ok', message: 'Current-source web retrieval configured' }
    : {
        status: 'not_configured',
        message: 'SERPER_API_KEY missing — current-source research is disabled',
      };
  results.azure_maps_fallback = process.env.AZURE_MAPS_SUBSCRIPTION_KEY
    ? { status: 'ok', message: 'Transitional map fallback configured' }
    : { status: 'not_configured', message: 'Azure Maps fallback not configured' };
  results.mapillary_fallback = process.env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN
    ? { status: 'ok', message: 'Fallback street imagery configured' }
    : { status: 'not_configured', message: 'Mapillary fallback not configured' };

  const hasDependencyError = Object.values(results).some(
    (result) => result.status === 'error'
  );

  return NextResponse.json(
    {
      healthy: !hasDependencyError,
      timestamp: new Date().toISOString(),
      deployment: getDeploymentIdentity(),
      services: results,
    },
    {
      status: hasDependencyError ? 503 : 200,
      headers: NO_STORE_HEADERS,
    }
  );
}
