import type { ReportStatus } from '@/types/database';

const INDEPENDENT_VALUATION_MARKER = '[INDEPENDENT_VALUATION]';

const EVIDENCE_INSUFFICIENCY_PATTERNS = [
  'no evidence-backed valuation approach available',
  'no concluded value available',
  'concluded value is missing or zero',
  'no comparable sales',
  'additional evidence is required',
  'not reconciled to the available income or cost evidence',
  'no concluded value available for filing guide',
  'insufficient market evidence',
] as const;

export type CustomerStatusCategory =
  | 'progress'
  | 'review'
  | 'ready'
  | 'evidence_required'
  | 'technical_error'
  | 'revision_required';

export interface CustomerStatusMessage {
  title: string;
  description: string;
  category: CustomerStatusCategory;
}

function pipelineErrorText(
  pipelineErrorLog: Record<string, unknown> | null | undefined
): string {
  if (!pipelineErrorLog) return '';

  return [
    pipelineErrorLog.error,
    pipelineErrorLog.stage,
    pipelineErrorLog.stack,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

export function isEvidenceInsufficient(
  pipelineErrorLog: Record<string, unknown> | null | undefined
): boolean {
  const text = pipelineErrorText(pipelineErrorLog);
  return EVIDENCE_INSUFFICIENCY_PATTERNS.some((pattern) => text.includes(pattern));
}

export function getCustomerStatusMessage(
  status: ReportStatus,
  pipelineErrorLog?: Record<string, unknown> | null
): CustomerStatusMessage {
  switch (status) {
    case 'intake':
      return {
        title: 'Intake In Progress',
        description: 'Complete the remaining intake steps to start the property analysis.',
        category: 'progress',
      };
    case 'paid':
      return {
        title: 'Payment Received',
        description: 'Payment is confirmed. Evidence collection will begin shortly.',
        category: 'progress',
      };
    case 'data_pull':
      return {
        title: 'Collecting Property Evidence',
        description: 'Resourceful is gathering property records, assessment data, and relevant market evidence.',
        category: 'progress',
      };
    case 'photo_pending':
      return {
        title: 'Reviewing Property Photos',
        description: 'Submitted photos are being organized into condition evidence and documentation exhibits.',
        category: 'progress',
      };
    case 'processing':
      return {
        title: 'Building Your Analysis',
        description: 'The valuation workfile, supporting narratives, and service-specific action plan are being prepared.',
        category: 'progress',
      };
    case 'pending_approval':
      return {
        title: 'Under Quality Review',
        description: 'The analysis is complete and undergoing final evidence, valuation, and filing-guidance review.',
        category: 'review',
      };
    case 'approved':
      return {
        title: 'Report Approved',
        description: 'Quality review is complete. The final package is being prepared for secure delivery.',
        category: 'ready',
      };
    case 'delivering':
      return {
        title: 'Preparing Delivery',
        description: 'Your approved report is being packaged and securely delivered.',
        category: 'ready',
      };
    case 'delivered':
      return {
        title: 'Report Delivered',
        description: 'Your report is ready. Review the full analysis, download the PDF, and follow the action guide.',
        category: 'ready',
      };
    case 'rejected':
      return {
        title: 'Report Needs Revision',
        description: 'Quality review identified items that must be corrected before delivery. The package is being revised.',
        category: 'revision_required',
      };
    case 'failed':
      if (isEvidenceInsufficient(pipelineErrorLog)) {
        return {
          title: 'Additional Evidence Needed',
          description:
            'The available records did not support a defensible value conclusion. The review team is checking what documentation can complete the analysis and may request a tax bill, prior appraisal, income and expense records, leases, or recent sale documents.',
          category: 'evidence_required',
        };
      }
      return {
        title: 'Processing Issue',
        description: 'A technical issue interrupted report generation. The team has been notified and will review the case.',
        category: 'technical_error',
      };
    default:
      return {
        title: 'Report In Progress',
        description: 'Your property analysis is being processed.',
        category: 'progress',
      };
  }
}

export function getCustomerServiceLabel(
  serviceType: string,
  desiredOutcome?: string | null
): string {
  if (desiredOutcome?.trim().startsWith(INDEPENDENT_VALUATION_MARKER)) {
    return 'Independent Valuation Analysis';
  }

  switch (serviceType) {
    case 'tax_appeal':
      return 'Property Tax Appeal Analysis';
    case 'pre_purchase':
      return 'Pre-Purchase Analysis';
    case 'pre_listing':
      return 'Pre-Listing Analysis';
    default:
      return 'Property Valuation Analysis';
  }
}
