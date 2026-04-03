// ─── Resend Email Service ─────────────────────────────────────────────────────
// Transactional emails for report delivery, admin notifications, and alerts.

import { Resend } from 'resend';
import { withRetry, isRetryableError } from '@/lib/utils/retry';

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
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'admin@resourceful.app';

/**
 * Send an email with retry logic (3 attempts, exponential backoff).
 * Wraps Resend's send() to handle transient failures.
 */
async function sendWithRetry(params: Parameters<Resend['emails']['send']>[0]) {
  return withRetry(
    async () => {
      const result = await getResend().emails.send(params);
      if (result.error) throw new Error(result.error.message);
      return result;
    },
    { maxAttempts: 3, baseDelayMs: 1000, retryOn: isRetryableError }
  );
}

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
  propertyAddress: string;
  concludedValue: number;
  assessedValue: number;
  potentialSavings: number;
  pdfUrl: string;
  filingGuide: string;
  filingDeadline?: string | null;
  countyName?: string | null;
}

export interface ReportReadyNotificationParams {
  to: string;
  reportId: string;
  propertyAddress: string;
  concludedValue: number;
  assessedValue: number;
  potentialSavings: number;
  countyName?: string | null;
}

export interface OutcomeFollowupParams {
  to: string;
  clientName: string | null;
  reportId: string;
  propertyAddress: string;
  potentialSavings: number;
  outcomeToken: string;
}

export interface AdminNotificationParams {
  reportId: string;
  propertyAddress: string;
  propertyType: string;
  reviewUrl: string;
  clientEmail?: string;
  concludedValue?: number;
  assessedValue?: number;
  potentialSavings?: number;
  county?: string;
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
 * Send the completed report to the customer with PDF attachment link
 * and filing guide.
 */
export async function sendReportDeliveryEmail(
  params: ReportDeliveryParams
): Promise<ServiceResult<EmailResult>> {
  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.potentialSavings > 0
        ? `You could save ${escapeHtml(formatDollarValue(params.potentialSavings))} — Your Report is Ready`
        : `Your Property Assessment Report — ${escapeHtml(params.propertyAddress)}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Your Report is Ready</h1>
          <p>Your property assessment report for <strong>${escapeHtml(params.propertyAddress)}</strong> is complete.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Concluded Market Value</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(formatDollarValue(params.concludedValue))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Current Assessed Value</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(formatDollarValue(params.assessedValue))}</td>
              </tr>
              <tr style="border-top: 1px solid #ddd;">
                <td style="padding: 8px 0; color: #1a8a1a; font-weight: 600;">Potential Over-Assessment</td>
                <td style="padding: 8px 0; text-align: right; color: #1a8a1a; font-weight: 600;">${escapeHtml(formatDollarValue(params.potentialSavings))}</td>
              </tr>
            </table>
          </div>

          ${params.filingDeadline ? `
          <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin: 0 0 24px 0;">
            <strong style="color: #9a3412;">Filing Deadline${params.countyName ? ` (${escapeHtml(params.countyName)})` : ''}:</strong>
            <span style="color: #9a3412;"> ${escapeHtml(params.filingDeadline)}</span>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #c2410c;">Don't miss your window — late filings are not accepted.</p>
          </div>
          ` : ''}

          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app'}/report/${params.reportId}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
            View Report &amp; Start Your Appeal
          </a>

          <p style="margin-top: 16px; font-size: 13px; color: #666;">
            Your report page includes your full PDF, county-specific filing instructions, required forms, and step-by-step guidance.
          </p>

          <p style="margin-top: 12px;">
            <a href="${params.pdfUrl}" style="color: #2563eb; text-decoration: underline; font-size: 13px;">
              Or download the PDF directly
            </a>
            <span style="font-size: 12px; color: #999;"> (link expires in 7 days)</span>
          </p>

          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            This market value analysis was prepared for property tax assessment purposes. It is not a certified appraisal or legal advice. You are responsible for verifying all data and meeting filing deadlines.
          </p>
        </div>
      `,
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendReportDeliveryEmail error: ${message}`);
    return { data: null, error: `Email send failed: ${message}` };
  }
}

/**
 * Notify admin that a report is ready for review/approval.
 */
export async function sendAdminNotification(
  params: AdminNotificationParams
): Promise<ServiceResult<EmailResult>> {
  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: params.potentialSavings && params.potentialSavings > 0
        ? `[Review] ${escapeHtml(formatDollarValue(params.potentialSavings))} savings — ${escapeHtml(params.propertyAddress)}`
        : `[Review Needed] Report ${params.reportId.slice(0, 8)} — ${escapeHtml(params.propertyAddress)}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Report Ready for Review</h1>
          <p>A new report has been generated and needs approval before delivery.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Property</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.propertyAddress)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Type</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.propertyType)}</td>
              </tr>
              ${params.county ? `<tr>
                <td style="padding: 8px 0; color: #666;">County</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.county)}</td>
              </tr>` : ''}
              ${params.clientEmail ? `<tr>
                <td style="padding: 8px 0; color: #666;">Client</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.clientEmail)}</td>
              </tr>` : ''}
              ${params.potentialSavings != null && params.potentialSavings > 0 ? `<tr style="border-top: 1px solid #ddd;">
                <td style="padding: 8px 0; color: #1a8a1a; font-weight: 600;">Potential Savings</td>
                <td style="padding: 8px 0; text-align: right; color: #1a8a1a; font-weight: 600;">${escapeHtml(formatDollarValue(params.potentialSavings))}</td>
              </tr>` : ''}
            </table>
          </div>

          <a href="${params.reviewUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Review Report
          </a>
          <p style="margin-top: 12px; font-size: 12px; color: #999;">Report ID: ${params.reportId}</p>
        </div>
      `,
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
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
    const result = await sendWithRetry({
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

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendReportRejectionAlert error: ${message}`);
    return { data: null, error: `Rejection alert failed: ${message}` };
  }
}

/**
 * Dashboard-first notification: let the customer know their report is ready
 * to view on their dashboard. No PDF attachment or signed URL — they access
 * everything from the report page, which never expires.
 */
export async function sendReportReadyNotification(
  params: ReportReadyNotificationParams
): Promise<ServiceResult<EmailResult>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';
  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.potentialSavings > 0
        ? `You could save ${escapeHtml(formatDollarValue(params.potentialSavings))} — Your Report is Ready`
        : `Your Property Assessment Report is Ready`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Your Report is Ready</h1>
          <p>Your property assessment report for <strong>${escapeHtml(params.propertyAddress)}</strong> has been reviewed and approved by our team.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Concluded Market Value</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(formatDollarValue(params.concludedValue))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Current Assessed Value</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(formatDollarValue(params.assessedValue))}</td>
              </tr>
              ${params.potentialSavings > 0 ? `<tr style="border-top: 1px solid #ddd;">
                <td style="padding: 8px 0; color: #1a8a1a; font-weight: 600;">Potential Over-Assessment</td>
                <td style="padding: 8px 0; text-align: right; color: #1a8a1a; font-weight: 600;">${escapeHtml(formatDollarValue(params.potentialSavings))}</td>
              </tr>` : ''}
            </table>
          </div>

          <p style="margin-bottom: 8px;">Your full report includes comparable sales analysis, adjustment grids, narratives, and county-specific filing instructions.</p>

          <a href="${appUrl}/report/${params.reportId}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
            View Your Report
          </a>

          <p style="margin-top: 16px;">
            <a href="${appUrl}/api/reports/${params.reportId}/download" style="color: #2563eb; text-decoration: underline; font-size: 13px;">
              Download PDF
            </a>
          </p>

          <p style="margin-top: 24px; font-size: 13px; color: #666;">
            Your report is always available on your dashboard — no expiring links.${params.countyName ? ` Check your report page for ${escapeHtml(params.countyName)} filing deadlines and step-by-step instructions.` : ''}
          </p>

          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            This market value analysis was prepared for property tax assessment purposes. It is not a certified appraisal or legal advice.
          </p>
        </div>
      `,
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendReportReadyNotification error: ${message}`);
    return { data: null, error: `Notification email failed: ${message}` };
  }
}

/**
 * Follow-up email sent ~60 days after delivery asking the customer
 * how their appeal went. Includes a unique token for unauthenticated
 * outcome submission — they can report their result in one click.
 */
export async function sendOutcomeFollowupEmail(
  params: OutcomeFollowupParams
): Promise<ServiceResult<EmailResult>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';
  const greeting = params.clientName ? `Hi ${escapeHtml(params.clientName)}` : 'Hi there';
  const outcomeUrl = `${appUrl}/report/${params.reportId}?token=${params.outcomeToken}`;

  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS,
      to: params.to,
      subject: 'How Did Your Property Tax Appeal Go?',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">How Did Your Appeal Go?</h1>
          <p>${greeting},</p>
          <p>A couple of months ago, we prepared your property tax assessment report for <strong>${escapeHtml(params.propertyAddress)}</strong>${params.potentialSavings > 0 ? ` showing a potential over-assessment of <strong>${escapeHtml(formatDollarValue(params.potentialSavings))}</strong>` : ''}.</p>

          <p>We'd love to hear how it went — your feedback helps us improve our analysis for future homeowners in your area.</p>

          <a href="${outcomeUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 16px 0;">
            Share Your Result
          </a>

          <p style="font-size: 13px; color: #666;">It takes less than 30 seconds. Just tell us if you won, lost, or are still waiting — and if you won, what your new assessed value is.</p>

          <p style="font-size: 13px; color: #666; margin-top: 24px;">
            <strong>Won your appeal?</strong> Share your result and we'll generate a referral code for 20% off your next report or to share with friends.
          </p>

          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            You received this email because you purchased a property tax assessment report from Resourceful.
            <br>Your report is always available at <a href="${appUrl}/report/${params.reportId}" style="color: #2563eb;">${appUrl}/report/${params.reportId}</a>.
          </p>
        </div>
      `,
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendOutcomeFollowupEmail error: ${message}`);
    return { data: null, error: `Outcome follow-up email failed: ${message}` };
  }
}
