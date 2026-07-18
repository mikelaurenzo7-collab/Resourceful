import { describe, expect, it } from 'vitest';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { buildReportRenderPlan } from './report-render-plan';

function narrative(section_name: string, content: string) {
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

function data(overrides: Record<string, unknown> = {}): ReportTemplateData {
  return {
    report: {
      id: 'report-1',
      service_type: 'pre_purchase',
      desired_outcome: null,
      property_type: 'residential',
      review_tier: 'auto',
      county_fips: null,
      county: null,
      property_address: '123 Main Street',
      property_issues: [],
    },
    property: {
      property_subtype: 'Single Family Residence',
      property_class_description: 'Residential',
      overall_condition: 'average',
      condition_notes: null,
      zoning_designation: null,
      zoning_description: null,
      assessment_ratio: null,
      tax_year_in_appeal: null,
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
    },
    narratives: [
      narrative('summary_of_salient_facts', '  Salient facts  '),
      narrative('executive_summary', 'Executive summary'),
      narrative('assignment_and_scope', '   '),
      narrative('property_description', 'Property description'),
      narrative('reconciliation_narrative', 'Reconciliation'),
      narrative('negotiation_guide', 'Negotiation guide'),
      narrative('certification_and_limiting_conditions', '   '),
    ],
    comparableSales: [],
    comparableRentals: [],
    photos: [],
    maps: {},
    incomeAnalysis: null,
    countyRule: null,
    filingGuide: null,
    concludedValue: 500_000,
    valuationDate: '2026-01-01',
    reportDate: '2026-01-15',
    ...overrides,
  } as unknown as ReportTemplateData;
}

describe('buildReportRenderPlan', () => {
  it('normalizes narratives and omits whitespace-only pages', () => {
    const plan = buildReportRenderPlan(data());
    const ids = plan.sections.map((section) => section.id);

    expect(plan.narratives.get('summary_of_salient_facts')).toBe('Salient facts');
    expect(ids).not.toContain('narrative:assignment_and_scope');
    expect(ids).not.toContain('certification');
    expect(ids).toContain('disclaimer');
    expect(ids).toContain('assignment-guide:negotiation_guide');
  });

  it('creates separate ordered map and photo exhibit entries from actual evidence', () => {
    const plan = buildReportRenderPlan(data({
      maps: {
        regional: { url: 'https://maps.example/regional.png', caption: 'Regional map' },
      },
      photos: [
        { id: 'photo-1', storage_path: 'reports/photo-1.jpg', ai_analysis: null },
      ],
    }));
    const ids = plan.sections.map((section) => section.id);

    expect(ids.indexOf('maps')).toBeGreaterThan(ids.indexOf('executive-summary'));
    expect(ids.indexOf('photos')).toBeGreaterThan(ids.indexOf('maps'));
    expect(plan.sections.find((section) => section.id === 'maps')?.detail).toBe('1 map exhibit');
    expect(plan.sections.find((section) => section.id === 'photos')?.detail).toBe('1 image');
  });

  it('requires a renderable photo before adding the detailed condition table', () => {
    const defect = {
      type: 'roof',
      description: 'Visible roof wear',
      severity: 'moderate',
      value_impact: 'medium',
      report_language: 'Visible roof wear was observed.',
    };
    const withoutImage = buildReportRenderPlan(data({
      photos: [
        {
          id: 'photo-1',
          storage_path: '   ',
          ai_analysis: { defects: [defect] },
        },
      ],
    }));
    expect(withoutImage.sections.some((section) => section.id === 'condition-table')).toBe(false);

    const withImage = buildReportRenderPlan(data({
      photos: [
        {
          id: 'photo-1',
          storage_path: 'reports/photo-1.jpg',
          ai_analysis: { defects: [defect] },
        },
      ],
    }));
    expect(withImage.sections.some((section) => section.id === 'condition-table')).toBe(true);
  });

  it('adds income and cost calculation pages only when their evidence is release-ready', () => {
    const incomplete = buildReportRenderPlan(data({
      property: {
        ...data().property,
        cost_approach_value: 470_000,
      },
    }));
    expect(incomplete.sections.some((section) => section.id === 'cost-calculation')).toBe(false);

    const complete = buildReportRenderPlan(data({
      property: {
        ...data().property,
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
        cost_effective_date: '2026-01-01',
        cost_verification_state: 'verified',
        cost_verified_by: 'Test Reviewer, controlled fixture',
        cost_verified_at: '2026-07-18T12:00:00.000Z',
      },
      narratives: [
        ...data().narratives,
        narrative('cost_approach_narrative', 'Cost approach methodology'),
      ],
    }));
    expect(complete.sections.some((section) => section.id === 'cost-calculation')).toBe(true);
    expect(complete.sections.some((section) => section.id === 'narrative:cost_approach_narrative')).toBe(true);
  });

  it('renders adjustment and reliability analysis before comparable profiles', () => {
    const plan = buildReportRenderPlan(data({
      comparableSales: [
        {
          id: 'comp-1',
          county_recorder_url: 'https://recorder.example/document/1',
        },
      ],
      narratives: [
        ...data().narratives,
        narrative('sales_comparison_narrative', 'Sales methodology'),
        narrative('adjustment_grid_narrative', 'Adjustment reliability analysis'),
      ],
    }));
    const ids = plan.sections.map((section) => section.id);

    expect(ids.indexOf('comparable-grid')).toBeGreaterThan(
      ids.indexOf('narrative:sales_comparison_narrative')
    );
    expect(ids.indexOf('narrative:adjustment_grid_narrative')).toBeGreaterThan(
      ids.indexOf('comparable-grid')
    );
    expect(ids.indexOf('comparable-profiles')).toBeGreaterThan(
      ids.indexOf('narrative:adjustment_grid_narrative')
    );
  });

  it('renders a hearing script only for a tax-appeal profile', () => {
    const currentNarratives = [
      ...data().narratives,
      narrative('hearing_script', 'Hearing preparation script'),
    ];
    const ordinary = buildReportRenderPlan(data({ narratives: currentNarratives }));
    expect(ordinary.sections.some((section) => section.id === 'narrative:hearing_script')).toBe(false);

    const appeal = buildReportRenderPlan(data({
      report: {
        ...data().report,
        service_type: 'tax_appeal',
      },
      narratives: currentNarratives,
    }));
    expect(appeal.sections.some((section) => section.id === 'narrative:hearing_script')).toBe(true);
  });

  it('uses exactly one terminal legal-boundary section', () => {
    const certified = buildReportRenderPlan(data({
      narratives: [
        ...data().narratives.filter(
          (item) => item.section_name !== 'certification_and_limiting_conditions'
        ),
        narrative('certification_and_limiting_conditions', 'Certification text'),
      ],
    }));
    const terminal = certified.sections.at(-1);

    expect(terminal?.id).toBe('certification');
    expect(certified.sections.filter((section) => ['certification', 'disclaimer'].includes(section.id))).toHaveLength(1);
  });
});
