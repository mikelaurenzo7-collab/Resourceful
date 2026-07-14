import { describe, expect, it } from 'vitest';
import {
  getCustomerServiceLabel,
  getCustomerStatusMessage,
  isEvidenceInsufficient,
} from './report-status';

describe('report status policy', () => {
  it('classifies evidence insufficiency separately from a technical failure', () => {
    const errorLog = {
      stage: 'stage-7-pdf',
      error: 'QA pre-flight failed: No evidence-backed valuation approach available',
    };

    expect(isEvidenceInsufficient(errorLog)).toBe(true);
    expect(getCustomerStatusMessage('failed', errorLog)).toEqual({
      title: 'Additional Evidence Needed',
      description:
        'The available records did not support a defensible value conclusion. The review team is checking what documentation can complete the analysis and may request a tax bill, prior appraisal, income and expense records, leases, or recent sale documents.',
      category: 'evidence_required',
    });
  });

  it('keeps timeouts and provider faults in the technical error category', () => {
    const errorLog = {
      stage: 'stage-2-comps',
      error: 'Stage timed out after 600 seconds',
      stack: 'FetchError: upstream connection reset',
    };

    expect(isEvidenceInsufficient(errorLog)).toBe(false);
    expect(getCustomerStatusMessage('failed', errorLog).category).toBe('technical_error');
    expect(getCustomerStatusMessage('failed', errorLog).title).toBe('Processing Issue');
  });

  it('uses explicit delivery and revision messages', () => {
    expect(getCustomerStatusMessage('delivering')).toEqual({
      title: 'Preparing Delivery',
      description: 'Your approved report is being packaged and securely delivered.',
      category: 'ready',
    });

    expect(getCustomerStatusMessage('rejected')).toEqual({
      title: 'Report Needs Revision',
      description:
        'Quality review identified items that must be corrected before delivery. The package is being revised.',
      category: 'revision_required',
    });
  });

  it('labels compatibility-routed neutral valuations correctly', () => {
    expect(
      getCustomerServiceLabel(
        'pre_purchase',
        '[INDEPENDENT_VALUATION] Estate planning and internal decision support'
      )
    ).toBe('Independent Valuation Analysis');
  });

  it('retains standard service labels when no independent marker exists', () => {
    expect(getCustomerServiceLabel('tax_appeal')).toBe('Property Tax Appeal Analysis');
    expect(getCustomerServiceLabel('pre_purchase')).toBe('Pre-Purchase Analysis');
    expect(getCustomerServiceLabel('pre_listing')).toBe('Pre-Listing Analysis');
    expect(getCustomerServiceLabel('unknown')).toBe('Property Valuation Analysis');
  });
});
