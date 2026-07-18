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
      },
      narratives: [
        ...data().narratives,
        narrative('cost_approach_narrative', 'Cost approach methodology'),
      ],
    }));
    expect(complete.sections.some((section) => section.id === 'cost-calculation')).toBe(true);
    expect(complete.sections.some((section) => section.id === 'narrative:cost_approach_narrative')).toBe(true);
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
