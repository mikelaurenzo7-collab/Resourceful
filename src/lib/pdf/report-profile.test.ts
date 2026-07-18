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
      cost_approach_value: null,
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
      narrative('hbu_as_vacant'),
      narrative('hbu_as_improved'),
      narrative('appeal_argument_summary'),
      narrative('sales_comparison_narrative'),
      narrative('adjustment_grid_narrative'),
      narrative('assessment_equity'),
      narrative('reconciliation_narrative'),
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
    countyRule: null,
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
  it('creates a tax-appeal profile with appeal and equity sections', () => {
    const profile = buildReportProfile(baseData());

    expect(profile.documentTitle).toBe('Property Tax Appeal Valuation Analysis');
    expect(profile.isCookCounty).toBe(true);
    expect(profile.requiredNarratives).toContain('appeal_argument_summary');
    expect(profile.requiredNarratives).toContain('assessment_equity');
    expect(profile.requiredNarratives).toContain('hbu_as_vacant');
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

  it('requires source-backed comparable evidence for reviewed reports', () => {
    const data = baseData({
      comparableSales: [
        { id: 'comp-1', county_recorder_url: null, deed_document_number: null, is_distressed_sale: false },
      ],
    });

    const result = evaluateReportProfileCompleteness(data);
    expect(result.hardFailures).toContain('Reviewed report has no source-backed comparable transaction');
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
});
