import { describe, expect, it } from 'vitest';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { evaluateNationwideReportIntegrity } from './nationwide-report-integrity-policy';

function narrative(section_name: string, content: string, model_used = 'test-model') {
  return {
    id: section_name,
    report_id: 'report-1',
    section_name,
    content,
    generated_at: '2026-07-18T00:00:00.000Z',
    model_used,
    prompt_tokens: 1,
    completion_tokens: 1,
    generation_duration_ms: 1,
    admin_edited: false,
    admin_edited_content: null,
  };
}

function data(overrides: Partial<ReportTemplateData> = {}): ReportTemplateData {
  const base = {
    report: {
      id: 'report-1',
      service_type: 'pre_purchase',
      desired_outcome: null,
      additional_notes: null,
      property_type: 'residential',
      review_tier: 'auto',
      property_address: '1105 Remington Road',
      city: 'Schaumburg',
      state: 'Illinois',
      state_abbreviation: 'IL',
      county: 'Cook County',
      county_fips: '17031',
      property_issues: [],
    },
    property: {
      zoning_designation: 'M-1',
      zoning_description: 'Limited Industrial District',
      zoning_conformance: 'Legally conforming',
      flood_zone_designation: 'Zone X',
      flood_map_panel_number: '17031C',
      flood_map_panel_date: '2024-01-01',
      fema_raw_response: { source: 'FEMA NFHL' },
    },
    narratives: [
      narrative('assignment_and_scope', 'Intended use and scope of work.'),
      narrative('area_analysis_city', 'Schaumburg Area Analysis'),
      narrative('area_analysis_county', 'Cook County regional context.'),
      narrative('market_analysis', 'Q1 2025 industrial market summary.'),
      narrative('hbu_as_vacant', 'Industrial use is legally permissible.'),
      narrative('hbu_as_improved', 'Continue the current industrial use.'),
      narrative('property_history', 'No recent transfers.'),
      narrative('property_description', 'The subject is an industrial property.'),
      narrative('certification_and_limiting_conditions', 'AI-assisted valuation analysis boundary.'),
    ],
    comparableSales: [],
    comparableRentals: [],
    photos: [],
    maps: {},
    incomeAnalysis: null,
    countyRule: null,
    filingGuide: null,
    concludedValue: 1_000_000,
    valuationDate: '2025-01-01',
    reportDate: '2026-01-23',
  } as unknown as ReportTemplateData;

  return {
    ...base,
    ...overrides,
    report: { ...base.report, ...(overrides.report ?? {}) },
    property: { ...base.property, ...(overrides.property ?? {}) },
    narratives: overrides.narratives ?? base.narratives,
  } as ReportTemplateData;
}

describe('evaluateNationwideReportIntegrity', () => {
  it('blocks municipality and county copy-forward leaks', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: [
        ...data().narratives.filter((item) => !['area_analysis_city', 'assessment_data'].includes(item.section_name)),
        narrative('area_analysis_city', 'Palatine Analysis'),
        narrative('assessment_data', 'Lake County assessment data.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('MUNICIPALITY_TEMPLATE_LEAK');
    expect(result.hardFailureCodes).toContain('COUNTY_TEMPLATE_LEAK');
  });

  it('warns on a one-year market offset and blocks materially stale market evidence', () => {
    const oneYearOffset = evaluateNationwideReportIntegrity(data({
      narratives: [
        ...data().narratives.filter((item) => item.section_name !== 'market_analysis'),
        narrative('market_analysis', 'Q1 2024 Chicago industrial market summary.'),
      ],
    }));
    expect(oneYearOffset.warningCodes).toContain('MARKET_VINTAGE_STALE');
    expect(oneYearOffset.hardFailureCodes).not.toContain('MARKET_VINTAGE_STALE');

    const stale = evaluateNationwideReportIntegrity(data({
      narratives: [
        ...data().narratives.filter((item) => item.section_name !== 'market_analysis'),
        narrative('market_analysis', 'Q1 2022 industrial market summary.'),
      ],
    }));
    expect(stale.hardFailureCodes).toContain('MARKET_VINTAGE_STALE');
  });

  it('blocks unsupported multifamily highest-and-best-use conclusions under single-unit zoning', () => {
    const result = evaluateNationwideReportIntegrity(data({
      property: {
        ...data().property,
        zoning_designation: 'RS-3',
        zoning_description: 'Residential Single-Unit Detached House District',
        zoning_conformance: 'Conforming',
      },
      narratives: [
        ...data().narratives.filter((item) => !['hbu_as_vacant', 'hbu_as_improved'].includes(item.section_name)),
        narrative('hbu_as_vacant', 'The maximally productive use is multifamily development.'),
        narrative('hbu_as_improved', 'Continue the current multifamily use.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('ZONING_HBU_CONTRADICTION');
  });

  it('blocks personal-property exclusions misclassified as extraordinary assumptions', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: [
        ...data().narratives.filter((item) => item.section_name !== 'assignment_and_scope'),
        narrative(
          'assignment_and_scope',
          'Extraordinary Assumptions. For this appraisal, all tangible and intangible personal property was excluded. Hypothetical Conditions. None.'
        ),
      ],
    }));

    expect(result.hardFailureCodes).toContain('ASSIGNMENT_CONDITION_MISCLASSIFIED');
  });

  it('blocks definitive flood assertions without official FEMA evidence', () => {
    const result = evaluateNationwideReportIntegrity(data({
      property: {
        ...data().property,
        flood_zone_designation: null,
        flood_map_panel_number: null,
        flood_map_panel_date: null,
        fema_raw_response: null,
      },
      narratives: [
        ...data().narratives.filter((item) => item.section_name !== 'property_description'),
        narrative('property_description', 'The subject is not located in a flood hazard area.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('FLOOD_ASSERTION_UNSOURCED');
  });

  it('does not treat an empty FEMA payload as official flood evidence', () => {
    const result = evaluateNationwideReportIntegrity(data({
      property: {
        ...data().property,
        flood_zone_designation: null,
        flood_map_panel_number: null,
        flood_map_panel_date: null,
        fema_raw_response: {},
      },
      narratives: [
        ...data().narratives.filter((item) => item.section_name !== 'property_description'),
        narrative('property_description', 'The subject is outside the floodplain.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('FLOOD_ASSERTION_UNSOURCED');
  });

  it('blocks automated reports from claiming appraisal identity', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: [
        ...data().narratives,
        narrative('executive_summary', 'APPRAISAL REPORT prepared as a certified appraisal.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('APPRAISAL_IDENTITY_UNAUTHORIZED');
  });

  it('requires a complete retrospective estate package', () => {
    const incomplete = evaluateNationwideReportIntegrity(data({
      report: {
        ...data().report,
        desired_outcome: 'Estate planning valuation',
      },
      narratives: data().narratives.filter((item) =>
        !['property_history', 'market_analysis', 'certification_and_limiting_conditions'].includes(item.section_name)
      ),
    }));
    expect(incomplete.hardFailureCodes).toContain('ESTATE_ASSIGNMENT_INCOMPLETE');

    const complete = evaluateNationwideReportIntegrity(data({
      report: {
        ...data().report,
        desired_outcome: 'Estate planning valuation',
      },
      narratives: [
        ...data().narratives.filter((item) => item.section_name !== 'assignment_and_scope'),
        narrative('assignment_and_scope', 'Intended for estate tax reporting on IRS Form 706 as of the date of death.'),
      ],
    }));
    expect(complete.hardFailureCodes).not.toContain('ESTATE_ASSIGNMENT_INCOMPLETE');
    expect(complete.warningCodes).toContain('ESTATE_PACKAGE_RETENTION_REQUIRED');
  });
});
