// ─── Fetch Report Template Data ──────────────────────────────────────────────
// Shared data-fetching logic used by both Stage 7 and the on-demand PDF
// regeneration endpoint. Extracts all data needed to render a PDF.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Report,
  PropertyData,
  ReportNarrative,
  ComparableSale,
  ComparableRental,
  IncomeAnalysis,
  CountyRule,
  Photo,
} from '@/types/database';
import { getStaticMapUrl } from '@/lib/services/azure-maps';
import type { ReportTemplateData, FilingGuide } from '@/lib/templates/report-template';
import { logger } from '@/lib/logger';

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asHttpUrl(value: unknown): string | null {
  const candidate = asNonEmptyString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function stripMarkdownPrefix(line: string): string {
  return line
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|step\s+\d+[:.)-]?\s*)/i, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function extractLegacySteps(content: string): string[] {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:\d+[.)]\s+|step\s+\d+[:.)-]?\s*)/i.test(line))
    .map(stripMarkdownPrefix)
    .filter(Boolean)
    .slice(0, 14);
}

function extractLegacyBullets(content: string): string[] {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*+]\s+/.test(line))
    .map(stripMarkdownPrefix)
    .filter(Boolean)
    .slice(0, 18);
}

function formatCountyFee(countyRule: CountyRule | null): string | null {
  if (!countyRule) return null;
  if (countyRule.filing_fee_cents === 0) return '$0.00';
  if (countyRule.filing_fee_cents > 0) {
    return `$${(countyRule.filing_fee_cents / 100).toFixed(2)}`;
  }
  return null;
}

function countyBoardName(report: Report, countyRule: CountyRule | null): string {
  return countyRule?.appeal_board_name
    ?? (report.county
      ? `${report.county} property assessment appeal authority — verify official name`
      : 'Local property assessment appeal authority — verify official name');
}

function countyDeadline(countyRule: CountyRule | null): string {
  return countyRule?.next_appeal_deadline
    ?? countyRule?.appeal_deadline_rule
    ?? countyRule?.tax_year_appeal_window
    ?? 'Verify the current filing deadline with the jurisdiction before submitting.';
}

function defaultFilingSteps(): string[] {
  return [
    'Verify eligibility, the current appeal deadline, and the correct filing authority before preparing the submission.',
    'Obtain the jurisdiction’s current official form and instructions directly from the filing authority.',
    'Complete every required field using the assessed value, requested value, owner information, and parcel identifier in the workfile.',
    'Assemble the valuation report, comparable or alternative-approach evidence, property records, photographs, and required supporting documents.',
    'Submit through an approved channel and retain a confirmation number, timestamp, accepted-email record, or proof of mailing.',
    'Prepare an evidence order, concise opening statement, likely-question responses, and requested value for any informal review or hearing.',
    'Verify the next appeal level and deadline after the decision is issued.',
  ];
}

function hasValidCoordinates(latitude: number | null, longitude: number | null): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return latitude !== 0 || longitude !== 0;
}

export function parseStructuredFilingGuide(
  content: string,
  report: Report,
  countyRule: CountyRule | null
): FilingGuide | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const steps = asStringArray(parsed.steps);
    if (steps.length === 0) return null;

    const requiredDocuments = asStringArray(parsed.required_documents);
    const tips = asStringArray(parsed.tips);

    return {
      appeal_board_name: countyRule?.appeal_board_name
        ?? asNonEmptyString(parsed.appeal_board_name)
        ?? countyBoardName(report, countyRule),
      filing_deadline: asNonEmptyString(parsed.filing_deadline) ?? countyDeadline(countyRule),
      steps,
      required_documents: requiredDocuments.length > 0
        ? requiredDocuments
        : countyRule?.required_documents ?? countyRule?.evidence_requirements ?? [],
      tips: tips.length > 0
        ? tips
        : uniqueStrings([
            countyRule?.pro_se_tips,
            'Verify all deadlines, forms, fees, signatures, notarization rules, and submission channels directly with the jurisdiction.',
            'Resourceful provides informational filing support and valuation analysis, not legal advice.',
          ]),
      online_filing_url: asHttpUrl(countyRule?.portal_url) ?? asHttpUrl(parsed.online_filing_url),
      fee_amount: formatCountyFee(countyRule) ?? asNonEmptyString(parsed.fee_amount),
      hearing_format: countyRule?.hearing_format ?? asNonEmptyString(parsed.hearing_format),
    };
  } catch {
    return null;
  }
}

export function recoverLegacyFilingGuide(
  content: string,
  report: Report,
  countyRule: CountyRule | null
): FilingGuide {
  const countySteps = [...(countyRule?.filing_steps ?? [])]
    .sort((a, b) => a.step_number - b.step_number)
    .map((step) => `${step.title}: ${step.description}`.trim());
  const narrativeSteps = extractLegacySteps(content);
  const narrativeBullets = extractLegacyBullets(content);
  const steps = countySteps.length > 0
    ? countySteps
    : narrativeSteps.length > 0
      ? narrativeSteps
      : defaultFilingSteps();

  const requiredDocuments = countyRule?.required_documents
    ?? countyRule?.evidence_requirements
    ?? ['Confirm the jurisdiction’s current required documents before filing.'];

  const tips = uniqueStrings([
    countyRule?.pro_se_tips,
    ...narrativeBullets,
    'Verify all deadlines, forms, fees, signatures, notarization rules, and submission channels directly with the jurisdiction.',
    'Retain proof of filing and every version of the submitted evidence package.',
    'Resourceful provides informational filing support and valuation analysis, not legal advice.',
  ]).slice(0, 20);

  logger.warn(
    { reportId: report.id, countyFips: report.county_fips },
    'Recovered legacy Markdown filing guide using jurisdiction data and checklist extraction'
  );

  return {
    appeal_board_name: countyBoardName(report, countyRule),
    filing_deadline: countyDeadline(countyRule),
    steps,
    required_documents: requiredDocuments,
    tips,
    online_filing_url: asHttpUrl(countyRule?.portal_url),
    fee_amount: formatCountyFee(countyRule),
    hearing_format: countyRule?.hearing_format ?? null,
  };
}

/**
 * Fetch all data needed to render a report PDF.
 * Returns null if the report or required data is missing.
 */
export async function fetchReportTemplateData(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<ReportTemplateData | null> {
  // Fetch all data in parallel
  const [reportRes, propertyRes, narrativesRes, compsRes, rentalsRes, incomeRes, photosRes] =
    await Promise.all([
      supabase.from('reports').select('*').eq('id', reportId).single(),
      supabase.from('property_data').select('*').eq('report_id', reportId).single(),
      supabase.from('report_narratives').select('*').eq('report_id', reportId),
      supabase.from('comparable_sales').select('*').eq('report_id', reportId),
      supabase.from('comparable_rentals').select('*').eq('report_id', reportId),
      supabase.from('income_analysis').select('*').eq('report_id', reportId).single(),
      supabase.from('photos').select('*').eq('report_id', reportId).order('sort_order'),
    ]);

  const report = reportRes.data as Report | null;
  const propertyData = propertyRes.data as PropertyData | null;

  if (!report || !propertyData) return null;

  const allNarratives = (narrativesRes.data ?? []) as ReportNarrative[];
  const comps = (compsRes.data ?? []) as ComparableSale[];
  const rentals = (rentalsRes.data ?? []) as ComparableRental[];
  const incomeAnalysis = incomeRes.data as IncomeAnalysis | null;
  const photos = (photosRes.data ?? []) as Photo[];

  // Separate filing guide from display narratives
  const filingGuideNarrative = allNarratives.find((n) => n.section_name === 'pro_se_filing_guide');
  const narratives = allNarratives.filter((n) => n.section_name !== 'pro_se_filing_guide');

  // Fetch county rule
  let countyRule: CountyRule | null = null;
  if (report.county_fips) {
    const { data: cr } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', report.county_fips)
      .limit(1);
    countyRule = (cr?.[0] as CountyRule) ?? null;
  }

  // Render only verified subject coordinates. Comparable-sale rows currently do
  // not carry source coordinates, so Resourceful must not invent marker positions.
  const locationMapUrl = hasValidCoordinates(report.latitude, report.longitude)
    ? getStaticMapUrl({
        lat: report.latitude!,
        lng: report.longitude!,
        zoom: 15,
        width: 640,
        height: 400,
        markers: [
          {
            lat: report.latitude!,
            lng: report.longitude!,
            color: 'red',
            label: 'S',
          },
        ],
      })
    : '';

  // Get signed URLs for photos
  const photosWithUrls = await Promise.all(
    photos.map(async (p) => {
      if (p.storage_path) {
        const { data: signedUrl } = await supabase
          .storage
          .from('photos')
          .createSignedUrl(p.storage_path, 86400);
        return { ...p, storage_path: signedUrl?.signedUrl ?? p.storage_path };
      }
      return p;
    })
  );

  // Parse the current structured guide or recover older Markdown guides.
  let filingGuide: FilingGuide | null = null;
  if (filingGuideNarrative?.content) {
    filingGuide = parseStructuredFilingGuide(filingGuideNarrative.content, report, countyRule)
      ?? recoverLegacyFilingGuide(filingGuideNarrative.content, report, countyRule);
  }

  const now = new Date();

  return {
    report,
    property: propertyData,
    photos: photosWithUrls,
    comparableSales: comps,
    comparableRentals: rentals,
    incomeAnalysis,
    narratives,
    countyRule,
    maps: {
      regional: locationMapUrl
        ? { url: locationMapUrl, caption: 'Verified Subject Location Map' }
        : undefined,
    },
    filingGuide,
    concludedValue: propertyData.concluded_value ?? 0,
    valuationDate: report.created_at ?? now.toISOString(),
    reportDate: now.toISOString(),
  };
}
