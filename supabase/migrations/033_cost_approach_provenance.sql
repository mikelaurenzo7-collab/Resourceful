-- Structured provenance for cost-approach evidence. Numeric cost inputs may be
-- stored for analysis, but release policy must not classify them as verified
-- without source authority, methodology, effective date, references, and an
-- explicit qualified-review record.

alter table public.property_data
  add column if not exists cost_replacement_source_authority text,
  add column if not exists cost_depreciation_source_authority text,
  add column if not exists cost_land_source_authority text,
  add column if not exists cost_source_references jsonb,
  add column if not exists cost_methodology text,
  add column if not exists cost_effective_date date,
  add column if not exists cost_verification_state text,
  add column if not exists cost_verified_by text,
  add column if not exists cost_verified_at timestamptz;

alter table public.property_data
  drop constraint if exists property_data_cost_verification_state_valid,
  add constraint property_data_cost_verification_state_valid
    check (
      cost_verification_state is null
      or cost_verification_state in ('verified', 'assumption', 'unverified')
    ) not valid,
  drop constraint if exists property_data_verified_cost_provenance_complete,
  add constraint property_data_verified_cost_provenance_complete
    check (
      cost_verification_state <> 'verified'
      or (
        nullif(trim(cost_replacement_source_authority), '') is not null
        and nullif(trim(cost_depreciation_source_authority), '') is not null
        and nullif(trim(cost_land_source_authority), '') is not null
        and cost_source_references is not null
        and jsonb_typeof(cost_source_references) = 'object'
        and cost_source_references <> '{}'::jsonb
        and nullif(trim(cost_methodology), '') is not null
        and cost_effective_date is not null
        and nullif(trim(cost_verified_by), '') is not null
        and cost_verified_at is not null
      )
    ) not valid;

comment on column public.property_data.cost_replacement_source_authority is
  'Named authority or licensed source supporting replacement-cost-new inputs.';
comment on column public.property_data.cost_depreciation_source_authority is
  'Named source or documented method supporting physical and functional depreciation inputs.';
comment on column public.property_data.cost_land_source_authority is
  'Named public, licensed, or professionally developed source supporting land value.';
comment on column public.property_data.cost_source_references is
  'Structured document identifiers, URLs, workfile references, vintages, and retrieval metadata for cost-approach sources.';
comment on column public.property_data.cost_methodology is
  'Reproducible cost, depreciation, obsolescence, and land-value methodology.';
comment on column public.property_data.cost_effective_date is
  'Effective date to which the cost evidence and inputs apply.';
comment on column public.property_data.cost_verification_state is
  'Evidence classification: verified, assumption, or unverified.';
comment on column public.property_data.cost_verified_by is
  'Qualified reviewer or controlled reviewer identifier accepting responsibility for cost-input verification.';
comment on column public.property_data.cost_verified_at is
  'Timestamp when the cost evidence package was independently verified.';
