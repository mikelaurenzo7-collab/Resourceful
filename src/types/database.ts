// ─── Enum Types ──────────────────────────────────────────────────────────────

export type ReportStatus =
  | 'intake'
  | 'paid'
  | 'data_pull'
  | 'photo_pending'
  | 'processing'
  | 'pending_approval'
  | 'approved'
  | 'delivered'
  | 'rejected'
  | 'failed';

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';

export type PropertyType = 'residential' | 'land';

export type PhotoType =
  | 'exterior_front' | 'exterior_rear'
  | 'exterior_north' | 'exterior_south' | 'exterior_east' | 'exterior_west'
  | 'parking_lot' | 'driveway' | 'yard_landscape' | 'drainage'
  | 'roof_condition' | 'foundation_visible' | 'deferred_maintenance' | 'environmental_concern'
  | 'interior_main' | 'interior_kitchen' | 'interior_bathroom'
  | 'interior_bedroom' | 'interior_living' | 'interior_basement'
  | 'interior_garage'
  | 'curb_appeal' | 'neighbor_comparison' | 'lot_grade'
  | 'aerial' | 'other';

export type ApprovalAction =
  | 'approved'
  | 'rejected'
  | 'edit_section'
  | 'regenerate_section'
  | 'rerun_pipeline'
  | 'hold_for_review';

export type MeasurementSource = 'google_earth' | 'user_submitted' | 'attom' | 'county';

export type ReviewTier = 'auto' | 'expert_reviewed' | 'guided_filing';

// ─── Table Row Types ─────────────────────────────────────────────────────────
// These types match the database migration exactly (001_initial_schema.sql)
// IMPORTANT: Use `type` instead of `interface` so they extend Record<string, unknown>
// which is required by Supabase's GenericTable constraint.

export type User = {
  id: string;
  full_name: string | null;
  phone: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  user_id: string | null;
  client_email: string;
  client_name: string | null;
  service_type: ServiceType;
  property_type: PropertyType;
  status: ReportStatus;
  property_address: string;
  city: string | null;
  state: string | null;
  state_abbreviation: string | null;
  county: string | null;
  county_fips: string | null;
  latitude: number | null;
  longitude: number | null;
  pin: string | null;
  report_pdf_storage_path: string | null;
  admin_notes: string | null;
  stripe_payment_intent_id: string | null;
  payment_status: string | null;
  amount_paid_cents: number | null;
  photos_skipped: boolean;
  property_issues: string[] | null;
  additional_notes: string | null;
  desired_outcome: string | null;
  pipeline_last_completed_stage: string | null;
  pipeline_error_log: Record<string, unknown> | null;
  created_at: string;
  pipeline_started_at: string | null;
  pipeline_completed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  delivered_at: string | null;
  // Review tier
  review_tier: ReviewTier;
  // Tax bill data (user-provided for 15% discount)
  has_tax_bill: boolean;
  tax_bill_assessed_value: number | null;
  tax_bill_tax_amount: number | null;
  tax_bill_tax_year: string | null;
  // Filing tracking
  filing_status: string;
  filed_at: string | null;
  filing_method: string | null;
  appeal_outcome: string | null;
  savings_amount_cents: number | null;
  // ATTOM property cache reference (pre-payment lookup)
  attom_cache_id: string | null;
  // Row-level pipeline lock (replaces advisory locks for serverless compatibility)
  pipeline_locked_at: string | null;
  pipeline_lock_owner: string | null;
};

export type PropertyData = {
  id: string;
  report_id: string;
  assessed_value: number | null;
  assessed_value_source: string | null;
  market_value_estimate_low: number | null;
  market_value_estimate_high: number | null;
  assessment_ratio: number | null;
  assessment_methodology: string | null;
  lot_size_sqft: number | null;
  building_sqft_gross: number | null;
  building_sqft_living_area: number | null;
  year_built: number | null;
  effective_age: number | null;
  remaining_economic_life: number | null;
  property_class: string | null;
  property_class_description: string | null;
  construction_type: string | null;
  roof_type: string | null;
  exterior_finish: string | null;
  foundation_type: string | null;
  hvac_type: string | null;
  plumbing_description: string | null;
  sprinkler_system: boolean;
  number_of_stories: number | null;
  bedroom_count: number | null;
  full_bath_count: number | null;
  half_bath_count: number | null;
  garage_sqft: number | null;
  garage_spaces: number | null;
  basement_sqft: number | null;
  basement_finished_sqft: number | null;
  overhead_door_count: number | null;
  dock_door_count: number | null;
  clear_height_ft: number | null;
  overall_condition: string | null;
  condition_notes: string | null;
  zoning_designation: string | null;
  zoning_ordinance_citation: string | null;
  zoning_conformance: string | null;
  flood_zone_designation: string | null;
  flood_map_panel_number: string | null;
  flood_map_panel_date: string | null;
  flood_map_image_storage_path: string | null;
  regional_map_url: string | null;
  neighborhood_map_url: string | null;
  parcel_map_url: string | null;
  zoning_map_image_storage_path: string | null;
  tax_year_in_appeal: number | null;
  assessment_history: Record<string, unknown>[] | null;
  deed_history: Record<string, unknown>[] | null;
  attom_raw_response: Record<string, unknown> | null;
  county_assessor_raw_response: Record<string, unknown> | null;
  fema_raw_response: Record<string, unknown> | null;
  data_collection_notes: string | null;
  // Photo value attribution — tracks exactly how much photos moved the needle
  concluded_value: number | null;
  concluded_value_without_photos: number | null;
  photo_impact_dollars: number | null;
  photo_impact_pct: number | null;
  photo_condition_adjustment_pct: number | null;
  photo_defect_count: number;
  photo_defect_count_significant: number;
  photo_count: number;
  created_at: string;
};

export type Measurement = {
  id: string;
  report_id: string;
  source: MeasurementSource;
  north_wall_ft: number | null;
  south_wall_ft: number | null;
  east_wall_ft: number | null;
  west_wall_ft: number | null;
  calculated_footprint_sqft: number | null;
  total_living_area_sqft: number | null;
  garage_sqft: number | null;
  basement_sqft: number | null;
  basement_finished_sqft: number | null;
  lot_dimensions_description: string | null;
  attom_gba_sqft: number | null;
  discrepancy_flagged: boolean;
  discrepancy_pct: number | null;
  notes: string | null;
  created_at: string;
};

export type Photo = {
  id: string;
  report_id: string;
  storage_path: string;
  photo_type: PhotoType | null;
  ai_analysis: PhotoAiAnalysis | null;
  caption: string | null;
  sort_order: number;
  uploaded_at: string;
};

export type PhotoAiAnalysis = {
  condition_rating: 'excellent' | 'good' | 'average' | 'fair' | 'poor';
  defects: PhotoDefect[];
  inferred_direction: string;
  professional_caption: string;
  comparable_adjustment_note: string;
};

export type PhotoDefect = {
  type: string;
  description: string;
  severity: 'minor' | 'moderate' | 'significant';
  value_impact: 'low' | 'medium' | 'high';
  report_language: string;
};

export type ComparableSale = {
  id: string;
  report_id: string;
  address: string;
  sale_price: number;
  sale_date: string;
  grantor: string | null;
  grantee: string | null;
  deed_document_number: string | null;
  county_recorder_url: string | null;
  building_sqft: number | null;
  price_per_sqft: number | null;
  year_built: number | null;
  property_class: string | null;
  lot_size_sqft: number | null;
  land_to_building_ratio: number | null;
  overhead_door_count: number | null;
  clearance_height_ft: number | null;
  distance_miles: number | null;
  condition_notes: string | null;
  adjustment_pct_property_rights: number;
  adjustment_pct_financing_terms: number;
  adjustment_pct_conditions_of_sale: number;
  adjustment_pct_market_trends: number;
  adjustment_pct_location: number;
  adjustment_pct_size: number;
  adjustment_pct_land_to_building: number;
  adjustment_pct_condition: number;
  adjustment_pct_other: number;
  net_adjustment_pct: number | null;
  adjusted_price_per_sqft: number | null;
  is_weak_comparable: boolean;
  comparable_photo_url: string | null;
  created_at: string;
};

export type ComparableRental = {
  id: string;
  report_id: string;
  address: string | null;
  lease_date: string | null;
  pin: string | null;
  building_sqft_leased: number | null;
  rent_per_sqft_yr: number | null;
  lease_type: string | null;
  tenant_pays_description: string | null;
  adjustment_notes: string | null;
  effective_net_rent_per_sqft: number | null;
  created_at: string;
};

export type IncomeAnalysis = {
  id: string;
  report_id: string;
  concluded_market_rent_per_sqft_yr: number | null;
  potential_gross_income: number | null;
  vacancy_rate_pct: number | null;
  vacancy_amount: number | null;
  effective_gross_income: number | null;
  expense_nnn_during_vacancy: number | null;
  expense_legal_professional: number | null;
  expense_utilities_common: number | null;
  expense_reserves: number | null;
  expense_repairs_maintenance: number | null;
  total_expenses: number | null;
  expense_ratio_pct: number | null;
  net_operating_income: number | null;
  market_vacancy_rate_source: string | null;
  cap_rate_market_low: number | null;
  cap_rate_market_high: number | null;
  cap_rate_investor_survey_avg: number | null;
  concluded_cap_rate: number | null;
  investor_survey_reference: string | null;
  capitalized_value: number | null;
  concluded_value_income_approach: number | null;
  created_at: string;
};

export type ReportNarrative = {
  id: string;
  report_id: string;
  section_name: string;
  content: string;
  generated_at: string;
  model_used: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  generation_duration_ms: number | null;
  admin_edited: boolean;
  admin_edited_content: string | null;
};

export type CountyRule = {
  county_fips: string;
  county_name: string;
  state_name: string;
  state_abbreviation: string;
  assessment_ratio_residential: number;
  assessment_ratio_commercial: number;
  assessment_ratio_industrial: number;
  assessment_methodology: string;
  assessment_methodology_notes: string | null;
  appeal_board_name: string;
  appeal_board_address: string | null;
  appeal_board_phone: string | null;
  portal_url: string | null;
  filing_email: string | null;
  accepts_online_filing: boolean;
  accepts_email_filing: boolean;
  requires_mail_filing: boolean;
  state_appeal_board_name: string | null;
  state_appeal_board_url: string | null;
  appeal_deadline_rule: string;
  tax_year_appeal_window: string | null;
  typical_resolution_weeks_min: number | null;
  typical_resolution_weeks_max: number | null;
  hearing_typically_required: boolean;
  hearing_format: string | null;
  appeal_form_name: string | null;
  form_download_url: string | null;
  evidence_requirements: Record<string, unknown>[] | null;
  filing_fee_cents: number;
  filing_fee_notes: string | null;
  assessor_api_url: string | null;
  assessor_api_documentation_url: string | null;
  assessor_api_notes: string | null;
  pro_se_tips: string | null;
  state_appeal_strategies: string | null;
  // Filing schedule fields
  assessment_cycle: string | null;
  assessment_notices_mailed: string | null;
  appeal_window_days: number | null;
  appeal_window_start_month: number | null;
  appeal_window_end_month: number | null;
  appeal_window_end_day: number | null;
  next_appeal_deadline: string | null;
  current_tax_year: number | null;
  // Filing steps and requirements
  filing_steps: { step_number: number; title: string; description: string; url?: string; form_name?: string }[] | null;
  required_documents: string[] | null;
  informal_review_available: boolean;
  informal_review_notes: string | null;
  // Hearing details
  hearing_duration_minutes: number | null;
  hearing_scheduling_notes: string | null;
  virtual_hearing_available: boolean;
  virtual_hearing_platform: string | null;
  // Representation rules
  authorized_rep_allowed: boolean | null;
  authorized_rep_form_url: string | null;
  authorized_rep_types: string[] | null;
  rep_restrictions_notes: string | null;
  // Further appeal / escalation
  further_appeal_body: string | null;
  further_appeal_deadline_rule: string | null;
  further_appeal_url: string | null;
  further_appeal_fee_cents: number;
  // Standard fields
  is_active: boolean;
  last_verified_date: string | null;
  verified_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUser = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  is_super_admin: boolean;
  created_at: string;
};

export type ApprovalEvent = {
  id: string;
  report_id: string;
  admin_user_id: string;
  action: ApprovalAction;
  section_name: string | null;
  notes: string | null;
  created_at: string;
};

export type CalibrationEntry = {
  id: string;
  property_address: string;
  city: string | null;
  state: string | null;
  county: string | null;
  county_fips: string | null;
  property_type: PropertyType;
  building_sqft: number | null;
  lot_size_sqft: number | null;
  year_built: number | null;
  system_concluded_value: number;
  comp_count: number | null;
  median_adjusted_psf: number | null;
  actual_appraised_value: number | null;
  variance_dollars: number | null;
  variance_pct: number | null;
  avg_adj_size: number | null;
  avg_adj_condition: number | null;
  avg_adj_market_trends: number | null;
  avg_adj_land_ratio: number | null;
  avg_net_adjustment: number | null;
  actual_building_sqft: number | null;
  actual_lot_sqft: number | null;
  attom_building_sqft: number | null;
  attom_lot_sqft: number | null;
  sqft_variance_pct: number | null;
  source_report_id: string | null;
  status: string;
  notes: string | null;
  submitted_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type CalibrationParams = {
  id: string;
  property_type: PropertyType;
  county_fips: string | null;
  size_multiplier: number;
  condition_multiplier: number;
  market_trend_multiplier: number;
  land_ratio_multiplier: number;
  value_bias_pct: number;
  sqft_correction_factor: number;
  sqft_sample_size: number;
  sample_size: number;
  mean_absolute_error_pct: number | null;
  median_error_pct: number | null;
  last_computed_at: string;
  created_at: string;
};

// ─── Insert Types (omit server-generated fields) ────────────────────────────

export type ReportInsert = Omit<Report, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type PropertyDataInsert = Omit<PropertyData, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type MeasurementInsert = Omit<Measurement, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type PhotoInsert = Omit<Photo, 'id' | 'uploaded_at'> & {
  id?: string;
  uploaded_at?: string;
};

export type ComparableSaleInsert = Omit<ComparableSale, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ComparableRentalInsert = Omit<ComparableRental, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type IncomeAnalysisInsert = Omit<IncomeAnalysis, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ReportNarrativeInsert = Omit<ReportNarrative, 'id' | 'generated_at'> & {
  id?: string;
  generated_at?: string;
};

export type CountyRuleInsert = Omit<CountyRule, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

export type AdminUserInsert = Omit<AdminUser, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ApprovalEventInsert = Omit<ApprovalEvent, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type CalibrationEntryInsert = Omit<CalibrationEntry, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type CalibrationEntryUpdate = Partial<CalibrationEntry>;

export type CalibrationParamsInsert = Omit<CalibrationParams, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

// ─── Update Types ───────────────────────────────────────────────────────────

export type ReportUpdate = Partial<Report>;
export type PropertyDataUpdate = Partial<PropertyData>;
export type MeasurementUpdate = Partial<Measurement>;
export type PhotoUpdate = Partial<Photo>;
export type ComparableSaleUpdate = Partial<ComparableSale>;
export type IncomeAnalysisUpdate = Partial<IncomeAnalysis>;
export type ReportNarrativeUpdate = Partial<ReportNarrative>;
export type CountyRuleUpdate = Partial<CountyRule>;

// ─── Property Cache ─────────────────────────────────────────────────────────

export type PropertyCache = {
  id: string;
  address_key: string;
  attom_raw: Record<string, unknown>;
  property_type: string | null;
  year_built: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  building_sqft: number | null;
  lot_sqft: number | null;
  stories: number | null;
  assessed_value: number | null;
  tax_amount: number | null;
  assessment_year: number | null;
  county_fips: string | null;
  county_name: string | null;
  created_at: string;
  expires_at: string;
};

export type PropertyCacheInsert = Omit<PropertyCache, 'id' | 'created_at' | 'expires_at'> & {
  id?: string;
  created_at?: string;
  expires_at?: string;
};

export type PropertyCacheUpdate = Partial<PropertyCache>;

// ─── Database Type (Supabase-compatible) ────────────────────────────────────
// Must satisfy GenericSchema from @supabase/postgrest-js which requires:
// - Tables: Record<string, { Row, Insert, Update, Relationships }>
// - Views: Record<string, GenericView>
// - Functions: Record<string, GenericFunction>

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'created_at'> & { created_at?: string };
        Update: Partial<User>;
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: ReportInsert;
        Update: ReportUpdate;
        Relationships: [];
      };
      property_data: {
        Row: PropertyData;
        Insert: PropertyDataInsert;
        Update: PropertyDataUpdate;
        Relationships: [];
      };
      measurements: {
        Row: Measurement;
        Insert: MeasurementInsert;
        Update: MeasurementUpdate;
        Relationships: [];
      };
      photos: {
        Row: Photo;
        Insert: PhotoInsert;
        Update: PhotoUpdate;
        Relationships: [];
      };
      comparable_sales: {
        Row: ComparableSale;
        Insert: ComparableSaleInsert;
        Update: ComparableSaleUpdate;
        Relationships: [];
      };
      comparable_rentals: {
        Row: ComparableRental;
        Insert: ComparableRentalInsert;
        Update: Partial<ComparableRental>;
        Relationships: [];
      };
      income_analysis: {
        Row: IncomeAnalysis;
        Insert: IncomeAnalysisInsert;
        Update: IncomeAnalysisUpdate;
        Relationships: [];
      };
      report_narratives: {
        Row: ReportNarrative;
        Insert: ReportNarrativeInsert;
        Update: ReportNarrativeUpdate;
        Relationships: [];
      };
      county_rules: {
        Row: CountyRule;
        Insert: CountyRuleInsert;
        Update: CountyRuleUpdate;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUser;
        Insert: AdminUserInsert;
        Update: Partial<AdminUser>;
        Relationships: [];
      };
      approval_events: {
        Row: ApprovalEvent;
        Insert: ApprovalEventInsert;
        Update: Partial<ApprovalEvent>;
        Relationships: [];
      };
      calibration_entries: {
        Row: CalibrationEntry;
        Insert: CalibrationEntryInsert;
        Update: CalibrationEntryUpdate;
        Relationships: [];
      };
      calibration_params: {
        Row: CalibrationParams;
        Insert: CalibrationParamsInsert;
        Update: Partial<CalibrationParams>;
        Relationships: [];
      };
      property_cache: {
        Row: PropertyCache;
        Insert: PropertyCacheInsert;
        Update: PropertyCacheUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      report_status: ReportStatus;
      service_type: ServiceType;
      property_type: PropertyType;
      photo_type: PhotoType;
      approval_action: ApprovalAction;
      measurement_source: MeasurementSource;
      review_tier: ReviewTier;
    };
  };
};
