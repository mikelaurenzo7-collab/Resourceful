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
  const filingGuideNarrative = allNarratives.find(n => n.section_name === 'pro_se_filing_guide');
  const narratives = allNarratives.filter(n => n.section_name !== 'pro_se_filing_guide');

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

  // Generate map URLs
  const latitude = report.latitude ?? 0;
  const longitude = report.longitude ?? 0;

  const locationMapUrl = getStaticMapUrl({
    lat: latitude,
    lng: longitude,
    zoom: 15,
    width: 640,
    height: 400,
    markers: [{ lat: latitude, lng: longitude, color: 'red', label: 'S' }],
  });

  const compMarkers = comps.slice(0, 6).map((c, i) => {
    const distDeg = (c.distance_miles ?? 1) * 0.0145;
    const angle = (i / Math.min(comps.length, 6)) * 2 * Math.PI;
    return {
      lat: latitude + distDeg * Math.cos(angle),
      lng: longitude + distDeg * Math.sin(angle),
      color: 'blue',
      label: String(i + 1),
    };
  });

  const compsMapUrl = getStaticMapUrl({
    lat: latitude,
    lng: longitude,
    zoom: 13,
    width: 640,
    height: 400,
    markers: [
      { lat: latitude, lng: longitude, color: 'red', label: 'S' },
      ...compMarkers,
    ],
  });

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

  // Parse filing guide
  let filingGuide: FilingGuide | null = null;
  if (filingGuideNarrative?.content && countyRule) {
    try {
      const parsed = JSON.parse(filingGuideNarrative.content);
      filingGuide = {
        appeal_board_name: parsed.appeal_board_name ?? countyRule.appeal_board_name ?? 'Board of Review',
        filing_deadline: parsed.filing_deadline ?? countyRule.appeal_deadline_rule ?? 'Contact your county',
        steps: parsed.steps ?? [],
        required_documents: parsed.required_documents ?? [],
        tips: parsed.tips ?? [],
        online_filing_url: parsed.online_filing_url ?? countyRule.portal_url,
        fee_amount: parsed.fee_amount ?? (countyRule.filing_fee_cents ? `$${(countyRule.filing_fee_cents / 100).toFixed(2)}` : null),
        hearing_format: parsed.hearing_format ?? countyRule.hearing_format,
      };
    } catch {
      // Filing guide parse failure is non-fatal for regeneration
      console.warn(`[pdf] Failed to parse filing guide for report ${reportId}`);
    }
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
      regional: { url: locationMapUrl, caption: 'Regional Location Map' },
      neighborhood: { url: compsMapUrl, caption: 'Comparable Sales Map' },
    },
    filingGuide,
    concludedValue: propertyData.concluded_value ?? 0,
    valuationDate: report.created_at ?? now.toISOString(),
    reportDate: now.toISOString(),
  };
}
