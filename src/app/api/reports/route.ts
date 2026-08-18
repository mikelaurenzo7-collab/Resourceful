// ─── Create Report API ──────────────────────────────────────────────────────
// POST: Validate input, verify the purchasable service and jurisdiction, create
// the report row, create the Stripe PaymentIntent, and return the payment secret.
// Founder access is also placed on the same durable queue as every other paid
// work source; no request-scoped pipeline execution is permitted here.

import { NextRequest, NextResponse } from 'next/server';
import { reportCreateSchema } from '@/lib/validations/report';
import { createPaymentIntent } from '@/lib/services/stripe-service';
import { getPriceCents } from '@/config/pricing';
import { createReport, updateReport } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';
import { isFounderEmail } from '@/config/founders';
import { enqueuePipelineRun } from '@/lib/pipeline/queue';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { validateReferralCode, applyReferralCode } from '@/lib/services/referral-service';
import { validateCheckoutService } from '@/lib/services/service-eligibility';
import { screenServiceJurisdiction } from '@/lib/services/jurisdiction-eligibility';
import type { Report } from '@/types/database';
import { apiLogger } from '@/lib/logger';

export const maxDuration = 60;

function jurisdictionFailureStatus(code: string): number {
  if (code === 'ADDRESS_VERIFICATION_FAILED' || code === 'COUNTY_FIPS_UNRESOLVED') {
    return 503;
  }
  return 409;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await applyRateLimit(request, {
      prefix: 'create-report',
      limit: 10,
      windowSeconds: 900,
    });
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const parsed = reportCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const client_email = d.client_email;
    const client_name = d.client_name;
    let property_address = d.property_address;
    let city = d.city || null;
    let state = d.state || null;
    let county = d.county || null;
    let county_fips = d.county_fips || null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    const pin = d.pin || null;
    const property_type = d.property_type;
    const service_type = d.service_type;
    const review_tier = d.review_tier ?? 'auto';
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

    const serviceEligibility = validateCheckoutService(
      service_type,
      review_tier,
      property_type
    );
    if (!serviceEligibility.allowed) {
      apiLogger.warn(
        {
          code: serviceEligibility.code,
          serviceType: service_type,
          propertyType: property_type,
          reviewTier: review_tier,
          state,
          county,
        },
        '[api/reports] Checkout service requires a different engagement path'
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
          code: jurisdictionEligibility.code,
          serviceType: service_type,
          state,
          county,
          retryable: jurisdictionEligibility.retryable,
        },
        '[api/reports] Jurisdiction failed prepayment release gate'
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

    if (jurisdictionEligibility.jurisdiction) {
      property_address = jurisdictionEligibility.jurisdiction.line1;
      city = jurisdictionEligibility.jurisdiction.city || city;
      state = jurisdictionEligibility.jurisdiction.state || state;
      county = jurisdictionEligibility.jurisdiction.county || county;
      county_fips = jurisdictionEligibility.jurisdiction.countyFips;
      latitude = jurisdictionEligibility.jurisdiction.latitude;
      longitude = jurisdictionEligibility.jurisdiction.longitude;
    }

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

    let founderAccess = false;
    if (isFounderEmail(client_email)) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      founderAccess = !!user && user.email?.toLowerCase() === client_email.toLowerCase();
    }

    let priceCents = founderAccess
      ? 0
      : getPriceCents(service_type, property_type, review_tier, has_tax_bill);

    let referralValidation = null;
    if (!founderAccess && referral_code) {
      referralValidation = await validateReferralCode(referral_code);
      if (referralValidation.valid && referralValidation.discountPct > 0) {
        const discountCents = Math.round(
          priceCents * (referralValidation.discountPct / 100)
        );
        priceCents -= discountCents;
      }
    }

    const report = (await createReport({
      user_id: null,
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
      latitude,
      longitude,
      report_pdf_storage_path: null,
      admin_notes: founderAccess ? 'Founder account — complimentary access' : null,
      stripe_payment_intent_id: null,
      payment_status: founderAccess ? 'founder_access' : null,
      amount_paid_cents: priceCents,
      review_tier,
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

    if (referralValidation?.valid && referralValidation.code) {
      const basePriceCents = getPriceCents(
        service_type,
        property_type,
        review_tier,
        has_tax_bill
      );
      const discountCents = basePriceCents - priceCents;
      await applyReferralCode(report.id, referralValidation.code.id, discountCents);
    }

    if (founderAccess) {
      const run = await enqueuePipelineRun({
        reportId: report.id,
        source: 'founder',
        idempotencyKey: `founder:${report.id}`,
        metadata: {
          enqueued_from: 'founder_access',
          client_email,
          service_type,
          property_type,
        },
      });

      apiLogger.info(
        { id: report.id, runId: run.id, runStatus: run.status },
        '[api/reports] Founder access durably queued'
      );

      return NextResponse.json(
        {
          reportId: report.id,
          founderAccess: true,
          priceCents: 0,
          queueStatus: run.status,
        },
        { status: 201 }
      );
    }

    const { data: payment, error: paymentError } = await createPaymentIntent({
      amountCents: priceCents,
      customerEmail: client_email,
      reportId: report.id,
      metadata: {
        service_type,
        property_type,
        review_tier,
        county_fips: county_fips ?? '',
      },
    });

    if (paymentError || !payment) {
      apiLogger.error({ err: paymentError }, 'Failed to create payment intent');
      try {
        await createAdminClient()
          .from('reports')
          .delete()
          .eq('id', report.id)
          .eq('status', 'intake');
      } catch (cleanupErr) {
        apiLogger.error({ err: cleanupErr }, 'Failed to clean up orphaned report');
      }
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      );
    }

    await updateReport(report.id, {
      stripe_payment_intent_id: payment.id,
    });

    return NextResponse.json(
      {
        reportId: report.id,
        clientSecret: payment.clientSecret,
        priceCents,
        jurisdiction:
          jurisdictionEligibility.code === 'JURISDICTION_VERIFIED'
            ? jurisdictionEligibility.jurisdiction
            : null,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error(
      { err: message, stack: err instanceof Error ? err.stack : undefined },
      'Unhandled report creation error'
    );

    const isDbError = message.includes('Failed to create report') || message.includes('violates');
    return NextResponse.json(
      { error: isDbError ? message : 'Internal server error' },
      { status: 500 }
    );
  }
}
