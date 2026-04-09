// ─── Partner API: Create Report ──────────────────────────────────────────────
// POST /api/v1/reports — programmatic report creation for API partners.
// Same pipeline as the intake wizard, but authenticated via API key and
// billed monthly (no Stripe PaymentIntent per report).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey, trackApiUsage } from '@/lib/services/partner-api-service';
import { createReport } from '@/lib/repository/reports';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report } from '@/types/database';
import { apiLogger } from '@/lib/logger';

// ─── Request Schema ─────────────────────────────────────────────────────────

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

// ─── Extract Bearer Token ───────────────────────────────────────────────────

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 30 reports per 15 minutes per IP ─────────────────────
    const rateLimited = await applyRateLimit(request, { prefix: 'v1-reports', limit: 30, windowSeconds: 900 });
    if (rateLimited) return rateLimited;

    // ── Authenticate via API key ──────────────────────────────────────────
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

    // ── Parse and validate request body ───────────────────────────────────
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

    // ── Create report — skip Stripe (partner pays monthly) ────────────────
    const report = (await createReport({
      user_id: null,
      client_email,
      client_name: client_name ?? null,
      status: 'paid', // pre-authorized — partner covers payment
      service_type,
      property_type,
      property_address,
      city,
      state,
      state_abbreviation: state,
      county,
      county_fips: null,
      pin: null,
      latitude: null,
      longitude: null,
      report_pdf_storage_path: null,
      admin_notes: `Partner API report — ${partner.firm_name}`,
      stripe_payment_intent_id: null,
      payment_status: 'partner_api',
      amount_paid_cents: partner.per_report_fee_cents,
      review_tier,
      photos_skipped: true, // API reports have no photo upload flow
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

    // ── Track usage + tag report with partner ID ──────────────────────────
    await trackApiUsage(partner.id, report.id, partner.per_report_fee_cents);

    // ── Trigger pipeline (non-blocking) ───────────────────────────────────
    runPipeline(report.id).catch((err) => {
      apiLogger.error(
        { reportId: report.id, partner: partner.firm_name, err: String(err) },
        '[partner-api] Pipeline failed'
      );
    });

    // ── Return report ID and status ───────────────────────────────────────
    return NextResponse.json(
      {
        reportId: report.id,
        status: 'processing',
        message: 'Report created and pipeline started.',
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, 'Unhandled error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
