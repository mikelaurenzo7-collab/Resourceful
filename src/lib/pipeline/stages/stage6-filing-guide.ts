// ─── Stage 6: Pro Se Filing Guide ────────────────────────────────────────────
// Generates a county-specific pro se filing guide using AI, grounded entirely
// in county_rules data + appeal_argument_summary + concluded/assessed values.
// Covers deadline, where to file, form names + links, what to write, what to
// attach, what to expect, and the 3 strongest arguments.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, CountyRule, ReportNarrative, PropertyData, IncomeAnalysis } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generateFilingGuide, type FilingGuidePayload } from '@/lib/services/anthropic';
import { AI_MODELS } from '@/config/ai';

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
    furtherAppealBody: countyRule?.further_appeal_body ?? null,
    furtherAppealDeadlineRule: countyRule?.further_appeal_deadline_rule ?? null,
    furtherAppealUrl: countyRule?.further_appeal_url ?? null,
  };

  // ── Generate filing guide (AI or template) ──────────────────────────
  const useTemplate = process.env.SKIP_FILING_AI === 'true';
  let guide: string;
  let modelUsed: string;
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let generationDurationMs: number | null = null;

  if (useTemplate) {
    // ── Template-based filing guide (zero AI cost) ─────────────────────
    console.log(`[stage6] Generating template-based filing guide for ${report.county ?? 'unknown'}, ${report.state ?? 'unknown'}`);
    guide = buildTemplateFilingGuide(payload);
    modelUsed = 'template';
  } else {
    // ── AI-generated filing guide ──────────────────────────────────────
    console.log(`[stage6] Generating AI filing guide for ${report.county ?? 'unknown'}, ${report.state ?? 'unknown'}`);
    const guideResult = await generateFilingGuide(payload);

    if (guideResult.error || !guideResult.data) {
      return {
        success: false,
        error: `Filing guide generation failed: ${guideResult.error}`,
      };
    }

    guide = guideResult.data.guide;
    modelUsed = AI_MODELS.FAST;
    promptTokens = guideResult.data.prompt_tokens;
    completionTokens = guideResult.data.completion_tokens;
    generationDurationMs = guideResult.data.generation_duration_ms;
  }

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
      model_used: modelUsed,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      generation_duration_ms: generationDurationMs,
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
    `[stage6] Filing guide generated (${useTemplate ? 'template' : 'AI'}) for report ${reportId}`
  );

  return { success: true };
}

// ─── Template-Based Filing Guide ─────────────────────────────────────────────
// Generates a structured filing guide from county_rules data without AI.
// All data comes from the FilingGuidePayload (sourced from county_rules table).

function buildTemplateFilingGuide(p: FilingGuidePayload): string {
  const sections: string[] = [];
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;

  // Header
  sections.push(`# Pro Se Filing Guide: ${p.countyName}, ${p.state}`);
  sections.push(`## Property: ${p.propertyAddress}`);
  sections.push('');

  // Key findings
  sections.push('## Key Findings');
  sections.push(`- **Current Assessed Value:** ${fmt(p.assessedValue)}`);
  sections.push(`- **Our Concluded Market Value:** ${fmt(p.concludedValue)}`);
  if (p.potentialSavings > 0) {
    sections.push(`- **Potential Reduction:** ${fmt(p.potentialSavings)}`);
  }
  sections.push('');

  // Deadline
  if (p.appealDeadline || p.nextAppealDeadline) {
    sections.push('## Appeal Deadline');
    if (p.nextAppealDeadline) {
      sections.push(`**Next Deadline: ${p.nextAppealDeadline}**`);
    }
    if (p.appealDeadline) {
      sections.push(p.appealDeadline);
    }
    if (p.assessmentNoticesMailed) {
      sections.push(`Assessment notices are typically mailed: ${p.assessmentNoticesMailed}`);
    }
    if (p.appealWindowDays) {
      sections.push(`You have ${p.appealWindowDays} days from receipt of your assessment notice to file.`);
    }
    sections.push('');
  }

  // Where to file
  sections.push('## Where to File');
  if (p.appealBoardName) {
    sections.push(`**${p.appealBoardName}**`);
  }
  if (p.appealBoardAddress) {
    sections.push(`Address: ${p.appealBoardAddress}`);
  }
  if (p.appealBoardPhone) {
    sections.push(`Phone: ${p.appealBoardPhone}`);
  }
  if (p.acceptsOnlineFiling && p.portalUrl) {
    sections.push(`Online Filing: ${p.portalUrl}`);
  }
  if (p.acceptsEmailFiling && p.filingEmail) {
    sections.push(`Email Filing: ${p.filingEmail}`);
  }
  if (p.requiresMailFiling) {
    sections.push('This county requires filing by mail.');
  }
  sections.push('');

  // Filing steps
  if (p.filingSteps && Array.isArray(p.filingSteps) && p.filingSteps.length > 0) {
    sections.push('## Step-by-Step Filing Instructions');
    for (const step of p.filingSteps as { step_number: number; title: string; description: string }[]) {
      sections.push(`**Step ${step.step_number}: ${step.title}**`);
      sections.push(step.description);
    }
    sections.push('');
  }

  // Required documents
  if (p.requiredDocuments && Array.isArray(p.requiredDocuments) && p.requiredDocuments.length > 0) {
    sections.push('## Required Documents');
    for (const doc of p.requiredDocuments as string[]) {
      sections.push(`- ${doc}`);
    }
    sections.push('');
  }

  // Forms and fees
  if (p.appealFormName || p.filingFeeCents) {
    sections.push('## Forms and Fees');
    if (p.appealFormName) {
      sections.push(`**Required Form:** ${p.appealFormName}`);
    }
    if (p.formDownloadUrl) {
      sections.push(`Download: ${p.formDownloadUrl}`);
    }
    if (p.filingFeeCents != null) {
      const fee = p.filingFeeCents === 0 ? 'Waived' : `$${(p.filingFeeCents / 100).toFixed(2)}`;
      sections.push(`**Filing Fee:** ${fee}`);
    }
    if (p.filingFeeNotes) {
      sections.push(p.filingFeeNotes);
    }
    sections.push('');
  }

  // Hearing info
  if (p.hearingTypicallyRequired) {
    sections.push('## Hearing Information');
    sections.push('A hearing is typically required for this county.');
    if (p.hearingFormat) {
      sections.push(`**Format:** ${p.hearingFormat}`);
    }
    if (p.hearingDurationMinutes) {
      sections.push(`**Expected Duration:** ${p.hearingDurationMinutes} minutes`);
    }
    if (p.virtualHearingAvailable) {
      sections.push(`**Virtual Hearing:** Available${p.virtualHearingPlatform ? ` via ${p.virtualHearingPlatform}` : ''}`);
    }
    if (p.hearingSchedulingNotes) {
      sections.push(p.hearingSchedulingNotes);
    }
    sections.push('');
  }

  // Informal review
  if (p.informalReviewAvailable) {
    sections.push('## Informal Review');
    sections.push('An informal review is available before the formal appeal process.');
    if (p.informalReviewNotes) {
      sections.push(p.informalReviewNotes);
    }
    sections.push('');
  }

  // Tips
  if (p.proSeTips) {
    sections.push('## Tips for a Successful Appeal');
    sections.push(p.proSeTips);
    sections.push('');
  }

  // Further appeal
  if (p.furtherAppealBody) {
    sections.push('## Further Appeal Options');
    sections.push(`If your initial appeal is denied, you may escalate to: **${p.furtherAppealBody}**`);
    if (p.furtherAppealDeadlineRule) {
      sections.push(`Deadline: ${p.furtherAppealDeadlineRule}`);
    }
    if (p.furtherAppealUrl) {
      sections.push(`More information: ${p.furtherAppealUrl}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
