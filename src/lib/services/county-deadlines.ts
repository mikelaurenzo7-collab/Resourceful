// ─── County Deadline Computation ────────────────────────────────────────────
// Computes appeal deadlines and filing windows from county_rules fields.
// Handles the three main patterns:
//   1. Fixed date (e.g., "May 15" — Texas)
//   2. Days after notice (e.g., "30 days after notice" — Illinois)
//   3. Window-based (e.g., "January 1 to April 1" — many states)

import type { CountyRule } from '@/types/database';

export interface DeadlineInfo {
  /** The computed or stored next appeal deadline */
  nextDeadline: string | null;
  /** Human-readable deadline description */
  deadlineDescription: string;
  /** Days remaining until deadline (null if unknown) */
  daysRemaining: number | null;
  /** Whether the filing window is currently open */
  windowOpen: boolean;
  /** Assessment cycle (annual, biennial, triennial) */
  assessmentCycle: string | null;
  /** Urgency level for UI display */
  urgency: 'expired' | 'urgent' | 'approaching' | 'open' | 'unknown';
}

export function computeDeadlineInfo(countyRule: CountyRule): DeadlineInfo {
  const now = new Date();
  const currentYear = now.getFullYear();

  // If we have a stored next_appeal_deadline, use it
  if (countyRule.next_appeal_deadline) {
    const deadline = new Date(countyRule.next_appeal_deadline);
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let urgency: DeadlineInfo['urgency'] = 'open';
    if (daysRemaining < 0) urgency = 'expired';
    else if (daysRemaining <= 7) urgency = 'urgent';
    else if (daysRemaining <= 30) urgency = 'approaching';

    return {
      nextDeadline: countyRule.next_appeal_deadline,
      deadlineDescription: countyRule.appeal_deadline_rule ?? `Deadline: ${deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      daysRemaining,
      windowOpen: daysRemaining >= 0,
      assessmentCycle: countyRule.assessment_cycle ?? null,
      urgency,
    };
  }

  // Try to compute from window fields
  if (countyRule.appeal_window_end_month && countyRule.appeal_window_end_day) {
    const endMonth = countyRule.appeal_window_end_month - 1; // 0-indexed
    const endDay = countyRule.appeal_window_end_day;
    let deadline = new Date(currentYear, endMonth, endDay);

    // If the deadline has passed this year, look at next year
    if (deadline < now) {
      deadline = new Date(currentYear + 1, endMonth, endDay);
    }

    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check if window is currently open
    let windowOpen = true;
    if (countyRule.appeal_window_start_month) {
      const startMonth = countyRule.appeal_window_start_month - 1;
      const windowStart = new Date(currentYear, startMonth, 1);
      windowOpen = now >= windowStart && daysRemaining >= 0;
    }

    let urgency: DeadlineInfo['urgency'] = windowOpen ? 'open' : 'unknown';
    if (daysRemaining < 0) urgency = 'expired';
    else if (daysRemaining <= 7) urgency = 'urgent';
    else if (daysRemaining <= 30) urgency = 'approaching';

    return {
      nextDeadline: deadline.toISOString().split('T')[0],
      deadlineDescription: countyRule.appeal_deadline_rule ?? `Appeal window closes ${deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      daysRemaining,
      windowOpen,
      assessmentCycle: countyRule.assessment_cycle ?? null,
      urgency,
    };
  }

  // Fall back to appeal_deadline_rule text description
  return {
    nextDeadline: null,
    deadlineDescription: countyRule.appeal_deadline_rule ?? 'Contact your county assessor for deadline information',
    daysRemaining: null,
    windowOpen: true, // Assume open if we can't determine
    assessmentCycle: countyRule.assessment_cycle ?? null,
    urgency: 'unknown',
  };
}

/**
 * Format a DeadlineInfo for display in reports and emails.
 */
export function formatDeadlineForReport(info: DeadlineInfo): string {
  if (info.urgency === 'expired') {
    return `DEADLINE PASSED — ${info.deadlineDescription}. Contact your county assessor about late filing options.`;
  }
  if (info.urgency === 'urgent' && info.daysRemaining !== null) {
    return `URGENT — Only ${info.daysRemaining} days remaining. ${info.deadlineDescription}`;
  }
  if (info.urgency === 'approaching' && info.daysRemaining !== null) {
    return `${info.daysRemaining} days remaining. ${info.deadlineDescription}`;
  }
  return info.deadlineDescription;
}
