// ─── County Rules Seed Script ────────────────────────────────────────────────
// Seeds county_rules for every county in every US state.
//
// State-level assessment data (ratios, methodology, appeal rules) is applied
// to all counties in that state. County-specific details (portal URLs, board
// phone numbers) can be filled in manually via the admin dashboard later.
//
// Usage: npx tsx scripts/seed-county-rules.ts
//
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── State-Level Assessment Rules ──────────────────────────────────────────
// Sources: IAAO, state statutes, state department of revenue websites
// Assessment ratios and methodology are set by state law in most states.

interface StateConfig {
  state_name: string;
  state_abbreviation: string;
  assessment_methodology: 'fractional' | 'full_value';
  assessment_ratio_residential: number;
  assessment_ratio_commercial: number;
  assessment_ratio_industrial: number;
  appeal_deadline_rule: string;
  state_appeal_board_name: string;
  state_appeal_board_url: string | null;
  hearing_format: 'in_person' | 'virtual' | 'both' | 'written_only';
  hearing_typically_required: boolean;
  typical_resolution_weeks_min: number;
  typical_resolution_weeks_max: number;
}

const STATE_CONFIGS: Record<string, StateConfig> = {
  AL: {
    state_name: 'Alabama',
    state_abbreviation: 'AL',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.10,
    assessment_ratio_commercial: 0.20,
    assessment_ratio_industrial: 0.20,
    appeal_deadline_rule: 'Within 30 days of notice of assessment',
    state_appeal_board_name: 'Alabama Department of Revenue, Property Tax Division',
    state_appeal_board_url: 'https://revenue.alabama.gov/property-tax/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  AK: {
    state_name: 'Alaska',
    state_abbreviation: 'AK',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 30 days of assessment notice, typically by April 15',
    state_appeal_board_name: 'Board of Equalization',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 8,
  },
  AZ: {
    state_name: 'Arizona',
    state_abbreviation: 'AZ',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.10,
    assessment_ratio_commercial: 0.18,
    assessment_ratio_industrial: 0.18,
    appeal_deadline_rule: 'Within 60 days of notice of value, typically by April 17',
    state_appeal_board_name: 'County Board of Equalization / State Board of Tax Appeals',
    state_appeal_board_url: 'https://sbta.state.az.us/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 16,
  },
  AR: {
    state_name: 'Arkansas',
    state_abbreviation: 'AR',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.20,
    assessment_ratio_commercial: 0.20,
    assessment_ratio_industrial: 0.20,
    appeal_deadline_rule: 'Third Monday of August through October equalization period',
    state_appeal_board_name: 'County Equalization Board',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 10,
  },
  CA: {
    state_name: 'California',
    state_abbreviation: 'CA',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'July 2 through September 15 (or November 30 if notice mailed after July 1)',
    state_appeal_board_name: 'Assessment Appeals Board',
    state_appeal_board_url: 'https://www.boe.ca.gov/proptaxes/faqs/assessmentappeal.htm',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 12,
    typical_resolution_weeks_max: 52,
  },
  CO: {
    state_name: 'Colorado',
    state_abbreviation: 'CO',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.0655,
    assessment_ratio_commercial: 0.29,
    assessment_ratio_industrial: 0.29,
    appeal_deadline_rule: 'May 1 through June 1 (odd-numbered years for residential)',
    state_appeal_board_name: 'County Board of Equalization / Board of Assessment Appeals',
    state_appeal_board_url: 'https://dola.colorado.gov/baa/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  CT: {
    state_name: 'Connecticut',
    state_abbreviation: 'CT',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.70,
    assessment_ratio_commercial: 0.70,
    assessment_ratio_industrial: 0.70,
    appeal_deadline_rule: 'February 20 following the October 1 Grand List date',
    state_appeal_board_name: 'Board of Assessment Appeals',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  DE: {
    state_name: 'Delaware',
    state_abbreviation: 'DE',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Varies by county — typically within 30 days of assessment notice',
    state_appeal_board_name: 'Board of Assessment Review',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 10,
  },
  FL: {
    state_name: 'Florida',
    state_abbreviation: 'FL',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 25 days of TRIM notice (typically August-September)',
    state_appeal_board_name: 'Value Adjustment Board (VAB)',
    state_appeal_board_url: 'https://floridarevenue.com/property/Pages/Taxpayers.aspx',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 20,
  },
  GA: {
    state_name: 'Georgia',
    state_abbreviation: 'GA',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.40,
    assessment_ratio_commercial: 0.40,
    assessment_ratio_industrial: 0.40,
    appeal_deadline_rule: 'Within 45 days of notice of assessment',
    state_appeal_board_name: 'Board of Tax Assessors / Board of Equalization',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 16,
  },
  HI: {
    state_name: 'Hawaii',
    state_abbreviation: 'HI',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 90 days of assessment notice (varies by county)',
    state_appeal_board_name: 'Board of Review / Tax Appeal Court',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 24,
  },
  ID: {
    state_name: 'Idaho',
    state_abbreviation: 'ID',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Fourth Monday of June (county) or by late January (state)',
    state_appeal_board_name: 'County Board of Equalization / Idaho Board of Tax Appeals',
    state_appeal_board_url: 'https://bta.idaho.gov/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  IL: {
    state_name: 'Illinois',
    state_abbreviation: 'IL',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.333,
    assessment_ratio_commercial: 0.333,
    assessment_ratio_industrial: 0.333,
    appeal_deadline_rule: '30 days from publication of assessment (varies by county, typically August-October)',
    state_appeal_board_name: 'Board of Review / Illinois Property Tax Appeal Board',
    state_appeal_board_url: 'https://ptab.illinois.gov/',
    hearing_format: 'both',
    hearing_typically_required: false,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 52,
  },
  IN: {
    state_name: 'Indiana',
    state_abbreviation: 'IN',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 45 days of notice (Form 130 or 131)',
    state_appeal_board_name: 'County Property Tax Assessment Board of Appeals (PTABOA)',
    state_appeal_board_url: 'https://www.in.gov/ibtr/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 20,
  },
  IA: {
    state_name: 'Iowa',
    state_abbreviation: 'IA',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'April 2 through April 30 (odd-numbered years)',
    state_appeal_board_name: 'Board of Review / Property Assessment Appeal Board',
    state_appeal_board_url: 'https://paab.iowa.gov/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  KS: {
    state_name: 'Kansas',
    state_abbreviation: 'KS',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.115,
    assessment_ratio_commercial: 0.25,
    assessment_ratio_industrial: 0.25,
    appeal_deadline_rule: 'Within 30 days of notice (typically March)',
    state_appeal_board_name: 'County Board of Tax Appeals / Board of Tax Appeals',
    state_appeal_board_url: 'https://www.kansas.gov/bota/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 20,
  },
  KY: {
    state_name: 'Kentucky',
    state_abbreviation: 'KY',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 1 year of January 1 assessment date',
    state_appeal_board_name: 'Board of Assessment Appeals / Kentucky Board of Tax Appeals',
    state_appeal_board_url: 'https://revenue.ky.gov/Property/Pages/default.aspx',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  LA: {
    state_name: 'Louisiana',
    state_abbreviation: 'LA',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.10,
    assessment_ratio_commercial: 0.15,
    assessment_ratio_industrial: 0.15,
    appeal_deadline_rule: 'Within 15 calendar days after public notice of rolls (typically August-September)',
    state_appeal_board_name: 'Board of Review / Louisiana Tax Commission',
    state_appeal_board_url: 'https://www.latax.state.la.us/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  ME: {
    state_name: 'Maine',
    state_abbreviation: 'ME',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 185 days of tax commitment date (typically by February 1)',
    state_appeal_board_name: 'Board of Assessment Review / State Board of Property Tax Review',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 16,
  },
  MD: {
    state_name: 'Maryland',
    state_abbreviation: 'MD',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 45 days of assessment notice (triennial cycle)',
    state_appeal_board_name: 'Supervisor of Assessments / Maryland Tax Court',
    state_appeal_board_url: 'https://dat.maryland.gov/Pages/default.aspx',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 24,
  },
  MA: {
    state_name: 'Massachusetts',
    state_abbreviation: 'MA',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 3 months of actual tax bill mailing (typically by February 1)',
    state_appeal_board_name: 'Board of Assessors / Appellate Tax Board',
    state_appeal_board_url: 'https://www.mass.gov/orgs/appellate-tax-board',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 52,
  },
  MI: {
    state_name: 'Michigan',
    state_abbreviation: 'MI',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.50,
    assessment_ratio_commercial: 0.50,
    assessment_ratio_industrial: 0.50,
    appeal_deadline_rule: 'Board of Review meets in March (first two weeks); deadline varies by municipality',
    state_appeal_board_name: 'Board of Review / Michigan Tax Tribunal',
    state_appeal_board_url: 'https://www.michigan.gov/taxtrib',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 52,
  },
  MN: {
    state_name: 'Minnesota',
    state_abbreviation: 'MN',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Open Book meeting (April), then Board of Appeal and Equalization (June)',
    state_appeal_board_name: 'Board of Appeal and Equalization / Minnesota Tax Court',
    state_appeal_board_url: 'https://mn.gov/tax-court/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 24,
  },
  MS: {
    state_name: 'Mississippi',
    state_abbreviation: 'MS',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.10,
    assessment_ratio_commercial: 0.15,
    assessment_ratio_industrial: 0.15,
    appeal_deadline_rule: 'Within 15 days of assessment notice (typically April)',
    state_appeal_board_name: 'Board of Supervisors / Mississippi Board of Tax Appeals',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  MO: {
    state_name: 'Missouri',
    state_abbreviation: 'MO',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.19,
    assessment_ratio_commercial: 0.32,
    assessment_ratio_industrial: 0.32,
    appeal_deadline_rule: 'Before the Board of Equalization meets (typically July, odd-numbered years)',
    state_appeal_board_name: 'Board of Equalization / State Tax Commission',
    state_appeal_board_url: 'https://stc.mo.gov/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 24,
  },
  MT: {
    state_name: 'Montana',
    state_abbreviation: 'MT',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 30 days of classification/appraisal notice (biennial cycle)',
    state_appeal_board_name: 'County Tax Appeal Board / Montana State Tax Appeal Board',
    state_appeal_board_url: 'https://mtab.mt.gov/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  NE: {
    state_name: 'Nebraska',
    state_abbreviation: 'NE',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'June 1 through June 30 to County Board of Equalization',
    state_appeal_board_name: 'County Board of Equalization / Tax Equalization and Review Commission',
    state_appeal_board_url: 'https://revenue.nebraska.gov/PAD',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  NV: {
    state_name: 'Nevada',
    state_abbreviation: 'NV',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.35,
    assessment_ratio_commercial: 0.35,
    assessment_ratio_industrial: 0.35,
    appeal_deadline_rule: 'January 15 to County Board of Equalization',
    state_appeal_board_name: 'County Board of Equalization / State Board of Equalization',
    state_appeal_board_url: 'https://tax.nv.gov/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  NH: {
    state_name: 'New Hampshire',
    state_abbreviation: 'NH',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'By March 1 following the April 1 assessment date (to selectmen)',
    state_appeal_board_name: 'Board of Tax and Land Appeals (BTLA)',
    state_appeal_board_url: 'https://www.nh.gov/btla/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 24,
  },
  NJ: {
    state_name: 'New Jersey',
    state_abbreviation: 'NJ',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'April 1 (or May 1 in revaluation years) to County Tax Board',
    state_appeal_board_name: 'County Tax Board / New Jersey Tax Court',
    state_appeal_board_url: 'https://www.njcourts.gov/courts/tax',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 52,
  },
  NM: {
    state_name: 'New Mexico',
    state_abbreviation: 'NM',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.333,
    assessment_ratio_commercial: 0.333,
    assessment_ratio_industrial: 0.333,
    appeal_deadline_rule: 'Within 30 days of notice of value (typically by May)',
    state_appeal_board_name: 'County Valuation Protest Board',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  NY: {
    state_name: 'New York',
    state_abbreviation: 'NY',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Grievance Day — third Tuesday in May for most municipalities (varies for NYC)',
    state_appeal_board_name: 'Board of Assessment Review / Small Claims Assessment Review (SCAR)',
    state_appeal_board_url: 'https://www.tax.ny.gov/pit/property/contest/contestasmt.htm',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 24,
  },
  NC: {
    state_name: 'North Carolina',
    state_abbreviation: 'NC',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 30 days of assessment notice (revaluation years vary by county)',
    state_appeal_board_name: 'Board of Equalization and Review / Property Tax Commission',
    state_appeal_board_url: 'https://www.ncdor.gov/taxes-forms/property-tax',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  ND: {
    state_name: 'North Dakota',
    state_abbreviation: 'ND',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.50,
    assessment_ratio_commercial: 0.50,
    assessment_ratio_industrial: 0.50,
    appeal_deadline_rule: 'First Tuesday after second Monday in April (to local board)',
    state_appeal_board_name: 'City/Township Board of Equalization / State Board of Equalization',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  OH: {
    state_name: 'Ohio',
    state_abbreviation: 'OH',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.35,
    assessment_ratio_commercial: 0.35,
    assessment_ratio_industrial: 0.35,
    appeal_deadline_rule: 'January 1 through March 31 (complaint to Board of Revision)',
    state_appeal_board_name: 'County Board of Revision / Ohio Board of Tax Appeals',
    state_appeal_board_url: 'https://bta.ohio.gov/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 52,
  },
  OK: {
    state_name: 'Oklahoma',
    state_abbreviation: 'OK',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.11,
    assessment_ratio_commercial: 0.11,
    assessment_ratio_industrial: 0.11,
    appeal_deadline_rule: 'Within 30 days of notice (county equalization board meets in April)',
    state_appeal_board_name: 'County Board of Equalization',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  OR: {
    state_name: 'Oregon',
    state_abbreviation: 'OR',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'By December 31 to Board of Property Tax Appeals (BOPTA)',
    state_appeal_board_name: 'Board of Property Tax Appeals (BOPTA) / Oregon Tax Court',
    state_appeal_board_url: 'https://www.oregon.gov/dor/programs/property/Pages/appeals.aspx',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 24,
  },
  PA: {
    state_name: 'Pennsylvania',
    state_abbreviation: 'PA',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Varies by county — typically August 1 through September 1',
    state_appeal_board_name: 'Board of Assessment Appeals / Court of Common Pleas',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 52,
  },
  RI: {
    state_name: 'Rhode Island',
    state_abbreviation: 'RI',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 90 days of first tax payment due date in revaluation year',
    state_appeal_board_name: 'Board of Tax Assessment Review',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 16,
  },
  SC: {
    state_name: 'South Carolina',
    state_abbreviation: 'SC',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.04,
    assessment_ratio_commercial: 0.06,
    assessment_ratio_industrial: 0.106,
    appeal_deadline_rule: 'Within 90 days of receipt of tax notice',
    state_appeal_board_name: 'County Assessor / Administrative Law Court',
    state_appeal_board_url: null,
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 24,
  },
  SD: {
    state_name: 'South Dakota',
    state_abbreviation: 'SD',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.85,
    assessment_ratio_commercial: 0.85,
    assessment_ratio_industrial: 0.85,
    appeal_deadline_rule: 'Third Monday of March to local Board of Equalization',
    state_appeal_board_name: 'Board of Equalization / Office of Hearing Examiners',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  TN: {
    state_name: 'Tennessee',
    state_abbreviation: 'TN',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.25,
    assessment_ratio_commercial: 0.40,
    assessment_ratio_industrial: 0.40,
    appeal_deadline_rule: 'Within time set by County Board of Equalization (typically April-June)',
    state_appeal_board_name: 'County Board of Equalization / State Board of Equalization',
    state_appeal_board_url: 'https://www.comptroller.tn.gov/boards/state-board-of-equalization.html',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  TX: {
    state_name: 'Texas',
    state_abbreviation: 'TX',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'May 15 or within 30 days of notice of appraised value (whichever is later)',
    state_appeal_board_name: 'Appraisal Review Board (ARB)',
    state_appeal_board_url: 'https://comptroller.texas.gov/taxes/property-tax/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  UT: {
    state_name: 'Utah',
    state_abbreviation: 'UT',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 0.55,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'September 15 (or within 45 days of supplemental notice)',
    state_appeal_board_name: 'County Board of Equalization / Utah State Tax Commission',
    state_appeal_board_url: 'https://propertytax.utah.gov/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 20,
  },
  VT: {
    state_name: 'Vermont',
    state_abbreviation: 'VT',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 14 days of lodging of grand list (varies by town)',
    state_appeal_board_name: 'Board of Civil Authority / State Appraiser',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  VA: {
    state_name: 'Virginia',
    state_abbreviation: 'VA',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Varies by locality — typically within 30-60 days of notice',
    state_appeal_board_name: 'Board of Equalization / Circuit Court',
    state_appeal_board_url: null,
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 24,
  },
  WA: {
    state_name: 'Washington',
    state_abbreviation: 'WA',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Within 60 days of assessment notice (typically by July 1)',
    state_appeal_board_name: 'County Board of Equalization / Board of Tax Appeals',
    state_appeal_board_url: 'https://bta.wa.gov/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 6,
    typical_resolution_weeks_max: 24,
  },
  WV: {
    state_name: 'West Virginia',
    state_abbreviation: 'WV',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.60,
    assessment_ratio_commercial: 0.60,
    assessment_ratio_industrial: 0.60,
    appeal_deadline_rule: 'February 1 through February 20 to County Commission',
    state_appeal_board_name: 'County Commission / Circuit Court',
    state_appeal_board_url: null,
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  WI: {
    state_name: 'Wisconsin',
    state_abbreviation: 'WI',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'Objection filed by first Monday in May (to Board of Review)',
    state_appeal_board_name: 'Board of Review / Wisconsin Department of Revenue',
    state_appeal_board_url: 'https://www.revenue.wi.gov/pages/faqs/ptr-board.aspx',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 16,
  },
  WY: {
    state_name: 'Wyoming',
    state_abbreviation: 'WY',
    assessment_methodology: 'fractional',
    assessment_ratio_residential: 0.095,
    assessment_ratio_commercial: 0.095,
    assessment_ratio_industrial: 0.095,
    appeal_deadline_rule: 'Within 30 days of notice to County Board of Equalization',
    state_appeal_board_name: 'County Board of Equalization / State Board of Equalization',
    state_appeal_board_url: 'https://sbe.wyo.gov/',
    hearing_format: 'in_person',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 4,
    typical_resolution_weeks_max: 12,
  },
  DC: {
    state_name: 'District of Columbia',
    state_abbreviation: 'DC',
    assessment_methodology: 'full_value',
    assessment_ratio_residential: 1.0,
    assessment_ratio_commercial: 1.0,
    assessment_ratio_industrial: 1.0,
    appeal_deadline_rule: 'April 1 to Real Property Tax Appeals Commission',
    state_appeal_board_name: 'Real Property Tax Appeals Commission',
    state_appeal_board_url: 'https://rptac.dc.gov/',
    hearing_format: 'both',
    hearing_typically_required: true,
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 24,
  },
};

// ─── US County FIPS Codes ──────────────────────────────────────────────────
// Complete list of all US counties with FIPS codes.
// Source: US Census Bureau FIPS county codes.
// Format: [FIPS, county_name, state_abbreviation]

// Rather than embedding all 3,143 counties inline (which would make this file
// enormous), we fetch them from a reliable public source at runtime.

async function fetchAllCountyFips(): Promise<Array<{ fips: string; name: string; state: string }>> {
  // Use Census Bureau's county FIPS list
  const url = 'https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt';

  try {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.trim().split('\n');

    const counties: Array<{ fips: string; name: string; state: string }> = [];

    for (const line of lines.slice(1)) { // Skip header
      const parts = line.split('|');
      if (parts.length < 4) continue;

      const stateAbbr = parts[0].trim();
      const stateFips = parts[1].trim();
      const countyFips = parts[2].trim();
      const countyName = parts[3].trim()
        .replace(/ County$/i, '')
        .replace(/ Parish$/i, '')
        .replace(/ Borough$/i, '')
        .replace(/ Census Area$/i, '')
        .replace(/ Municipality$/i, '')
        .replace(/ city$/i, ' (City)');

      const fullFips = `${stateFips}${countyFips}`;

      // Skip territories (only 50 states + DC)
      if (!STATE_CONFIGS[stateAbbr]) continue;

      counties.push({ fips: fullFips, name: countyName, state: stateAbbr });
    }

    return counties;
  } catch (err) {
    console.error('Failed to fetch county FIPS list from Census Bureau:', err);
    console.log('Falling back to state-level entries only...');
    return [];
  }
}

// ─── Seed Function ─────────────────────────────────────────────────────────

async function seedCountyRules() {
  console.log('Fetching county FIPS codes from Census Bureau...');
  const counties = await fetchAllCountyFips();
  console.log(`Found ${counties.length} counties across ${Object.keys(STATE_CONFIGS).length} states + DC`);

  if (counties.length === 0) {
    console.error('No counties found. Aborting.');
    process.exit(1);
  }

  // Build county_rules rows
  const rows = counties.map((county) => {
    const state = STATE_CONFIGS[county.state];
    if (!state) return null;

    return {
      county_fips: county.fips,
      county_name: county.name,
      state_name: state.state_name,
      state_abbreviation: state.state_abbreviation,
      assessment_methodology: state.assessment_methodology,
      assessment_ratio_residential: state.assessment_ratio_residential,
      assessment_ratio_commercial: state.assessment_ratio_commercial,
      assessment_ratio_industrial: state.assessment_ratio_industrial,
      appeal_deadline_rule: state.appeal_deadline_rule,
      state_appeal_board_name: state.state_appeal_board_name,
      state_appeal_board_url: state.state_appeal_board_url,
      hearing_format: state.hearing_format,
      hearing_typically_required: state.hearing_typically_required,
      typical_resolution_weeks_min: state.typical_resolution_weeks_min,
      typical_resolution_weeks_max: state.typical_resolution_weeks_max,
      is_active: true,
      notes: `Auto-seeded from state-level data. County-specific details (portal URL, board phone, form download) should be verified and added via admin dashboard.`,
    };
  }).filter(Boolean);

  console.log(`Seeding ${rows.length} county rules...`);

  // Upsert in batches of 500 (Supabase limit)
  const BATCH_SIZE = 500;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('county_rules')
      .upsert(batch as any[], {
        onConflict: 'county_fips',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      continue;
    }

    const count = data?.length ?? batch.length;
    inserted += count;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count} rows upserted (${inserted}/${rows.length})`);
  }

  console.log(`\nDone! ${inserted} county rules seeded.`);
  console.log(`States covered: ${Object.keys(STATE_CONFIGS).length} (50 states + DC)`);
  console.log(`\nNext steps:`);
  console.log(`  1. Verify data in admin dashboard (/admin/counties)`);
  console.log(`  2. Add county-specific details (portal URLs, board phone numbers, form downloads)`);
  console.log(`  3. Priority: top 50 counties by population for detailed data`);
}

seedCountyRules().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
