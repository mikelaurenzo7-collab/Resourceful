import type { ReportTemplateData } from '@/lib/templates/report-template';

export interface ValueConclusionRowData {
  approach: string;
  total: number;
  perUnit: number | null;
  role: string;
}

export interface FloodEnvironmentalContext {
  facts: Array<{ label: string; value: string }>;
  observations: string[];
}

export function buildValueConclusionRows(data: ReportTemplateData): ValueConclusionRowData[] {
  const rows: ValueConclusionRowData[] = [];
  const subjectArea = getSubjectBuildingArea(data);
  const salesIndication = computeSalesComparisonIndication(data);

  if (salesIndication != null) {
    rows.push({
      approach: 'Sales Comparison',
      total: roundToNearestThousand(salesIndication),
      perUnit: computePerUnitValue(salesIndication, subjectArea),
      role: getApproachRole(data, 'sales'),
    });
  }

  if (data.incomeAnalysis?.concluded_value_income_approach != null) {
    rows.push({
      approach: 'Income Capitalization',
      total: roundToNearestThousand(data.incomeAnalysis.concluded_value_income_approach),
      perUnit: computePerUnitValue(data.incomeAnalysis.concluded_value_income_approach, subjectArea),
      role: getApproachRole(data, 'income'),
    });
  }

  if (data.property.cost_approach_value != null && data.property.cost_approach_value > 0) {
    rows.push({
      approach: 'Cost Approach',
      total: roundToNearestThousand(data.property.cost_approach_value),
      perUnit: computePerUnitValue(data.property.cost_approach_value, subjectArea),
      role: getApproachRole(data, 'cost'),
    });
  }

  return rows;
}

export function buildFloodEnvironmentalContext(data: ReportTemplateData): FloodEnvironmentalContext {
  const facts: FloodEnvironmentalContext['facts'] = [];
  const { property, photos } = data;

  if (property.flood_zone_designation) {
    facts.push({ label: 'Flood Zone', value: property.flood_zone_designation });
  }
  if (property.flood_map_panel_number) {
    facts.push({ label: 'FEMA Panel', value: property.flood_map_panel_number });
  }
  if (property.flood_map_panel_date) {
    facts.push({ label: 'Panel Effective Date', value: property.flood_map_panel_date });
  }
  if (property.zoning_overlay_district) {
    facts.push({ label: 'Overlay District', value: property.zoning_overlay_district });
  }

  const observations = new Set<string>();

  if (property.flood_zone_designation) {
    observations.add(
      `Public mapping identifies the subject within flood zone ${property.flood_zone_designation}, which may affect insurance cost, lender requirements, and marketability.`
    );
  }

  for (const photo of photos) {
    const photoType = photo.photo_type ?? 'other';
    const caption = photo.ai_analysis?.professional_caption?.trim() || photo.caption?.trim();
    const isEnvironmentalPhoto = photoType === 'environmental_concern' || photoType === 'drainage';

    if (isEnvironmentalPhoto && caption) {
      observations.add(caption);
    }

    for (const defect of photo.ai_analysis?.defects ?? []) {
      if (isEnvironmentalDefect(defect.type, defect.description, defect.report_language)) {
        observations.add(defect.report_language || defect.description || defect.type);
      }
    }
  }

  return {
    facts,
    observations: Array.from(observations).slice(0, 4),
  };
}

export function hasFloodEnvironmentalContext(data: ReportTemplateData): boolean {
  const context = buildFloodEnvironmentalContext(data);
  return context.facts.length > 0 || context.observations.length > 0;
}

function computeSalesComparisonIndication(data: ReportTemplateData): number | null {
  const prices = data.comparableSales
    .map((sale) => sale.adjusted_price_per_sqft)
    .filter((price): price is number => price != null && price > 0)
    .sort((left, right) => left - right);

  const subjectArea = data.property.building_sqft_gross;
  if (prices.length > 0 && subjectArea != null && subjectArea > 0) {
    return computeMedian(prices) * subjectArea;
  }

  const salePrices = data.comparableSales
    .map((sale) => sale.sale_price)
    .filter((price): price is number => price != null && price > 0)
    .sort((left, right) => left - right);

  return salePrices.length > 0 ? computeMedian(salePrices) : null;
}

function computePerUnitValue(total: number, subjectArea: number | null): number | null {
  if (subjectArea == null || subjectArea <= 0) {
    return null;
  }

  return Math.round((total / subjectArea) * 100) / 100;
}

function getSubjectBuildingArea(data: ReportTemplateData): number | null {
  return data.property.building_sqft_gross ?? data.property.building_sqft_living_area ?? null;
}

function getApproachRole(data: ReportTemplateData, approach: 'sales' | 'income' | 'cost'): string {
  const valuationMethod = data.property.valuation_method;

  if (approach === 'sales') {
    if (valuationMethod === 'sales_income_blend') return 'Primary (70%)';
    if (valuationMethod === 'sales_comparison') return 'Primary';
    return 'Supporting';
  }

  if (approach === 'income') {
    if (valuationMethod === 'sales_income_blend') return 'Supporting (30%)';
    if (valuationMethod === 'income') return 'Primary';
    return 'Supporting';
  }

  if (valuationMethod === 'cost') {
    return 'Primary';
  }

  return data.countyRule?.cost_approach_disfavored ? 'Secondary check' : 'Supporting check';
}

function computeMedian(values: number[]): number {
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid];
}

function roundToNearestThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function isEnvironmentalDefect(type: string, description: string, reportLanguage: string): boolean {
  const haystack = `${type} ${description} ${reportLanguage}`.toLowerCase();
  return [
    'environment',
    'drain',
    'flood',
    'water',
    'moisture',
    'erosion',
    'contamin',
    'wet',
    'pond',
    'grading',
    'storm',
  ].some((needle) => haystack.includes(needle));
}