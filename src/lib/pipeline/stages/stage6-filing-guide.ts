// ─── Stage 6: Assignment Action Guide Generation ─────────────────────────────
// Generates assignment-specific guidance:
//   - tax_appeal: county-specific pro se filing guide
//   - pre_purchase: buyer negotiation and due-diligence guide
//   - pre_listing: seller pricing and preparation guide
//   - independent_valuation: purpose, documentation, review, and use guide
// Grounded in the structured workfile and verified jurisdiction data.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, CountyRule, ReportNarrative, PropertyData, IncomeAnalysis } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateFilingGuide, type FilingGuidePayload } from '@/lib/services/anthropic';
import {
  getActionGuideSectionName,
  resolveAssignmentKind,
  type ActionGuideSectionName,
} from '@/lib/assignments/routing';
import { AI_MODELS } from '@/config/ai';
import { calculateDeadline } from '@/lib/utils/deadline-calculator';
import { pipelineLogger } from '@/lib/logger';

type AssignmentAwareFilingGuidePayload = FilingGuidePayload & {
  assignmentPurpose: string | null;
  rawAssessedValue: number | null;
  assessorImpliedMarketValue: number | null;
  marketValueGap: number | null;
};

const ACTION_GUIDE_SECTIONS: ActionGuideSectionName[] = [
  'pro_se_filing_guide',
  'negotiation_guide',
  'pricing_strategy_guide',
  'valuation_use_guide',
];

function toAssessorImpliedMarketValue(
  rawAssessedValue: number,
  assessmentRatio: number | null | undefined
): number {
  if (
    rawAssessedValue > 0 &&
    assessmentRatio != null &&
    Number.isFinite(assessmentRatio) &&
    assessmentRatio > 0 &&
    assessmentRatio < 1
  ) {
    return Math.round(rawAssessedValue / assessmentRatio);
  }

  return rawAssessedValue;
}

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

  const assignmentKind = resolveAssignmentKind(report.service_type, report.desired_outcome);

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

  // ── Fetch the assignment summary from narratives ──────────────────────
  const primaryNarrativeSection = assignmentKind === 'tax_appeal'
    ? 'appeal_argument_summary'
    : 'executive_summary';
  const fallbackNarrativeSection = assignmentKind === 'tax_appeal'
    ? 'assessment_equity'
    : 'reconciliation_narrative';

  const { data: primaryNarrativeData } = await supabase
    .from('report_narratives')
    .select('content')
    .eq('report_id', reportId)
    .eq('section_name', primaryNarrativeSection)
    .single();
  const primaryNarrative = primaryNarrativeData as Pick<ReportNarrative, 'content'> | null;

  let assignmentSummary = primaryNarrative?.content ?? '';
  if (!assignmentSummary) {
    const { data: fallbackNarrativeData } = await supabase
      .from('report_narratives')
      .select('content')
      .eq('report_id', reportId)
      .eq('section_name', fallbackNarrativeSection)
      .single();
    const fallbackNarrative = fallbackNarrativeData as Pick<ReportNarrative, 'content'> | null;
    assignmentSummary = fallbackNarrative?.content ?? '';
  }

  // ── Fetch property data for valuation semantics ───────────────────────
  const { data: pdData } = await supabase
    .from('property_data')
    .select('*')
    .eq('report_id', reportId)
    .single();
  const propertyData = pdData as PropertyData | null;

  const rawAssessedValue = propertyData?.assessed_value ?? 0;
  const assessorImpliedMarketValue = toAssessorImpliedMarketValue(
    rawAssessedValue,
    propertyData?.assessment_ratio
  );

  // ── Fetch concluded value from comparable sales median ────────────────
  // Stage 5 persists the final conclusion. Re-derive the sales indication here
  // only as a consistency check and fall back to the persisted conclusion when
  // the assignment relies on income or cost evidence.
  const { data: compsData } = await supabase
    .from('comparable_sales')
    .select('adjusted_price_per_sqft, sale_price')
    .eq('report_id', reportId);
  const comps = (compsData ?? []) as Pick<import('@/types/database').ComparableSale, 'adjusted_price_per_sqft' | 'sale_price'>[];

  let concludedValue = 0;
  if (comps.length > 0 && propertyData?.building_sqft_gross) {
    const adjustedPrices = comps
      .map((comp) => comp.adjusted_price_per_sqft)
      .filter((price): price is number => price != null && price > 0)
      .sort((a, b) => a - b);

    if (adjustedPrices.length > 0) {
      const mid = Math.floor(adjustedPrices.length / 2);
      const medianPricePerSqft = adjustedPrices.length % 2 === 0
        ? (adjustedPrices[mid - 1] + adjustedPrices[mid]) / 2
        : adjustedPrices[mid];
      concludedValue = Math.round((medianPricePerSqft * propertyData.building_sqft_gross) / 1000) * 1000;
    }
  }

  // Check income approach for commercial and industrial properties.
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

  // Prefer the final reconciled Stage 5 conclusion when available.
  if (propertyData?.concluded_value && propertyData.concluded_value > 0) {
    concludedValue = propertyData.concluded_value;
  }

  if (concludedValue <= 0) {
    return { success: false, error: 'No concluded value available for assignment action guide' };
  }

  // ── Build appeal deadline string when the assignment is an appeal ─────
  const deadlineInfo = calculateDeadline(countyRule);
  let appealDeadline: string | null = null;
  if (deadlineInfo.source === 'exact' || deadlineInfo.source === 'calculated') {
    appealDeadline = deadlineInfo.displayText;
    if (countyRule?.appeal_deadline_rule) {
      appealDeadline += ` — Rule: ${countyRule.appeal_deadline_rule}`;
    }
    pipelineLogger.info(
      { displayText: deadlineInfo.displayText, urgencyLevel: deadlineInfo.urgencyLevel },
      '[stage6] Auto-calculated deadline'
    );
  } else if (countyRule?.appeal_deadline_rule) {
    appealDeadline = countyRule.appeal_deadline_rule;
  }
  if (countyRule?.tax_year_appeal_window) {
    appealDeadline = (appealDeadline ? `${appealDeadline}. ` : '') + countyRule.tax_year_appeal_window;
  }

  // This is a market-value gap, not annual tax-dollar savings.
  const marketValueGap = Math.max(0, assessorImpliedMarketValue - concludedValue);

  // ── Build action guide payload ────────────────────────────────────────
  const payload: AssignmentAwareFilingGuidePayload = {
    propertyAddress: [
      report.property_address,
      report.city,
      report.state,
    ].filter(Boolean).join(', '),
    countyName: countyRule?.county_name ?? report.county ?? '',
    state: countyRule?.state_name ?? report.state ?? '',
    assignmentPurpose: report.desired_outcome,
    rawAssessedValue: rawAssessedValue > 0 ? rawAssessedValue : null,
    assessorImpliedMarketValue: assessorImpliedMarketValue > 0
      ? assessorImpliedMarketValue
      : null,
    marketValueGap,
    // Backward-compatible aliases consumed by the existing guide contract.
    assessedValue: assessorImpliedMarketValue,
    concludedValue,
    potentialSavings: marketValueGap,
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
    appealArgumentSummary: assignmentSummary || null,
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
    boardPersonalityNotes: countyRule?.board_personality_notes ?? null,
    winningArgumentPatterns: countyRule?.winning_argument_patterns ?? null,
    successRatePct: countyRule?.success_rate_pct ?? null,
    reviewTier: (report.review_tier ?? 'auto') as FilingGuidePayload['reviewTier'],
    serviceType: (report.service_type ?? 'tax_appeal') as FilingGuidePayload['serviceType'],
  };

  // ── Generate assignment guide via GPT-5.6 Sol ─────────────────────────
  pipelineLogger.info(
    { reportId, assignmentKind, county: report.county ?? 'unknown', state: report.state ?? 'unknown' },
    '[stage6] Generating assignment action guide'
  );
  const guideResult = await generateFilingGuide(payload);

  if (guideResult.error || !guideResult.data) {
    return {
      success: false,
      error: `Assignment guide generation failed: ${guideResult.error}`,
    };
  }

  const { guide, prompt_tokens, completion_tokens, generation_duration_ms } = guideResult.data;
  const sectionName = getActionGuideSectionName(report.service_type, report.desired_outcome);

  // Delete the current section before replacement and remove stale guide types
  // left behind by a changed assignment purpose.
  for (const candidateSection of ACTION_GUIDE_SECTIONS) {
    await supabase
      .from('report_narratives')
      .delete()
      .eq('report_id', reportId)
      .eq('section_name', candidateSection);
  }

  const { error: insertError } = await supabase
    .from('report_narratives')
    .insert({
      report_id: reportId,
      section_name: sectionName,
      content: guide,
      model_used: AI_MODELS.PRIMARY,
      prompt_tokens,
      completion_tokens,
      generation_duration_ms,
      admin_edited: false,
      admin_edited_content: null,
    });

  if (insertError) {
    return {
      success: false,
      error: `Failed to insert assignment guide narrative: ${insertError.message}`,
    };
  }

  pipelineLogger.info(
    { reportId, sectionName, durationMs: generation_duration_ms },
    '[stage6] Assignment action guide generated'
  );

  return { success: true };
}
