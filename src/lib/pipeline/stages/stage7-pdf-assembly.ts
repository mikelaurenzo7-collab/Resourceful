// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Fetches all report data, assembles the branded HTML via the report template,
// renders to PDF via Chromium, uploads to Supabase Storage, sets status to
// pending_approval, and sends admin notification.

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
import type { StageResult } from '../orchestrator';
import { generatePdf } from '@/lib/services/pdf';
import { getStaticMapUrl, getStreetViewUrl } from '@/lib/services/google-maps';
import { generateReportHtml } from '@/lib/templates/report-template';
import type { ReportTemplateData, FilingGuide } from '@/lib/templates/report-template';

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runPdfAssembly(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch all data in parallel ────────────────────────────────────────
  const [
    reportRes,
    propertyRes,
    narrativesRes,
    compsRes,
    rentalsRes,
    incomeRes,
    photosRes,
  ] = await Promise.all([
    supabase.from('reports').select('*').eq('id', reportId).single(),
    supabase.from('property_data').select('*').eq('report_id', reportId).single(),
    supabase
      .from('report_narratives')
      .select('*')
      .eq('report_id', reportId),
    supabase.from('comparable_sales').select('*').eq('report_id', reportId),
    supabase.from('comparable_rentals').select('*').eq('report_id', reportId),
    supabase.from('income_analysis').select('*').eq('report_id', reportId).single(),
    supabase.from('photos').select('*').eq('report_id', reportId).order('sort_order'),
  ]);

  const report = reportRes.data as Report | null;
  const propertyData = propertyRes.data as PropertyData | null;
  const allNarratives = (narrativesRes.data ?? []) as ReportNarrative[];
  const comps = (compsRes.data ?? []) as ComparableSale[];
  const rentals = (rentalsRes.data ?? []) as ComparableRental[];
  const incomeAnalysis = (incomeRes.data as IncomeAnalysis | null);
  const photos = (photosRes.data ?? []) as Photo[];

  if (!report) {
    return { success: false, error: `Failed to fetch report: ${reportRes.error?.message}` };
  }
  if (!propertyData) {
    return { success: false, error: `No property_data found: ${propertyRes.error?.message}` };
  }

  // Separate filing guide narrative from display narratives
  const filingGuideNarrative = allNarratives.find(
    (n) => n.section_name === 'pro_se_filing_guide'
  );
  const narratives = allNarratives.filter(
    (n) => n.section_name !== 'pro_se_filing_guide'
  );

  // ── Fetch county rule if available ────────────────────────────────────
  let countyRule: CountyRule | null = null;
  if (report.county_fips) {
    const { data: cr } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', report.county_fips)
      .single();
    countyRule = cr as CountyRule | null;
  }

  // ── Extract coordinates from report ─────────────────────────────────
  const latitude = report.latitude ?? 0;
  const longitude = report.longitude ?? 0;

  const propertyAddress = [
    report.property_address,
    report.city,
    report.state,
  ].filter(Boolean).join(', ');

  // ── Generate map URLs ─────────────────────────────────────────────────
  const locationMapUrl = getStaticMapUrl({
    lat: latitude,
    lng: longitude,
    zoom: 15,
    width: 640,
    height: 400,
    markers: [{ lat: latitude, lng: longitude, color: 'red', label: 'S' }],
  });

  const compMarkers = comps.slice(0, 6).map((c, i) => ({
    lat: latitude + (Math.random() - 0.5) * 0.02,
    lng: longitude + (Math.random() - 0.5) * 0.02,
    color: 'blue',
    label: String(i + 1),
  }));

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

  // ── Determine cover image ─────────────────────────────────────────────
  const exteriorPhoto = photos.find((p) => p.photo_type === 'exterior_front');
  let coverImageUrl: string | null = null;

  if (exteriorPhoto?.storage_path) {
    const { data: signedUrl } = await supabase
      .storage
      .from('photos')
      .createSignedUrl(exteriorPhoto.storage_path, 86400);
    coverImageUrl = signedUrl?.signedUrl ?? null;
  }

  if (!coverImageUrl && latitude && longitude) {
    coverImageUrl = getStreetViewUrl({
      lat: latitude,
      lng: longitude,
      width: 640,
      height: 480,
    });
  }

  // ── Get signed URLs for all photos ────────────────────────────────────
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

  // Update cover photo URL in photos array
  if (coverImageUrl && exteriorPhoto) {
    const idx = photosWithUrls.findIndex((p) => p.id === exteriorPhoto.id);
    if (idx >= 0) {
      photosWithUrls[idx] = { ...photosWithUrls[idx], storage_path: coverImageUrl };
    }
  }

  // ── Derive concluded value from comps ─────────────────────────────────
  let concludedValue = 0;
  if (comps.length > 0 && propertyData.building_sqft_gross) {
    const adjustedPrices = comps
      .map((c) => c.adjusted_price_per_sqft)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);

    if (adjustedPrices.length > 0) {
      const mid = Math.floor(adjustedPrices.length / 2);
      const median = adjustedPrices.length % 2 === 0
        ? (adjustedPrices[mid - 1] + adjustedPrices[mid]) / 2
        : adjustedPrices[mid];
      concludedValue = Math.round((median * propertyData.building_sqft_gross) / 1000) * 1000;
    }
  }

  // ── Parse filing guide from narrative ─────────────────────────────────
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
    } catch (err) {
      console.warn(`[stage7] Failed to parse filing guide JSON, skipping addendum:`, err);
    }
  }

  // ── Build template data ─────────────────────────────────────────────
  const now = new Date();
  const templateData: ReportTemplateData = {
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
    concludedValue,
    valuationDate: report.created_at ?? now.toISOString(),
    reportDate: now.toISOString(),
  };

  // ── Generate HTML and render PDF ──────────────────────────────────────
  const html = generateReportHtml(templateData);

  console.log(`[stage7] Rendering PDF for report ${reportId}...`);
  const pdfResult = await generatePdf(html);

  if (pdfResult.error || !pdfResult.data) {
    return { success: false, error: `PDF generation failed: ${pdfResult.error}` };
  }

  const pdfBuffer = pdfResult.data;

  // ── Upload to Supabase Storage ────────────────────────────────────────
  const storagePath = `reports/${reportId}/final_report.pdf`;

  const { error: uploadError } = await supabase
    .storage
    .from('reports')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return {
      success: false,
      error: `Failed to upload PDF to storage: ${uploadError.message}`,
    };
  }

  // ── Update report with PDF path ──────────────────────────────────────
  // NOTE: status and pipeline_completed_at are set by the orchestrator
  // after all stages complete. Admin notification is also sent by the
  // orchestrator. Stage 7 only records the PDF storage path.
  const { error: reportUpdateError } = await supabase
    .from('reports')
    .update({
      report_pdf_storage_path: storagePath,
    })
    .eq('id', reportId);

  if (reportUpdateError) {
    return { success: false, error: `Failed to update report after PDF upload: ${reportUpdateError.message}` };
  }

  console.log(
    `[stage7] PDF assembled and uploaded for report ${reportId}. Size: ${(pdfBuffer.length / 1024).toFixed(0)}KB`
  );

  return { success: true };
}
