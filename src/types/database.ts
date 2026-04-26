// ─── Enum Types ──────────────────────────────────────────────────────────────

export type ReportStatus =
  | 'intake'
  | 'paid'
  | 'data_pull'
  | 'photo_pending'
  | 'processing'
  | 'pending_approval'
  | 'approved'
  | 'delivering'
  | 'delivered'
  | 'rejected'
  | 'failed';

export type ServiceType = 'tax_appeal' | 'pre_purchase' | 'pre_listing';

export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land' | 'agricultural';

export type PhotoType =
  | 'exterior_front' | 'exterior_rear'
  | 'exterior_north' | 'exterior_south' | 'exterior_east' | 'exterior_west'
  | 'parking_lot' | 'driveway' | 'yard_landscape' | 'drainage' | 'loading_area'
  | 'roof_condition' | 'foundation_visible' | 'deferred_maintenance' | 'environmental_concern'
  | 'interior_main' | 'interior_kitchen' | 'interior_bathroom'
  | 'interior_bedroom' | 'interior_living' | 'interior_basement'
  | 'interior_garage' | 'interior_warehouse' | 'interior_office'
  | 'overhead_door' | 'dock_door' | 'clear_height' | 'structural_detail'
  | 'aerial' | 'other';

export type ApprovalAction =
  | 'approved'
  | 'rejected'
  | 'edit_section'
  | 'regenerate_section'
  | 'rerun_pipeline'
  | 'hold_for_review';

export type MeasurementSource = 'google_earth' | 'user_submitted' | 'attom' | 'county';

export type ReviewTier = 'auto' | 'expert_reviewed' | 'guided_filing' | 'full_representation';

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
  // Case intelligence — strength score and two-way analysis (migration 009)
  case_strength_score: number | null;
  case_value_at_stake: number | null;
  is_underassessed: boolean;
  underassessment_pct: number | null;
  // Appeal outcome tracking
  appeal_outcome_details: Record<string, unknown> | null;
  outcome_reported_at: string | null;
  actual_savings_cents: number | null;
  outcome_notes: string | null;
  // Referral & API partner fields (migrations 012, 013)
  referral_code_id: string | null;
  referral_discount_cents: number;
  api_partner_id: string | null;
  is_white_label: boolean;
  // Dashboard-first delivery & outcome follow-up (migration 017)
  email_delivery_preference: boolean;
  outcome_followup_sent_at: string | null;
  outcome_followup_token: string | null;
  // Abandoned cart recovery (migration 021)
  recovery_email_sent_at: string | null;
  // Notification tracking (migration 022)
  notification_sent_at: string | null;
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
  // Valuation intelligence — depreciation and subtype (migration 009)
  property_subtype: string | null;
  physical_depreciation_pct: number | null;
  effective_age_source: string | null;
  // Cost approach inputs and outputs (migration 010)
  land_value: number | null;                    // assessor's split land value (from ATTOM)
  quality_grade: string | null;                 // 'economy' | 'average' | 'good' | 'excellent' | 'luxury'
  cost_approach_rcn: number | null;             // replacement cost new (building only)
  cost_approach_value: number | null;           // RCN × (1 − depr%) + land_value
  functional_obsolescence_pct: number | null;   // incurable super-adequacy %
  functional_obsolescence_notes: string | null; // explanation of functional obsolescence
  // Photo value attribution — tracks exactly how much photos moved the needle
  concluded_value: number | null;
  concluded_value_without_photos: number | null;
  photo_impact_dollars: number | null;
  photo_impact_pct: number | null;
  photo_condition_adjustment_pct: number | null;
  photo_defect_count: number;
  photo_defect_count_significant: number;
  photo_count: number;
  // Income confidence and data quality (migration 019)
  valuation_method: string | null;
  comp_count: number | null;
  // Regrid parcel intelligence (migration 022)
  parcel_boundary_geojson: Record<string, unknown> | null;
  lot_frontage_ft: number | null;
  lot_depth_ft: number | null;
  lot_shape_description: string | null;
  legal_description: string | null;
  owner_name: string | null;
  owner_mailing_address: string | null;
  zoning_description: string | null;
  zoning_overlay_district: string | null;
  apn: string | null;
  regrid_parcel_id: string | null;
  parcel_data_source: string | null;
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
  // Arms-length screening and effective age (migration 009)
  is_distressed_sale: boolean;
  sale_condition_notes: string | null;
  comp_effective_age: number | null;
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
  rental_comp_confidence: 'low' | 'medium' | 'high' | 'none' | null;
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
  assessment_ratio_agricultural: number | null;
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
  // Board intelligence & strategy
  board_personality_notes: string | null;
  winning_argument_patterns: string | null;
  common_assessor_errors: string | null;
  success_rate_pct: number | null;
  success_rate_source: string | null;
  avg_savings_pct: number | null;
  // Per-county land-to-value ratio overrides (nullable — falls back to IAAO national constant when null)
  land_ratio_residential: number | null;
  land_ratio_commercial: number | null;
  land_ratio_industrial: number | null;

  // Cook County enrichment fields
  level_of_assessment_commercial?: number | null;
  level_of_assessment_residential?: number | null;
  cost_approach_disfavored?: boolean | null;
  valuation_date_convention?: string | null;
  fair_cash_value_synonym?: boolean | null;

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

// ─── Attorney Network ─────────────────────────────────────────────────────────

export type Attorney = {
  id: string;
  firm_name: string;
  attorney_name: string;
  email: string;
  phone: string | null;
  states: string[];
  counties_fips: string[] | null;
  property_types: string[];
  service_types: string[];
  contingency_fee_pct: number;
  min_case_value_dollars: number;
  max_active_cases: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AttorneyReferral = {
  id: string;
  report_id: string;
  attorney_id: string;
  case_strength_score: number;
  case_value_at_stake: number;
  referral_status: string;
  accepted_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  outcome: string | null;
  savings_amount_cents: number | null;
  revenue_share_cents: number | null;
  created_at: string;
  updated_at: string;
};

export type AttorneyReferralInsert = {
  report_id: string;
  attorney_id: string;
  case_strength_score: number;
  case_value_at_stake: number;
  referral_status?: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  declined_reason?: string | null;
  outcome?: string | null;
  savings_amount_cents?: number | null;
  revenue_share_cents?: number | null;
};

// ─── Referral Codes ──────────────────────────────────────────────────────
export type ReferralCode = {
  id: string;
  code: string;
  referrer_email: string;
  referrer_name: string | null;
  discount_pct: number;
  referrer_credit_cents: number;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

// ─── Reminder Subscriptions ──────────────────────────────────────────────
export type ReminderSubscription = {
  id: string;
  email: string;
  client_name: string | null;
  property_address: string;
  city: string | null;
  state: string | null;
  county: string | null;
  county_fips: string | null;
  remind_month: number;
  remind_day: number;
  last_reminded_at: string | null;
  last_reminded_year: number | null;
  is_active: boolean;
  source_report_id: string | null;
  created_at: string;
};

// ─── API Partners ────────────────────────────────────────────────────────
export type ApiPartner = {
  id: string;
  firm_name: string;
  contact_email: string;
  contact_name: string | null;
  api_key: string;
  api_key_prefix: string;
  is_active: boolean;
  revenue_share_pct: number;
  per_report_fee_cents: number;
  white_label_name: string | null;
  white_label_logo_url: string | null;
  monthly_report_limit: number | null;
  reports_this_month: number;
  total_reports_generated: number;
  total_revenue_cents: number;
  created_at: string;
  updated_at: string;
};

// ─── Form Submissions ─────────────────────────────────────────────────────────

export type FormSubmission = {
  id: string;
  report_id: string;
  county_fips: string;
  submission_method: string; // 'online' | 'email' | 'mail' | 'in_person'
  portal_url: string | null;
  submission_status: string; // 'prefill_ready' | 'submitted' | 'confirmed'
  prefill_data: Record<string, unknown> | null;
  submitted_at: string | null;
  confirmation_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Insert Types (omit server-generated fields) ────────────────────────────

export type ReportInsert = Omit<Report, 'id' | 'created_at' | 'case_strength_score' | 'case_value_at_stake' | 'is_underassessed' | 'underassessment_pct' | 'appeal_outcome_details' | 'outcome_reported_at' | 'actual_savings_cents' | 'outcome_notes' | 'referral_code_id' | 'referral_discount_cents' | 'api_partner_id' | 'is_white_label' | 'email_delivery_preference' | 'outcome_followup_sent_at' | 'outcome_followup_token' | 'recovery_email_sent_at' | 'notification_sent_at'> & {
  id?: string;
  created_at?: string;
  // Computed by Stage 5 — not needed at creation time; DB defaults apply
  case_strength_score?: number | null;
  case_value_at_stake?: number | null;
  is_underassessed?: boolean;
  underassessment_pct?: number | null;
  // Appeal outcome tracking — populated after appeal resolution
  appeal_outcome_details?: Record<string, unknown> | null;
  outcome_reported_at?: string | null;
  actual_savings_cents?: number | null;
  outcome_notes?: string | null;
  // Referral & API partner — DB defaults apply
  referral_code_id?: string | null;
  referral_discount_cents?: number;
  api_partner_id?: string | null;
  is_white_label?: boolean;
  // Dashboard-first delivery — DB defaults apply
  email_delivery_preference?: boolean;
  outcome_followup_sent_at?: string | null;
  outcome_followup_token?: string | null;
  // Cart recovery — DB default null
  recovery_email_sent_at?: string | null;
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

export type ComparableSaleInsert = Omit<ComparableSale, 'id' | 'created_at' | 'is_distressed_sale'> & {
  id?: string;
  created_at?: string;
  // DB default false; explicitly set by Stage 2 arms-length screening
  is_distressed_sale?: boolean;
};

export type ComparableRentalInsert = Omit<ComparableRental, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type IncomeAnalysisInsert = Omit<IncomeAnalysis, 'id' | 'created_at' | 'rental_comp_confidence'> & {
  id?: string;
  created_at?: string;
  rental_comp_confidence?: 'low' | 'medium' | 'high' | 'none' | null;
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

export type AttorneyInsert = Omit<Attorney, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type FormSubmissionInsert = {
  report_id: string;
  county_fips: string;
  submission_method: string;
  portal_url?: string | null;
  submission_status?: string;
  prefill_data?: Record<string, unknown> | null;
  submitted_at?: string | null;
  confirmation_number?: string | null;
  notes?: string | null;
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
      attorneys: {
        Row: Attorney;
        Insert: AttorneyInsert;
        Update: Partial<Attorney>;
        Relationships: [];
      };
      attorney_referrals: {
        Row: AttorneyReferral;
        Insert: AttorneyReferralInsert;
        Update: Partial<AttorneyReferral>;
        Relationships: [];
      };
      form_submissions: {
        Row: FormSubmission;
        Insert: FormSubmissionInsert;
        Update: Partial<FormSubmission>;
        Relationships: [];
      };
      referral_codes: {
        Row: ReferralCode;
        Insert: Omit<ReferralCode, 'id' | 'created_at' | 'times_used'> & {
          id?: string;
          created_at?: string;
          times_used?: number;
        };
        Update: Partial<ReferralCode>;
        Relationships: [];
      };
      reminder_subscriptions: {
        Row: ReminderSubscription;
        Insert: Omit<ReminderSubscription, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ReminderSubscription>;
        Relationships: [];
      };
      api_partners: {
        Row: ApiPartner;
        Insert: Omit<ApiPartner, 'id' | 'created_at' | 'updated_at' | 'reports_this_month' | 'total_reports_generated' | 'total_revenue_cents'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          reports_this_month?: number;
          total_reports_generated?: number;
          total_revenue_cents?: number;
        };
        Update: Partial<ApiPartner>;
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
