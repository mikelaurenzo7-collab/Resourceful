// ─── Zod Validation Schemas ──────────────────────────────────────────────────

import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

const propertyTypeEnum = z.enum(['residential', 'commercial', 'industrial', 'land']);
const serviceTypeEnum = z.enum(['tax_appeal', 'pre_purchase', 'pre_listing']);
const photoTypeEnum = z.enum([
  'front_exterior',
  'rear_exterior',
  'left_exterior',
  'right_exterior',
  'street_view',
  'aerial',
  'kitchen',
  'living_room',
  'master_bedroom',
  'bathroom',
  'basement',
  'garage',
  'roof',
  'foundation',
  'hvac',
  'electrical_panel',
  'plumbing',
  'lot_overview',
  'deferred_maintenance',
  'other',
]);
const measurementSourceEnum = z.enum(['google_earth', 'user_submitted', 'attom', 'county']);
const assessmentMethodologyEnum = z.enum(['fractional', 'full_value']);
const hearingFormatEnum = z.enum(['in_person', 'virtual', 'both', 'written_only']);

// ─── Report Creation ────────────────────────────────────────────────────────

export const reportCreateSchema = z.object({
  property_address: z.string().min(1, 'Property address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be a 2-letter code'),
  county: z.string().min(1, 'County is required'),
  county_fips: z.string().nullable().optional(),
  pin: z.string().optional().nullable(),
  property_type: propertyTypeEnum,
  service_type: serviceTypeEnum,
});

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
  section_name: z.string().min(1, 'Section name is required'),
});

export type AdminRegenerateInput = z.infer<typeof adminRegenerateSchema>;

// ─── County Rule ────────────────────────────────────────────────────────────

export const countyRuleSchema = z.object({
  county_fips: z.string().min(1, 'County FIPS code is required'),
  county_name: z.string().min(1, 'County name is required'),
  state_name: z.string().min(1, 'State name is required'),
  state_abbreviation: z.string().length(2, 'State abbreviation must be a 2-letter code'),

  assessment_methodology: assessmentMethodologyEnum.nullable().optional(),
  assessment_ratio_residential: z.number().min(0).max(1).nullable().optional(),
  assessment_ratio_commercial: z.number().min(0).max(1).nullable().optional(),
  assessment_ratio_industrial: z.number().min(0).max(1).nullable().optional(),

  appeal_board_name: z.string().nullable().optional(),
  appeal_board_address: z.string().nullable().optional(),
  appeal_board_phone: z.string().nullable().optional(),
  portal_url: z.string().url().nullable().optional(),
  filing_email: z.string().email().nullable().optional(),
  accepts_online_filing: z.boolean().optional().default(false),
  accepts_email_filing: z.boolean().optional().default(false),
  requires_mail_filing: z.boolean().optional().default(false),

  state_appeal_board_name: z.string().nullable().optional(),
  state_appeal_board_url: z.string().url().nullable().optional(),
  appeal_deadline_rule: z.string().nullable().optional(),
  tax_year_appeal_window: z.string().nullable().optional(),
  typical_resolution_weeks_min: z.number().int().positive().nullable().optional(),
  typical_resolution_weeks_max: z.number().int().positive().nullable().optional(),
  hearing_typically_required: z.boolean().optional().default(false),
  hearing_format: hearingFormatEnum.nullable().optional(),

  appeal_form_name: z.string().nullable().optional(),
  form_download_url: z.string().url().nullable().optional(),
  evidence_requirements: z.array(z.string()).nullable().optional(),
  filing_fee_cents: z.number().int().min(0).optional().default(0),
  filing_fee_notes: z.string().nullable().optional(),

  assessor_api_url: z.string().url().nullable().optional(),
  assessor_api_documentation_url: z.string().url().nullable().optional(),
  assessor_api_notes: z.string().nullable().optional(),

  pro_se_tips: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
  last_verified_date: z.string().nullable().optional(),
  verified_by: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CountyRuleInput = z.infer<typeof countyRuleSchema>;
