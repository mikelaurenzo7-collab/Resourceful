// ─── PDF Generation Service ──────────────────────────────────────────────────
// Using @sparticuz/chromium + puppeteer-core for maximum output fidelity and
// Vercel serverless compatibility. Chromium renders the full HTML/CSS report
// template identically to a browser, ensuring professional typeset quality.
// Cold start ~2-3s is acceptable given reports are generated asynchronously.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Configuration ───────────────────────────────────────────────────────────

// Pre-configure chromium for serverless (disable GPU rendering)
chromium.setGraphicsMode = false;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render an HTML string to a PDF buffer using headless Chromium.
 *
 * Produces a Letter-size (8.5 x 11 in) PDF with 1-inch margins.
 * Supports full @page CSS rules for headers, footers, and page breaks.
 */
export async function generatePdf(
  html: string
): Promise<ServiceResult<Buffer>> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    // Set content and wait for all resources (images, fonts) to load
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30_000,
    });

    // Generate PDF with Letter size and 1-inch margins
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      },
      printBackground: true,
      preferCSSPageSize: true, // Honor @page CSS rules if present
    });

    // puppeteer-core returns Uint8Array; convert to Buffer for consistency
    const buffer = Buffer.from(pdfBuffer);

    return { data: buffer, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pdf] generatePdf error: ${message}`);
    return { data: null, error: `PDF generation failed: ${message}` };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error(
          `[pdf] browser close error: ${closeErr instanceof Error ? closeErr.message : String(closeErr)}`
        );
      }
    }
  }
}
