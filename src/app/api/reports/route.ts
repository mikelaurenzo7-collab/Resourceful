// ─── Create Report API ──────────────────────────────────────────────────────
// POST: Validate input, create report row with 'intake' status, create Stripe
// PaymentIntent, and return report ID + client secret.
// No authentication required — email-only identification.

import { NextRequest, NextResponse } from 'next/server';
import { reportCreateSchema } from '@/lib/validations/report';
import { createPaymentIntent } from '@/lib/services/stripe-service';
import { getPriceCents } from '@/config/pricing';
import { createReport, updateReport } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';
import { isFounderEmail } from '@/config/founders';
import { runPipeline } from '@/lib/pipeline/orchestrator';
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

    // ── Check founder access ─────────────────────────────────────────────
    const founderAccess = isFounderEmail(client_email);

    // ── Calculate price (tier-aware, tax bill discount applied) ──────────
    const priceCents = founderAccess ? 0 : getPriceCents(service_type, property_type, review_tier, has_tax_bill);

    // ── Create report row via repository ─────────────────────────────────
    const report = (await createReport({
      user_id: null, // no auth account — email-only identification
      client_email,
      client_name: client_name ?? null,
      status: founderAccess ? 'paid' : 'intake',
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
      admin_notes: founderAccess ? 'Founder account — complimentary access' : null,
      stripe_payment_intent_id: null,
      payment_status: founderAccess ? 'founder_access' : null,
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

    // ── Founder bypass: skip Stripe, trigger pipeline directly ───────────
    if (founderAccess) {
      console.log(`[api/reports] Founder access for ${client_email}, report ${report.id} — skipping payment`);
      runPipeline(report.id).catch((err) => {
        console.error(`[api/reports] Pipeline failed for founder report ${report.id}: ${err}`);
      });
      return NextResponse.json(
        {
          reportId: report.id,
          founderAccess: true,
          priceCents: 0,
        },
        { status: 201 }
      );
    }

    // ── Create Stripe PaymentIntent ────────────────────────────────────────
    const { data: payment, error: paymentError } = await createPaymentIntent({
      amountCents: priceCents,
      customerEmail: client_email,
      reportId: report.id,
      metadata: {
        service_type,
        property_type,
      },
    });

    if (paymentError || !payment) {
      console.error('[api/reports] Failed to create payment intent:', paymentError);
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      );
    }

    // ── Store PaymentIntent ID on report ───────────────────────────────────
    await updateReport(report.id, {
      stripe_payment_intent_id: payment.id,
    });

    // ── Return report ID and client secret ─────────────────────────────────
    return NextResponse.json(
      {
        reportId: report.id,
        clientSecret: payment.clientSecret,
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
