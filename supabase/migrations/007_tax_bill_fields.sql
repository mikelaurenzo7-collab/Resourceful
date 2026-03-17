-- Add tax bill data columns to reports table
-- These store user-uploaded tax bill information for discount eligibility
-- and to skip redundant ATTOM API calls.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS has_tax_bill boolean NOT NULL DEFAULT false;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS tax_bill_assessed_value numeric;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS tax_bill_tax_amount numeric;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS tax_bill_tax_year text;
