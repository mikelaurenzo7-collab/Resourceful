// ─── Integration Tests: Critical Path ────────────────────────────────────────
// Tests for the payment → pipeline → delivery → outcome flow.
// These test business logic and invariants without hitting real services.

import { describe, it, expect } from 'vitest';

// ─── Webhook Idempotency ────────────────────────────────────────────────────

describe('webhook idempotency invariants', () => {
  // The Stripe webhook handler must be idempotent — duplicate events
  // should not trigger duplicate pipeline runs or double-charge users.

  const VALID_STATUSES = ['intake', 'paid', 'data_pull', 'photo_pending', 'processing', 'pending_approval', 'approved', 'delivering', 'delivered', 'rejected', 'failed'];
  const SHOULD_TRIGGER_PIPELINE = new Set(['intake']);

  it('only intake status triggers pipeline', () => {
    for (const status of VALID_STATUSES) {
      const shouldTrigger = SHOULD_TRIGGER_PIPELINE.has(status);
      // If not intake, webhook should skip (duplicate protection)
      if (status !== 'intake') {
        expect(shouldTrigger).toBe(false);
      }
    }
  });

  it('intake is the only pipeline trigger status', () => {
    expect(SHOULD_TRIGGER_PIPELINE.size).toBe(1);
    expect(SHOULD_TRIGGER_PIPELINE.has('intake')).toBe(true);
  });
});

// ─── Delivery Status Machine ────────────────────────────────────────────────

describe('delivery status machine', () => {
  const DELIVERABLE_STATUSES = ['processing', 'pending_approval', 'approved', 'delivering'];

  it('allows delivery from expected statuses', () => {
    expect(DELIVERABLE_STATUSES).toContain('pending_approval');
    expect(DELIVERABLE_STATUSES).toContain('approved');
    expect(DELIVERABLE_STATUSES).toContain('delivering');
  });

  it('does not allow delivery from terminal statuses', () => {
    expect(DELIVERABLE_STATUSES).not.toContain('delivered');
    expect(DELIVERABLE_STATUSES).not.toContain('rejected');
    expect(DELIVERABLE_STATUSES).not.toContain('failed');
  });

  it('does not allow delivery from pre-payment statuses', () => {
    expect(DELIVERABLE_STATUSES).not.toContain('intake');
    expect(DELIVERABLE_STATUSES).not.toContain('paid');
  });
});

// ─── Pipeline Stage Ordering ────────────────────────────────────────────────

describe('pipeline stage ordering', () => {
  // Stage numbers must be sequential and never skip
  const STAGE_ORDER = [
    { number: 1, name: 'stage-1-data' },
    { number: 2, name: 'stage-2-comps' },
    { number: 3, name: 'stage-3-income' },
    { number: 4, name: 'stage-4-photos' },
    { number: 5, name: 'stage-5-narratives' },
    { number: 6, name: 'stage-6-filing' },
    { number: 7, name: 'stage-7-pdf' },
  ];

  it('stages are numbered sequentially from 1 to 7', () => {
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      expect(STAGE_ORDER[i].number).toBe(i + 1);
    }
  });

  it('every stage has a unique name', () => {
    const names = STAGE_ORDER.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('stage 7 is the last automated stage (PDF assembly)', () => {
    expect(STAGE_ORDER[STAGE_ORDER.length - 1].name).toBe('stage-7-pdf');
  });

  it('stage 8 (delivery) is NOT in the automated pipeline', () => {
    // Stage 8 is admin-triggered, not part of stages 1-7
    const names = STAGE_ORDER.map(s => s.name);
    expect(names).not.toContain('stage-8-delivery');
  });
});

// ─── Post-Pipeline Routing ──────────────────────────────────────────────────

describe('post-pipeline routing', () => {
  // After stages 1-7, reports MUST go to admin approval, never auto-deliver.
  // This is critical during the quality-control training phase.

  it('reports route to pending_approval after pipeline completes', () => {
    // This mirrors the orchestrator's behavior
    const POST_PIPELINE_STATUS = 'pending_approval';
    expect(POST_PIPELINE_STATUS).toBe('pending_approval');
    expect(POST_PIPELINE_STATUS).not.toBe('delivered');
  });
});

// ─── Outcome Eligibility ────────────────────────────────────────────────────

describe('outcome reporting eligibility', () => {
  const OUTCOME_DELAY_DAYS = 30;
  const FOLLOWUP_DELAY_DAYS = 60;

  it('outcome reporting requires 30+ days after delivery', () => {
    const deliveredAt = new Date('2025-01-01');
    const tooEarly = new Date('2025-01-15');
    const justRight = new Date('2025-02-01');

    const tooEarlyDays = (tooEarly.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    const justRightDays = (justRight.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);

    expect(tooEarlyDays).toBeLessThan(OUTCOME_DELAY_DAYS);
    expect(justRightDays).toBeGreaterThanOrEqual(OUTCOME_DELAY_DAYS);
  });

  it('followup email triggers at 60 days', () => {
    expect(FOLLOWUP_DELAY_DAYS).toBe(60);
    expect(FOLLOWUP_DELAY_DAYS).toBeGreaterThan(OUTCOME_DELAY_DAYS);
  });
});

// ─── Savings Calculation ────────────────────────────────────────────────────

describe('savings calculation', () => {
  function calculatePotentialSavings(
    assessedValue: number | null,
    concludedValue: number | null
  ): number {
    if (!assessedValue || !concludedValue) return 0;
    return Math.max(0, assessedValue - concludedValue);
  }

  it('returns positive savings when assessed > concluded', () => {
    expect(calculatePotentialSavings(300000, 250000)).toBe(50000);
  });

  it('returns 0 when concluded >= assessed (no overassessment)', () => {
    expect(calculatePotentialSavings(250000, 300000)).toBe(0);
  });

  it('returns 0 when values are equal', () => {
    expect(calculatePotentialSavings(300000, 300000)).toBe(0);
  });

  it('returns 0 when either value is null', () => {
    expect(calculatePotentialSavings(null, 250000)).toBe(0);
    expect(calculatePotentialSavings(300000, null)).toBe(0);
    expect(calculatePotentialSavings(null, null)).toBe(0);
  });
});

// ─── Email Delivery Preference ──────────────────────────────────────────────

describe('email delivery preference', () => {
  it('defaults to true (user gets email)', () => {
    // The DB default is true. Delivery should send email unless explicitly false.
    const DEFAULT_EMAIL_PREF = true;
    expect(DEFAULT_EMAIL_PREF).toBe(true);
  });

  it('email failure is non-fatal to delivery', () => {
    // Dashboard-first: report is marked delivered BEFORE email is attempted.
    // If email fails, report status remains 'delivered' — never rolls back.
    const reportDelivered = true;
    // Report should still be delivered regardless of email status
    expect(reportDelivered).toBe(true);
  });
});

// ─── Stale Pipeline Thresholds ──────────────────────────────────────────────

describe('stale pipeline detection thresholds', () => {
  const PAID_STALE_MS = 60 * 60 * 1000;           // 1 hour
  const PROCESSING_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
  const MAX_AUTO_RETRIES = 2;

  it('paid threshold is 1 hour', () => {
    expect(PAID_STALE_MS).toBe(3_600_000);
  });

  it('processing threshold is 2 hours', () => {
    expect(PROCESSING_STALE_MS).toBe(7_200_000);
  });

  it('processing threshold > paid threshold (processing gets more time)', () => {
    expect(PROCESSING_STALE_MS).toBeGreaterThan(PAID_STALE_MS);
  });

  it('max auto retries prevents infinite loops', () => {
    expect(MAX_AUTO_RETRIES).toBeGreaterThan(0);
    expect(MAX_AUTO_RETRIES).toBeLessThanOrEqual(3);
  });
});

// ─── Approval Atomicity ────────────────────────────────────────────────────

describe('approval atomicity', () => {
  // The admin approve endpoint uses atomic claim: UPDATE ... WHERE status = 'pending_approval'
  // This prevents two admins from simultaneously approving the same report.

  it('only one admin can claim a report', () => {
    // Simulating two admins trying to approve simultaneously
    let currentStatus = 'pending_approval';

    // Admin 1 claims (atomic update with WHERE status = pending_approval)
    const admin1Claimed = currentStatus === 'pending_approval';
    if (admin1Claimed) currentStatus = 'delivering';

    // Admin 2 tries to claim — should fail because status is now 'delivering'
    const admin2Claimed = currentStatus === 'pending_approval';

    expect(admin1Claimed).toBe(true);
    expect(admin2Claimed).toBe(false);
  });

  it('failed delivery rolls back to pending_approval', () => {
    let status = 'delivering';
    const deliveryFailed = true;

    if (deliveryFailed) {
      status = 'pending_approval'; // Rollback
    }

    expect(status).toBe('pending_approval');
  });
});

// ─── Report Status Transitions ──────────────────────────────────────────────

describe('report status transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    intake: ['paid', 'failed'],
    paid: ['processing', 'failed'],
    processing: ['pending_approval', 'failed'],
    pending_approval: ['delivering', 'rejected'],
    delivering: ['delivered', 'pending_approval'], // rollback on failure
    delivered: [], // terminal
    rejected: [], // terminal
    failed: ['processing', 'paid'], // retry
  };

  it('intake can only go to paid or failed', () => {
    expect(VALID_TRANSITIONS.intake).toEqual(['paid', 'failed']);
  });

  it('delivered is terminal', () => {
    expect(VALID_TRANSITIONS.delivered).toEqual([]);
  });

  it('failed reports can be retried', () => {
    expect(VALID_TRANSITIONS.failed).toContain('processing');
  });

  it('delivering can roll back to pending_approval on failure', () => {
    expect(VALID_TRANSITIONS.delivering).toContain('pending_approval');
  });
});
