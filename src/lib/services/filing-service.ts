// ─── Appeal Filing Preparation Service ───────────────────────────────────────
// Builds a filing-ready workflow after report delivery. This module deliberately
// does NOT claim or perform a completed filing. Submission requires a verified
// jurisdiction adapter or a human operator who records durable proof.

import { createAdminClient } from '@/lib/supabase/admin';
import type { Report, CountyRule } from '@/types/database';
import { apiLogger } from '@/lib/logger';

export type FilingMethod =
  | 'online'
  | 'mail'
  | 'email'
  | 'guided_self_file'
  | 'representation_review';

export type FilingSubmissionStatus =
  | 'prepared'
  | 'authorization_required'
  | 'ready_for_manual_submission'
  | 'submitted'
  | 'accepted'
  | 'failed';

export interface FilingResult {
  /** True means the workflow/packet was prepared successfully—not that a filing occurred. */
  success: boolean;
  method: FilingMethod;
  submissionStatus: FilingSubmissionStatus;
  confirmationNumber: string | null;
  trackingNumber: string | null;
  filedAt: string | null;
  error: string | null;
  details: Record<string, unknown>;
}

export interface FilingPacket {
  reportId: string;
  clientEmail: string;
  clientName: string | null;
  propertyAddress: string;
  county: string;
  state: string;
  countyFips: string | null;
  assessedValue: number;
  concludedValue: number;
  requestedValue: number;
  reviewTier: string;
  reportPdfPath: string | null;
  formSubmissionData: Record<string, unknown> | null;
}

function emptyFailure(error: string): FilingResult {
  return {
    success: false,
    method: 'guided_self_file',
    submissionStatus: 'failed',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error,
    details: {},
  };
}

/**
 * Resolve the preparation path. Full representation never proceeds automatically
 * when representative authority is missing or unknown.
 */
export function resolveFilingMethod(
  countyRule: CountyRule | null,
  reviewTier: string
): FilingMethod {
  if (reviewTier !== 'full_representation') {
    return 'guided_self_file';
  }

  if (countyRule?.authorized_rep_allowed !== true) {
    return 'representation_review';
  }

  if (countyRule.accepts_online_filing && countyRule.portal_url) return 'online';
  if (countyRule.accepts_email_filing && countyRule.filing_email) return 'email';
  return 'mail';
}

/** Build the filing packet from the same authoritative conclusion delivered to the client. */
export async function buildFilingPacket(reportId: string): Promise<FilingPacket | null> {
  const supabase = createAdminClient();

  const [{ data: reportData }, { data: propertyData }, { data: formData }] = await Promise.all([
    supabase.from('reports').select('*').eq('id', reportId).single(),
    supabase
      .from('property_data')
      .select('assessed_value, assessment_ratio, concluded_value')
      .eq('report_id', reportId)
      .single(),
    supabase.from('form_submissions').select('form_data').eq('report_id', reportId).maybeSingle(),
  ]);

  const report = reportData as unknown as Report | null;
  if (!report || !propertyData) return null;

  const assessedValue = Number(propertyData.assessed_value) || 0;
  const concludedValue = Number(propertyData.concluded_value) || 0;
  const ratio = Number(propertyData.assessment_ratio) || 1;

  if (assessedValue <= 0 || concludedValue <= 0) {
    apiLogger.warn({ reportId }, '[filing] Cannot prepare packet without assessed and concluded values');
    return null;
  }

  const requestedValue = ratio > 0 && ratio < 1
    ? Math.round((concludedValue * ratio) / 1000) * 1000
    : Math.round(concludedValue / 1000) * 1000;

  return {
    reportId,
    clientEmail: report.client_email ?? '',
    clientName: report.client_name ?? null,
    propertyAddress: report.property_address,
    county: report.county ?? '',
    state: report.state ?? '',
    countyFips: report.county_fips ?? null,
    assessedValue,
    concludedValue,
    requestedValue,
    reviewTier: report.review_tier ?? 'auto',
    reportPdfPath: report.report_pdf_storage_path ?? null,
    formSubmissionData:
      ((formData as { form_data?: Record<string, unknown> } | null)?.form_data ?? null),
  };
}

async function setPreparedState(
  packet: FilingPacket,
  method: FilingMethod,
  filingStatus: string,
  note: string
): Promise<void> {
  const { error } = await createAdminClient()
    .from('reports')
    .update({
      filing_status: filingStatus,
      filing_method: method,
      admin_notes: note,
    })
    .eq('id', packet.reportId);

  if (error) throw new Error(`Failed to save filing preparation state: ${error.message}`);
}

async function prepareGuidedFiling(
  packet: FilingPacket,
  countyRule: CountyRule | null
): Promise<FilingResult> {
  await setPreparedState(
    packet,
    'guided_self_file',
    'guided_ready',
    `Pro se filing packet ready. Requested assessed value: $${packet.requestedValue.toLocaleString()}. Owner must verify the current deadline and submit through the county-approved channel.`
  );

  return {
    success: true,
    method: 'guided_self_file',
    submissionStatus: 'prepared',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error: null,
    details: {
      portalUrl: countyRule?.portal_url ?? null,
      filingEmail: countyRule?.filing_email ?? null,
      formUrl: countyRule?.form_download_url ?? null,
      requestedValue: packet.requestedValue,
      proofRequired: true,
    },
  };
}

async function prepareRepresentationReview(
  packet: FilingPacket,
  countyRule: CountyRule | null
): Promise<FilingResult> {
  const authorityKnown = countyRule?.authorized_rep_allowed;
  const note = authorityKnown === false
    ? 'County rules indicate third-party representation is not allowed. Convert this case to guided pro se filing or obtain legal review.'
    : 'Representative authority is unverified. Confirm eligible representative type, current authorization form, signature requirements, and hearing authority before submission.';

  await setPreparedState(
    packet,
    'representation_review',
    'authorization_required',
    note
  );

  return {
    success: true,
    method: 'representation_review',
    submissionStatus: 'authorization_required',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error: null,
    details: {
      authorizedRepAllowed: authorityKnown ?? null,
      authorizedRepTypes: countyRule?.authorized_rep_types ?? null,
      authorizationFormUrl: countyRule?.authorized_rep_form_url ?? null,
      restrictions: countyRule?.rep_restrictions_notes ?? null,
      requestedValue: packet.requestedValue,
    },
  };
}

async function prepareManagedSubmission(
  packet: FilingPacket,
  countyRule: CountyRule,
  method: Exclude<FilingMethod, 'guided_self_file' | 'representation_review'>
): Promise<FilingResult> {
  if (countyRule.authorized_rep_allowed !== true) {
    return prepareRepresentationReview(packet, countyRule);
  }

  const destination = method === 'online'
    ? countyRule.portal_url
    : method === 'email'
      ? countyRule.filing_email
      : countyRule.appeal_board_address;

  await setPreparedState(
    packet,
    method,
    'ready_to_file',
    `Managed filing packet prepared for ${method} submission. Destination: ${destination ?? 'verification required'}. Requested assessed value: $${packet.requestedValue.toLocaleString()}. Do not mark filed until durable submission proof is recorded.`
  );

  return {
    success: true,
    method,
    submissionStatus: 'ready_for_manual_submission',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error: null,
    details: {
      destination,
      requestedValue: packet.requestedValue,
      authorizationFormUrl: countyRule.authorized_rep_form_url,
      proofRequired: true,
      note: 'Human review and executed authorization are required before submission.',
    },
  };
}

/**
 * Prepare the post-delivery filing workflow. Despite the historical function name,
 * this function does not submit an appeal or set filed_at.
 */
export async function fileAppeal(reportId: string): Promise<FilingResult> {
  const packet = await buildFilingPacket(reportId);
  if (!packet) return emptyFailure('Report not found or missing authoritative valuation data');

  const supabase = createAdminClient();
  let countyRule: CountyRule | null = null;

  if (packet.countyFips) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', packet.countyFips)
      .maybeSingle();
    countyRule = data as CountyRule | null;
  }

  const method = resolveFilingMethod(countyRule, packet.reviewTier);
  apiLogger.info(
    { reportId, method, reviewTier: packet.reviewTier, countyFips: packet.countyFips },
    '[filing] Preparing filing workflow'
  );

  if (method === 'guided_self_file') return prepareGuidedFiling(packet, countyRule);
  if (method === 'representation_review') return prepareRepresentationReview(packet, countyRule);
  if (!countyRule) return prepareRepresentationReview(packet, null);
  return prepareManagedSubmission(packet, countyRule, method);
}

/** Delivered tax-appeal reports can enter filing preparation once. */
export function isFilingEligible(report: Report): boolean {
  return (
    report.status === 'delivered' &&
    report.service_type === 'tax_appeal' &&
    (report.filing_status === 'not_started' || report.filing_status === null)
  );
}
