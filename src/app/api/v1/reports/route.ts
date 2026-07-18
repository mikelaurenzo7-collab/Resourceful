// ─── Partner API: Create Report ──────────────────────────────────────────────
// POST /api/v1/reports — programmatic report creation for API partners.
// Partner billing does not bypass service or jurisdiction release boundaries.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey, trackApiUsage } from '@/lib/services/partner-api-service';
import { validateCheckoutService } from '@/lib/services/service-eligibility';
import { screenServiceJurisdiction } from '@/lib/services/jurisdiction-eligibility';
import { createReport } from '@/lib/repository/reports';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report } from '@/types/database';
import { apiLogger } from '@/lib/logger';

const partnerReportSchema = z.object({
  property_address: z.string().min(1, 'Property address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be a 2-letter code'),
  county: z.string().min(1, 'County is required'),
  property_type: z.enum(['residential', 'commercial', 'industrial', 'land']),
  service_type: z.enum(['tax_appeal', 'pre_purchase', 'pre_listing']),
  client_email: z.string().email('Valid client email is required'),
  client_name: z.string().min(1).optional(),
  review_tier: z
    .enum(['auto', 'expert_reviewed', 'guided_filing', 'full_representation'])
    .optional()
    .default('auto'),
});

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function jurisdictionFailureStatus(code: string): number {
  if (code === 'ADDRESS_VERIFICATION_FAILED' || code === 'COUNTY_FIPS_UNRESOLVED') {
    return 503;
  }
  return 409;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await applyRateLimit(request, {
      prefix: 'v1-reports',
      limit: 30,
      windowSeconds: 900,
    });
    if (rateLimited) return rateLimited;

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Missing Authorization header. Use: Bearer rfl_xxxxx' },
        { status: 401 }
      );
    }

    const { partner, error: authError } = await validateApiKey(token);
    if (authError || !partner) {
      return NextResponse.json(
        { error: authError ?? 'Authentication failed' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = partnerReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      property_address,
      city,
      state,
      county,
      property_type,
      service_type,
      client_email,
      client_name,
      review_tier,
    } = parsed.data;

    const serviceEligibility = validateCheckoutService(service_type, review_tier);
    if (!serviceEligibility.allowed) {
      apiLogger.warn(
        {
          partnerId: partner.id,
          code: serviceEligibility.code,
          serviceType: service_type,
          reviewTier: review_tier,
          state,
          county,
        },
        '[partner-api] Service requires a different engagement path'
      );

      return NextResponse.json(
        {
          error: serviceEligibility.message,
          code: serviceEligibility.code,
          recommendedTier: serviceEligibility.recommendedTier,
        },
        { status: 409 }
      );
    }

    const jurisdictionEligibility = await screenServiceJurisdiction({
      serviceType: service_type,
      propertyAddress: property_address,
      city,
      state,
      county,
    });

    if (!jurisdictionEligibility.allowed) {
      apiLogger.warn(
        {
          partnerId: partner.id,
          code: jurisdictionEligibility.code,
          state,
          county,
          retryable: jurisdictionEligibility.retryable,
        },
        '[partner-api] Jurisdiction failed report release gate'
      );

      return NextResponse.json(
        {
          error: jurisdictionEligibility.message,
          code: jurisdictionEligibility.code,
          retryable: jurisdictionEligibility.retryable,
          jurisdiction: jurisdictionEligibility.jurisdiction,
        },
        { status: jurisdictionFailureStatus(jurisdictionEligibility.code) }
      );
    }

    const resolved = jurisdictionEligibility.jurisdiction;
    const report = (await createReport({
      user_id: null,
      client_email,
      client_name: client_name ?? null,
      status: 'paid',
      service_type,
      property_type,
      property_address: resolved?.line1 ?? property_address,
      city: resolved?.city || city,
      state: resolved?.state || state,
      state_abbreviation: resolved?.state || state,
      county: resolved?.county || county,
      county_fips: resolved?.countyFips ?? null,
      pin: null,
      latitude: resolved?.latitude ?? null,
      longitude: resolved?.longitude ?? null,
      report_pdf_storage_path: null,
      admin_notes: `Partner API report — ${partner.firm_name}`,
      stripe_payment_intent_id: null,
      payment_status: 'partner_api',
      amount_paid_cents: partner.per_report_fee_cents,
      review_tier,
      photos_skipped: true,
      property_issues: [],
      additional_notes: null,
      desired_outcome: null,
      has_tax_bill: false,
      tax_bill_assessed_value: null,
      tax_bill_tax_amount: null,
      tax_bill_tax_year: null,
      pipeline_last_completed_stage: null,
      pipeline_error_log: null,
      pipeline_started_at: null,
      pipeline_completed_at: null,
      approved_at: null,
      approved_by: null,
      delivered_at: null,
      filing_status: 'not_started',
      filed_at: null,
      filing_method: null,
      appeal_outcome: null,
      savings_amount_cents: null,
    })) as Report;

    await trackApiUsage(partner.id, report.id, partner.per_report_fee_cents);

    runPipeline(report.id).catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      apiLogger.error(
        { reportId: report.id, partner: partner.firm_name, err: message, stack },
        '[partner-api] Pipeline failed'
      );

      try {
        await createAdminClient().from('reports').update({
          status: 'failed',
          pipeline_error_log: {
            stage: 'pipeline',
            error: message,
            stack: stack ?? message,
            timestamp: new Date().toISOString(),
          },
        }).eq('id', report.id);
      } catch (dbErr) {
        apiLogger.error(
          { reportId: report.id, dbErr: String(dbErr), pipelineError: message },
          '[partner-api] CRITICAL: Pipeline and error recording failed'
        );
      }
    });

    return NextResponse.json(
      {
        reportId: report.id,
        status: 'processing',
        jurisdiction: resolved,
        message: 'Report created and pipeline started.',
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, 'Unhandled partner report error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
