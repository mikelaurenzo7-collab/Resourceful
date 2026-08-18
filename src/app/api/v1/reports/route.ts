// ─── Partner API: Create Report ──────────────────────────────────────────────
// POST /api/v1/reports — programmatic report creation for API partners.
// Partner billing does not bypass service, scope, jurisdiction, idempotency, or
// durable pipeline ownership boundaries.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  bindPartnerReportRequest,
  claimPartnerReportRequest,
  fingerprintPartnerRequest,
  getPartnerReportByRequestId,
  PartnerIdempotencyConflictError,
  trackApiUsage,
  validateApiKey,
} from '@/lib/services/partner-api-service';
import { validateCheckoutService } from '@/lib/services/service-eligibility';
import { screenServiceJurisdiction } from '@/lib/services/jurisdiction-eligibility';
import { createReport } from '@/lib/repository/reports';
import { enqueuePipelineRun } from '@/lib/pipeline/queue';
import { inferNextStageNumber } from '@/lib/pipeline/run-types';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report, ReportInsert, ReportStatus } from '@/types/database';
import { apiLogger } from '@/lib/logger';

export const maxDuration = 60;

const PARTNER_REQUEST_STALE_MS = 5 * 60 * 1000;
const RECOVERABLE_PIPELINE_STATUSES = new Set<ReportStatus>([
  'paid',
  'data_pull',
  'photo_pending',
  'processing',
]);

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

function extractIdempotencyKey(request: NextRequest): string | null {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value || value.length < 8 || value.length > 200) return null;
  return value;
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

    const idempotencyKey = extractIdempotencyKey(request);
    if (!idempotencyKey) {
      return NextResponse.json(
        {
          error: 'Idempotency-Key header is required and must be 8–200 characters.',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        },
        { status: 400 }
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

    const serviceEligibility = validateCheckoutService(
      service_type,
      review_tier,
      property_type
    );
    if (!serviceEligibility.allowed) {
      apiLogger.warn(
        {
          partnerId: partner.id,
          code: serviceEligibility.code,
          serviceType: service_type,
          propertyType: property_type,
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

    const requestFingerprint = fingerprintPartnerRequest(parsed.data);
    let requestClaim;
    try {
      requestClaim = await claimPartnerReportRequest({
        partnerId: partner.id,
        idempotencyKey,
        requestFingerprint,
      });
    } catch (error) {
      if (error instanceof PartnerIdempotencyConflictError) {
        return NextResponse.json(
          { error: error.message, code: 'IDEMPOTENCY_KEY_CONFLICT' },
          { status: 409 }
        );
      }
      throw error;
    }

    const resolved = jurisdictionEligibility.jurisdiction;
    let report = await getPartnerReportByRequestId(
      partner.id,
      requestClaim.request.id
    );
    let createdReport = false;

    if (!report && !requestClaim.created) {
      const requestAgeMs =
        Date.now() - new Date(requestClaim.request.created_at).getTime();
      if (requestAgeMs < PARTNER_REQUEST_STALE_MS) {
        return NextResponse.json(
          {
            error: 'An identical Partner API request is already being created.',
            code: 'REQUEST_IN_PROGRESS',
            retryable: true,
          },
          {
            status: 409,
            headers: { 'Retry-After': '5' },
          }
        );
      }
    }

    if (!report) {
      const reportInput: ReportInsert & { partner_request_id: string } = {
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
        api_partner_id: partner.id,
        is_white_label: true,
        partner_request_id: requestClaim.request.id,
      };

      try {
        const created = (await createReport(reportInput)) as Report;
        report = {
          id: created.id,
          status: created.status,
          pipeline_last_completed_stage: created.pipeline_last_completed_stage,
          county_fips: created.county_fips,
        };
        createdReport = true;
      } catch (creationError) {
        // If a stale replay raced another recovery, the unique
        // reports.partner_request_id boundary selects the canonical winner.
        report = await getPartnerReportByRequestId(
          partner.id,
          requestClaim.request.id
        );
        if (!report) throw creationError;
      }
    }

    await bindPartnerReportRequest({
      requestId: requestClaim.request.id,
      reportId: report.id,
      partnerId: partner.id,
    });

    // Exactly-once aggregate usage is backed by partner_report_usage(report_id).
    await trackApiUsage(partner.id, report.id, partner.per_report_fee_cents);

    let queueStatus = 'not_required';
    if (RECOVERABLE_PIPELINE_STATUSES.has(report.status as ReportStatus)) {
      const run = await enqueuePipelineRun({
        reportId: report.id,
        source: 'partner_api',
        idempotencyKey: `partner:${partner.id}:${idempotencyKey}`,
        startStage: inferNextStageNumber(
          report.pipeline_last_completed_stage
        ),
        metadata: {
          partner_id: partner.id,
          partner_firm_name: partner.firm_name,
          request_id: requestClaim.request.id,
          enqueued_from: 'partner_api',
        },
      });
      queueStatus = run.status;
    }

    apiLogger.info(
      {
        reportId: report.id,
        partnerId: partner.id,
        requestId: requestClaim.request.id,
        createdReport,
        queueStatus,
      },
      '[partner-api] Partner report has durable ownership'
    );

    return NextResponse.json(
      {
        reportId: report.id,
        status: report.status,
        queueStatus,
        jurisdiction: resolved,
        idempotentReplay: !createdReport,
        message:
          queueStatus === 'not_required'
            ? 'Report already reached a non-runnable review or delivery state.'
            : 'Report created and durably queued.',
      },
      { status: createdReport ? 201 : 200 }
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
