// ─── Report PDF Template ─────────────────────────────────────────────────────
// Generates the complete HTML string that Puppeteer renders to PDF.
// The output must be indistinguishable from a professionally typeset
// appraisal report: correct typography, precise layout, proper page breaks,
// and production-quality styling throughout.
//
// Design principles:
//   - Every element in a block-level container (no overlap)
//   - No absolute/fixed positioning over text
//   - Inline styles for Puppeteer reliability
//   - @page CSS for margins, page numbering
//   - Google Fonts via @import for Playfair Display

import type {
  Report,
  PropertyData,
  Photo,
  ComparableSale,
  ComparableRental,
  IncomeAnalysis,
  ReportNarrative,
  CountyRule,
} from '@/types/database';

import {
  formatCurrency,
  formatCurrencyWords,
  formatDate,
  formatDateShort,
  formatPercent,
  formatSqFt,
  formatLotSize,
  formatNumber,
  getConditionColor,
  escapeHtml,
  imageOrPlaceholder,
  formatPropertyType,
  formatHearingFormat,
  fullAddress,
  adjustmentLabel,
  safeVal,
} from './helpers';

// ─── Data Interface ──────────────────────────────────────────────────────────

export interface MapImage {
  url: string;
  caption: string;
}

export interface FilingGuide {
  appeal_board_name: string;
  filing_deadline: string;
  steps: string[];
  required_documents: string[];
  tips: string[];
  online_filing_url?: string | null;
  fee_amount?: string | null;
  hearing_format?: string | null;
}

export interface ReportTemplateData {
  report: Report;
  property: PropertyData;
  photos: Photo[];
  comparableSales: ComparableSale[];
  comparableRentals: ComparableRental[];
  incomeAnalysis: IncomeAnalysis | null;
  narratives: ReportNarrative[];
  countyRule: CountyRule | null;
  maps: {
    regional?: MapImage;
    neighborhood?: MapImage;
    parcel?: MapImage;
  };
  filingGuide: FilingGuide | null;
  concludedValue: number;
  valuationDate: string;
  reportDate: string;
  preparedBy?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = '#1a2744';
const RED = '#b71c1c';
const BODY_TEXT = '#1a1a1a';
const LIGHT_BG = '#f8f9fa';
const TABLE_ALT = '#f5f7fa';
const TABLE_BORDER = '#d0d5dd';
const PLATFORM_NAME = 'PROPERTY INTELLIGENCE';

// ─── Adjustment Row Categories ───────────────────────────────────────────────
// Individual adjustment fields are defined on ComparableSale as
// adjustment_pct_* columns. The renderAdjustmentGrid function reads
// them directly from the typed interface.

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate the complete HTML document for the appraisal report PDF.
 * The returned string is a self-contained HTML page with embedded styles,
 * fonts, and all content ready for Puppeteer rendering.
 */
export function generateReportHtml(data: ReportTemplateData): string {
  const {
    report,
    property,
    photos,
    comparableSales,
    comparableRentals,
    incomeAnalysis,
    narratives,
    countyRule,
    maps,
    filingGuide,
    concludedValue,
    valuationDate,
    reportDate,
  } = data;

  const addr = fullAddress(
    report.property_address,
    null,
    report.city ?? '',
    report.state ?? '',
    ''
  );

  const narrativeMap = new Map<string, ReportNarrative>();
  for (const n of narratives) {
    narrativeMap.set(n.section_name, n);
  }

  const subjectPhoto = photos.find(
    (p) => p.photo_type === 'front_exterior' || p.photo_type === 'street_view'
  );

  // Determine which sections to render
  const hasIncome =
    incomeAnalysis != null &&
    (report.property_type === 'commercial' || report.property_type === 'industrial');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Appraisal Report - ${escapeHtml(addr)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700&display=swap');

  /* ── Page Setup ──────────────────────────────────────────────── */
  @page {
    size: Letter;
    margin: 1in;
  }

  /* Cover page: no page number */
  @page :first {
    @bottom-center { content: none; }
    @bottom-right { content: none; }
  }

  /* ── CSS Counter for Page Numbers ─────────────────────────────── */
  html {
    counter-reset: page-number;
  }

  /* ── Base Reset ──────────────────────────────────────────────── */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Times New Roman', Times, Georgia, serif;
    font-size: 11pt;
    line-height: 1.6;
    color: ${BODY_TEXT};
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Typography ──────────────────────────────────────────────── */
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    color: ${NAVY};
    line-height: 1.3;
    page-break-after: avoid;
  }

  h1 { font-size: 26pt; font-weight: 700; }
  h2 { font-size: 16pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  h3 { font-size: 13pt; font-weight: 500; font-style: italic; }
  h4 { font-size: 11pt; font-weight: 600; }

  p {
    margin-bottom: 0.6em;
    text-align: justify;
    orphans: 3;
    widows: 3;
  }

  /* ── Numerical Data ──────────────────────────────────────────── */
  .num {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  .num-right {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums;
    text-align: right;
    letter-spacing: -0.01em;
  }

  /* ── Tables ──────────────────────────────────────────────────── */
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin-bottom: 1em;
    page-break-inside: auto;
  }

  th, td {
    padding: 6px 10px;
    border: 1px solid ${TABLE_BORDER};
    font-size: 10pt;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  th {
    background-color: ${NAVY};
    color: #ffffff;
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-weight: 600;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    text-align: left;
  }

  tr:nth-child(even) td {
    background-color: ${TABLE_ALT};
  }

  tr {
    page-break-inside: avoid;
  }

  /* ── Page Breaks ─────────────────────────────────────────────── */
  .page-break {
    page-break-before: always;
  }

  .avoid-break {
    page-break-inside: avoid;
  }

  /* ── Section Headers ─────────────────────────────────────────── */
  .section-header {
    margin-bottom: 1em;
    padding-bottom: 0.3em;
    border-bottom: 2px solid ${NAVY};
  }

  .section-header h2 {
    margin: 0;
    padding: 0;
  }

  /* ── Image Containers ────────────────────────────────────────── */
  .img-container {
    display: block;
    overflow: hidden;
    border: 1px solid ${TABLE_BORDER};
    margin-bottom: 0.5em;
    page-break-inside: avoid;
  }

  .img-container img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }

  .img-caption {
    display: block;
    padding: 4px 8px;
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    color: #555;
    background: #fafafa;
    border-top: 1px solid ${TABLE_BORDER};
    text-align: center;
  }

  /* ── Photo Grid ──────────────────────────────────────────────── */
  .photo-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 1em;
  }

  .photo-grid .photo-cell {
    flex: 0 0 calc(50% - 6px);
    max-width: calc(50% - 6px);
    page-break-inside: avoid;
  }

  .photo-cell .img-container {
    height: 220px;
  }

  .photo-cell .img-container img {
    height: 100%;
    object-fit: cover;
  }

  /* ── Value Box ───────────────────────────────────────────────── */
  .value-box {
    border: 2px solid ${RED};
    padding: 16px 20px;
    margin: 1.2em 0;
    text-align: center;
    page-break-inside: avoid;
  }

  .value-box .value-label {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 11pt;
    font-weight: 600;
    color: ${NAVY};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  .value-box .value-amount {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums;
    font-size: 28pt;
    font-weight: 700;
    color: ${RED};
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .value-box .value-words {
    font-family: 'Times New Roman', Times, serif;
    font-size: 10pt;
    font-style: italic;
    color: #555;
  }

  /* ── Key Facts Grid ──────────────────────────────────────────── */
  .facts-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    margin-bottom: 1em;
    border: 1px solid ${TABLE_BORDER};
  }

  .facts-grid .fact-item {
    flex: 0 0 50%;
    max-width: 50%;
    padding: 8px 12px;
    border-bottom: 1px solid ${TABLE_BORDER};
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .facts-grid .fact-item:nth-child(odd) {
    border-right: 1px solid ${TABLE_BORDER};
  }

  .fact-label {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #666;
    flex: 0 0 130px;
    min-width: 130px;
  }

  .fact-value {
    font-size: 10.5pt;
    color: ${BODY_TEXT};
    font-weight: 500;
  }

  /* ── Comparable Card ─────────────────────────────────────────── */
  .comp-card {
    border: 1px solid ${TABLE_BORDER};
    margin-bottom: 1.2em;
    page-break-inside: avoid;
  }

  .comp-card-header {
    background: ${NAVY};
    color: #fff;
    padding: 8px 12px;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 11pt;
    font-weight: 600;
  }

  .comp-card-photo {
    width: 100%;
    height: 180px;
    overflow: hidden;
    border-bottom: 1px solid ${TABLE_BORDER};
  }

  .comp-card-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .comp-card-body {
    padding: 0;
  }

  .comp-card-body table {
    margin: 0;
    border: none;
  }

  .comp-card-body table td,
  .comp-card-body table th {
    border-left: none;
    border-right: none;
  }

  .comp-card-body table tr:first-child td,
  .comp-card-body table tr:first-child th {
    border-top: none;
  }

  .comp-card-comments {
    padding: 8px 12px;
    font-size: 9.5pt;
    color: #444;
    border-top: 1px solid ${TABLE_BORDER};
    background: ${LIGHT_BG};
  }

  /* ── Adjustment Grid ─────────────────────────────────────────── */
  .adj-grid th {
    font-size: 8pt;
    padding: 5px 6px;
    text-align: center;
  }

  .adj-grid td {
    font-size: 9pt;
    padding: 4px 6px;
    text-align: center;
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums;
  }

  .adj-grid .row-label {
    text-align: left;
    font-family: 'Times New Roman', Times, serif;
    font-weight: 500;
    font-size: 9.5pt;
  }

  .adj-grid .group-header td {
    background: #e8ecf1;
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    text-align: left;
    color: ${NAVY};
    border-bottom: 2px solid ${NAVY};
  }

  .adj-grid .total-row td {
    background: #e0e6ed;
    font-weight: 700;
    border-top: 2px solid ${NAVY};
    font-size: 9.5pt;
  }

  .adj-grid .final-row td {
    background: ${NAVY};
    color: #ffffff;
    font-weight: 700;
    font-size: 10pt;
  }

  .adj-positive { color: #2e7d32; }
  .adj-negative { color: ${RED}; }

  /* ── Filing Guide / Addendum ─────────────────────────────────── */
  .filing-guide {
    background: ${LIGHT_BG};
    padding: 0;
  }

  .filing-guide .guide-header {
    background: #2e5090;
    color: #ffffff;
    padding: 16px 20px;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 16pt;
    font-weight: 600;
    margin-bottom: 0;
  }

  .filing-guide .guide-body {
    padding: 20px 24px;
  }

  .filing-guide .deadline-box {
    background: #ffffff;
    border: 2px solid ${RED};
    border-left: 6px solid ${RED};
    padding: 14px 18px;
    margin-bottom: 1.2em;
    page-break-inside: avoid;
  }

  .filing-guide .deadline-box .deadline-label {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${RED};
    margin-bottom: 2px;
  }

  .filing-guide .deadline-box .deadline-date {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 18pt;
    font-weight: 700;
    color: ${NAVY};
  }

  .filing-guide ol {
    padding-left: 1.5em;
    margin-bottom: 1em;
  }

  .filing-guide ol li {
    margin-bottom: 0.8em;
    line-height: 1.6;
    font-size: 10.5pt;
  }

  .filing-guide ul {
    list-style: disc;
    padding-left: 1.5em;
    margin-bottom: 1em;
  }

  .filing-guide ul li {
    margin-bottom: 0.4em;
    font-size: 10.5pt;
    line-height: 1.5;
  }

  .filing-guide .tip-box {
    background: #e8f5e9;
    border-left: 4px solid #2e7d32;
    padding: 10px 14px;
    margin-bottom: 0.8em;
    font-size: 10pt;
    page-break-inside: avoid;
  }

  /* ── Cover Page ──────────────────────────────────────────────── */
  .cover-page {
    display: flex;
    flex-direction: column;
    min-height: 9in;
    page-break-after: always;
  }

  .cover-logo {
    text-align: center;
    padding: 20px 0 10px;
  }

  .cover-logo .logo-text {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 4px;
    color: ${RED};
    text-transform: uppercase;
  }

  .cover-logo .logo-bar {
    display: block;
    width: 60px;
    height: 3px;
    background: ${RED};
    margin: 8px auto 0;
  }

  .cover-title {
    text-align: center;
    margin: 30px 0 20px;
  }

  .cover-title h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 32pt;
    font-weight: 700;
    color: ${NAVY};
    margin-bottom: 6px;
  }

  .cover-title .cover-subtitle {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 9pt;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #888;
  }

  .cover-photo {
    width: 100%;
    height: 340px;
    overflow: hidden;
    border: 1px solid ${TABLE_BORDER};
    margin: 10px 0;
  }

  .cover-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-details {
    text-align: center;
    margin: 20px 0;
    flex: 1;
  }

  .cover-address {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 16pt;
    font-weight: 700;
    color: ${NAVY};
    margin-bottom: 4px;
  }

  .cover-prop-type {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #666;
    margin-bottom: 18px;
  }

  .cover-dates {
    display: flex;
    justify-content: center;
    gap: 40px;
    margin-top: 10px;
  }

  .cover-date-item {
    text-align: center;
  }

  .cover-date-label {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    margin-bottom: 2px;
  }

  .cover-date-value {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 11pt;
    font-weight: 600;
    color: ${NAVY};
  }

  .cover-footer {
    text-align: center;
    padding: 16px 0;
    border-top: 1px solid ${TABLE_BORDER};
    margin-top: auto;
  }

  .cover-footer .footer-brand {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 8pt;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: ${RED};
    font-weight: 700;
  }

  .cover-footer .footer-contact {
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-size: 8pt;
    color: #999;
    margin-top: 2px;
  }

  /* ── Income Table ────────────────────────────────────────────── */
  .income-table td:last-child,
  .income-table th:last-child {
    text-align: right;
    font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums;
  }

  /* ── Print-specific ──────────────────────────────────────────── */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

${renderCoverPage(data, addr, subjectPhoto)}

${renderSummarySection(data, addr, subjectPhoto, photos, narrativeMap)}

${renderNarrativeSection('property_description', 'II', 'Property Description', narrativeMap)}

${renderNarrativeSection('site_description_narrative', 'III', 'Site Description', narrativeMap)}

${renderNarrativeSection('improvement_description_narrative', 'IV', 'Improvement Description', narrativeMap)}

${renderNarrativeSection('area_analysis_county', 'V-A', 'Area Analysis — County', narrativeMap)}

${renderNarrativeSection('area_analysis_city', 'V-B', 'Area Analysis — City', narrativeMap)}

${renderNarrativeSection('area_analysis_neighborhood', 'V-C', 'Area Analysis — Neighborhood', narrativeMap)}

${renderNarrativeSection('market_analysis', 'VI', 'Market Analysis', narrativeMap)}

${renderNarrativeSection('hbu_as_vacant', 'VII-A', 'Highest & Best Use — As Vacant', narrativeMap)}

${renderNarrativeSection('hbu_as_improved', 'VII-B', 'Highest & Best Use — As Improved', narrativeMap)}

${renderSalesComparisonSection(data, comparableSales, narrativeMap)}

${hasIncome ? renderIncomeSection(data, incomeAnalysis!, comparableRentals, narrativeMap) : ''}

${renderReconciliationSection(data, narrativeMap)}

${filingGuide ? renderFilingGuideAddendum(filingGuide) : ''}

</body>
</html>`;
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function renderCoverPage(
  data: ReportTemplateData,
  addr: string,
  subjectPhoto: Photo | undefined
): string {
  const { report, valuationDate, reportDate } = data;

  const photoUrl = subjectPhoto?.storage_path;
  const photoHtml = photoUrl
    ? `<div class="cover-photo"><img src="${escapeHtml(photoUrl)}" alt="Subject Property"></div>`
    : `<div class="cover-photo" style="background:${imageOrPlaceholder(null)}; display:flex; align-items:center; justify-content:center;">
        <span style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:10pt; color:#999;">Subject Property Photo</span>
      </div>`;

  return `
  <div class="cover-page">
    <div class="cover-logo">
      <div class="logo-text">${PLATFORM_NAME}</div>
      <span class="logo-bar"></span>
    </div>

    <div class="cover-title">
      <h1>Appraisal Report</h1>
      <div class="cover-subtitle">Market Value Analysis</div>
    </div>

    ${photoHtml}

    <div class="cover-details">
      <div class="cover-address">${escapeHtml(report.property_address)}</div>
      <div class="cover-prop-type">
        ${escapeHtml(report.city ?? '')}, ${escapeHtml(report.state ?? '')}
        &nbsp;&mdash;&nbsp;
        ${escapeHtml(formatPropertyType(report.property_type ?? ''))} Property
      </div>

      <div class="cover-dates">
        <div class="cover-date-item">
          <div class="cover-date-label">Valuation Date</div>
          <div class="cover-date-value">${escapeHtml(formatDate(valuationDate))}</div>
        </div>
        <div class="cover-date-item">
          <div class="cover-date-label">Report Date</div>
          <div class="cover-date-value">${escapeHtml(formatDate(reportDate))}</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div class="footer-brand">${PLATFORM_NAME}</div>
      <div class="footer-contact">Automated Appraisal &amp; Tax Appeal Platform</div>
    </div>
  </div>`;
}

// ─── Section I: Summary ──────────────────────────────────────────────────────

function renderSummarySection(
  data: ReportTemplateData,
  addr: string,
  subjectPhoto: Photo | undefined,
  photos: Photo[],
  narrativeMap: Map<string, ReportNarrative>
): string {
  const { report, property, concludedValue, valuationDate, maps } = data;

  const factsHtml = buildFactsGrid([
    ['Property Type', formatPropertyType(report.property_type ?? '')],
    ['Address', addr],
    ['PIN / Parcel ID', report.pin || 'N/A'],
    ['County', `${report.county ?? ''}, ${report.state ?? ''}`],
    ['Year Built', property.year_built ? String(property.year_built) : 'N/A'],
    ['Gross Building Area', property.building_sqft_gross ? formatSqFt(property.building_sqft_gross) : 'N/A'],
    ['Living Area', property.building_sqft_living_area ? formatSqFt(property.building_sqft_living_area) : 'N/A'],
    ['Lot Size', property.lot_size_sqft ? formatLotSize(property.lot_size_sqft) : 'N/A'],
    ['Property Class', property.property_class ? `${property.property_class}${property.property_class_description ? ` — ${property.property_class_description}` : ''}` : 'N/A'],
    ['Zoning', property.zoning_designation || 'N/A'],
    ['Flood Zone', property.flood_zone_designation || 'N/A'],
  ]);

  // Valuation findings table
  const valuationRows: [string, string][] = [
    ['Current Assessed Value', formatCurrency(property.assessed_value ?? 0)],
    ['Market Value Estimate (Low)', formatCurrency(property.market_value_estimate_low ?? 0)],
    ['Market Value Estimate (High)', formatCurrency(property.market_value_estimate_high ?? 0)],
    ['Concluded Market Value', formatCurrency(concludedValue)],
  ];
  if (property.assessed_value && concludedValue < property.assessed_value) {
    valuationRows.push([
      'Potential Reduction',
      formatCurrency(property.assessed_value - concludedValue),
    ]);
  }

  // Maps
  let mapsHtml = '';
  if (maps.regional) {
    mapsHtml += renderMapImage(maps.regional);
  }
  if (maps.neighborhood) {
    mapsHtml += renderMapImage(maps.neighborhood);
  }
  if (maps.parcel) {
    mapsHtml += renderMapImage(maps.parcel);
  }

  // Subject photos (2-per-row grid)
  const subjectPhotos = photos.filter((p) => p.storage_path);
  let photosHtml = '';
  if (subjectPhotos.length > 0) {
    photosHtml = `
      <div style="margin-top:1.2em;">
        <h3 style="margin-bottom:0.6em;">Subject Property Photographs</h3>
        <div class="photo-grid">
          ${subjectPhotos
            .map(
              (p) => `
            <div class="photo-cell">
              <div class="img-container">
                <img src="${escapeHtml(p.storage_path)}" alt="${escapeHtml(p.photo_type ?? '')}">
              </div>
              <div class="img-caption">${escapeHtml(formatPhotoType(p.photo_type ?? 'other'))}${p.caption ? ` — ${escapeHtml(p.caption)}` : ''}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>`;
  }

  return `
  <div class="page-break">
    <div class="section-header">
      <h2>Section I &mdash; Summary of Findings</h2>
    </div>

    <h3 style="margin-bottom:0.6em;">Key Property Facts</h3>
    ${factsHtml}

    <h3 style="margin-top:1.2em; margin-bottom:0.6em;">Valuation Findings</h3>
    <table>
      <thead>
        <tr>
          <th style="width:60%;">Item</th>
          <th style="width:40%; text-align:right;">Value</th>
        </tr>
      </thead>
      <tbody>
        ${valuationRows
          .map(
            ([label, val]) => `
          <tr>
            <td>${escapeHtml(label)}</td>
            <td class="num-right">${escapeHtml(val)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="value-box">
      <div class="value-label">Concluded Market Value</div>
      <div class="value-amount">${formatCurrency(concludedValue)}</div>
      <div class="value-words">(${escapeHtml(formatCurrencyWords(concludedValue))})</div>
      <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:8pt; color:#888; margin-top:6px;">
        As of ${escapeHtml(formatDate(valuationDate))}
      </div>
    </div>

    ${mapsHtml}

    ${photosHtml}
  </div>`;
}

// ─── Narrative Sections (II through VII) ─────────────────────────────────────

function renderNarrativeSection(
  key: string,
  sectionNumber: string,
  title: string,
  narrativeMap: Map<string, ReportNarrative>
): string {
  const narrative = narrativeMap.get(key);
  if (!narrative) return '';

  return `
  <div class="page-break">
    <div class="section-header">
      <h2>Section ${sectionNumber} &mdash; ${escapeHtml(title)}</h2>
    </div>
    <div style="font-size:11pt; line-height:1.6;">
      ${narrative.content}
    </div>
  </div>`;
}

// ─── Section VIII: Sales Comparison Approach ─────────────────────────────────

function renderSalesComparisonSection(
  data: ReportTemplateData,
  comparableSales: ComparableSale[],
  narrativeMap: Map<string, ReportNarrative>
): string {
  if (comparableSales.length === 0) return '';

  const narrative = narrativeMap.get('sales_comparison_narrative');

  // Comparable cards
  const cardsHtml = comparableSales
    .map((comp, idx) => renderComparableCard(comp, idx + 1))
    .join('');

  // Adjustment grid
  const adjustmentGridHtml = renderAdjustmentGrid(data, comparableSales);

  return `
  <div class="page-break">
    <div class="section-header">
      <h2>Section VIII &mdash; Sales Comparison Approach</h2>
    </div>

    ${narrative ? `<div style="font-size:11pt; line-height:1.6; margin-bottom:1.5em;">${narrative.content}</div>` : ''}

    <h3 style="margin-bottom:0.8em;">Comparable Sales</h3>
    ${cardsHtml}

    <div class="page-break">
      <h3 style="margin-bottom:0.8em;">Adjustment Grid</h3>
      ${adjustmentGridHtml}
    </div>
  </div>`;
}

// ─── Comparable Sale Card ────────────────────────────────────────────────────

function renderComparableCard(comp: ComparableSale, index: number): string {
  const photoUrl = comp.comparable_photo_storage_path;

  const photoSection = photoUrl
    ? `<div class="comp-card-photo"><img src="${escapeHtml(photoUrl)}" alt="Comparable ${index}"></div>`
    : `<div class="comp-card-photo" style="background:linear-gradient(135deg,#e0e0e0 25%,#f5f5f5 50%,#e0e0e0 75%); display:flex; align-items:center; justify-content:center;">
        <span style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:9pt; color:#999;">No Photo Available</span>
      </div>`;

  const infoRows: [string, string][] = [
    ['Address', comp.address ?? 'N/A'],
    ['Distance', comp.distance_miles != null ? `${comp.distance_miles.toFixed(2)} miles` : 'N/A'],
    ['Deed Doc #', comp.deed_document_number || 'N/A'],
  ];

  const transactionRows: [string, string][] = [
    ['Sale Price', formatCurrency(comp.sale_price ?? 0)],
    ['Sale Date', comp.sale_date ? formatDate(comp.sale_date) : 'N/A'],
    ['Price / SF', comp.price_per_sqft ? `${formatCurrency(comp.price_per_sqft)}/SF` : 'N/A'],
    ['Grantor', comp.grantor || 'N/A'],
    ['Grantee', comp.grantee || 'N/A'],
  ];

  const propRows: [string, string][] = [
    ['Year Built', comp.year_built ? String(comp.year_built) : 'N/A'],
    ['Building SF', comp.building_sqft ? formatSqFt(comp.building_sqft) : 'N/A'],
    ['Lot Size', comp.lot_size_sqft ? formatLotSize(comp.lot_size_sqft) : 'N/A'],
    ['Property Class', comp.property_class || 'N/A'],
    ['Land-to-Building Ratio', comp.land_to_building_ratio != null ? comp.land_to_building_ratio.toFixed(2) : 'N/A'],
    ['Condition', comp.condition_notes || 'N/A'],
  ];

  const adjustedPriceSqft = comp.adjusted_price_per_sqft;

  return `
  <div class="comp-card avoid-break">
    <div class="comp-card-header">Comparable ${index} &mdash; ${escapeHtml(comp.address ?? '')}</div>
    ${photoSection}
    <div class="comp-card-body">
      <table>
        <thead>
          <tr><th colspan="2">General Information</th></tr>
        </thead>
        <tbody>
          ${infoRows.map(([l, v]) => `<tr><td style="width:35%; font-weight:600;">${escapeHtml(l)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
        </tbody>
      </table>
      <table>
        <thead>
          <tr><th colspan="2">Transaction Data</th></tr>
        </thead>
        <tbody>
          ${transactionRows.map(([l, v]) => `<tr><td style="width:35%; font-weight:600;">${escapeHtml(l)}</td><td class="num">${escapeHtml(v)}</td></tr>`).join('')}
        </tbody>
      </table>
      <table>
        <thead>
          <tr><th colspan="2">Property Characteristics</th></tr>
        </thead>
        <tbody>
          ${propRows.map(([l, v]) => `<tr><td style="width:35%; font-weight:600;">${escapeHtml(l)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${adjustedPriceSqft ? `
    <div class="comp-card-comments">
      <strong>Adjusted Price/SF:</strong> <span class="num">${formatCurrency(adjustedPriceSqft)}/SF</span>
      <strong style="margin-left:1em;">Net Adjustment:</strong> <span class="num">${formatPercent(comp.net_adjustment_pct / 100)}</span>
      ${comp.is_weak_comparable ? '<span style="color:#c62828; margin-left:1em; font-weight:600;">[Weak Comparable]</span>' : ''}
    </div>` : ''}
  </div>`;
}

// ─── Adjustment Grid ─────────────────────────────────────────────────────────

function renderAdjustmentGrid(
  data: ReportTemplateData,
  comps: ComparableSale[]
): string {
  const { property } = data;
  const colCount = comps.length + 1; // subject + comps

  // Adjustment categories mapped to ComparableSale fields
  interface AdjustmentRow {
    label: string;
    field: keyof ComparableSale;
    isTransaction: boolean;
  }

  const adjustmentRows: AdjustmentRow[] = [
    { label: 'Property Rights', field: 'adjustment_pct_property_rights', isTransaction: true },
    { label: 'Financing Terms', field: 'adjustment_pct_financing_terms', isTransaction: true },
    { label: 'Conditions of Sale', field: 'adjustment_pct_conditions_of_sale', isTransaction: true },
    { label: 'Market Trends (Time)', field: 'adjustment_pct_market_trends', isTransaction: true },
    { label: 'Location', field: 'adjustment_pct_location', isTransaction: false },
    { label: 'Size', field: 'adjustment_pct_size', isTransaction: false },
    { label: 'Land-to-Building Ratio', field: 'adjustment_pct_land_to_building', isTransaction: false },
    { label: 'Condition', field: 'adjustment_pct_condition', isTransaction: false },
    { label: 'Other', field: 'adjustment_pct_other', isTransaction: false },
  ];

  // Only show rows where at least one comp has a non-zero adjustment
  const activeRows = adjustmentRows.filter((row) =>
    comps.some((c) => (c[row.field] as number) !== 0)
  );
  const transactionRows = activeRows.filter((r) => r.isTransaction);
  const propertyAdjRows = activeRows.filter((r) => !r.isTransaction);

  function adjCell(comp: ComparableSale, field: keyof ComparableSale): string {
    const val = comp[field] as number;
    if (val == null || val === 0) return '<td style="text-align:right; color:#999;">&mdash;</td>';
    const cls = val > 0 ? 'adj-positive' : 'adj-negative';
    const sign = val > 0 ? '+' : '';
    return `<td style="text-align:right;" class="${cls}">${sign}${formatPercent(val / 100)}</td>`;
  }

  // Subject column data
  const subjectData: Record<string, string> = {
    sale_price: '&mdash;',
    year_built: property.year_built ? String(property.year_built) : 'N/A',
    building_sqft: property.building_sqft_gross ? formatSqFt(property.building_sqft_gross) : 'N/A',
    lot_size: property.lot_size_sqft ? formatLotSize(property.lot_size_sqft) : 'N/A',
    property_class: property.property_class || 'N/A',
  };

  function compPropertyData(comp: ComparableSale, key: string): string {
    const dataMap: Record<string, string> = {
      year_built: comp.year_built ? String(comp.year_built) : 'N/A',
      building_sqft: comp.building_sqft ? formatSqFt(comp.building_sqft) : 'N/A',
      lot_size: comp.lot_size_sqft ? formatLotSize(comp.lot_size_sqft) : 'N/A',
      property_class: comp.property_class || 'N/A',
    };
    return dataMap[key] ?? '&mdash;';
  }

  // Build column widths
  const labelWidth = Math.max(22, Math.round(100 / (colCount + 0.5)));
  const dataWidth = Math.round((100 - labelWidth) / colCount);

  let html = `<table class="adj-grid">`;

  // Header row
  html += `<thead><tr>
    <th style="width:${labelWidth}%; text-align:left;">Element</th>
    <th style="width:${dataWidth}%;">Subject</th>
    ${comps.map((c, i) => `<th style="width:${dataWidth}%;">Comp ${i + 1}</th>`).join('')}
  </tr></thead>`;

  html += `<tbody>`;

  // Sale price row
  html += `<tr>
    <td class="row-label">Sale Price</td>
    <td style="text-align:center;">&mdash;</td>
    ${comps.map((c) => `<td style="text-align:right;" class="num">${formatCurrency(c.sale_price ?? 0)}</td>`).join('')}
  </tr>`;

  // Sale date row
  html += `<tr>
    <td class="row-label">Sale Date</td>
    <td style="text-align:center;">&mdash;</td>
    ${comps.map((c) => `<td style="text-align:center; font-size:8.5pt;">${c.sale_date ? formatDateShort(c.sale_date) : '&mdash;'}</td>`).join('')}
  </tr>`;

  // Price per SF row
  html += `<tr>
    <td class="row-label">Price / SF</td>
    <td style="text-align:center;">&mdash;</td>
    ${comps.map((c) => `<td style="text-align:right;" class="num">${c.price_per_sqft ? formatCurrency(c.price_per_sqft) : '&mdash;'}</td>`).join('')}
  </tr>`;

  // Property data rows (year built, building SF, lot size)
  html += `<tr>
    <td class="row-label">Year Built</td>
    <td style="text-align:center; font-size:8.5pt;">${subjectData['year_built']}</td>
    ${comps.map((c) => `<td style="text-align:center; font-size:8.5pt;">${compPropertyData(c, 'year_built')}</td>`).join('')}
  </tr>`;

  html += `<tr>
    <td class="row-label">Building SF</td>
    <td style="text-align:center; font-size:8.5pt;">${subjectData['building_sqft']}</td>
    ${comps.map((c) => `<td style="text-align:center; font-size:8.5pt;">${compPropertyData(c, 'building_sqft')}</td>`).join('')}
  </tr>`;

  html += `<tr>
    <td class="row-label">Lot Size</td>
    <td style="text-align:center; font-size:8.5pt;">${subjectData['lot_size']}</td>
    ${comps.map((c) => `<td style="text-align:center; font-size:8.5pt;">${compPropertyData(c, 'lot_size')}</td>`).join('')}
  </tr>`;

  // Transaction Adjustments group
  if (transactionRows.length > 0) {
    html += `<tr class="group-header"><td colspan="${colCount + 1}">Transaction Adjustments</td></tr>`;
    for (const row of transactionRows) {
      html += `<tr>
        <td class="row-label">${escapeHtml(row.label)}</td>
        <td style="text-align:center;">&mdash;</td>
        ${comps.map((c) => adjCell(c, row.field)).join('')}
      </tr>`;
    }
  }

  // Property Adjustments group
  if (propertyAdjRows.length > 0) {
    html += `<tr class="group-header"><td colspan="${colCount + 1}">Property Adjustments</td></tr>`;
    for (const row of propertyAdjRows) {
      html += `<tr>
        <td class="row-label">${escapeHtml(row.label)}</td>
        <td style="text-align:center;">&mdash;</td>
        ${comps.map((c) => adjCell(c, row.field)).join('')}
      </tr>`;
    }
  }

  // Net Adjustment % row
  html += `<tr class="total-row">
    <td class="row-label" style="font-weight:700;">Net Adjustment %</td>
    <td style="text-align:center;">&mdash;</td>
    ${comps.map((c) => {
      const net = c.net_adjustment_pct;
      const cls = net > 0 ? 'adj-positive' : net < 0 ? 'adj-negative' : '';
      const sign = net > 0 ? '+' : '';
      return `<td style="text-align:right;" class="${cls}">${sign}${formatPercent(net / 100)}</td>`;
    }).join('')}
  </tr>`;

  // Adjusted Price/SF row
  html += `<tr class="final-row">
    <td class="row-label" style="color:#fff; font-weight:700;">Adjusted Price/SF</td>
    <td style="text-align:center;">&mdash;</td>
    ${comps.map((c) => {
      return `<td style="text-align:right; font-weight:700;">${c.adjusted_price_per_sqft ? formatCurrency(c.adjusted_price_per_sqft) + '/SF' : '&mdash;'}</td>`;
    }).join('')}
  </tr>`;

  html += `</tbody></table>`;

  return html;
}

// ─── Income Approach Section ─────────────────────────────────────────────────

function renderIncomeSection(
  data: ReportTemplateData,
  income: IncomeAnalysis,
  rentals: ComparableRental[],
  narrativeMap: Map<string, ReportNarrative>
): string {
  const narrative = narrativeMap.get('income_approach_narrative');

  // Pro forma table
  const proFormaRows: [string, string][] = [
    ['Concluded Market Rent ($/SF/Yr)', income.concluded_market_rent_per_sqft_yr ? formatCurrency(income.concluded_market_rent_per_sqft_yr) : 'N/A'],
    ['Potential Gross Income', income.potential_gross_income ? formatCurrency(income.potential_gross_income) : 'N/A'],
    ['Less: Vacancy & Collection Loss', income.vacancy_rate_pct != null ? `(${formatPercent(income.vacancy_rate_pct / 100)}) — ${income.vacancy_amount ? formatCurrency(income.vacancy_amount) : 'N/A'}` : 'N/A'],
    ['Effective Gross Income', income.effective_gross_income ? formatCurrency(income.effective_gross_income) : 'N/A'],
    ['Less: NNN During Vacancy', income.expense_nnn_during_vacancy ? `(${formatCurrency(income.expense_nnn_during_vacancy)})` : '&mdash;'],
    ['Less: Legal/Professional', income.expense_legal_professional ? `(${formatCurrency(income.expense_legal_professional)})` : '&mdash;'],
    ['Less: Utilities (Common)', income.expense_utilities_common ? `(${formatCurrency(income.expense_utilities_common)})` : '&mdash;'],
    ['Less: Reserves', income.expense_reserves ? `(${formatCurrency(income.expense_reserves)})` : '&mdash;'],
    ['Less: Repairs & Maintenance', income.expense_repairs_maintenance ? `(${formatCurrency(income.expense_repairs_maintenance)})` : '&mdash;'],
    ['Total Expenses', income.total_expenses ? `(${formatCurrency(income.total_expenses)})` : 'N/A'],
    ['Expense Ratio', income.expense_ratio_pct != null ? formatPercent(income.expense_ratio_pct / 100) : 'N/A'],
    ['Net Operating Income (NOI)', income.net_operating_income ? formatCurrency(income.net_operating_income) : 'N/A'],
  ];

  // Cap rate analysis
  const capRateRows: [string, string][] = [
    ['Market Cap Rate Range', (income.cap_rate_market_low != null && income.cap_rate_market_high != null) ? `${formatPercent(income.cap_rate_market_low / 100)} - ${formatPercent(income.cap_rate_market_high / 100)}` : 'N/A'],
    ['Investor Survey Average', income.cap_rate_investor_survey_avg != null ? formatPercent(income.cap_rate_investor_survey_avg / 100) : 'N/A'],
    ['Concluded Cap Rate', income.concluded_cap_rate != null ? formatPercent(income.concluded_cap_rate / 100) : 'N/A'],
    ['Capitalized Value', income.capitalized_value ? formatCurrency(income.capitalized_value) : 'N/A'],
    ['Net Operating Income', income.net_operating_income ? formatCurrency(income.net_operating_income) : 'N/A'],
    ['Income Approach Value', income.concluded_value_income_approach ? formatCurrency(income.concluded_value_income_approach) : 'N/A'],
  ];

  // Rental comparables grid
  let rentalGridHtml = '';
  if (rentals.length > 0) {
    rentalGridHtml = `
      <h3 style="margin:1.2em 0 0.6em;">Rental Comparables</h3>
      <table>
        <thead>
          <tr>
            <th style="width:5%;">#</th>
            <th style="width:25%;">Address</th>
            <th style="width:10%;">Lease Date</th>
            <th style="width:10%;">SF Leased</th>
            <th style="width:12%;">Rent/SF/Yr</th>
            <th style="width:10%;">Lease Type</th>
            <th style="width:13%;">Eff. Net Rent/SF</th>
            <th style="width:15%;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rentals.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.address ?? 'N/A')}</td>
            <td>${r.lease_date ? formatDateShort(r.lease_date) : 'N/A'}</td>
            <td class="num-right">${r.building_sqft_leased ? formatSqFt(r.building_sqft_leased) : 'N/A'}</td>
            <td class="num-right">${r.rent_per_sqft_yr ? formatCurrency(r.rent_per_sqft_yr) : 'N/A'}</td>
            <td>${escapeHtml(r.lease_type ?? 'N/A')}</td>
            <td class="num-right">${r.effective_net_rent_per_sqft ? formatCurrency(r.effective_net_rent_per_sqft) : 'N/A'}</td>
            <td style="font-size:8.5pt;">${escapeHtml(r.adjustment_notes ?? '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  return `
  <div class="page-break">
    <div class="section-header">
      <h2>Income Approach</h2>
    </div>

    ${narrative ? `<div style="font-size:11pt; line-height:1.6; margin-bottom:1.5em;">${narrative.content}</div>` : ''}

    <h3 style="margin-bottom:0.6em;">Pro Forma Income Statement</h3>
    <table class="income-table">
      <thead>
        <tr>
          <th style="width:65%;">Item</th>
          <th style="width:35%; text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${proFormaRows.map(([label, val]) => {
          const isBold = label.includes('Net Operating Income') || label.includes('Effective Gross');
          return `<tr${isBold ? ' style="font-weight:700;"' : ''}>
            <td>${escapeHtml(label)}</td>
            <td class="num-right">${escapeHtml(val)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <h3 style="margin:1.2em 0 0.6em;">Capitalization Rate Analysis</h3>
    <table class="income-table">
      <thead>
        <tr>
          <th style="width:65%;">Component</th>
          <th style="width:35%; text-align:right;">Value</th>
        </tr>
      </thead>
      <tbody>
        ${capRateRows.map(([label, val]) => {
          const isBold = label.includes('Income Approach Value');
          return `<tr${isBold ? ' style="font-weight:700;"' : ''}>
            <td>${escapeHtml(label)}</td>
            <td class="num-right">${escapeHtml(val)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    ${income.concluded_value_income_approach ? `
    <div class="value-box" style="margin-top:1em;">
      <div class="value-label">Income Approach Indicated Value</div>
      <div class="value-amount">${formatCurrency(income.concluded_value_income_approach)}</div>
      <div class="value-words">(${escapeHtml(formatCurrencyWords(income.concluded_value_income_approach))})</div>
    </div>` : ''}

    ${rentalGridHtml}
  </div>`;
}

// ─── Reconciliation Section ──────────────────────────────────────────────────

function renderReconciliationSection(
  data: ReportTemplateData,
  narrativeMap: Map<string, ReportNarrative>
): string {
  const narrative = narrativeMap.get('reconciliation_narrative');
  const { concludedValue, valuationDate } = data;

  return `
  <div class="page-break">
    <div class="section-header">
      <h2>Reconciliation &amp; Final Value Conclusion</h2>
    </div>

    ${narrative ? `<div style="font-size:11pt; line-height:1.6; margin-bottom:1.5em;">${narrative.content}</div>` : ''}

    <div class="value-box">
      <div class="value-label">Final Concluded Market Value</div>
      <div class="value-amount">${formatCurrency(concludedValue)}</div>
      <div class="value-words">(${escapeHtml(formatCurrencyWords(concludedValue))})</div>
      <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:8.5pt; color:#888; margin-top:8px;">
        Effective Date of Valuation: ${escapeHtml(formatDate(valuationDate))}
      </div>
    </div>

    <div style="margin-top:2em; padding-top:1em; border-top:1px solid ${TABLE_BORDER};">
      <p style="font-size:10pt; color:#555; text-align:center; font-style:italic;">
        This appraisal report has been prepared in accordance with the Uniform Standards of Professional
        Appraisal Practice (USPAP) and is intended for use in property tax assessment appeals. The concluded
        value represents the appraiser's opinion of market value as of the effective date stated above.
      </p>
    </div>
  </div>`;
}

// ─── Addendum: Pro Se Filing Guide ───────────────────────────────────────────

function renderFilingGuideAddendum(guide: FilingGuide): string {
  const stepsHtml = guide.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join('');

  const docsHtml = guide.required_documents
    .map((doc) => `<li>${escapeHtml(doc)}</li>`)
    .join('');

  const tipsHtml = guide.tips
    .map((tip) => `<div class="tip-box">${escapeHtml(tip)}</div>`)
    .join('');

  return `
  <div class="page-break filing-guide">
    <div class="guide-header">
      Your Pro Se Filing Guide &mdash; ${escapeHtml(guide.appeal_board_name)}
    </div>

    <div class="guide-body">
      <div class="deadline-box">
        <div class="deadline-label">Filing Deadline</div>
        <div class="deadline-date">${escapeHtml(guide.filing_deadline)}</div>
      </div>

      ${guide.hearing_format ? `
      <p style="margin-bottom:1em;">
        <strong>Hearing Format:</strong> ${escapeHtml(guide.hearing_format)}
      </p>` : ''}

      ${guide.fee_amount ? `
      <p style="margin-bottom:1em;">
        <strong>Filing Fee:</strong> ${escapeHtml(guide.fee_amount)}
      </p>` : ''}

      ${guide.online_filing_url ? `
      <p style="margin-bottom:1em;">
        <strong>Online Filing:</strong> <span style="color:#1565c0; text-decoration:underline;">${escapeHtml(guide.online_filing_url)}</span>
      </p>` : ''}

      <h3 style="color:${NAVY}; margin:1.2em 0 0.6em; font-style:normal;">Step-by-Step Filing Instructions</h3>
      <ol>${stepsHtml}</ol>

      <h3 style="color:${NAVY}; margin:1.2em 0 0.6em; font-style:normal;">Required Documents</h3>
      <ul>${docsHtml}</ul>

      ${guide.tips.length > 0 ? `
      <h3 style="color:${NAVY}; margin:1.2em 0 0.6em; font-style:normal;">Tips for a Successful Appeal</h3>
      ${tipsHtml}` : ''}
    </div>
  </div>`;
}

// ─── Utility Renderers ───────────────────────────────────────────────────────

function buildFactsGrid(facts: [string, string][]): string {
  const items = facts
    .map(
      ([label, value]) => `
    <div class="fact-item">
      <span class="fact-label">${escapeHtml(label)}</span>
      <span class="fact-value">${escapeHtml(value)}</span>
    </div>`
    )
    .join('');

  return `<div class="facts-grid">${items}</div>`;
}

function renderMapImage(map: MapImage): string {
  return `
  <div class="img-container avoid-break" style="margin:1em 0;">
    <img src="${escapeHtml(map.url)}" alt="${escapeHtml(map.caption)}" style="width:100%; height:auto; max-height:400px; object-fit:contain;">
    <div class="img-caption">${escapeHtml(map.caption)}</div>
  </div>`;
}

function formatPhotoType(type: string): string {
  const labels: Record<string, string> = {
    front_exterior: 'Front Exterior',
    rear_exterior: 'Rear Exterior',
    left_exterior: 'Left Side',
    right_exterior: 'Right Side',
    street_view: 'Street View',
    kitchen: 'Kitchen',
    bathroom: 'Bathroom',
    living_room: 'Living Room',
    bedroom: 'Bedroom',
    basement: 'Basement',
    attic: 'Attic',
    garage: 'Garage',
    yard: 'Yard',
    roof: 'Roof',
    damage: 'Noted Damage',
    other: 'Other',
  };
  return labels[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
