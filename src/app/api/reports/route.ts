// ─── Create Report API ──────────────────────────────────────────────────────
// POST: Validate input, create report row with 'submitted' status.
// No payment at submission time — users pay after report is ready.
// No authentication required — email-only identification.

import { NextRequest, NextResponse } from 'next/server';
import { reportCreateSchema } from '@/lib/validations/report';
import { getPriceCents } from '@/config/pricing';
import { createReport } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 10 reports per 15 minutes per IP ─────────────────────
    const rateLimited = await applyRateLimit(request, { prefix: 'create-report', limit: 10, windowSeconds: 900 });
    if (rateLimited) return rateLimited;

    // ── Parse and validate input ───────────────────────────────────────────
    const body = await request.json();
    const parsed = reportCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      client_email,
      client_name,
      property_address,
      city,
      state,
      county,
      county_fips,
      pin,
      property_type,
      service_type,
      review_tier,
      photos_skipped,
      property_issues,
      additional_notes,
      desired_outcome,
      has_tax_bill,
      tax_bill_assessed_value,
      tax_bill_tax_amount,
      tax_bill_tax_year,
      tax_bill_pin,
    } = parsed.data;

    // ── Calculate price (stored for later payment, not charged now) ──────
    const priceCents = getPriceCents(service_type, property_type, review_tier, has_tax_bill);

    // ── Create report row via repository ─────────────────────────────────
    const report = (await createReport({
      user_id: null, // nullable — email-only intake, no auth account
      client_email,
      client_name: client_name ?? null,
      status: 'submitted',
      service_type,
      property_type,
      property_address,
      city,
      state,
      state_abbreviation: state,
      county,
      county_fips: county_fips ?? null,
      pin: pin ?? tax_bill_pin ?? null,
      latitude: null,
      longitude: null,
      report_pdf_storage_path: null,
      admin_notes: null,
      stripe_payment_intent_id: null,
      payment_status: null,
      amount_paid_cents: priceCents,
      review_tier: review_tier ?? 'auto',
      photos_skipped: photos_skipped ?? false,
      property_issues: property_issues ?? [],
      additional_notes: additional_notes ?? null,
      desired_outcome: desired_outcome ?? null,
      has_tax_bill: has_tax_bill ?? false,
      tax_bill_assessed_value: tax_bill_assessed_value ?? null,
      tax_bill_tax_amount: tax_bill_tax_amount ?? null,
      tax_bill_tax_year: tax_bill_tax_year ?? null,
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

    // ── Return report ID (no Stripe client secret — payment comes later) ─
    return NextResponse.json(
      {
        reportId: report.id,
        priceCents,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/reports] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
