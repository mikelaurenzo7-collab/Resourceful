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
      is_retrospective_assignment: false,
    },
    property: {
      property_subtype: 'industrial_flex',
      property_class_description: 'Industrial flex building',
      unit_count: null,
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
      narrative('market_analysis', 'Q1 2025 Chicago industrial market summary.'),
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

function replaceNarratives(
  baseData: ReportTemplateData,
  replacements: Record<string, string>
) {
  const replaced = new Set(Object.keys(replacements));
  return [
    ...baseData.narratives.filter((item) => !replaced.has(item.section_name)),
    ...Object.entries(replacements).map(([section, content]) => narrative(section, content)),
  ];
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

  it('blocks wrong subject municipality in zoning and subject-property sections', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: [
        ...data().narratives.filter((item) => item.section_name !== 'site_description_narrative'),
        narrative('site_description_narrative', 'Zoning, Palatine, IL. The subject site is zoned M-1.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('MUNICIPALITY_TEMPLATE_LEAK');
    expect(result.hardFailures.some((failure) => failure.includes('site_description_narrative'))).toBe(true);
    expect(result.hardFailures.some((failure) => failure.includes('Palatine'))).toBe(true);
  });

  it('flags a foreign market-area heading without treating a broader compatible property market as a template leak', () => {
    const baseData = data({
      report: {
        ...data().report,
        property_type: 'commercial',
        city: 'Arlington Heights',
      },
      property: {
        ...data().property,
        property_subtype: 'commercial_retail',
        property_class_description: 'Neighborhood retail building',
      },
    });
    const result = evaluateNationwideReportIntegrity(data({
      ...baseData,
      narratives: replaceNarratives(baseData, {
        area_analysis_city: 'Arlington Heights Area Analysis',
        market_analysis: 'Q1 2025 Retail Sub-Market Schaumburg Area Summary\nRetail vacancy and rent trends.',
      }),
    }));

    expect(result.warningCodes).toContain('MARKET_GEOGRAPHY_REVIEW_REQUIRED');
    expect(result.hardFailureCodes).not.toContain('MARKET_PROPERTY_TYPE_MISMATCH');
  });

  it('blocks a retail-and-office market section for an industrial flex subject', () => {
    const result = evaluateNationwideReportIntegrity(data({
      report: { ...data().report, property_type: 'industrial' },
      narratives: replaceNarratives(data(), {
        market_analysis: 'Q1 2025 Chicago Retail and Office Market Summary. Retail and office rents are discussed.',
      }),
    }));

    expect(result.hardFailureCodes).toContain('MARKET_PROPERTY_TYPE_MISMATCH');
  });

  it('warns on a one-year market offset and blocks materially stale market evidence', () => {
    const oneYearOffset = evaluateNationwideReportIntegrity(data({
      narratives: replaceNarratives(data(), {
        market_analysis: 'Q1 2024 Chicago industrial market summary.',
      }),
    }));
    expect(oneYearOffset.warningCodes).toContain('MARKET_VINTAGE_STALE');
    expect(oneYearOffset.hardFailureCodes).not.toContain('MARKET_VINTAGE_STALE');

    const stale = evaluateNationwideReportIntegrity(data({
      narratives: replaceNarratives(data(), {
        market_analysis: 'Q1 2022 industrial market summary.',
      }),
    }));
    expect(stale.hardFailureCodes).toContain('MARKET_VINTAGE_STALE');
  });

  it('blocks undisclosed post-effective-date market evidence', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: replaceNarratives(data(), {
        market_analysis: 'Q1 2026 industrial market summary.',
      }),
    }));

    expect(result.hardFailureCodes).toContain('MARKET_VINTAGE_POST_EFFECTIVE_DATE');
  });

  it('allows disclosed later market evidence as a warning for non-retrospective assignments', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: replaceNarratives(data(), {
        market_analysis: 'Q1 2026 industrial market summary is later evidence after the valuation date and is used only as limited context.',
      }),
    }));

    expect(result.hardFailureCodes).not.toContain('MARKET_VINTAGE_POST_EFFECTIVE_DATE');
    expect(result.warningCodes).toContain('MARKET_VINTAGE_POST_EFFECTIVE_DATE');
  });

  it('blocks all-later market evidence for retrospective assignments even when disclosed', () => {
    const result = evaluateNationwideReportIntegrity(data({
      report: {
        ...data().report,
        is_retrospective_assignment: true,
      },
      narratives: replaceNarratives(data(), {
        market_analysis: 'Q1 2026 industrial market summary is later evidence after the valuation date.',
      }),
    }));

    expect(result.hardFailureCodes).toContain('MARKET_VINTAGE_POST_EFFECTIVE_DATE');
  });

  it('blocks an undisclosed quarter that extends beyond a retrospective effective date', () => {
    const result = evaluateNationwideReportIntegrity(data({
      report: {
        ...data().report,
        is_retrospective_assignment: true,
      },
      valuationDate: '2025-07-29',
      narratives: replaceNarratives(data(), {
        market_analysis: 'Q3 2025 Chicago industrial market summary.',
      }),
    }));

    expect(result.hardFailureCodes).toContain('MARKET_VINTAGE_POST_EFFECTIVE_DATE');
  });

  it('blocks conflicting inspection dates across the report', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: [
        ...data().narratives,
        narrative('summary_of_salient_facts', 'Date of Inspection: January 23, 2026.'),
        narrative('condition_assessment', 'The inspection was conducted on January 21, 2026.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('INSPECTION_DATE_CONTRADICTION');
  });

  it('requires effective-date condition reconciliation when a reviewed retrospective inspection is later', () => {
    const baseData = data({
      report: {
        ...data().report,
        review_tier: 'expert_reviewed',
        is_retrospective_assignment: true,
      },
      valuationDate: '2025-07-29',
      reportDate: '2026-03-02',
    });
    const result = evaluateNationwideReportIntegrity(data({
      ...baseData,
      narratives: [
        ...baseData.narratives,
        narrative('condition_assessment', 'The property was inspected on February 25, 2026 and was in fair condition.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('RETROSPECTIVE_CONDITION_RECONCILIATION_REQUIRED');
  });

  it('accepts a supported retrospective condition bridge', () => {
    const baseData = data({
      report: {
        ...data().report,
        review_tier: 'expert_reviewed',
        is_retrospective_assignment: true,
      },
      valuationDate: '2025-07-29',
      reportDate: '2026-03-02',
    });
    const result = evaluateNationwideReportIntegrity(data({
      ...baseData,
      narratives: [
        ...baseData.narratives,
        narrative(
          'condition_assessment',
          'The property was inspected on February 25, 2026. Condition as of the effective date was reconciled from dated photographs, repair records, and the owner interview.'
        ),
      ],
    }));

    expect(result.hardFailureCodes).not.toContain('RETROSPECTIVE_CONDITION_RECONCILIATION_REQUIRED');
  });

  it('blocks a stabilized income model that ignores major actual vacancy', () => {
    const baseData = data({
      report: { ...data().report, property_type: 'commercial' },
      property: {
        ...data().property,
        property_subtype: 'commercial_retail',
        property_class_description: 'Six-unit retail building',
        unit_count: 6,
      },
      incomeAnalysis: {
        vacancy_rate_pct: 10,
      } as ReportTemplateData['incomeAnalysis'],
    });
    const result = evaluateNationwideReportIntegrity(data({
      ...baseData,
      narratives: [
        ...replaceNarratives(baseData, {
          market_analysis: 'Q1 2025 Chicago retail market summary.',
          summary_of_salient_facts: 'The subject is currently 50% vacant and 50% occupied.',
        }),
        narrative('income_approach_narrative', 'Market vacancy of 10% is applied to potential gross income.'),
        narrative('reconciliation_narrative', 'The income indication is reconciled with the sales approach.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('STABILIZATION_BRIDGE_MISSING');
  });

  it('accepts a reproducible as-is-to-stabilized vacancy bridge', () => {
    const baseData = data({
      report: { ...data().report, property_type: 'commercial' },
      property: {
        ...data().property,
        property_subtype: 'commercial_retail',
        property_class_description: 'Six-unit retail building',
        unit_count: 6,
      },
      incomeAnalysis: {
        vacancy_rate_pct: 10,
      } as ReportTemplateData['incomeAnalysis'],
    });
    const result = evaluateNationwideReportIntegrity(data({
      ...baseData,
      narratives: [
        ...replaceNarratives(baseData, {
          market_analysis: 'Q1 2025 Chicago retail market summary.',
          summary_of_salient_facts: 'The subject is currently 50% vacant and 50% occupied.',
        }),
        narrative(
          'income_approach_narrative',
          'The stabilized model uses 10% vacancy. The as-is value deducts twelve months of lease-up downtime, tenant improvements, leasing commissions, and carrying costs from the stabilized indication.'
        ),
        narrative('reconciliation_narrative', 'The final as-is conclusion reconciles the stabilized indication and lease-up deductions.'),
      ],
    }));

    expect(result.hardFailureCodes).not.toContain('STABILIZATION_BRIDGE_MISSING');
  });

  it('blocks unsupported multifamily highest-and-best-use conclusions under single-unit zoning', () => {
    const result = evaluateNationwideReportIntegrity(data({
      property: {
        ...data().property,
        zoning_designation: 'RS-3',
        zoning_description: 'Residential Single-Unit Detached House District',
        zoning_conformance: 'Conforming',
      },
      narratives: replaceNarratives(data(), {
        hbu_as_vacant: 'The maximally productive use is multifamily development.',
        hbu_as_improved: 'Continue the current multifamily use.',
      }),
    }));

    expect(result.hardFailureCodes).toContain('ZONING_HBU_CONTRADICTION');
  });

  it('blocks personal-property exclusions misclassified as extraordinary assumptions', () => {
    const result = evaluateNationwideReportIntegrity(data({
      narratives: replaceNarratives(data(), {
        assignment_and_scope: 'Extraordinary Assumptions. For this appraisal, all tangible and intangible personal property was excluded. Hypothetical Conditions. None.',
      }),
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
      narratives: replaceNarratives(data(), {
        property_description: 'The subject is not located in a flood hazard area.',
      }),
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
      narratives: replaceNarratives(data(), {
        property_description: 'The subject is outside the floodplain.',
      }),
    }));

    expect(result.hardFailureCodes).toContain('FLOOD_ASSERTION_UNSOURCED');
  });

  it('blocks contradictory appraisal and valuation-consulting identities', () => {
    const result = evaluateNationwideReportIntegrity(data({
      report: { ...data().report, review_tier: 'expert_reviewed' },
      narratives: [
        ...data().narratives,
        narrative('executive_summary', 'This Appraisal Report concludes the subject value.'),
        narrative('certification_and_limiting_conditions', 'Certification of Real Property Valuation Consulting Report.'),
      ],
    }));

    expect(result.hardFailureCodes).toContain('DOCUMENT_IDENTITY_CONTRADICTION');
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
      narratives: replaceNarratives(data(), {
        assignment_and_scope: 'Intended for estate tax reporting on IRS Form 706 as of the date of death.',
      }),
    }));
    expect(complete.hardFailureCodes).not.toContain('ESTATE_ASSIGNMENT_INCOMPLETE');
    expect(complete.warningCodes).toContain('ESTATE_PACKAGE_RETENTION_REQUIRED');
  });
});
