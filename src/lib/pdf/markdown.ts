export interface InlineMarkdownSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'numbered_list'; items: string[]; start: number }
  | { type: 'table'; headers: string[]; rows: string[][]; numericColumns: number[] };

export function parseInlineMarkdown(text: string): InlineMarkdownSegment[] {
  const segments: InlineMarkdownSegment[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index) });
    }

    if (token.startsWith('**')) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else {
      segments.push({ text: token.slice(1, -1), italic: true });
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

export function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || /^-{3,}$/.test(trimmed)) {
      index++;
      continue;
    }

    if (isTableStart(lines, index)) {
      const { block, nextIndex } = parseTable(lines, index);
      blocks.push(block);
      index = nextIndex;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, text: trimmed.slice(4) });
      index++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, text: trimmed.slice(3) });
      index++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading', level: 1, text: trimmed.slice(2) });
      index++;
      continue;
    }

    if (/^[-*] /.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index].trim())) {
        items.push(lines[index].trim().slice(2));
        index++;
      }
      blocks.push({ type: 'bullet_list', items });
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const start = Number.parseInt(trimmed.match(/^(\d+)\./)?.[1] ?? '1', 10);
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s*/, ''));
        index++;
      }
      blocks.push({ type: 'numbered_list', items, start });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && shouldStayInParagraph(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index++;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function shouldStayInParagraph(lines: string[], index: number): boolean {
  const trimmed = lines[index].trim();
  if (!trimmed || /^-{3,}$/.test(trimmed)) return false;
  if (trimmed.startsWith('#')) return false;
  if (/^[-*] /.test(trimmed) || /^\d+\.\s/.test(trimmed)) return false;
  if (isTableStart(lines, index)) return false;
  return true;
}

function isTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length) return false;
  return isTableRow(lines[index]) && isTableSeparator(lines[index + 1]);
}

function isTableRow(line: string): boolean {
  return /^\|.+\|$/.test(line.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line.trim());
}

function parseTable(lines: string[], index: number): { block: MarkdownBlock; nextIndex: number } {
  const headers = parseTableRow(lines[index]);
  const rows: string[][] = [];
  let currentIndex = index + 2;

  while (currentIndex < lines.length && isTableRow(lines[currentIndex])) {
    rows.push(normalizeTableRow(parseTableRow(lines[currentIndex]), headers.length));
    currentIndex++;
  }

  return {
    block: {
      type: 'table',
      headers,
      rows,
      numericColumns: inferNumericColumns(rows),
    },
    nextIndex: currentIndex,
  };
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function normalizeTableRow(row: string[], targetLength: number): string[] {
  if (row.length >= targetLength) {
    return row.slice(0, targetLength);
  }

  return [...row, ...Array.from({ length: targetLength - row.length }, () => '—')];
}

function inferNumericColumns(rows: string[][]): number[] {
  if (rows.length === 0) {
    return [];
  }

  return rows[0]
    .map((_, columnIndex) => columnIndex)
    .filter((columnIndex) => {
      const values = rows
        .map((row) => stripInlineMarkdown(row[columnIndex] ?? '').trim())
        .filter((value) => value !== '' && value !== '—');

      return values.length > 0 && values.every(isLikelyNumericValue);
    });
}

function isLikelyNumericValue(value: string): boolean {
  const normalized = value
    .replace(/[,$()%]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\b(sf|sqft|ft|yr|yrs|year|years|mi|miles)\b/gi, '')
    .trim();

  return /^[-+]?\d+(\.\d+)?$/.test(normalized);
}