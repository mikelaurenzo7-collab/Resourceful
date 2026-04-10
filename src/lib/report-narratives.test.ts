import { describe, expect, it } from 'vitest';

import { findNarrativeContent, getNarrativeDisplayName } from './report-narratives';

describe('findNarrativeContent', () => {
  it('returns canonical narrative content when present', () => {
    const content = findNarrativeContent(
      [
        { section_name: 'income_approach_narrative', content: 'Canonical income approach narrative' },
        { section_name: 'income_approach', content: 'Legacy income approach narrative' },
      ],
      'income_approach_narrative'
    );

    expect(content).toBe('Canonical income approach narrative');
  });

  it('falls back to legacy narrative aliases when needed', () => {
    const content = findNarrativeContent(
      [{ section_name: 'reconciliation', content: 'Legacy reconciliation narrative' }],
      'reconciliation_narrative'
    );

    expect(content).toBe('Legacy reconciliation narrative');
  });

  it('returns null when no canonical or legacy narrative exists', () => {
    const content = findNarrativeContent([], 'cost_approach_narrative');

    expect(content).toBeNull();
  });
});

describe('getNarrativeDisplayName', () => {
  it('returns explicit display labels for new appraisal sections', () => {
    expect(getNarrativeDisplayName('summary_of_salient_facts')).toBe('Summary of Salient Facts');
    expect(getNarrativeDisplayName('certification_and_limiting_conditions')).toBe('Certification & Limiting Conditions');
  });

  it('humanizes unknown narrative section names', () => {
    expect(getNarrativeDisplayName('custom_analysis_section')).toBe('Custom Analysis Section');
  });
});