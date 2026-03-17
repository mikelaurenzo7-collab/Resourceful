-- ─── Migration 010: Cost Approach, Attorney Network, Form Submissions ─────────
-- Adds cost approach valuation columns to property_data, the attorney network
-- table for case routing, attorney_referrals for outcome tracking, and
-- form_submissions for structured e-filing prefill data.

-- ── property_data additions ───────────────────────────────────────────────────
-- land_value: from ATTOM assessment.landValue (assessor's split land value)
-- quality_grade: building quality tier; defaults to 'average' when unknown
-- cost_approach_rcn: replacement cost new (building only, no depreciation)
-- cost_approach_value: RCN × (1 − depreciation%) + land_value (full 3rd approach)
-- functional_obsolescence_pct: incurable super-adequacy / layout obsolescence %
-- functional_obsolescence_notes: explanation of what drives the obsolescence

ALTER TABLE property_data
  ADD COLUMN IF NOT EXISTS land_value                   integer      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quality_grade                text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_approach_rcn            integer      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_approach_value          integer      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS functional_obsolescence_pct  numeric(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS functional_obsolescence_notes text        DEFAULT NULL;

-- ── attorneys table ───────────────────────────────────────────────────────────
-- Stores the attorney network for case routing. Attorneys can be restricted to
-- specific states or counties (counties_fips = NULL means all counties in state).
-- min_case_value_dollars gates routing — attorneys only receive cases with
-- enough at stake to justify their time.

CREATE TABLE IF NOT EXISTS attorneys (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name               text        NOT NULL,
  attorney_name           text        NOT NULL,
  email                   text        NOT NULL UNIQUE,
  phone                   text        DEFAULT NULL,
  states                  text[]      NOT NULL,
  counties_fips           text[]      DEFAULT NULL,  -- NULL = all counties in state
  property_types          text[]      NOT NULL DEFAULT '{residential,commercial,industrial}',
  service_types           text[]      NOT NULL DEFAULT '{tax_appeal}',
  contingency_fee_pct     numeric(5,2) NOT NULL DEFAULT 33.3,
  min_case_value_dollars  integer     NOT NULL DEFAULT 5000,
  max_active_cases        integer     DEFAULT NULL,
  is_active               boolean     NOT NULL DEFAULT true,
  notes                   text        DEFAULT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attorneys_states     ON attorneys USING gin(states);
CREATE INDEX IF NOT EXISTS idx_attorneys_is_active  ON attorneys(is_active);

-- ── attorney_referrals table ──────────────────────────────────────────────────
-- Created automatically by Stage 5 when case_strength_score ≥ 75 and
-- case_value_at_stake ≥ $5,000 and county authorized_rep_allowed = true.
-- revenue_share_cents = savings_amount_cents × (contingency_fee_pct / 100).

CREATE TABLE IF NOT EXISTS attorney_referrals (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id            uuid        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  attorney_id          uuid        NOT NULL REFERENCES attorneys(id) ON DELETE RESTRICT,
  case_strength_score  integer     NOT NULL,
  case_value_at_stake  integer     NOT NULL,
  referral_status      text        NOT NULL DEFAULT 'pending',
  -- Outcomes (filled when case resolves)
  accepted_at          timestamptz DEFAULT NULL,
  declined_at          timestamptz DEFAULT NULL,
  declined_reason      text        DEFAULT NULL,
  outcome              text        DEFAULT NULL,  -- 'settled' | 'won_at_hearing' | 'lost' | 'withdrawn'
  savings_amount_cents integer     DEFAULT NULL,
  revenue_share_cents  integer     DEFAULT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attorney_referrals_report_id   ON attorney_referrals(report_id);
CREATE INDEX IF NOT EXISTS idx_attorney_referrals_attorney_id ON attorney_referrals(attorney_id);
CREATE INDEX IF NOT EXISTS idx_attorney_referrals_status      ON attorney_referrals(referral_status);

-- ── form_submissions table ────────────────────────────────────────────────────
-- Stores structured prefill data for county appeal forms. prefill_data is a
-- JSONB blob with all field values needed to fill the form. Stage 5 populates
-- this for every tax_appeal report where a county_rules record is found.
-- submission_status progresses: prefill_ready → submitted → confirmed.

CREATE TABLE IF NOT EXISTS form_submissions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           uuid        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  county_fips         text        NOT NULL,
  submission_method   text        NOT NULL,  -- 'online' | 'email' | 'mail' | 'in_person'
  portal_url          text        DEFAULT NULL,
  submission_status   text        NOT NULL DEFAULT 'prefill_ready',
  prefill_data        jsonb       DEFAULT NULL,
  submitted_at        timestamptz DEFAULT NULL,
  confirmation_number text        DEFAULT NULL,
  notes               text        DEFAULT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_report_id ON form_submissions(report_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status    ON form_submissions(submission_status);

-- ── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE attorneys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attorney_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions   ENABLE ROW LEVEL SECURITY;

-- Service role has full access to all three tables
CREATE POLICY "attorneys_service_role_all"
  ON attorneys FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "attorney_referrals_service_role_all"
  ON attorney_referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "form_submissions_service_role_all"
  ON form_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can view referrals and submissions for their own reports
CREATE POLICY "attorney_referrals_user_select"
  ON attorney_referrals FOR SELECT TO authenticated
  USING (report_id IN (SELECT id FROM reports WHERE user_id = auth.uid()));

CREATE POLICY "form_submissions_user_select"
  ON form_submissions FOR SELECT TO authenticated
  USING (report_id IN (SELECT id FROM reports WHERE user_id = auth.uid()));
