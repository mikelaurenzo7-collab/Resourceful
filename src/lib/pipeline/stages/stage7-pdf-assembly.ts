// ─── Stage 7: PDF Assembly ───────────────────────────────────────────────────
// Assembles the complete report HTML from template and narrative sections,
// generates Google Maps static/Street View URLs, renders to PDF via Chromium,
// uploads to Supabase Storage, sets status to pending_approval, and sends
// admin notification. Does NOT send anything to the client.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, ReportNarrative, ComparableSale, Photo } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { generatePdf } from '@/lib/services/pdf';
import { getStaticMapUrl, getStreetViewUrl } from '@/lib/services/google-maps';
import { sendAdminNotification } from '@/lib/services/resend-email';

// ─── Report Template ────────────────────────────────────────────────────────

function buildReportHtml(data: {
  reportId: string;
  propertyAddress: string;
  propertyType: string;
  serviceType: string;
  coverImageUrl: string;
  locationMapUrl: string;
  compsMapUrl: string;
  narrativeSections: Array<{
    sectionName: string;
    content: string;
  }>;
  comparableSales: Array<{
    address: string | null;
    salePrice: number | null;
    saleDate: string | null;
    buildingSqFt: number | null;
    adjustedPricePerSqFt: number | null;
    pricePerSqFt: number | null;
    distanceMiles: number | null;
    streetViewUrl: string | null;
  }>;
  photos: Array<{
    url: string | null;
    photoType: string | null;
    caption: string | null;
  }>;
  concludedValue: number;
  assessedValue: number;
  generatedDate: string;
}): string {
  const fmt = (v: number) =>
    `$${v.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  const narrativeHtml = data.narrativeSections
    .map(
      (s) => `
      <div class="section" style="page-break-inside: avoid;">
        <h2>${s.sectionName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</h2>
        <div class="narrative-content">${s.content}</div>
      </div>`
    )
    .join('\n');

  const compRowsHtml = data.comparableSales
    .map(
      (c) => `
      <tr>
        <td>${c.address ?? 'N/A'}</td>
        <td>${c.salePrice ? fmt(c.salePrice) : 'N/A'}</td>
        <td>${c.saleDate ?? 'N/A'}</td>
        <td>${c.buildingSqFt?.toLocaleString() ?? 'N/A'}</td>
        <td>${c.pricePerSqFt ? `$${c.pricePerSqFt.toFixed(2)}` : 'N/A'}</td>
        <td>${c.adjustedPricePerSqFt ? `$${c.adjustedPricePerSqFt.toFixed(2)}` : 'N/A'}</td>
        <td>${c.distanceMiles?.toFixed(1) ?? 'N/A'} mi</td>
      </tr>`
    )
    .join('\n');

  const photosHtml = data.photos
    .filter((p) => p.url)
    .map(
      (p) => `
      <div class="photo-item">
        <img src="${p.url}" alt="${p.photoType ?? 'photo'}" style="max-width: 100%; height: auto;" />
        <p class="photo-caption">${p.caption ?? p.photoType ?? ''}</p>
      </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: letter;
      margin: 1in;
    }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 100%;
    }
    h1 { font-size: 22pt; color: #1a365d; margin-bottom: 4pt; }
    h2 { font-size: 14pt; color: #2c5282; border-bottom: 1px solid #cbd5e0; padding-bottom: 4pt; margin-top: 24pt; }
    h3 { font-size: 12pt; color: #2d3748; }
    .cover-page {
      text-align: center;
      page-break-after: always;
      padding-top: 2in;
    }
    .cover-page img {
      max-width: 100%;
      max-height: 4in;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 24pt;
    }
    .cover-page .title { font-size: 28pt; color: #1a365d; margin-bottom: 8pt; }
    .cover-page .subtitle { font-size: 14pt; color: #4a5568; }
    .cover-page .meta { font-size: 10pt; color: #718096; margin-top: 32pt; }
    .summary-box {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 16pt;
      margin: 16pt 0;
    }
    .summary-box table { width: 100%; border-collapse: collapse; }
    .summary-box td { padding: 4pt 8pt; }
    .summary-box .label { color: #4a5568; width: 50%; }
    .summary-box .value { text-align: right; font-weight: bold; }
    table.comp-grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin: 12pt 0;
    }
    table.comp-grid th, table.comp-grid td {
      border: 1px solid #cbd5e0;
      padding: 4pt 6pt;
      text-align: left;
    }
    table.comp-grid th { background: #edf2f7; font-weight: 600; }
    .section { margin-bottom: 16pt; }
    .narrative-content { white-space: pre-wrap; }
    .maps-section { page-break-before: always; }
    .maps-section img { max-width: 100%; margin: 8pt 0; }
    .photo-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12pt;
      page-break-inside: avoid;
    }
    .photo-item { text-align: center; }
    .photo-caption { font-size: 9pt; color: #4a5568; margin-top: 4pt; }
    .footer {
      font-size: 8pt;
      color: #a0aec0;
      text-align: center;
      margin-top: 32pt;
      border-top: 1px solid #e2e8f0;
      padding-top: 8pt;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <img src="${data.coverImageUrl}" alt="Subject Property" />
    <div class="title">Property Assessment Report</div>
    <div class="subtitle">${data.propertyAddress}</div>
    <div class="meta">
      <p>Service: ${data.serviceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>
      <p>Property Type: ${data.propertyType.replace(/\b\w/g, (c) => c.toUpperCase())}</p>
      <p>Date: ${data.generatedDate}</p>
      <p>Report ID: ${data.reportId.slice(0, 8).toUpperCase()}</p>
    </div>
  </div>

  <!-- Value Summary -->
  <div class="summary-box">
    <h3>Value Summary</h3>
    <table>
      <tr>
        <td class="label">Current Assessed Value</td>
        <td class="value">${fmt(data.assessedValue)}</td>
      </tr>
      <tr>
        <td class="label">Concluded Market Value</td>
        <td class="value">${fmt(data.concludedValue)}</td>
      </tr>
      <tr>
        <td class="label">Potential Reduction</td>
        <td class="value" style="color: ${data.assessedValue > data.concludedValue ? '#38a169' : '#1a1a1a'}">
          ${data.assessedValue > data.concludedValue ? fmt(data.assessedValue - data.concludedValue) : 'N/A'}
        </td>
      </tr>
    </table>
  </div>

  <!-- Narrative Sections -->
  ${narrativeHtml}

  <!-- Comparable Sales Grid -->
  <div class="section" style="page-break-before: always;">
    <h2>Comparable Sales Summary</h2>
    <table class="comp-grid">
      <thead>
        <tr>
          <th>Address</th>
          <th>Sale Price</th>
          <th>Sale Date</th>
          <th>Sq Ft</th>
          <th>$/Sq Ft</th>
          <th>Adj $/Sq Ft</th>
          <th>Distance</th>
        </tr>
      </thead>
      <tbody>
        ${compRowsHtml}
      </tbody>
    </table>
  </div>

  <!-- Maps -->
  <div class="maps-section">
    <h2>Location Maps</h2>
    <img src="${data.locationMapUrl}" alt="Property Location" />
    <img src="${data.compsMapUrl}" alt="Comparable Sales Map" />
  </div>

  <!-- Photos -->
  ${photosHtml ? `
  <div class="section" style="page-break-before: always;">
    <h2>Property Photos</h2>
    <div class="photo-grid">
      ${photosHtml}
    </div>
  </div>` : ''}

  <div class="footer">
    <p>This report was prepared for property tax assessment purposes. It is not a certified appraisal.</p>
    <p>Generated by Resourceful &mdash; ${data.generatedDate}</p>
  </div>
</body>
</html>`;
}

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runPdfAssembly(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch all data in parallel ────────────────────────────────────────
  const [reportRes, propertyRes, narrativesRes, compsRes, photosRes] =
    await Promise.all([
      supabase.from('reports').select('*').eq('id', reportId).single(),
      supabase.from('property_data').select('*').eq('report_id', reportId).single(),
      supabase
        .from('report_narratives')
        .select('*')
        .eq('report_id', reportId)
        .neq('section_name', 'pro_se_filing_guide'),
      supabase.from('comparable_sales').select('*').eq('report_id', reportId),
      supabase.from('photos').select('*').eq('report_id', reportId).order('sort_order'),
    ]);

  const report = reportRes.data as Report | null;
  const propertyData = propertyRes.data as PropertyData | null;
  const narratives = (narrativesRes.data ?? []) as ReportNarrative[];
  const comps = (compsRes.data ?? []) as ComparableSale[];
  const photos = (photosRes.data ?? []) as Photo[];

  if (!report) {
    return { success: false, error: `Failed to fetch report: ${reportRes.error?.message}` };
  }
  if (!propertyData) {
    return { success: false, error: `No property_data found: ${propertyRes.error?.message}` };
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

  // Comps map with subject + comp markers
  const compMarkers = comps.slice(0, 6).map((c, i) => ({
    lat: latitude + (Math.random() - 0.5) * 0.02, // approx; real impl would use comp geocodes
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
  // Use user's front exterior photo if available, otherwise Street View
  const exteriorPhoto = photos.find((p) => p.photo_type === 'exterior_front');
  let coverImageUrl: string | null = null;

  if (exteriorPhoto?.storage_path) {
    const { data: signedUrl } = await supabase
      .storage
      .from('photos')
      .createSignedUrl(exteriorPhoto.storage_path, 86400); // 24 hours
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
  const photoItems = await Promise.all(
    photos.map(async (p) => {
      let url: string | null = null;
      if (p.storage_path) {
        const { data: signedUrl } = await supabase
          .storage
          .from('photos')
          .createSignedUrl(p.storage_path, 86400);
        url = signedUrl?.signedUrl ?? null;
      }
      return {
        url,
        photoType: p.photo_type,
        caption: p.caption,
      };
    })
  );

  // ── Build comparable sales for template ───────────────────────────────
  const compItems = comps.map((c) => ({
    address: c.address,
    salePrice: c.sale_price,
    saleDate: c.sale_date,
    buildingSqFt: c.building_sqft,
    adjustedPricePerSqFt: c.adjusted_price_per_sqft,
    pricePerSqFt: c.price_per_sqft,
    distanceMiles: c.distance_miles,
    streetViewUrl: c.comparable_photo_url,
  }));

  // ── Assemble HTML ─────────────────────────────────────────────────────
  const assessedValue = propertyData.assessed_value ?? 0;

  // Derive concluded value from comps
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

  const html = buildReportHtml({
    reportId,
    propertyAddress,
    propertyType: report.property_type ?? 'residential',
    serviceType: report.service_type ?? 'tax_appeal',
    coverImageUrl: coverImageUrl ?? '',
    locationMapUrl,
    compsMapUrl,
    narrativeSections: narratives.map((n) => ({
      sectionName: n.section_name,
      content: n.content ?? '',
    })),
    comparableSales: compItems,
    photos: photoItems,
    concludedValue,
    assessedValue,
    generatedDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  });

  // ── Render PDF ────────────────────────────────────────────────────────
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

  // ── Update report ─────────────────────────────────────────────────────
  await supabase
    .from('reports')
    .update({
      report_pdf_storage_path: storagePath,
      status: 'pending_approval',
      pipeline_completed_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  // ── Send admin notification ───────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.resourceful.com';
  const reviewUrl = `${appUrl}/admin/reports/${reportId}`;

  const notifResult = await sendAdminNotification({
    reportId,
    propertyAddress,
    propertyType: report.property_type ?? 'residential',
    reviewUrl,
  });

  if (notifResult.error) {
    // Non-fatal: log but don't fail the pipeline
    console.warn(`[stage7] Admin notification failed: ${notifResult.error}`);
  }

  console.log(
    `[stage7] PDF assembled and uploaded for report ${reportId}. Size: ${(pdfBuffer.length / 1024).toFixed(0)}KB`
  );

  return { success: true };
}
