import type { FilingGuide } from '@/lib/templates/report-template';
import {
  evaluateTaxAppealJurisdiction,
  type JurisdictionRuleEvaluation,
} from '@/lib/services/jurisdiction-eligibility';
import type { CountyRule, ServiceType } from '@/types/database';

export type TaxAppealReleaseCode =
  | 'JURISDICTION_RELEASE_NOT_REQUIRED'
  | 'JURISDICTION_RELEASE_READY'
  | 'REPORT_COUNTY_FIPS_MISSING'
  | Exclude<JurisdictionRuleEvaluation['code'], 'JURISDICTION_VERIFIED'>
  | 'FILING_GUIDE_MISSING'
  | 'FILING_GUIDE_INCOMPLETE'
  | 'FILING_AUTHORITY_MISMATCH'
  | 'FILING_DEADLINE_MISMATCH';

export interface TaxAppealReleaseInput {
  serviceType: ServiceType;
  reportCountyFips: string | null | undefined;
  reportState: string | null | undefined;
  countyRule: CountyRule | null;
  filingGuide: FilingGuide | null;
  now?: Date;
}

export type TaxAppealReleaseResult =
  | {
      allowed: true;
      code: 'JURISDICTION_RELEASE_NOT_REQUIRED' | 'JURISDICTION_RELEASE_READY';
      message: string;
      jurisdictionEvaluation: JurisdictionRuleEvaluation | null;
    }
  | {
      allowed: false;
      code: Exclude<
        TaxAppealReleaseCode,
        'JURISDICTION_RELEASE_NOT_REQUIRED' | 'JURISDICTION_RELEASE_READY'
      >;
      message: string;
      jurisdictionEvaluation: JurisdictionRuleEvaluation | null;
    };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedIsoDate(value: string): string | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function deadlinesMatch(guideDeadline: string, verifiedDeadline: string): boolean {
  const guideDate = normalizedIsoDate(guideDeadline);
  const verifiedDate = normalizedIsoDate(verifiedDeadline);
  if (guideDate && verifiedDate) return guideDate === verifiedDate;

  const normalizedGuide = normalizeComparableText(guideDeadline);
  const normalizedVerified = normalizeComparableText(verifiedDeadline);
  return (
    normalizedGuide === normalizedVerified ||
    normalizedGuide.includes(normalizedVerified) ||
    normalizedVerified.includes(normalizedGuide)
  );
}

function jurisdictionFailureMessage(code: Exclude<JurisdictionRuleEvaluation['code'], 'JURISDICTION_VERIFIED'>): string {
  const messages: Record<typeof code, string> = {
    JURISDICTION_NOT_SUPPORTED:
      'Tax-appeal PDF release is blocked because the county jurisdiction is not supported.',
    JURISDICTION_INACTIVE:
      'Tax-appeal PDF release is blocked because the county rule is inactive.',
    JURISDICTION_MISMATCH:
      'Tax-appeal PDF release is blocked because the report jurisdiction does not match the county rule.',
    JURISDICTION_UNVERIFIED:
      'Tax-appeal PDF release is blocked because the county rule has not been validly verified.',
    JURISDICTION_RULES_STALE:
      'Tax-appeal PDF release is blocked because the county filing rules are due for reverification.',
    JURISDICTION_RULES_INCOMPLETE:
      'Tax-appeal PDF release is blocked because the county filing-rule record is incomplete.',
  };
  return messages[code];
}

export function evaluateTaxAppealRelease(
  input: TaxAppealReleaseInput
): TaxAppealReleaseResult {
  if (input.serviceType !== 'tax_appeal') {
    return {
      allowed: true,
      code: 'JURISDICTION_RELEASE_NOT_REQUIRED',
      message: 'A filing-jurisdiction release check is not required for this assignment.',
      jurisdictionEvaluation: null,
    };
  }

  const countyFips = input.reportCountyFips?.trim();
  if (!countyFips) {
    return {
      allowed: false,
      code: 'REPORT_COUNTY_FIPS_MISSING',
      message: 'Tax-appeal PDF release is blocked because the report has no resolved county FIPS.',
      jurisdictionEvaluation: null,
    };
  }

  const jurisdictionEvaluation = evaluateTaxAppealJurisdiction({
    countyFips,
    state: input.reportState,
    rule: input.countyRule,
    now: input.now,
  });

  if (!jurisdictionEvaluation.allowed) {
    return {
      allowed: false,
      code: jurisdictionEvaluation.code,
      message: jurisdictionFailureMessage(jurisdictionEvaluation.code),
      jurisdictionEvaluation,
    };
  }

  const guide = input.filingGuide;
  if (!guide) {
    return {
      allowed: false,
      code: 'FILING_GUIDE_MISSING',
      message: 'Tax-appeal PDF release is blocked because the filing guide is missing.',
      jurisdictionEvaluation,
    };
  }

  const hasSteps = Array.isArray(guide.steps) && guide.steps.some(hasText);
  const hasRequiredDocuments =
    Array.isArray(guide.required_documents) && guide.required_documents.some(hasText);
  if (
    !hasText(guide.appeal_board_name) ||
    !hasText(guide.filing_deadline) ||
    !hasSteps ||
    !hasRequiredDocuments
  ) {
    return {
      allowed: false,
      code: 'FILING_GUIDE_INCOMPLETE',
      message:
        'Tax-appeal PDF release is blocked because the filing guide lacks an authority, deadline, filing steps, or required documents.',
      jurisdictionEvaluation,
    };
  }

  if (
    normalizeComparableText(guide.appeal_board_name) !==
    normalizeComparableText(jurisdictionEvaluation.filingAuthority)
  ) {
    return {
      allowed: false,
      code: 'FILING_AUTHORITY_MISMATCH',
      message:
        'Tax-appeal PDF release is blocked because the filing-guide authority does not match the verified county authority.',
      jurisdictionEvaluation,
    };
  }

  if (!deadlinesMatch(guide.filing_deadline, jurisdictionEvaluation.filingDeadline)) {
    return {
      allowed: false,
      code: 'FILING_DEADLINE_MISMATCH',
      message:
        'Tax-appeal PDF release is blocked because the filing-guide deadline does not match the current verified county rule.',
      jurisdictionEvaluation,
    };
  }

  return {
    allowed: true,
    code: 'JURISDICTION_RELEASE_READY',
    message: 'The tax-appeal filing package matches the current verified jurisdiction record.',
    jurisdictionEvaluation,
  };
}
