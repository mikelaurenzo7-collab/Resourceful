import type { ServiceType } from '@/types/database';

export const INDEPENDENT_VALUATION_MARKER = '[INDEPENDENT_VALUATION]';

export type AssignmentKind =
  | 'tax_appeal'
  | 'pre_purchase'
  | 'pre_listing'
  | 'independent_valuation';

export type ActionGuideSectionName =
  | 'pro_se_filing_guide'
  | 'negotiation_guide'
  | 'pricing_strategy_guide'
  | 'valuation_use_guide';

export function isIndependentValuationPurpose(
  desiredOutcome: string | null | undefined
): boolean {
  return desiredOutcome?.trim().startsWith(INDEPENDENT_VALUATION_MARKER) ?? false;
}

export function stripIndependentValuationMarker(
  desiredOutcome: string | null | undefined
): string {
  const normalized = desiredOutcome?.trim() ?? '';
  if (!normalized.startsWith(INDEPENDENT_VALUATION_MARKER)) return normalized;
  return normalized.slice(INDEPENDENT_VALUATION_MARKER.length).trim();
}

export function markIndependentValuationPurpose(purpose: string): string {
  const normalized = stripIndependentValuationMarker(purpose);
  return `${INDEPENDENT_VALUATION_MARKER}${normalized ? ` ${normalized}` : ''}`;
}

export function resolveAssignmentKind(
  serviceType: ServiceType | string,
  desiredOutcome?: string | null
): AssignmentKind {
  if (isIndependentValuationPurpose(desiredOutcome)) return 'independent_valuation';

  if (serviceType === 'tax_appeal') return 'tax_appeal';
  if (serviceType === 'pre_listing') return 'pre_listing';
  return 'pre_purchase';
}

export function getActionGuideSectionName(
  serviceType: ServiceType | string,
  desiredOutcome?: string | null
): ActionGuideSectionName {
  switch (resolveAssignmentKind(serviceType, desiredOutcome)) {
    case 'tax_appeal':
      return 'pro_se_filing_guide';
    case 'pre_listing':
      return 'pricing_strategy_guide';
    case 'independent_valuation':
      return 'valuation_use_guide';
    case 'pre_purchase':
    default:
      return 'negotiation_guide';
  }
}

export function getAssignmentDisplayLabel(
  serviceType: ServiceType | string,
  desiredOutcome?: string | null
): string {
  switch (resolveAssignmentKind(serviceType, desiredOutcome)) {
    case 'tax_appeal':
      return 'Property Tax Appeal Analysis';
    case 'pre_listing':
      return 'Pre-Listing Analysis';
    case 'independent_valuation':
      return 'Independent Valuation Analysis';
    case 'pre_purchase':
    default:
      return 'Pre-Purchase Analysis';
  }
}

export function getReportDocumentSubject(
  serviceType: ServiceType | string,
  desiredOutcome?: string | null
): string {
  switch (resolveAssignmentKind(serviceType, desiredOutcome)) {
    case 'tax_appeal':
      return 'Property Tax Appeal Valuation Analysis';
    case 'pre_listing':
      return 'Pre-Listing Property Valuation Analysis';
    case 'independent_valuation':
      return 'Independent Property Valuation Analysis';
    case 'pre_purchase':
    default:
      return 'Pre-Purchase Property Valuation Analysis';
  }
}
