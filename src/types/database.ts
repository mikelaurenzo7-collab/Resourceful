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

export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land';

export type AssessmentMethodology = 'fractional' | 'full_value';

export type PhotoType =
  | 'front_exterior'
  | 'rear_exterior'
  | 'left_exterior'
  | 'right_exterior'
  | 'street_view'
  | 'aerial'
  | 'kitchen'
  | 'living_room'
  | 'master_bedroom'
  | 'bathroom'
  | 'basement'
  | 'garage'
  | 'roof'
  | 'foundation'
  | 'hvac'
  | 'electrical_panel'
  | 'plumbing'
  | 'lot_overview'
  | 'deferred_maintenance'
  | 'other';

export type HearingFormat = 'in_person' | 'virtual' | 'both' | 'written_only';

export type ApprovalAction =
  | 'approved'
  | 'rejected'
  | 'regenerate_section'
  | 'edit_section'
  | 'rerun_pipeline';

export type AssessedValueSource = 'county_api' | 'attom';

export type MeasurementSource = 'google_earth' | 'user_submitted' | 'attom' | 'county';

export type LeaseType = 'NNN' | 'Gross' | 'Modified Gross';

// ─── Table Row Types ─────────────────────────────────────────────────────────
// These types match the database migration exactly (001_initial_schema.sql)
// IMPORTANT: Use `type` instead of `interface` so they extend Record<string, unknown>
// which is required by Supabase's GenericTable constraint.

export type User = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  user_id: string | null;
  service_type: ServiceType | null;
  property_type: PropertyType | null;
  status: ReportStatus;
  property_address: string;
  city: string | null;
  state: string | null;
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
  pipeline_last_completed_stage: number | null;
  pipeline_error_log: Record<string, unknown> | null;
  created_at: string;
  pipeline_started_at: string | null;
  pipeline_completed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  delivered_at: string | null;
};

export type PropertyData = {
  id: string;
  report_id: string;
  assessed_value: number | null;
  assessed_value_source: AssessedValueSource | null;
  market_value_estimate_low: number | null;
  market_value_estimate_high: number | null;
  assessment_ratio: number | null;
  assessment_methodology: AssessmentMethodology | null;
  lot_size_sqft: number | null;
  building_sqft_gross: number | null;
  building_sqft_living_area: number | null;
  year_built: number | null;
  property_class: string | null;
  property_class_description: string | null;
  zoning_designation: string | null;
  zoning_ordinance_citation: string | null;
  zoning_conformance: string | null;
  flood_zone_designation: string | null;
  flood_map_panel_number: string | null;
  flood_map_panel_date: string | null;
  flood_map_panel_effective_date: string | null;
  flood_map_image_storage_path: string | null;
  zoning_map_image_storage_path: string | null;
  tax_year_in_appeal: number | null;
  assessment_history: AssessmentHistoryEntry[] | null;
  deed_history: DeedHistoryEntry[] | null;
  attom_raw_response: Record<string, unknown> | null;
  county_assessor_raw_response: Record<string, unknown> | null;
  fema_raw_response: Record<string, unknown> | null;
  data_collection_notes: string | null;
};

export type AssessmentHistoryEntry = {
  year: number;
  assessed_value: number;
  board_of_review_value?: number | null;
};

export type DeedHistoryEntry = {
  date: string;
  grantor: string;
  grantee: string;
  consideration_amount: number;
  document_number: string;
  recorder_url?: string | null;
};

export type Measurement = {
  id: string;
  report_id: string;
  source: MeasurementSource | null;
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
  sort_order: number | null;
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
  address: string | null;
  sale_price: number | null;
  sale_date: string | null;
  grantor: string | null;
  grantee: string | null;
  deed_document_number: string | null;
  county_recorder_url: string | null;
  building_sqft: number | null;
  price_per_sqft: number | null;
  year_built: number | null;
  property_class: string | null;
  distance_miles: number | null;
  lot_size_sqft: number | null;
  land_to_building_ratio: number | null;
  overhead_door_count: number | null;
  clearance_height_ft: number | null;
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
  net_adjustment_pct: number;
  adjusted_price_per_sqft: number | null;
  is_weak_comparable: boolean;
  comparable_photo_storage_path: string | null;
};

export type ComparableRental = {
  id: string;
  report_id: string;
  address: string | null;
  lease_date: string | null;
  pin: string | null;
  building_sqft_leased: number | null;
  rent_per_sqft_yr: number | null;
  lease_type: LeaseType | null;
  tenant_pays_description: string | null;
  adjustment_notes: string | null;
  effective_net_rent_per_sqft: number | null;
};

export type IncomeAnalysis = {
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
  net_operating_income: number | null;
  expense_ratio_pct: number | null;
  market_vacancy_rate_source: string | null;
  cap_rate_market_low: number | null;
  cap_rate_market_high: number | null;
  cap_rate_investor_survey_avg: number | null;
  concluded_cap_rate: number | null;
  capitalized_value: number | null;
  concluded_value_income_approach: number | null;
  investor_survey_reference: string | null;
};

export type ReportNarrative = {
  id: string;
  report_id: string;
  section_name: string;
  content: string | null;
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
  assessment_ratio_residential: number | null;
  assessment_ratio_commercial: number | null;
  assessment_ratio_industrial: number | null;
  assessment_methodology: AssessmentMethodology | null;
  assessment_methodology_notes: string | null;
  appeal_board_name: string | null;
  appeal_board_address: string | null;
  appeal_board_phone: string | null;
  portal_url: string | null;
  filing_email: string | null;
  accepts_online_filing: boolean;
  accepts_email_filing: boolean;
  requires_mail_filing: boolean;
  state_appeal_board_name: string | null;
  state_appeal_board_url: string | null;
  appeal_deadline_rule: string | null;
  tax_year_appeal_window: string | null;
  typical_resolution_weeks_min: number | null;
  typical_resolution_weeks_max: number | null;
  hearing_typically_required: boolean;
  hearing_format: HearingFormat | null;
  appeal_form_name: string | null;
  form_download_url: string | null;
  evidence_requirements: string[] | null;
  filing_fee_cents: number;
  filing_fee_notes: string | null;
  assessor_api_url: string | null;
  assessor_api_documentation_url: string | null;
  assessor_api_notes: string | null;
  pro_se_tips: string | null;
  is_active: boolean;
  last_verified_date: string | null;
  verified_by: string | null;
  notes: string | null;
};

export type AdminUser = {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  is_super_admin: boolean;
  created_at: string;
};

export type ApprovalEvent = {
  id: string;
  report_id: string;
  admin_user_id: string | null;
  action: ApprovalAction;
  section_name: string | null;
  notes: string | null;
  created_at: string;
};

// ─── Insert Types (omit server-generated fields) ────────────────────────────

export type ReportInsert = Omit<Report, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type PropertyDataInsert = Omit<PropertyData, 'id'> & {
  id?: string;
};

export type MeasurementInsert = Omit<Measurement, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type PhotoInsert = Omit<Photo, 'id' | 'uploaded_at'> & {
  id?: string;
  uploaded_at?: string;
};

export type ComparableSaleInsert = Omit<ComparableSale, 'id'> & {
  id?: string;
};

export type ComparableRentalInsert = Omit<ComparableRental, 'id'> & {
  id?: string;
};

export type IncomeAnalysisInsert = IncomeAnalysis;

export type ReportNarrativeInsert = Omit<ReportNarrative, 'id' | 'generated_at'> & {
  id?: string;
  generated_at?: string;
};

export type CountyRuleInsert = CountyRule;

export type AdminUserInsert = Omit<AdminUser, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ApprovalEventInsert = Omit<ApprovalEvent, 'id' | 'created_at'> & {
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
        Insert: Omit<User, 'id' | 'created_at'> & { id?: string; created_at?: string };
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      report_status: ReportStatus;
      service_type: ServiceType;
      property_type: PropertyType;
      assessment_methodology: AssessmentMethodology;
      photo_type: PhotoType;
      hearing_format: HearingFormat;
      approval_action: ApprovalAction;
      assessed_value_source: AssessedValueSource;
      measurement_source: MeasurementSource;
      lease_type: LeaseType;
    };
  };
};
