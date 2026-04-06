// ─── GET /api/reports/[id]/filing-info ────────────────────────────────────────
// Returns county-specific filing information for a report.
// No auth required — keyed by report ID (UUID, unguessable).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report, CountyRule } from '@/types/database';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: 60 requests per 15 minutes per IP
  const rateLimitResponse = await applyRateLimit(_req, {
    prefix: 'report-filing-info',
    limit: 60,
    windowSeconds: 900,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { id: reportId } = await params;

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch report with county info
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('county_fips, county, state, service_type, property_address, city')
    .eq('id', reportId)
    .single();

  if (reportError || !reportData) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const report = reportData as Pick<Report, 'county_fips' | 'county' | 'state' | 'service_type' | 'property_address' | 'city'>;

  // Fetch county rules
  let countyRule: CountyRule | null = null;

  if (report.county_fips) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', report.county_fips)
      .single();
    countyRule = data as CountyRule | null;
  }

  if (!countyRule && report.county && report.state) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_name', report.county)
      .eq('state_abbreviation', report.state)
      .single();
    countyRule = data as CountyRule | null;
  }

  if (!countyRule) {
    return NextResponse.json({
      found: false,
      countyName: report.county,
      state: report.state,
    });
  }

  // Return filing-relevant fields only
  return NextResponse.json({
    found: true,
    countyName: countyRule.county_name,
    state: countyRule.state_name,
    stateAbbreviation: countyRule.state_abbreviation,
    // Filing method
    acceptsOnlineFiling: countyRule.accepts_online_filing,
    portalUrl: countyRule.portal_url,
    acceptsEmailFiling: countyRule.accepts_email_filing,
    filingEmail: countyRule.filing_email,
    requiresMailFiling: countyRule.requires_mail_filing,
    // Appeal board
    appealBoardName: countyRule.appeal_board_name,
    appealBoardAddress: countyRule.appeal_board_address,
    appealBoardPhone: countyRule.appeal_board_phone,
    // Deadlines and schedule
    appealDeadlineRule: countyRule.appeal_deadline_rule,
    taxYearAppealWindow: countyRule.tax_year_appeal_window,
    assessmentCycle: countyRule.assessment_cycle,
    assessmentNoticesMailed: countyRule.assessment_notices_mailed,
    appealWindowDays: countyRule.appeal_window_days,
    nextAppealDeadline: countyRule.next_appeal_deadline,
    currentTaxYear: countyRule.current_tax_year,
    // Forms and fees
    appealFormName: countyRule.appeal_form_name,
    formDownloadUrl: countyRule.form_download_url,
    filingFeeCents: countyRule.filing_fee_cents,
    filingFeeNotes: countyRule.filing_fee_notes,
    // Requirements
    requiredDocuments: countyRule.required_documents,
    filingSteps: countyRule.filing_steps,
    // Hearing info
    hearingTypicallyRequired: countyRule.hearing_typically_required,
    hearingFormat: countyRule.hearing_format,
    hearingDurationMinutes: countyRule.hearing_duration_minutes,
    virtualHearingAvailable: countyRule.virtual_hearing_available,
    virtualHearingPlatform: countyRule.virtual_hearing_platform,
    hearingSchedulingNotes: countyRule.hearing_scheduling_notes,
    // Informal review
    informalReviewAvailable: countyRule.informal_review_available,
    informalReviewNotes: countyRule.informal_review_notes,
    // Resolution timeline
    typicalResolutionWeeksMin: countyRule.typical_resolution_weeks_min,
    typicalResolutionWeeksMax: countyRule.typical_resolution_weeks_max,
    // Escalation
    furtherAppealBody: countyRule.further_appeal_body,
    furtherAppealDeadlineRule: countyRule.further_appeal_deadline_rule,
    furtherAppealUrl: countyRule.further_appeal_url,
    // Pro se tips
    proSeTips: countyRule.pro_se_tips,
    // Representation rules
    authorizedRepAllowed: countyRule.authorized_rep_allowed,
    authorizedRepFormUrl: countyRule.authorized_rep_form_url,
    authorizedRepTypes: countyRule.authorized_rep_types,
    repRestrictionsNotes: countyRule.rep_restrictions_notes,
  });
}
