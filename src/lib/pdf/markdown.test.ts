import { describe, expect, it } from 'vitest';

import { parseInlineMarkdown, parseMarkdownBlocks } from './markdown';

describe('parseInlineMarkdown', () => {
  it('preserves bold and italic segments', () => {
    expect(parseInlineMarkdown('Before **bold** and *italic* after')).toEqual([
      { text: 'Before ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'italic', italic: true },
      { text: ' after' },
    ]);
  });
});

describe('parseMarkdownBlocks', () => {
  it('parses markdown tables into structured blocks', () => {
    const blocks = parseMarkdownBlocks([
      '| Metric | Value |',
      '| --- | ---: |',
      '| Assessed Value | $250,000 |',
      '| Assessment Ratio | 10.0% |',
    ].join('\n'));

    expect(blocks).toEqual([
      {
        type: 'table',
        headers: ['Metric', 'Value'],
        rows: [
          ['Assessed Value', '$250,000'],
          ['Assessment Ratio', '10.0%'],
        ],
        numericColumns: [1],
      },
    ]);
  });

  it('joins wrapped paragraph lines and preserves numbered list starts', () => {
    const blocks = parseMarkdownBlocks([
      'First line of a paragraph',
      'continues on the next line.',
      '',
      '3. Third item',
      '4. Fourth item',
    ].join('\n'));

    expect(blocks).toEqual([
      {
        type: 'paragraph',
        text: 'First line of a paragraph continues on the next line.',
      },
      {
        type: 'numbered_list',
        items: ['Third item', 'Fourth item'],
        start: 3,
      },
    ]);
  });
});