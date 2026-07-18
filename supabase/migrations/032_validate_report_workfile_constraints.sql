-- Validate the report-workfile constraints added NOT VALID in migration 030.
-- VALIDATE CONSTRAINT uses a lower lock level than adding and scanning the
-- constraint inline, preserving concurrent reads and writes during validation.

alter table public.reports
  validate constraint reports_valuation_effective_date_source_valid;

alter table public.reports
  validate constraint reports_effective_date_source_pair;

alter table public.property_data
  validate constraint property_data_unit_count_positive;

alter table public.property_data
  validate constraint property_data_unit_count_source_type_valid;

alter table public.property_data
  validate constraint property_data_regulatory_source_url_http;

alter table public.property_data
  validate constraint property_data_class_source_url_http;

alter table public.county_rules
  validate constraint county_rules_plugin_version_positive;
