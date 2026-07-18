import type { CountyRule, PropertyType, ServiceType } from '@/types/database';
import {
  isCookCountyJurisdiction,
  isHttpUrl,
} from './workfile-provenance';

const RATIO_TOLERANCE = 0.005;
const SPECIAL_CLASSIFICATION_PATTERN =
  /non[- ]?profit|incentive|preferential|special(?:\s+classification)?|exempt|class\s*\d+[a-z-]*|mixed[- ]?use/i;

type ValuationYearOffset = -1 | 0 | null;

export interface AssessmentContextPolicyInput {
  serviceType: ServiceType;
  countyFips: string | null | undefined;
  propertyType: PropertyType;
  taxYearInAppeal: number | null | undefined;
  valuationDate: string | null | undefined;
  assessmentRatio: number | null | undefined;
  assessmentMethodology: string | null | undefined;
  propertyClassDescription: string | null | undefined;
  classificationSourceAuthority?: string | null | undefined;
  classificationSourceUrl?: string | null | undefined;
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

function hasSourcedSpecialClassification(input: AssessmentContextPolicyInput): boolean {
  const explanation = [input.assessmentMethodology, input.propertyClassDescription]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');
  const authority = input.classificationSourceAuthority?.trim();

  return (
    SPECIAL_CLASSIFICATION_PATTERN.test(explanation) &&
    Boolean(authority) &&
    isHttpUrl(input.classificationSourceUrl)
  );
}

function normalizedValuationConvention(rule: CountyRule | null | undefined): string {
  return rule?.valuation_date_convention?.trim().toLowerCase() ?? '';
}

function valuationYearOffset(rule: CountyRule | null | undefined): ValuationYearOffset {
  const convention = normalizedValuationConvention(rule);
  if (!convention) return null;

  if (/\b(prior|preceding|previous)\b[^.]{0,40}\byear\b|\byear\b[^.]{0,40}\b(prior|preceding|previous)\b/.test(convention)) {
    return -1;
  }

  if (
    /\b(assessment|tax|same|current)\s+year\b/.test(convention) ||
    /january\s*1(?:st)?(?:\s+of)?\s+(?:each|every)\s+year/.test(convention)
  ) {
    return 0;
  }

  return null;
}

function valuationConventionRequiresJanuaryFirst(rule: CountyRule | null | undefined): boolean {
  const convention = normalizedValuationConvention(rule);
  if (!convention) return false;
  return /january\s*1|jan\.?\s*1|first day of january/.test(convention);
}

export function evaluateAssessmentContext(
  input: AssessmentContextPolicyInput
): AssessmentContextPolicyResult {
  const applicable = input.serviceType === 'tax_appeal';
  const isCookCounty = isCookCountyJurisdiction(input.countyRule);
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
  const convention = normalizedValuationConvention(input.countyRule);
  const yearOffset = valuationYearOffset(input.countyRule);

  if (taxYear != null && valuationYear != null) {
    if (yearOffset != null) {
      const expectedValuationYear = taxYear + yearOffset;
      if (valuationYear !== expectedValuationYear) {
        hardFailures.push(
          `Valuation year ${valuationYear} conflicts with the verified jurisdiction convention for assessment year ${taxYear}; expected ${expectedValuationYear}`
        );
      }
    } else if (valuationYear !== taxYear) {
      hardFailures.push(
        `Valuation year ${valuationYear} differs from assessment year ${taxYear}, and the verified jurisdiction rule does not document a cross-year convention`
      );
    } else if (!convention && !isCookCounty) {
      warnings.push(
        'Jurisdiction rule does not document a valuation-date convention; the same-year effective date requires manual confirmation'
      );
    }
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

  if (expectedRatio == null) {
    hardFailures.push('Verified jurisdiction rule does not provide an assessment level for this property type');
  }

  if (ratioVariance != null && Math.abs(ratioVariance) > RATIO_TOLERANCE) {
    const mismatch = `Applied assessment level ${(appliedRatio! * 100).toFixed(2)}% differs from the jurisdiction reference ${(expectedRatio! * 100).toFixed(2)}%`;
    if (hasSourcedSpecialClassification(input)) {
      warnings.push(`${mismatch}; verified special-classification evidence is attached to the workfile`);
    } else {
      hardFailures.push(
        `${mismatch} without a sourced classification exception from an official authority`
      );
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
    if (!convention) {
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
