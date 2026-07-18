import { describe, expect, it } from 'vitest';
import type { CountyRule } from '@/types/database';
import { evaluateAssessmentContext } from './assessment-context-policy';

type CountyRuleFixture = CountyRule & {
  jurisdiction_plugin_key?: string | null;
  jurisdiction_plugin_version?: number | null;
};

function countyRule(overrides: Partial<CountyRuleFixture> = {}): CountyRuleFixture {
  return {
    county_fips: '17031',
    county_name: 'Cook County',
    state_name: 'Illinois',
    state_abbreviation: 'IL',
    assessment_ratio_residential: 0.1,
    assessment_ratio_commercial: 0.25,
    assessment_ratio_industrial: 0.25,
    assessment_ratio_agricultural: null,
    assessment_methodology: 'Cook County classification system',
    assessment_methodology_notes: null,
    appeal_board_name: 'Cook County Board of Review',
    appeal_board_address: null,
    appeal_board_phone: null,
    portal_url: null,
    filing_email: null,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    appeal_deadline_rule: 'Township-specific annual window',
    tax_year_appeal_window: null,
    typical_resolution_weeks_min: null,
    typical_resolution_weeks_max: null,
    hearing_typically_required: false,
    hearing_format: null,
    appeal_form_name: null,
    form_download_url: null,
    evidence_requirements: null,
    filing_fee_cents: 0,
    filing_fee_notes: null,
    assessor_api_url: null,
    assessor_api_documentation_url: null,
    assessor_api_notes: null,
    pro_se_tips: null,
    assessment_cycle: null,
    assessment_notices_mailed: null,
    appeal_window_days: null,
    appeal_window_start_month: null,
    appeal_window_end_month: null,
    appeal_window_end_day: null,
    next_appeal_deadline: null,
    current_tax_year: 2025,
    filing_steps: null,
    required_documents: null,
    informal_review_available: false,
    informal_review_notes: null,
    hearing_duration_minutes: null,
    hearing_scheduling_notes: null,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    authorized_rep_allowed: null,
    authorized_rep_form_url: null,
    authorized_rep_types: null,
    rep_restrictions_notes: null,
    further_appeal_body: null,
    further_appeal_deadline_rule: null,
    further_appeal_url: null,
    further_appeal_fee_cents: 0,
    board_personality_notes: null,
    winning_argument_patterns: null,
    common_assessor_errors: null,
    success_rate_pct: null,
    success_rate_source: null,
    avg_savings_pct: null,
    land_ratio_residential: null,
    land_ratio_commercial: null,
    land_ratio_industrial: null,
    level_of_assessment_commercial: 0.25,
    level_of_assessment_residential: 0.1,
    cost_approach_disfavored: true,
    valuation_date_convention: 'January 1 of the assessment year',
    fair_cash_value_synonym: true,
    is_active: true,
    last_verified_date: '2026-07-01',
    verified_by: 'operations',
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-07-01',
    jurisdiction_plugin_key: 'cook_county_classification',
    jurisdiction_plugin_version: 1,
    ...overrides,
  };
}

describe('evaluateAssessmentContext', () => {
  it('bypasses non-tax assignments', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'pre_purchase',
      countyFips: '17031',
      propertyType: 'residential',
      taxYearInAppeal: null,
      valuationDate: '2025-01-01',
      assessmentRatio: null,
      assessmentMethodology: null,
      propertyClassDescription: null,
      countyRule: null,
    });

    expect(result.applicable).toBe(false);
    expect(result.hardFailures).toEqual([]);
  });

  it('accepts a configured Cook County commercial appeal and requires year-specific sourcing', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '17031',
      propertyType: 'commercial',
      taxYearInAppeal: 2025,
      valuationDate: '2025-01-01',
      assessmentRatio: 0.25,
      assessmentMethodology: 'Cook County commercial classification',
      propertyClassDescription: 'Commercial building',
      countyRule: countyRule(),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.expectedAssessmentRatio).toBe(0.25);
    expect(result.requiresYearSpecificEqualizationSource).toBe(true);
  });

  it('does not activate Cook County behavior from FIPS alone', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '17031',
      propertyType: 'commercial',
      taxYearInAppeal: 2025,
      valuationDate: '2025-01-01',
      assessmentRatio: 0.25,
      assessmentMethodology: 'Commercial classification',
      propertyClassDescription: 'Commercial building',
      countyRule: countyRule({
        jurisdiction_plugin_key: null,
        jurisdiction_plugin_version: null,
      }),
    });

    expect(result.isCookCounty).toBe(false);
    expect(result.requiresYearSpecificEqualizationSource).toBe(false);
  });

  it('accepts an explicit prior-year valuation convention', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '99998',
      propertyType: 'residential',
      taxYearInAppeal: 2025,
      valuationDate: '2024-01-01',
      assessmentRatio: 0.1,
      assessmentMethodology: 'Residential assessment',
      propertyClassDescription: 'Single-family residence',
      countyRule: countyRule({
        county_fips: '99998',
        county_name: 'Prior Year County',
        state_abbreviation: 'PY',
        state_name: 'Prior Year State',
        valuation_date_convention: 'January 1 of the preceding year',
        jurisdiction_plugin_key: null,
        jurisdiction_plugin_version: null,
      }),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.valuationYear).toBe(2024);
  });

  it('blocks an unexplained cross-year effective date', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '99997',
      propertyType: 'residential',
      taxYearInAppeal: 2025,
      valuationDate: '2024-01-01',
      assessmentRatio: 0.1,
      assessmentMethodology: 'Residential assessment',
      propertyClassDescription: 'Single-family residence',
      countyRule: countyRule({
        county_fips: '99997',
        county_name: 'Unspecified Convention County',
        state_abbreviation: 'UC',
        state_name: 'Unspecified Convention State',
        valuation_date_convention: null,
        jurisdiction_plugin_key: null,
        jurisdiction_plugin_version: null,
      }),
    });

    expect(result.hardFailures.some((failure) => failure.includes('cross-year convention'))).toBe(true);
  });

  it('prefers an explicit industrial level', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '99999',
      propertyType: 'industrial',
      taxYearInAppeal: 2025,
      valuationDate: '2025-01-01',
      assessmentRatio: 0.2,
      assessmentMethodology: 'Industrial classification',
      propertyClassDescription: 'Warehouse',
      countyRule: countyRule({
        county_fips: '99999',
        county_name: 'Example County',
        assessment_ratio_commercial: 0.25,
        assessment_ratio_industrial: 0.2,
        level_of_assessment_commercial: 0.25,
        jurisdiction_plugin_key: null,
        jurisdiction_plugin_version: null,
      }),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.expectedAssessmentRatio).toBe(0.2);
  });

  it('rejects a valuation date that contradicts the jurisdiction convention', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '17031',
      propertyType: 'residential',
      taxYearInAppeal: 2025,
      valuationDate: '2025-07-29',
      assessmentRatio: 0.1,
      assessmentMethodology: 'Residential class',
      propertyClassDescription: 'Multifamily',
      countyRule: countyRule(),
    });

    expect(result.hardFailures.some((failure) => failure.includes('January 1'))).toBe(true);
  });

  it('rejects a text-only classification exception', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '17031',
      propertyType: 'commercial',
      taxYearInAppeal: 2025,
      valuationDate: '2025-01-01',
      assessmentRatio: 0.2,
      assessmentMethodology: 'Non-profit special classification',
      propertyClassDescription: 'Office',
      countyRule: countyRule(),
    });

    expect(result.hardFailures.some((failure) => failure.includes('official authority'))).toBe(true);
  });

  it('allows a sourced special classification mismatch as a warning', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '17031',
      propertyType: 'commercial',
      taxYearInAppeal: 2025,
      valuationDate: '2025-01-01',
      assessmentRatio: 0.2,
      assessmentMethodology: 'Non-profit special classification',
      propertyClassDescription: 'Office',
      classificationSourceAuthority: 'Cook County Assessor',
      classificationSourceUrl: 'https://assessor.example.gov/parcel/123',
      countyRule: countyRule(),
    });

    expect(result.hardFailures).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('verified special-classification'))).toBe(true);
  });

  it('fails closed when the jurisdiction has no land assessment level', () => {
    const result = evaluateAssessmentContext({
      serviceType: 'tax_appeal',
      countyFips: '17031',
      propertyType: 'land',
      taxYearInAppeal: 2025,
      valuationDate: '2025-01-01',
      assessmentRatio: 0.1,
      assessmentMethodology: 'Vacant land classification',
      propertyClassDescription: 'Vacant land',
      countyRule: countyRule(),
    });

    expect(result.expectedAssessmentRatio).toBeNull();
    expect(result.hardFailures.some((failure) => failure.includes('does not provide'))).toBe(true);
  });
});
