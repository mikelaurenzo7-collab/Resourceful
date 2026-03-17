-- Enable RLS on county_rules (was missing — violates CLAUDE.md rule "RLS on every table").
-- County rules are public-read (needed for filing info) but only admin-writable.

ALTER TABLE county_rules ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read county rules (public filing info)
CREATE POLICY "County rules are publicly readable"
  ON county_rules FOR SELECT
  USING (true);

-- Only service_role (admin client) can insert/update/delete
-- No explicit insert/update/delete policies = denied for anon/authenticated roles
