import { describe, it, expect } from 'vitest';
import {
  reportCreateSchema,
  measurementSchema,
  photoUploadSchema,
  adminRejectSchema,
  adminRegenerateSchema,
  countyRuleSchema,
} from './report';

// ─── reportCreateSchema ─────────────────────────────────────────────────────

describe('reportCreateSchema', () => {
  const validInput = {
    client_email: 'test@example.com',
    property_address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    county: 'Sangamon',
    property_type: 'residential' as const,
    service_type: 'tax_appeal' as const,
  };

  it('accepts valid minimal input', () => {
    const result = reportCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = reportCreateSchema.safeParse({ ...validInput, client_email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects empty address', () => {
    const result = reportCreateSchema.safeParse({ ...validInput, property_address: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid state code', () => {
    const result = reportCreateSchema.safeParse({ ...validInput, state: 'Illinois' });
    expect(result.success).toBe(false);
  });

  it('accepts 2-letter state code', () => {
    const result = reportCreateSchema.safeParse({ ...validInput, state: 'CA' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid property type', () => {
    const result = reportCreateSchema.safeParse({ ...validInput, property_type: 'condo' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid property types', () => {
    for (const pt of ['residential', 'commercial', 'industrial', 'land']) {
      const result = reportCreateSchema.safeParse({ ...validInput, property_type: pt });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid service types', () => {
    for (const st of ['tax_appeal', 'pre_purchase', 'pre_listing']) {
      const result = reportCreateSchema.safeParse({ ...validInput, service_type: st });
      expect(result.success).toBe(true);
    }
  });

  it('defaults review_tier to auto', () => {
    const result = reportCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.review_tier).toBe('auto');
    }
  });

  it('accepts expert_reviewed tier', () => {
    const result = reportCreateSchema.safeParse({ ...validInput, review_tier: 'expert_reviewed' });
    expect(result.success).toBe(true);
  });

  it('defaults photos_skipped to false', () => {
    const result = reportCreateSchema.safeParse(validInput);
    if (result.success) {
      expect(result.data.photos_skipped).toBe(false);
    }
  });

  it('accepts tax bill data', () => {
    const result = reportCreateSchema.safeParse({
      ...validInput,
      has_tax_bill: true,
      tax_bill_assessed_value: 250000,
      tax_bill_tax_amount: 5000,
      tax_bill_tax_year: '2025',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative tax bill values', () => {
    const result = reportCreateSchema.safeParse({
      ...validInput,
      tax_bill_assessed_value: -100,
    });
    expect(result.success).toBe(false);
  });
});

// ─── measurementSchema ──────────────────────────────────────────────────────

describe('measurementSchema', () => {
  it('accepts valid measurement', () => {
    const result = measurementSchema.safeParse({
      source: 'user_submitted',
      north_wall_ft: 50,
      south_wall_ft: 50,
      east_wall_ft: 30,
      west_wall_ft: 30,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid sources', () => {
    for (const source of ['google_earth', 'user_submitted', 'attom', 'county']) {
      const result = measurementSchema.safeParse({ source });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid source', () => {
    const result = measurementSchema.safeParse({ source: 'zillow' });
    expect(result.success).toBe(false);
  });

  it('rejects negative wall measurements', () => {
    const result = measurementSchema.safeParse({ source: 'user_submitted', north_wall_ft: -10 });
    expect(result.success).toBe(false);
  });
});

// ─── photoUploadSchema ──────────────────────────────────────────────────────

describe('photoUploadSchema', () => {
  it('accepts valid photo upload', () => {
    const result = photoUploadSchema.safeParse({
      photo_type: 'exterior_front',
      sort_order: 0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts caption', () => {
    const result = photoUploadSchema.safeParse({
      photo_type: 'deferred_maintenance',
      caption: 'Water stain on basement wall, south side',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid photo type', () => {
    const result = photoUploadSchema.safeParse({ photo_type: 'selfie' });
    expect(result.success).toBe(false);
  });

  it('accepts interior types', () => {
    for (const type of ['interior_basement', 'interior_kitchen', 'interior_bathroom']) {
      const result = photoUploadSchema.safeParse({ photo_type: type });
      expect(result.success).toBe(true);
    }
  });
});

// ─── adminRejectSchema ──────────────────────────────────────────────────────

describe('adminRejectSchema', () => {
  it('accepts valid rejection notes', () => {
    const result = adminRejectSchema.safeParse({ notes: 'Comps are too distant, need closer matches' });
    expect(result.success).toBe(true);
  });

  it('rejects notes shorter than 10 chars', () => {
    const result = adminRejectSchema.safeParse({ notes: 'bad' });
    expect(result.success).toBe(false);
  });
});

// ─── adminRegenerateSchema ──────────────────────────────────────────────────

describe('adminRegenerateSchema', () => {
  it('accepts valid section name', () => {
    const result = adminRegenerateSchema.safeParse({ section_name: 'executive_summary' });
    expect(result.success).toBe(true);
  });

  it('rejects empty section name', () => {
    const result = adminRegenerateSchema.safeParse({ section_name: '' });
    expect(result.success).toBe(false);
  });
});

// ─── countyRuleSchema ──────────────────────────────────────────────────────

describe('countyRuleSchema', () => {
  const minimal = {
    county_fips: '17031',
    county_name: 'Cook',
    state_name: 'Illinois',
    state_abbreviation: 'IL',
  };

  it('accepts minimal valid county rule', () => {
    const result = countyRuleSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('accepts full valid county rule', () => {
    const result = countyRuleSchema.safeParse({
      ...minimal,
      assessment_methodology: 'fractional',
      assessment_ratio_residential: 0.33,
      assessment_ratio_commercial: 0.25,
      assessment_ratio_industrial: 0.25,
      appeal_board_name: 'Cook County Board of Review',
      portal_url: 'https://www.cookcountyboardofreview.com',
      filing_email: 'appeals@cookcounty.gov',
      accepts_online_filing: true,
      filing_fee_cents: 2500,
      hearing_format: 'both',
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty county_fips', () => {
    const result = countyRuleSchema.safeParse({ ...minimal, county_fips: '' });
    expect(result.success).toBe(false);
  });

  it('rejects state_abbreviation not exactly 2 chars', () => {
    expect(countyRuleSchema.safeParse({ ...minimal, state_abbreviation: 'ILL' }).success).toBe(false);
    expect(countyRuleSchema.safeParse({ ...minimal, state_abbreviation: 'I' }).success).toBe(false);
  });

  it('accepts assessment_ratio at boundaries (0, 0.5, 1.0)', () => {
    expect(countyRuleSchema.safeParse({ ...minimal, assessment_ratio_residential: 0 }).success).toBe(true);
    expect(countyRuleSchema.safeParse({ ...minimal, assessment_ratio_residential: 0.5 }).success).toBe(true);
    expect(countyRuleSchema.safeParse({ ...minimal, assessment_ratio_residential: 1.0 }).success).toBe(true);
  });

  it('rejects assessment_ratio > 1', () => {
    const result = countyRuleSchema.safeParse({ ...minimal, assessment_ratio_residential: 1.5 });
    expect(result.success).toBe(false);
  });

  it('validates URL fields when present', () => {
    expect(countyRuleSchema.safeParse({ ...minimal, portal_url: 'not-a-url' }).success).toBe(false);
    expect(countyRuleSchema.safeParse({ ...minimal, portal_url: 'https://example.com' }).success).toBe(true);
  });

  it('validates email field when present', () => {
    expect(countyRuleSchema.safeParse({ ...minimal, filing_email: 'not-email' }).success).toBe(false);
    expect(countyRuleSchema.safeParse({ ...minimal, filing_email: 'test@gov.com' }).success).toBe(true);
  });

  it('rejects negative filing_fee_cents', () => {
    const result = countyRuleSchema.safeParse({ ...minimal, filing_fee_cents: -100 });
    expect(result.success).toBe(false);
  });

  it('defaults is_active to true and accepts_online_filing to false', () => {
    const result = countyRuleSchema.safeParse(minimal);
    if (result.success) {
      expect(result.data.is_active).toBe(true);
      expect(result.data.accepts_online_filing).toBe(false);
    }
  });
});

// ─── reportCreateSchema — additional tier values ───────────────────────────

describe('reportCreateSchema — additional tiers', () => {
  const base = {
    client_email: 'test@example.com',
    property_address: '123 Main St',
    property_type: 'residential',
    service_type: 'tax_appeal',
  };

  it('accepts guided_filing review_tier', () => {
    const result = reportCreateSchema.safeParse({ ...base, review_tier: 'guided_filing' });
    expect(result.success).toBe(true);
  });

  it('accepts full_representation review_tier', () => {
    const result = reportCreateSchema.safeParse({ ...base, review_tier: 'full_representation' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid review_tier value', () => {
    const result = reportCreateSchema.safeParse({ ...base, review_tier: 'premium_deluxe' });
    expect(result.success).toBe(false);
  });
});
