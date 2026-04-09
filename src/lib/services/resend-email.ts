// ─── Resend Email Service ─────────────────────────────────────────────────────
// Transactional emails for report delivery, admin notifications, and alerts.

import { Resend } from 'resend';
import { withRetry, isRetryableError } from '@/lib/utils/retry';
import { emailLogger } from '@/lib/logger';

// ─── Client ──────────────────────────────────────────────────────────────────

// Lazy-initialize to avoid build-time errors when env vars aren't set
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Lazy-evaluated: these resolve on first email send, not at module load time.
// This avoids build-time failures while still catching misconfig at runtime.
function getFromAddress(): string {
  const addr = process.env.RESEND_FROM_ADDRESS;
  if (!addr) {
    emailLogger.warn('[resend] WARNING: RESEND_FROM_ADDRESS not set, using default: reports@resourceful.app');
    return 'reports@resourceful.app';
  }
  return addr;
}

function getAdminEmail(): string {
  const addr = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!addr) {
    emailLogger.warn('[resend] WARNING: ADMIN_NOTIFICATION_EMAIL not set, using default: admin@resourceful.app');
    return 'admin@resourceful.app';
  }
  return addr;
}

// Cached on first access to avoid repeated env lookups and warnings
let _fromAddress: string | null = null;
let _adminEmail: string | null = null;

function FROM_ADDRESS_LAZY(): string {
  if (!_fromAddress) _fromAddress = getFromAddress();
  return _fromAddress;
}

function ADMIN_EMAIL_LAZY(): string {
  if (!_adminEmail) _adminEmail = getAdminEmail();
  return _adminEmail;
}

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

// ─── Types ───────────────────────────────────────────────────────────────────

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

/** Wrap email body in proper HTML document structure for Outlook/enterprise clients */
function wrapHtml(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0; padding:16px; background:#ffffff;">${body}</body></html>`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Notify admin that a report is ready for review/approval.
 */
export async function sendAdminNotification(
  params: AdminNotificationParams
): Promise<ServiceResult<EmailResult>> {
  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS_LAZY(),
      to: ADMIN_EMAIL_LAZY(),
      subject: params.potentialSavings && params.potentialSavings > 0
        ? `[Review] ${formatDollarValue(params.potentialSavings)} savings — ${params.propertyAddress}`
        : `[Review Needed] Report ${params.reportId.slice(0, 8)} — ${params.propertyAddress}`,
      html: wrapHtml(`
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
      `),
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emailLogger.error(`[resend] sendAdminNotification error: ${message}`);
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
      from: FROM_ADDRESS_LAZY(),
      to: ADMIN_EMAIL_LAZY(),
      subject: `[Rejected] Report ${params.reportId.slice(0, 8)} — ${params.propertyAddress}`,
      html: wrapHtml(`
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
      `),
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emailLogger.error(`[resend] sendReportRejectionAlert error: ${message}`);
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
      from: FROM_ADDRESS_LAZY(),
      to: params.to,
      subject: params.potentialSavings > 0
        ? `You could save ${formatDollarValue(params.potentialSavings)} — Your Report is Ready`
        : `Your Property Assessment Report is Ready`,
      html: wrapHtml(`
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
      `),
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emailLogger.error(`[resend] sendReportReadyNotification error: ${message}`);
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
      from: FROM_ADDRESS_LAZY(),
      to: params.to,
      subject: 'How Did Your Property Tax Appeal Go?',
      html: wrapHtml(`
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
      `),
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emailLogger.error(`[resend] sendOutcomeFollowupEmail error: ${message}`);
    return { data: null, error: `Outcome follow-up email failed: ${message}` };
  }
}

/**
 * Alert admin about a Stripe dispute (chargeback).
 */
export async function sendDisputeAlert(
  params: {
    disputeId: string;
    paymentIntentId: string;
    amount: number;
    reason: string;
    status: string;
    reportId?: string;
  }
): Promise<ServiceResult<EmailResult>> {
  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS_LAZY(),
      to: ADMIN_EMAIL_LAZY(),
      subject: `[DISPUTE ${params.status.toUpperCase()}] ${params.reason} — $${(params.amount / 100).toFixed(2)}`,
      html: wrapHtml(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626; font-size: 24px;">⚠️ Stripe Dispute ${params.status === 'needs_response' ? 'Opened' : params.status}</h1>
          <p>A customer has filed a dispute. Action may be required in the Stripe dashboard.</p>

          <div style="background: #fff5f5; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Dispute ID</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.disputeId)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Payment Intent</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.paymentIntentId)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Amount</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">$${(params.amount / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Reason</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.reason)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Status</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.status)}</td>
              </tr>
              ${params.reportId ? `<tr>
                <td style="padding: 8px 0; color: #666;">Report ID</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.reportId)}</td>
              </tr>` : ''}
            </table>
          </div>

          <a href="https://dashboard.stripe.com/disputes/${params.disputeId}" style="display: inline-block; background: #dc2626; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            View in Stripe Dashboard
          </a>
        </div>
      `),
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emailLogger.error(`[resend] sendDisputeAlert error: ${message}`);
    return { data: null, error: `Dispute alert failed: ${message}` };
  }
}

// ─── Payment Receipt Email ───────────────────────────────────────────────────

export interface PaymentReceiptParams {
  to: string;
  clientName: string | null;
  reportId: string;
  propertyAddress: string;
  amountCents: number;
  serviceName: string;
  tierName: string;
  discountApplied: boolean;
}

/**
 * Send a branded payment receipt after successful payment.
 * Stripe sends its own receipt, but a branded one builds trust
 * and sets expectations for what happens next.
 */
export async function sendPaymentReceipt(
  params: PaymentReceiptParams
): Promise<ServiceResult<EmailResult>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';
  const greeting = params.clientName ? `Hi ${escapeHtml(params.clientName)}` : 'Hi there';
  const amount = `$${(params.amountCents / 100).toFixed(2)}`;

  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS_LAZY(),
      to: params.to,
      subject: `Payment Confirmed — ${escapeHtml(params.propertyAddress)}`,
      html: wrapHtml(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Payment Confirmed</h1>
          <p>${greeting},</p>
          <p>Thank you for your order. We've received your payment and your report is now being generated.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Property</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.propertyAddress)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Report Type</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.serviceName)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Tier</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(params.tierName)}</td>
              </tr>
              ${params.discountApplied ? `<tr>
                <td style="padding: 8px 0; color: #666;">Tax Bill Discount</td>
                <td style="padding: 8px 0; text-align: right; color: #1a8a1a;">15% applied</td>
              </tr>` : ''}
              <tr style="border-top: 1px solid #ddd;">
                <td style="padding: 8px 0; font-weight: 600;">Total Charged</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${amount}</td>
              </tr>
            </table>
          </div>

          <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px;">What Happens Next</h2>
          <ol style="color: #444; padding-left: 20px; line-height: 1.8;">
            <li>Our system pulls property records, comparable sales, and county data</li>
            <li>AI analysis generates your evidence package</li>
            <li>Our team reviews the report for accuracy</li>
            <li>You receive an email when it's ready (most within 48 hours)</li>
          </ol>

          <a href="${appUrl}/dashboard" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; margin-top: 16px;">
            Track Progress on Dashboard
          </a>

          <p style="margin-top: 24px; font-size: 13px; color: #666;">
            <strong>Tip:</strong> Upload photos of your property's condition from your dashboard. Photos showing deferred maintenance or issues can strengthen your case.
          </p>

          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            Report ID: ${params.reportId}<br>
            Questions? Reply to this email or contact support@resourceful.app
          </p>
        </div>
      `),
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emailLogger.error(`[resend] sendPaymentReceipt error: ${message}`);
    return { data: null, error: `Payment receipt email failed: ${message}` };
  }
}

// ─── Abandoned Cart Recovery ─────────────────────────────────────────────────

export interface AbandonedCartRecoveryParams {
  to: string;
  clientName: string | null;
  reportId: string;
  propertyAddress: string;
  serviceType: string;
}

/**
 * Send a gentle recovery email to users who started checkout but never
 * completed payment. Non-pushy — emphasizes the work already done on
 * their property and a direct link to resume.
 */
export async function sendAbandonedCartRecovery(
  params: AbandonedCartRecoveryParams
): Promise<ServiceResult<EmailResult>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';
  const greeting = params.clientName ? `Hi ${escapeHtml(params.clientName)}` : 'Hi there';

  const serviceCopy: Record<string, string> = {
    tax_appeal: 'property tax appeal analysis',
    pre_purchase: 'pre-purchase property analysis',
    pre_listing: 'pre-listing property analysis',
  };
  const serviceDesc = serviceCopy[params.serviceType] ?? 'property analysis';

  try {
    const result = await sendWithRetry({
      from: FROM_ADDRESS_LAZY(),
      to: params.to,
      subject: `Your ${escapeHtml(params.propertyAddress)} report is waiting`,
      html: wrapHtml(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; font-size: 24px;">Your Report is Ready to Go</h1>
          <p>${greeting},</p>
          <p>We noticed you started a ${escapeHtml(serviceDesc)} for
            <strong>${escapeHtml(params.propertyAddress)}</strong> but didn't finish
            checking out.</p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; color: #444;">
              Your property details are saved. You can pick up right where you left off — no need to re-enter anything.
            </p>
          </div>

          <a href="${appUrl}/start/payment?resume=${params.reportId}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Complete Your Order
          </a>

          <p style="margin-top: 24px; font-size: 13px; color: #666;">
            If you had any trouble during checkout, or have questions about the report, just reply to this email. We're happy to help.
          </p>

          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            You received this email because you started an analysis at resourceful.app.
            If you've changed your mind, no further action is needed — we won't email you again about this.
          </p>
        </div>
      `),
    });

    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emailLogger.error(`[resend] sendAbandonedCartRecovery error: ${message}`);
    return { data: null, error: `Cart recovery email failed: ${message}` };
  }
}
