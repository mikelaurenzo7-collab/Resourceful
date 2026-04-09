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
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { validateReferralCode, applyReferralCode } from '@/lib/services/referral-service';
import type { Report } from '@/types/database';
import { apiLogger } from '@/lib/logger';

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

    const d = parsed.data;
    // Normalize empty strings to null for DB columns that expect null over ''
    const client_email = d.client_email;
    const client_name = d.client_name;
    const property_address = d.property_address;
    const city = d.city || null;
    const state = d.state || null;
    const county = d.county || null;
    const county_fips = d.county_fips || null;
    const pin = d.pin || null;
    const property_type = d.property_type;
    const service_type = d.service_type;
    const review_tier = d.review_tier;
    const photos_skipped = d.photos_skipped;
    const property_issues = d.property_issues;
    const additional_notes = d.additional_notes || null;
    const desired_outcome = d.desired_outcome || null;
    const has_tax_bill = d.has_tax_bill;
    const tax_bill_assessed_value = d.tax_bill_assessed_value ?? null;
    const tax_bill_tax_amount = d.tax_bill_tax_amount ?? null;
    const tax_bill_tax_year = d.tax_bill_tax_year || null;
    const tax_bill_pin = d.tax_bill_pin || null;
    const referral_code = d.referral_code || null;

    // ── Per-email concurrency check (prevent abuse) ─────────────────────
    // Max 3 reports in 'intake' or 'processing' state per email
    const supabaseForCheck = createAdminClient();
    const { count: activeReports } = await supabaseForCheck
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('client_email', client_email)
      .in('status', ['intake', 'paid', 'data_pull', 'processing']);

    if (activeReports && activeReports >= 3) {
      return NextResponse.json(
        { error: 'You have too many reports in progress. Please wait for current reports to complete.' },
        { status: 429 }
      );
    }

    // ── Check founder access ─────────────────────────────────────────────
    // Founder bypass requires BOTH: email matches AND user is authenticated
    // (prevents abuse by claiming a founder email without logging in)
    let founderAccess = false;
    if (isFounderEmail(client_email)) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      founderAccess = !!user && user.email?.toLowerCase() === client_email.toLowerCase();
    }

    // ── Calculate price (tier-aware, tax bill discount applied) ──────────
    let priceCents = founderAccess ? 0 : getPriceCents(service_type, property_type, review_tier, has_tax_bill);

    // ── Validate and apply referral code discount ────────────────────────
    let referralValidation = null;
    if (!founderAccess && referral_code) {
      referralValidation = await validateReferralCode(referral_code);
      if (referralValidation.valid && referralValidation.discountPct > 0) {
        const discountCents = Math.round(priceCents * (referralValidation.discountPct / 100));
        priceCents = priceCents - discountCents;
      }
    }

    // ── Create report row via repository ─────────────────────────────────
    const report = (await createReport({
      user_id: null, // no auth account — email-only identification
      client_email,
      client_name: client_name || null,
      status: founderAccess ? 'paid' : 'intake',
      service_type,
      property_type,
      property_address,
      city,
      state,
      state_abbreviation: state,
      county,
      county_fips,
      pin: pin ?? tax_bill_pin,
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

    // ── Apply referral code to report if validated ───────────────────────
    if (referralValidation?.valid && referralValidation.code) {
      const basePriceCents = getPriceCents(service_type, property_type, review_tier, has_tax_bill);
      const discountCents = basePriceCents - priceCents;
      await applyReferralCode(report.id, referralValidation.code.id, discountCents);
    }

    // ── Founder bypass: skip Stripe, trigger pipeline directly ───────────
    if (founderAccess) {
      apiLogger.info({ id: report.id }, '[api/reports] Founder access for report — skipping payment');
      runPipeline(report.id).catch(async (err) => {
        const message = err instanceof Error ? err.message : String(err);
        apiLogger.error({ id: report.id, message }, '[api/reports] Pipeline failed for founder report');
        try {
          await createAdminClient().from('reports').update({
            status: 'failed',
            pipeline_error_log: [{ stage: 'pipeline', error: message, timestamp: new Date().toISOString() }],
          } as never).eq('id', report.id);
        } catch (dbErr) {
          apiLogger.error({ id: report.id, dbErr, message }, '[api/reports] CRITICAL: Pipeline failed AND error recording failed for founder report . Exception: . Pipeline error');
        }
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
      apiLogger.error({ err: paymentError }, 'Failed to create payment intent');
      // Clean up orphaned report to prevent blocking the per-email concurrency limit
      try {
        await createAdminClient().from('reports').delete().eq('id', report.id).eq('status', 'intake');
      } catch (cleanupErr) {
        apiLogger.error({ err: cleanupErr }, 'Failed to clean up orphaned report');
      }
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
    apiLogger.error({ err: message, stack: err instanceof Error ? err.stack : undefined }, 'Unhandled error');

    // Surface database/Supabase errors for debugging (non-sensitive)
    const isDbError = message.includes('Failed to create report') || message.includes('violates');
    return NextResponse.json(
      { error: isDbError ? message : 'Internal server error' },
      { status: 500 }
    );
  }
}
