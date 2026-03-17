// ─── Stage 6: Pro Se Filing Guide ────────────────────────────────────────────
// Generates a county-specific pro se filing guide using AI, grounded entirely
// in county_rules data + appeal_argument_summary + concluded/assessed values.
// Covers deadline, where to file, form names + links, what to write, what to
// attach, what to expect, and the 3 strongest arguments.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, CountyRule, ReportNarrative, PropertyData, IncomeAnalysis } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateFilingGuide, type FilingGuidePayload } from '@/lib/services/anthropic';

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

  // ── Build appeal deadline string ──────────────────────────────────────
  let appealDeadline: string | null = null;
  if (countyRule?.appeal_deadline_rule) {
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

  // ── Delete existing filing guide narrative ────────────────────────────
  await supabase
    .from('report_narratives')
    .delete()
    .eq('report_id', reportId)
    .eq('section_name', 'pro_se_filing_guide');

  // ── Store as report_narratives row ────────────────────────────────────
  const { error: insertError } = await supabase
    .from('report_narratives')
    .insert({
      report_id: reportId,
      section_name: 'pro_se_filing_guide',
      content: guide,
      model_used: process.env.AI_MODEL_PRIMARY ?? 'claude-sonnet-4-6',
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
