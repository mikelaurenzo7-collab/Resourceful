// ─── Top County Intelligence Seed Data ────────────────────────────────────────
// Real appeal strategies, deadlines, portal URLs, and filing intelligence
// for the top 25 US counties by property tax appeal volume.
// Run after seed-counties.ts to upgrade these counties with elite-level data.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-top-counties.ts

interface CountyIntelligence {
  county_fips: string;
  appeal_board_name: string;
  appeal_board_phone: string | null;
  portal_url: string | null;
  appeal_deadline_rule: string;
  next_appeal_deadline: string | null;
  assessment_cycle: string;
  current_tax_year: number;
  accepts_online_filing: boolean;
  accepts_email_filing: boolean;
  requires_mail_filing: boolean;
  hearing_typically_required: boolean;
  hearing_format: string | null;
  hearing_duration_minutes: number | null;
  virtual_hearing_available: boolean;
  virtual_hearing_platform: string | null;
  informal_review_available: boolean;
  informal_review_notes: string | null;
  filing_fee_cents: number;
  appeal_form_name: string | null;
  form_download_url: string | null;
  evidence_requirements: string[];
  required_documents: string[];
  authorized_rep_allowed: boolean;
  further_appeal_body: string | null;
  further_appeal_deadline_rule: string | null;
  state_appeal_board_name: string | null;
  state_appeal_board_url: string | null;
  pro_se_tips: string | null;
  notes: string | null;
  last_verified_date: string;
  verified_by: string;
}

const TOP_COUNTIES: CountyIntelligence[] = [
  // ── COOK COUNTY, IL (17031) ─────────────────────────────────────────────
  {
    county_fips: '17031',
    appeal_board_name: 'Cook County Board of Review',
    appeal_board_phone: '(312) 443-7550',
    portal_url: 'https://appeals.cookcountyboardofreview.com/',
    appeal_deadline_rule: 'Varies by township — 30 days from publication of assessment list. 38 townships file on staggered monthly schedule (Jan–Oct).',
    next_appeal_deadline: null,
    assessment_cycle: 'Triennial',
    current_tax_year: 2025,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: false,
    hearing_format: 'written_only',
    hearing_duration_minutes: null,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    informal_review_available: true,
    informal_review_notes: 'Cook County Assessor offers initial informal review before Board of Review. Call (312) 443-7550 for Taxpayer Assistance. Also file with Assessor first at cookcountyassessoril.gov/online-appeals before escalating to Board of Review.',
    filing_fee_cents: 0,
    appeal_form_name: 'Board of Review Complaint Form',
    form_download_url: 'https://appeals.cookcountyboardofreview.com/',
    evidence_requirements: ['Comparable sales (minimum 3, within last 3 years)', 'Professional appraisal (USPAP compliant)', 'Property photographs', 'Condition documentation'],
    required_documents: ['Appeal form', 'Comparable sales evidence', 'Photos of property condition', 'Tax bill (if available)'],
    authorized_rep_allowed: true,
    further_appeal_body: 'Illinois Property Tax Appeal Board (PTAB)',
    further_appeal_deadline_rule: '30 days from Board of Review decision postmark',
    state_appeal_board_name: 'Illinois Property Tax Appeal Board (PTAB)',
    state_appeal_board_url: 'https://www.ptab.illinois.gov/efile/',
    pro_se_tips: 'Cook County Board of Review win rate is ~62%. Lead with comparable sales — the board weighs market data heavily. Township-specific deadlines are critical — check your exact township opening date. File with the Assessor FIRST (free, online), then escalate to Board of Review if denied. Commercial properties appeal 64% of the time vs 27% residential.',
    notes: '38 townships with staggered filing windows. Collective savings: $3.3B businesses, $2.8B homeowners.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── HARRIS COUNTY, TX (48201) ───────────────────────────────────────────
  {
    county_fips: '48201',
    appeal_board_name: 'Harris Central Appraisal District (HCAD) — Appraisal Review Board',
    appeal_board_phone: '(713) 957-7800',
    portal_url: 'https://hcad.org/hcad-online-services/ifile-protest/',
    appeal_deadline_rule: 'May 15 or 30 days after Notice of Appraised Value is mailed, whichever is later',
    next_appeal_deadline: '2026-05-15',
    assessment_cycle: 'Annual',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'both',
    hearing_duration_minutes: 15,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Phone or videoconference — must request 10 days before hearing',
    informal_review_available: true,
    informal_review_notes: 'iSettle settlement system available online. 89.2% of informal protests succeed — always try informal first. 39% of value reductions occur at informal stage. Contact HCAD for informal conference appointment.',
    filing_fee_cents: 0,
    appeal_form_name: 'iFile Protest (online)',
    form_download_url: 'https://hcad.org/hcad-online-services/ifile-protest/',
    evidence_requirements: ['Comparable property sales', 'Assessment-to-sale ratios', 'Professional appraisal', 'Property condition photos', 'Market analysis'],
    required_documents: ['Notice of Appraised Value (for iFile number)', 'Comparable sales evidence', 'Photos', 'Appraisal (if available)'],
    authorized_rep_allowed: true,
    further_appeal_body: 'District Court or Binding Arbitration',
    further_appeal_deadline_rule: '60 days from ARB order date',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'Harris County has the highest informal protest success rate in Texas at 89.2%. ALWAYS file informal protest first via iSettle. You need your iFile number from the Notice of Appraised Value to file online. File early — the system gets heavy traffic near May 15. Request phone/video hearing if you cannot attend in person (must request 10 days ahead).',
    notes: '217,394 of 241,930 accounts resolved informally with reductions. Residential 85-95% success, commercial 70-75%.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── MARICOPA COUNTY, AZ (04013) ────────────────────────────────────────
  {
    county_fips: '04013',
    appeal_board_name: 'Maricopa County Assessor — Appeals Division',
    appeal_board_phone: '(602) 506-3406',
    portal_url: 'https://www.mcassessor.maricopa.gov/page/appeals/',
    appeal_deadline_rule: '60 days from Notice of Valuation mailing date',
    next_appeal_deadline: '2026-04-21',
    assessment_cycle: 'Annual',
    current_tax_year: 2027,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'in_person',
    hearing_duration_minutes: 15,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    informal_review_available: true,
    informal_review_notes: 'Meet with Assessor office or supply evidence informally before formal appeal. Call (602) 506-3406 to schedule. Documentation is REQUIRED at Assessor level or appeal will be denied.',
    filing_fee_cents: 0,
    appeal_form_name: 'Appeal Application',
    form_download_url: 'https://www.mcassessor.maricopa.gov/file/appeals/forms/Appeal-Process-Informational-Handout.pdf',
    evidence_requirements: ['Recent appraisal (REQUIRED)', 'Comparable sales', 'Legal classification proof', 'Property condition evidence'],
    required_documents: ['Appeal form', 'Appraisal or comparable sales', 'Photos', 'Property condition documentation'],
    authorized_rep_allowed: true,
    further_appeal_body: 'Arizona State Board of Equalization (SBOE)',
    further_appeal_deadline_rule: '25 days from Assessor decision',
    state_appeal_board_name: 'Arizona State Board of Equalization',
    state_appeal_board_url: 'https://sboe.az.gov/taxpayers/how-file-appeal',
    pro_se_tips: 'Documentation is REQUIRED at the Assessor level — bring evidence or your appeal will be denied outright. Multi-level system: Assessor → SBOE → Tax Court. Start with the Assessor for the fastest resolution.',
    notes: 'Three-level appeal system. Phone contact preferred for scheduling.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── LOS ANGELES COUNTY, CA (06037) ─────────────────────────────────────
  {
    county_fips: '06037',
    appeal_board_name: 'Los Angeles County Assessment Appeals Board (AAB)',
    appeal_board_phone: '(213) 974-1471',
    portal_url: 'https://aab.lacounty.gov/',
    appeal_deadline_rule: 'July 2 through November 30 (annual window). Supplemental assessments: 60 days from mailing.',
    next_appeal_deadline: '2026-11-30',
    assessment_cycle: 'Annual (Prop 13 base year)',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'both',
    hearing_duration_minutes: 20,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Hybrid — in-person and virtual options available',
    informal_review_available: true,
    informal_review_notes: 'Contact Public Interaction Unit at (213) 974-1471 for assessment review before formal filing.',
    filing_fee_cents: 4600,
    appeal_form_name: 'Assessment Appeals Application (Form AAB 103)',
    form_download_url: 'https://lacaab.lacounty.gov/helpfiles/forms/aab103.pdf',
    evidence_requirements: ['Comparable property sales', 'Professional appraisal', 'Property condition documentation', 'Market analysis'],
    required_documents: ['Form AAB 103', 'Comparable sales', 'Photos', 'Appraisal (recommended)'],
    authorized_rep_allowed: true,
    further_appeal_body: 'Superior Court',
    further_appeal_deadline_rule: '6 months from AAB decision',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'LA County has a $46 filing fee (fee waivers available for hardship). The July 2–Nov 30 window is generous — use it. Supplemental assessments from recent purchases have a separate 60-day deadline. Online filing at aab.lacounty.gov is fastest.',
    notes: 'Prop 13 limits annual increases to 2%. Appeals focus on base year value or decline in value.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── DALLAS COUNTY, TX (48113) ───────────────────────────────────────────
  {
    county_fips: '48113',
    appeal_board_name: 'Dallas Central Appraisal District (DCAD) — Appraisal Review Board',
    appeal_board_phone: '(214) 631-0910',
    portal_url: 'https://www.dallascad.org/',
    appeal_deadline_rule: 'May 15 or 30 days after Notice mailed, whichever is later',
    next_appeal_deadline: '2026-05-15',
    assessment_cycle: 'Annual',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'both',
    hearing_duration_minutes: 15,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Phone or video — request when filing protest',
    informal_review_available: true,
    informal_review_notes: 'Informal conference available through ARB process. Texas districts average 80-90% informal settlement success.',
    filing_fee_cents: 0,
    appeal_form_name: 'uFile Protest (online)',
    form_download_url: 'https://dallascad.org/Forms/Protest_Process.pdf',
    evidence_requirements: ['Comparable property sales', 'Appraisal documentation', 'Property condition evidence', 'Market analysis'],
    required_documents: ['Notice of Appraised Value (for PIN)', 'Comparable sales', 'Photos', 'Appraisal (if available)'],
    authorized_rep_allowed: true,
    further_appeal_body: 'District Court or Binding Arbitration',
    further_appeal_deadline_rule: '60 days from ARB order',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'PIN from your Notice of Appraised Value is required for online filing. System gets heavy traffic near May 15 — file early. Technical difficulties do NOT extend the deadline.',
    notes: null,
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── CUYAHOGA COUNTY, OH (39035) ────────────────────────────────────────
  {
    county_fips: '39035',
    appeal_board_name: 'Cuyahoga County Board of Revision',
    appeal_board_phone: '(216) 443-7195',
    portal_url: 'https://cuyahogabor.org/',
    appeal_deadline_rule: 'January 1 through March 31 — NO EXTENSIONS (Ohio Revised Code 5715.19)',
    next_appeal_deadline: '2027-03-31',
    assessment_cycle: 'Sexennial (6-year reappraisal) with triennial updates',
    current_tax_year: 2025,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'in_person',
    hearing_duration_minutes: 15,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    informal_review_available: true,
    informal_review_notes: 'Informal conference encouraged before filing. Contact Board of Revision at (216) 443-7195.',
    filing_fee_cents: 0,
    appeal_form_name: 'E-Complaint Form',
    form_download_url: 'https://app.cuyahogacounty.us/borcomplaints/',
    evidence_requirements: ['Comparable property sales', 'Professional appraisal', 'Property photographs', 'Income/expense documentation (commercial)'],
    required_documents: ['Complaint form', 'Comparable sales', 'Appraisal', 'Photos'],
    authorized_rep_allowed: true,
    further_appeal_body: 'Ohio Board of Tax Appeals',
    further_appeal_deadline_rule: '30 days from Board of Revision decision',
    state_appeal_board_name: 'Ohio Board of Tax Appeals',
    state_appeal_board_url: null,
    pro_se_tips: 'STRICT no-extension policy — March 31 is absolute. E-filing takes ~10 minutes and gives instant PDF confirmation. No notary required for e-filing. IMPORTANT: Private courier postmarks (FedEx, UPS) do NOT count — only USPS postmark matters if mailing.',
    notes: 'E-filing strongly preferred. 40% of filers receive value adjustments.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── MIAMI-DADE COUNTY, FL (12086) ──────────────────────────────────────
  {
    county_fips: '12086',
    appeal_board_name: 'Miami-Dade Value Adjustment Board (VAB)',
    appeal_board_phone: '(305) 375-2861',
    portal_url: 'https://www.miamidadeclerk.com/clerk/value-adjustment-board.page',
    appeal_deadline_rule: '25 days from TRIM notice mailing date (typically mid-August). VAB CANNOT extend this deadline.',
    next_appeal_deadline: null,
    assessment_cycle: 'Annual',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'in_person',
    hearing_duration_minutes: 15,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    informal_review_available: true,
    informal_review_notes: 'Property Appraiser offers informal "interview period" after TRIM mailing. Call (305) 375-2861 to request review. Negotiate informally BUT file your VAB petition anyway — the deadline is firm even during negotiations.',
    filing_fee_cents: 1500,
    appeal_form_name: 'VAB Petition Form',
    form_download_url: 'https://www.miamidadepa.gov/pa/property-assessments/appeal.page',
    evidence_requirements: ['Comparable property sales', 'Professional appraisal', 'Property condition documentation', 'Market analysis'],
    required_documents: ['VAB Petition Form', 'Comparable sales', 'Photos', 'Appraisal (recommended)'],
    authorized_rep_allowed: true,
    further_appeal_body: 'Circuit Court',
    further_appeal_deadline_rule: '60 days from VAB decision',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'TRIM notices typically mail mid-August. You have exactly 25 days — no extensions. Special Magistrates (licensed appraisers or attorneys) conduct hearings. File your petition BEFORE negotiating informally — the deadline is firm regardless of ongoing discussions.',
    notes: '$15/parcel filing fee. Late filing only with proven extenuating circumstances (medical emergency, natural disaster).',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── TRAVIS COUNTY, TX (48453) ──────────────────────────────────────────
  {
    county_fips: '48453',
    appeal_board_name: 'Travis Central Appraisal District (TCAD) — Appraisal Review Board',
    appeal_board_phone: '(512) 834-9317',
    portal_url: 'https://traviscad.org/efile/',
    appeal_deadline_rule: 'May 15 or 30 days after Notice mailed, whichever is later',
    next_appeal_deadline: '2026-05-15',
    assessment_cycle: 'Annual',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'both',
    hearing_duration_minutes: 15,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Phone or video — must request 10 days before hearing',
    informal_review_available: true,
    informal_review_notes: 'Settlement negotiations available through online portal. Upload evidence, review appraiser evidence, and see settlement offers online. Texas averages 80-90% informal settlement success.',
    filing_fee_cents: 0,
    appeal_form_name: 'Online Protest (e-File)',
    form_download_url: 'https://traviscad.org/efile/',
    evidence_requirements: ['Comparable property sales', 'Professional appraisal', 'Property condition documentation', 'Assessment-to-value ratio analysis'],
    required_documents: ['Protest form', 'Comparable sales', 'Photos', 'Market analysis'],
    authorized_rep_allowed: true,
    further_appeal_body: 'District Court or Binding Arbitration',
    further_appeal_deadline_rule: '60 days from ARB order',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'File early — heavy traffic near May 15. TCAD must RECEIVE by deadline (postmark does not count for mail). Online filing gives instant confirmation. You can upload evidence and see settlement offers through the online portal. Request phone/video hearing 10 days in advance if needed.',
    notes: 'TCAD office: 850 East Anderson Lane, Austin TX 78752. Mail: PO Box 149012, Austin TX 78714.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── TARRANT COUNTY, TX (48439) ─────────────────────────────────────────
  {
    county_fips: '48439',
    appeal_board_name: 'Tarrant Appraisal District (TAD) — Appraisal Review Board',
    appeal_board_phone: '(817) 284-0024',
    portal_url: 'https://www.tad.org/',
    appeal_deadline_rule: 'May 15 or 30 days after Notice mailed, whichever is later',
    next_appeal_deadline: '2026-05-15',
    assessment_cycle: 'Annual',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'both',
    hearing_duration_minutes: 15,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Phone or video — standard accommodation',
    informal_review_available: true,
    informal_review_notes: 'Online value negotiation system available through TAD portal. Texas averages 80-90% informal settlement.',
    filing_fee_cents: 0,
    appeal_form_name: 'Online Protest',
    form_download_url: 'https://www.tad.org/',
    evidence_requirements: ['Comparable property sales', 'Professional appraisal', 'Market analysis', 'Property condition evidence'],
    required_documents: ['Protest form', 'Comparable sales', 'Photos', 'Assessment comparisons'],
    authorized_rep_allowed: true,
    further_appeal_body: 'District Court or Binding Arbitration',
    further_appeal_deadline_rule: '60 days from ARB order',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'TAD offers online value negotiation — try it before formal hearing. Check TAD website for current filing status and deadlines.',
    notes: null,
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── BEXAR COUNTY, TX (48029) ───────────────────────────────────────────
  {
    county_fips: '48029',
    appeal_board_name: 'Bexar Central Appraisal District (BCAD) — Appraisal Review Board',
    appeal_board_phone: '(210) 242-2432',
    portal_url: 'https://bcad.org/online-portal/',
    appeal_deadline_rule: 'May 15 or 30 days after Notice mailed, whichever is later',
    next_appeal_deadline: '2026-05-15',
    assessment_cycle: 'Annual',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'both',
    hearing_duration_minutes: 15,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Phone or video — by request',
    informal_review_available: true,
    informal_review_notes: 'ARB process includes informal negotiations. Texas averages 80-90% informal settlement success.',
    filing_fee_cents: 0,
    appeal_form_name: 'Form 50-132 (Notice of Protest)',
    form_download_url: 'https://bcad.org/wp-content/uploads/2024/03/2024-PROTEST-FORM-as-of-03-18-24.pdf',
    evidence_requirements: ['Comparable property sales', 'Professional appraisal', 'Property condition documentation', 'Market analysis'],
    required_documents: ['Form 50-132 or online protest', 'Comparable sales', 'Photos', 'Appraisal (if available)'],
    authorized_rep_allowed: true,
    further_appeal_body: 'District Court or Binding Arbitration',
    further_appeal_deadline_rule: '60 days from ARB order',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'Owner/Agent ID and PIN required for online portal. E-filing is fastest. Alternative: Mail to PO Box 830248, San Antonio TX 78283. Fax: 210-242-2454. In-person: 411 N Frio St, San Antonio TX 78207.',
    notes: 'Help center: https://help.bcad.org',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ── FULTON COUNTY, GA (13121) ──────────────────────────────────────────
  {
    county_fips: '13121',
    appeal_board_name: 'Fulton County Board of Assessors',
    appeal_board_phone: '(404) 612-6440',
    portal_url: 'https://fultonassessor.org/property-appeals/',
    appeal_deadline_rule: 'Within 45 days of Notice of Assessment date',
    next_appeal_deadline: null,
    assessment_cycle: 'Annual',
    current_tax_year: 2026,
    accepts_online_filing: true,
    accepts_email_filing: false,
    requires_mail_filing: false,
    hearing_typically_required: true,
    hearing_format: 'both',
    hearing_duration_minutes: 15,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Virtual hearings available. Evidence must be submitted to boeevidence@fultoncountyga.gov at least 48 hours before hearing.',
    informal_review_available: true,
    informal_review_notes: 'Contact Board of Assessors at (404) 612-6440 for informal review/discussion before formal appeal.',
    filing_fee_cents: 0,
    appeal_form_name: 'Board of Assessors Appeal Form',
    form_download_url: 'https://fultonassessor.org/property-appeals/',
    evidence_requirements: ['Comparable property sales', 'Professional appraisal', 'Property condition documentation', 'Market analysis'],
    required_documents: ['Appeal form', 'Comparable sales', 'Photos', 'Appraisal (recommended)'],
    authorized_rep_allowed: true,
    further_appeal_body: 'Board of Equalization → Superior Court',
    further_appeal_deadline_rule: '30 days from Board of Assessors decision',
    state_appeal_board_name: null,
    state_appeal_board_url: null,
    pro_se_tips: 'Fulton has a generous 45-day window (longer than most). Online filing is preferred. IMPORTANT: Evidence submitted less than 48 hours before virtual hearing will NOT be admitted. No email/fax filing — use online portal or in-person. Five office locations throughout county.',
    notes: 'Appeals NOT accepted via email or fax — online or in-person only.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
];

async function seedTopCounties() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Seeding intelligence for ${TOP_COUNTIES.length} top counties...`);

  let updated = 0;
  let errors = 0;

  for (const county of TOP_COUNTIES) {
    const { county_fips, ...updateData } = county;

    const { error } = await supabase
      .from('county_rules')
      .update(updateData as never)
      .eq('county_fips', county_fips);

    if (error) {
      console.error(`  FAILED ${county_fips}: ${error.message}`);
      errors++;
    } else {
      updated++;
      console.log(`  Updated ${county_fips}`);
    }
  }

  console.log(`\nDone! Updated ${updated} counties. Errors: ${errors}`);
}

seedTopCounties().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
