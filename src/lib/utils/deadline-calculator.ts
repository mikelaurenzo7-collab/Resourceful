// ─── Appeal Deadline Calculator ──────────────────────────────────────────────
// Computes the next appeal deadline from county_rules data.
// Priority: next_appeal_deadline (exact date) > calculated from rules > null.
//
// Used by the filing guide to generate urgency messaging and countdowns.

import type { CountyRule } from '@/types/database';

export interface DeadlineInfo {
  deadline: string | null;       // ISO date string (YYYY-MM-DD)
  daysRemaining: number | null;  // null if no deadline known
  source: 'exact' | 'calculated' | 'rule_text' | 'unknown';
  urgencyLevel: 'expired' | 'critical' | 'urgent' | 'normal' | 'plenty' | 'unknown';
  displayText: string;           // Human-readable: "March 31, 2027 (45 days remaining)"
}

/**
 * Calculate the next appeal deadline for a county.
 * Uses multiple strategies:
 * 1. If next_appeal_deadline is set (exact date), use it directly
 * 2. If appeal_window rules exist, calculate from current date
 * 3. Fall back to appeal_deadline_rule text
 */
export function calculateDeadline(countyRule: CountyRule | null): DeadlineInfo {
  if (!countyRule) {
    return {
      deadline: null,
      daysRemaining: null,
      source: 'unknown',
      urgencyLevel: 'unknown',
      displayText: 'Contact your county assessor for appeal deadline information.',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Strategy 1: Exact deadline date
  if (countyRule.next_appeal_deadline) {
    const deadline = new Date(countyRule.next_appeal_deadline);
    deadline.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      deadline: countyRule.next_appeal_deadline,
      daysRemaining,
      source: 'exact',
      urgencyLevel: getUrgencyLevel(daysRemaining),
      displayText: formatDeadlineText(deadline, daysRemaining),
    };
  }

  // Strategy 2: Calculate from appeal window end month/day + current tax year
  if (countyRule.appeal_window_end_month && countyRule.appeal_window_end_day) {
    const taxYear = countyRule.current_tax_year ?? today.getFullYear();
    // Try current year first, then next year
    let deadline = new Date(taxYear, countyRule.appeal_window_end_month - 1, countyRule.appeal_window_end_day);
    if (deadline < today) {
      deadline = new Date(taxYear + 1, countyRule.appeal_window_end_month - 1, countyRule.appeal_window_end_day);
    }
    const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      deadline: deadline.toISOString().split('T')[0],
      daysRemaining,
      source: 'calculated',
      urgencyLevel: getUrgencyLevel(daysRemaining),
      displayText: formatDeadlineText(deadline, daysRemaining),
    };
  }

  // Strategy 3: Fall back to rule text
  if (countyRule.appeal_deadline_rule) {
    // Try to extract a date from the rule text (e.g., "May 15" or "March 31")
    const extracted = extractDateFromRuleText(countyRule.appeal_deadline_rule, today);
    if (extracted) {
      const daysRemaining = Math.ceil((extracted.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        deadline: extracted.toISOString().split('T')[0],
        daysRemaining,
        source: 'calculated',
        urgencyLevel: getUrgencyLevel(daysRemaining),
        displayText: formatDeadlineText(extracted, daysRemaining),
      };
    }

    return {
      deadline: null,
      daysRemaining: null,
      source: 'rule_text',
      urgencyLevel: 'unknown',
      displayText: countyRule.appeal_deadline_rule,
    };
  }

  return {
    deadline: null,
    daysRemaining: null,
    source: 'unknown',
    urgencyLevel: 'unknown',
    displayText: 'Contact your county assessor for appeal deadline information.',
  };
}

function getUrgencyLevel(daysRemaining: number): DeadlineInfo['urgencyLevel'] {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 7) return 'critical';
  if (daysRemaining <= 30) return 'urgent';
  if (daysRemaining <= 60) return 'normal';
  return 'plenty';
}

function formatDeadlineText(deadline: Date, daysRemaining: number): string {
  const formatted = deadline.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (daysRemaining < 0) {
    return `${formatted} (EXPIRED ${Math.abs(daysRemaining)} days ago)`;
  }
  if (daysRemaining === 0) {
    return `${formatted} (TODAY — file immediately!)`;
  }
  if (daysRemaining === 1) {
    return `${formatted} (TOMORROW — file today!)`;
  }
  if (daysRemaining <= 7) {
    return `${formatted} (${daysRemaining} days remaining — file NOW)`;
  }
  if (daysRemaining <= 30) {
    return `${formatted} (${daysRemaining} days remaining)`;
  }
  return `${formatted} (${daysRemaining} days remaining)`;
}

/**
 * Try to extract a date from appeal_deadline_rule text.
 * Handles patterns like "May 15", "March 31", "January 15 annually", etc.
 */
function extractDateFromRuleText(rule: string, today: Date): Date | null {
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  // Match "Month Day" pattern (e.g., "May 15", "March 31")
  const match = rule.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i);
  if (!match) return null;

  const month = months[match[1].toLowerCase()];
  const day = parseInt(match[2], 10);
  if (month === undefined || isNaN(day)) return null;

  // Try current year, then next year
  let result = new Date(today.getFullYear(), month, day);
  if (result < today) {
    result = new Date(today.getFullYear() + 1, month, day);
  }
  return result;
}

/**
 * Calculate estimated annual savings from a successful appeal.
 * Used in filing guide urgency messaging.
 */
export function calculateAnnualSavings(
  assessedValue: number,
  concludedValue: number,
  assessmentRatio: number,
  taxRate: number = 0.02 // Default 2% effective tax rate as fallback
): { savingsPerYear: number; savingsOverCycle: number; cycleLengthYears: number } {
  const overassessment = Math.max(0, assessedValue - concludedValue);
  const taxableOverassessment = overassessment * assessmentRatio;
  const savingsPerYear = Math.round(taxableOverassessment * taxRate);

  return {
    savingsPerYear,
    savingsOverCycle: savingsPerYear, // Simplified — one year at a time
    cycleLengthYears: 1,
  };
}
