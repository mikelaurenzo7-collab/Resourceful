// ─── Stage 6: Action Guide Generation ────────────────────────────────────────
// Generates service-type-specific guidance:
//   - tax_appeal: Pro se filing guide (county-specific, step-by-step)
//   - pre_purchase: Negotiation strategy guide
//   - pre_listing: Pricing strategy guide
// Grounded in county_rules data + appeal_argument_summary + values.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, CountyRule, ReportNarrative, PropertyData, IncomeAnalysis } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateFilingGuide, type FilingGuidePayload } from '@/lib/services/anthropic';
import { AI_MODELS } from '@/config/ai';
import { calculateDeadline } from '@/lib/utils/deadline-calculator';

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runFilingGuide(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch report ──────────────────────────────────────────────────────
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = reportData as Report | null;

  if (reportError || !report) {
    return { success: false, error: `Failed to fetch report: ${reportError?.message}` };
  }

  // ── Fetch county rules ────────────────────────────────────────────────
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

  // ── Fetch appeal argument summary from narratives ─────────────────────
  const { data: appealNarrativeData } = await supabase
    .from('report_narratives')
    .select('content')
    .eq('report_id', reportId)
    .eq('section_name', 'appeal_argument_summary')
    .single();
  const appealNarrative = appealNarrativeData as Pick<ReportNarrative, 'content'> | null;

  // Also try assessment_equity as fallback
  let appealContent = appealNarrative?.content ?? '';
  if (!appealContent) {
    const { data: equityNarrativeData } = await supabase
      .from('report_narratives')
      .select('content')
      .eq('report_id', reportId)
      .eq('section_name', 'assessment_equity')
      .single();
    const equityNarrative = equityNarrativeData as Pick<ReportNarrative, 'content'> | null;
    appealContent = equityNarrative?.content ?? '';
  }

  // ── Fetch property data for assessed values ───────────────────────────
  const { data: pdData } = await supabase
    .from('property_data')
    .select('*')
    .eq('report_id', reportId)
    .single();
  const propertyData = pdData as PropertyData | null;

  const assessedValue = propertyData?.assessed_value ?? 0;

  // ── Fetch concluded value from comparable sales median ─────────────────
  // (The concluded value was calculated in stage 5 and used in narratives.
  //  Re-derive it here from comps for consistency.)
  const { data: compsData } = await supabase
    .from('comparable_sales')
    .select('adjusted_price_per_sqft, sale_price')
    .eq('report_id', reportId);
  const comps = (compsData ?? []) as Pick<import('@/types/database').ComparableSale, 'adjusted_price_per_sqft' | 'sale_price'>[];

  let concludedValue = 0;
  if (comps.length > 0 && propertyData?.building_sqft_gross) {
    const adjustedPrices = comps
      .map((c) => c.adjusted_price_per_sqft)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);

    if (adjustedPrices.length > 0) {
      const mid = Math.floor(adjustedPrices.length / 2);
      const medianPricePerSqft = adjustedPrices.length % 2 === 0
        ? (adjustedPrices[mid - 1] + adjustedPrices[mid]) / 2
        : adjustedPrices[mid];
      concludedValue = Math.round((medianPricePerSqft * propertyData.building_sqft_gross) / 1000) * 1000;
    }
  }

  // Check income approach
  if (report.property_type === 'commercial' || report.property_type === 'industrial') {
    const { data: incomeRaw } = await supabase
      .from('income_analysis')
      .select('concluded_value_income_approach')
      .eq('report_id', reportId)
      .single();
    const incomeData = incomeRaw as Pick<IncomeAnalysis, 'concluded_value_income_approach'> | null;

    if (incomeData?.concluded_value_income_approach && concludedValue > 0) {
      concludedValue = Math.round(
        (concludedValue * 0.7 + incomeData.concluded_value_income_approach * 0.3) / 1000
      ) * 1000;
    }
  }

  if (concludedValue <= 0) {
    return { success: false, error: 'No concluded value available for filing guide' };
  }

  // ── Build appeal deadline string (auto-calculated when possible) ─────
  const deadlineInfo = calculateDeadline(countyRule);
  let appealDeadline: string | null = null;
  if (deadlineInfo.source === 'exact' || deadlineInfo.source === 'calculated') {
    // Use the auto-calculated deadline with urgency context
    appealDeadline = deadlineInfo.displayText;
    if (countyRule?.appeal_deadline_rule) {
      appealDeadline += ` — Rule: ${countyRule.appeal_deadline_rule}`;
    }
    console.log(`[stage6] Auto-calculated deadline: ${deadlineInfo.displayText} (${deadlineInfo.urgencyLevel})`);
  } else if (countyRule?.appeal_deadline_rule) {
    appealDeadline = countyRule.appeal_deadline_rule;
  }
  if (countyRule?.tax_year_appeal_window) {
    appealDeadline = (appealDeadline ? appealDeadline + '. ' : '') + countyRule.tax_year_appeal_window;
  }

  // ── Calculate potential savings ───────────────────────────────────────
  const potentialSavings = Math.max(0, assessedValue - concludedValue);

  // ── Build filing guide payload ────────────────────────────────────────
  const payload: FilingGuidePayload = {
    propertyAddress: [
      report.property_address,
      report.city,
      report.state,
    ].filter(Boolean).join(', '),
    countyName: countyRule?.county_name ?? report.county ?? '',
    state: countyRule?.state_name ?? report.state ?? '',
    assessedValue,
    concludedValue,
    potentialSavings,
    appealDeadline,
    appealBoardName: countyRule?.appeal_board_name ?? null,
    appealBoardAddress: countyRule?.appeal_board_address ?? null,
    appealBoardPhone: countyRule?.appeal_board_phone ?? null,
    portalUrl: countyRule?.portal_url ?? null,
    filingEmail: countyRule?.filing_email ?? null,
    acceptsOnlineFiling: countyRule?.accepts_online_filing ?? false,
    acceptsEmailFiling: countyRule?.accepts_email_filing ?? false,
    requiresMailFiling: countyRule?.requires_mail_filing ?? false,
    appealFormName: countyRule?.appeal_form_name ?? null,
    formDownloadUrl: countyRule?.form_download_url ?? null,
    evidenceRequirements: (countyRule?.evidence_requirements as unknown as string[]) ?? null,
    hearingFormat: countyRule?.hearing_format ?? null,
    filingFeeCents: countyRule?.filing_fee_cents ?? null,
    filingFeeNotes: countyRule?.filing_fee_notes ?? null,
    proSeTips: countyRule?.pro_se_tips ?? null,
    hearingTypicallyRequired: countyRule?.hearing_typically_required ?? false,
    typicalResolutionWeeksMin: countyRule?.typical_resolution_weeks_min ?? null,
    typicalResolutionWeeksMax: countyRule?.typical_resolution_weeks_max ?? null,
    stateAppealBoardName: countyRule?.state_appeal_board_name ?? null,
    stateAppealBoardUrl: countyRule?.state_appeal_board_url ?? null,
    appealArgumentSummary: appealContent || null,
    // Enhanced filing schedule fields
    assessmentCycle: countyRule?.assessment_cycle ?? null,
    assessmentNoticesMailed: countyRule?.assessment_notices_mailed ?? null,
    appealWindowDays: countyRule?.appeal_window_days ?? null,
    nextAppealDeadline: countyRule?.next_appeal_deadline ?? null,
    currentTaxYear: countyRule?.current_tax_year ?? null,
    filingSteps: countyRule?.filing_steps ?? null,
    requiredDocuments: countyRule?.required_documents ?? null,
    informalReviewAvailable: countyRule?.informal_review_available ?? false,
    informalReviewNotes: countyRule?.informal_review_notes ?? null,
    hearingDurationMinutes: countyRule?.hearing_duration_minutes ?? null,
    hearingSchedulingNotes: countyRule?.hearing_scheduling_notes ?? null,
    virtualHearingAvailable: countyRule?.virtual_hearing_available ?? false,
    virtualHearingPlatform: countyRule?.virtual_hearing_platform ?? null,
    authorizedRepAllowed: countyRule?.authorized_rep_allowed ?? null,
    authorizedRepTypes: countyRule?.authorized_rep_types ?? null,
    authorizedRepFormUrl: countyRule?.authorized_rep_form_url ?? null,
    repRestrictionsNotes: countyRule?.rep_restrictions_notes ?? null,
    furtherAppealBody: countyRule?.further_appeal_body ?? null,
    furtherAppealDeadlineRule: countyRule?.further_appeal_deadline_rule ?? null,
    furtherAppealUrl: countyRule?.further_appeal_url ?? null,
    // Board intelligence
    boardPersonalityNotes: countyRule?.board_personality_notes ?? null,
    winningArgumentPatterns: countyRule?.winning_argument_patterns ?? null,
    successRatePct: countyRule?.success_rate_pct ?? null,
    // Review tier — controls how much hand-holding the guide provides
    reviewTier: (report.review_tier ?? 'auto') as FilingGuidePayload['reviewTier'],
    serviceType: (report.service_type ?? 'tax_appeal') as FilingGuidePayload['serviceType'],
  };

  // ── Generate filing guide via AI ──────────────────────────────────────
  console.log(`[stage6] Generating filing guide for ${report.county ?? 'unknown'}, ${report.state ?? 'unknown'}`);
  const guideResult = await generateFilingGuide(payload);

  if (guideResult.error || !guideResult.data) {
    return {
      success: false,
      error: `Filing guide generation failed: ${guideResult.error}`,
    };
  }

  const { guide, prompt_tokens, completion_tokens, generation_duration_ms } = guideResult.data;

  // ── Determine section name based on service type ──────────────────────
  const sectionName = report.service_type === 'pre_purchase'
    ? 'negotiation_guide'
    : report.service_type === 'pre_listing'
      ? 'pricing_strategy_guide'
      : 'pro_se_filing_guide';

  // ── Delete existing guide narrative ───────────────────────────────────
  await supabase
    .from('report_narratives')
    .delete()
    .eq('report_id', reportId)
    .eq('section_name', sectionName);

  // Also clean up legacy section name if switching service types
  if (sectionName !== 'pro_se_filing_guide') {
    await supabase
      .from('report_narratives')
      .delete()
      .eq('report_id', reportId)
      .eq('section_name', 'pro_se_filing_guide');
  }

  // ── Store as report_narratives row ────────────────────────────────────
  const { error: insertError } = await supabase
    .from('report_narratives')
    .insert({
      report_id: reportId,
      section_name: sectionName,
      content: guide,
      model_used: AI_MODELS.FAST,
      prompt_tokens,
      completion_tokens,
      generation_duration_ms,
      admin_edited: false,
      admin_edited_content: null,
    });

  if (insertError) {
    return {
      success: false,
      error: `Failed to insert filing guide narrative: ${insertError.message}`,
    };
  }

  console.log(
    `[stage6] Filing guide generated in ${generation_duration_ms}ms for report ${reportId}`
  );

  return { success: true };
}
