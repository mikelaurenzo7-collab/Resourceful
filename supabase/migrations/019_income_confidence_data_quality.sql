-- Migration 019: Income confidence and data quality
-- Adds rental_comp_confidence to income_analysis for transparency about
-- whether rental data is market-derived or estimated from defaults.

alter table income_analysis
  add column if not exists rental_comp_confidence text
    check (rental_comp_confidence in ('high', 'medium', 'low', 'none'));

comment on column income_analysis.rental_comp_confidence is
  'Confidence level in rental comp data: high (5+ comps), medium (2-4), low (1), none (fallback estimate)';

-- Add comp_count and valuation_method to property_data for transparency
alter table property_data
  add column if not exists comp_count integer;

alter table property_data
  add column if not exists valuation_method text
    check (valuation_method in ('sales_comparison', 'income', 'cost', 'sales_income_blend'));

comment on column property_data.comp_count is
  'Number of comparable sales used in the sales comparison approach (0 = cost/income only)';

comment on column property_data.valuation_method is
  'Primary valuation method used: sales_comparison, income, cost, or sales_income_blend';
