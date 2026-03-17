-- Add missing review_tier enum values used in pricing and payment flow.
-- The TypeScript type and pricing config reference 'guided_filing' and
-- 'full_representation' but the SQL enum only had 'auto' and 'expert_reviewed'.

ALTER TYPE review_tier ADD VALUE IF NOT EXISTS 'guided_filing';
ALTER TYPE review_tier ADD VALUE IF NOT EXISTS 'full_representation';
