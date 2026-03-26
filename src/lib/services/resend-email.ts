// ─── Resend Email Service ─────────────────────────────────────────────────────
// Transactional emails for report delivery, admin notifications, and alerts.

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
  propertyAddress: string;
  concludedValue: number;
  assessedValue: number;
  potentialSavings: number;
  pdfUrl: string;
  filingGuide: string;
  reviewTier?: string;
  hasHearingPrep?: boolean;
}

export interface AdminNotificationParams {
  reportId: string;
  propertyAddress: string;
  propertyType: string;
  reviewUrl: string;
  reviewTier?: string;
  tierLabel?: string;
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
 * Send the completed report to the customer with PDF attachment link
 * and filing guide.
 */
export async function sendReportDeliveryEmail(
  params: ReportDeliveryParams
): Promise<ServiceResult<EmailResult>> {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: `Your Property Assessment Report — ${params.propertyAddress}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Your Report is Ready</h1>
          <p>Your property assessment report for <strong>${escapeHtml(params.propertyAddress)}</strong> is complete.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
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
              </tr>
            </table>
          </div>

          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app'}/report/${params.reportId}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
            View Your Report &amp; Filing Instructions
          </a>

          ${params.reviewTier === 'full_representation' ? `
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <strong style="color: #065f46;">We Filed Your Appeal</strong>
            <p style="margin: 4px 0 0; font-size: 13px; color: #555;">
              Our team has filed the property tax appeal on your behalf. Your report page includes the full filing details and next steps. We will attend the hearing as your authorized representative and keep you updated on the outcome.
            </p>
          </div>
          ` : params.reviewTier === 'guided_filing' ? `
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <strong style="color: #065f46;">Your Guided Filing Session</strong>
            <p style="margin: 4px 0 0; font-size: 13px; color: #555;">
              Your report includes a hearing preparation guide with opening statements, evidence presentation order, and talking points. Our team will reach out within 1 business day to schedule your live guided filing session where we walk you through the entire process step by step.
            </p>
          </div>
          ` : ''}

          <p style="margin-top: 16px; font-size: 13px; color: #666;">
            Your report page includes your full PDF${params.reviewTier !== 'full_representation' ? ', county-specific filing instructions, deadlines, required forms, and step-by-step guidance' : ' and the complete case documentation'}.
            ${params.hasHearingPrep ? ' It also includes a hearing preparation guide with scripted opening statements and practice Q&A.' : ''}
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
 * Notify admin that a report is ready for review/approval.
 */
export async function sendAdminNotification(
  params: AdminNotificationParams
): Promise<ServiceResult<EmailResult>> {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `[${params.tierLabel ?? 'Review Needed'}] Report ${params.reportId.slice(0, 8)} — ${params.propertyAddress}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Report Ready for Review</h1>
          <p>A new report has been generated and needs approval before delivery.</p>

          ${params.reviewTier && params.reviewTier !== 'auto' ? `
          <div style="background: ${params.reviewTier === 'full_representation' ? '#fef2f2' : params.reviewTier === 'guided_filing' ? '#ecfdf5' : '#eff6ff'}; border-left: 4px solid ${params.reviewTier === 'full_representation' ? '#ef4444' : params.reviewTier === 'guided_filing' ? '#10b981' : '#3b82f6'}; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <strong>${escapeHtml(params.tierLabel ?? params.reviewTier)}</strong>
            <p style="margin: 4px 0 0; font-size: 13px; color: #555;">
              ${params.reviewTier === 'full_representation'
                ? 'This client paid for full representation. After approval, our team must file the appeal on their behalf via the county portal before delivering the report.'
                : params.reviewTier === 'guided_filing'
                  ? 'This client paid for guided filing. After approval, schedule a guided filing session before or alongside report delivery.'
                  : 'This client paid for expert review. A licensed appraiser must review before delivery.'}
            </p>
          </div>
          ` : ''}

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
              <tr>
                <td style="padding: 8px 0; color: #666;">Tier</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.tierLabel ?? 'Standard')}</td>
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
