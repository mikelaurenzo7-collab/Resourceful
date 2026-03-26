-- ============================================================================
-- Review Tier Expansion — Guided Filing + Full Representation
-- ============================================================================
-- Adds two new review tiers:
--   'guided_filing'       — Report + live guided filing session
--   'full_representation' — Report + we file on their behalf + attend hearing

alter type review_tier add value 'guided_filing';
alter type review_tier add value 'full_representation';
