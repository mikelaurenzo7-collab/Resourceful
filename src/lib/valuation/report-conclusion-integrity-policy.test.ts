import { describe, expect, it } from 'vitest';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import { evaluateReportConclusionIntegrity } from './report-conclusion-integrity-policy';

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

function dataWith(narratives: ReturnType<typeof narrative>[]): ReportTemplateData {
  return {
    report: { id: 'report-1' },
    property: {},
    comparableSales: [],
    comparableRentals: [],
    photos: [],
    narratives,
    countyRule: null,
    maps: {},
    filingGuide: null,
    incomeAnalysis: null,
    concludedValue: 985_000,
    valuationDate: '2025-01-01',
    reportDate: '2025-11-24',
  } as unknown as ReportTemplateData;
}

describe('evaluateReportConclusionIntegrity', () => {
  it('accepts matching final value and valuation date labels', () => {
    const result = evaluateReportConclusionIntegrity(dataWith([
      narrative(
        'reconciliation_narrative',
        'The final market value is $985,000. The valuation date is January 1, 2025.'
      ),
    ]));

    expect(result.hardFailures).toEqual([]);
    expect(result.warningCodes).toEqual([]);
    expect(result.labeledValues).toEqual([
      { section: 'reconciliation_narrative', value: 985_000 },
    ]);
    expect(result.labeledEffectiveDates).toEqual([
      { section: 'reconciliation_narrative', date: '2025-01-01' },
    ]);
  });

  it('rejects the copied final-value contradiction found in a reference report', () => {
    const result = evaluateReportConclusionIntegrity(dataWith([
      narrative(
        'reconciliation_narrative',
        'The reconciled market value is $975,000. The valuation date is January 1, 2025.'
      ),
    ]));

    expect(result.hardFailureCodes).toContain('FINAL_VALUE_MISMATCH');
    expect(result.hardFailures[0]).toContain('$985,000');
    expect(result.hardFailures[0]).toContain('$975,000');
  });

  it('rejects a copied effective date that conflicts with the assignment date', () => {
    const result = evaluateReportConclusionIntegrity(dataWith([
      narrative(
        'reconciliation_narrative',
        'The final market value is $985,000. The market value as of July 29, 2025 is supported.'
      ),
    ]));

    expect(result.hardFailureCodes).toContain('EFFECTIVE_DATE_MISMATCH');
    expect(result.hardFailures[0]).toContain('2025-01-01');
    expect(result.hardFailures[0]).toContain('2025-07-29');
  });

  it('fails release rather than normalizing an impossible labeled date', () => {
    const result = evaluateReportConclusionIntegrity(dataWith([
      narrative(
        'reconciliation_narrative',
        'The final market value is $985,000. The valuation date is February 30, 2025.'
      ),
    ]));

    expect(result.labeledEffectiveDates).toEqual([]);
    expect(result.invalidLabeledEffectiveDates).toEqual([
      { section: 'reconciliation_narrative', raw: 'February 30, 2025' },
    ]);
    expect(result.hardFailureCodes).toContain('EFFECTIVE_DATE_INVALID');
    expect(result.hardFailures[0]).toContain('February 30, 2025');
  });

  it('warns when prose contains no machine-checkable conclusion labels', () => {
    const result = evaluateReportConclusionIntegrity(dataWith([
      narrative('reconciliation_narrative', 'The evidence was reconciled with greatest weight to sales.'),
    ]));

    expect(result.hardFailures).toEqual([]);
    expect(result.warningCodes).toEqual([
      'FINAL_VALUE_LABEL_MISSING',
      'EFFECTIVE_DATE_LABEL_MISSING',
    ]);
  });
});
