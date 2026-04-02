-- Atomic partner usage tracking.
-- Called by partner-api-service.ts when a report is created via the Partner API.
-- Increments counters in a single atomic UPDATE to prevent race conditions.

CREATE OR REPLACE FUNCTION increment_partner_usage(partner_id uuid, fee_cents int)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE api_partners SET
    reports_this_month = reports_this_month + 1,
    total_reports_generated = total_reports_generated + 1,
    total_revenue_cents = total_revenue_cents + fee_cents,
    updated_at = now()
  WHERE id = partner_id;
$$;
