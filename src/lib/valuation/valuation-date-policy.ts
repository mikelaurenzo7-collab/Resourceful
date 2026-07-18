export type ValuationEffectiveDateSource =
  | 'intake_current_date'
  | 'jurisdiction_convention'
  | 'user_supplied'
  | 'admin_override';

export interface ValuationEffectiveDateEvidence {
  date: string | null;
  source: ValuationEffectiveDateSource | null;
}

export interface ValuationEffectiveDateAssessment {
  date: string | null;
  source: ValuationEffectiveDateSource | null;
  hardFailures: string[];
}

function validYear(value: number | null | undefined): value is number {
  return Number.isInteger(value) && (value ?? 0) >= 1900 && (value ?? 0) <= 2200;
}

export function dateOnly(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizedConvention(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function requiresJanuaryFirst(convention: string): boolean {
  return /january\s*1|jan\.?\s*1|first day of january/.test(convention);
}

function priorYearConvention(convention: string): boolean {
  return (
    /\b(prior|preceding|previous)\b[^.]{0,40}\byear\b/.test(convention) ||
    /\byear\b[^.]{0,40}\b(prior|preceding|previous)\b/.test(convention)
  );
}

function sameYearConvention(convention: string): boolean {
  return (
    /\b(assessment|tax|same|current)\s+year\b/.test(convention) ||
    /january\s*1(?:st)?(?:\s+of)?\s+(?:each|every)\s+year/.test(convention)
  );
}

export function deriveTaxAppealEffectiveDate(input: {
  assessmentYear: number | null | undefined;
  valuationDateConvention: string | null | undefined;
}): ValuationEffectiveDateEvidence {
  if (!validYear(input.assessmentYear)) {
    return { date: null, source: null };
  }

  const convention = normalizedConvention(input.valuationDateConvention);
  if (!convention || !requiresJanuaryFirst(convention)) {
    return { date: null, source: null };
  }

  const yearOffset = priorYearConvention(convention)
    ? -1
    : sameYearConvention(convention)
      ? 0
      : null;
  if (yearOffset == null) {
    return { date: null, source: null };
  }

  return {
    date: `${input.assessmentYear + yearOffset}-01-01`,
    source: 'jurisdiction_convention',
  };
}

export function deriveCurrentAssignmentEffectiveDate(
  reportCreatedAt: string | null | undefined
): ValuationEffectiveDateEvidence {
  const date = dateOnly(reportCreatedAt);
  return date == null
    ? { date: null, source: null }
    : { date, source: 'intake_current_date' };
}

export function evaluateValuationEffectiveDate(input: {
  effectiveDate: string | null | undefined;
  source: string | null | undefined;
  isRetrospectiveAssignment: boolean;
  reportCreatedAt: string | null | undefined;
}): ValuationEffectiveDateAssessment {
  const hardFailures: string[] = [];
  const date = dateOnly(input.effectiveDate);
  const createdDate = dateOnly(input.reportCreatedAt);
  const source = [
    'intake_current_date',
    'jurisdiction_convention',
    'user_supplied',
    'admin_override',
  ].includes(input.source ?? '')
    ? input.source as ValuationEffectiveDateSource
    : null;

  if (date == null) {
    hardFailures.push('Valuation effective date is missing or invalid');
  }
  if (source == null) {
    hardFailures.push('Valuation effective date source is missing or invalid');
  }

  if (input.isRetrospectiveAssignment && date != null) {
    if (source === 'intake_current_date') {
      hardFailures.push(
        'Retrospective assignment cannot use the intake date as its valuation effective date'
      );
    }
    if (createdDate != null && date >= createdDate) {
      hardFailures.push(
        'Retrospective valuation effective date must precede the report intake date'
      );
    }
  }

  return { date, source, hardFailures };
}
