import { describe, expect, it } from 'vitest';

import {
  buildOutcomeFollowupEmailContent,
  buildReportReadyEmailContent,
  type OutcomeFollowupParams,
  type ReportReadyNotificationParams,
} from './customer-notification-email';

const APP_URL = 'https://resourceful.example';

function reportParams(
  overrides: Partial<ReportReadyNotificationParams> = {}
): ReportReadyNotificationParams {
  return {
    to: 'customer@example.com',
    reportId: 'report/123',
    serviceType: 'tax_appeal',
    propertyAddress: '123 Main & First <Unit 2>',
    concludedMarketValue: 1_000_000,
    currentAssessedValue: 300_000,
    indicatedAssessedValue: 250_000,
    assessmentGap: 50_000,
    countyName: 'Cook',
    ...overrides,
  };
}

function outcomeParams(
  overrides: Partial<OutcomeFollowupParams> = {}
): OutcomeFollowupParams {
  return {
    to: 'customer@example.com',
    clientName: 'Alex <Owner>',
    reportId: 'report/123',
    propertyAddress: '123 Main & First',
    assessmentGap: 50_000,
    outcomeToken: 'token +/=',
    ...overrides,
  };
}

describe('buildReportReadyEmailContent', () => {
  it('uses assessment-gap language without making a tax-dollar savings claim', () => {
    const content = buildReportReadyEmailContent(reportParams(), APP_URL);

    expect(content.subject).toBe('Your Property Assessment Report Is Ready');
    expect(content.subject).not.toContain('save');
    expect(content.html).toContain('Indicated Assessed Value');
    expect(content.html).toContain('Estimated Assessment Gap');
    expect(content.html).toContain('$50,000');
    expect(content.html).toContain('not an estimate or guarantee of tax savings');
    expect(content.html).not.toContain('You could save');
    expect(content.html).not.toContain('Potential Savings');
    expect(content.html).toContain('123 Main &amp; First &lt;Unit 2&gt;');
    expect(content.html).toContain('/report/report%2F123');
  });

  it('uses the correct product language for non-appeal assignments', () => {
    const content = buildReportReadyEmailContent(
      reportParams({
        serviceType: 'pre_purchase',
        currentAssessedValue: null,
        indicatedAssessedValue: null,
        assessmentGap: null,
        countyName: null,
      }),
      APP_URL
    );

    expect(content.subject).toBe('Your Pre-Purchase Property Review Is Ready');
    expect(content.html).toContain('pre-purchase property review');
    expect(content.html).toContain('buyer next-step guidance');
    expect(content.html).not.toContain('Current Assessed Value');
    expect(content.html).not.toContain('filing requirements and deadlines');
  });
});

describe('buildOutcomeFollowupEmailContent', () => {
  it('reuses assessment-gap language and supports every lifecycle outcome', () => {
    const content = buildOutcomeFollowupEmailContent(outcomeParams(), APP_URL);

    expect(content.subject).toBe('How Did Your Property Tax Appeal Go?');
    expect(content.html).toContain('estimated assessment gap');
    expect(content.html).toContain('did not file');
    expect(content.html).toContain('partially granted');
    expect(content.html).toContain('Alex &lt;Owner&gt;');
    expect(content.html).toContain('token=token%20%2B%2F%3D');
    expect(content.html).not.toContain('potential over-assessment');
  });
});
