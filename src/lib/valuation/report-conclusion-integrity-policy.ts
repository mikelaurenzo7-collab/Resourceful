import type { ReportTemplateData } from '@/lib/templates/report-template';
import { dateOnly } from './valuation-date-policy';

export type ReportConclusionIntegrityCode =
  | 'FINAL_VALUE_LABEL_MISSING'
  | 'FINAL_VALUE_MISMATCH'
  | 'EFFECTIVE_DATE_LABEL_MISSING'
  | 'EFFECTIVE_DATE_MISMATCH';

export interface ReportConclusionIntegrityAssessment {
  warnings: string[];
  hardFailures: string[];
  warningCodes: ReportConclusionIntegrityCode[];
  hardFailureCodes: ReportConclusionIntegrityCode[];
  labeledValues: Array<{ section: string; value: number }>;
  labeledEffectiveDates: Array<{ section: string; date: string }>;
}

const CONCLUSION_SECTIONS = [
  'summary_of_salient_facts',
  'executive_summary',
  'appeal_argument_summary',
  'reconciliation_narrative',
] as const;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const VALUE_LABEL_PATTERN = /\b(?:final\s+(?:as[- ]is\s+)?(?:market\s+)?value|reconciled\s+(?:market\s+)?value|market\s+value\s+conclusion|opinion\s+of\s+(?:the\s+)?(?:as[- ]is\s+)?market\s+value)\b[^$\d]{0,180}\$\s*([\d,]+(?:\.\d{1,2})?)/gi;
const EFFECTIVE_DATE_LABEL_PATTERN = /\b(?:valuation\s+date|effective\s+date|market\s+value\s+as\s+of|opinion\s+of\s+value\s+as\s+of)\b[^\dA-Za-z]{0,30}((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/gi;

function narrativeText(data: ReportTemplateData, sectionName: string): string {
  const narrative = data.narratives.find((item) => item.section_name === sectionName);
  if (!narrative) return '';
  return narrative.admin_edited_content?.trim() || narrative.content?.trim() || '';
}

function parseCurrency(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function canonicalDate(year: number, month: number, day: number): string | null {
  const candidate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return dateOnly(candidate);
}

function parseDate(raw: string): string | null {
  const direct = dateOnly(raw);
  if (direct) return direct;

  const longForm = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (longForm) {
    const month = MONTHS[longForm[1].toLowerCase()];
    if (!month) return null;
    return canonicalDate(Number(longForm[3]), month, Number(longForm[2]));
  }

  const slashForm = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashForm) {
    return canonicalDate(Number(slashForm[3]), Number(slashForm[1]), Number(slashForm[2]));
  }

  return null;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function evaluateReportConclusionIntegrity(
  data: ReportTemplateData
): ReportConclusionIntegrityAssessment {
  const warnings: string[] = [];
  const hardFailures: string[] = [];
  const warningCodes: ReportConclusionIntegrityCode[] = [];
  const hardFailureCodes: ReportConclusionIntegrityCode[] = [];
  const labeledValues: Array<{ section: string; value: number }> = [];
  const labeledEffectiveDates: Array<{ section: string; date: string }> = [];

  for (const section of CONCLUSION_SECTIONS) {
    const text = narrativeText(data, section);
    if (!text) continue;

    for (const match of text.matchAll(VALUE_LABEL_PATTERN)) {
      const value = parseCurrency(match[1]);
      if (value != null) labeledValues.push({ section, value });
    }

    for (const match of text.matchAll(EFFECTIVE_DATE_LABEL_PATTERN)) {
      const date = parseDate(match[1]);
      if (date != null) labeledEffectiveDates.push({ section, date });
    }
  }

  if (labeledValues.length === 0) {
    warnings.push(
      'No machine-checkable final-value label was found in the executive or reconciliation narratives; the deterministic conclusion exhibit remains authoritative.'
    );
    warningCodes.push('FINAL_VALUE_LABEL_MISSING');
  } else {
    const mismatches = labeledValues.filter(({ value }) => Math.abs(value - data.concludedValue) > 1);
    if (mismatches.length > 0) {
      hardFailures.push(
        `Narrative final-value label conflicts with the stored conclusion ${money(data.concludedValue)}: ${mismatches
          .map(({ section, value }) => `${section} states ${money(value)}`)
          .join('; ')}`
      );
      hardFailureCodes.push('FINAL_VALUE_MISMATCH');
    }
  }

  if (labeledEffectiveDates.length === 0) {
    warnings.push(
      'No machine-checkable valuation/effective-date label was found in the executive or reconciliation narratives; the deterministic cover and conclusion exhibits remain authoritative.'
    );
    warningCodes.push('EFFECTIVE_DATE_LABEL_MISSING');
  } else {
    const mismatches = labeledEffectiveDates.filter(({ date }) => date !== data.valuationDate);
    if (mismatches.length > 0) {
      hardFailures.push(
        `Narrative valuation-date label conflicts with the stored effective date ${data.valuationDate}: ${mismatches
          .map(({ section, date }) => `${section} states ${date}`)
          .join('; ')}`
      );
      hardFailureCodes.push('EFFECTIVE_DATE_MISMATCH');
    }
  }

  return {
    warnings,
    hardFailures,
    warningCodes,
    hardFailureCodes,
    labeledValues,
    labeledEffectiveDates,
  };
}
