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
  lockInPriceCents?: number;
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

export interface PhotoReminderParams {
  to: string;
  reportId: string;
  propertyAddress: string;
  hoursRemaining: number;
  estimatedSavings?: number;
}

export interface PaymentConfirmationParams {
  to: string;
  reportId: string;
  propertyAddress: string;
  amountPaidCents: number;
  propertyType: string;
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

          <p style="margin-top: 16px; font-size: 13px; color: #666;">
            Your report page includes your full PDF, county-specific filing instructions, deadlines, required forms, and step-by-step guidance.
          </p>

          <p style="margin-top: 12px;">
            <a href="${params.pdfUrl}" style="color: #2563eb; text-decoration: underline; font-size: 13px;">
              Or download the PDF directly
            </a>
            <span style="font-size: 12px; color: #999;"> (link expires in 7 days)</span>
          </p>

          <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 32px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-weight: 700; color: #92400e; font-size: 16px;">Lock In Next Year&apos;s Report at 50% Off</p>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #78350f;">Your county reassesses annually. Protect your savings with an updated report when the next assessment drops — at half price.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app'}/start?lockin=${params.reportId}" style="display: inline-block; background: #d97706; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Reserve for ${formatCurrency(params.lockInPriceCents || 2950)}
            </a>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #92400e;">One-time payment. Activates when your next assessment is published.</p>
          </div>

          <p style="margin-top: 16px; font-size: 12px; color: #999;">
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

/**
 * Send a 12-hour reminder to upload photos before the enhancement window closes.
 * Non-critical — failure doesn't affect the report pipeline.
 */
export async function sendPhotoReminderEmail(
  params: PhotoReminderParams
): Promise<ServiceResult<EmailResult>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';
  const savingsLine = params.estimatedSavings
    ? `<p style="margin: 16px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; text-align: center;"><span style="font-size: 14px; color: #166534;">Our preliminary analysis found <strong>${formatDollarValue(params.estimatedSavings)}/year</strong> in potential savings.</span><br><span style="font-size: 12px; color: #15803d;">Photos of your property&apos;s condition can increase this amount.</span></p>`
    : '';

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: `${params.hoursRemaining} hours left to upload photos — ${params.propertyAddress}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Strengthen Your Evidence Package</h1>
          <p>Your property assessment report for <strong>${escapeHtml(params.propertyAddress)}</strong> is being finalized.</p>
          <p>You have <strong>${params.hoursRemaining} hours</strong> left to upload photos that will be included in your report.</p>
          ${savingsLine}
          <h3 style="color: #1a1a1a; font-size: 16px; margin-top: 24px;">What to Photograph</h3>
          <ul style="color: #444; font-size: 14px; line-height: 1.8;">
            <li>Water damage, stains, or mold</li>
            <li>Foundation cracks or structural issues</li>
            <li>Outdated kitchens, bathrooms, or fixtures</li>
            <li>Aging HVAC, plumbing, or electrical systems</li>
            <li>Any deferred maintenance the assessor hasn&apos;t seen</li>
          </ul>
          <a href="${appUrl}/report/${params.reportId}/photos" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; margin-top: 16px;">
            Upload Photos Now
          </a>
          <p style="margin-top: 24px; font-size: 12px; color: #999;">
            No photos? No problem — your report will still include comparable sales analysis
            and independent market data. Photos just make your evidence package stronger.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[resend] sendPhotoReminderEmail error:`, error);
      return { data: null, error: `Photo reminder failed: ${error.message}` };
    }

    return { data: { id: data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendPhotoReminderEmail error: ${message}`);
    return { data: null, error: `Photo reminder failed: ${message}` };
  }
}

/**
 * Send payment confirmation email immediately after successful payment.
 * Includes order summary, photo upload CTA, and money-back guarantee.
 */
export async function sendPaymentConfirmationEmail(
  params: PaymentConfirmationParams
): Promise<ServiceResult<EmailResult>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';
  const amount = formatCurrency(params.amountPaidCents);

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: `Payment confirmed — ${params.propertyAddress}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Payment Confirmed</h1>
          <p>Thank you for your order. Your property assessment report will be delivered within 24 hours.</p>

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
              <tr style="border-top: 1px solid #ddd;">
                <td style="padding: 8px 0; font-weight: 600;">Amount Paid</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${amount}</td>
              </tr>
            </table>
          </div>

          <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; color: #166534; font-weight: 600;">Money-Back Guarantee</p>
            <p style="margin: 8px 0 0 0; color: #15803d; font-size: 13px;">If our analysis finds no savings opportunity, you&apos;ll receive a complete refund.</p>
          </div>

          <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 32px;">Strengthen Your Evidence</h2>
          <p style="color: #444; font-size: 14px;">You have <strong>24 hours</strong> to upload photos of your property. Photos of damage, deferred maintenance, and aging systems are your strongest independent evidence — the assessor has never been inside your home.</p>

          <a href="${appUrl}/report/${params.reportId}/photos" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; margin-top: 8px;">
            Upload Photos
          </a>

          <p style="margin-top: 24px; font-size: 12px; color: #999;">
            No photos? No problem — your report will still include comparable sales analysis. Photos just make your evidence package stronger.
          </p>

          <p style="margin-top: 16px; font-size: 12px; color: #999;">
            Report ID: ${params.reportId}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[resend] sendPaymentConfirmationEmail error:`, error);
      return { data: null, error: `Payment confirmation failed: ${error.message}` };
    }

    return { data: { id: data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[resend] sendPaymentConfirmationEmail error: ${message}`);
    return { data: null, error: `Payment confirmation failed: ${message}` };
  }
}
