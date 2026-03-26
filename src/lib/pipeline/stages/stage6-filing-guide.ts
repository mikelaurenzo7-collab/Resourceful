// ─── Stage 6: Action Guide Generation ────────────────────────────────────────
// Generates the service-type-specific action guide using AI + data from Stage 5.
//
// tax_appeal:   Pro se filing guide + auto-file if county accepts email filing
// pre_purchase: Buyer action guide (offer strategy, risk checklist, next steps)
// pre_listing:  Listing strategy guide (launch plan, ROI to-do, buyer targeting)
//
// Stage 6 always runs (per CLAUDE.md). Content varies by service type.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Report,
  CountyRule,
  ReportNarrative,
  PropertyData,
  ComparableSale,
} from '@/types/database';
import type { StageResult } from '../orchestrator';
import {
  generateFilingGuide,
  generateBuyerActionGuide,
  generateListingStrategyGuide,
  generateAppealFilingEmail,
  type FilingGuidePayload,
} from '@/lib/services/anthropic';
import { sendAppealFilingEmail } from '@/lib/services/resend-email';
import { AI_MODELS } from '@/config/ai';
import { resolveStrategy } from '@/config/strategies';
import { type ServiceType, type DesiredOutcome } from '@/config/services';

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runFilingGuide(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = reportData as Report | null;

  if (reportError || !report) {
    return { success: false, error: `Failed to fetch report: ${reportError?.message}` };
  }

  // Dispatch to the correct guide generator based on service type
  switch (report.service_type) {
    case 'pre_purchase':
      return runBuyerActionGuide(reportId, report, supabase);
    case 'pre_listing':
      return runListingStrategyGuide(reportId, report, supabase);
    default:
      return runTaxAppealFilingGuide(reportId, report, supabase);
  }
}

// ─── Pre-Purchase: Buyer Action Guide ────────────────────────────────────────

async function runBuyerActionGuide(
  reportId: string,
  report: Report,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // Fetch Stage 5 narratives in parallel with property data
  const [narrativesRes, propertyRes, compsRes, photosRes] = await Promise.all([
    supabase
      .from('report_narratives')
      .select('section_name, content')
      .eq('report_id', reportId)
      .in('section_name', ['reconciliation_narrative', 'negotiation_memo', 'risk_flags_summary', 'tax_projection_narrative']),
    supabase.from('property_data').select('*').eq('report_id', reportId).single(),
    supabase.from('comparable_sales').select('id').eq('report_id', reportId),
    supabase.from('photos').select('id').eq('report_id', reportId),
  ]);

  const narratives = (narrativesRes.data ?? []) as Pick<ReportNarrative, 'section_name' | 'content'>[];
  const propertyData = propertyRes.data as PropertyData | null;
  const compCount = (compsRes.data ?? []).length;
  const photoCount = (photosRes.data ?? []).length;

  const getSection = (name: string) =>
    narratives.find((n) => n.section_name === name)?.content ?? '';

  // concluded_value is stored on property_data after Stage 5
  const concludedValue = (propertyData as unknown as Record<string, unknown>)?.concluded_value as number | null ?? 0;
  // assessedValue here represents the list price / asking price context for pre_purchase
  const assessedValue = propertyData?.assessed_value;

  const countyName = report.county ?? '';
  const state = report.state ?? '';

  let countyRule: CountyRule | null = null;
  if (report.county_fips) {
    const { data } = await supabase
      .from('county_rules')
      .select('assessment_cycle, assessment_ratio_residential')
      .eq('county_fips', report.county_fips)
      .single();
    countyRule = data as CountyRule | null;
  }

  console.log(`[stage6] Generating buyer action guide for report ${reportId}`);

  const guideResult = await generateBuyerActionGuide({
    propertyAddress: [report.property_address, report.city, state].filter(Boolean).join(', '),
    concludedValue,
    assessedValue: assessedValue ?? null,
    countyName,
    state,
    assessmentCycle: countyRule?.assessment_cycle ?? null,
    assessmentRatioResidential: countyRule?.assessment_ratio_residential ?? null,
    reconciliationNarrative: getSection('reconciliation_narrative'),
    negotiationMemo: getSection('negotiation_memo'),
    riskFlagsSummary: getSection('risk_flags_summary'),
    taxProjectionNarrative: getSection('tax_projection_narrative'),
    comparableSalesCount: compCount,
    photoCount,
  });

  if (guideResult.error || !guideResult.data) {
    return { success: false, error: `Buyer action guide generation failed: ${guideResult.error}` };
  }

  const { guide, prompt_tokens, completion_tokens, generation_duration_ms } = guideResult.data;

  await supabase
    .from('report_narratives')
    .delete()
    .eq('report_id', reportId)
    .eq('section_name', 'buyer_action_guide');

  const { error: insertError } = await supabase
    .from('report_narratives')
    .insert({
      report_id: reportId,
      section_name: 'buyer_action_guide',
      content: guide,
      model_used: AI_MODELS.FAST,
      prompt_tokens,
      completion_tokens,
      generation_duration_ms,
      admin_edited: false,
      admin_edited_content: null,
    });

  if (insertError) {
    return { success: false, error: `Failed to insert buyer action guide: ${insertError.message}` };
  }

  console.log(`[stage6] Buyer action guide generated in ${generation_duration_ms}ms for report ${reportId}`);
  return { success: true };
}

// ─── Pre-Listing: Listing Strategy Guide ─────────────────────────────────────

async function runListingStrategyGuide(
  reportId: string,
  report: Report,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  const [narrativesRes, propertyRes, compsRes, photosRes] = await Promise.all([
    supabase
      .from('report_narratives')
      .select('section_name, content')
      .eq('report_id', reportId)
      .in('section_name', ['reconciliation_narrative', 'value_add_recommendations', 'listing_strategy_summary', 'buyer_profile_brief']),
    supabase.from('property_data').select('*').eq('report_id', reportId).single(),
    supabase.from('comparable_sales').select('id').eq('report_id', reportId),
    supabase.from('photos').select('id').eq('report_id', reportId),
  ]);

  const narratives = (narrativesRes.data ?? []) as Pick<ReportNarrative, 'section_name' | 'content'>[];
  const propertyData = narrativesRes.data ? propertyRes.data as PropertyData | null : null;
  const compCount = (compsRes.data ?? []).length;
  const photoCount = (photosRes.data ?? []).length;

  const getSection = (name: string) =>
    narratives.find((n) => n.section_name === name)?.content ?? '';

  const concludedValue = (propertyRes.data as unknown as Record<string, unknown>)?.concluded_value as number | null ?? 0;

  console.log(`[stage6] Generating listing strategy guide for report ${reportId}`);

  const guideResult = await generateListingStrategyGuide({
    propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
    concludedValue,
    countyName: report.county ?? '',
    state: report.state ?? '',
    reconciliationNarrative: getSection('reconciliation_narrative'),
    valueAddRecommendations: getSection('value_add_recommendations'),
    listingStrategySummary: getSection('listing_strategy_summary'),
    buyerProfileBrief: getSection('buyer_profile_brief'),
    comparableSalesCount: compCount,
    photoCount,
  });

  if (guideResult.error || !guideResult.data) {
    return { success: false, error: `Listing strategy guide generation failed: ${guideResult.error}` };
  }

  const { guide, prompt_tokens, completion_tokens, generation_duration_ms } = guideResult.data;

  await supabase
    .from('report_narratives')
    .delete()
    .eq('report_id', reportId)
    .eq('section_name', 'listing_strategy_guide');

  const { error: insertError } = await supabase
    .from('report_narratives')
    .insert({
      report_id: reportId,
      section_name: 'listing_strategy_guide',
      content: guide,
      model_used: AI_MODELS.FAST,
      prompt_tokens,
      completion_tokens,
      generation_duration_ms,
      admin_edited: false,
      admin_edited_content: null,
    });

  if (insertError) {
    return { success: false, error: `Failed to insert listing strategy guide: ${insertError.message}` };
  }

  console.log(`[stage6] Listing strategy guide generated in ${generation_duration_ms}ms for report ${reportId}`);
  return { success: true };
}

// ─── Tax Appeal: Filing Guide + Auto-Filing ───────────────────────────────────

async function runTaxAppealFilingGuide(
  reportId: string,
  report: Report,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
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

  // ── Fetch property data ───────────────────────────────────────────────
  const { data: pdData } = await supabase
    .from('property_data')
    .select('*')
    .eq('report_id', reportId)
    .single();
  const propertyData = pdData as PropertyData | null;

  const assessedValue = propertyData?.assessed_value ?? 0;

  // ── Compute concluded value using strategy-resolved approach weights ──
  const strategy = resolveStrategy(
    (report.service_type ?? 'tax_appeal') as ServiceType,
    propertyData?.property_subtype ?? `${report.property_type ?? 'residential'}_general`,
    (report.desired_outcome ?? 'reduce_taxes') as DesiredOutcome
  );

  const { data: compsData } = await supabase
    .from('comparable_sales')
    .select('adjusted_price_per_sqft, sale_price')
    .eq('report_id', reportId);
  const comps = (compsData ?? []) as Pick<ComparableSale, 'adjusted_price_per_sqft' | 'sale_price'>[];

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

  // Blend in income approach using strategy weights (replaces hardcoded 0.7/0.3)
  if (strategy.incomeEligible) {
    const { data: incomeRaw } = await supabase
      .from('income_analysis')
      .select('concluded_value_income_approach')
      .eq('report_id', reportId)
      .single();
    const incomeValue = (incomeRaw as { concluded_value_income_approach: number | null } | null)
      ?.concluded_value_income_approach;

    if (incomeValue && concludedValue > 0) {
      const { sales_comparison: wSales, income: wIncome } = strategy.approachWeights;
      const combinedWeight = wSales + wIncome;
      const salesShare = combinedWeight > 0 ? wSales / combinedWeight : 0.7;
      const incomeShare = combinedWeight > 0 ? wIncome / combinedWeight : 0.3;
      concludedValue = Math.round(
        (concludedValue * salesShare + incomeValue * incomeShare) / 1000
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

  const potentialSavings = Math.max(0, assessedValue - concludedValue);

  // ── Build filing guide payload ────────────────────────────────────────
  const payload: FilingGuidePayload = {
    propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
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
  };

  // ── Generate pro se filing guide via AI ──────────────────────────────
  console.log(`[stage6] Generating filing guide for ${report.county ?? 'unknown'}, ${report.state ?? 'unknown'}`);
  const guideResult = await generateFilingGuide(payload);

  if (guideResult.error || !guideResult.data) {
    return { success: false, error: `Filing guide generation failed: ${guideResult.error}` };
  }

  const { guide, prompt_tokens, completion_tokens, generation_duration_ms } = guideResult.data;

  await supabase
    .from('report_narratives')
    .delete()
    .eq('report_id', reportId)
    .eq('section_name', 'pro_se_filing_guide');

  const { error: insertError } = await supabase
    .from('report_narratives')
    .insert({
      report_id: reportId,
      section_name: 'pro_se_filing_guide',
      content: guide,
      model_used: AI_MODELS.FAST,
      prompt_tokens,
      completion_tokens,
      generation_duration_ms,
      admin_edited: false,
      admin_edited_content: null,
    });

  if (insertError) {
    return { success: false, error: `Failed to insert filing guide narrative: ${insertError.message}` };
  }

  console.log(`[stage6] Filing guide generated in ${generation_duration_ms}ms for report ${reportId}`);

  // ── Auto-filing (non-fatal) ───────────────────────────────────────────
  // Attempt to file on the client's behalf based on what the county supports.
  await attemptAutoFiling(reportId, report, countyRule, concludedValue, assessedValue, potentialSavings, appealContent, supabase);

  return { success: true };
}

// ─── Auto-Filing Logic ────────────────────────────────────────────────────────
// Non-fatal: failures are logged but do not block the pipeline.

async function attemptAutoFiling(
  reportId: string,
  report: Report,
  countyRule: CountyRule | null,
  concludedValue: number,
  assessedValue: number,
  potentialSavings: number,
  appealArgumentSummary: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  if (!countyRule) return;

  // ── Case A: Email-filing county — we send the appeal on their behalf ──
  if (countyRule.accepts_email_filing && countyRule.filing_email && report.client_email) {
    try {
      // Fetch comps count and photo count for the cover letter
      const [compsCountRes, photosCountRes, propertyRes] = await Promise.all([
        supabase.from('comparable_sales').select('id').eq('report_id', reportId),
        supabase.from('photos').select('id').eq('report_id', reportId),
        supabase.from('property_data').select('tax_year_in_appeal').eq('report_id', reportId).single(),
      ]);
      const compCount = (compsCountRes.data ?? []).length;
      const photoCount = (photosCountRes.data ?? []).length;
      const taxYear = (propertyRes.data as { tax_year_in_appeal: number | null } | null)?.tax_year_in_appeal ?? null;

      // Generate a formal cover letter for the county
      const coverLetterResult = await generateAppealFilingEmail({
        propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
        parcelId: report.pin ?? null,
        ownerName: report.client_name ?? null,
        countyName: countyRule.county_name,
        state: countyRule.state_name,
        appealBoardName: countyRule.appeal_board_name ?? null,
        assessedValue,
        concludedValue,
        potentialSavings,
        taxYear,
        comparableSalesCount: compCount,
        photoCount,
        appealArgumentSummary,
      });

      if (coverLetterResult.error || !coverLetterResult.data) {
        console.warn(`[stage6] Auto-filing cover letter generation failed: ${coverLetterResult.error}`);
        return;
      }

      // Get signed URL for the PDF to attach as evidence link
      const pdfPath = (report as unknown as Record<string, unknown>).report_pdf_storage_path as string | null;
      let pdfUrl = '';
      if (pdfPath) {
        const { data: signedUrlData } = await supabase
          .storage
          .from('reports')
          .createSignedUrl(pdfPath, 7 * 24 * 60 * 60);
        pdfUrl = signedUrlData?.signedUrl ?? '';
      }

      // Send the appeal email to the county
      const emailResult = await sendAppealFilingEmail({
        countyFilingEmail: countyRule.filing_email,
        clientEmail: report.client_email,
        clientName: report.client_name ?? null,
        propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
        parcelId: report.pin ?? null,
        countyName: countyRule.county_name,
        state: countyRule.state_name,
        appealBoardName: countyRule.appeal_board_name ?? null,
        assessedValue,
        concludedValue,
        potentialSavings,
        coverLetterText: coverLetterResult.data.guide,
        pdfUrl,
      });

      if (emailResult.error) {
        console.warn(`[stage6] Auto-filing email send failed: ${emailResult.error}`);
        return;
      }

      // Record the auto-filing on the report
      await supabase
        .from('reports')
        .update({
          filing_status: 'auto_filed',
          filing_method: 'auto_email',
          filed_at: new Date().toISOString(),
          auto_filing_resend_id: emailResult.data?.id ?? null,
        })
        .eq('id', reportId);

      // Mark form_submission as submitted
      await supabase
        .from('form_submissions')
        .update({ submission_status: 'submitted' })
        .eq('report_id', reportId);

      console.log(
        `[stage6] AUTO-FILED: Appeal sent to ${countyRule.filing_email} on behalf of ${report.client_email}. ` +
        `Email ID: ${emailResult.data?.id}. Savings at stake: $${potentialSavings.toLocaleString()}`
      );
    } catch (err) {
      console.warn(`[stage6] Auto-filing failed (non-fatal): ${err}`);
    }
    return; // email-filing takes precedence; don't also flag informal review
  }

  // ── Case B: Informal desk review available ───────────────────────────
  // Generate an informal review request script and email template.
  // Store as a separate narrative section so the client has a ready-to-use script.
  if (countyRule.informal_review_available) {
    try {
      const county = countyRule.county_name;
      const board = countyRule.appeal_board_name ?? 'the assessor\'s office';
      const savings = `$${potentialSavings.toLocaleString()}`;
      const informalScript = `## Informal Review Request Guide

An informal desk review is available in ${county} County — and most successful appeals are resolved at this stage, before a formal hearing is ever needed. We recommend requesting this first.

### Phone Script (call ${board})

> "Hello, my name is [YOUR NAME] and I'm calling about an informal review of my property assessment at ${[report.property_address, report.city, report.state].filter(Boolean).join(', ')}. I have a professional market analysis showing my property may be over-assessed by approximately ${savings}. I'd like to schedule an informal review before filing a formal appeal. Could you tell me the process for requesting that?"

${countyRule.informal_review_notes ? `\n**County-Specific Notes:** ${countyRule.informal_review_notes}\n` : ''}

### Email Template (send to ${board})

**Subject:** Informal Assessment Review Request — ${report.property_address}${report.pin ? ` — Parcel ${report.pin}` : ''}

Dear ${board},

I am writing to request an informal review of the assessed value for my property located at ${[report.property_address, report.city, report.state].filter(Boolean).join(', ')}${report.pin ? ` (Parcel No. ${report.pin})` : ''}.

I have obtained an independent market analysis which indicates the current assessed value may not reflect market conditions. The analysis, which includes comparable sales data${report.client_email ? '' : ' and property photographs'}, supports a market value of $${concludedValue.toLocaleString()} vs. the current assessed value of $${assessedValue.toLocaleString()}.

I would appreciate the opportunity to review these findings with your office before filing a formal appeal. Please let me know your availability and what documentation to bring.

Thank you for your time and consideration.

Sincerely,
[YOUR NAME]
[YOUR PHONE NUMBER]
[YOUR EMAIL]

---
*An independent market analysis is attached/available. Please contact me to schedule a review.*

### What to Bring
- A printed copy of your Resourceful analysis report (download from your report page)
- Your property tax bill showing the current assessed value
- Photos of any condition issues (from your uploaded photos)
- This script

### What to Say When You're There
State your case in 60 seconds or less: "My property is assessed at $${assessedValue.toLocaleString()}. I have market evidence showing the value is $${concludedValue.toLocaleString()} — a difference of ${savings}. I'd like to resolve this informally today."

Most informal reviews take 15-30 minutes. The assessor will either adjust the assessment on the spot or schedule a follow-up. Either way, you've started the clock.`;

      await supabase
        .from('report_narratives')
        .delete()
        .eq('report_id', reportId)
        .eq('section_name', 'informal_review_request');

      await supabase
        .from('report_narratives')
        .insert({
          report_id: reportId,
          section_name: 'informal_review_request',
          content: informalScript,
          model_used: 'system', // not AI-generated; template-based
          prompt_tokens: 0,
          completion_tokens: 0,
          generation_duration_ms: 0,
          admin_edited: false,
          admin_edited_content: null,
        });

      // Flag on the report so the admin dashboard can surface these cases
      await supabase
        .from('reports')
        .update({ informal_review_recommended: true })
        .eq('id', reportId);

      console.log(`[stage6] Informal review request generated for report ${reportId}`);
    } catch (err) {
      console.warn(`[stage6] Informal review script generation failed (non-fatal): ${err}`);
    }
  }

  // ── Case C: Online portal county ─────────────────────────────────────
  // No additional action needed — the filing guide already contains the portal URL
  // and step-by-step portal instructions. The form_submissions table already has
  // portal_ready status from Stage 5.
  if (countyRule.accepts_online_filing && countyRule.portal_url) {
    console.log(`[stage6] Online portal available at ${countyRule.portal_url} — filing kit ready in form_submissions`);
  }
}
