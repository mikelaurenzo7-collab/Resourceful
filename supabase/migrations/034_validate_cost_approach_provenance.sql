-- Validate the cost-provenance checks added NOT VALID in migration 033.

alter table public.property_data
  validate constraint property_data_cost_verification_state_valid;

alter table public.property_data
  validate constraint property_data_verified_cost_provenance_complete;
