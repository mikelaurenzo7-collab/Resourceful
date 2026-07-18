import type { PropertyType, ReviewTier, ServiceType } from '@/types/database';

export type FunnelEventName =
  | 'Resourceful Intake Step Viewed'
  | 'Resourceful Service Selected'
  | 'Resourceful Property Details Completed'
  | 'Resourceful Situation Completed'
  | 'Resourceful Checkout Initialized'
  | 'Resourceful Photo Evidence Added'
  | 'Resourceful Photo Evidence Skipped'
  | 'Resourceful Intake Success Viewed';

export type FunnelStep = 'goals' | 'property' | 'situation' | 'payment' | 'photos' | 'success' | 'unknown';
export type PhotoEvidenceBucket = 'skipped' | 'none' | 'one' | 'two_to_four' | 'five_plus';
export type IssueCountBucket = 'none' | 'one' | 'two_to_three' | 'four_plus';
export type PriceBand = 'unknown' | 'under_100' | '100_to_249' | '250_to_499' | '500_plus';

export type SafeFunnelProperties = Record<string, string | number | boolean>;

export interface FunnelContextInput {
  pathname: string;
  currentStep: number;
  serviceType: ServiceType | null;
  propertyType: PropertyType | null;
  reviewTier: ReviewTier;
  hasTaxBill: boolean;
  photoCount: number;
  photosSkipped: boolean;
  propertyIssueCount: number;
  priceCents: number;
  hasContext: boolean;
}

export const SAFE_FUNNEL_PROPERTY_KEYS = [
  'step',
  'step_number',
  'service_type',
  'property_type',
  'review_tier',
  'has_tax_bill',
  'photo_evidence',
  'issue_count',
  'price_band',
  'has_context',
] as const;

const PATH_TO_STEP: Record<string, FunnelStep> = {
  '/start': 'goals',
  '/start/property': 'property',
  '/start/situation': 'situation',
  '/start/payment': 'payment',
  '/start/photos': 'photos',
  '/start/success': 'success',
};

export function getFunnelStep(pathname: string): FunnelStep {
  return PATH_TO_STEP[pathname] ?? 'unknown';
}

export function getPhotoEvidenceBucket(photoCount: number, photosSkipped: boolean): PhotoEvidenceBucket {
  if (photosSkipped) return 'skipped';
  if (!Number.isFinite(photoCount) || photoCount <= 0) return 'none';
  if (photoCount === 1) return 'one';
  if (photoCount <= 4) return 'two_to_four';
  return 'five_plus';
}

export function getIssueCountBucket(issueCount: number): IssueCountBucket {
  if (!Number.isFinite(issueCount) || issueCount <= 0) return 'none';
  if (issueCount === 1) return 'one';
  if (issueCount <= 3) return 'two_to_three';
  return 'four_plus';
}

export function getPriceBand(priceCents: number): PriceBand {
  if (!Number.isFinite(priceCents) || priceCents <= 0) return 'unknown';
  if (priceCents < 10_000) return 'under_100';
  if (priceCents < 25_000) return '100_to_249';
  if (priceCents < 50_000) return '250_to_499';
  return '500_plus';
}

export function buildSafeFunnelProperties(input: FunnelContextInput): SafeFunnelProperties {
  const properties: SafeFunnelProperties = {
    step: getFunnelStep(input.pathname),
    step_number: Math.max(1, Math.min(5, Math.trunc(input.currentStep || 1))),
    review_tier: input.reviewTier,
    has_tax_bill: input.hasTaxBill,
    photo_evidence: getPhotoEvidenceBucket(input.photoCount, input.photosSkipped),
    issue_count: getIssueCountBucket(input.propertyIssueCount),
    price_band: getPriceBand(input.priceCents),
    has_context: input.hasContext,
  };

  if (input.serviceType) properties.service_type = input.serviceType;
  if (input.propertyType) properties.property_type = input.propertyType;

  return properties;
}

export function createFunnelFingerprint(
  eventName: FunnelEventName,
  properties: SafeFunnelProperties,
): string {
  const serialized = Object.entries(properties)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');

  return `${eventName}:${serialized}`;
}
