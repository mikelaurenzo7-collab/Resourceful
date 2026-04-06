// ─── PDF Generation Module ───────────────────────────────────────────────────
// Single public export. The pipeline calls this and receives a Buffer.
// Nothing else in the codebase should import from any other file in src/lib/pdf/.

import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import ReportDocument from './ReportDocument';

// Ensure fonts are registered (side-effect import)
import './styles/theme';

/**
 * Generate a complete PDF report as a Node.js Buffer.
 *
 * @param data - The full report data (same shape as the old HTML template)
 * @returns Buffer containing the PDF bytes
 * @throws Error if rendering fails
 */
export async function generateReportPDF(data: ReportTemplateData): Promise<Buffer> {
  const PDF_TIMEOUT_MS = 120_000; // 2 minutes — generous for complex reports

  // Cast required because @react-pdf/renderer types expect ReactElement<DocumentProps>
  // but our component returns Document which satisfies this at runtime
  const element = React.createElement(ReportDocument, { data });
  const renderPromise = renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);

  const buffer = await Promise.race([
    renderPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timed out after 120s')), PDF_TIMEOUT_MS)
    ),
  ]);

  return Buffer.from(buffer);
}
