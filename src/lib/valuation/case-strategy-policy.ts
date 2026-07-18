import type { ReportTemplateData } from '@/lib/templates/report-template';
import { supportsIncomeApproach } from './property-type-policy';

export type CaseStrategyFlag =
  | 'tax_appeal'
  | 'distressed_or_vacant'
  | 'recent_subject_sale'
  | 'multifamily_unit_economics'
  | 'industrial_utility'
  | 'regulatory_or_code_issue'
  | 'retrospective_effective_date'
  | 'income_property';

export interface CaseStrategyAssessment {
  flags: CaseStrategyFlag[];
  recentSubjectSaleDate: string | null;
  warnings: string[];
  hardFailures: string[];
}

const DISTRESS_PATTERN = /\b(vacant|unoccupied|disrepair|poor condition|deferred maintenance|renovation|rehabilitation|uninhabitable|boarded|fire damage|water damage|demolition)\b/i;
const REGULATORY_PATTERN = /\b(code violation|building violation|zoning violation|illegal unit|nonconforming|non-conforming|condemnation|municipal violation)\b/i;
const MULTIFAMILY_PATTERN = /\b(multifamily|multi-family|apartment|duplex|triplex|fourplex|two[- ]unit|three[- ]unit|four[- ]unit|2[- ]unit|3[- ]unit|4[- ]unit)\b/i;
const INDUSTRIAL_PATTERN = /\b(industrial|warehouse|flex|manufacturing|distribution|factory|logistics)\b/i;
const UNIT_COUNT_PATTERN = /\b(?:number of units|unit count|two units|three units|four units|2 units|3 units|4 units|\([2-9]\)\s*units?)\b/i;
const SALE_DATE_KEYS = ['sale_date', 'transfer_date', 'recording_date', 'document_date', 'date'] as const;
const SUBJECT_EVIDENCE_NARRATIVES = new Set([
  'summary_of_salient_facts',
  'executive_summary',
  'property_history',
  'property_description',
  'condition_assessment',
  'appeal_argument_summary',
]);

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function subjectEvidenceText(data: ReportTemplateData): string {
  return [
    data.property.property_subtype,
    data.property.property_class_description,
    data.property.overall_condition,
    data.property.condition_notes,
    data.property.zoning_conformance,
    data.report.additional_notes,
    ...(data.report.property_issues ?? []),
    ...data.narratives
      .filter((narrative) => SUBJECT_EVIDENCE_NARRATIVES.has(narrative.section_name))
      .map((narrative) => narrative.content),
  ]
    .filter((value): value is string => hasText(value))
    .join(' ');
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRecentSubjectSaleDate(
  deedHistory: Record<string, unknown>[] | null,
  valuationDate: string
): string | null {
  if (!deedHistory?.length) return null;
  const effectiveDate = parseDate(valuationDate);
  if (!effectiveDate) return null;
  const lookbackStart = new Date(effectiveDate);
  lookbackStart.setUTCFullYear(lookbackStart.getUTCFullYear() - 3);

  const qualifyingDates = deedHistory
    .flatMap((record) => SALE_DATE_KEYS.map((key) => parseDate(record[key])))
    .filter((date): date is Date => Boolean(date))
    .filter((date) => date <= effectiveDate && date >= lookbackStart)
    .sort((a, b) => b.getTime() - a.getTime());

  return qualifyingDates[0]?.toISOString().slice(0, 10) ?? null;
}

function hasNarrative(data: ReportTemplateData, sectionName: string): boolean {
  return data.narratives.some(
    (narrative) => narrative.section_name === sectionName && hasText(narrative.content)
  );
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

export function evaluateCaseStrategy(data: ReportTemplateData): CaseStrategyAssessment {
  const flags = new Set<CaseStrategyFlag>();
  const warnings: string[] = [];
  const hardFailures: string[] = [];
  const caseText = subjectEvidenceText(data);
  const descriptor = [
    data.property.property_subtype,
    data.property.property_class_description,
    data.report.property_type,
  ]
    .filter((value): value is string => hasText(value))
    .join(' ');

  const isTaxAppeal = data.report.service_type === 'tax_appeal';
  const isDistressedOrVacant = DISTRESS_PATTERN.test(caseText);
  const hasRegulatoryIssue = REGULATORY_PATTERN.test(caseText);
  const isMultifamily = MULTIFAMILY_PATTERN.test(descriptor);
  const isIndustrial = data.report.property_type === 'industrial' || INDUSTRIAL_PATTERN.test(descriptor);
  const isIncomeProperty = supportsIncomeApproach({
    propertyType: data.report.property_type,
    propertySubtype: data.property.property_subtype,
    propertyClassDescription: data.property.property_class_description,
  });
  const recentSubjectSaleDate = getRecentSubjectSaleDate(
    data.property.deed_history,
    data.valuationDate
  );
  const valuationDate = parseDate(data.valuationDate);
  const reportDate = parseDate(data.reportDate);
  const isRetrospective =
    valuationDate != null &&
    reportDate != null &&
    reportDate > valuationDate &&
    daysBetween(reportDate, valuationDate) > 30;

  if (isTaxAppeal) flags.add('tax_appeal');
  if (isDistressedOrVacant) flags.add('distressed_or_vacant');
  if (recentSubjectSaleDate) flags.add('recent_subject_sale');
  if (isMultifamily) flags.add('multifamily_unit_economics');
  if (isIndustrial) flags.add('industrial_utility');
  if (hasRegulatoryIssue) flags.add('regulatory_or_code_issue');
  if (isRetrospective) flags.add('retrospective_effective_date');
  if (isIncomeProperty) flags.add('income_property');

  if ((isDistressedOrVacant || hasRegulatoryIssue) && !hasNarrative(data, 'condition_assessment')) {
    hardFailures.push(
      'Distress, vacancy, or regulatory evidence requires a dedicated condition_assessment narrative'
    );
  }

  if (recentSubjectSaleDate) {
    if (!hasNarrative(data, 'property_history')) {
      hardFailures.push('A recent subject transfer requires a dedicated property_history narrative');
    }
    warnings.push(
      `Subject transfer dated ${recentSubjectSaleDate} requires arm's-length, financing, condition-of-sale, and effective-date screening before it is relied upon`
    );
  }

  if (isRetrospective) {
    if (!hasNarrative(data, 'market_analysis')) {
      hardFailures.push('A retrospective valuation requires market_analysis tied to the effective date');
    }
    warnings.push(
      'Retrospective assignment: market evidence, property condition, regulations, and income assumptions must be analyzed as of the valuation date rather than the report date'
    );
  }

  if (isMultifamily) {
    const sourceText = [
      data.property.data_collection_notes,
      data.narratives.find((narrative) => narrative.section_name === 'summary_of_salient_facts')?.content,
      data.narratives.find((narrative) => narrative.section_name === 'property_description')?.content,
    ]
      .filter((value): value is string => hasText(value))
      .join(' ');

    if (!UNIT_COUNT_PATTERN.test(sourceText)) {
      warnings.push(
        'Multifamily assignment lacks a source-labeled unit count in structured notes or required narratives; do not render price-per-unit metrics as verified evidence'
      );
    }
    if (!data.comparableSales.some((sale) => hasText(sale.property_class))) {
      warnings.push(
        'Multifamily comparable set lacks stored property-class descriptors; unit-count and building-utility comparability require explicit review'
      );
    }
  }

  if (isIndustrial) {
    const buildingArea =
      data.property.building_sqft_gross ?? data.property.building_sqft_living_area;
    if (buildingArea == null || buildingArea <= 0) {
      hardFailures.push('Industrial/flex analysis requires a positive building-area input');
    }
    const hasUtilityData =
      data.property.dock_door_count != null ||
      data.property.overhead_door_count != null ||
      data.property.clear_height_ft != null ||
      /office|warehouse|loading|dock|drive[- ]in|clear height/i.test(caseText);
    if (!hasUtilityData) {
      warnings.push(
        'Industrial/flex assignment lacks loading, door, clear-height, or office/warehouse utility evidence; comp selection and HBU analysis require manual review'
      );
    }
  }

  if (isDistressedOrVacant) {
    warnings.push(
      'Distressed or vacant subject: stabilized income, lease-up, renovation, cost-to-cure, and marketing assumptions must remain explicit and must not be inferred from ordinary occupied comparables'
    );
  }

  if (hasRegulatoryIssue) {
    warnings.push(
      'Regulatory issue detected: identify the official source and distinguish zoning legality, code compliance, cure status, marketability, and value impact'
    );
  }

  if (isTaxAppeal) {
    const appealText = data.narratives.find(
      (narrative) => narrative.section_name === 'appeal_argument_summary'
    )?.content ?? '';
    if (!/market value|assessment|equity|classification|record|condition|income/i.test(appealText)) {
      warnings.push(
        'Appeal argument does not clearly identify a valuation, equity, classification, record-correction, condition, or income theory'
      );
    }
  }

  if (isIncomeProperty && !data.incomeAnalysis) {
    warnings.push(
      'Income-producing property has no structured income analysis; the report must explain why the income approach was omitted or rely on another release-ready method'
    );
  }

  return {
    flags: Array.from(flags),
    recentSubjectSaleDate,
    warnings,
    hardFailures,
  };
}
