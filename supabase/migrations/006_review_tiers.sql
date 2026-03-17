-- ============================================================================
-- Review Tiers — AI Auto-Report vs Expert-Reviewed
-- ============================================================================
-- Users choose between:
--   'auto'            — AI-generated report, auto-delivered (~15-30 min)
--   'expert_reviewed' — AI-generated + professional appraiser review (1-2 days)

create type review_tier as enum ('auto', 'expert_reviewed');

alter table reports
  add column review_tier review_tier not null default 'auto';

-- Index for admin queries filtering by tier
create index idx_reports_review_tier on reports(review_tier);
