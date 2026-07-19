import { describe, expect, it } from 'vitest';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { buildReportProfile, evaluateReportProfileCompleteness } from './report-profile';

function narrative(section_name: string) {
  return {
    id: section_name,
    report_id: 'report-1',
    section_name,
    content: `${section_name} content`,
    generated_at: '2026-07-18T00:00:00.000Z',
    model_used: 'test',
    prompt_tokens: 1,
    completion_tokens: 1,
    generation_duration_ms: 1,
    admin_edited: false,
    admin_edited_content: null,
  };
}

function baseData(overrides: Record<string, unknown> = {}): ReportTemplateData {
  const data = {
    report: {
      id: 'report-1',
      service_type: 'tax_appeal',
      desired_outcome: null,
      property_type: 'residential',
      review_tier: 'expert_reviewed',
      county_fips: '17031',
      county: 'Cook County',
      property_issues: [],
    },
    property: {
      property_subtype: 'Single Family Residence',
      property_class_description: 'Residential',
      overall_condition: 'average',
      condition_notes: null,
      cost_approach_rcn: null,
      cost_approach_value: null,
      physical_depreciation_pct: null,
      functional_obsolescence_pct: null,
      land_value: null,
      cost_replacement_source_authority: null,
      cost_depreciation_source_authority: null,
      cost_land_source_authority: null,
      cost_source_references: null,
      cost_methodology: null,
      cost_effective_date: null,
      cost_verification_state: null,
      cost_verified_by: null,
      cost_verified_at: null,
      zoning_designation: 'R-1',
      zoning_description: null,
      tax_year_in_appeal: 2025,
      assessment_ratio: 0.1,
    },
    narratives: [
      narrative('assignment_and_scope'),
      narrative('summary_of_salient_facts'),
      narrative('executive_summary'),
      narrative('property_description'),
      narrative('property_history'),
      narrative('assessment_data'),
      narrative('site_description_narrative'),
      narrative('improvement_description_narrative'),
      narrative('area_analysis_county'),
      narrative('area_analysis_city'),
      narrative('area_analysis_neighborhood'),
      narrative('market_analysis'),
      narrative('hbu_as_vacant'),
      narrative('hbu_as_improved'),
      narrative('appeal_argument_summary'),
      narrative('sales_comparison_narrative'),
      narrative('adjustment_grid_narrative'),
      narrative('assessment_equity'),
      narrative('reconciliation_narrative'),
      narrative('certification_and_limiting_conditions'),
    ],
    comparableSales: [
      {
        id: 'comp-1',
        county_recorder_url: 'https://recorder.example/1',
        deed_document_number: 'DOC-1',
        is_distressed_sale: false,
      },
      {
        id: 'comp-2',
        county_recorder_url: 'https://recorder.example/2',
        deed_document_number: 'DOC-2',
        is_distressed_sale: false,
      },
      {
        id: 'comp-3',
        county_recorder_url: 'https://recorder.example/3',
        deed_document_number: 'DOC-3',
        is_distressed_sale: false,
      },
    ],
    comparableRentals: [],
    incomeAnalysis: null,
    photos: [{ storage_path: 'reports/subject.jpg', ai_analysis: null }],
    countyRule: {
      jurisdiction_plugin_key: 'cook_county_classification',
      jurisdiction_plugin_version: 1,
    },
    maps: {},
    filingGuide: null,
    concludedValue: 500000,
    valuationDate: '2025-01-01',
    reportDate: '2026-07-18',
    ...overrides,
  };

  return data as unknown as ReportTemplateData;
}

describe('buildReportProfile', () => {
  it('creates a tax-appeal profile with appeal, market-context, equity, and certification sections', () => {
    const profile = buildReportProfile(baseData());

    expect(profile.documentTitle).toBe('Property Tax Appeal Valuation Analysis');
    expect(profile.isCookCounty).toBe(true);
    expect(profile.requiredNarratives).toContain('appeal_argument_summary');
    expect(profile.requiredNarratives).toContain('assessment_equity');
    expect(profile.requiredNarratives).toContain('hbu_as_vacant');
    expect(profile.requiredNarratives).toContain('area_analysis_city');
    expect(profile.requiredNarratives).toContain('area_analysis_neighborhood');
    expect(profile.requiredNarratives).toContain('certification_and_limiting_conditions');
  });

  it('does not activate Cook County behavior from county text or FIPS alone', () => {
    const profile = buildReportProfile(baseData({ countyRule: null }));
    expect(profile.isCookCounty).toBe(false);
  });

  it('treats multifamily residential property as a complex income-property assignment', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        property_subtype: 'Three-unit multifamily building',
        property_class_description: 'Multifamily',
      },
    });

    const profile = buildReportProfile(data);
    expect(profile.isComplexProperty).toBe(true);
    expect(profile.isIncomeProperty).toBe(true);
    expect(profile.requiredNarratives).toContain('area_analysis_county');
    expect(profile.requiredNarratives).toContain('market_analysis');
  });

  it('requires condition analysis for distressed property evidence', () => {
    const data = baseData({
      report: { ...baseData().report, property_type: 'commercial', property_issues: ['vacancy', 'disrepair'] },
      property: {
        ...baseData().property,
        property_subtype: 'Multi-tenant commercial',
        overall_condition: 'poor',
        condition_notes: 'Vacant and requires extensive renovation',
      },
    });

    const profile = buildReportProfile(data);
    expect(profile.hasConditionEvidence).toBe(true);
    expect(profile.requiredNarratives).toContain('condition_assessment');
  });

  it('activates the cost approach only when arithmetic and provenance reconcile', () => {
    const incomplete = buildReportProfile(baseData({
      property: {
        ...baseData().property,
        cost_approach_value: 470_000,
      },
    }));
    expect(incomplete.hasCostApproach).toBe(false);

    const complete = buildReportProfile(baseData({
      property: {
        ...baseData().property,
        cost_approach_rcn: 500_000,
        cost_approach_value: 470_000,
        physical_depreciation_pct: 10,
        functional_obsolescence_pct: 0,
        land_value: 20_000,
        cost_replacement_source_authority: 'Marshall & Swift/Boeckh, 2025 local cost service',
        cost_depreciation_source_authority: 'Documented age-life analysis reviewed by Test Reviewer',
        cost_land_source_authority: 'Verified land-sale workfile and assessor record',
        cost_source_references: {
          replacementCost: 'MSB-2025-Q1-local-index',
          depreciation: 'workfile/depreciation-analysis-1',
          landValue: 'workfile/land-sales-1',
        },
        cost_methodology: 'RCN less physical and functional depreciation, plus land value.',
        cost_effective_date: '2025-01-01',
        cost_verification_state: 'verified',
        cost_verified_by: 'Test Reviewer, controlled fixture',
        cost_verified_at: '2026-07-18T12:00:00.000Z',
      },
    }));
    expect(complete.hasCostApproach).toBe(true);
  });
});

describe('evaluateReportProfileCompleteness', () => {
  it('fails when a profile-required narrative is missing', () => {
    const data = baseData({
      narratives: baseData().narratives.filter(
        (section) => section.section_name !== 'assessment_equity'
      ),
    });

    const result = evaluateReportProfileCompleteness(data);
    expect(result.hardFailures.some((failure) => failure.includes('assessment_equity'))).toBe(true);
  });

  it('fails when the certification boundary is missing', () => {
    const data = baseData({
      narratives: baseData().narratives.filter(
        (section) => section.section_name !== 'certification_and_limiting_conditions'
      ),
    });

    const result = evaluateReportProfileCompleteness(data);
    expect(result.hardFailures.some((failure) => failure.includes('certification_and_limiting_conditions'))).toBe(true);
  });

  it('requires every reviewed comparable to have transaction provenance', () => {
    const data = baseData({
      comparableSales: [
        {
          id: 'comp-1',
          county_recorder_url: 'https://recorder.example/1',
          deed_document_number: 'DOC-1',
          is_distressed_sale: false,
        },
        { id: 'comp-2', county_recorder_url: null, deed_document_number: null, is_distressed_sale: false },
      ],
    });

    const result = evaluateReportProfileCompleteness(data);
    expect(result.hardFailures).toContain(
      '1 reviewed comparable sale(s) lack a recorder link or deed document number'
    );
  });

  it('fails when partial cost inputs cannot support a reproducible method', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        cost_approach_value: 470_000,
      },
    });

    const result = evaluateReportProfileCompleteness(data);
    expect(result.hardFailures.some((failure) => failure.includes('replacement-cost-new'))).toBe(true);
    expect(result.hardFailures.some((failure) => failure.includes('land-value'))).toBe(true);
    expect(result.hardFailures.some((failure) => failure.includes('verification state'))).toBe(true);
  });

  it('warns when distressed sales are retained', () => {
    const data = baseData({
      comparableSales: [
        {
          id: 'comp-1',
          county_recorder_url: 'https://recorder.example/1',
          deed_document_number: 'DOC-1',
          is_distressed_sale: true,
        },
      ],
    });

    const result = evaluateReportProfileCompleteness(data);
    expect(result.warnings.some((warning) => warning.includes('distressed comparable'))).toBe(true);
  });

  it('warns when a complex report has no map or parcel-context exhibit', () => {
    const result = evaluateReportProfileCompleteness(baseData({ maps: {} }));

    expect(result.warnings).toContain('Complex-property report has no subject map or parcel-context exhibit');
  });
});
