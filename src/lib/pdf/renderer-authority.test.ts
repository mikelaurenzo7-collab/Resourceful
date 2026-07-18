import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(absolute));
    } else if (/\.(?:ts|tsx)$/.test(entry)) {
      files.push(absolute);
    }
  }
  return files;
}

describe('authoritative final-report renderer', () => {
  it('prevents production code from invoking the legacy HTML report renderer', () => {
    const srcRoot = join(process.cwd(), 'src');
    const violations = sourceFiles(srcRoot)
      .filter((path) => !path.endsWith(join('src', 'lib', 'templates', 'report-template.ts')))
      .filter((path) => !path.endsWith(join('src', 'lib', 'pdf', 'renderer-authority.test.ts')))
      .filter((path) => /\bgenerateReportHtml\b/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(process.cwd(), path));

    expect(violations).toEqual([]);
  });

  it('routes Stage 7 through the governed React-PDF module', () => {
    const stage7 = readFileSync(
      join(process.cwd(), 'src', 'lib', 'pipeline', 'stages', 'stage7-pdf-assembly.ts'),
      'utf8'
    );

    expect(stage7).toContain("import { generateReportPDF } from '@/lib/pdf'");
    expect(stage7).not.toContain('generateReportHtml');
    expect(stage7).not.toContain('puppeteer');
  });
});
