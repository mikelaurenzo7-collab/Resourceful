-- Partner API keys and usage tracking
CREATE TABLE IF NOT EXISTS api_partners (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_name       text NOT NULL,
  contact_email   text NOT NULL,
  contact_name    text,
  api_key         text UNIQUE NOT NULL,          -- hashed key stored
  api_key_prefix  text NOT NULL,                 -- first 8 chars for display (rfl_xxxx)
  is_active       boolean NOT NULL DEFAULT true,
  -- Pricing
  revenue_share_pct numeric(5,2) NOT NULL DEFAULT 30, -- we keep 30%, they keep 70%
  per_report_fee_cents integer NOT NULL DEFAULT 2500,  -- $25 per report (our share)
  -- Branding
  white_label_name text,                          -- their brand name on reports
  white_label_logo_url text,                      -- their logo URL
  -- Limits
  monthly_report_limit integer,                   -- null = unlimited
  reports_this_month integer NOT NULL DEFAULT 0,
  -- Tracking
  total_reports_generated integer NOT NULL DEFAULT 0,
  total_revenue_cents integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE api_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage partners" ON api_partners
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Track which reports came from API partners
ALTER TABLE reports ADD COLUMN IF NOT EXISTS api_partner_id uuid REFERENCES api_partners(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_white_label boolean DEFAULT false;

CREATE INDEX idx_api_partners_key ON api_partners(api_key) WHERE is_active = true;
