import { describe, expect, it } from 'vitest';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { evaluateCaseStrategy } from './case-strategy-policy';

function narrative(section_name: string, content = `${section_name} content`) {
  return {
    id: section_name,
    report_id: 'report-1',
    section_name,
    content,
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
      property_issues: [],
      additional_notes: null,
    },
    property: {
      property_subtype: 'Single Family Residence',
      property_class_description: 'Residential',
      overall_condition: 'average',
      condition_notes: null,
      zoning_conformance: 'Legal conforming',
      deed_history: null,
      data_collection_notes: null,
      building_sqft_gross: 1800,
      building_sqft_living_area: 1800,
      dock_door_count: null,
      overhead_door_count: null,
      clear_height_ft: null,
    },
    narratives: [
      narrative('property_history'),
      narrative('market_analysis'),
      narrative('condition_assessment'),
      narrative('appeal_argument_summary', 'Market value and assessment equity argument'),
      narrative('summary_of_salient_facts'),
      narrative('property_description'),
    ],
    comparableSales: [],
    comparableRentals: [],
    incomeAnalysis: null,
    photos: [],
    countyRule: null,
    maps: {},
    filingGuide: null,
    concludedValue: 500000,
    valuationDate: '2025-01-01',
    reportDate: '2025-01-15',
    ...overrides,
  };

  return data as unknown as ReportTemplateData;
}

describe('evaluateCaseStrategy', () => {
  it('respects an independent-valuation purpose even when the stored service type is tax appeal', () => {
    const data = baseData({
      report: {
        ...baseData().report,
        desired_outcome: '[INDEPENDENT_VALUATION] Estate planning decision support',
      },
      narratives: baseData().narratives.map((section) =>
        section.section_name === 'appeal_argument_summary'
          ? narrative('appeal_argument_summary', 'Purpose and use summary for estate planning')
          : section
      ),
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).not.toContain('tax_appeal');
    expect(result.warnings.some((warning) => warning.includes('Appeal argument'))).toBe(false);
  });

  it('requires condition analysis for a vacant distressed commercial property', () => {
    const data = baseData({
      report: {
        ...baseData().report,
        property_type: 'commercial',
        property_issues: ['100% vacant', 'extensive renovation required'],
      },
      property: {
        ...baseData().property,
        property_subtype: 'Multi-tenant commercial building',
        property_class_description: 'Commercial',
        overall_condition: 'poor',
        condition_notes: 'Vacant and in disrepair',
      },
      narratives: baseData().narratives.filter(
        (section) => section.section_name !== 'condition_assessment'
      ),
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('distressed_or_vacant');
    expect(result.hardFailures.some((failure) => failure.includes('condition_assessment'))).toBe(true);
  });

  it('does not treat ordinary income-model vacancy language as subject distress', () => {
    const data = baseData({
      report: { ...baseData().report, property_type: 'commercial' },
      property: {
        ...baseData().property,
        property_subtype: 'Office building',
        property_class_description: 'Commercial office',
      },
      narratives: [
        ...baseData().narratives,
        narrative('income_approach_narrative', 'A stabilized vacancy and collection loss of 7% was applied.'),
      ],
      incomeAnalysis: { id: 'income-1' },
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).not.toContain('distressed_or_vacant');
  });

  it('flags a recent subject sale for arm-length and effective-date screening', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        deed_history: [{ sale_date: '2024-08-20', sale_price: 625000 }],
      },
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('recent_subject_sale');
    expect(result.recentSubjectSaleDate).toBe('2024-08-20');
    expect(result.warnings.some((warning) => warning.includes("arm's-length"))).toBe(true);
  });

  it('requires property history when a recent subject sale exists', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        deed_history: [{ transfer_date: '2024-04-01' }],
      },
      narratives: baseData().narratives.filter(
        (section) => section.section_name !== 'property_history'
      ),
    });

    const result = evaluateCaseStrategy(data);
    expect(result.hardFailures).toContain('A recent subject transfer requires a dedicated property_history narrative');
  });

  it('warns against verified per-unit metrics when multifamily unit count is not source labeled', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        property_subtype: 'Multifamily building',
        property_class_description: 'Apartment property',
      },
      narratives: [
        narrative('summary_of_salient_facts', 'Residential income property'),
        narrative('property_description', 'A masonry apartment building'),
        ...baseData().narratives.filter(
          (section) => !['summary_of_salient_facts', 'property_description'].includes(section.section_name)
        ),
      ],
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('multifamily_unit_economics');
    expect(result.warnings.some((warning) => warning.includes('source-labeled unit count'))).toBe(true);
  });

  it('recognizes a hyphenated multifamily unit count as documented evidence', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        property_subtype: '3-unit multifamily building',
        property_class_description: 'Apartment property',
        data_collection_notes: 'Assessor record identifies a 3-unit property.',
      },
      comparableSales: [{ property_class: 'Three-unit multifamily' }],
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('multifamily_unit_economics');
    expect(result.warnings.some((warning) => warning.includes('source-labeled unit count'))).toBe(false);
  });

  it('requires positive building area for an industrial or flex assignment', () => {
    const data = baseData({
      report: { ...baseData().report, property_type: 'industrial' },
      property: {
        ...baseData().property,
        property_subtype: 'Industrial flex building',
        property_class_description: 'Warehouse',
        building_sqft_gross: null,
        building_sqft_living_area: null,
      },
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('industrial_utility');
    expect(result.hardFailures).toContain('Industrial/flex analysis requires a positive building-area input');
  });

  it('requires effective-date market analysis for a retrospective assignment', () => {
    const data = baseData({
      reportDate: '2026-03-11',
      valuationDate: '2025-07-29',
      narratives: baseData().narratives.filter(
        (section) => section.section_name !== 'market_analysis'
      ),
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('retrospective_effective_date');
    expect(result.hardFailures).toContain('A retrospective valuation requires market_analysis tied to the effective date');
  });

  it('requires a sourced regulatory analysis instead of treating a code issue as zoning nonconformance', () => {
    const data = baseData({
      report: {
        ...baseData().report,
        property_issues: ['Active City of Chicago building code violation'],
      },
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('regulatory_or_code_issue');
    expect(result.warnings.some((warning) => warning.includes('distinguish zoning legality'))).toBe(true);
  });
});
