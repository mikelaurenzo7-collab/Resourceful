import { describe, expect, it } from 'vitest';
import type { CountyRule } from '@/types/database';
import { planJurisdictionTasks } from './jurisdiction-task-planner';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function healthyRule(overrides: Partial<CountyRule> = {}): CountyRule {
  return {
    county_fips: '17031',
    county_name: 'Cook',
    state_name: 'Illinois',
    state_abbreviation: 'IL',
    is_active: true,
    last_verified_date: '2026-07-01',
    verified_by: 'operations@resourceful.test',
    appeal_board_name: 'Cook County Board of Review',
    appeal_deadline_rule: 'File during the published township window.',
    next_appeal_deadline: '2026-11-15',
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    portal_url: 'https://appeals.example.gov',
    filing_email: null,
    appeal_board_address: null,
    form_download_url: null,
    state_appeal_board_url: null,
    assessor_api_documentation_url: null,
    required_documents: ['Complaint form', 'Comparable evidence'],
    evidence_requirements: ['Comparable sales'],
    ...overrides,
  } as CountyRule;
}

function taskTypes(rule: CountyRule): string[] {
  return planJurisdictionTasks(rule, NOW).map((task) => task.task_type);
}

describe('planJurisdictionTasks', () => {
  it('returns no work for a current, complete, sourced jurisdiction', () => {
    expect(planJurisdictionTasks(healthyRule(), NOW)).toEqual([]);
  });

  it('creates precise release-blocker tasks for an incomplete active rule', () => {
    const tasks = planJurisdictionTasks(
      healthyRule({
        last_verified_date: null,
        verified_by: null,
        appeal_board_name: '',
        appeal_deadline_rule: '',
        next_appeal_deadline: null,
        accepts_online_filing: false,
        portal_url: null,
        form_download_url: null,
        appeal_board_address: null,
        required_documents: [],
        evidence_requirements: [],
      }),
      NOW
    );

    expect(tasks.map((task) => task.task_type)).toEqual(
      expect.arrayContaining([
        'jurisdiction_verification_missing',
        'jurisdiction_authority_missing',
        'jurisdiction_deadline_missing',
        'jurisdiction_filing_channel_missing',
        'jurisdiction_evidence_requirements_missing',
        'jurisdiction_verifier_missing',
        'jurisdiction_source_missing',
      ])
    );
    expect(tasks.filter((task) => task.metadata.release_blocker).length).toBeGreaterThan(0);
    expect(
      tasks
        .filter((task) => task.task_type.endsWith('_missing'))
        .some((task) => task.priority === 'critical')
    ).toBe(true);
  });

  it('separates stale verification from the 30-day warning window', () => {
    expect(taskTypes(healthyRule({ last_verified_date: '2026-02-01' }))).toContain(
      'jurisdiction_verification_stale'
    );
    expect(taskTypes(healthyRule({ last_verified_date: '2026-03-10' }))).toContain(
      'jurisdiction_verification_due'
    );
  });

  it('flags invalid future verification dates', () => {
    expect(taskTypes(healthyRule({ last_verified_date: '2026-09-01' }))).toContain(
      'jurisdiction_verification_invalid'
    );
  });

  it('turns dated appeal windows into deadline operations work', () => {
    const imminent = planJurisdictionTasks(
      healthyRule({ next_appeal_deadline: '2026-08-20' }),
      NOW
    ).find((task) => task.task_type === 'jurisdiction_deadline_imminent');

    expect(imminent).toMatchObject({
      priority: 'critical',
      due_at: '2026-08-20T23:59:59.999Z',
    });

    expect(
      taskTypes(
        healthyRule({
          next_appeal_deadline: '2026-08-01',
          appeal_deadline_rule: 'Thirty days after publication.',
        })
      )
    ).toContain('jurisdiction_deadline_expired');
  });

  it('uses stable idempotency keys across repeated scans', () => {
    const rule = healthyRule({ last_verified_date: null });
    const first = planJurisdictionTasks(rule, NOW).map((task) => task.idempotency_key);
    const second = planJurisdictionTasks(rule, new Date('2026-08-16T18:00:00.000Z')).map(
      (task) => task.idempotency_key
    );

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it('reduces severity for inactive jurisdictions without losing maintenance work', () => {
    const task = planJurisdictionTasks(
      healthyRule({ is_active: false, last_verified_date: null }),
      NOW
    ).find((candidate) => candidate.task_type === 'jurisdiction_verification_missing');

    expect(task?.priority).toBe('medium');
    expect(task?.metadata.release_blocker).toBe(false);
  });
});
