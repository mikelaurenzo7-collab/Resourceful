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

  it('routes Stage 7 through the governed React-PDF module and nationwide preflight', () => {
    const stage7 = readFileSync(
      join(process.cwd(), 'src', 'lib', 'pipeline', 'stages', 'stage7-pdf-assembly.ts'),
      'utf8'
    );

    expect(stage7).toContain("import { generateReportPDF } from '@/lib/pdf'");
    expect(stage7).toContain("import { evaluateNationwideReportIntegrity } from '@/lib/valuation/nationwide-report-integrity-policy'");
    expect(stage7).toContain('const nationwideIntegrity = evaluateNationwideReportIntegrity(templateData)');
    expect(stage7).toContain('hardFails.push(...nationwideIntegrity.hardFailures)');
    expect(stage7.indexOf('evaluateNationwideReportIntegrity(templateData)')).toBeLessThan(
      stage7.indexOf('generateReportPDF(templateData)')
    );
    expect(stage7).not.toContain('generateReportHtml');
    expect(stage7).not.toContain('puppeteer');
  });

  it('drives the report body and table of contents from one ordered render plan', () => {
    const reportDocument = readFileSync(
      join(process.cwd(), 'src', 'lib', 'pdf', 'ReportDocument.tsx'),
      'utf8'
    );
    const contents = readFileSync(
      join(process.cwd(), 'src', 'lib', 'pdf', 'components', 'TableOfContents.tsx'),
      'utf8'
    );
    const plan = readFileSync(
      join(process.cwd(), 'src', 'lib', 'pdf', 'report-render-plan.ts'),
      'utf8'
    );

    expect(reportDocument).toContain('const plan = buildReportRenderPlan(data)');
    expect(reportDocument).toContain('<TableOfContents data={data} plan={plan} />');
    expect(reportDocument).toContain('plan.sections.filter');
    expect(contents).toContain('const renderPlan = plan ?? buildReportRenderPlan(data)');
    expect(contents).toContain('sections.map');
    expect(plan).toContain('export function buildReportRenderPlan');
    expect(plan).toContain('normalizedNarratives');
  });
});
