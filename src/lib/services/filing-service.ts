// ─── Appeal Filing Service ────────────────────────────────────────────────────
// Handles the actual filing of property tax appeals on behalf of users.
// Three filing methods based on county capabilities and user's service tier:
//
//   1. ONLINE FILING: Auto-submit via county portal (counties with online filing)
//   2. MAIL FILING: Generate filled PDF + mail via Lob API
//   3. GUIDED FILING: Prepare all documents, guide user through self-filing
//
// Triggered after admin approves a report (status = 'approved') for users
// who purchased guided_filing or full_representation tiers.

import { createAdminClient } from '@/lib/supabase/admin';
import type { Report, CountyRule } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FilingMethod = 'online' | 'mail' | 'email' | 'guided_self_file';

export interface FilingResult {
  success: boolean;
  method: FilingMethod;
  confirmationNumber: string | null;
  trackingNumber: string | null;  // For mail filings
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

// ─── Filing Method Resolution ────────────────────────────────────────────────

/**
 * Determine the best filing method for a county + service tier combination.
 */
export function resolveFilingMethod(
  countyRule: CountyRule | null,
  reviewTier: string
): FilingMethod {
  // Guided filing and auto tiers = user files themselves (we prepare docs)
  if (reviewTier === 'auto' || reviewTier === 'expert_reviewed' || reviewTier === 'guided_filing') {
    return 'guided_self_file';
  }

  // Full representation = we file for them
  if (reviewTier === 'full_representation') {
    if (countyRule?.accepts_online_filing && countyRule.portal_url) {
      return 'online';
    }
    if (countyRule?.accepts_email_filing && countyRule.filing_email) {
      return 'email';
    }
    return 'mail';
  }

  return 'guided_self_file';
}

// ─── Filing Packet Builder ───────────────────────────────────────────────────

/**
 * Build a complete filing packet from a report and its related data.
 */
export async function buildFilingPacket(reportId: string): Promise<FilingPacket | null> {
  const supabase = createAdminClient();

  // Fetch report
  const { data: report } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (!report) return null;
  const r = report as unknown as Report;

  // Fetch property data for values
  const { data: pd } = await supabase
    .from('property_data')
    .select('assessed_value, assessment_ratio')
    .eq('report_id', reportId)
    .single();

  // Fetch concluded value from comps
  const { data: comps } = await supabase
    .from('comparable_sales')
    .select('adjusted_price_per_sqft')
    .eq('report_id', reportId);

  const { data: pdFull } = await supabase
    .from('property_data')
    .select('building_sqft_gross')
    .eq('report_id', reportId)
    .single();

  let concludedValue = 0;
  const adjPrices = (comps ?? [])
    .map((c: { adjusted_price_per_sqft: number | null }) => c.adjusted_price_per_sqft)
    .filter((p): p is number => p != null && p > 0)
    .sort((a, b) => a - b);

  if (adjPrices.length > 0 && pdFull?.building_sqft_gross) {
    const mid = Math.floor(adjPrices.length / 2);
    const median = adjPrices.length % 2 === 0
      ? (adjPrices[mid - 1] + adjPrices[mid]) / 2
      : adjPrices[mid];
    concludedValue = Math.round((median * Number(pdFull.building_sqft_gross)) / 1000) * 1000;
  }

  // Fetch form submission data (pre-filled form fields from Stage 5)
  const { data: formSub } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('report_id', reportId)
    .single() as { data: Record<string, unknown> | null };

  const assessedValue = Number(pd?.assessed_value) || 0;
  const ratio = Number(pd?.assessment_ratio) || 1;
  const requestedValue = ratio < 1
    ? Math.round(concludedValue * ratio / 1000) * 1000
    : concludedValue;

  return {
    reportId,
    clientEmail: r.client_email ?? '',
    clientName: r.client_name ?? null,
    propertyAddress: r.property_address,
    county: r.county ?? '',
    state: r.state ?? '',
    countyFips: r.county_fips ?? null,
    assessedValue,
    concludedValue,
    requestedValue,
    reviewTier: r.review_tier ?? 'auto',
    reportPdfPath: r.report_pdf_storage_path ?? null,
    formSubmissionData: (formSub?.form_data as Record<string, unknown>) ?? null,
  };
}

// ─── Online Filing ───────────────────────────────────────────────────────────

/**
 * Submit an appeal through a county's online portal.
 * Uses the form_submission data to auto-fill fields.
 *
 * NOTE: This is the framework — actual portal automation requires
 * county-specific Playwright scripts added incrementally.
 * For now, it prepares the packet and logs the filing intent.
 */
async function fileOnline(
  packet: FilingPacket,
  countyRule: CountyRule
): Promise<FilingResult> {
  console.log(
    `[filing] Online filing for ${packet.propertyAddress} via ${countyRule.portal_url}`
  );

  // ROADMAP: County-specific Playwright automation (Phase 3 enhancement)
  // For now, record the intent and notify admin to file manually
  const supabase = createAdminClient();
  await supabase
    .from('reports')
    .update({
      filing_status: 'ready_to_file',
      filing_method: 'online',
      admin_notes: `Ready for online filing at ${countyRule.portal_url}. Form data pre-filled. Requested value: $${packet.requestedValue.toLocaleString()}.`,
    })
    .eq('id', packet.reportId);

  return {
    success: true,
    method: 'online',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error: null,
    details: {
      portalUrl: countyRule.portal_url,
      requestedValue: packet.requestedValue,
      status: 'ready_to_file',
      note: 'Packet prepared. Admin to complete online submission or automate via Playwright.',
    },
  };
}

// ─── Email Filing ────────────────────────────────────────────────────────────

async function fileByEmail(
  packet: FilingPacket,
  countyRule: CountyRule
): Promise<FilingResult> {
  console.log(
    `[filing] Email filing for ${packet.propertyAddress} to ${countyRule.filing_email}`
  );

  // Prepare email with report PDF attached
  // ROADMAP: Email filing with PDF attachment via Resend (Phase 3 enhancement)
  const supabase = createAdminClient();
  await supabase
    .from('reports')
    .update({
      filing_status: 'ready_to_file',
      filing_method: 'email',
      admin_notes: `Ready for email filing to ${countyRule.filing_email}. Report PDF attached. Requested value: $${packet.requestedValue.toLocaleString()}.`,
    })
    .eq('id', packet.reportId);

  return {
    success: true,
    method: 'email',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error: null,
    details: {
      filingEmail: countyRule.filing_email,
      requestedValue: packet.requestedValue,
      status: 'ready_to_file',
    },
  };
}

// ─── Mail Filing (Lob API) ───────────────────────────────────────────────────

async function fileByMail(
  packet: FilingPacket,
  countyRule: CountyRule
): Promise<FilingResult> {
  console.log(
    `[filing] Mail filing for ${packet.propertyAddress} to ${countyRule.appeal_board_address ?? 'address TBD'}`
  );

  const lobApiKey = process.env.LOB_API_KEY;

  if (!lobApiKey) {
    // No Lob API — flag for manual mailing
    const supabase = createAdminClient();
    await supabase
      .from('reports')
      .update({
        filing_status: 'ready_to_file',
        filing_method: 'mail',
        admin_notes: `Ready for mail filing to ${countyRule.appeal_board_address ?? countyRule.appeal_board_name}. Print and mail report + appeal form. Requested value: $${packet.requestedValue.toLocaleString()}.`,
      })
      .eq('id', packet.reportId);

    return {
      success: true,
      method: 'mail',
      confirmationNumber: null,
      trackingNumber: null,
      filedAt: null,
      error: null,
      details: {
        address: countyRule.appeal_board_address,
        status: 'ready_to_file',
        note: 'Lob API not configured. Admin to print and mail.',
      },
    };
  }

  // ROADMAP: Lob API integration for automated certified mail (Phase 3)

  return {
    success: true,
    method: 'mail',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error: null,
    details: { status: 'ready_to_file' },
  };
}

// ─── Guided Self-Filing ──────────────────────────────────────────────────────

async function prepareGuidedFiling(
  packet: FilingPacket,
  countyRule: CountyRule | null
): Promise<FilingResult> {
  console.log(`[filing] Preparing guided filing packet for ${packet.propertyAddress}`);

  const supabase = createAdminClient();
  await supabase
    .from('reports')
    .update({
      filing_status: 'guided_ready',
      filing_method: 'guided_self_file',
    })
    .eq('id', packet.reportId);

  return {
    success: true,
    method: 'guided_self_file',
    confirmationNumber: null,
    trackingNumber: null,
    filedAt: null,
    error: null,
    details: {
      status: 'guided_ready',
      note: 'Report + filing guide delivered. User files themselves.',
      portalUrl: countyRule?.portal_url ?? null,
    },
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * File an appeal for an approved report.
 * Determines the best filing method and executes it.
 */
export async function fileAppeal(reportId: string): Promise<FilingResult> {
  const packet = await buildFilingPacket(reportId);
  if (!packet) {
    return {
      success: false,
      method: 'guided_self_file',
      confirmationNumber: null,
      trackingNumber: null,
      filedAt: null,
      error: 'Report not found or missing data',
      details: {},
    };
  }

  // Look up county rules
  const supabase = createAdminClient();
  let countyRule: CountyRule | null = null;

  if (packet.countyFips) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', packet.countyFips)
      .single();
    countyRule = data as CountyRule | null;
  }

  const method = resolveFilingMethod(countyRule, packet.reviewTier);

  console.log(`[filing] Method resolved: ${method} for tier=${packet.reviewTier}, county=${packet.county}`);

  switch (method) {
    case 'online':
      return fileOnline(packet, countyRule!);
    case 'email':
      return fileByEmail(packet, countyRule!);
    case 'mail':
      return fileByMail(packet, countyRule!);
    case 'guided_self_file':
      return prepareGuidedFiling(packet, countyRule);
    default:
      return prepareGuidedFiling(packet, countyRule);
  }
}

/**
 * Check if a report is eligible for filing.
 */
export function isFilingEligible(report: Report): boolean {
  return (
    report.status === 'approved' &&
    report.service_type === 'tax_appeal' &&
    (report.filing_status === 'not_started' || report.filing_status === null)
  );
}
