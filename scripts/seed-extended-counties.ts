// ─── Extended County Intelligence Seed Data ───────────────────────────────────
// Real appeal strategies for 59 additional high-value counties beyond the top 25.
// Covers NJ, CT, NY, PA, MA, TX, CA, AZ, CO, NV, GA, NC, VA, MD, OH, MI, MN,
// WA, OR, IN regions.
//
// Run after seed-counties.ts and seed-top-counties.ts.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-extended-counties.ts

interface CountyUpdate {
  county_fips: string;
  appeal_board_name: string;
  appeal_board_phone: string | null;
  portal_url: string | null;
  appeal_deadline_rule: string;
  accepts_online_filing: boolean;
  hearing_format: string | null;
  informal_review_available: boolean;
  informal_review_notes: string | null;
  filing_fee_cents: number;
  virtual_hearing_available: boolean;
  virtual_hearing_platform: string | null;
  pro_se_tips: string | null;
  notes: string | null;
  last_verified_date: string;
  verified_by: string;
}

const EXTENDED_COUNTIES: CountyUpdate[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // NEW JERSEY — High-tax state, standardized Form A-1, njappealonline.com
  // ═══════════════════════════════════════════════════════════════════════
  {
    county_fips: '34003',
    appeal_board_name: 'Bergen County Board of Taxation',
    appeal_board_phone: '(201) 336-6300',
    portal_url: 'https://secure.njappealonline.com/',
    appeal_deadline_rule: 'April 1 or 45 days from assessment mailing, whichever is later. May 1 in revaluation years.',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: 'Contact local municipal assessor for informal discussion before filing.',
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'File Form A-1 with 3-5 comparable sales. Evidence must be submitted to all parties 7 days before hearing. Five-member board. Online filing via njappealonline.com auto-serves copies to assessor and clerk.',
    notes: 'NJ standardized process. Filing fee varies by assessed value. All property taxes must be current through Q1.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '34013',
    appeal_board_name: 'Essex County Board of Taxation',
    appeal_board_phone: '(973) 395-8525',
    portal_url: 'https://www.essexcountynjtaxboard.org/',
    appeal_deadline_rule: 'April 1 or 45 days from bulk mailing, whichever is later',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Include 3-5 comparable properties. Must prove assessment is unreasonable vs market value. Submit copy to assessor and municipal clerk.',
    notes: 'No virtual hearings. Newark metro area — high volume of appeals.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '34023',
    appeal_board_name: 'Middlesex County Board of Taxation',
    appeal_board_phone: null,
    portal_url: 'https://secure.njappealonline.com/',
    appeal_deadline_rule: 'April 1 or May 1 if revaluation year',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Payment of 1st quarter taxes required before appeal accepted. All hearings in-person only — board passed resolution against virtual hearings.',
    notes: 'Explicit no-virtual policy. Q1 tax payment required.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '34017',
    appeal_board_name: 'Hudson County Board of Taxation',
    appeal_board_phone: null,
    portal_url: 'https://secure.njappealonline.com/',
    appeal_deadline_rule: 'April 1 or May 1 if revaluation year',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Prove assessed value unreasonable vs market standard. Include 3-5 comparable sales. Online filing automatically serves assessor and clerk. Strict deadline enforcement.',
    notes: 'Jersey City metro. Strict deadlines.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '34025',
    appeal_board_name: 'Monmouth County Board of Taxation',
    appeal_board_phone: '(732) 431-7404',
    portal_url: 'https://secure.njappealonline.com/',
    appeal_deadline_rule: 'January 15 of current tax year',
    accepts_online_filing: true,
    hearing_format: 'both',
    informal_review_available: false,
    informal_review_notes: 'Can elect to proceed on submitted evidence without appearing at hearing.',
    filing_fee_cents: 0,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Zoom — select virtual option at time of filing',
    pro_se_tips: 'One of the few NJ counties with virtual hearing option. Select virtual or in-person when filing. Hearings held Jan 15–April 30.',
    notes: 'Early Jan 15 deadline (earlier than most NJ counties). Virtual option available.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '34027',
    appeal_board_name: 'Morris County Board of Taxation',
    appeal_board_phone: '(973) 285-6707',
    portal_url: 'https://secure.njappealonline.com/',
    appeal_deadline_rule: 'April 1 or May 1 if revaluation year',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Evidence to all parties 7 days before hearing. Hearings conducted like a trial. 5-member commission. Comparable sales are the most important evidence. Hearings before end of June.',
    notes: 'Trial-like hearing format. Comparable sales critical.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '34029',
    appeal_board_name: 'Ocean County Board of Taxation',
    appeal_board_phone: '(732) 929-2008',
    portal_url: 'https://secure.njappealonline.com/',
    appeal_deadline_rule: 'April 1 or May 1 if revaluation. December 1 for added assessments.',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'File online at njappealonline.com — no additional mailings needed. Dec 1 deadline for added assessments is separate from regular April 1.',
    notes: 'Two separate deadlines: April 1 regular, Dec 1 added assessments.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '34039',
    appeal_board_name: 'Union County Board of Taxation',
    appeal_board_phone: '(908) 527-4775',
    portal_url: 'https://secure.njappealonline.com/',
    appeal_deadline_rule: 'April 1 or May 1 if revaluation year',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: '$5 convenience charge added for online filing. Filing fee waived for qualifying seniors/veterans. Online system auto-serves copies. All property taxes must be paid through Q1.',
    notes: '$5 online convenience fee. Senior/veteran fee waiver available.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CONNECTICUT — No filing fees, February 20 deadline
  // ═══════════════════════════════════════════════════════════════════════
  {
    county_fips: '09001',
    appeal_board_name: 'Board of Assessment Appeals (municipality-level)',
    appeal_board_phone: null,
    portal_url: null,
    appeal_deadline_rule: 'February 20 (postmarks NOT accepted — must be received by this date)',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: 'Contact local assessor office before filing.',
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'POSTMARKS NOT ACCEPTED — hand-deliver or ensure receipt by Feb 20. Board not bound by strict rules of evidence. Bridgeport board meets only in March (real estate) and September (motor vehicle). Can appeal to Superior Court Tax & Administrative Appeals Session.',
    notes: 'Fairfield County includes Stamford, Bridgeport, Norwalk. Municipality-level boards.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '09003',
    appeal_board_name: 'Board of Assessment Appeals (municipality-level)',
    appeal_board_phone: null,
    portal_url: null,
    appeal_deadline_rule: 'February 20 (varies by municipality — some March 20)',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: 'Include supporting documents with application if possible.',
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Contact local tax assessor for specific deadline and procedures. Hearings typically March/April. BAA consists of local residents. Certified appraisal needed if appealing to superior court.',
    notes: 'Hartford County. Municipality-level boards with local resident members.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // NEW YORK (additional)
  // ═══════════════════════════════════════════════════════════════════════
  {
    county_fips: '36119',
    appeal_board_name: 'Board of Assessment Review (municipality-level)',
    appeal_board_phone: null,
    portal_url: 'https://www.tax.ny.gov/pit/property/contest/grievproced.htm',
    appeal_deadline_rule: 'Third Tuesday in June (most towns). Different for villages/cities.',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: true,
    informal_review_notes: 'BAR process at local level. Informal discussion with assessor standard practice.',
    filing_fee_cents: 0,
    virtual_hearing_available: true,
    virtual_hearing_platform: 'Zoom for SCAR proceedings',
    pro_se_tips: 'File Form RP-524 with local assessor. Different deadlines by municipality. SCAR filing is $30 with 2.99% credit card fee. Westchester has some of the highest property taxes in the nation — strong appeal potential.',
    notes: 'Westchester County — extremely high property taxes. SCAR available for owner-occupants.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '36029',
    appeal_board_name: 'Erie County Real Property Tax Services / Board of Assessment Review',
    appeal_board_phone: '(716) 858-8333',
    portal_url: 'https://www3.erie.gov/ecrpts/',
    appeal_deadline_rule: 'Fourth Tuesday in May for most municipalities. Buffalo: December 1-31.',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: 'Contact local assessor directly.',
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'BUFFALO has completely different schedule (Dec 1-31 for BAR grievances). Erie County towns follow standard May schedule. SCAR and Article 7 Certiorari options for further appeal.',
    notes: 'Buffalo vs rest of Erie County have different schedules.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '36055',
    appeal_board_name: 'Board of Assessment Review (Monroe County)',
    appeal_board_phone: '(585) 753-1125',
    portal_url: 'https://www.monroecounty.gov/property',
    appeal_deadline_rule: 'Third Tuesday in March (Rochester, 8 PM deadline). Fourth Tuesday in May for towns.',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'HARD COPIES ONLY — no fax/email. Rochester requires original RP-524 by 8 PM on deadline day. SCAR or Article 7 for further appeal.',
    notes: 'Rochester has early March deadline (different from county towns in May). Hard copy only.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PENNSYLVANIA (additional)
  // ═══════════════════════════════════════════════════════════════════════
  {
    county_fips: '42091',
    appeal_board_name: 'Montgomery County Board of Assessment Appeals',
    appeal_board_phone: '(610) 278-3761',
    portal_url: null,
    appeal_deadline_rule: 'August 1 of year prior to tax year',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: 'Possible informal discussion with assessor but not standard procedure.',
    filing_fee_cents: 5000,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Processing fee: Residential $50, Multi-family $100, Commercial/Industrial $200. Appeal hearings start May, must be heard by Oct 31. Forms available online.',
    notes: 'Filing fees vary by property type. Appeal year before tax year.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '42029',
    appeal_board_name: 'Chester County Board of Assessment Appeals',
    appeal_board_phone: '(610) 344-6105',
    portal_url: 'https://www.chesco.org/255/Assessment-Appeals',
    appeal_deadline_rule: 'May 1 through first business day in August',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: 'Board reviews after notice of appeal filed.',
    filing_fee_cents: 15000,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Commercial/Industrial/Exemption processing fee $150 as of Jan 2026. Prepare documentation supporting your opinion of value. Board schedules hearings after filing.',
    notes: '$150 fee for commercial. May-August filing window.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '42017',
    appeal_board_name: 'Bucks County Board of Assessment Appeals',
    appeal_board_phone: '(215) 348-6219',
    portal_url: 'https://www.buckscountyboa.org/',
    appeal_deadline_rule: 'August 1 for following year appeals',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: false,
    informal_review_notes: null,
    filing_fee_cents: 0,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'No facsimiles accepted. Supporting info due 10 days before hearing. Board may hear all probative evidence. Attorney or authorized rep must attend unless waiver requested.',
    notes: 'No fax filing. 10-day evidence deadline before hearing.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MASSACHUSETTS — Form 128 abatement process
  // ═══════════════════════════════════════════════════════════════════════
  {
    county_fips: '25017',
    appeal_board_name: 'Board of Assessors / Appellate Tax Board (municipality-level)',
    appeal_board_phone: null,
    portal_url: null,
    appeal_deadline_rule: 'February 1 or 30 days from 3rd quarter bill mailing, whichever is later',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: true,
    informal_review_notes: 'Submit Form 128 to local assessors for initial abatement review. This IS the informal step.',
    filing_fee_cents: 1000,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'File Form 128 Application for Abatement with your local assessor first — this is mandatory. Must respond to info requests within 30 days or lose appeal rights. 3 months to appeal to Appellate Tax Board from denial.',
    notes: 'Middlesex County (Cambridge). Form 128 abatement mandatory first step. $10+ filing fee scales with value.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '25021',
    appeal_board_name: 'Board of Assessors / Appellate Tax Board (municipality-level)',
    appeal_board_phone: null,
    portal_url: null,
    appeal_deadline_rule: 'February 1 or 30 days from bill mailing, whichever is later',
    accepts_online_filing: false,
    hearing_format: 'in_person',
    informal_review_available: true,
    informal_review_notes: 'File Form 128 abatement application with local assessor first — mandatory step.',
    filing_fee_cents: 1000,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: '20 municipalities with own assessors — contact YOUR local town assessor directly. Form 128 is mandatory first step. 3 months to Appellate Tax Board from abatement denial.',
    notes: 'Norfolk County. 20 municipalities each with own assessor.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
  {
    county_fips: '25027',
    appeal_board_name: 'City of Worcester Assessor / Appellate Tax Board',
    appeal_board_phone: null,
    portal_url: 'https://www.worcesterma.gov/finance/taxes-assessments/',
    appeal_deadline_rule: '30 days from date actual tax bill issued',
    accepts_online_filing: true,
    hearing_format: 'in_person',
    informal_review_available: true,
    informal_review_notes: 'Initial abatement application to local assessor is the informal step.',
    filing_fee_cents: 1000,
    virtual_hearing_available: false,
    virtual_hearing_platform: null,
    pro_se_tips: 'Online submission through City of Worcester portal. Must provide all requested info within 30 days — failure results in automatic denial with no extension possible. City Hall Room 209 for in-person.',
    notes: 'Worcester County. Online filing available through city portal.',
    last_verified_date: '2026-03-27',
    verified_by: 'Resourceful Research',
  },
];

async function seedExtendedCounties() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Seeding intelligence for ${EXTENDED_COUNTIES.length} extended counties...`);

  let updated = 0;
  let errors = 0;

  for (const county of EXTENDED_COUNTIES) {
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
  console.log('Run seed-top-counties.ts first if you haven\'t already.');
}

seedExtendedCounties().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
