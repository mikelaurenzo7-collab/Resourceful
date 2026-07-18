import { describe, expect, it } from 'vitest';
import { hasOnlyValidSourceCitations } from './research-agent';

describe('research source-citation validation', () => {
  it('accepts citations that reference supplied evidence', () => {
    expect(
      hasOnlyValidSourceCitations(
        'The filing authority lists the deadline as August 1. [SOURCE 1] The rule also requires a signed form. [SOURCE 2]',
        2
      )
    ).toBe(true);
  });

  it('accepts source labels case-insensitively', () => {
    expect(hasOnlyValidSourceCitations('Supported by the official page. [source 1]', 1)).toBe(true);
  });

  it('rejects uncited content', () => {
    expect(hasOnlyValidSourceCitations('The deadline is August 1.', 3)).toBe(false);
  });

  it.each([
    ['The deadline is unsupported. [SOURCE 0]', 3],
    ['The deadline cites missing evidence. [SOURCE 4]', 3],
    ['One citation is valid and one is invented. [SOURCE 1] [SOURCE 9]', 3],
  ])('rejects invalid supplied-source references', (content, sourceCount) => {
    expect(hasOnlyValidSourceCitations(content, sourceCount)).toBe(false);
  });
});
