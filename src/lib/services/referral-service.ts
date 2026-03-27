// ─── Referral Code Service ────────────────────────────────────────────────────
// Manages referral codes, validates them at checkout, applies discounts,
// and credits referrers.

import { createAdminClient } from '@/lib/supabase/admin';

export interface ReferralCode {
  id: string;
  code: string;
  referrer_email: string;
  referrer_name: string | null;
  discount_pct: number;
  referrer_credit_cents: number;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
  expires_at: string | null;
}

export interface ReferralValidation {
  valid: boolean;
  code: ReferralCode | null;
  discountPct: number;
  error: string | null;
}

/**
 * Validate a referral code at checkout.
 * Returns the discount percentage if valid, or an error.
 */
export async function validateReferralCode(code: string): Promise<ReferralValidation> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { valid: false, code: null, discountPct: 0, error: 'Invalid referral code' };
  }

  const referral = data as unknown as ReferralCode;

  // Check expiry
  if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
    return { valid: false, code: null, discountPct: 0, error: 'This referral code has expired' };
  }

  // Check max uses
  if (referral.max_uses && referral.times_used >= referral.max_uses) {
    return { valid: false, code: null, discountPct: 0, error: 'This referral code has reached its usage limit' };
  }

  return {
    valid: true,
    code: referral,
    discountPct: Number(referral.discount_pct),
    error: null,
  };
}

/**
 * Apply a referral code to a report (increment usage, record on report).
 */
export async function applyReferralCode(
  reportId: string,
  referralCodeId: string,
  discountCents: number
): Promise<void> {
  const supabase = createAdminClient();

  // Update report with referral info
  await supabase
    .from('reports')
    .update({
      referral_code_id: referralCodeId,
      referral_discount_cents: discountCents,
    } as never)
    .eq('id', reportId);

  // Increment usage count
  await supabase
    .from('referral_codes' as never)
    .update({ times_used: supabase } as never) // Will use raw SQL instead
    .eq('id' as never, referralCodeId);
  // TODO: Replace with proper increment via RPC or raw SQL
}

/**
 * Generate a unique referral code for a customer after a successful appeal.
 */
export async function generateReferralCode(
  email: string,
  name: string | null
): Promise<string> {
  const supabase = createAdminClient();

  // Generate code from name or email
  const base = (name ?? email.split('@')[0])
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  const code = `${base}${suffix}`;

  await supabase.from('referral_codes' as never).insert({
    code,
    referrer_email: email,
    referrer_name: name,
    discount_pct: 10,
    referrer_credit_cents: 500,
    is_active: true,
  } as never);

  return code;
}
