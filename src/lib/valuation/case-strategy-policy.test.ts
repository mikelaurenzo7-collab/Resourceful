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
      is_retrospective_assignment: false,
      valuation_effective_date: '2025-01-01',
      valuation_effective_date_source: 'jurisdiction_convention',
      created_at: '2025-01-15T00:00:00.000Z',
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
      unit_count: null,
      unit_count_source_type: null,
      unit_count_source_reference: null,
      regulatory_source_authority: null,
      regulatory_source_url: null,
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
        valuation_effective_date_source: 'intake_current_date',
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

  it('rejects a prose-only multifamily unit count', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        property_subtype: '12-unit multifamily building',
        property_class_description: 'Apartment property',
        data_collection_notes: 'The assessor record identifies a 12-unit property.',
      },
      comparableSales: [{ property_class: 'Twelve-unit multifamily' }],
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('multifamily_unit_economics');
    expect(result.hardFailures.some((failure) => failure.includes('structured unit count'))).toBe(true);
  });

  it('accepts an attributed structured multifamily unit count', () => {
    const data = baseData({
      property: {
        ...baseData().property,
        property_subtype: '12-unit multifamily building',
        property_class_description: 'Apartment property',
        unit_count: 12,
        unit_count_source_type: 'public_record',
        unit_count_source_reference: 'County assessor property record',
      },
      comparableSales: [{ property_class: 'Twelve-unit multifamily' }],
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('multifamily_unit_economics');
    expect(result.hardFailures.some((failure) => failure.includes('structured unit count'))).toBe(false);
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

  it('does not infer a retrospective assignment from report latency', () => {
    const data = baseData({
      report: {
        ...baseData().report,
        valuation_effective_date: '2025-07-29',
        valuation_effective_date_source: 'user_supplied',
        created_at: '2026-03-11T00:00:00.000Z',
      },
      reportDate: '2026-03-11',
      valuationDate: '2025-07-29',
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).not.toContain('retrospective_effective_date');
  });

  it('requires effective-date market analysis when the assignment is explicitly retrospective', () => {
    const data = baseData({
      report: {
        ...baseData().report,
        is_retrospective_assignment: true,
        valuation_effective_date: '2025-07-29',
        valuation_effective_date_source: 'user_supplied',
        created_at: '2026-03-11T00:00:00.000Z',
      },
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

  it('rejects a missing or contradictory effective-date workfile', () => {
    const missing = baseData({
      report: {
        ...baseData().report,
        valuation_effective_date: null,
        valuation_effective_date_source: null,
      },
    });
    const contradictory = baseData({
      report: {
        ...baseData().report,
        valuation_effective_date: '2024-01-01',
        valuation_effective_date_source: 'jurisdiction_convention',
      },
    });

    expect(
      evaluateCaseStrategy(missing).hardFailures.some((failure) => failure.includes('effective date'))
    ).toBe(true);
    expect(
      evaluateCaseStrategy(contradictory).hardFailures.some((failure) => failure.includes('does not match'))
    ).toBe(true);
  });

  it('blocks an unsourced regulatory claim', () => {
    const data = baseData({
      report: {
        ...baseData().report,
        property_issues: ['Active City building code violation'],
      },
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('regulatory_or_code_issue');
    expect(result.hardFailures.some((failure) => failure.includes('official authority'))).toBe(true);
  });

  it('accepts a regulatory claim with an official authority and source URL', () => {
    const data = baseData({
      report: {
        ...baseData().report,
        property_issues: ['Active City building code violation'],
      },
      property: {
        ...baseData().property,
        regulatory_source_authority: 'City Department of Buildings',
        regulatory_source_url: 'https://city.example.gov/case/123',
      },
    });

    const result = evaluateCaseStrategy(data);
    expect(result.flags).toContain('regulatory_or_code_issue');
    expect(result.hardFailures.some((failure) => failure.includes('official authority'))).toBe(false);
  });
});
