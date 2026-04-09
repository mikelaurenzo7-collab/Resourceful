-- 030_county_rules_enrichment.sql
-- Adds Cook County-specific enrichment fields to county_rules

alter table county_rules
  add column if not exists level_of_assessment_commercial numeric(4,3),
  add column if not exists level_of_assessment_residential numeric(4,3),
  add column if not exists cost_approach_disfavored boolean default false,
  add column if not exists valuation_date_convention text,
  add column if not exists fair_cash_value_synonym boolean default false;

-- Optionally, update Cook County row (FIPS 17031) with correct values
update county_rules set
  level_of_assessment_commercial = 0.25,
  level_of_assessment_residential = 0.10,
  cost_approach_disfavored = true,
  valuation_date_convention = 'january_1_tax_year',
  fair_cash_value_synonym = true
where county_fips = '17031';
