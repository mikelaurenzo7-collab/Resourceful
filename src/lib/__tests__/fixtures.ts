// ─── Test Fixtures ───────────────────────────────────────────────────────────
// Factory functions that produce valid typed objects for tests.
// Override any field via the `overrides` parameter.

import type {
  Report,
  PropertyData,
  CountyRule,
  ReportNarrative,
  ComparableSale,
  Photo,
} from '@/types/database';

// ─── Report ─────────────────────────────────────────────────────────────────

export function makeReport(overrides?: Partial<Report>): Report {
  return {
    id: 'rpt_test_001',
    user_id: 'test@example.com',
    client_email: 'test@example.com',
    client_name: 'Test User',
    service_type: 'tax_appeal',
    property_type: 'residential',
    status: 'intake',
    property_address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    state_abbreviation: 'IL',
    county: 'Sangamon',
    county_fips: '17167',
    latitude: 39.7817,
    longitude: -89.6501,
    pin: null,
    report_pdf_storage_path: null,
    admin_notes: null,
    stripe_payment_intent_id: null,
    payment_status: null,
    amount_paid_cents: 4900,
    photos_skipped: false,
    property_issues: ['roof_damage', 'outdated_finishes'],
    additional_notes: null,
    desired_outcome: null,
    pipeline_last_completed_stage: null,
    pipeline_error_log: null,
    created_at: '2026-01-15T12:00:00Z',
    pipeline_started_at: null,
    pipeline_completed_at: null,
    approved_at: null,
    approved_by: null,
    delivered_at: null,
    review_tier: 'auto',
    has_tax_bill: false,
    tax_bill_assessed_value: null,
    tax_bill_tax_amount: null,
    tax_bill_tax_year: null,
    filing_status: 'not_started',
    filed_at: null,
    filing_method: null,
    appeal_outcome: null,
    savings_amount_cents: null,
    attom_cache_id: null,
    pipeline_locked_at: null,
    pipeline_lock_owner: null,
    ...overrides,
  };
}

// ─── PropertyData ───────────────────────────────────────────────────────────

export function makePropertyData(overrides?: Partial<PropertyData>): PropertyData {
  return {
    id: 'pd_test_001',
    report_id: 'rpt_test_001',
    assessed_value: 250000,
    assessed_value_source: 'attom',
    market_value_estimate_low: 200000,
    market_value_estimate_high: 280000,
    assessment_ratio: 0.333,
    assessment_methodology: 'fractional',
    lot_size_sqft: 8000,
    building_sqft_gross: 1800,
    building_sqft_living_area: 1600,
    year_built: 1995,
    effective_age: 20,
    remaining_economic_life: 40,
    property_class: 'R1',
    property_class_description: 'Single Family Residence',
    construction_type: 'Frame',
    roof_type: 'Asphalt Shingle',
    exterior_finish: 'Vinyl Siding',
    foundation_type: 'Poured Concrete',
    hvac_type: 'Central Air',
    plumbing_description: null,
    sprinkler_system: false,
    number_of_stories: 2,
    bedroom_count: 3,
    full_bath_count: 2,
    half_bath_count: 1,
    garage_sqft: 400,
    garage_spaces: 2,
    basement_sqft: 800,
    basement_finished_sqft: 400,
    overhead_door_count: null,
    dock_door_count: null,
    clear_height_ft: null,
    overall_condition: 'average',
    condition_notes: null,
    zoning_designation: 'R-1',
    zoning_ordinance_citation: null,
    zoning_conformance: 'conforming',
    flood_zone_designation: 'X',
    flood_map_panel_number: null,
    flood_map_panel_date: null,
    flood_map_image_storage_path: null,
    regional_map_url: null,
    neighborhood_map_url: null,
    parcel_map_url: null,
    zoning_map_image_storage_path: null,
    tax_year_in_appeal: 2025,
    assessment_history: null,
    deed_history: null,
    attom_raw_response: null,
    county_assessor_raw_response: null,
    fema_raw_response: null,
    data_collection_notes: null,
    concluded_value: 230000,
    concluded_value_without_photos: 240000,
    photo_impact_dollars: -10000,
    photo_impact_pct: -4.2,
    photo_condition_adjustment_pct: -3.0,
    photo_defect_count: 2,
    photo_defect_count_significant: 1,
    photo_count: 5,
    created_at: '2026-01-15T12:05:00Z',
    ...overrides,
  };
}

// ─── CountyRule ─────────────────────────────────────────────────────────────

export function makeCountyRule(overrides?: Partial<CountyRule>): CountyRule {
  return {
    county_fips: '17167',
    county_name: 'Sangamon',
    state_name: 'Illinois',
    state_abbreviation: 'IL',
    assessment_ratio_residential: 0.333,
    assessment_ratio_commercial: 0.333,
    assessment_ratio_industrial: 0.333,
    assessment_methodology: 'fractional',
    assessment_methodology_notes: null,
    appeal_board_name: 'Sangamon County Board of Review',
    appeal_board_address: '200 S 9th St, Springfield, IL 62701',
    appeal_board_phone: '(217) 753-6800',
    portal_url: null,
    filing_email: null,
    accepts_online_filing: false,
    accepts_email_filing: false,
    requires_mail_filing: true,
    state_appeal_board_name: 'Illinois Property Tax Appeal Board',
    state_appeal_board_url: null,
    appeal_deadline_rule: '30 days from publication of assessment',
    tax_year_appeal_window: null,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
    hearing_typically_required: true,
    hearing_format: 'in_person',
    appeal_form_name: 'Assessment Complaint Form',
    form_download_url: null,
    evidence_requirements: null,
    filing_fee_cents: 0,
    filing_fee_notes: null,
    assessor_api_url: null,
    assessor_api_documentation_url: null,
    assessor_api_notes: null,
    pro_se_tips: 'Bring 3 comparable sales within 1 mile. The board expects printed copies.',
    assessment_cycle: 'quadrennial',
    assessment_notices_mailed: 'June',
    appeal_window_days: 30,
    appeal_window_start_month: 6,
    appeal_window_end_month: 7,
    appeal_window_end_day: 31,
    next_appeal_deadline: '2026-07-31',
    current_tax_year: 2025,
    filing_steps: null,
    required_documents: ['Assessment Complaint Form', 'Comparable Sales Evidence'],
    informal_review_available: true,
    informal_review_notes: null,
    hearing_duration_minutes: 15,
    hearing_scheduling_notes: null,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    authorized_rep_allowed: true,
    authorized_rep_form_url: null,
    authorized_rep_types: ['tax_consultant', 'appraiser', 'cpa'],
    rep_restrictions_notes: null,
    further_appeal_body: 'Illinois Property Tax Appeal Board',
    further_appeal_deadline_rule: '30 days from Board of Review decision',
    further_appeal_url: null,
    further_appeal_fee_cents: 0,
    is_active: true,
    last_verified_date: '2026-01-01',
    verified_by: null,
    notes: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Stripe Mocks ───────────────────────────────────────────────────────────

export function makeStripePaymentIntent(overrides?: Record<string, unknown>) {
  return {
    id: 'pi_test_001',
    amount: 4900,
    currency: 'usd',
    status: 'succeeded',
    client_secret: 'pi_test_001_secret_abc',
    receipt_email: 'test@example.com',
    metadata: {
      report_id: 'rpt_test_001',
      service_type: 'tax_appeal',
      property_type: 'residential',
    },
    ...overrides,
  };
}

export function makeStripeWebhookEvent(
  type: string = 'payment_intent.succeeded',
  data?: Record<string, unknown>
) {
  return {
    id: 'evt_test_001',
    type,
    data: {
      object: makeStripePaymentIntent(data),
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    api_version: '2024-12-18',
  };
}

// ─── Narrative ──────────────────────────────────────────────────────────────

export function makeNarrative(overrides?: Partial<ReportNarrative>): ReportNarrative {
  return {
    id: 'nar_test_001',
    report_id: 'rpt_test_001',
    section_name: 'executive_summary',
    content: 'The subject property at 123 Main St is over-assessed based on comparable sales analysis.',
    generated_at: '2026-01-15T12:10:00Z',
    model_used: 'claude-sonnet-4-20250514',
    prompt_tokens: 2000,
    completion_tokens: 500,
    generation_duration_ms: 3200,
    admin_edited: false,
    admin_edited_content: null,
    ...overrides,
  };
}

// ─── ComparableSale ─────────────────────────────────────────────────────────

export function makeComparableSale(overrides?: Partial<ComparableSale>): ComparableSale {
  return {
    id: 'comp_test_001',
    report_id: 'rpt_test_001',
    address: '456 Oak Ave, Springfield, IL 62701',
    sale_price: 225000,
    sale_date: '2025-09-15',
    grantor: null,
    grantee: null,
    deed_document_number: null,
    county_recorder_url: null,
    building_sqft: 1750,
    price_per_sqft: 128.57,
    year_built: 1998,
    property_class: 'R1',
    lot_size_sqft: 7500,
    land_to_building_ratio: 4.29,
    overhead_door_count: null,
    clearance_height_ft: null,
    distance_miles: 0.4,
    condition_notes: null,
    adjustment_pct_property_rights: 0,
    adjustment_pct_financing_terms: 0,
    adjustment_pct_conditions_of_sale: 0,
    adjustment_pct_market_trends: 1.5,
    adjustment_pct_location: 0,
    adjustment_pct_size: -2.0,
    adjustment_pct_land_to_building: 0,
    adjustment_pct_condition: -3.0,
    adjustment_pct_other: 0,
    net_adjustment_pct: -3.5,
    adjusted_price_per_sqft: 124.07,
    is_weak_comparable: false,
    comparable_photo_url: null,
    created_at: '2026-01-15T12:06:00Z',
    ...overrides,
  };
}

// ─── Photo ──────────────────────────────────────────────────────────────────

export function makePhoto(overrides?: Partial<Photo>): Photo {
  return {
    id: 'photo_test_001',
    report_id: 'rpt_test_001',
    storage_path: 'reports/rpt_test_001/photos/exterior_front.jpg',
    photo_type: 'exterior_front',
    ai_analysis: {
      condition_rating: 'average',
      defects: [],
      inferred_direction: 'front',
      professional_caption: 'Front exterior view of subject property.',
      comparable_adjustment_note: 'Average condition consistent with neighborhood.',
    },
    caption: null,
    sort_order: 0,
    uploaded_at: '2026-01-15T12:04:00Z',
    ...overrides,
  };
}
