-- ─── Add Row Level Security to county_rules ─────────────────────────────────
-- county_rules was missing RLS, exposing county intelligence data
-- (success rates, assessor error patterns, board notes) to all users.

ALTER TABLE county_rules ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active county rules (public reference data:
-- deadlines, board names, assessment ratios). Inactive/draft rules are hidden.
CREATE POLICY "authenticated_read_active"
  ON county_rules FOR SELECT TO authenticated
  USING (is_active = true);

-- Admins get full CRUD access for county rule management.
CREATE POLICY "admin_full_access"
  ON county_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Service role (pipeline, cron) bypasses RLS automatically — no policy needed.
