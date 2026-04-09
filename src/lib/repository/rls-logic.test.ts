import { describe, it, expect } from 'vitest';

// ─── RLS Policy Logic Tests ─────────────────────────────────────────────────
// Validates the authorization logic used in RLS policies and API handlers
// for email-only user support across all tables.
//
// These tests verify the JS-side ownership check pattern that mirrors the
// SQL RLS policies in migrations 022 and 023.

interface Report {
  id: string;
  user_id: string | null;
  client_email: string | null;
}

interface AuthUser {
  id: string;
  email: string;
}

/**
 * Mirrors the ownership check pattern used in API route handlers.
 * The same logic is replicated in SQL RLS policies.
 */
function isReportOwner(report: Report, user: AuthUser): boolean {
  if (report.user_id) {
    return report.user_id === user.id;
  }
  // Email-only report: match on client_email
  return report.client_email?.toLowerCase() === user.email?.toLowerCase();
}

/**
 * Mirrors the RLS subquery pattern for child tables (photos, attorney_referrals,
 * form_submissions) that join back to reports for authorization.
 */
function canAccessChildRecord(
  reportId: string,
  reports: Report[],
  user: AuthUser
): boolean {
  const report = reports.find((r) => r.id === reportId);
  if (!report) return false;
  return isReportOwner(report, user);
}

describe('report ownership checks', () => {
  const authenticatedUser: AuthUser = { id: 'user-123', email: 'user@example.com' };

  describe('authenticated user with user_id', () => {
    it('grants access when user_id matches', () => {
      const report: Report = { id: 'r1', user_id: 'user-123', client_email: 'user@example.com' };
      expect(isReportOwner(report, authenticatedUser)).toBe(true);
    });

    it('denies access when user_id does not match', () => {
      const report: Report = { id: 'r1', user_id: 'other-user', client_email: 'user@example.com' };
      expect(isReportOwner(report, authenticatedUser)).toBe(false);
    });
  });

  describe('email-only user (user_id is null)', () => {
    it('grants access when client_email matches', () => {
      const report: Report = { id: 'r1', user_id: null, client_email: 'user@example.com' };
      expect(isReportOwner(report, authenticatedUser)).toBe(true);
    });

    it('grants access with case-insensitive email match', () => {
      const report: Report = { id: 'r1', user_id: null, client_email: 'User@Example.COM' };
      expect(isReportOwner(report, authenticatedUser)).toBe(true);
    });

    it('denies access when client_email does not match', () => {
      const report: Report = { id: 'r1', user_id: null, client_email: 'other@example.com' };
      expect(isReportOwner(report, authenticatedUser)).toBe(false);
    });

    it('denies access when client_email is null', () => {
      const report: Report = { id: 'r1', user_id: null, client_email: null };
      expect(isReportOwner(report, authenticatedUser)).toBe(false);
    });
  });
});

describe('child record access (attorney_referrals, form_submissions, photos)', () => {
  const user: AuthUser = { id: 'user-123', email: 'user@example.com' };
  const reports: Report[] = [
    { id: 'r1', user_id: 'user-123', client_email: 'user@example.com' },
    { id: 'r2', user_id: null, client_email: 'user@example.com' },
    { id: 'r3', user_id: 'other-user', client_email: 'other@example.com' },
    { id: 'r4', user_id: null, client_email: 'other@example.com' },
  ];

  it('grants access to child records of own report (via user_id)', () => {
    expect(canAccessChildRecord('r1', reports, user)).toBe(true);
  });

  it('grants access to child records of email-only report (via client_email)', () => {
    expect(canAccessChildRecord('r2', reports, user)).toBe(true);
  });

  it('denies access to other user reports (via user_id)', () => {
    expect(canAccessChildRecord('r3', reports, user)).toBe(false);
  });

  it('denies access to other email-only reports', () => {
    expect(canAccessChildRecord('r4', reports, user)).toBe(false);
  });

  it('denies access when report does not exist', () => {
    expect(canAccessChildRecord('nonexistent', reports, user)).toBe(false);
  });
});
