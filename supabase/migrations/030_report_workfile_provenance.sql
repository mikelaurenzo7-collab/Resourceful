-- Report workfile provenance and jurisdiction plugin controls.
-- These fields let release policy fail closed on evidence provenance instead of
-- inferring verified facts from prose or county-name conditionals.

alter table public.reports
  add column if not exists is_retrospective_assignment boolean not null default false;

alter table public.property_data
  add column if not exists unit_count integer,
  add column if not exists unit_count_source_type text,
  add column if not exists unit_count_source_reference text,
  add column if not exists regulatory_source_authority text,
  add column if not exists regulatory_source_url text,
  add column if not exists property_class_source_authority text,
  add column if not exists property_class_source_url text;

alter table public.county_rules
  add column if not exists jurisdiction_plugin_key text,
  add column if not exists jurisdiction_plugin_version integer;

alter table public.property_data
  drop constraint if exists property_data_unit_count_positive,
  add constraint property_data_unit_count_positive
    check (unit_count is null or unit_count > 0),
  drop constraint if exists property_data_unit_count_source_type_valid,
  add constraint property_data_unit_count_source_type_valid
    check (
      unit_count_source_type is null or unit_count_source_type in (
        'owner_statement',
        'photograph',
        'public_record',
        'licensed_data',
        'calculation',
        'assumption',
        'professional_judgment'
      )
    ),
  drop constraint if exists property_data_regulatory_source_url_http,
  add constraint property_data_regulatory_source_url_http
    check (regulatory_source_url is null or regulatory_source_url ~* '^https?://'),
  drop constraint if exists property_data_class_source_url_http,
  add constraint property_data_class_source_url_http
    check (property_class_source_url is null or property_class_source_url ~* '^https?://');

alter table public.county_rules
  drop constraint if exists county_rules_plugin_version_positive,
  add constraint county_rules_plugin_version_positive
    check (
      (jurisdiction_plugin_key is null and jurisdiction_plugin_version is null)
      or
      (jurisdiction_plugin_key is not null and jurisdiction_plugin_version is not null and jurisdiction_plugin_version > 0)
    );

-- Versioned jurisdiction behavior is configured in county_rules rather than
-- hardcoded throughout application policy. This seed identifies the existing
-- Cook County rule package; additional jurisdiction plugins can be added by data.
update public.county_rules
set
  jurisdiction_plugin_key = 'cook_county_classification',
  jurisdiction_plugin_version = 1,
  updated_at = now()
where county_fips = '17031'
  and jurisdiction_plugin_key is null;

comment on column public.reports.is_retrospective_assignment is
  'Explicit assignment control; never infer retrospective status from report latency.';
comment on column public.property_data.unit_count is
  'Structured subject unit count used for multifamily analysis.';
comment on column public.property_data.unit_count_source_type is
  'Attributed evidence category for unit_count.';
comment on column public.property_data.unit_count_source_reference is
  'Human-readable document, URL, file, or workfile reference supporting unit_count.';
comment on column public.property_data.regulatory_source_authority is
  'Official authority supporting a zoning, code, or regulatory claim.';
comment on column public.property_data.regulatory_source_url is
  'HTTP(S) official-source URL supporting a zoning, code, or regulatory claim.';
comment on column public.property_data.property_class_source_authority is
  'Assessor or official authority supporting a special property classification.';
comment on column public.property_data.property_class_source_url is
  'HTTP(S) official-source URL supporting a special property classification.';
comment on column public.county_rules.jurisdiction_plugin_key is
  'Versioned application policy plugin selected by the verified county rule package.';
comment on column public.county_rules.jurisdiction_plugin_version is
  'Positive version of jurisdiction_plugin_key behavior.';
