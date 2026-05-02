// ─── Zod Validation Schemas ──────────────────────────────────────────────────

import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

const propertyTypeEnum = z.enum(['residential', 'commercial', 'industrial', 'land', 'agricultural']);
const serviceTypeEnum = z.enum(['tax_appeal', 'pre_purchase', 'pre_listing']);
const reviewTierEnum = z.enum(['auto', 'expert_reviewed', 'guided_filing', 'full_representation']);
const photoTypeEnum = z.enum([
  'exterior_front', 'exterior_rear',
  'exterior_north', 'exterior_south', 'exterior_east', 'exterior_west',
  'parking_lot', 'driveway', 'yard_landscape', 'drainage', 'loading_area',
  'roof_condition', 'foundation_visible', 'deferred_maintenance', 'environmental_concern',
  'interior_main', 'interior_kitchen', 'interior_bathroom',
  'interior_bedroom', 'interior_living', 'interior_basement',
  'interior_garage', 'interior_warehouse', 'interior_office',
  'overhead_door', 'dock_door', 'clear_height', 'structural_detail',
  'aerial', 'other',
]);
const measurementSourceEnum = z.enum(['google_earth', 'user_submitted', 'attom', 'county']);
const assessmentMethodologyEnum = z.enum(['fractional', 'full_value']);
const hearingFormatEnum = z.enum(['in_person', 'virtual', 'both', 'written_only']);

const nullableRatioSchema = z.number().min(0).max(1).nullable().optional();
const nullableUrlSchema = z.string().url().nullable().optional();
const nullableEmailSchema = z.string().email().nullable().optional();
const nullablePositiveIntSchema = z.number().int().min(0).nullable().optional();
const nullablePercentSchema = z.number().min(0).max(100).nullable().optional();
const nullableDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .nullable()
  .optional();

// ─── Report Creation ────────────────────────────────────────────────────────

export const reportCreateSchema = z.object({
  client_email: z.string().email('Valid email is required').max(254),
  client_name: z.string().min(1, 'Name is required').max(200).optional(),
  property_address: z.string().min(1, 'Property address is required').max(500),
  city: z.string().max(100).default(''),
  state: z.string().max(2).toUpperCase().default(''),
  county: z.string().max(100).default(''),
  county_fips: z.string().regex(/^\d{5}$/, 'FIPS must be 5 digits').or(z.literal('')).nullable().optional(),
  pin: z.string().max(50).optional().nullable(),
  property_type: propertyTypeEnum,
  service_type: serviceTypeEnum,
  review_tier: reviewTierEnum.optional().default('auto'),
  // Onboarding wizard fields
  photos_skipped: z.boolean().optional().default(false),
  property_issues: z.array(z.string().max(200)).max(20).optional().default([]),
  additional_notes: z.string().max(5000).optional().default(''),
  desired_outcome: z.string().max(2000).optional().default(''),
  // Tax bill upload — 15% discount when provided
  has_tax_bill: z.boolean().optional().default(false),
  tax_bill_assessed_value: z.number().positive().nullable().optional(),
  tax_bill_tax_amount: z.number().positive().nullable().optional(),
  tax_bill_tax_year: z.string().regex(/^\d{4}$/, 'Tax year must be 4 digits').or(z.literal('')).nullable().optional(),
  tax_bill_pin: z.string().max(50).nullable().optional(),
  // Referral code (validated server-side)
  referral_code: z.string().max(50).optional(),
}).refine(
  (data) => !data.has_tax_bill || (data.tax_bill_assessed_value != null),
  { message: 'Tax bill assessed value is required when has_tax_bill is true', path: ['tax_bill_assessed_value'] }
);

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

// ─── Measurement ────────────────────────────────────────────────────────────

export const measurementSchema = z.object({
  source: measurementSourceEnum,
  north_wall_ft: z.number().positive().nullable().optional(),
  south_wall_ft: z.number().positive().nullable().optional(),
  east_wall_ft: z.number().positive().nullable().optional(),
  west_wall_ft: z.number().positive().nullable().optional(),
  calculated_footprint_sqft: z.number().positive().nullable().optional(),
  total_living_area_sqft: z.number().positive().nullable().optional(),
  garage_sqft: z.number().min(0).nullable().optional(),
  basement_sqft: z.number().min(0).nullable().optional(),
  basement_finished_sqft: z.number().min(0).nullable().optional(),
  attom_gba_sqft: z.number().positive().nullable().optional(),
  discrepancy_flagged: z.boolean().optional().default(false),
  discrepancy_pct: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type MeasurementInput = z.infer<typeof measurementSchema>;

// ─── Photo Upload ───────────────────────────────────────────────────────────

export const photoUploadSchema = z.object({
  photo_type: photoTypeEnum,
  sort_order: z.number().int().min(0).optional().default(0),
  caption: z.string().nullable().optional(),
});

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;

// ─── Admin Reject ───────────────────────────────────────────────────────────

export const adminRejectSchema = z.object({
  notes: z.string().min(10, 'Rejection notes must be at least 10 characters'),
});

export type AdminRejectInput = z.infer<typeof adminRejectSchema>;

// ─── Admin Regenerate ───────────────────────────────────────────────────────

export const adminRegenerateSchema = z.object({
  section_name: z.string().min(1, 'Section name is required').max(100, 'Section name too long'),
});

export type AdminRegenerateInput = z.infer<typeof adminRegenerateSchema>;

// ─── County Rule ────────────────────────────────────────────────────────────

export const countyRuleSchema = z.object({
  county_fips: z.string().min(1, 'County FIPS code is required'),
  county_name: z.string().min(1, 'County name is required'),
  state_name: z.string().min(1, 'State name is required'),
  state_abbreviation: z.string().length(2, 'State abbreviation must be a 2-letter code'),

  assessment_methodology: assessmentMethodologyEnum.nullable().optional(),
  assessment_ratio_residential: nullableRatioSchema,
  assessment_ratio_commercial: nullableRatioSchema,
  assessment_ratio_industrial: nullableRatioSchema,
  level_of_assessment_commercial: nullableRatioSchema,
  level_of_assessment_residential: nullableRatioSchema,
  cost_approach_disfavored: z.boolean().optional().default(false),
  valuation_date_convention: z.string().nullable().optional(),
  fair_cash_value_synonym: z.boolean().optional().default(false),

  appeal_board_name: z.string().nullable().optional(),
  appeal_board_address: z.string().nullable().optional(),
  appeal_board_phone: z.string().nullable().optional(),
  portal_url: nullableUrlSchema,
  filing_email: nullableEmailSchema,
  accepts_online_filing: z.boolean().optional().default(false),
  accepts_email_filing: z.boolean().optional().default(false),
  requires_mail_filing: z.boolean().optional().default(false),

  state_appeal_board_name: z.string().nullable().optional(),
  state_appeal_board_url: nullableUrlSchema,
  appeal_deadline_rule: z.string().nullable().optional(),
  tax_year_appeal_window: z.string().nullable().optional(),
  typical_resolution_weeks_min: nullablePositiveIntSchema,
  typical_resolution_weeks_max: nullablePositiveIntSchema,
  hearing_typically_required: z.boolean().optional().default(false),
  hearing_format: hearingFormatEnum.nullable().optional(),

  appeal_form_name: z.string().nullable().optional(),
  form_download_url: nullableUrlSchema,
  evidence_requirements: z.array(z.string()).nullable().optional(),
  filing_fee_cents: z.number().int().min(0).optional().default(0),
  filing_fee_notes: z.string().nullable().optional(),

  assessor_api_url: nullableUrlSchema,
  assessor_api_documentation_url: nullableUrlSchema,
  assessor_api_notes: z.string().nullable().optional(),

  pro_se_tips: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
  last_verified_date: nullableDateStringSchema,
  verified_by: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CountyRuleInput = z.infer<typeof countyRuleSchema>;

export const countyAdminSchema = countyRuleSchema.extend({
  county_fips: z.string().regex(/^\d{5}$/, 'County FIPS code must be 5 digits'),
  assessment_methodology_notes: z.string().nullable().optional(),
  assessment_cycle: z.string().nullable().optional(),
  current_tax_year: z.number().int().min(2000).max(2100).nullable().optional(),
  next_appeal_deadline: nullableDateStringSchema,
  appeal_window_days: nullablePositiveIntSchema,
  assessment_notices_mailed: z.string().nullable().optional(),
  required_documents: z.array(z.string()).nullable().optional(),
  informal_review_available: z.boolean().optional().default(false),
  informal_review_notes: z.string().nullable().optional(),
  hearing_duration_minutes: nullablePositiveIntSchema,
  virtual_hearing_available: z.boolean().optional().default(false),
  virtual_hearing_platform: z.string().nullable().optional(),
  hearing_scheduling_notes: z.string().nullable().optional(),
  board_personality_notes: z.string().nullable().optional(),
  winning_argument_patterns: z.string().nullable().optional(),
  common_assessor_errors: z.string().nullable().optional(),
  success_rate_pct: nullablePercentSchema,
  success_rate_source: z.string().nullable().optional(),
  avg_savings_pct: nullablePercentSchema,
  authorized_rep_allowed: z.boolean().nullable().optional(),
  authorized_rep_form_url: nullableUrlSchema,
  authorized_rep_types: z.array(z.string()).nullable().optional(),
  rep_restrictions_notes: z.string().nullable().optional(),
  further_appeal_body: z.string().nullable().optional(),
  further_appeal_url: nullableUrlSchema,
  further_appeal_deadline_rule: z.string().nullable().optional(),
  further_appeal_fee_cents: z.number().int().min(0).optional().default(0),
}).superRefine((data, ctx) => {
  if (
    data.typical_resolution_weeks_min != null &&
    data.typical_resolution_weeks_max != null &&
    data.typical_resolution_weeks_min > data.typical_resolution_weeks_max
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Resolution timeline max must be greater than or equal to min',
      path: ['typical_resolution_weeks_max'],
    });
  }
});

export type CountyAdminInput = z.infer<typeof countyAdminSchema>;
