import { Resend } from 'resend';

import type { ServiceType } from '@/types/database';
import { emailLogger } from '@/lib/logger';
import { getAppUrl } from '@/lib/utils/app-url';
import { isRetryableError, withRetry } from '@/lib/utils/retry';

export interface ReportReadyNotificationParams {
  to: string;
  reportId: string;
  serviceType: ServiceType;
  propertyAddress: string;
  concludedMarketValue: number | null;
  currentAssessedValue: number | null;
  indicatedAssessedValue: number | null;
  assessmentGap: number | null;
  countyName?: string | null;
}

export interface OutcomeFollowupParams {
  to: string;
  clientName: string | null;
  reportId: string;
  propertyAddress: string;
  assessmentGap: number | null;
  outcomeToken: string;
}

export interface EmailResult {
  data: { id: string } | null;
  error: string | null;
}

export interface CustomerEmailContent {
  subject: string;
  html: string;
}

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_ADDRESS?.trim() || 'reports@resourceful.app';
}

async function sendWithRetry(
  params: Parameters<Resend['emails']['send']>[0],
  idempotencyKey: string
) {
  return withRetry(
    async () => {
      const result = await getResend().emails.send(params, { idempotencyKey });
      if (result.error) throw new Error(result.error.message);
      return result;
    },
    { maxAttempts: 3, baseDelayMs: 1000, retryOn: isRetryableError }
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:16px;background:#ffffff;">${body}</body></html>`;
}

function formatDollarValue(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function assignmentCopy(serviceType: ServiceType): {
  subject: string;
  noun: string;
  contents: string;
} {
  switch (serviceType) {
    case 'pre_purchase':
      return {
        subject: 'Your Pre-Purchase Property Review Is Ready',
        noun: 'pre-purchase property review',
        contents: 'property analysis, comparable-sales support, valuation findings, and buyer next-step guidance',
      };
    case 'pre_listing':
      return {
        subject: 'Your Pre-Listing Property Review Is Ready',
        noun: 'pre-listing property review',
        contents: 'property analysis, comparable-sales support, valuation findings, and pricing next-step guidance',
      };
    case 'tax_appeal':
    default:
      return {
        subject: 'Your Property Assessment Report Is Ready',
        noun: 'property assessment report',
        contents: 'comparable-sales analysis, adjustment support, valuation findings, and verified filing instructions',
      };
  }
}

function valueRow(label: string, value: number | null, emphasis = false): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '';
  const color = emphasis ? '#1a7f37' : '#1a1a1a';
  return `<tr>
    <td style="padding:8px 0;color:${emphasis ? '#1a7f37' : '#666'};font-weight:${emphasis ? '600' : '400'};">${escapeHtml(label)}</td>
    <td style="padding:8px 0;text-align:right;color:${color};font-weight:600;">${escapeHtml(formatDollarValue(value))}</td>
  </tr>`;
}

export function buildReportReadyEmailContent(
  params: ReportReadyNotificationParams,
  appUrl = getAppUrl()
): CustomerEmailContent {
  const reportUrl = `${appUrl}/report/${encodeURIComponent(params.reportId)}`;
  const downloadUrl = `${appUrl}/api/reports/${encodeURIComponent(params.reportId)}/download`;
  const copy = assignmentCopy(params.serviceType);
  const isTaxAppeal = params.serviceType === 'tax_appeal';
  const assessmentRows = isTaxAppeal
    ? [
        valueRow('Current Assessed Value', params.currentAssessedValue),
        valueRow('Indicated Assessed Value', params.indicatedAssessedValue),
        valueRow('Estimated Assessment Gap', params.assessmentGap, true),
      ].join('')
    : '';

  return {
    subject: copy.subject,
    html: wrapHtml(`
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#1a1a1a;font-size:24px;">Your Report Is Ready</h1>
        <p>Your ${escapeHtml(copy.noun)} for <strong>${escapeHtml(params.propertyAddress)}</strong> has completed review and is available in your Resourceful dashboard.</p>

        <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:24px 0;">
          <table style="width:100%;border-collapse:collapse;">
            ${valueRow('Concluded Market Value', params.concludedMarketValue)}
            ${assessmentRows}
          </table>
        </div>

        ${isTaxAppeal && params.assessmentGap != null && params.assessmentGap > 0 ? `
          <p style="font-size:13px;color:#555;">
            The assessment gap compares the current assessed value with the report's indicated assessed value. It is not an estimate or guarantee of tax savings. Actual taxes depend on the taxing jurisdiction, equalization, exemptions, tax rates, and the final decision.
          </p>
        ` : ''}

        <p>Your report includes ${escapeHtml(copy.contents)}.</p>

        <a href="${reportUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">
          View Your Report
        </a>

        <p style="margin-top:16px;">
          <a href="${downloadUrl}" style="color:#2563eb;text-decoration:underline;font-size:13px;">Download PDF</a>
        </p>

        <p style="margin-top:24px;font-size:13px;color:#666;">
          Your report remains available in your dashboard.${isTaxAppeal && params.countyName ? ` Review the report page for ${escapeHtml(params.countyName)} filing requirements and deadlines.` : ''}
        </p>

        <p style="margin-top:32px;font-size:12px;color:#999;">
          This market value analysis is not a certified appraisal or legal advice.
        </p>
      </div>
    `),
  };
}

export function buildOutcomeFollowupEmailContent(
  params: OutcomeFollowupParams,
  appUrl = getAppUrl()
): CustomerEmailContent {
  const greeting = params.clientName ? `Hi ${escapeHtml(params.clientName)}` : 'Hi there';
  const outcomeUrl = `${appUrl}/report/${encodeURIComponent(params.reportId)}?token=${encodeURIComponent(params.outcomeToken)}`;
  const reportUrl = `${appUrl}/report/${encodeURIComponent(params.reportId)}`;

  return {
    subject: 'How Did Your Property Tax Appeal Go?',
    html: wrapHtml(`
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#1a1a1a;font-size:24px;">How Did Your Appeal Go?</h1>
        <p>${greeting},</p>
        <p>A couple of months ago, Resourceful prepared your property assessment report for <strong>${escapeHtml(params.propertyAddress)}</strong>${params.assessmentGap != null && params.assessmentGap > 0 ? ` with an estimated assessment gap of <strong>${escapeHtml(formatDollarValue(params.assessmentGap))}</strong>` : ''}.</p>

        <p>Share the current status of your appeal. Outcome data helps Resourceful measure report performance and improve future county-specific analysis.</p>

        <a href="${outcomeUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;margin:16px 0;">
          Share Your Result
        </a>

        <p style="font-size:13px;color:#666;">It takes less than 30 seconds. Tell us whether you did not file, the appeal is pending, or the decision was granted, partially granted, denied, or withdrawn—and provide the final assessed value when available.</p>

        <p style="margin-top:32px;font-size:12px;color:#999;">
          You received this email because you purchased a Resourceful property tax assessment report.<br>
          Your report remains available at <a href="${reportUrl}" style="color:#2563eb;">${reportUrl}</a>.
        </p>
      </div>
    `),
  };
}

export async function sendVerifiedReportReadyNotification(
  params: ReportReadyNotificationParams
): Promise<EmailResult> {
  const content = buildReportReadyEmailContent(params);

  try {
    const result = await sendWithRetry(
      {
        from: getFromAddress(),
        to: params.to,
        subject: content.subject,
        html: content.html,
      },
      `report-ready/${params.reportId}`
    );
    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emailLogger.error({ message }, '[customer-email] report-ready notification failed');
    return { data: null, error: `Notification email failed: ${message}` };
  }
}

export async function sendVerifiedOutcomeFollowupEmail(
  params: OutcomeFollowupParams
): Promise<EmailResult> {
  const content = buildOutcomeFollowupEmailContent(params);

  try {
    const result = await sendWithRetry(
      {
        from: getFromAddress(),
        to: params.to,
        subject: content.subject,
        html: content.html,
      },
      `outcome-followup/${params.reportId}/${params.outcomeToken}`
    );
    return { data: { id: result.data?.id ?? '' }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emailLogger.error({ message }, '[customer-email] outcome follow-up failed');
    return { data: null, error: `Outcome follow-up email failed: ${message}` };
  }
}
