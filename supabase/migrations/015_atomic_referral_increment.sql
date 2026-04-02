-- Atomic increment for referral code usage.
-- Prevents race conditions when multiple checkouts use the same code concurrently.

CREATE OR REPLACE FUNCTION increment_referral_usage(code_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE referral_codes
  SET times_used = times_used + 1
  WHERE id = code_id;
$$;
