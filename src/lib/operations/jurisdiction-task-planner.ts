import {
  MAX_JURISDICTION_RULE_AGE_DAYS,
  evaluateTaxAppealJurisdiction,
} from '@/lib/services/jurisdiction-eligibility';
import type { CountyRule } from '@/types/database';
import type { OperationsTaskInsert, OperationsTaskPriority } from './types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_WARNING_DAYS = 30;
const IMMINENT_DEADLINE_DAYS = 21;

export const JURISDICTION_OPERATIONS_SOURCE = 'jurisdiction_reconciliation';

export type JurisdictionTaskType =
  | 'jurisdiction_verification_missing'
  | 'jurisdiction_verification_invalid'
  | 'jurisdiction_verification_stale'
  | 'jurisdiction_verification_due'
  | 'jurisdiction_authority_missing'
  | 'jurisdiction_deadline_missing'
  | 'jurisdiction_filing_channel_missing'
  | 'jurisdiction_evidence_requirements_missing'
  | 'jurisdiction_verifier_missing'
  | 'jurisdiction_source_missing'
  | 'jurisdiction_deadline_expired'
  | 'jurisdiction_deadline_imminent';

export type PlannedJurisdictionTask = Required<
  Pick<
    OperationsTaskInsert,
    | 'idempotency_key'
    | 'source'
    | 'category'
    | 'task_type'
    | 'subject_type'
    | 'subject_key'
    | 'county_fips'
    | 'report_id'
    | 'title'
    | 'description'
    | 'priority'
    | 'due_at'
    | 'metadata'
  >
>;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function parseUtcDate(value: string | null | undefined, endOfDay = false): Date | null {
  if (!hasText(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const parsed = new Date(`${value.trim()}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / ONE_DAY_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function activePriority(
  isActive: boolean,
  active: OperationsTaskPriority,
  inactive: OperationsTaskPriority
): OperationsTaskPriority {
  return isActive ? active : inactive;
}

function commonMetadata(rule: CountyRule, now: Date): Record<string, unknown> {
  const eligibility = evaluateTaxAppealJurisdiction({
    countyFips: rule.county_fips,
    state: rule.state_abbreviation,
    rule,
    now,
  });

  return {
    county_name: rule.county_name,
    state_abbreviation: rule.state_abbreviation,
    is_active: rule.is_active,
    release_blocker: rule.is_active && !eligibility.allowed,
    eligibility_code: eligibility.code,
    rule_last_verified_date: rule.last_verified_date,
  };
}

function makeTask(
  rule: CountyRule,
  now: Date,
  taskType: JurisdictionTaskType,
  title: string,
  description: string,
  priority: OperationsTaskPriority,
  dueAt: Date | null,
  metadata: Record<string, unknown> = {}
): PlannedJurisdictionTask {
  return {
    idempotency_key: `${JURISDICTION_OPERATIONS_SOURCE}:${rule.county_fips}:${taskType}`,
    source: JURISDICTION_OPERATIONS_SOURCE,
    category: 'jurisdiction',
    task_type: taskType,
    subject_type: 'county_rule',
    subject_key: rule.county_fips,
    county_fips: rule.county_fips,
    report_id: null,
    title,
    description,
    priority,
    due_at: dueAt?.toISOString() ?? null,
    metadata: {
      ...commonMetadata(rule, now),
      ...metadata,
    },
  };
}

function hasVerifiedFilingChannel(rule: CountyRule): boolean {
  const online = rule.accepts_online_filing && hasText(rule.portal_url);
  const email = rule.accepts_email_filing && hasText(rule.filing_email);
  const mail = rule.requires_mail_filing && hasText(rule.appeal_board_address);
  const publishedForm = hasText(rule.form_download_url);
  const authorityAddress = hasText(rule.appeal_board_address);
  return online || email || mail || publishedForm || authorityAddress;
}

function hasOfficialSource(rule: CountyRule): boolean {
  return [
    rule.portal_url,
    rule.form_download_url,
    rule.state_appeal_board_url,
    rule.assessor_api_documentation_url,
  ].some(hasText);
}

function hasCurrentDeadline(rule: CountyRule, now: Date): boolean {
  const explicit = parseUtcDate(rule.next_appeal_deadline, true);
  if (explicit && explicit.getTime() >= now.getTime()) return true;
  return hasText(rule.appeal_deadline_rule);
}

/**
 * Converts one jurisdiction rule into deterministic, idempotent operations
 * work. The blocking checks intentionally mirror evaluateTaxAppealJurisdiction.
 */
export function planJurisdictionTasks(
  rule: CountyRule,
  now: Date = new Date()
): PlannedJurisdictionTask[] {
  const tasks: PlannedJurisdictionTask[] = [];
  const countyLabel = `${rule.county_name} County, ${rule.state_abbreviation}`;
  const immediateDue = now;
  const blockingPriority = activePriority(rule.is_active, 'critical', 'medium');
  const maintenancePriority = activePriority(rule.is_active, 'high', 'low');

  const verifiedAt = parseUtcDate(rule.last_verified_date);
  if (!hasText(rule.last_verified_date)) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_verification_missing',
        `Verify ${countyLabel} filing rules`,
        'No rule verification date is recorded. Confirm every release-gate field against current official sources before this jurisdiction is sold.',
        blockingPriority,
        immediateDue
      )
    );
  } else if (!verifiedAt || verifiedAt.getTime() > now.getTime() + ONE_DAY_MS) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_verification_invalid',
        `Correct ${countyLabel} verification record`,
        'The rule verification date is invalid or in the future. Replace it with the date the current official rules were actually verified.',
        blockingPriority,
        immediateDue,
        { recorded_value: rule.last_verified_date }
      )
    );
  } else {
    const ageDays = daysBetween(now, verifiedAt);
    const expiryAt = addDays(verifiedAt, MAX_JURISDICTION_RULE_AGE_DAYS);

    if (ageDays > MAX_JURISDICTION_RULE_AGE_DAYS) {
      tasks.push(
        makeTask(
          rule,
          now,
          'jurisdiction_verification_stale',
          `Reverify ${countyLabel} filing rules`,
          `The jurisdiction record is ${ageDays} days old and exceeds the ${MAX_JURISDICTION_RULE_AGE_DAYS}-day release limit. Recheck official sources and record the new verification date and reviewer.`,
          blockingPriority,
          immediateDue,
          { age_days: ageDays, expires_at: expiryAt.toISOString() }
        )
      );
    } else if (ageDays >= MAX_JURISDICTION_RULE_AGE_DAYS - VERIFICATION_WARNING_DAYS) {
      tasks.push(
        makeTask(
          rule,
          now,
          'jurisdiction_verification_due',
          `Reverify ${countyLabel} before release expiry`,
          `The jurisdiction record will exceed the ${MAX_JURISDICTION_RULE_AGE_DAYS}-day release limit soon. Recheck official sources before the current verification expires.`,
          maintenancePriority,
          expiryAt,
          { age_days: ageDays, expires_at: expiryAt.toISOString() }
        )
      );
    }
  }

  if (!hasText(rule.appeal_board_name)) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_authority_missing',
        `Add the filing authority for ${countyLabel}`,
        'The release gate requires the current appeal board or filing authority. Record the official authority name and corroborating source.',
        blockingPriority,
        immediateDue
      )
    );
  }

  if (!hasCurrentDeadline(rule, now)) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_deadline_missing',
        `Publish a current filing deadline for ${countyLabel}`,
        'Neither a future explicit deadline nor a current deadline rule is usable. Confirm the active appeal window before accepting payment.',
        blockingPriority,
        immediateDue
      )
    );
  }

  if (!hasVerifiedFilingChannel(rule)) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_filing_channel_missing',
        `Verify a filing channel for ${countyLabel}`,
        'No usable online, email, mail, published-form, or authority-address filing path is recorded. Confirm at least one official submission channel.',
        blockingPriority,
        immediateDue
      )
    );
  }

  if (!hasItems(rule.required_documents) && !hasItems(rule.evidence_requirements)) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_evidence_requirements_missing',
        `Define evidence requirements for ${countyLabel}`,
        'The jurisdiction has no required-document or evidence-requirement record. Confirm the official filing packet and minimum substantiation.',
        blockingPriority,
        immediateDue
      )
    );
  }

  if (!hasText(rule.verified_by)) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_verifier_missing',
        `Record the verifier for ${countyLabel}`,
        'The rule record does not identify who performed the latest legal-rules verification. Add a reviewer name or controlled automation identity.',
        maintenancePriority,
        addDays(now, 7)
      )
    );
  }

  if (!hasOfficialSource(rule)) {
    tasks.push(
      makeTask(
        rule,
        now,
        'jurisdiction_source_missing',
        `Attach an official source for ${countyLabel}`,
        'The rule record lacks an official portal, form, state board, or assessor documentation URL. Add at least one authoritative source to support reproducible verification.',
        maintenancePriority,
        addDays(now, 7)
      )
    );
  }

  const explicitDeadline = parseUtcDate(rule.next_appeal_deadline, true);
  if (explicitDeadline) {
    const daysUntilDeadline = Math.ceil(
      (explicitDeadline.getTime() - now.getTime()) / ONE_DAY_MS
    );

    if (daysUntilDeadline < 0 && hasText(rule.appeal_deadline_rule)) {
      tasks.push(
        makeTask(
          rule,
          now,
          'jurisdiction_deadline_expired',
          `Refresh the expired ${countyLabel} deadline`,
          'The explicit next appeal deadline has passed. The general deadline rule keeps the release gate usable, but the dated operational record must be refreshed.',
          maintenancePriority,
          immediateDue,
          { expired_deadline: rule.next_appeal_deadline }
        )
      );
    } else if (daysUntilDeadline >= 0 && daysUntilDeadline <= IMMINENT_DEADLINE_DAYS) {
      tasks.push(
        makeTask(
          rule,
          now,
          'jurisdiction_deadline_imminent',
          `${countyLabel} filing deadline is approaching`,
          `The recorded filing deadline is ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} away. Confirm intake capacity, filing guidance, and current portal availability.`,
          daysUntilDeadline <= 7 ? 'critical' : 'high',
          explicitDeadline,
          {
            deadline: rule.next_appeal_deadline,
            days_until_deadline: daysUntilDeadline,
          }
        )
      );
    }
  }

  return tasks;
}
