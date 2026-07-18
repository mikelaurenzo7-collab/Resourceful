import type { CountyRule, PropertyType, ServiceType } from '@/types/database';

const RATIO_TOLERANCE = 0.005;
const SPECIAL_CLASSIFICATION_PATTERN =
  /non[- ]?profit|incentive|preferential|special|exempt|class\s*\d|classification|mixed[- ]?use/i;

export interface AssessmentContextPolicyInput {
  serviceType: ServiceType;
  countyFips: string | null | undefined;
  propertyType: PropertyType;
  taxYearInAppeal: number | null | undefined;
  valuationDate: string | null | undefined;
  assessmentRatio: number | null | undefined;
  assessmentMethodology: string | null | undefined;
  propertyClassDescription: string | null | undefined;
  countyRule: CountyRule | null | undefined;
}

export interface AssessmentContextPolicyResult {
  applicable: boolean;
  isCookCounty: boolean;
  expectedAssessmentRatio: number | null;
  appliedAssessmentRatio: number | null;
  ratioVariance: number | null;
  valuationYear: number | null;
  requiresYearSpecificEqualizationSource: boolean;
  warnings: string[];
  hardFailures: string[];
}

function isPositiveRatio(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function expectedAssessmentRatio(
  propertyType: PropertyType,
  countyRule: CountyRule | null | undefined
): number | null {
  if (!countyRule) return null;

  switch (propertyType) {
    case 'residential':
      return countyRule.level_of_assessment_residential ?? countyRule.assessment_ratio_residential ?? null;
    case 'commercial':
      return countyRule.level_of_assessment_commercial ?? countyRule.assessment_ratio_commercial ?? null;
    case 'industrial':
      return countyRule.assessment_ratio_industrial ?? countyRule.level_of_assessment_commercial ?? null;
    case 'agricultural':
      return countyRule.assessment_ratio_agricultural ?? null;
    case 'land':
      return null;
  }
}

function hasSpecialClassificationExplanation(input: AssessmentContextPolicyInput): boolean {
  const explanation = [input.assessmentMethodology, input.propertyClassDescription]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');

  return SPECIAL_CLASSIFICATION_PATTERN.test(explanation);
}

function valuationConventionRequiresJanuaryFirst(rule: CountyRule | null | undefined): boolean {
  const convention = rule?.valuation_date_convention?.trim().toLowerCase();
  if (!convention) return false;
  return /january\s*1|jan\.?\s*1|first day of january/.test(convention);
}

export function evaluateAssessmentContext(
  input: AssessmentContextPolicyInput
): AssessmentContextPolicyResult {
  const applicable = input.serviceType === 'tax_appeal';
  const isCookCounty = input.countyFips === '17031';
  const warnings: string[] = [];
  const hardFailures: string[] = [];

  if (!applicable) {
    return {
      applicable: false,
      isCookCounty,
      expectedAssessmentRatio: null,
      appliedAssessmentRatio: null,
      ratioVariance: null,
      valuationYear: null,
      requiresYearSpecificEqualizationSource: false,
      warnings,
      hardFailures,
    };
  }

  const taxYear = input.taxYearInAppeal;
  if (!Number.isInteger(taxYear) || (taxYear ?? 0) < 1900 || (taxYear ?? 0) > 2200) {
    hardFailures.push('Assessment year in appeal is missing or invalid');
  }

  const valuationDate = parseDate(input.valuationDate);
  if (!valuationDate) {
    hardFailures.push('Valuation date is missing or invalid');
  }
  const valuationYear = valuationDate?.getUTCFullYear() ?? null;

  if (taxYear != null && valuationYear != null && valuationYear !== taxYear) {
    hardFailures.push(
      `Valuation year ${valuationYear} does not match assessment year in appeal ${taxYear}`
    );
  }

  const appliedRatio = isPositiveRatio(input.assessmentRatio) ? input.assessmentRatio : null;
  if (appliedRatio == null) {
    hardFailures.push('Applied assessment level must be a positive decimal no greater than 1.0');
  }

  const expectedRatio = expectedAssessmentRatio(input.propertyType, input.countyRule);
  const ratioVariance =
    appliedRatio != null && isPositiveRatio(expectedRatio)
      ? appliedRatio - expectedRatio
      : null;

  if (input.propertyType === 'land' && expectedRatio == null) {
    warnings.push(
      'No generic land assessment level was inferred; the parcel classification and jurisdiction method require direct verification'
    );
  } else if (expectedRatio == null) {
    hardFailures.push('Verified jurisdiction rule does not provide an assessment level for this property type');
  }

  if (ratioVariance != null && Math.abs(ratioVariance) > RATIO_TOLERANCE) {
    const mismatch = `Applied assessment level ${(appliedRatio! * 100).toFixed(2)}% differs from the jurisdiction reference ${(expectedRatio! * 100).toFixed(2)}%`;
    if (hasSpecialClassificationExplanation(input)) {
      warnings.push(`${mismatch}; retain the documented special classification explanation and source`);
    } else {
      hardFailures.push(`${mismatch} without a documented classification exception`);
    }
  }

  if (valuationConventionRequiresJanuaryFirst(input.countyRule) && valuationDate) {
    const month = valuationDate.getUTCMonth();
    const day = valuationDate.getUTCDate();
    if (month !== 0 || day !== 1) {
      hardFailures.push(
        `Jurisdiction valuation convention requires January 1, but the workfile uses ${input.valuationDate}`
      );
    }
  }

  if (isCookCounty) {
    if (!input.countyRule?.valuation_date_convention?.trim()) {
      hardFailures.push('Cook County rule is missing its valuation-date convention');
    }
    if (!input.countyRule?.fair_cash_value_synonym) {
      warnings.push(
        'Cook County fair-cash-value terminology is not confirmed in the jurisdiction rule record'
      );
    }
    warnings.push(
      'Cook County equalization is year-specific and must be sourced independently; it is not inferred from the statutory assessment level'
    );
  }

  return {
    applicable,
    isCookCounty,
    expectedAssessmentRatio: isPositiveRatio(expectedRatio) ? expectedRatio : null,
    appliedAssessmentRatio: appliedRatio,
    ratioVariance,
    valuationYear,
    requiresYearSpecificEqualizationSource: isCookCounty,
    warnings,
    hardFailures,
  };
}
