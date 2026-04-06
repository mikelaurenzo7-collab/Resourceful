/**
 * seed-demo-report.mjs
 * Inserts a fully-populated mock report into local Supabase for UI testing.
 * Run: node scripts/seed-demo-report.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required to run this seed script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── 1. Ensure test user row exists in users table ──
const USER_ID = 'ea1d71c1-f04e-4ce5-856a-c4f4a924b722'; // created during auth test

async function seed() {
  console.log('\n🌱  Seeding demo report...\n');

  const { error: userErr } = await supabase.from('users').upsert({
    id: USER_ID,
    full_name: 'Jordan Test',
    phone: '312-555-0199',
  });
  if (userErr) console.warn('  users upsert:', userErr.message);
  else console.log('  ✅  User row ready');

  // ── 2. Insert county rule for Cook County, IL ──
  const { error: countyErr } = await supabase.from('county_rules').upsert({
    county_fips: '17031',
    county_name: 'Cook County',
    state_abbreviation: 'IL',
    state_name: 'Illinois',
    appeal_board_name: 'Cook County Board of Review',
    appeal_board_address: '118 N Clark St Rm 601, Chicago IL 60602',
    appeal_board_phone: '(312) 603-5542',
    accepts_online_filing: true,
    portal_url: 'https://www.cookcountyboardofreview.com',
    accepts_email_filing: false,
    requires_mail_filing: false,
    appeal_deadline_rule: 'Appeal window opens after reassessment notices are mailed (township-by-township). Typically March–October depending on your township.',
    next_appeal_deadline: '2026-06-30',
    current_tax_year: 2025,
    assessment_cycle: 'Triennial',
    appeal_form_name: 'Residential Appeal Form',
    form_download_url: 'https://www.cookcountyboardofreview.com/forms',
    filing_fee_cents: 0,
    filing_fee_notes: 'No filing fee for residential properties.',
    required_documents: ['Completed appeal form', 'Comparable sales (3–5 recent sales)', 'Property photos documenting condition', 'Assessor PIN confirmation'],
    filing_steps: [
      { step_number: 1, title: 'Gather Your Evidence', description: 'Print this report and the comparable sales grid. Have your Property Index Number (PIN) ready from your tax bill.', },
      { step_number: 2, title: 'File Online or By Mail', description: 'Visit the Board of Review portal at cookcountyboardofreview.com or mail your completed form with evidence to 118 N Clark St, Room 601.', url: 'https://www.cookcountyboardofreview.com', form_name: 'Residential Appeal Form' },
      { step_number: 3, title: 'Attend Your Hearing (if scheduled)', description: 'The Board may schedule an in-person or virtual hearing. Bring your report and be prepared to present your comparable sales and condition evidence.' },
      { step_number: 4, title: 'Await Decision', description: 'Decisions are typically mailed 4–10 weeks after the hearing. If successful, your assessed value will be reduced for the current tax year.' },
    ],
    hearing_typically_required: false,
    hearing_format: 'in_person_or_virtual',
    hearing_duration_minutes: 15,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Zoom',
    informal_review_available: true,
    informal_review_notes: 'An informal meeting with a hearing officer is available before the formal hearing. Many cases are resolved at this stage.',
    typical_resolution_weeks_min: 8,
    typical_resolution_weeks_max: 16,
    further_appeal_body: 'Illinois Property Tax Appeal Board (PTAB)',
    pro_se_tips: 'Lead with your strongest sales comps — properties similar in size, age, and condition that sold below your assessed value. Condition photos are persuasive. Stay calm and let the evidence speak. The Board of Review hears hundreds of cases; be concise.',
    assessment_ratio_residential: 0.10,
    assessment_ratio_commercial: 0.25,
    assessment_ratio_industrial: 0.25,
    is_active: true,
  }, { onConflict: 'county_fips' });
  if (countyErr) console.warn('  county_rules upsert:', countyErr.message);
  else console.log('  ✅  Cook County rules ready');

  // ── 3. Insert report ──
  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .insert({
      user_id: USER_ID,
      client_email: 'test@resourceful.dev',
      client_name: 'Jordan Test',
      service_type: 'tax_appeal',
      property_type: 'residential',
      status: 'delivered',
      property_address: '4217 N Kedzie Ave',
      city: 'Chicago',
      state: 'Illinois',
      state_abbreviation: 'IL',
      county: 'Cook County',
      county_fips: '17031',
      latitude: 41.9612,
      longitude: -87.7083,
      pin: '13-13-217-024-0000',
      photos_skipped: false,
      property_issues: ['roof_damage', 'foundation_crack', 'deferred_maintenance'],
      additional_notes: 'Roof has visible shingle loss on north face. Foundation crack visible at northwest corner of basement. Interior shows deferred maintenance throughout.',
      desired_outcome: 'Reduce assessed value to align with comparable sales evidence.',
      review_tier: 'expert_reviewed',
      has_tax_bill: true,
      tax_bill_assessed_value: 320000,
      tax_bill_tax_amount: 8764,
      tax_bill_tax_year: '2025',
      amount_paid_cents: 4900,
      payment_status: 'paid',
      pipeline_last_completed_stage: 'stage_8_delivery',
      delivered_at: new Date().toISOString(),
      filing_status: 'not_started',
      case_strength_score: 82,
      case_value_at_stake: 137500,
      is_underassessed: false,
      email_delivery_preference: true,
      referral_discount_cents: 0,
      is_white_label: false,
    })
    .select()
    .single();

  if (reportErr) { console.error('  ❌  report insert failed:', reportErr.message); process.exit(1); }
  const reportId = report.id;
  console.log(`  ✅  Report created: ${reportId}`);

  // ── 4. property_data ──
  const { error: pdErr } = await supabase.from('property_data').insert({
    report_id: reportId,
    assessed_value: 320000,
    assessed_value_source: 'Cook County Assessor (2025)',
    market_value_estimate_low: 248000,
    market_value_estimate_high: 275000,
    assessment_methodology: 'Sales comparison with IAAO line-item adjustments',
    lot_size_sqft: 3750,
    building_sqft_gross: 1840,
    building_sqft_living_area: 1680,
    year_built: 1924,
    effective_age: 35,
    remaining_economic_life: 40,
    property_class: 'Class 2-03',
    property_class_description: 'Single-family residence — 2 story',
    construction_type: 'Frame',
    roof_type: 'Asphalt shingle — gable',
    exterior_finish: 'Vinyl siding',
    foundation_type: 'Poured concrete',
    hvac_type: 'Forced air gas furnace / central AC',
    number_of_stories: 2,
    bedroom_count: 3,
    full_bath_count: 1,
    half_bath_count: 1,
    garage_sqft: 280,
    garage_spaces: 1,
    basement_sqft: 920,
    basement_finished_sqft: 200,
    overall_condition: 'fair',
    condition_notes: 'Roof damage (north face shingle loss), foundation crack (NW corner), kitchen and bathrooms original to construction with deferred maintenance evident throughout. Property is functional but requires approximately $35,000–$45,000 in near-term capital expenditure.',
    zoning_designation: 'RS-3',
    zoning_conformance: 'Conforming',
    flood_zone_designation: 'Zone X (minimal flood hazard)',
    tax_year_in_appeal: 2025,
    assessment_history: [
      { year: 2023, assessed_value: 295000, change_pct: null },
      { year: 2024, assessed_value: 308000, change_pct: 4.4 },
      { year: 2025, assessed_value: 320000, change_pct: 3.9 },
    ],
    physical_depreciation_pct: 0.32,
    quality_grade: 'average',
    concluded_value: 258000,
    concluded_value_without_photos: 271000,
    photo_impact_dollars: 13000,
    photo_impact_pct: 4.7,
    photo_condition_adjustment_pct: -6.5,
    photo_defect_count: 4,
    photo_defect_count_significant: 2,
    photo_count: 7,
    land_value: 72000,
    cost_approach_rcn: 310000,
    cost_approach_value: 283000,
  });
  if (pdErr) console.warn('  property_data:', pdErr.message);
  else console.log('  ✅  Property data inserted');

  // ── 5. Comparable sales ──
  const comps = [
    { address: '4108 N Kedzie Ave', sale_price: 245000, sale_date: '2025-11-14', sqft: 1720, year_built: 1922, condition: 'average', distance_miles: 0.12, adjusted_price_per_sqft: 142 },
    { address: '4401 N Sawyer Ave', sale_price: 258000, sale_date: '2025-10-02', sqft: 1880, year_built: 1926, condition: 'good', distance_miles: 0.24, adjusted_price_per_sqft: 137 },
    { address: '3954 N Kimball Ave', sale_price: 271000, sale_date: '2025-08-19', sqft: 1960, year_built: 1928, condition: 'average', distance_miles: 0.31, adjusted_price_per_sqft: 138 },
    { address: '4532 N St Louis Ave', sale_price: 233000, sale_date: '2026-01-07', sqft: 1640, year_built: 1921, condition: 'fair', distance_miles: 0.19, adjusted_price_per_sqft: 142 },
    { address: '4215 N Homan Ave', sale_price: 262000, sale_date: '2025-09-23', sqft: 1800, year_built: 1925, condition: 'average', distance_miles: 0.09, adjusted_price_per_sqft: 145 },
    { address: '3882 N Troy St', sale_price: 279000, sale_date: '2025-07-11', sqft: 2020, year_built: 1929, condition: 'good', distance_miles: 0.38, adjusted_price_per_sqft: 138 },
  ];

  const compRows = comps.map((c, i) => ({
    report_id: reportId,
    address: c.address,
    sale_price: c.sale_price,
    sale_date: c.sale_date,
    building_sqft: c.sqft,
    price_per_sqft: Math.round(c.sale_price / c.sqft),
    year_built: c.year_built,
    condition_notes: `${c.condition} condition`,
    distance_miles: c.distance_miles,
    adjusted_price_per_sqft: c.adjusted_price_per_sqft,
    net_adjustment_pct: 0,
    is_weak_comparable: false,
    is_distressed_sale: false,
  }));

  const { error: compsErr } = await supabase.from('comparable_sales').insert(compRows);
  if (compsErr) console.warn('  comparable_sales:', compsErr.message);
  else console.log(`  ✅  ${comps.length} comparable sales inserted`);

  // ── 6. Report narratives ──
  const narratives = [
    {
      section_name: 'executive_summary',
      content: `## Executive Summary

**Subject Property:** 4217 N Kedzie Ave, Chicago, IL 60618 (PIN: 13-13-217-024-0000)
**Current Assessed Value:** $320,000 (2025 Cook County Assessor)
**Concluded Market Value:** $258,000
**Indicated Reduction:** $62,000 (19.4%)
**Estimated Annual Tax Savings:** $1,698 at current levy rates

---

This report presents evidence that the 2025 assessed value of $320,000 for 4217 N Kedzie Ave, Chicago materially exceeds the property's market value as supported by comparable sales. Six arm's-length sales of similar residential properties within a 0.4-mile radius — all sold between July 2025 and January 2026 — indicate a market value range of $245,000–$279,000, with a median adjusted value of $258,000.

The property carries documented physical deficiencies — roof damage, a foundation crack, and deferred maintenance throughout — that further depress its market position relative to better-maintained sales. Photo evidence supports condition adjustments totaling -6.5% relative to average comparable condition.

The assessment is 24.0% above the concluded market value. Cook County's statutory assessment level of 10% of market value implies an equalized assessed value of $25,800 — compared to the current EAV of $32,000 — representing an effective over-assessment of 24.0%.`,
    },
    {
      section_name: 'property_description',
      content: `## Subject Property Description

**Address:** 4217 N Kedzie Ave, Chicago, IL 60618
**Property Type:** Residential — Single-Family Residence
**Property Class:** Class 2-03 (Two-story single-family)
**Zoning:** RS-3 (Residential Single-Family) — Conforming use

### Physical Description

The subject is a two-story balloon-frame residence constructed in 1924, situated on a 25×150 foot (3,750 sq ft) lot in the Avondale neighborhood of Chicago's Northwest Side. The improved area consists of 1,840 gross square feet (1,680 sq ft above-grade living area) plus an unfinished basement of 920 sq ft with approximately 200 sq ft of finished space.

**Construction:** Wood frame, vinyl siding exterior, asphalt shingle roof on gable structure.
**Mechanical:** Forced-air gas furnace with central air conditioning. Original plumbing throughout.
**Garage:** Detached one-car garage, approximately 280 sq ft.
**Condition:** Fair. Physical inspection and photographic evidence document roof damage (shingle loss on northern face), a structural crack at the northwest basement corner, and deferred maintenance throughout the interior. Estimated near-term capital expenditure: $35,000–$45,000.`,
    },
    {
      section_name: 'comparable_sales_analysis',
      content: `## Comparable Sales Analysis

Six arm's-length sales of similar residential properties were analyzed within a 0.4-mile radius of the subject, all sold between July 2025 and January 2026. Time adjustments were not applied given the stable market conditions in this submarket. All comps are single-family residences of similar age, construction, size, and zoning.

### Adjustment Grid Summary

| Address | Sale Date | Sale Price | Sq Ft | $/Sq Ft (Adj) | Condition | Distance |
|---|---|---|---|---|---|---|
| 4108 N Kedzie Ave | Nov 2025 | $245,000 | 1,720 | $142 | Average | 0.12 mi |
| 4215 N Homan Ave | Sep 2025 | $262,000 | 1,800 | $145 | Average | 0.09 mi |
| 4401 N Sawyer Ave | Oct 2025 | $258,000 | 1,880 | $137 | Good | 0.24 mi |
| 4532 N St Louis Ave | Jan 2026 | $233,000 | 1,640 | $142 | Fair | 0.19 mi |
| 3954 N Kimball Ave | Aug 2025 | $271,000 | 1,960 | $138 | Average | 0.31 mi |
| 3882 N Troy St | Jul 2025 | $279,000 | 2,020 | $138 | Good | 0.38 mi |

**Median Adjusted Price Per Square Foot:** $140/sq ft
**Concluded Value (1,840 sq ft × $140/sq ft):** $258,000 (rounded to nearest $1,000)

### Reconciliation

The six comparable sales bracket the subject in terms of size, age, and condition. The closest sale (4215 N Homan Ave, 0.09 miles) closed at $262,000 for a property in similar average condition — a near-perfect match before condition adjustment. Applying the documented condition deficit of -6.5% (supported by photo evidence) to a base of ~$276,000 yields a concluded value of approximately $258,000, consistent with the direct comparison evidence.`,
    },
    {
      section_name: 'condition_analysis',
      content: `## Condition Analysis

### Photo Evidence Summary

Seven photographs were submitted documenting the property's condition. AI analysis identified four defects, two of which are classified as significant.

**Defect 1 — Roof Damage (Significant)**
North-facing roof shows visible shingle loss over approximately 20% of the surface area. Active water infiltration risk. Estimated repair: $8,000–$12,000.
*Comparable adjustment: -3.0%*

**Defect 2 — Foundation Crack (Significant)**
Horizontal crack at Northwest basement corner, approximately 18 inches in length with evidence of prior sealing attempts. Requires professional evaluation and potential underpinning.
*Comparable adjustment: -2.5%*

**Defect 3 — Deferred Interior Maintenance (Moderate)**
Kitchen and bathrooms are original to 1924 construction. Flooring shows wear throughout first floor. Interior paint is faded and chipped in multiple rooms.
*Comparable adjustment: -1.0%*

**Defect 4 — Driveway/Exterior (Minor)**
Concrete driveway is cracked and heaved. Cosmetic issue only.
*Comparable adjustment: -0.0% (below threshold)*

**Total Photo-Supported Condition Adjustment: -6.5%**
**Dollar Impact of Photo Evidence: -$13,000 vs. data-only analysis**`,
    },
    {
      section_name: 'pro_se_filing_guide',
      content: `# Cook County Board of Review — Filing Guide
## 4217 N Kedzie Ave, Chicago IL 60618

---

### Your Case at a Glance

- **Current Assessed Value:** $320,000
- **Your Requested Value:** $258,000
- **Reduction Requested:** $62,000 (19.4%)
- **Filing Deadline:** June 30, 2026
- **Board of Review:** Cook County Board of Review, 118 N Clark St Rm 601

---

### Step 1: Gather Your Evidence
Print this full report (20–25 pages). You will need:
- ✅ This report (comparable sales grid + narrative)
- ✅ Your 7 condition photographs
- ✅ Your Cook County tax bill (showing your PIN: 13-13-217-024-0000)
- ✅ Completed Residential Appeal Form (download at cookcountyboardofreview.com)

### Step 2: File Your Appeal
**Online (Recommended):** Visit the Board of Review portal and file during your township's open window. You'll upload your evidence as PDFs.
**By Mail:** Send to 118 N Clark St, Room 601, Chicago IL 60602. Use certified mail and keep your tracking number.

### Step 3: Present Your Case
If a hearing is scheduled, arrive 10 minutes early. You'll have approximately 15 minutes. Lead with your strongest comparable sale (4215 N Homan Ave — closest sale, $262,000) and your condition photos.

**Opening statement (suggested):** "Good morning. I'm appealing my 2025 assessment of $320,000 for 4217 N Kedzie Avenue. I have six comparable sales within a quarter mile showing market values of $245,000–$279,000, and photographic evidence of roof damage and a foundation crack that further depress my property's market position. I'm requesting a reduction to $258,000."

### Step 4: Follow Up
The Board issues decisions by mail, typically 8–16 weeks after filing. If denied, you may appeal to the Illinois Property Tax Appeal Board (PTAB) within 30 days of the decision.

### Pro Tips from the Board of Review
- Comparable sales are the most persuasive evidence. Make sure yours are recent (within 12 months) and geographically close.
- Condition photos are compelling when they show specific, documentable defects — not just "general wear."
- Be polite and brief. The hearing officers see hundreds of cases. Let the evidence speak.
- Even a partial reduction is a win — and you can refile next year.`,
    },
  ];

  for (const n of narratives) {
    const { error: nErr } = await supabase.from('report_narratives').insert({
      report_id: reportId,
      section_name: n.section_name,
      content: n.content,
    });
    if (nErr) console.warn(`  report_narratives [${n.section_name}]:`, nErr.message);
  }
  console.log(`  ✅  ${narratives.length} report narratives inserted`);

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅  Demo report seeded successfully!');
  console.log(`\n  Report ID:   ${reportId}`);
  console.log(`  View report: http://localhost:3000/report/${reportId}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

seed().catch((err) => { console.error(err); process.exit(1); });

