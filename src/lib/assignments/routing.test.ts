import { describe, expect, it } from 'vitest';
import {
  INDEPENDENT_VALUATION_MARKER,
  getActionGuideSectionName,
  getAssignmentDisplayLabel,
  getReportDocumentSubject,
  isIndependentValuationPurpose,
  markIndependentValuationPurpose,
  resolveAssignmentKind,
  stripIndependentValuationMarker,
} from './routing';

describe('assignment routing', () => {
  it('recognizes and normalizes independent valuation purposes', () => {
    const marked = markIndependentValuationPurpose(' Estate planning as of July 1, 2026 ');

    expect(marked).toBe(`${INDEPENDENT_VALUATION_MARKER} Estate planning as of July 1, 2026`);
    expect(isIndependentValuationPurpose(marked)).toBe(true);
    expect(stripIndependentValuationMarker(marked)).toBe('Estate planning as of July 1, 2026');
  });

  it('does not double-apply the independent valuation marker', () => {
    const marked = markIndependentValuationPurpose(
      `${INDEPENDENT_VALUATION_MARKER} Litigation support`
    );

    expect(marked).toBe(`${INDEPENDENT_VALUATION_MARKER} Litigation support`);
  });

  it('routes independent valuation ahead of the compatibility service type', () => {
    const purpose = `${INDEPENDENT_VALUATION_MARKER} Divorce decision support`;

    expect(resolveAssignmentKind('pre_listing', purpose)).toBe('independent_valuation');
    expect(getActionGuideSectionName('pre_listing', purpose)).toBe('valuation_use_guide');
    expect(getAssignmentDisplayLabel('pre_listing', purpose)).toBe('Independent Valuation Analysis');
    expect(getReportDocumentSubject('pre_listing', purpose)).toBe('Independent Property Valuation Analysis');
  });

  it('preserves standard service routing without the marker', () => {
    expect(resolveAssignmentKind('tax_appeal')).toBe('tax_appeal');
    expect(resolveAssignmentKind('pre_purchase')).toBe('pre_purchase');
    expect(resolveAssignmentKind('pre_listing')).toBe('pre_listing');

    expect(getActionGuideSectionName('tax_appeal')).toBe('pro_se_filing_guide');
    expect(getActionGuideSectionName('pre_purchase')).toBe('negotiation_guide');
    expect(getActionGuideSectionName('pre_listing')).toBe('pricing_strategy_guide');
  });

  it('uses service-specific PDF subjects', () => {
    expect(getReportDocumentSubject('tax_appeal')).toBe('Property Tax Appeal Valuation Analysis');
    expect(getReportDocumentSubject('pre_purchase')).toBe('Pre-Purchase Property Valuation Analysis');
    expect(getReportDocumentSubject('pre_listing')).toBe('Pre-Listing Property Valuation Analysis');
  });

  it('handles an empty independent valuation purpose without losing assignment identity', () => {
    const marked = markIndependentValuationPurpose('');

    expect(marked).toBe(INDEPENDENT_VALUATION_MARKER);
    expect(isIndependentValuationPurpose(marked)).toBe(true);
    expect(stripIndependentValuationMarker(marked)).toBe('');
  });
});
