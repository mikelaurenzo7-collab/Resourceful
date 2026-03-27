-- ============================================================================
-- Migration 012: Referral Codes + Annual Reminders
-- ============================================================================

-- ── Referral codes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            text UNIQUE NOT NULL,          -- e.g., 'MIKE2026', 'SAVE20'
  referrer_email  text NOT NULL,                 -- who created the code
  referrer_name   text,
  discount_pct    numeric(4,2) NOT NULL DEFAULT 10, -- % discount for new user
  referrer_credit_cents integer NOT NULL DEFAULT 0,  -- credit to referrer per use
  max_uses        integer,                       -- null = unlimited
  times_used      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  expires_at      timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referral codes" ON referral_codes
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Track referral usage on reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS referral_code_id uuid REFERENCES referral_codes(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS referral_discount_cents integer DEFAULT 0;

-- ── Annual assessment reminders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminder_subscriptions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           text NOT NULL,
  client_name     text,
  property_address text NOT NULL,
  city            text,
  state           text,
  county          text,
  county_fips     text,
  -- When to remind (based on county assessment cycle)
  remind_month    integer NOT NULL,              -- 1-12 (month to send reminder)
  remind_day      integer NOT NULL DEFAULT 1,    -- day of month
  -- Status
  last_reminded_at timestamptz,
  last_reminded_year integer,
  is_active       boolean NOT NULL DEFAULT true,
  -- Source
  source_report_id uuid REFERENCES reports(id),  -- report that created this subscription
  created_at      timestamptz DEFAULT now() NOT NULL,
  UNIQUE(email, property_address)
);

ALTER TABLE reminder_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reminders" ON reminder_subscriptions
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE INDEX idx_reminders_month ON reminder_subscriptions(remind_month) WHERE is_active = true;
CREATE INDEX idx_reminders_email ON reminder_subscriptions(email);
