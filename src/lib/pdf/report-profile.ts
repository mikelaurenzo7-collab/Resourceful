import type { ReportTemplateData } from '@/lib/templates/report-template';
import { resolveAssignmentKind } from '@/lib/assignments/routing';
import { supportsIncomeApproach } from '@/lib/valuation/property-type-policy';
import { hasReleaseReadyIncomeApproach } from './section-data';

export const REPORT_NARRATIVE_SECTION_SPECS = [
  { key: 'assignment_and_scope', number: 'I', title: 'Assignment & Scope of Work' },
  { key: 'summary_of_salient_facts', number: 'II-A', title: 'Summary of Salient Facts' },
  { key: 'executive_summary', number: 'II-B', title: 'Executive Valuation Summary' },
  { key: 'property_history', number: 'III-A', title: 'Property History & Transaction Context' },
  { key: 'assessment_data', number: 'III-B', title: 'Assessment Data & Classification' },
  { key: 'property_description', number: 'III-C', title: 'Subject Property Description' },
  { key: 'site_description_narrative', number: 'III-D', title: 'Site Description' },
  { key: 'improvement_description_narrative', number: 'III-E', title: 'Improvement Description' },
  { key: 'condition_assessment', number: 'III-F', title: 'Condition, Vacancy & Regulatory Evidence' },
  { key: 'area_analysis_county', number: 'IV-A', title: 'County & Regional Context' },
  { key: 'area_analysis_city', number: 'IV-B', title: 'Municipal Context' },
  { key: 'area_analysis_neighborhood', number: 'IV-C', title: 'Immediate Market Area' },
  { key: 'market_analysis', number: 'V', title: 'Relevant Market Analysis' },
  { key: 'hbu_as_vacant', number: 'VI-A', title: 'Highest & Best Use - As Vacant' },
  { key: 'hbu_as_improved', number: 'VI-B', title: 'Highest & Best Use - As Improved' },
  { key: 'appeal_argument_summary', number: 'VII-A', title: 'Appeal Position & Evidence Strategy' },
  { key: 'sales_comparison_narrative', number: 'VII-B', title: 'Sales Comparison Methodology' },
  { key: 'adjustment_grid_narrative', number: 'VII-C', title: 'Comparable Adjustments & Reliability' },
  { key: 'income_approach_narrative', number: 'VII-D', title: 'Income Capitalization Methodology' },
  { key: 'cost_approach_narrative', number: 'VII-E', title: 'Cost Approach Methodology' },
  { key: 'assessment_equity', number: 'VIII-A', title: 'Assessment Equity & Jurisdiction Analysis' },
  { key: 'reconciliation_narrative', number: 'VIII-B', title: 'Reconciliation & Final Value Conclusion' },
  { key: 'hearing_script', number: 'ADD-B', title: 'Hearing / Reviewer Preparation Guide' },
  { key: 'certification_and_limiting_conditions', number: 'ADD-C', title: 'Certification Boundary & Limiting Conditions' },
] as const;

export type ReportNarrativeSectionKey = typeof REPORT_NARRATIVE_SECTION_SPECS[number]['key'];
export type ReportAssignmentKind = ReturnType<typeof resolveAssignmentKind>;

export interface ReportNarrativeSectionPlan {
  key: ReportNarrativeSectionKey;
  number: string;
  title: string;
  required: boolean;
}

export interface ReportProfile {
  id: string;
  documentTitle: string;
  assignmentKind: ReportAssignmentKind;
  isTaxAppeal: boolean;
  isCookCounty: boolean;
  isIncomeProperty: boolean;
  isComplexProperty: boolean;
  hasSalesApproach: boolean;
  hasIncomeApproach: boolean;
  hasCostApproach: boolean;
  hasConditionEvidence: boolean;
  requiresHighestAndBestUse: boolean;
  requiredNarratives: ReportNarrativeSectionKey[];
  narrativeSections: ReportNarrativeSectionPlan[];
}

export interface ReportProfileAssessment {
  profile: ReportProfile;
  warnings: string[];
  hardFailures: string[];
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasMultifamilyDescriptor(data: ReportTemplateData): boolean {
  const descriptor = [
    data.property.property_subtype,
    data.property.property_class_description,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

  return /multifamily|multi-family|apartment|duplex|triplex|fourplex|2-unit|3-unit|4-unit/.test(descriptor);
}

function detectConditionEvidence(data: ReportTemplateData): boolean {
  const condition = data.property.overall_condition?.trim().toLowerCase();
  const concerningCondition = condition === 'fair' || condition === 'poor';
  const structuredIssues = (data.report.property_issues?.length ?? 0) > 0;
  const conditionNotes = hasText(data.property.condition_notes);
  const photoDefects = data.photos.some((photo) => (photo.ai_analysis?.defects?.length ?? 0) > 0);

  return concerningCondition || structuredIssues || conditionNotes || photoDefects;
}

function getDocumentTitle(assignmentKind: ReportAssignmentKind): string {
  switch (assignmentKind) {
    case 'tax_appeal':
      return 'Property Tax Appeal Valuation Analysis';
    case 'pre_purchase':
      return 'Pre-Purchase Property Valuation Analysis';
    case 'pre_listing':
      return 'Pre-Listing Property Valuation Analysis';
    case 'independent_valuation':
      return 'Independent Property Valuation Analysis';
  }
}

function buildRequiredNarratives(input: {
  isTaxAppeal: boolean;
  isComplexProperty: boolean;
  hasSalesApproach: boolean;
  hasIncomeApproach: boolean;
  hasCostApproach: boolean;
  hasConditionEvidence: boolean;
  requiresHighestAndBestUse: boolean;
}): ReportNarrativeSectionKey[] {
  const required = new Set<ReportNarrativeSectionKey>([
    'assignment_and_scope',
    'summary_of_salient_facts',
    'executive_summary',
    'property_description',
    'reconciliation_narrative',
  ]);

  if (input.isComplexProperty) {
    required.add('property_history');
    required.add('site_description_narrative');
    required.add('improvement_description_narrative');
    required.add('market_analysis');
  }

  if (input.isTaxAppeal) {
    required.add('assessment_data');
    required.add('assessment_equity');
    required.add('appeal_argument_summary');
  }

  if (input.requiresHighestAndBestUse) {
    required.add('hbu_as_vacant');
    required.add('hbu_as_improved');
  }

  if (input.hasSalesApproach) {
    required.add('sales_comparison_narrative');
    required.add('adjustment_grid_narrative');
  }

  if (input.hasIncomeApproach) required.add('income_approach_narrative');
  if (input.hasCostApproach) required.add('cost_approach_narrative');
  if (input.hasConditionEvidence) required.add('condition_assessment');

  return REPORT_NARRATIVE_SECTION_SPECS
    .map((section) => section.key)
    .filter((key) => required.has(key));
}

export function buildReportProfile(data: ReportTemplateData): ReportProfile {
  const assignmentKind = resolveAssignmentKind(
    data.report.service_type,
    data.report.desired_outcome
  );
  const isTaxAppeal = assignmentKind === 'tax_appeal';
  const isCookCounty = data.report.county_fips === '17031' || /cook/i.test(data.report.county ?? '');
  const isIncomeProperty = supportsIncomeApproach({
    propertyType: data.report.property_type,
    propertySubtype: data.property.property_subtype,
    propertyClassDescription: data.property.property_class_description,
  });
  const multifamily = hasMultifamilyDescriptor(data);
  const isComplexProperty =
    data.report.property_type !== 'residential' ||
    isIncomeProperty ||
    multifamily ||
    data.report.review_tier !== 'auto';
  const hasSalesApproach = data.comparableSales.length > 0;
  const hasIncomeApproach = hasReleaseReadyIncomeApproach(data);
  const hasCostApproach = (data.property.cost_approach_value ?? 0) > 0;
  const hasConditionEvidence = detectConditionEvidence(data);
  const requiresHighestAndBestUse =
    isComplexProperty ||
    hasText(data.property.zoning_designation) ||
    hasText(data.property.zoning_description);

  const requiredNarratives = buildRequiredNarratives({
    isTaxAppeal,
    isComplexProperty,
    hasSalesApproach,
    hasIncomeApproach,
    hasCostApproach,
    hasConditionEvidence,
    requiresHighestAndBestUse,
  });
  const existingNarratives = new Set(
    data.narratives
      .filter((narrative) => hasText(narrative.content))
      .map((narrative) => narrative.section_name)
  );

  const narrativeSections = REPORT_NARRATIVE_SECTION_SPECS
    .filter((section) => existingNarratives.has(section.key))
    .map((section) => ({
      ...section,
      required: requiredNarratives.includes(section.key),
    }));

  const complexity = isComplexProperty ? 'complex' : 'standard';
  const evidenceMode = hasIncomeApproach
    ? 'sales-income'
    : hasCostApproach
      ? 'sales-cost'
      : hasSalesApproach
        ? 'sales'
        : 'alternative';

  return {
    id: `resourceful-v2:${assignmentKind}:${complexity}:${evidenceMode}`,
    documentTitle: getDocumentTitle(assignmentKind),
    assignmentKind,
    isTaxAppeal,
    isCookCounty,
    isIncomeProperty,
    isComplexProperty,
    hasSalesApproach,
    hasIncomeApproach,
    hasCostApproach,
    hasConditionEvidence,
    requiresHighestAndBestUse,
    requiredNarratives,
    narrativeSections,
  };
}

export function evaluateReportProfileCompleteness(
  data: ReportTemplateData
): ReportProfileAssessment {
  const profile = buildReportProfile(data);
  const warnings: string[] = [];
  const hardFailures: string[] = [];
  const existingNarratives = new Set(
    data.narratives
      .filter((narrative) => hasText(narrative.content))
      .map((narrative) => narrative.section_name)
  );

  for (const requiredSection of profile.requiredNarratives) {
    if (!existingNarratives.has(requiredSection)) {
      hardFailures.push(`Missing required ${profile.id} narrative: ${requiredSection}`);
    }
  }

  if (profile.isTaxAppeal && data.property.tax_year_in_appeal == null) {
    hardFailures.push('Tax-appeal report is missing the assessment year in appeal');
  }

  if (profile.isTaxAppeal && data.property.assessment_ratio == null) {
    hardFailures.push('Tax-appeal report is missing the applied assessment level');
  }

  if (profile.isComplexProperty && data.photos.filter((photo) => hasText(photo.storage_path)).length === 0) {
    warnings.push('Complex-property report has no subject-photo exhibit');
  }

  if (profile.hasSalesApproach && data.comparableSales.length < 3) {
    warnings.push(`Only ${data.comparableSales.length} comparable sale(s) support the sales approach`);
  }

  if (profile.hasSalesApproach && data.report.review_tier !== 'auto') {
    const sourcedComparables = data.comparableSales.filter(
      (sale) => hasText(sale.county_recorder_url) || hasText(sale.deed_document_number)
    ).length;

    if (sourcedComparables === 0) {
      hardFailures.push('Reviewed report has no source-backed comparable transaction');
    } else if (sourcedComparables < data.comparableSales.length) {
      warnings.push(
        `${data.comparableSales.length - sourcedComparables} comparable sale(s) lack a recorder link or deed document number`
      );
    }
  }

  const distressedComparables = data.comparableSales.filter((sale) => sale.is_distressed_sale).length;
  if (distressedComparables > 0) {
    warnings.push(`${distressedComparables} distressed comparable sale(s) require reduced reliance or explicit explanation`);
  }

  return { profile, warnings, hardFailures };
}
