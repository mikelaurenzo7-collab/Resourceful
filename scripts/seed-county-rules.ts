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

// ─── State-Level Advanced Appeal Strategies ─────────────────────────────────
// Deep expertise for each state's unique assessment and appeal landscape.
// Injected into AI prompts so the AI crafts state-specific arguments.

const STATE_STRATEGIES: Record<string, string> = {
  AL: `ALABAMA STRATEGIES:
- Alabama uses a classified property tax system (Class I-IV) with different ratios. Verify the property is in the correct class — misclassification is common and immediately reduces the assessed value.
- Current use valuation: agricultural, forest, and timberland can be assessed at current use rather than market value (Code of Alabama §40-7-25.1). If applicable, this dramatically reduces assessment.
- The county Board of Equalization meets annually. Bring comparable sales AND the county's own sales ratio study — if the ratio exceeds the statutory level, the entire class is over-assessed.
- Alabama has no statewide reassessment cycle — some counties haven't reassessed in decades. If the assessment uses outdated base values, challenge the effective date of the valuation.`,

  AK: `ALASKA STRATEGIES:
- Alaska has no state property tax — each municipality sets its own. Appeal rules vary significantly by borough/municipality.
- Senior and disabled veteran exemptions can dramatically reduce assessable value. Verify all applicable exemptions are applied.
- In Anchorage, the Board of Equalization process allows informal hearings that frequently result in reductions without formal proceedings.
- Alaska's housing market is highly seasonal and location-dependent. Urban vs rural valuation metrics differ enormously — ensure comps are truly comparable in location context.`,

  AZ: `ARIZONA STRATEGIES:
- Arizona has TWO assessed values: Full Cash Value (FCV) and Limited Property Value (LPV). LPV cannot increase more than 5% per year (A.R.S. §42-13301). If the LPV jump exceeds 5%, it's automatically illegal.
- Challenge the property class — Arizona has 9 legal classes with different ratios. Residential (Class 3, 10%) vs commercial (Class 1, 18%) classification errors are common for mixed-use properties.
- Arizona allows "comparable sales" AND "income approach" AND "cost approach" evidence. Use ALL THREE — the Board must consider each.
- County assessors must use the "five approaches to value" and apply the most appropriate. If they relied solely on mass appraisal without considering your property's specific characteristics, challenge the methodology.`,

  AR: `ARKANSAS STRATEGIES:
- Arkansas requires uniform assessment at 20% of market value (Amendment 79). Calculate: if assessed_value / market_value ≠ 0.20, the assessment violates the state constitution.
- Amendment 79 caps annual increases at 5% for homestead properties and 10% for non-homestead. If the increase exceeds these caps, it's unconstitutional regardless of market value.
- The County Equalization Board has LIMITED authority — they can only equalize within the county. For substantive value challenges, file with the County Court.
- Arkansas has a homestead tax credit (up to $375). Verify it's applied.`,

  CA: `CALIFORNIA STRATEGIES — PROP 13 EXPERTISE:
- Proposition 13 limits assessed value growth to 2% per year from the base year value (purchase price). If the current assessment exceeds purchase_price × 1.02^(years_owned), it's illegal under Article XIIIA.
- PROPOSITION 8 DECLINE IN VALUE: If current market value drops BELOW the Prop 13 factored base year value, you're entitled to a temporary reduction to current market value (Revenue & Taxation Code §51). This resets annually — must file each year the decline exists.
- Change of ownership triggers reassessment to current market value. But EXCLUDED transfers (parent-child via Prop 19, interspousal) should NOT trigger reassessment. Verify no improper reassessment occurred.
- Proposition 19 (2021): Changed parent-child exclusion rules. Only primary residences qualify, with a $1M value difference cap. If a transfer occurred after Feb 2021, verify proper application.
- Assessment appeals in CA take 1-2 YEARS. File early. The refund is retroactive to the tax year in question.
- Supplemental assessments after purchase or new construction can be challenged separately from the regular roll.`,

  CO: `COLORADO STRATEGIES:
- Colorado's residential ratio changes frequently (currently ~6.55%, but the legislature adjusts it). Verify the assessor used the CURRENT ratio, not last cycle's.
- Reassessment occurs every odd-numbered year. The actual value is based on the 18-month study period ending June 30 of the prior year. If market conditions have shifted since the study period, the data is stale.
- Colorado allows protest to the county assessor first (May 1-June 1), then appeal to the County Board of Equalization, then to the Board of Assessment Appeals (BAA) or District Court. The BAA process is FREE and often more favorable than county-level.
- The Gallagher Amendment (now repealed but its effects linger) created the residential/commercial ratio split. Understand which ratio applies to your property classification.`,

  CT: `CONNECTICUT STRATEGIES:
- Connecticut assesses at 70% of fair market value. Calculate: if assessed_value > (market_value × 0.70), the assessment is illegal.
- Revaluation cycles vary by municipality (every 5 years with annual adjustments). In revaluation years, challenge the base value aggressively — it sets the foundation for the next 5 years.
- Personal property tax on business equipment is a major Connecticut feature. If this is a commercial property, ensure equipment is not being double-counted in real property assessment.
- PA 490 — farmland, forest, and open space can be assessed at current use value. If the property qualifies, this can reduce assessment by 80%+.
- The Board of Assessment Appeals meets in March. Present BOTH income approach and sales comparison for commercial properties — Connecticut boards are sophisticated.`,

  DE: `DELAWARE STRATEGIES:
- Delaware has NOT conducted statewide reassessment in decades (some counties since the 1980s). Base values are wildly outdated. Challenge whether the assessment reflects current methodology or frozen historical values.
- No state property tax — all property tax is local (county + school district). Each jurisdiction may have different equalization practices.
- Delaware has a very low effective tax rate compared to neighboring states, but assessments can still be disproportionate within jurisdictions.
- Senior citizen school property tax credit and additional exemptions may apply. Verify all exemptions.`,

  FL: `FLORIDA STRATEGIES — SAVE OUR HOMES EXPERTISE:
- SAVE OUR HOMES (SOH) CAP: Homestead property assessment increases are capped at 3% or CPI (whichever is LESS) per year (Article VII, §4). If the increase exceeds this cap, it's unconstitutional. Calculate precisely.
- SOH PORTABILITY: When you sell and buy, you can transfer up to $500,000 of SOH benefit to your new homestead (§193.155). Verify the portability was properly applied at purchase.
- Non-homestead properties have a 10% annual cap on assessment increases (§193.1555). Verify compliance.
- TRIM NOTICE (Truth in Millage): You have only 25 DAYS from the TRIM notice to file with the Value Adjustment Board. Do NOT miss this deadline.
- Florida has a $50,000 homestead exemption ($25,000 applies to all taxes, additional $25,000 to non-school taxes). Verify both exemptions are applied.
- Agricultural classification (greenbelt) can reduce assessment by 50-90%. If the property has ANY agricultural use, investigate.
- The Value Adjustment Board (VAB) hears appeals — these are quasi-judicial proceedings. Treat them seriously.`,

  GA: `GEORGIA STRATEGIES:
- Georgia assesses at 40% of fair market value. The math must work: assessed_value = market_value × 0.40. If assessed_value / 0.40 > provable market value, the assessment is wrong.
- Covenant (conservation use) valuation for agricultural property can reduce assessment by 75%+. 10-year covenant required.
- Annual notice of assessment must be sent by April 1. If the county failed to provide proper notice, the assessment may be challengeable on procedural grounds.
- County Board of Tax Assessors can be challenged at both the county AND state level. The Superior Court route allows de novo review — meaning the court makes its own value determination from scratch.
- Georgia's taxpayer bill of rights requires the county to bear the burden of proof in appeals. The assessor must justify their value — you don't have to disprove it.`,

  HI: `HAWAII STRATEGIES:
- Hawaii's property tax is administered by each county (Honolulu, Maui, Hawaii, Kauai). Each has different rates, classifications, and appeal procedures.
- Land value constitutes a massive portion of assessed value in Hawaii (often 70-90%). Challenge the land value separately from improvements — land over-assessment is the most common error.
- Condo unit assessment should reflect the unit's proportional share, not the entire building value. Verify the proration methodology.
- Agricultural dedication can dramatically reduce land assessment. If ANY agricultural activity exists, investigate.
- Honolulu has a home exemption of $100,000+ for owner-occupants. Verify it's applied.`,

  ID: `IDAHO STRATEGIES:
- Idaho assesses at 100% of market value with a homeowner's exemption (50% of assessed value up to a maximum, currently ~$125,000). Verify the exemption is applied and at the correct amount.
- Property tax is subject to the 3% annual cap on total tax levy increases (not assessment). This limits how much total tax can increase even if assessments rise.
- Agricultural land is valued at productive capacity, not market value. If the property has agricultural use, ensure it's classified correctly.
- The Board of Tax Appeals offers a formal, state-level appeal process that's often more favorable than the county board. File within 30 days of county decision.`,

  IL: `ILLINOIS STRATEGIES — COOK COUNTY EXPERTISE:
- Illinois nominally assesses at 33.33% of fair market value, BUT Cook County uses a CLASSIFIED system: 10% for residential, 25% for commercial/industrial. Verify the correct class.
- THE EQUALIZATION FACTOR (multiplier): The state applies an equalization factor to bring county assessments to the 33.33% level. This multiplier changes annually. Your effective assessed value = local_assessed_value × equalization_factor. If the equalization factor was misapplied, the entire assessment is wrong.
- Cook County operates on a TRIENNIAL reassessment cycle by township. Know which year your township was reassessed and when the next cycle hits.
- Certificate of Error: If the assessor made a factual error (wrong square footage, wrong building class, incorrect age), you can request a Certificate of Error for immediate correction — no appeal needed.
- KADLEC DOCTRINE (Kadlec v. Illinois, 2008): Assessed value must be reduced if you demonstrate ANY decline in market value, even if the assessment ratio is below 33.33%.
- PTAB vs Board of Review: The Board of Review hears initial appeals (free). The Property Tax Appeal Board (PTAB) hears secondary appeals (also free). PTAB is often more favorable for well-documented cases.
- Incentive classifications: Class 6b, 7a, 7b, 8 in Cook County provide reduced assessment levels for commercial/industrial rehabilitation projects.`,

  IN: `INDIANA STRATEGIES:
- Indiana transitioned to market-based assessment in 2002. The trending factor must be current. If the assessor is using outdated trending, the assessment is stale.
- The Form 130 (Notice of Assessment/Change) must be filed within 45 days. Form 131 (Correction of Error) can be filed ANY TIME for factual errors.
- Personal property returns (Form 103/104) for business equipment are separate from real property. Ensure no double-counting.
- Indiana has an assessment cap: 1% of gross assessed value for homesteads, 2% for residential rental/farmland, 3% for all other. If taxes EXCEED these caps, you get an automatic credit — verify it's applied.
- The IBTR (Indiana Board of Tax Review) hears state-level appeals and is generally more favorable for well-documented cases than county PTABOA.`,

  IA: `IOWA STRATEGIES:
- Iowa assesses at 100% of market value with a rollback (assessment limitation) that effectively reduces the taxable percentage. The rollback changes annually — verify the correct rollback is applied.
- Protest period is short: April 2-30 in odd-numbered years only. In even-numbered years, you can only challenge if the value changed or an error occurred.
- Agricultural property has its own valuation formula based on productivity (CSR2 scores × commodity prices). If your property has ag land, verify the CSR2 scores match the soil survey.
- The Property Assessment Appeal Board (PAAB) is the state-level appeal body and handles complex cases with more expertise than local boards.`,

  KS: `KANSAS STRATEGIES:
- Kansas classifies property into subclasses with different ratios: residential (11.5%), commercial/industrial (25%), agricultural (30% of use value). Misclassification is a common error.
- Agricultural use value is based on 8-year average income capitalization. If the land has transitioned from agricultural use, the assessment should reflect the transition year, not full market value immediately.
- Payment Under Protest: Kansas allows you to pay taxes under protest and then litigate. The protest must be filed with the county treasurer when you pay.
- The Kansas Board of Tax Appeals (BOTA) hears state-level appeals and can award refunds for multiple tax years if the assessment was consistently wrong.`,

  KY: `KENTUCKY STRATEGIES:
- Kentucky assesses at 100% of fair cash value. The PVA (Property Valuation Administrator) in each county is elected — political accountability can influence assessment practices.
- Kentucky's Homestead Exemption for seniors (65+) and disabled persons exempts a portion of assessed value from state and county taxes.
- You have ONE FULL YEAR to appeal (from January 1 assessment date). This is unusually generous — use it.
- The Kentucky Board of Tax Appeals is a state-level appellate body that provides de novo review. If the county conference board doesn't give you satisfaction, escalate.`,

  LA: `LOUISIANA STRATEGIES:
- Louisiana assesses at 10% (residential) or 15% (commercial) of fair market value. The math: assessed_value / ratio must equal market value. If it doesn't, the assessment is mathematically wrong.
- Homestead exemption: First $7,500 of assessed value is exempt from parish (county) taxes for owner-occupied residential. Verify it's applied.
- Louisiana has VERY SHORT filing deadlines — only 15 calendar days after public notice of tax rolls. Miss it and you wait another year.
- Special assessment levels exist for historic properties under the Louisiana Restoration Tax Abatement program. If applicable, this freezes assessment for 5 years.`,

  ME: `MAINE STRATEGIES:
- Maine assesses at 100% of "just value." Municipal assessing practices vary widely. Some towns haven't updated valuations in 10+ years.
- The state equalization ratio (sales ratio) shows how accurate each municipality's assessments are. If your town's ratio is significantly off 100%, ALL assessments in that town are suspect.
- Tree Growth Tax: forestland enrolled in Maine's Tree Growth program is valued at current use (often 90%+ reduction). Verify enrollment if applicable.
- Farmland/Open Space programs also provide use-value assessment. Short application windows apply.`,

  MD: `MARYLAND STRATEGIES:
- Maryland reassesses on a TRIENNIAL cycle — your property is in one of three groups. The assessment is phased in over 3 years (1/3 of the change per year). Verify the phase-in is calculated correctly.
- The Homestead Tax Credit limits assessment increases for owner-occupied properties to 10% per year (or less — Baltimore City caps at 4%). If the increase exceeds the cap, challenge it.
- Maryland has a Homeowners' Tax Credit based on income — this can provide significant relief for qualifying homeowners.
- Appeal to the Supervisor of Assessments first (informal), then the Property Tax Assessment Appeals Board, then Maryland Tax Court. Each level provides fresh review.`,

  MA: `MASSACHUSETTS STRATEGIES:
- Massachusetts assesses at 100% of full and fair cash value, updated annually. The DOR certifies values every 3 years with annual interim adjustments.
- The residential exemption (available in some communities like Boston) shifts tax burden from lower-value to higher-value properties. Verify if your community offers it.
- Proposition 2½ limits total levy increases to 2.5% per year — but individual assessments can still increase significantly if market values shift within the town.
- The Appellate Tax Board (ATB) is a sophisticated state-level tribunal. Present professional-quality evidence. ATB decisions are well-documented precedent.
- Abatement application deadline is strict — within 3 months of the ACTUAL (not preliminary) tax bill mailing date.`,

  MI: `MICHIGAN STRATEGIES:
- Michigan has TWO values: Assessed Value (50% of market) and Taxable Value. Proposal A (1994) caps Taxable Value increases at 5% or inflation (whichever is less). Your challenge should focus on ASSESSED VALUE — Taxable Value is separately calculated.
- UNCAPPING: When property transfers, Taxable Value uncaps to Assessed Value. If you recently purchased, verify the uncapped value is correct based on your purchase price.
- The Michigan Tax Tribunal (MTT) is the state-level appeal body. For residential properties under $100K assessed value, the MTT Small Claims Division provides a streamlined process.
- Principal Residence Exemption (PRE) exempts owner-occupied homes from 18 mills of school operating tax. Verify it's applied — improper denial is common.
- Board of Review meets in March. If you miss it, you can petition the MTT directly (July Board of Review for hardship/poverty).`,

  MN: `MINNESOTA STRATEGIES:
- Minnesota uses market value assessment with a classification system that determines the tax rate. Residential homestead has the most favorable classification. Verify your property is correctly classified.
- The Open Book meeting (informal, in April) is your BEST opportunity — assessors can make changes on the spot without formal proceedings. Always attend.
- The Board of Appeal and Equalization meets in June. This is a formal proceeding with elected officials.
- Minnesota Tax Court provides state-level appeal with professional judges. Recommended for high-value properties or complex issues.
- Green Acres program allows agricultural land in metropolitan areas to be valued at agricultural use rather than development potential.`,

  MS: `MISSISSIPPI STRATEGIES:
- Mississippi assesses residential at 10% and commercial at 15% of true value. Verify the correct class and ratio.
- Homestead exemption: first $7,500 of assessed value ($75,000 true value) is exempt for owner-occupied. Verify application.
- Mississippi has very short appeal windows (15 days from notice). Act immediately upon receiving your assessment notice.
- The Board of Supervisors has broad equalization authority. Present systematic evidence of over-assessment relative to similar properties.`,

  MO: `MISSOURI STRATEGIES:
- Missouri reassesses in odd-numbered years. Residential is assessed at 19%, commercial at 32% of market value.
- The informal appeal process (assessor's office) resolves ~60% of disputes. Start there with your evidence — many assessors will negotiate.
- Missouri has a "prevailing party" rule at the State Tax Commission level — if you win, the county may have to pay your costs. This discourages frivolous county defenses.
- Agricultural use value applies to actively farmed land. Even small agricultural operations (bees, hay) can qualify.
- The State Tax Commission provides de novo hearing with professional hearing officers. Recommended for high-value commercial properties.`,

  MT: `MONTANA STRATEGIES:
- Montana reassesses biennially. Market value is phased in over 2 years to prevent shock increases.
- Montana has a residential property tax assistance program (RPTA) for low-income homeowners. If applicable, this provides direct tax reduction.
- Agricultural land is valued at productive capacity using the DNRC agricultural classification system. Verify the land classification matches the soil type and productivity.
- The Montana State Tax Appeal Board provides a streamlined appeal process. Cases are decided on written submissions — quality of documentation is paramount.`,

  NE: `NEBRASKA STRATEGIES:
- Nebraska assesses at 100% of actual value. The state equalization process ensures inter-county uniformity — if your county's overall ratio is off, ALL properties may be adjusted.
- Agricultural land is valued using a capitalization of income approach with mandated income and capitalization rates. Verify the assessor used current NRCS soil classifications.
- The Tax Equalization and Review Commission (TERC) is the state-level appeal body. TERC decisions are binding and well-documented.
- June 1-30 is the protest period to the County Board of Equalization. Do not miss this window.`,

  NV: `NEVADA STRATEGIES:
- Nevada assesses at 35% of taxable value, with a partial abatement that caps tax increases. Verify the abatement is applied correctly.
- The tax cap limits primary residential property tax increases to 3% per year and all other property to 8% per year.
- Obsolescence deductions: Nevada law specifically allows depreciation and obsolescence deductions. For older properties, challenge whether adequate depreciation has been applied.
- Personal property (business equipment) is assessed separately. Ensure no double-counting with real property improvements.`,

  NH: `NEW HAMPSHIRE STRATEGIES:
- New Hampshire has NO state income tax or sales tax — property tax is the primary revenue source, making assessments particularly aggressive.
- Assessments should reflect "full and true value" — but equalization ratios show many towns are significantly off. The DRA publishes equalization ratios annually. If your town's ratio is below 100%, your assessment may be disproportionately high.
- The Board of Tax and Land Appeals (BTLA) provides state-level appeal with professional adjudicators. For complex cases, this is often more favorable than the local Board of Civil Authority.
- Current use assessment for qualifying open space, farmland, and forest dramatically reduces land value. Application deadlines are strict.`,

  NJ: `NEW JERSEY STRATEGIES:
- New Jersey has some of the HIGHEST property taxes in the nation. Appeals are critical and common.
- The Chapter 123 "Freeze Act": if you win an appeal, the assessment is FROZEN for 2 years at the reduced level (for non-revaluation years). This makes winning an appeal even more valuable.
- Added/Omitted Assessments: if improvements were completed after October 1, only a proportional assessment applies. Verify the added assessment reflects the correct completion date.
- NJ Tax Court handles appeals over $1M — this is a formal judicial proceeding. For smaller properties, the County Tax Board process is less formal.
- Farmland Assessment Act: qualified farmland is assessed at agricultural use value (often $100-500/acre instead of $100,000+/acre). Even 5 acres of productive land can qualify.
- Revaluation years reset ALL assessments. Challenge aggressively in revaluation years — the next chance may be years away.`,

  NM: `NEW MEXICO STRATEGIES:
- New Mexico assesses at 33.33% of market value. The head of family exemption ($2,000 off assessed value) and veterans' exemption ($4,000) must be verified.
- Valuation protests must be filed within 30 days of notice. The County Valuation Protests Board is generally receptive to well-documented comparable sales evidence.
- Agricultural/ranch land has special use-value assessment. Verify the productivity classification if applicable.`,

  NY: `NEW YORK STRATEGIES:
- New York assessment practices vary DRAMATICALLY by municipality. NYC operates under a completely different system than the rest of the state.
- EQUALIZATION RATES: The state publishes equalization rates for every municipality. If your municipality's rate is below 100%, your assessment may be effectively higher than 100% of market value. Challenge using the equalization rate.
- GRIEVANCE DAY: Third Tuesday in May (most municipalities). This is your ONLY chance for the year. Miss it and you wait 12 months.
- SMALL CLAIMS ASSESSMENT REVIEW (SCAR): Available for residential properties assessed under $450,000. Streamlined process with independent hearing officers. Highly recommended — success rates are strong.
- NYC properties: assessed at different percentages by class (6% for Class 1 residential, 45% for Class 4 commercial). Transitional assessments phase in changes over 5 years. Verify the phase-in math.
- STAR exemption (School Tax Relief): Verify both Basic and Enhanced STAR are applied if eligible. Enhanced STAR for seniors provides significant additional exemption.`,

  NC: `NORTH CAROLINA STRATEGIES:
- North Carolina requires counties to reassess at least every 8 years (many do every 4). In reassessment years, challenge the base value aggressively — it sets the foundation for years.
- Present Use Value (PUV): Agricultural, horticultural, and forestland qualifies for use-value assessment. Deferred taxes apply if the property exits the program (3 years of rollback). Verify enrollment.
- The Board of Equalization and Review hears appeals at the county level. If unsatisfied, appeal to the Property Tax Commission (state level) within 30 days.
- NC has an elderly/disabled exclusion ($25,000+ of assessed value for qualifying homeowners). Verify eligibility and application.`,

  ND: `NORTH DAKOTA STRATEGIES:
- North Dakota assesses at 50% of true and full value (9% for agricultural). The assessment must reflect the correct classification ratio.
- Agricultural land is valued using a productivity formula based on NRCS soil classifications. Verify the soil data matches your property.
- The appeal process starts at the city/township level (April), then county (June). The timeline is compressed — prepare early.
- The Homestead Credit provides property tax relief for qualifying homeowners. Verify application.`,

  OH: `OHIO STRATEGIES:
- Ohio reassesses every 6 years with a triennial update at year 3. In update years, values are adjusted by the county auditor using aggregate market data — NOT individual property inspection. Challenge whether the aggregate adjustment accurately reflects YOUR property.
- COMPLAINT TO BOARD OF REVISION: File January 1 through March 31. You need evidence of value AS OF January 1 of the tax year. Recent sales within 12 months of that date are most persuasive.
- The Ohio Board of Tax Appeals (BTA) hears state-level appeals. BTA decisions are precedent-setting — cite prior BTA decisions that support your position.
- CAUV (Current Agricultural Use Value): Farmland assessed at agricultural use value rather than market value. Significant savings but requires annual application.
- Owner-occupied tax reduction: 2.5% rollback on Class 1 property. Verify it's applied.`,

  OK: `OKLAHOMA STRATEGIES:
- Oklahoma assesses at 11% of fair cash value for all property types. The math must work: assessed_value / 0.11 = implied market value. If implied market value exceeds provable market value, the assessment is wrong.
- Homestead exemption: $1,000 of assessed value exempt. Additional exemption for seniors with income under $12,000.
- Agricultural use property has special valuation. Verify correct classification.
- The County Board of Equalization meets in April. File promptly upon receiving notice.`,

  OR: `OREGON STRATEGIES:
- Oregon has TWO values: Real Market Value (RMV) and Maximum Assessed Value (MAV). Your TAXES are based on the LOWER of the two. Measure 50 (1997) limits MAV growth to 3% per year.
- Challenge the RMV: Even if your taxes are based on MAV, reducing RMV protects you in future years and prevents MAV from exceeding RMV.
- Exception value: New construction, additions, and major remodeling create "exception value" that's added outside the 3% cap. Verify the exception value accurately reflects the improvement cost, not inflated estimates.
- BOPTA (Board of Property Tax Appeals): Free, informal process. Present comparable sales within 12 months of January 1 assessment date. BOPTA hears thousands of appeals annually — be concise and data-driven.
- Oregon Tax Court: For complex cases. Magistrate Division handles smaller cases with streamlined procedures.`,

  PA: `PENNSYLVANIA STRATEGIES:
- Pennsylvania assessment practices vary dramatically by county. Some counties haven't reassessed in 20+ years. The Common Level Ratio (CLR) published by the State Tax Equalization Board adjusts for outdated base years.
- USE THE CLR: If your county's CLR is 0.50, the effective assessment should be 50% of market value — even if the county's "assessment ratio" is nominally 100%. Calculate: assessed_value / CLR = implied market value. If this exceeds actual market value, you're over-assessed.
- Homestead exclusion: many school districts offer a homestead exclusion (Act 50). Verify it's applied.
- Clean and Green (Act 319): Agricultural and forest reserve land assessed at use value. Rollback taxes apply on conversion.
- The Board of Assessment Appeals varies by county. In Allegheny County, use the online filing system. In Philadelphia, file with the Board of Revision of Taxes.`,

  RI: `RHODE ISLAND STRATEGIES:
- Rhode Island revalues every 9 years with statistical updates every 3 years. Challenge aggressively during full revaluation years.
- The Veterans' Exemption and other exemptions vary by municipality. Verify all applicable exemptions.
- Motor vehicle excise tax phase-out affects total tax burden calculations. Consider total tax impact when evaluating assessment fairness.
- Appeal to the local Board of Tax Assessment Review, then to Superior Court for judicial review.`,

  SC: `SOUTH CAROLINA STRATEGIES:
- South Carolina has extremely LOW residential ratio (4%) but higher commercial (6%) and manufacturing (10.5%). CLASSIFICATION IS CRITICAL — if a residential property is misclassified as commercial, the tax impact is enormous.
- Legal residence (owner-occupied): 4% ratio. Investment/rental: 6% ratio. Verify the correct classification.
- Agricultural use value: qualifying farmland assessed at use value. Requires application and active agricultural use.
- Assessment cap: residential assessed value cannot increase more than 15% within a 5-year reassessment cycle (except upon sale). Verify the cap is applied.
- Point of Sale reassessment: SC reassesses to market value upon transfer. If you recently purchased, verify the reassessment matches your purchase price.`,

  SD: `SOUTH DAKOTA STRATEGIES:
- South Dakota assesses at 85% of full and true value. Verify: assessed_value / 0.85 must equal market value.
- Agricultural land classified using productivity-based valuation. Verify soil classifications and productivity factors.
- Owner-occupied single family dwelling has property tax freeze option for qualifying seniors. Verify eligibility.
- Appeal to local Board of Equalization (third Monday of March), then County Commission, then Office of Hearing Examiners.`,

  TN: `TENNESSEE STRATEGIES:
- Tennessee reassesses every 4-6 years (varies by county). Residential at 25%, commercial/industrial at 40% of appraised value.
- The reappraisal year is critical — challenge the base value, which sets the foundation until the next reappraisal.
- Greenbelt (Agricultural/Forest/Open Space): qualifying property assessed at use value rather than market value. Rollback taxes apply on disqualification (3-5 years depending on category).
- The State Board of Equalization hears appeals from the county board and has independent authority to change values.
- Elderly low-income homeowner tax freeze: qualifying homeowners can freeze their tax amount at the time of application.`,

  TX: `TEXAS STRATEGIES — ADVANCED PROTEST TACTICS:
- UNEQUAL APPRAISAL (Section 41.43(b)(3)): This is often MORE effective than market value challenges. You don't have to prove market value — you only have to prove your property is assessed higher than comparable properties. Find 5 similar properties in your neighborhood assessed lower per sqft.
- The MEDIAN LEVEL OF APPRAISAL is key for unequal appraisal. If your property is assessed at $150/sqft but the median for comparable properties is $130/sqft, you're entitled to a reduction to the median.
- BINDING ARBITRATION: For properties under $5M (residential) or $5M (commercial), you can bypass the ARB entirely and go to binding arbitration. Cost: $500 deposit (refundable if you win). Arbitrators are often more favorable than ARBs.
- INFORMAL SETTLEMENT: ~85% of Texas protests are resolved informally. The appraiser assigned to your case has settlement authority. Lead with your strongest evidence and be prepared to negotiate.
- Homestead exemption: $100,000 school tax exemption (as of 2023). Over-65/disabled: additional $10,000 + tax ceiling freeze. Verify ALL are applied.
- Ag exemption (1-d-1 open-space): Agricultural use valuation based on cash lease rates. Even small operations (bees, cattle on 10 acres) can qualify. Reduces land value by 90%+.
- The Comptroller publishes the Property Value Study annually. If your county's values are systematically off, cite the study.
- 10% appraisal cap: Homestead properties cannot increase more than 10% per year (20% for non-homestead starting 2024). Calculate and verify.`,

  UT: `UTAH STRATEGIES:
- Utah assesses residential at 55% of fair market value, commercial/industrial at 100%. Classification is critical.
- Farmland Assessment Act: qualifying agricultural property assessed at productive value. Application required.
- The Board of Equalization process allows informal resolution. The State Tax Commission hears formal appeals.
- Veterans' exemption available for qualifying disabled veterans — can be significant.`,

  VT: `VERMONT STRATEGIES:
- Vermont's Common Level of Appraisal (CLA) adjusts assessments to reflect how far off each municipality's assessments are from market value. If your town's CLA is 0.85, your $200,000 assessment effectively represents $235,000 — challenge if market value is lower.
- Current Use (Use Value Appraisal): Agricultural and forest land assessed at use value. Provides 80-90% reduction in land value. Land must be enrolled and actively managed.
- The Board of Civil Authority hears appeals at the local level. State Appraiser provides independent review on further appeal.
- Vermont has a homestead declaration requirement — verify it's filed annually. Missing it changes your tax rate from residential to non-residential.`,

  VA: `VIRGINIA STRATEGIES:
- Virginia assessments are done at the city/county level with varying reassessment cycles (annual in some jurisdictions, every 4-6 years in others).
- Land Use Taxation: Agricultural, horticultural, forest, and open space land can be taxed at use value. Rollback taxes apply on conversion (5-6 years).
- The Board of Equalization hears appeals. Members are appointed citizens — present clear, visual evidence.
- Virginia allows Circuit Court appeal after exhausting administrative remedies. De novo review available.
- Elderly and disabled tax relief programs vary by locality. Some provide full exemption for qualifying homeowners.`,

  WA: `WASHINGTON STRATEGIES:
- Washington assesses at 100% of true and fair value. The Department of Revenue publishes ratio studies — if your county's ratio significantly differs from 100%, all assessments in that area are suspect.
- Current Use Assessment: Farm and agricultural land, timber land, and open space land can be classified for current use assessment. Significant value reduction.
- Senior/Disabled Exemption: qualifying homeowners can exempt a portion of assessed value and defer taxes. Income limits apply.
- The Board of Equalization (county level) hears appeals. Board of Tax Appeals (state level) provides additional review. Both are free.
- New construction assessments must reflect actual cost, not speculative market value of the completed improvement.`,

  WV: `WEST VIRGINIA STRATEGIES:
- West Virginia assesses at 60% of appraised value. Verify: assessed_value / 0.60 = appraised value, which must equal market value.
- Classification: Class I (owner-occupied) has a lower rate than Class II (all other property). Verify correct classification.
- Managed timberland has a separate assessment methodology based on productivity. Verify correct timber classification.
- Appeal to the County Commission in February (very short window: Feb 1-20). Then to Circuit Court within 60 days.
- West Virginia has a homestead exemption for seniors (65+) and disabled — first $20,000 of assessed value exempt.`,

  WI: `WISCONSIN STRATEGIES:
- Wisconsin assesses at 100% of full value. The DOR publishes assessment ratios for every municipality — if your municipality's ratio is significantly off, use it as evidence of systemic over-assessment.
- OBJECTION must be filed by the first Monday in May to the Board of Review. The hearing is typically the same week — be prepared.
- Use Value Assessment: Agricultural land assessed at use value based on NRCS soil productivity ratings. Application through DOR.
- Manufacturing property is assessed by the DOR (not local assessor). Different appeal process applies.
- The Board of Review has SUBPOENA power. If the assessor used flawed data, you can compel them to disclose their methodology and data sources.`,

  WY: `WYOMING STRATEGIES:
- Wyoming assesses at 9.5% of fair market value. Verify: assessed_value / 0.095 = implied market value.
- Agricultural land is valued using a productivity-based formula (6 agricultural use classes). Verify correct classification.
- Wyoming has no state income tax — property tax is a primary revenue source. Assessments can be aggressive.
- The County Board of Equalization hears initial appeals. The State Board of Equalization provides state-level review.
- Industrial property (mineral production, mines) has separate valuation rules. Ensure correct property type classification.`,

  DC: `DISTRICT OF COLUMBIA STRATEGIES:
- DC assesses at 100% of estimated market value with annual assessments. Every year is a new opportunity to challenge.
- HOMESTEAD DEDUCTION: $83,780 deduction for owner-occupied properties (as of 2024). Verify it's applied.
- Senior/Disabled tax relief: Qualifying residents can receive 50% reduction in property tax.
- The Real Property Tax Appeals Commission (RPTAC) is a professional tribunal — present institutional-quality evidence.
- DC's condo assessment methodology must reflect the unit's proportional value, not whole-building estimates divided equally.
- Assessment cap: Owner-occupied properties have a 10% cap on annual assessment increases (D.C. Code § 47-820(b)).`,
};

interface StateConfig {
  state_name: string;
  state_abbreviation: string;
  assessment_methodology: 'fractional' | 'full_value';
  assessment_ratio_residential: number;
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
      appeal_deadline_rule: state.appeal_deadline_rule,
      state_appeal_board_name: state.state_appeal_board_name,
      state_appeal_board_url: state.state_appeal_board_url,
      hearing_format: state.hearing_format,
      hearing_typically_required: state.hearing_typically_required,
      typical_resolution_weeks_min: state.typical_resolution_weeks_min,
      typical_resolution_weeks_max: state.typical_resolution_weeks_max,
      is_active: true,
      state_appeal_strategies: STATE_STRATEGIES[county.state] ?? null,
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
