import { getCountyByFips } from '@/lib/repository/county-rules';
import { geocodeAddress } from '@/lib/services/azure-maps';
import type { CountyRule, ServiceType } from '@/types/database';

export const MAX_JURISDICTION_RULE_AGE_DAYS = 180;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type JurisdictionEligibilityCode =
  | 'JURISDICTION_NOT_REQUIRED'
  | 'JURISDICTION_VERIFIED'
  | 'ADDRESS_VERIFICATION_FAILED'
  | 'COUNTY_FIPS_UNRESOLVED'
  | 'JURISDICTION_NOT_SUPPORTED'
  | 'JURISDICTION_INACTIVE'
  | 'JURISDICTION_MISMATCH'
  | 'JURISDICTION_UNVERIFIED'
  | 'JURISDICTION_RULES_STALE'
  | 'JURISDICTION_RULES_INCOMPLETE';

export interface ResolvedJurisdiction {
  formattedAddress: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  countyFips: string;
  latitude: number;
  longitude: number;
  ruleLastVerifiedDate: string;
  filingAuthority: string;
  filingDeadline: string;
}

export type JurisdictionEligibilityResult =
  | {
      allowed: true;
      code: 'JURISDICTION_NOT_REQUIRED';
      message: string;
      jurisdiction: null;
    }
  | {
      allowed: true;
      code: 'JURISDICTION_VERIFIED';
      message: string;
      jurisdiction: ResolvedJurisdiction;
    }
  | {
      allowed: false;
      code: Exclude<
        JurisdictionEligibilityCode,
        'JURISDICTION_NOT_REQUIRED' | 'JURISDICTION_VERIFIED'
      >;
      message: string;
      jurisdiction: Partial<ResolvedJurisdiction> | null;
      retryable: boolean;
    };

export interface JurisdictionScreenInput {
  serviceType: ServiceType;
  propertyAddress: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
}

export interface JurisdictionRuleEvaluationInput {
  countyFips: string;
  state: string | null | undefined;
  rule: CountyRule | null;
  now?: Date;
}

export type JurisdictionRuleEvaluation =
  | {
      allowed: true;
      code: 'JURISDICTION_VERIFIED';
      filingAuthority: string;
      filingDeadline: string;
      ruleLastVerifiedDate: string;
    }
  | {
      allowed: false;
      code:
        | 'JURISDICTION_NOT_SUPPORTED'
        | 'JURISDICTION_INACTIVE'
        | 'JURISDICTION_MISMATCH'
        | 'JURISDICTION_UNVERIFIED'
        | 'JURISDICTION_RULES_STALE'
        | 'JURISDICTION_RULES_INCOMPLETE';
      message: string;
      retryable: boolean;
    };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function joinAddress(input: JurisdictionScreenInput): string {
  return [input.propertyAddress, input.city, input.state, input.zip]
    .filter(hasText)
    .join(', ');
}

function normalizeCounty(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s*(County|Parish|Borough|Census Area|Municipality)$/i, '')
    .trim();
}

function normalizeState(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function firstAddressLine(formattedAddress: string, fallback: string): string {
  const [line1] = formattedAddress.split(',');
  return line1?.trim() || fallback.trim();
}

function currentFilingDeadline(rule: CountyRule, now: Date): string {
  if (hasText(rule.next_appeal_deadline)) {
    const exactDeadline = new Date(`${rule.next_appeal_deadline}T23:59:59`);
    if (!Number.isNaN(exactDeadline.getTime()) && exactDeadline.getTime() >= now.getTime()) {
      return rule.next_appeal_deadline;
    }
  }

  return hasText(rule.appeal_deadline_rule)
    ? rule.appeal_deadline_rule.trim()
    : '';
}

function hasVerifiedFilingChannel(rule: CountyRule): boolean {
  const online = rule.accepts_online_filing && hasText(rule.portal_url);
  const email = rule.accepts_email_filing && hasText(rule.filing_email);
  const mail = rule.requires_mail_filing && hasText(rule.appeal_board_address);
  const publishedForm = hasText(rule.form_download_url);
  const authorityAddress = hasText(rule.appeal_board_address);

  return online || email || mail || publishedForm || authorityAddress;
}

function hasVerifiedEvidenceRequirements(rule: CountyRule): boolean {
  return (
    (Array.isArray(rule.required_documents) && rule.required_documents.length > 0) ||
    (Array.isArray(rule.evidence_requirements) && rule.evidence_requirements.length > 0)
  );
}

export function evaluateTaxAppealJurisdiction(
  input: JurisdictionRuleEvaluationInput
): JurisdictionRuleEvaluation {
  const { countyFips, rule } = input;
  const state = normalizeState(input.state);
  const now = input.now ?? new Date();

  if (!rule) {
    return {
      allowed: false,
      code: 'JURISDICTION_NOT_SUPPORTED',
      message:
        'Resourceful has not yet verified the filing rules for this county. No payment was collected. Contact support for a manual eligibility review.',
      retryable: false,
    };
  }

  if (!rule.is_active) {
    return {
      allowed: false,
      code: 'JURISDICTION_INACTIVE',
      message:
        'This county is temporarily unavailable while its filing rules are being reviewed. No payment was collected.',
      retryable: true,
    };
  }

  if (rule.county_fips !== countyFips) {
    return {
      allowed: false,
      code: 'JURISDICTION_MISMATCH',
      message:
        'The resolved county does not match Resourceful’s jurisdiction record. No payment was collected.',
      retryable: true,
    };
  }

  if (state && normalizeState(rule.state_abbreviation) !== state) {
    return {
      allowed: false,
      code: 'JURISDICTION_MISMATCH',
      message:
        'The resolved state does not match Resourceful’s jurisdiction record. No payment was collected.',
      retryable: true,
    };
  }

  if (!hasText(rule.last_verified_date)) {
    return {
      allowed: false,
      code: 'JURISDICTION_UNVERIFIED',
      message:
        'Resourceful must verify this county’s current filing rules before accepting payment.',
      retryable: true,
    };
  }

  const verifiedAt = new Date(rule.last_verified_date);
  if (Number.isNaN(verifiedAt.getTime()) || verifiedAt.getTime() > now.getTime() + ONE_DAY_MS) {
    return {
      allowed: false,
      code: 'JURISDICTION_UNVERIFIED',
      message:
        'Resourceful’s jurisdiction verification record is invalid and must be reviewed before purchase.',
      retryable: true,
    };
  }

  const ageDays = Math.floor((now.getTime() - verifiedAt.getTime()) / ONE_DAY_MS);
  if (ageDays > MAX_JURISDICTION_RULE_AGE_DAYS) {
    return {
      allowed: false,
      code: 'JURISDICTION_RULES_STALE',
      message:
        'This county’s filing rules are due for reverification. No payment was collected while Resourceful confirms the current requirements.',
      retryable: true,
    };
  }

  const filingAuthority = rule.appeal_board_name?.trim() ?? '';
  const filingDeadline = currentFilingDeadline(rule, now);
  const hasFilingChannel = hasVerifiedFilingChannel(rule);
  const hasEvidenceRequirements = hasVerifiedEvidenceRequirements(rule);

  if (!filingAuthority || !filingDeadline || !hasFilingChannel || !hasEvidenceRequirements) {
    return {
      allowed: false,
      code: 'JURISDICTION_RULES_INCOMPLETE',
      message:
        'Resourceful has not completed the filing authority, current deadline, filing channel, and evidence-requirement record for this county. No payment was collected.',
      retryable: true,
    };
  }

  return {
    allowed: true,
    code: 'JURISDICTION_VERIFIED',
    filingAuthority,
    filingDeadline,
    ruleLastVerifiedDate: rule.last_verified_date,
  };
}

export async function screenServiceJurisdiction(
  input: JurisdictionScreenInput
): Promise<JurisdictionEligibilityResult> {
  if (input.serviceType !== 'tax_appeal') {
    return {
      allowed: true,
      code: 'JURISDICTION_NOT_REQUIRED',
      message: 'Jurisdiction filing verification is not required for this analysis.',
      jurisdiction: null,
    };
  }

  const fullAddress = joinAddress(input);
  const geocode = await geocodeAddress(fullAddress);
  if (!geocode.data) {
    return {
      allowed: false,
      code: 'ADDRESS_VERIFICATION_FAILED',
      message:
        'Resourceful could not verify this property address and county. No payment was collected. Select a complete address or try again.',
      jurisdiction: null,
      retryable: true,
    };
  }

  const resolved = geocode.data;
  if (!hasText(resolved.countyFips)) {
    return {
      allowed: false,
      code: 'COUNTY_FIPS_UNRESOLVED',
      message:
        'Resourceful could not resolve the county jurisdiction for this address. No payment was collected.',
      jurisdiction: {
        formattedAddress: resolved.formattedAddress,
        city: resolved.city ?? input.city ?? '',
        state: normalizeState(resolved.state ?? input.state),
        zip: resolved.zip ?? input.zip ?? '',
        county: normalizeCounty(resolved.county ?? input.county),
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      },
      retryable: true,
    };
  }

  const rule = await getCountyByFips(resolved.countyFips);
  const evaluation = evaluateTaxAppealJurisdiction({
    countyFips: resolved.countyFips,
    state: resolved.state ?? input.state,
    rule,
  });

  const jurisdictionBase = {
    formattedAddress: resolved.formattedAddress,
    line1: firstAddressLine(resolved.formattedAddress, input.propertyAddress),
    city: resolved.city ?? input.city ?? '',
    state: normalizeState(resolved.state ?? input.state),
    zip: resolved.zip ?? input.zip ?? '',
    county: normalizeCounty(resolved.county ?? input.county),
    countyFips: resolved.countyFips,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
  };

  if (!evaluation.allowed) {
    return {
      allowed: false,
      code: evaluation.code,
      message: evaluation.message,
      jurisdiction: jurisdictionBase,
      retryable: evaluation.retryable,
    };
  }

  return {
    allowed: true,
    code: 'JURISDICTION_VERIFIED',
    message: `Resourceful verified ${jurisdictionBase.county} County’s filing authority and current appeal requirements.`,
    jurisdiction: {
      ...jurisdictionBase,
      ruleLastVerifiedDate: evaluation.ruleLastVerifiedDate,
      filingAuthority: evaluation.filingAuthority,
      filingDeadline: evaluation.filingDeadline,
    },
  };
}
