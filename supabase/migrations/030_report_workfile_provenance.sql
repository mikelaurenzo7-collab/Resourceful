-- Report workfile provenance, effective-date, and jurisdiction plugin controls.
-- These fields let release policy fail closed on evidence provenance instead of
-- inferring verified facts from prose, submission timestamps, or county names.

alter table public.reports
  add column if not exists is_retrospective_assignment boolean not null default false,
  add column if not exists valuation_effective_date date,
  add column if not exists valuation_effective_date_source text;

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

alter table public.reports
  drop constraint if exists reports_valuation_effective_date_source_valid,
  add constraint reports_valuation_effective_date_source_valid
    check (
      valuation_effective_date_source is null or valuation_effective_date_source in (
        'intake_current_date',
        'jurisdiction_convention',
        'user_supplied',
        'admin_override'
      )
    ),
  drop constraint if exists reports_effective_date_source_pair,
  add constraint reports_effective_date_source_pair
    check (
      (valuation_effective_date is null and valuation_effective_date_source is null)
      or
      (valuation_effective_date is not null and valuation_effective_date_source is not null)
    );

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

create or replace function public.resourceful_tax_appeal_effective_date(
  assessment_year integer,
  valuation_date_convention text
)
returns date
language plpgsql
immutable
as $$
declare
  normalized text := lower(trim(coalesce(valuation_date_convention, '')));
  year_offset integer;
begin
  if assessment_year is null or assessment_year < 1900 or assessment_year > 2200 then
    return null;
  end if;

  if normalized !~ '(january\s*1|jan\.?\s*1|first day of january)' then
    return null;
  end if;

  if normalized ~ '\m(prior|preceding|previous)\M.{0,40}\myear\M'
     or normalized ~ '\myear\M.{0,40}\m(prior|preceding|previous)\M' then
    year_offset := -1;
  elsif normalized ~ '\m(assessment|tax|same|current)\s+year\M'
        or normalized ~ 'january\s*1(st)?(\s+of)?\s+(each|every)\s+year' then
    year_offset := 0;
  else
    return null;
  end if;

  return make_date(assessment_year + year_offset, 1, 1);
end;
$$;

create or replace function public.resourceful_normalize_report_effective_date()
returns trigger
language plpgsql
as $$
declare
  assessment_year integer;
  convention text;
  derived_date date;
  independent_override boolean;
begin
  if new.valuation_effective_date is not null
     and new.valuation_effective_date_source in ('user_supplied', 'admin_override') then
    return new;
  end if;

  independent_override := trim(coalesce(new.desired_outcome, '')) like '[INDEPENDENT_VALUATION]%';

  if new.service_type <> 'tax_appeal' or independent_override then
    new.valuation_effective_date := coalesce(
      new.valuation_effective_date,
      coalesce(new.created_at::date, current_date)
    );
    new.valuation_effective_date_source := coalesce(
      new.valuation_effective_date_source,
      'intake_current_date'
    );
    return new;
  end if;

  select property.tax_year_in_appeal, rule.valuation_date_convention
    into assessment_year, convention
  from public.property_data as property
  left join public.county_rules as rule
    on rule.county_fips = new.county_fips
  where property.report_id = new.id
  limit 1;

  derived_date := public.resourceful_tax_appeal_effective_date(
    assessment_year,
    convention
  );
  new.valuation_effective_date := derived_date;
  new.valuation_effective_date_source := case
    when derived_date is not null then 'jurisdiction_convention'
    else null
  end;

  return new;
end;
$$;

create or replace function public.resourceful_sync_effective_date_from_property()
returns trigger
language plpgsql
as $$
declare
  report_row public.reports%rowtype;
  convention text;
  derived_date date;
begin
  select * into report_row
  from public.reports
  where id = new.report_id;

  if not found then
    return new;
  end if;

  if report_row.valuation_effective_date is not null
     and report_row.valuation_effective_date_source in ('user_supplied', 'admin_override') then
    return new;
  end if;

  if report_row.service_type <> 'tax_appeal'
     or trim(coalesce(report_row.desired_outcome, '')) like '[INDEPENDENT_VALUATION]%' then
    return new;
  end if;

  select valuation_date_convention into convention
  from public.county_rules
  where county_fips = report_row.county_fips
  limit 1;

  derived_date := public.resourceful_tax_appeal_effective_date(
    new.tax_year_in_appeal,
    convention
  );

  update public.reports
  set
    valuation_effective_date = derived_date,
    valuation_effective_date_source = case
      when derived_date is not null then 'jurisdiction_convention'
      else null
    end
  where id = new.report_id;

  return new;
end;
$$;

create or replace function public.resourceful_sync_effective_dates_from_county_rule()
returns trigger
language plpgsql
as $$
begin
  update public.reports as report
  set
    valuation_effective_date = public.resourceful_tax_appeal_effective_date(
      property.tax_year_in_appeal,
      new.valuation_date_convention
    ),
    valuation_effective_date_source = case
      when public.resourceful_tax_appeal_effective_date(
        property.tax_year_in_appeal,
        new.valuation_date_convention
      ) is not null then 'jurisdiction_convention'
      else null
    end
  from public.property_data as property
  where property.report_id = report.id
    and report.county_fips = new.county_fips
    and report.service_type = 'tax_appeal'
    and trim(coalesce(report.desired_outcome, '')) not like '[INDEPENDENT_VALUATION]%'
    and coalesce(report.valuation_effective_date_source, '') not in ('user_supplied', 'admin_override');

  return new;
end;
$$;

drop trigger if exists reports_normalize_valuation_effective_date on public.reports;
create trigger reports_normalize_valuation_effective_date
before insert or update of
  service_type,
  desired_outcome,
  county_fips,
  valuation_effective_date,
  valuation_effective_date_source
on public.reports
for each row
execute function public.resourceful_normalize_report_effective_date();

drop trigger if exists property_data_sync_valuation_effective_date on public.property_data;
create trigger property_data_sync_valuation_effective_date
after insert or update of tax_year_in_appeal
on public.property_data
for each row
execute function public.resourceful_sync_effective_date_from_property();

drop trigger if exists county_rules_sync_valuation_effective_dates on public.county_rules;
create trigger county_rules_sync_valuation_effective_dates
after insert or update of county_fips, valuation_date_convention
on public.county_rules
for each row
execute function public.resourceful_sync_effective_dates_from_county_rule();

-- Current-value assignments use the stable intake date, not the later PDF
-- generation timestamp. Tax appeals are backfilled only when the stored county
-- convention explicitly identifies January 1 and the assessment year relation.
update public.reports
set
  valuation_effective_date = created_at::date,
  valuation_effective_date_source = 'intake_current_date'
where (
    service_type <> 'tax_appeal'
    or trim(coalesce(desired_outcome, '')) like '[INDEPENDENT_VALUATION]%'
  )
  and valuation_effective_date is null;

update public.reports as report
set
  valuation_effective_date = public.resourceful_tax_appeal_effective_date(
    property.tax_year_in_appeal,
    rule.valuation_date_convention
  ),
  valuation_effective_date_source = case
    when public.resourceful_tax_appeal_effective_date(
      property.tax_year_in_appeal,
      rule.valuation_date_convention
    ) is not null then 'jurisdiction_convention'
    else null
  end
from public.property_data as property,
     public.county_rules as rule
where property.report_id = report.id
  and rule.county_fips = report.county_fips
  and report.service_type = 'tax_appeal'
  and trim(coalesce(report.desired_outcome, '')) not like '[INDEPENDENT_VALUATION]%'
  and coalesce(report.valuation_effective_date_source, '') not in ('user_supplied', 'admin_override');

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
comment on column public.reports.valuation_effective_date is
  'Assignment effective date used for valuation evidence and jurisdiction release; never substitute report creation or generation time downstream.';
comment on column public.reports.valuation_effective_date_source is
  'Provenance for valuation_effective_date: intake current date, verified jurisdiction convention, user-supplied date, or admin override.';
comment on function public.resourceful_tax_appeal_effective_date(integer, text) is
  'Fail-closed derivation for explicit January 1 same-year or prior-year jurisdiction conventions.';
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
