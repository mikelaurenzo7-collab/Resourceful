import { describe, expect, it } from 'vitest';

import {
  SAFE_FUNNEL_PROPERTY_KEYS,
  buildSafeFunnelProperties,
  createFunnelFingerprint,
  getFunnelStep,
  getIssueCountBucket,
  getPhotoEvidenceBucket,
  getPriceBand,
} from './funnel-contract';

const baseInput = {
  pathname: '/start/payment',
  currentStep: 4,
  serviceType: 'tax_appeal' as const,
  propertyType: 'residential' as const,
  reviewTier: 'expert_reviewed' as const,
  hasTaxBill: true,
  photoCount: 3,
  photosSkipped: false,
  propertyIssueCount: 2,
  priceCents: 14_900,
  hasContext: true,
};

describe('funnel analytics contract', () => {
  it('maps only canonical intake routes', () => {
    expect(getFunnelStep('/start')).toBe('goals');
    expect(getFunnelStep('/start/success')).toBe('success');
    expect(getFunnelStep('/report/private-id')).toBe('unknown');
  });

  it('buckets evidence, issue counts, and prices without exposing raw values', () => {
    expect(getPhotoEvidenceBucket(0, true)).toBe('skipped');
    expect(getPhotoEvidenceBucket(1, false)).toBe('one');
    expect(getPhotoEvidenceBucket(4, false)).toBe('two_to_four');
    expect(getPhotoEvidenceBucket(5, false)).toBe('five_plus');

    expect(getIssueCountBucket(0)).toBe('none');
    expect(getIssueCountBucket(1)).toBe('one');
    expect(getIssueCountBucket(3)).toBe('two_to_three');
    expect(getIssueCountBucket(4)).toBe('four_plus');

    expect(getPriceBand(0)).toBe('unknown');
    expect(getPriceBand(9_900)).toBe('under_100');
    expect(getPriceBand(14_900)).toBe('100_to_249');
    expect(getPriceBand(39_900)).toBe('250_to_499');
    expect(getPriceBand(50_000)).toBe('500_plus');
  });

  it('produces an allowlisted categorical payload with no PII fields', () => {
    const properties = buildSafeFunnelProperties(baseInput);

    expect(properties).toEqual({
      step: 'payment',
      step_number: 4,
      service_type: 'tax_appeal',
      property_type: 'residential',
      review_tier: 'expert_reviewed',
      has_tax_bill: true,
      photo_evidence: 'two_to_four',
      issue_count: 'two_to_three',
      price_band: '100_to_249',
      has_context: true,
    });

    expect(Object.keys(properties).every((key) => SAFE_FUNNEL_PROPERTY_KEYS.includes(
      key as (typeof SAFE_FUNNEL_PROPERTY_KEYS)[number],
    ))).toBe(true);

    for (const forbidden of [
      'address',
      'city',
      'state',
      'county',
      'zip',
      'email',
      'name',
      'pin',
      'parcel',
      'report_id',
      'desired_outcome',
      'additional_notes',
    ]) {
      expect(properties).not.toHaveProperty(forbidden);
    }
  });

  it('creates stable fingerprints regardless of property insertion order', () => {
    const left = createFunnelFingerprint('Resourceful Checkout Initialized', {
      step: 'payment',
      service_type: 'tax_appeal',
      price_band: '100_to_249',
    });
    const right = createFunnelFingerprint('Resourceful Checkout Initialized', {
      price_band: '100_to_249',
      service_type: 'tax_appeal',
      step: 'payment',
    });

    expect(left).toBe(right);
  });
});
