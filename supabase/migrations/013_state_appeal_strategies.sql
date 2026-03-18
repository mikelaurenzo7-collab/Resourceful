-- Add state-specific advanced appeal strategies to county_rules.
-- These are injected into AI prompts to give the AI deep expertise
-- in each state's unique assessment and appeal landscape.
--
-- The AI uses this context to craft sophisticated, state-specific
-- arguments that go beyond generic comparable sales analysis.

ALTER TABLE county_rules
  ADD COLUMN IF NOT EXISTS state_appeal_strategies TEXT;
