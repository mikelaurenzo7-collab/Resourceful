// ─── Zod Validation Schemas ──────────────────────────────────────────────────

import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

const propertyTypeEnum = z.enum(['residential', 'commercial', 'industrial', 'land']);
const serviceTypeEnum = z.enum(['tax_appeal', 'pre_purchase', 'pre_listing']);
const reviewTierEnum = z.enum(['auto', 'expert_reviewed']);
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

// ─── Report Creation ────────────────────────────────────────────────────────

export const reportCreateSchema = z.object({
  client_email: z.string().email('Valid email is required'),
  client_name: z.string().min(1, 'Name is required').optional(),
  property_address: z.string().min(1, 'Property address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be a 2-letter code'),
  county: z.string().min(1, 'County is required'),
  county_fips: z.string().nullable().optional(),
  pin: z.string().optional().nullable(),
  property_type: propertyTypeEnum,
  service_type: serviceTypeEnum,
  review_tier: reviewTierEnum.optional().default('auto'),
  // Onboarding wizard fields
  photos_skipped: z.boolean().optional().default(false),
  property_issues: z.array(z.string()).optional().default([]),
  additional_notes: z.string().optional().default(''),
  desired_outcome: z.string().optional().default(''),
  // Tax bill upload — 15% discount when provided
  has_tax_bill: z.boolean().optional().default(false),
  tax_bill_assessed_value: z.number().positive().nullable().optional(),
  tax_bill_tax_amount: z.number().positive().nullable().optional(),
  tax_bill_tax_year: z.string().nullable().optional(),
  tax_bill_pin: z.string().nullable().optional(),
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

// ─── Photo Annotation (Human-in-the-Loop Review) ───────────────────────────

const defectSeverityEnum = z.enum(['minor', 'moderate', 'significant']);
const defectValueImpactEnum = z.enum(['low', 'medium', 'high']);
const conditionRatingEnum = z.enum(['excellent', 'good', 'average', 'fair', 'poor']);

export const photoDefectSchema = z.object({
  type: z.string().min(1, 'Defect type is required'),
  description: z.string().min(1, 'Description is required'),
  severity: defectSeverityEnum,
  value_impact: defectValueImpactEnum,
  report_language: z.string().min(1, 'Report language is required'),
});

export const photoAnnotationSchema = z.object({
  photo_id: z.string().uuid('Valid photo ID is required'),
  condition_rating: conditionRatingEnum,
  defects: z.array(photoDefectSchema).default([]),
  inferred_direction: z.string().min(1, 'Direction/angle is required'),
  professional_caption: z.string().min(1, 'Professional caption is required'),
  comparable_adjustment_note: z.string().default(''),
});

export const photoReviewSubmissionSchema = z.object({
  annotations: z.array(photoAnnotationSchema).min(1, 'At least one photo annotation is required'),
});

export type PhotoAnnotationInput = z.infer<typeof photoAnnotationSchema>;
export type PhotoReviewSubmissionInput = z.infer<typeof photoReviewSubmissionSchema>;

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
