// ─── Resend Email Service ─────────────────────────────────────────────────────
// Transactional emails for report delivery, admin notifications, alerts,
// and auto-filing (submitting appeals on behalf of clients).

import { Resend } from 'resend';

// ─── Client ──────────────────────────────────────────────────────────────────

// Lazy-initialize to avoid build-time errors when env vars aren't set
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'reports@resourceful.app';
// Separate "from" for auto-filing so counties receive appeals from a filings@ address,
// not the same reports@ address used for client notifications.
const FILING_FROM_ADDRESS = process.env.RESEND_FILING_FROM_ADDRESS ?? 'filings@resourceful.app';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'admin@resourceful.app';

// Warn at init time if email config is using defaults — prevents silent misconfiguration
if (!process.env.RESEND_FROM_ADDRESS) {
  console.warn('[resend] WARNING: RESEND_FROM_ADDRESS not set, using default: reports@resourceful.app');
}
if (!process.env.ADMIN_NOTIFICATION_EMAIL) {
  console.warn('[resend] WARNING: ADMIN_NOTIFICATION_EMAIL not set, using default: admin@resourceful.app');
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportDeliveryParams {
  to: string;
  reportId: string;
  serviceType: string; // 'tax_appeal' | 'pre_purchase' | 'pre_listing'
  propertyAddress: string;
  concludedValue: number;
  assessedValue: number;
  potentialSavings: number;
  pdfUrl: string;
  filingGuide: string;
}

export interface AppealFilingEmailSendParams {
  /** County's appeal filing email address (to:) */
  countyFilingEmail: string;
  /** Client email for reply-to and CC */
  clientEmail: string;
  /** Client name for display */
  clientName: string | null;
  propertyAddress: string;
  parcelId: string | null;
  countyName: string;
  state: string;
  appealBoardName: string | null;
  assessedValue: number;
  concludedValue: number;
  potentialSavings: number;
  /** AI-generated cover letter text */
  coverLetterText: string;
  /** Signed URL to the report PDF (evidence attachment link) */
  pdfUrl: string;
}

export interface AdminNotificationParams {
  reportId: string;
  propertyAddress: string;
  propertyType: string;
  reviewUrl: string;
}

export interface ReportRejectionAlertParams {
  reportId: string;
  propertyAddress: string;
  notes: string;
}

export interface EmailResult {
  id: string;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatDollarValue(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

/** Escape HTML entities to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send the completed report to the customer with PDF attachment link.
 * Content varies by service type so every client gets a relevant email.
 */
export async function sendReportDeliveryEmail(
  params: ReportDeliveryParams
): Promise<ServiceResult<EmailResult>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';
  const reportUrl = `${appUrl}/report/${params.reportId}`;

  // Build service-type-specific subject and summary block
  let subject: string;
  let summaryHtml: string;
  let guidanceHtml: string;

  if (params.serviceType === 'pre_purchase') {
    const gap = params.assessedValue - params.concludedValue; // negative = overpriced
    const overpriced = gap < 0;
    subject = `Your Pre-Purchase Analysis — ${params.propertyAddress}`;
    summaryHtml = `
      <tr>
        <td style="padding: 8px 0; color: #666;">Independent Market Value</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDollarValue(params.concludedValue)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Listed / Asking Price</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDollarValue(params.assessedValue)}</td>
      </tr>
      <tr style="border-top: 1px solid #ddd;">
        <td style="padding: 8px 0; font-weight: 600; color: ${overpriced ? '#dc2626' : '#1a8a1a'};">
          ${overpriced ? 'Overpriced By' : 'Fairly Priced — Gap'}
        </td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${overpriced ? '#dc2626' : '#1a8a1a'};">
          ${formatDollarValue(Math.abs(gap))}
        </td>
      </tr>`;
    guidanceHtml = `<p style="margin-top: 16px; font-size: 13px; color: #666;">
      Your report includes your independent value conclusion, negotiation memo, risk flag analysis, tax projection, and a step-by-step buyer action guide.
    </p>`;
  } else if (params.serviceType === 'pre_listing') {
    subject = `Your Pre-Listing Analysis — ${params.propertyAddress}`;
    summaryHtml = `
      <tr>
        <td style="padding: 8px 0; color: #666;">Recommended List Price</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDollarValue(params.concludedValue)}</td>
      </tr>
      <tr style="border-top: 1px solid #ddd;">
        <td style="padding: 8px 0; color: #1a8a1a; font-weight: 600;">Listing Strategy</td>
        <td style="padding: 8px 0; text-align: right; color: #1a8a1a; font-weight: 600;">Ready</td>
      </tr>`;
    guidanceHtml = `<p style="margin-top: 16px; font-size: 13px; color: #666;">
      Your report includes your listing price recommendation, value-add priority list with ROI estimates, buyer profile brief, and a launch action plan.
    </p>`;
  } else {
    // tax_appeal — original behavior
    subject = `Your Property Assessment Report — ${params.propertyAddress}`;
    summaryHtml = `
      <tr>
        <td style="padding: 8px 0; color: #666;">Concluded Market Value</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDollarValue(params.concludedValue)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Current Assessed Value</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDollarValue(params.assessedValue)}</td>
      </tr>
      <tr style="border-top: 1px solid #ddd;">
        <td style="padding: 8px 0; color: #1a8a1a; font-weight: 600;">Potential Tax Savings</td>
        <td style="padding: 8px 0; text-align: right; color: #1a8a1a; font-weight: 600;">${formatDollarValue(params.potentialSavings)}</td>
      </tr>`;
    guidanceHtml = `<p style="margin-top: 16px; font-size: 13px; color: #666;">
      Your report page includes your full PDF, county-specific filing instructions, deadlines, required forms, and step-by-step guidance.
    </p>`;
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Your Report is Ready</h1>
          <p>Your analysis for <strong>${escapeHtml(params.propertyAddress)}</strong> is complete.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              ${summaryHtml}
            </table>
          </div>

          <a href="${reportUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
            View Your Full Report
          </a>

          ${guidanceHtml}

          <p style="margin-top: 12px;">
            <a href="${params.pdfUrl}" style="color: #2563eb; text-decoration: underline; font-size: 13px;">
              Or download the PDF directly
            </a>
            <span style="font-size: 12px; color: #999;"> (link expires in 7 days)</span>
          </p>

          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            This market value analysis is not a certified appraisal or legal advice. You are responsible for verifying all data and meeting applicable deadlines.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[resend] sendReportDeliveryEmail error:`, error);
      return { data: null, error: `Email send failed: ${error.message}` };
    }

    return { data: { id: data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendReportDeliveryEmail error: ${message}`);
    return { data: null, error: `Email send failed: ${message}` };
  }
}

/**
 * Auto-file a property tax appeal on behalf of the client by emailing
 * the appeal directly to the county's filing email address.
 *
 * The county receives a formal cover letter + link to the evidence PDF.
 * The client is CC'd so they have a record of the submission.
 */
export async function sendAppealFilingEmail(
  params: AppealFilingEmailSendParams
): Promise<ServiceResult<EmailResult>> {
  const subjectLine = [
    'Property Tax Appeal',
    params.propertyAddress,
    params.parcelId ? `Parcel ${params.parcelId}` : null,
  ].filter(Boolean).join(' — ');

  const clientDisplay = params.clientName
    ? `${escapeHtml(params.clientName)} (${escapeHtml(params.clientEmail)})`
    : escapeHtml(params.clientEmail);

  try {
    const { data, error } = await getResend().emails.send({
      from: FILING_FROM_ADDRESS,
      to: params.countyFilingEmail,
      cc: params.clientEmail,
      replyTo: params.clientEmail,
      subject: subjectLine,
      html: `
        <div style="font-family: Georgia, serif; max-width: 680px; margin: 0 auto; color: #1a1a1a; line-height: 1.6;">
          <pre style="font-family: inherit; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(params.coverLetterText)}</pre>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;" />

          <div style="background: #f9f9f9; border-radius: 6px; padding: 16px; font-family: -apple-system, sans-serif; font-size: 13px;">
            <p style="margin: 0 0 8px 0; font-weight: 600;">Supporting Evidence Package</p>
            <p style="margin: 0 0 4px 0; color: #555;">
              An independent market analysis has been prepared in support of this appeal, including:
            </p>
            <ul style="margin: 8px 0; padding-left: 20px; color: #555;">
              <li>${params.assessedValue ? `Current assessed value: ${formatDollarValue(params.assessedValue)}` : ''}</li>
              <li>Supported market value: ${formatDollarValue(params.concludedValue)}</li>
              <li>Potential overassessment: ${formatDollarValue(params.potentialSavings)}</li>
            </ul>
            <p style="margin: 8px 0 0 0;">
              <a href="${params.pdfUrl}" style="color: #2563eb; text-decoration: underline;">
                Download Full Evidence Report (PDF)
              </a>
              <span style="color: #999; font-size: 11px;"> — link valid for 7 days</span>
            </p>
          </div>

          <p style="margin-top: 20px; font-size: 12px; color: #888; font-family: -apple-system, sans-serif;">
            This appeal was submitted on behalf of ${clientDisplay} by Resourceful Analytics.
            The property owner has been CC'd on this email and can be reached directly at ${escapeHtml(params.clientEmail)}.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[resend] sendAppealFilingEmail error:`, error);
      return { data: null, error: `Appeal filing email failed: ${error.message}` };
    }

    return { data: { id: data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendAppealFilingEmail error: ${message}`);
    return { data: null, error: `Appeal filing email failed: ${message}` };
  }
}

/**
 * Notify admin that a report is ready for review/approval.
 */
export async function sendAdminNotification(
  params: AdminNotificationParams
): Promise<ServiceResult<EmailResult>> {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `[Review Needed] Report ${params.reportId.slice(0, 8)} — ${params.propertyAddress}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Report Ready for Review</h1>
          <p>A new report has been generated and needs approval before delivery.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Report ID</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace;">${params.reportId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Property</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.propertyAddress)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Type</td>
                <td style="padding: 8px 0; text-align: right;">${params.propertyType}</td>
              </tr>
            </table>
          </div>

          <a href="${params.reviewUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Review Report
          </a>
        </div>
      `,
    });

    if (error) {
      console.error(`[resend] sendAdminNotification error:`, error);
      return { data: null, error: `Admin notification failed: ${error.message}` };
    }

    return { data: { id: data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendAdminNotification error: ${message}`);
    return { data: null, error: `Admin notification failed: ${message}` };
  }
}

/**
 * Alert admin about a rejected report that may need re-processing.
 */
export async function sendReportRejectionAlert(
  params: ReportRejectionAlertParams
): Promise<ServiceResult<EmailResult>> {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `[Rejected] Report ${params.reportId.slice(0, 8)} — ${params.propertyAddress}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626; font-size: 24px;">Report Rejected</h1>
          <p>A report has been rejected during the approval process.</p>

          <div style="background: #fef2f2; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Report ID</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace;">${params.reportId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Property</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.propertyAddress)}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin: 24px 0;">
            <strong>Rejection Notes:</strong>
            <p style="margin: 8px 0 0 0; white-space: pre-wrap;">${escapeHtml(params.notes)}</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error(`[resend] sendReportRejectionAlert error:`, error);
      return { data: null, error: `Rejection alert failed: ${error.message}` };
    }

    return { data: { id: data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendReportRejectionAlert error: ${message}`);
    return { data: null, error: `Rejection alert failed: ${message}` };
  }
}
