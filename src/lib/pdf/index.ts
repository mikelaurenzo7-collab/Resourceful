// ─── PDF Generation Module ───────────────────────────────────────────────────
// Single public export. The pipeline calls this and receives a Buffer.
// Nothing else in the codebase should import from any other file in src/lib/pdf/.

import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import ReportDocument from './ReportDocument';
import { assertReportPreflight, type ReportPreflightResult } from './report-preflight';
import {
  buildReportArtifactManifest,
  type ReportArtifactManifest,
} from './report-manifest';

// Ensure fonts are registered (side-effect import)
import './styles/theme';

export interface GeneratedReportPDF {
  buffer: Buffer;
  preflight: ReportPreflightResult;
  manifest: ReportArtifactManifest;
}

/**
 * Generate a complete PDF report as a Node.js Buffer.
 *
 * The deterministic preflight runs before React PDF is allowed to render. This
 * prevents incomplete, contradictory, or raw-layout model output from becoming
 * a customer-facing artifact.
 */
export async function generateReportPDF(data: ReportTemplateData): Promise<Buffer> {
  const { buffer } = await generateValidatedReportPDF(data);
  return buffer;
}

/**
 * Validation-aware report generation for pipeline stages that need to persist
 * warnings and reproducibility metadata in the report manifest or review workfile.
 */
export async function generateValidatedReportPDF(
  data: ReportTemplateData
): Promise<GeneratedReportPDF> {
  const PDF_TIMEOUT_MS = 120_000;
  const preflight = assertReportPreflight(data);

  // Cast required because @react-pdf/renderer types expect ReactElement<DocumentProps>
  // but our component returns Document which satisfies this at runtime.
  const element = React.createElement(ReportDocument, { data });
  const renderPromise = renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);

  const rendered = await Promise.race([
    renderPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timed out after 120s')), PDF_TIMEOUT_MS)
    ),
  ]);

  const buffer = Buffer.from(rendered);
  const manifest = buildReportArtifactManifest(data, preflight, buffer);

  return {
    buffer,
    preflight,
    manifest,
  };
}
