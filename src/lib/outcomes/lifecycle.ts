import type { ReportStatus, ServiceType } from '@/types/database';
import type { AppealOutcome } from './validation';

export const VALID_FILING_STATUSES = [
  'not_started',
  'ready_to_file',
  'guided_ready',
  'filed',
  'hearing_scheduled',
  'decision_pending',
  'closed',
] as const;

export type FilingStatus = (typeof VALID_FILING_STATUSES)[number];

export const VALID_FILING_METHODS = ['online', 'email', 'mail', 'in_person'] as const;
export type FilingMethod = (typeof VALID_FILING_METHODS)[number];

const FILED_OR_LATER = new Set<FilingStatus>([
  'filed',
  'hearing_scheduled',
  'decision_pending',
  'closed',
]);

const ALLOWED_FILING_TRANSITIONS: Record<FilingStatus, readonly FilingStatus[]> = {
  not_started: ['not_started', 'ready_to_file', 'guided_ready', 'filed'],
  ready_to_file: ['ready_to_file', 'guided_ready', 'filed'],
  guided_ready: ['guided_ready', 'ready_to_file', 'filed'],
  filed: ['filed', 'hearing_scheduled', 'decision_pending', 'closed'],
  hearing_scheduled: ['hearing_scheduled', 'decision_pending', 'closed'],
  decision_pending: ['decision_pending', 'closed'],
  closed: ['closed'],
};

export interface LifecycleValidationResult {
  valid: boolean;
  error?: string;
}

export function isFilingStatus(value: unknown): value is FilingStatus {
  return typeof value === 'string' && VALID_FILING_STATUSES.includes(value as FilingStatus);
}

export function isFilingMethod(value: unknown): value is FilingMethod {
  return typeof value === 'string' && VALID_FILING_METHODS.includes(value as FilingMethod);
}

export function isFiledOrLater(status: string | null | undefined): boolean {
  return isFilingStatus(status) && FILED_OR_LATER.has(status);
}

export function isFinalAppealOutcome(
  outcome: string | null | undefined
): outcome is Exclude<AppealOutcome, 'pending'> {
  return outcome === 'won' || outcome === 'lost' || outcome === 'withdrew' || outcome === 'didnt_file';
}

export function isAdjudicatedAppealOutcome(
  outcome: string | null | undefined
): outcome is 'won' | 'lost' {
  return outcome === 'won' || outcome === 'lost';
}

export function validateOutcomeTransition(
  currentOutcome: string | null | undefined,
  nextOutcome: AppealOutcome
): LifecycleValidationResult {
  if (!currentOutcome || currentOutcome === 'pending') {
    return { valid: true };
  }

  if (currentOutcome === nextOutcome) {
    return {
      valid: false,
      error: 'This final appeal outcome has already been recorded.',
    };
  }

  return {
    valid: false,
    error: 'A final appeal outcome is immutable. Contact support if the recorded decision is incorrect.',
  };
}

export function validateOutcomeFilingContext(input: {
  outcome: AppealOutcome;
  filingStatus: string | null | undefined;
  filedAt: string | null | undefined;
  filingMethod: string | null | undefined;
}): LifecycleValidationResult {
  if (input.outcome === 'didnt_file') return { valid: true };

  if (!isFiledOrLater(input.filingStatus) || !input.filedAt || !isFilingMethod(input.filingMethod)) {
    return {
      valid: false,
      error: 'Record the filing date and filing method before reporting an appeal outcome.',
    };
  }

  return { valid: true };
}

export function filingStatusForOutcome(
  outcome: AppealOutcome,
  currentStatus: string | null | undefined
): FilingStatus {
  if (outcome === 'pending') {
    return isFiledOrLater(currentStatus) ? 'decision_pending' : 'not_started';
  }

  return 'closed';
}

export function validateFilingUpdate(input: {
  reportStatus: ReportStatus;
  serviceType: ServiceType;
  currentFilingStatus: string | null | undefined;
  currentFiledAt: string | null | undefined;
  currentFilingMethod: string | null | undefined;
  currentOutcome: string | null | undefined;
  requestedFilingStatus?: unknown;
  requestedFiledAt?: unknown;
  requestedFilingMethod?: unknown;
  now?: Date;
}): LifecycleValidationResult {
  if (input.reportStatus !== 'delivered') {
    return {
      valid: false,
      error: 'Filing progress can only be updated after the report has been delivered.',
    };
  }

  if (input.serviceType !== 'tax_appeal') {
    return {
      valid: false,
      error: 'Filing progress is available only for property tax appeal assignments.',
    };
  }

  const currentStatus = isFilingStatus(input.currentFilingStatus)
    ? input.currentFilingStatus
    : 'not_started';

  const targetStatus = input.requestedFilingStatus === undefined
    ? currentStatus
    : input.requestedFilingStatus;

  if (!isFilingStatus(targetStatus)) {
    return {
      valid: false,
      error: `Invalid filing status. Must be one of: ${VALID_FILING_STATUSES.join(', ')}`,
    };
  }

  if (!ALLOWED_FILING_TRANSITIONS[currentStatus].includes(targetStatus)) {
    return {
      valid: false,
      error: `Filing progress cannot move from ${currentStatus} to ${targetStatus}.`,
    };
  }

  const finalFiledAt = input.requestedFiledAt === undefined
    ? input.currentFiledAt
    : input.requestedFiledAt;
  const finalFilingMethod = input.requestedFilingMethod === undefined
    ? input.currentFilingMethod
    : input.requestedFilingMethod;

  if (finalFiledAt !== null && finalFiledAt !== undefined) {
    if (typeof finalFiledAt !== 'string' || Number.isNaN(Date.parse(finalFiledAt))) {
      return { valid: false, error: 'Filing date must be a valid ISO date string.' };
    }

    const now = input.now ?? new Date();
    const latestAllowed = now.getTime() + 24 * 60 * 60 * 1000;
    if (new Date(finalFiledAt).getTime() > latestAllowed) {
      return { valid: false, error: 'Filing date cannot be in the future.' };
    }
  }

  if (finalFilingMethod !== null && finalFilingMethod !== undefined && !isFilingMethod(finalFilingMethod)) {
    return {
      valid: false,
      error: `Invalid filing method. Must be one of: ${VALID_FILING_METHODS.join(', ')}`,
    };
  }

  if (FILED_OR_LATER.has(targetStatus)) {
    if (!finalFiledAt || !isFilingMethod(finalFilingMethod)) {
      return {
        valid: false,
        error: 'A filing date and filing method are required once an appeal is marked filed.',
      };
    }
  } else if (finalFiledAt || finalFilingMethod) {
    return {
      valid: false,
      error: 'Filing proof cannot be attached before the appeal is marked filed.',
    };
  }

  if (targetStatus === 'closed' && !isFinalAppealOutcome(input.currentOutcome)) {
    return {
      valid: false,
      error: 'Record a final appeal outcome before closing the case.',
    };
  }

  return { valid: true };
}
