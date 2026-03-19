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
  AL: `ALABAMA STRATEGIES — CLASSIFIED PROPERTY TAX STATE:

ASSESSMENT FUNDAMENTALS:
- Alabama uses a classified property tax system with four classes and different assessment ratios: Class I (utilities) 30%, Class II (non-owner-occupied property) 20%, Class III (agricultural/residential owner-occupied) 10%, Class IV (motor vehicles) 15% (Code of Alabama §40-8-1).
- Burden of proof rests on the taxpayer at the county Board of Equalization. At Circuit Court appeal, the burden shifts — the assessor must justify the valuation (§40-3-25).
- Key statutes: §40-7-15 (valuation at fair and reasonable market value), §40-2-11 (Revenue Department oversight), §40-3-20 through §40-3-28 (equalization procedures).
- Common assessor errors: wrong classification (Class II vs Class III saves 10% of assessed value immediately), incorrect acreage, failure to apply current use valuation, outdated base year values in counties that haven't reassessed in decades.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: classification challenge. If an owner-occupied home is assessed as Class II (20%) instead of Class III (10%), the assessed value is DOUBLE what it should be. One reclassification = 50% reduction in assessed value.
- Cost-to-cure: foundation repair ($8,000–$15,000), roof replacement ($7,500–$12,000), HVAC replacement ($5,000–$10,000), termite damage remediation ($3,000–$8,000). Alabama's humidity and termite exposure create chronic deferred maintenance.
- Photo evidence: document termite damage, foundation settling (common in Alabama's clay soils), roof deterioration, water damage. Each defect with a contractor estimate directly reduces fair market value.
- Current use valuation (§40-7-25.1): agricultural, forest, and timberland assessed at current use rather than market value — can reduce assessment by 60–90%. Even small hobby farms may qualify.
- Exemption checklist: homestead exemption (§40-9-19, up to $4,000 assessed value for state taxes), over-65 exemption (§40-9-21, county taxes up to 160 acres), disabled veteran exemption (§40-9-21.1, full exemption on homestead), blind person exemption.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- If assessed value is below market value (common in Alabama due to infrequent reassessments), the assessment gap proves the property is worth MORE than the county thinks — use this to justify a higher listing price.
- Document all upgrades: new HVAC, roof, kitchen/bath renovations. Alabama assessors rarely conduct interior inspections, so improvements are often not captured in the assessment.
- Use recent comparable sales in the neighborhood to demonstrate appreciation the assessor has not recognized.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax projection: Alabama's effective tax rates vary dramatically by county (0.3%–0.8%). Calculate post-purchase taxes using the correct class ratio applied to the purchase price — buyers are often shocked by the reassessment.
- Deferred maintenance costs from photos: termite damage, foundation issues, aging septic systems (common in rural Alabama). Estimate remediation costs ($5,000–$25,000+) to negotiate purchase price down.
- Assessment vs market gap: if the assessed value is significantly below the purchase price, the buyer will face a large reassessment. Quantify the annual tax increase.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Alabama allows income capitalization for commercial properties. Local cap rates typically range 7–10%. If the assessor used a lower cap rate, the resulting value is inflated.
- Classification impact: commercial property assessed at Class II (20%) vs residential at Class III (10%). Verify mixed-use properties are properly split between classes — a $500,000 property saves $5,000+/year in taxes with correct classification.
- Depreciation and obsolescence: Alabama assessors often ignore functional obsolescence (outdated floor plans, inadequate parking, ADA non-compliance). Document with photos and cost estimates.

SETTLEMENT & HEARING STRATEGY:
- Informal review: "The Board of Equalization should note that the subject property's assessed value of $[X] implies a market value of $[X/ratio] under Code of Alabama §40-8-1, which exceeds the property's demonstrable fair market value of $[Y] based on [comparable sales/income analysis]."
- Evidence format: Alabama boards respond well to printed packets with comparable sales maps, photos, and a clear one-page summary. Keep presentations under 10 minutes.
- Mistakes that lose appeals: failing to file on time (varies by county, typically May–June), not bringing comparable sales data, arguing about tax rates instead of assessed value, and not knowing which classification applies.`,

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

  CT: `CONNECTICUT STRATEGIES — CONSTITUTION STATE:

ASSESSMENT FUNDAMENTALS:
- Assessment ratio: 70% of fair market value (C.G.S. §12-62a). The math: if assessed_value > (market_value × 0.70), the assessment is illegal and must be reduced.
- Methodology: Each municipality conducts revaluation every 5 years with annual adjustment factors (C.G.S. §12-62). In revaluation years, challenge the base value aggressively — it sets the foundation for the next 5 years.
- Classification: Connecticut taxes real property, personal property (business equipment), and motor vehicles separately. Verify the property is not being assessed in multiple categories for overlapping components.
- Burden of proof: The taxpayer bears the burden at the Board of Assessment Appeals (BAA). At Superior Court (C.G.S. §12-117a), the burden shifts — the assessor must justify the valuation if you demonstrate aggrievement.
- Key statutes: C.G.S. §12-111 (assessment appeals to BAA), C.G.S. §12-117a (Superior Court appeals), C.G.S. §12-62a (70% assessment standard), C.G.S. §12-107e (PA 490 current use).
- Common assessor errors: applying town-wide adjustment factors without individual property inspection, using incorrect effective age vs actual age, failing to account for functional obsolescence in older New England housing stock, wrong neighborhood classification.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: Connecticut BAAs are municipal-level boards. Present 3-5 comparable sales within the same municipality, adjusted for differences, showing the assessed value exceeds 70% of market value. Calculate the exact dollar overage: (assessed_value - (market_value × 0.70)) / 0.70 = excess assessment.
- Cost-to-cure: Connecticut's aging housing stock (average built 1960s) means deferred maintenance is common. Roof replacement ($15,000-$35,000), foundation repairs ($5,000-$25,000 for fieldstone/block common in CT), heating system replacement ($8,000-$20,000 for oil-to-gas conversion), septic system replacement ($15,000-$40,000), well issues ($5,000-$15,000). Document each defect with repair estimates from licensed CT contractors.
- Photo evidence: Photograph deferred maintenance — peeling paint, deteriorating siding (especially wood clapboard common in CT), crumbling foundations, outdated kitchens/baths. Each documented deficiency reduces the condition rating and therefore the assessed value.
- PA 490 — farmland, forest, and open space can be assessed at current use value rather than fair market value (C.G.S. §12-107e). If the property qualifies, this can reduce assessment by 80%+ (e.g., 10 acres of forest assessed at $200/acre instead of $50,000/acre). Minimum acreage requirements vary by classification.
- Exemption checklist: Veterans exemption ($1,000-$3,000 off assessed value, C.G.S. §12-81(19)), elderly/disabled freeze (C.G.S. §12-129b, municipal option), blind exemption ($3,000, C.G.S. §12-81(17)), volunteer firefighter exemption ($1,000, C.G.S. §12-81(56)). Each municipality may offer additional local option exemptions.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Assessment gap: If assessed_value / 0.70 < your intended listing price, the assessment gap proves the municipality has undervalued the property, supporting a higher listing price.
- Upgrades as positive adjustments: Renovated kitchens (+$15,000-$40,000 in CT markets), updated bathrooms (+$8,000-$20,000), finished basements (+$10,000-$30,000), new roof, energy-efficient windows. Present contractor invoices as evidence of value-add.
- Appreciation evidence: CT's Fairfield County towns (Greenwich, Stamford, Westport) have different market dynamics than Hartford or New Haven counties. Use hyper-local comparable sales to demonstrate appreciation trends.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax projection: Connecticut mill rates vary dramatically by municipality (15 mills to 45+ mills). Calculate: (assessed_value × mill_rate / 1000) = annual tax. After purchase, the property will be revalued at the next revaluation — project the new assessed value as purchase_price × 0.70.
- Deferred maintenance costs: CT's older housing stock means hidden costs. Document foundation issues (fieldstone crumbling: $10,000-$30,000), lead paint remediation ($5,000-$15,000), asbestos removal ($3,000-$10,000), outdated electrical ($5,000-$15,000), oil tank removal ($2,000-$5,000).
- Assessment vs market gap: If the assessment implies a market value (assessed ÷ 0.70) significantly different from the purchase price, the buyer may face a tax increase at the next revaluation.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Connecticut BAAs are sophisticated and expect income capitalization for commercial properties. Present actual NOI with market-supported cap rates. Hartford and New Haven office cap rates (7-9%) differ from Fairfield County (5-7%).
- Personal property tax on business equipment is a major Connecticut feature (C.G.S. §12-71). Ensure equipment is not being double-counted in the real property assessment. File personal property declarations separately and verify no overlap.
- Classification impact: Commercial properties are assessed at the same 70% ratio but face the same mill rate. Mixed-use properties should have residential and commercial portions separately valued.
- Depreciation/obsolescence: For older commercial buildings, argue economic obsolescence (vacancy rates, market rent declines) and functional obsolescence (floor plate inefficiency, lack of modern HVAC, inadequate parking).

SETTLEMENT & HEARING STRATEGY:
- Informal review: Contact the assessor's office before the BAA hearing. Template language: "I believe the current assessed value of $[X] exceeds 70% of the property's fair market value. Based on comparable sales, the fair market value is $[Y], supporting an assessed value of $[Z]. I would like to discuss an adjustment before proceeding to the Board of Assessment Appeals."
- Evidence format that wins: Printed comparable sales analysis with photos, adjustment grid, and clear math showing assessed_value > market_value × 0.70. Connecticut boards respond to organized, data-driven presentations.
- Mistakes that lose: Filing after the February 20 deadline, presenting comps from other municipalities without adjustment, arguing about taxes rather than value, failing to appeal to Superior Court within 2 months of BAA decision if the BAA denies relief.`,

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

  GA: `GEORGIA STRATEGIES — TAXPAYER BURDEN-SHIFT STATE:

ASSESSMENT FUNDAMENTALS:
- Assessment ratio: 40% of fair market value (O.C.G.A. §48-5-7). The math must work: assessed_value = market_value × 0.40. If assessed_value / 0.40 > provable market value, the assessment is unconstitutional.
- Burden of proof: Georgia's Taxpayer Bill of Rights (O.C.G.A. §48-5-311) shifts the burden to the county — the Board of Tax Assessors must justify their value. You do NOT have to disprove it.
- Key statute: O.C.G.A. §48-5-2 defines "fair market value" as the price between a willing buyer and willing seller, neither under compulsion. Assessors who use mass appraisal without individual property inspection violate this standard.
- Common assessor errors: wrong square footage, incorrect land size, failure to account for easements, applying wrong neighborhood factor, ignoring functional obsolescence.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: Comparable sales within 12 months, adjusted for differences. Georgia boards respond best to 3-5 comps within 1 mile showing lower per-sqft values.
- Cost-to-cure: Translate every deficiency into dollar figures — roof replacement ($8,000-$15,000), HVAC system ($5,000-$12,000), foundation repair ($3,000-$25,000), termite damage remediation ($2,000-$8,000). Georgia's humid climate accelerates deterioration.
- Photo evidence: Document deferred maintenance, water damage from Georgia's heavy rainfall, aging HVAC systems (critical in Georgia heat), wood rot, crawl space moisture issues. Each documented deficiency supports a condition adjustment of 5-15%.
- Annual notice of assessment must be sent by April 1 (O.C.G.A. §48-5-306). If the county failed to provide proper notice, the assessment is challengeable on procedural grounds.
- Exemption verification: Homestead exemption (O.C.G.A. §48-5-44, $2,000 of assessed value), senior school tax exemption (age 62+, income-based), disabled veteran exemption ($81,080+ exemption), conservation use covenant.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the 40% assessment ratio gap: if assessed at $120,000 (implying $300,000 market), but listing at $375,000, the $75,000 gap demonstrates the market recognizes value the assessor missed.
- Frame upgrades as positive adjustments: new kitchen ($15,000-$40,000 value add), updated bathrooms ($8,000-$20,000), hardscaping, energy-efficient windows, smart home features.
- Georgia's rapid metro growth (Atlanta, Savannah, Augusta corridors) supports appreciation arguments — cite county-level price indices.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: After purchase, the property will be reassessed at the purchase price × 0.40. Calculate new annual tax = (purchase_price × 0.40 × millage_rate / 1000). Georgia millage rates vary 25-45 mills — this is significant.
- Deferred maintenance cost quantification: Georgia properties face termite risk, moisture damage, HVAC wear from extreme summers. Document and price every issue from inspection photos.
- If assessed_value / 0.40 is significantly below purchase price, the buyer should expect a substantial tax increase post-closing.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Georgia boards accept income capitalization for commercial properties. Use actual NOI with market-derived cap rates from CoStar or local broker surveys. Georgia cap rates range 6-10% depending on metro vs rural.
- Classification verification: Ensure commercial property isn't being assessed at a higher effective rate through incorrect land-to-improvement ratio splits.
- Functional and economic obsolescence: Document outdated floor plans, inadequate parking (common in older Georgia strip centers), environmental issues, declining trade area demographics.

SETTLEMENT & HEARING STRATEGY:
- At informal review: "The county's assessment of $X implies a market value of $Y (assessed ÷ 0.40). Our comparable sales evidence demonstrates the actual market value is $Z, requiring an assessed value of no more than $W."
- Evidence format: Georgia boards prefer a packet with cover summary, property description, 3-5 comparable sales with adjustments on a grid, and photos. Professional-looking submissions win.
- Common mistakes: Filing after the 45-day deadline, failing to attend the hearing (default judgment for the county), presenting comps from different neighborhoods without adjustment, arguing taxes are too high rather than value is wrong.
- County Board of Tax Assessors can be challenged at both county AND state level. Superior Court provides de novo review — the court makes its own value determination from scratch (O.C.G.A. §48-5-311(g)).`,

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

  MS: `MISSISSIPPI STRATEGIES — THE CLASSIFIED ASSESSMENT STATE:

ASSESSMENT FUNDAMENTALS:
- Mississippi uses a classified system: residential at 10%, commercial at 15%, personal property at 15% of true value (Miss. Code Ann. §27-35-50).
- Burden of proof is on the taxpayer at the Board of Supervisors level. At Circuit Court appeal, the standard shifts to whether the Board acted arbitrarily or capriciously.
- Key statute: Miss. Code Ann. §27-35-1 et seq. governs ad valorem taxation. §27-35-50 sets classification ratios.
- Common assessor errors: wrong classification (residential coded as commercial adds 50% to assessed value), failure to apply homestead exemption, using outdated comparable sales, ignoring physical deterioration.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: demonstrate misclassification or mathematical ratio errors. If assessed_value / 0.10 (residential) exceeds provable true value, the assessment violates statute.
- Cost-to-cure: Mississippi assessors rarely inspect interiors. Document foundation cracks ($8,000-$25,000 repair), termite damage ($3,000-$15,000), roof replacement ($6,000-$18,000), HVAC failure ($4,000-$12,000). Each deficiency directly reduces true value.
- Photo evidence: photograph water stains on ceilings (mold remediation $5,000-$30,000), sagging floors (structural repair $10,000-$40,000), outdated electrical panels (replacement $2,000-$4,000). Mississippi's humid climate accelerates deterioration — document it.
- Homestead exemption: first $7,500 of assessed value ($75,000 true value) exempt for owner-occupied (Miss. Code Ann. §27-33-3). Verify application — failure to claim costs $75-$200+ annually.
- Disability and age exemptions: additional exemptions for disabled veterans (§27-33-67) and seniors with income below $30,400 (§27-33-67(2)). Verify eligibility.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap to justify listing price: if assessed true value (assessed / 0.10) is significantly below your target price, frame the assessment as outdated and lagging market appreciation.
- Document all upgrades: kitchen renovations ($15,000-$50,000), bathroom remodels ($8,000-$25,000), new HVAC systems, roof replacements. Mississippi's hot climate makes modernized cooling systems a premium feature.
- Neighborhood appreciation: cite recent comparable sales exceeding assessed true values as evidence of upward market trajectory.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: Mississippi has no reassessment trigger on sale, but the assessor can adjust true value in the next assessment cycle. Calculate potential increase: (purchase_price x 0.10 x local_millage) vs current tax bill.
- Deferred maintenance quantification: Mississippi's humidity and severe weather (hurricanes, flooding in southern counties) create hidden damage. Document water intrusion ($5,000-$50,000), foundation settlement ($10,000-$40,000), wood rot ($3,000-$15,000).
- Assessment vs market value gap: if assessed true value is well below purchase price, expect future assessment increases. Budget 1-3 years of catch-up.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Mississippi allows income capitalization for commercial properties. Local cap rates typically range 7-10%. If the assessor used a cap rate below market, the assessed value is inflated.
- Classification verification: commercial at 15% vs residential at 10% — a $500,000 property misclassified as commercial pays 50% more in taxes. Mixed-use properties are frequently misclassified.
- Depreciation: Mississippi allows physical, functional, and external obsolescence deductions. Document all three for commercial properties — especially functional obsolescence in older retail or office buildings.

SETTLEMENT & HEARING STRATEGY:
- At the Board of Supervisors hearing, say: "I respectfully request a reduction based on comparable sales evidence showing the true value of my property is $X, which is below the assessor's determination of $Y. Here are [3-5] comparable sales within [radius] miles."
- Present evidence in a clear packet: cover page with property details, comparable sales grid with adjustments, photographs of condition issues, and a single-page summary of requested value.
- Common mistakes: filing after the 15-day deadline (Miss. Code Ann. §27-35-111), failing to bring written comparable sales data, arguing about tax rates instead of true value.`,

  MO: `MISSOURI STRATEGIES — THE ODD-YEAR REASSESSMENT STATE:

ASSESSMENT FUNDAMENTALS:
- Missouri reassesses in odd-numbered years. Residential assessed at 19%, commercial at 32%, agricultural at 12% of true value in money (Mo. Rev. Stat. §137.115).
- Burden of proof: taxpayer must present substantial and persuasive evidence at the Board of Equalization. At the State Tax Commission (STC), the standard is "preponderance of evidence" with de novo review.
- Key statutes: Mo. Rev. Stat. §137.115 (assessment ratios), §138.060 (Board of Equalization appeals), §138.430 (State Tax Commission appeals). Mo. Const. Art. X, §4(b) sets classification ratios.
- Common assessor errors: using comparable sales from outside the reassessment window, applying incorrect classification ratios, failing to account for physical depreciation, overvaluing land relative to improvements.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: the informal appeal process resolves ~60% of disputes. Present 5-7 comparable sales within 1 mile, sold within 12 months of January 1 assessment date. Assessors have authority to negotiate — start here.
- Cost-to-cure: document deferred maintenance with contractor estimates. Foundation repair ($5,000-$25,000), roof replacement ($7,000-$20,000), plumbing/sewer line replacement ($3,000-$15,000), basement waterproofing ($5,000-$15,000). Missouri's freeze-thaw cycles cause significant foundation damage.
- Photo evidence: photograph settling foundations, deteriorating siding, aging mechanicals (furnace age, water heater condition), outdated kitchens/baths. Interior condition photos are especially persuasive since assessors rely on exterior-only inspections.
- Assessment cap violations: Missouri has no annual assessment cap, but reassessment values must reflect January 1 market conditions in the reassessment year only — not speculative future value.
- Exemption checklist: disabled veteran exemption (100% disabled, up to $750 tax credit per §137.106), nonprofit exemptions, senior property tax credit (Circuit Breaker, up to $1,100 for renters, $750 for owners via §135.010).

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: if (assessed / 0.19) is well below your listing price, frame the assessment as lagging market reality. Missouri's biennial cycle means assessments can be 1-2 years behind rapid appreciation.
- Document all improvements: renovated kitchen ($20,000-$60,000), finished basement ($15,000-$40,000), deck additions ($5,000-$20,000). Missouri buyers value energy-efficient upgrades given extreme summer/winter temperatures.
- Neighborhood appreciation: cite arm's-length sales in the subdivision showing consistent upward trajectory since last reassessment.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: next reassessment will reset to current market value. If purchasing between reassessment years, calculate: (purchase_price x 0.19 x local_levy_rate) to project true annual tax burden.
- Deferred maintenance: Missouri's clay soils cause foundation issues statewide. Document cracks, water intrusion, bowing walls. Sewer lateral replacement in older St. Louis/Kansas City homes runs $5,000-$15,000.
- Assessment vs market value gap: in hot markets (Kansas City, St. Louis suburbs, Columbia), assessments can lag 10-20% behind purchase prices. Budget for reassessment catch-up.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Missouri's STC regularly accepts income capitalization for commercial properties. Local cap rates: 6-9% for retail, 7-10% for office, 8-12% for industrial. If the assessor used a below-market cap rate, the assessment is inflated.
- Classification verification: commercial at 32% vs residential at 19% — misclassification of mixed-use properties (apartments with ground-floor retail) is common and costly. Verify correct proration.
- Depreciation and obsolescence: Missouri allows all three forms. Economic obsolescence from traffic pattern changes, neighborhood decline, or environmental contamination can reduce commercial assessments 10-30%.

SETTLEMENT & HEARING STRATEGY:
- At the informal review, say: "I have [number] comparable sales showing the true market value of my property is $X, which is below the assessed true value of $Y. I am requesting a reduction to $X based on these arm's-length transactions."
- Missouri's "prevailing party" rule at the STC level (§138.434) means if you win, the county may pay your costs. This discourages frivolous county defenses and gives you leverage.
- Present evidence as: comparable sales grid with adjustment explanations, property photos showing condition, and a single-page value conclusion. The STC expects professional-grade presentations.
- Common mistakes: missing the Board of Equalization deadline (typically July of odd-numbered years), failing to preserve your appeal rights for STC by not appearing at BOE, presenting comparable sales outside the valuation period.`,

  MT: `MONTANA STRATEGIES — THE BIENNIAL PHASED-VALUE STATE:

ASSESSMENT FUNDAMENTALS:
- Montana reassesses biennially (every 2 years). Market value is phased in over 2 years to prevent shock increases (Mont. Code Ann. §15-7-111). The phase-in means only 50% of any value increase applies in year 1.
- Assessment ratios vary by class: Class 4 residential at 1.35% of market value, commercial at 1.89%, agricultural at productive capacity value. Verify the correct class and rate (Mont. Code Ann. §15-6-134).
- Burden of proof: taxpayer must demonstrate by a preponderance of evidence that the assessed value exceeds market value. At the State Tax Appeal Board (STAB), the review is de novo.
- Key statutes: Mont. Code Ann. §15-7-102 (market value standard), §15-7-111 (phased-in values), §15-15-101 (appeal procedures), §15-6-134 (class 4 residential rate).
- Common assessor errors: incorrect phase-in calculation, wrong property class, failure to deduct depreciation on older homes, using statewide rather than local comparable sales.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: challenge the phase-in calculation. If market value dropped between cycles, the phased value should reflect the decline, not continue a prior upward trend. Many assessors fail to reverse phase-ins during market downturns.
- Cost-to-cure: Montana's harsh winters cause significant structural damage. Document roof damage from snow load ($8,000-$25,000), frozen/burst pipe damage ($2,000-$15,000), foundation heaving from frost ($10,000-$35,000), wood stove/chimney deterioration ($3,000-$8,000).
- Photo evidence: photograph ice dam damage on roofs, cracked exterior stucco/siding from freeze-thaw, aging septic systems (replacement $10,000-$25,000 in rural areas), well system issues ($5,000-$15,000). Rural Montana properties often have infrastructure that urban assessors undervalue for depreciation.
- Property tax assistance program (RPTA): provides direct tax reduction for homeowners earning under ~$48,000/year. Verify eligibility — many qualifying homeowners don't apply.
- Disabled veteran exemption: up to $100,000 of market value exempt for qualifying veterans (Mont. Code Ann. §15-6-211). Verify application.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: Montana's biennial cycle means assessments can lag 1-2 years behind market. If (assessed / 0.0135) is below listing price, frame the low assessment as the county's own admission that the property appreciated rapidly.
- Document improvements: energy-efficient windows ($8,000-$20,000), modern heating systems ($5,000-$15,000), updated insulation ($3,000-$10,000). Montana buyers pay premium for energy efficiency given severe winters.
- Neighborhood appreciation: cite recreational property demand (near Yellowstone, Glacier, Flathead Lake) and recent comparable sales showing premium pricing.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: Montana's biennial reassessment means the next cycle may catch the purchase price. Calculate: (purchase_price x 0.0135 x local_mill_levy / 1000) to project future annual taxes.
- Deferred maintenance: Montana's extreme temperature swings (-20°F to 100°F) stress all building systems. Budget for well/septic inspection ($500-$1,500), structural inspection for snow load adequacy, and chimney/fireplace safety ($500-$2,000).
- Assessment vs market value gap: in resort/recreation markets (Big Sky, Whitefish, Bozeman), assessments often trail market values by 15-30%. Expect significant reassessment increases.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Montana accepts income capitalization for commercial properties. Cap rates: 7-10% for retail/office, 8-12% for industrial. Rural Montana commercial properties often warrant higher cap rates due to limited demand — challenge if the assessor used urban-level cap rates.
- Classification verification: Class 4 commercial at 1.89% vs residential at 1.35% — a $1M property misclassified pays ~$5,400 more annually. Mixed-use (apartments above retail) requires proper allocation.
- Depreciation: Montana allows physical depreciation, functional obsolescence (outdated commercial buildings), and economic obsolescence (location in declining market area). Document all three.

SETTLEMENT & HEARING STRATEGY:
- At the County Tax Appeal Board, say: "I am appealing the market value determination of $X. Based on [number] comparable sales within my market area, the correct market value as of [valuation date] is $Y. I request the phased value be recalculated using this corrected market value."
- The STAB process is written-submission-based — quality of documentation is paramount. Submit: comparable sales with photos and adjustment grids, condition photos of your property, contractor estimates for repairs, and a clear value conclusion.
- Present evidence format: Montana boards respond well to organized written packets. Include a cover letter, comparable sales analysis, property condition report with photos, and requested value with supporting math.
- Common mistakes: missing the 30-day appeal deadline from classification/appraisal notice, challenging the tax rate instead of market value, failing to account for the phase-in when calculating your target value.`,

  NE: `NEBRASKA STRATEGIES — THE EQUALIZATION-DRIVEN STATE:

ASSESSMENT FUNDAMENTALS:
- Nebraska assesses at 100% of actual value for residential/commercial. Agricultural land is assessed at 75% of actual value based on market-derived income capitalization (Neb. Rev. Stat. §77-201).
- The state equalization process (Article VIII, §1 of Nebraska Constitution) ensures inter-county uniformity. If your county's overall ratio deviates from the acceptable range (92-100%), ALL properties may be adjusted upward or downward.
- Burden of proof: taxpayer must show by clear and convincing evidence that the assessed value is not equitable or exceeds actual value. At TERC, the standard is "clear and convincing" — a higher bar than most states.
- Key statutes: Neb. Rev. Stat. §77-1501 (protest to county board), §77-5013 (TERC appeals), §77-201 (assessment standards). Neb. Const. Art. VIII, §1 (uniformity clause).
- Common assessor errors: using stale comparable sales (more than 12 months from assessment date), incorrect land-to-improvement allocation, failure to apply depreciation schedules, incorrect NRCS soil classifications for agricultural land.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: equalization argument. Under Banner County v. State Board of Equalization, if comparable properties in your area are assessed at a lower per-unit value, you are entitled to equal treatment regardless of actual market value. Find 5+ comparable properties assessed lower per sqft.
- Cost-to-cure: Nebraska's severe weather causes significant damage. Document hail damage to roofs ($6,000-$20,000), basement flooding/drainage issues ($5,000-$20,000), foundation settlement from expansive clay soils ($8,000-$30,000), HVAC replacement ($5,000-$15,000).
- Photo evidence: photograph tornado/storm damage, aging siding and roofing, outdated mechanical systems, basement moisture intrusion. Nebraska's extreme temperature range (-20°F to 110°F) accelerates building deterioration — document every deficiency with estimated repair cost.
- Homestead exemption: qualifying seniors (65+), disabled veterans, and certain disabled individuals can exempt a portion of assessed value (Neb. Rev. Stat. §77-3506 through §77-3512). Maximum exemption depends on income and property value. Verify application.
- Property tax credit: Nebraska provides a Property Tax Credit directly on tax statements. Verify it is applied.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: if assessed value is below listing price, frame the gap as evidence that the county acknowledges market values have risen beyond their last valuation cycle.
- Document improvements: new roof ($8,000-$20,000), kitchen remodel ($15,000-$45,000), basement finish ($20,000-$50,000), energy-efficient windows ($8,000-$18,000). Nebraska buyers value storm-resistant improvements.
- Neighborhood appreciation: cite recent comparable sales in the same school district — school quality drives Nebraska residential values significantly.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: Nebraska assesses annually at 100% of actual value. Your purchase price becomes the best evidence of actual value. Calculate: purchase_price x local_levy_rate to project taxes immediately.
- Deferred maintenance: Nebraska's severe weather means hidden damage is common. Budget for foundation inspection ($300-$500), sewer scope ($200-$400), and roof inspection ($200-$400). Repair costs: sewer line replacement ($5,000-$15,000), foundation stabilization ($8,000-$30,000).
- Assessment vs market value gap: in rapidly appreciating markets (Omaha, Lincoln), assessments may trail by 5-15%. Expect catch-up in the next assessment cycle.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Nebraska TERC accepts income capitalization as primary evidence for commercial properties. Cap rates: 7-10% for retail, 8-11% for office, 9-12% for industrial. Present a certified income/expense statement with market-derived cap rate.
- Classification verification: ensure commercial properties are not inadvertently assessed at rates appropriate for higher-value uses. A warehouse assessed as retail-ready can be significantly overvalued.
- Depreciation and obsolescence: Nebraska allows physical depreciation (age/condition), functional obsolescence (outdated floor plans, inadequate parking), and economic obsolescence (market decline, oversupply). Document all with market evidence.

SETTLEMENT & HEARING STRATEGY:
- At the County Board of Equalization (June 1-30 protest period), say: "I protest the assessed value of $X for my property. Based on [comparable sales / equalization evidence / income analysis], the actual value is $Y. I request a reduction to $Y."
- TERC appeals must be filed within 30 days of county board decision. TERC hearings are formal — prepare testimony, exhibits, and witness lists. TERC decisions are binding and create precedent.
- Present evidence as: comparable sales analysis with adjustment grid, equalization study showing similarly situated properties assessed lower, property condition photos with repair estimates.
- Common mistakes: missing the June 1-30 protest window (Neb. Rev. Stat. §77-1502), failing to meet the "clear and convincing" evidence standard at TERC, presenting comparable sales outside the assessment year, not preserving the equalization argument at the county level.`,

  NV: `NEVADA STRATEGIES — THE REPLACEMENT COST & TAX CAP STATE:

ASSESSMENT FUNDAMENTALS:
- Nevada assesses at 35% of taxable value (NRS 361.225). Taxable value is NOT market value — it is replacement cost new less depreciation for improvements, plus taxable land value. This is a cost approach, not sales comparison.
- Tax cap: primary residential (owner-occupied) limited to 3% annual tax increase; all other property limited to 8% (NRS 361.4722, NRS 361.4723). This partial abatement is applied automatically but must be verified.
- Burden of proof: taxpayer must show by a preponderance of evidence that taxable value exceeds full cash value (market value) OR that the assessor failed to apply the statutory depreciation schedule.
- Key statutes: NRS 361.225 (35% ratio), NRS 361.227 (taxable value = land + replacement cost - depreciation), NRS 361.4722/4723 (tax caps), NRS 361.345-361.365 (appeal procedures).
- Common assessor errors: using incorrect replacement cost tables, failing to apply full statutory depreciation, incorrect land valuation, not applying the 3% or 8% tax cap abatement, double-counting personal property in real property improvements.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: challenge the replacement cost calculation. Nevada uses Marshall & Swift cost tables — verify the assessor used the correct quality class, building type, and effective age. A one-class quality error can change value by 20-40%.
- Cost-to-cure: Nevada's desert climate causes unique damage. Document stucco cracking from extreme heat ($3,000-$12,000), HVAC system wear from year-round use ($5,000-$15,000), flat roof deterioration ($8,000-$25,000), foundation movement from desert soil expansion ($10,000-$35,000).
- Photo evidence: photograph sun-damaged exteriors, cracked driveways and flatwork, deteriorating pool equipment ($5,000-$15,000), aging desert landscaping. Nevada's UV exposure degrades materials faster than moderate climates — document accelerated deterioration.
- Tax cap verification: calculate whether your tax bill increase exceeded 3% (owner-occupied) or 8% (all other). If it did, the abatement was not properly applied — this is an automatic correction, not discretionary.
- Exemption checklist: veterans' exemption (NRS 361.090, up to $2,000 assessed value for wartime veterans), surviving spouse exemption, blind persons' exemption (NRS 361.080, $3,000 assessed value).

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the taxable value vs market value gap: Nevada's cost-based assessment often produces values far below market value, especially in appreciating markets. The gap itself demonstrates market strength.
- Document upgrades: pool installation ($30,000-$80,000), solar panels ($15,000-$30,000), outdoor living spaces ($10,000-$40,000). Nevada buyers pay significant premiums for energy-efficient and heat-adapted improvements.
- Neighborhood appreciation: cite comparable sales in the same master-planned community or subdivision. Las Vegas, Reno, and Henderson markets have distinct micro-markets.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: Nevada's 3% tax cap means your taxes will not spike immediately, but the abatement can erode over time as the cap compounds. Calculate the long-term trajectory: current_tax x 1.03^(years) vs tax at full rate.
- Deferred maintenance: desert properties have unique issues. Budget for HVAC inspection ($200-$400), roof inspection for flat/tile roofs ($200-$500), pool equipment assessment ($300-$600). Replacement costs: HVAC ($5,000-$15,000), flat roof ($8,000-$25,000), re-piping ($5,000-$15,000).
- Assessment vs market value gap: Nevada's cost-based system means taxable value is often 30-50% below market value. This benefits owners but can mask assessment errors.

COMMERCIAL PROPERTY TACTICS:
- Income approach: although Nevada uses cost approach for assessment, at the State Board of Equalization you can argue that taxable value exceeds full cash value using income capitalization. Cap rates: 6-9% for Las Vegas Strip-adjacent retail, 7-10% for suburban office, 8-12% for industrial.
- Classification verification: ensure commercial improvements are correctly classified by building type and quality. A Class C warehouse assessed as Class B office space will be significantly overvalued.
- Depreciation: Nevada mandates a statutory depreciation schedule (NRS 361.227(5)) — 1.5% per year for most structures. Verify the assessor applied the correct age and depreciation rate. Functional and economic obsolescence are additional deductions above physical depreciation.

SETTLEMENT & HEARING STRATEGY:
- At the County Board of Equalization (file by January 15), say: "I am appealing the taxable value of my property. The assessor's replacement cost of $X exceeds the actual replacement cost by $Y. Additionally, [depreciation / obsolescence / land valuation] has been incorrectly calculated."
- Alternatively, argue the "full cash value" cap: "The taxable value of $X exceeds the full cash value (market value) of $Y as demonstrated by these comparable sales. Under NRS 361.227(2), taxable value cannot exceed full cash value."
- Present evidence as: Marshall & Swift cost analysis (if challenging replacement cost), comparable sales analysis (if arguing full cash value cap), depreciation schedule with correct age/condition, photos documenting condition.
- Common mistakes: arguing market value alone without understanding Nevada's cost-based system, missing the January 15 filing deadline, failing to verify the tax cap abatement was applied before appealing the underlying value.`,

  NH: `NEW HAMPSHIRE STRATEGIES — THE PROPERTY-TAX-DEPENDENT STATE:

ASSESSMENT FUNDAMENTALS:
- New Hampshire has NO state income tax and NO sales tax — property tax is the primary revenue source (~65% of all state/local revenue), making assessments particularly aggressive and high.
- Assessment standard: "full and true value" (RSA 75:1) meaning 100% of market value. The DRA publishes equalization ratios annually showing how each municipality's assessments compare to market value.
- Burden of proof: taxpayer must demonstrate by a preponderance of evidence that assessment is disproportionate or exceeds market value. Under Appeal of Town of Sunapee (2002), the taxpayer must present reliable comparable evidence.
- Key statutes: RSA 75:1 (full and true value), RSA 76:16 (abatement procedure), RSA 71-B:1 (BTLA jurisdiction), RSA 79-A (current use taxation).
- Common assessor errors: using outdated revaluation data (some towns revalue only every 5-10 years), incorrect property card data (wrong square footage, room count, or grade), failure to adjust for market decline between revaluation cycles, applying neighborhood factors that mask individual property differences.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: use the DRA equalization ratio. If your town's ratio is 85%, your $300,000 assessment effectively values your property at $353,000 ($300,000 / 0.85). If market value is actually $320,000, you are over-assessed by 10%. Present this math clearly.
- Cost-to-cure: New Hampshire's severe winters cause extensive damage. Document ice dam damage ($3,000-$15,000), foundation frost heaving ($8,000-$30,000), failed septic systems ($15,000-$35,000), well issues ($5,000-$20,000), chimney deterioration ($3,000-$10,000).
- Photo evidence: photograph peeling paint, rotting trim, ice dam staining on ceilings, aging oil/propane heating systems (replacement $8,000-$18,000), old windows (replacement $10,000-$25,000). New Hampshire's harsh climate means deferred maintenance costs are high — document everything.
- Abatement application: must be filed with the selectmen/assessing officials by March 1 following the April 1 assessment date (RSA 76:16). This is a strict deadline.
- Exemption checklist: elderly exemption (RSA 72:39-a, varies by town, typically $50,000-$200,000 off assessed value for age 65+), disabled exemption (RSA 72:37-b), veterans' tax credit ($500 standard, up to $4,000 for service-connected disability per RSA 72:28-72:36), blind exemption (RSA 72:37, $15,000).

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: if your town's equalization ratio is below 100%, your assessed value understates market value. Frame this as independent confirmation that the property is worth more than the tax card shows.
- Document improvements: updated heating system ($8,000-$18,000), new septic ($15,000-$35,000), renovated kitchen ($20,000-$50,000), added insulation/energy efficiency ($5,000-$15,000). New Hampshire buyers pay premiums for winterized, energy-efficient homes.
- Neighborhood appreciation: cite school district quality (drives NH values significantly), proximity to amenities, and recent comparable sales. Lake/mountain properties command steep premiums — use BTLA precedent to support valuations.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: New Hampshire property tax rates are among the highest in the nation ($15-$35+ per $1,000 of assessed value depending on municipality). Calculate: purchase_price x (local_tax_rate / 1000) for true annual burden. Factor in that the town may reassess after purchase.
- Deferred maintenance: budget $2,000-$5,000 for comprehensive inspection. Key items: septic inspection ($500-$1,000), well test ($200-$500), radon test ($150-$300), chimney inspection ($250-$500). NH-specific risks: ice dam history, frost heave, old underground oil tanks ($10,000-$25,000 cleanup if leaking).
- Assessment vs market value gap: check the DRA equalization ratio for the target municipality. If the ratio is well below 100%, a revaluation could significantly increase assessments and taxes.

COMMERCIAL PROPERTY TACTICS:
- Income approach: the BTLA accepts income capitalization as primary evidence for commercial properties. Cap rates: 7-10% for retail, 8-11% for office, 9-13% for industrial. Rural NH commercial properties warrant higher cap rates.
- Classification verification: New Hampshire does not have a classified tax system, but utility property is assessed differently. Verify correct property type designation on the tax card.
- Depreciation and obsolescence: NH's aging commercial stock (many pre-1970 buildings) warrants significant physical depreciation. Functional obsolescence (inadequate parking, poor layout, no ADA compliance) and economic obsolescence (seasonal tourism fluctuations, remote location) are strong arguments.

SETTLEMENT & HEARING STRATEGY:
- At the selectmen/assessing official abatement hearing, say: "I am requesting an abatement of my assessment from $X to $Y based on [comparable sales / equalization ratio analysis / income approach]. The current assessment exceeds the full and true value of my property as required by RSA 75:1."
- If denied, appeal to the BTLA within 4 months of denial or by September 1 (whichever is later) per RSA 76:16-a. The BTLA provides professional adjudicators and is often more favorable than local boards for well-documented cases.
- Present evidence as: comparable sales analysis (3-5 sales within 1 year, adjusted for differences), property condition report with photos, equalization ratio analysis showing disproportionate assessment, and a clear value conclusion.
- Common mistakes: missing the March 1 abatement deadline, failing to apply for elderly/veteran exemptions before appealing value, not understanding the difference between assessed value and equalized value, presenting comparable sales from different market areas.`,

  NJ: `NEW JERSEY STRATEGIES — THE HIGHEST-TAX BATTLEGROUND STATE:

ASSESSMENT FUNDAMENTALS:
- New Jersey has some of the HIGHEST property taxes in the nation (average ~$9,500/year). Assessments must reflect "full and fair value" as of October 1 of the pre-tax year (N.J.S.A. 54:4-23).
- The Director's Ratio: the state publishes an average ratio for each municipality. If the ratio is below 100%, your assessment effectively exceeds market value by a calculable amount. Under Gloucester Township (1983), you can challenge using the ratio: assessed_value / director's_ratio = implied_market_value.
- Burden of proof: taxpayer must demonstrate by a preponderance of evidence that the assessment exceeds true value. At the County Tax Board, the presumption of correctness attaches to the assessment. You must overcome this presumption.
- Key statutes: N.J.S.A. 54:4-23 (assessment standard), N.J.S.A. 54:3-21 (appeal to County Tax Board), N.J.S.A. 54:51A-1 (Tax Court jurisdiction), N.J.S.A. 54:51A-6 (Chapter 123 Freeze Act).
- Common assessor errors: failure to apply the common level range in non-revaluation years, incorrect property classification, outdated comparable sales, not accounting for environmental contamination, errors in property record card data (wrong square footage, lot size, or building class).

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: the Chapter 123 "Freeze Act" (N.J.S.A. 54:51A-6) — if you win an appeal, the assessment is FROZEN for 2 additional years at the reduced level (in non-revaluation years). This makes a single successful appeal worth 3 years of savings. Always pursue aggressively.
- Cost-to-cure: New Jersey's coastal/humid climate causes significant damage. Document foundation waterproofing ($5,000-$25,000), roof replacement ($8,000-$30,000), mold remediation ($3,000-$30,000), aging oil tank replacement ($3,000-$8,000 above-ground, $10,000-$25,000 underground removal), lead paint remediation ($5,000-$15,000).
- Photo evidence: photograph water damage, basement moisture, aging mechanical systems, outdated kitchens/baths, crumbling exterior masonry. NJ properties in flood zones (common along coast and rivers) should document flood risk factors. An underground oil tank (common in NJ) with leaking risk can justify $10,000-$25,000 deduction.
- Added/Omitted Assessments: if improvements were completed after October 1, only a proportional assessment applies (N.J.S.A. 54:4-63.1 through 63.39). Verify the added assessment reflects the correct completion date — assessors frequently backdate completion.
- Exemption checklist: veterans' exemption ($250 deduction per N.J.S.A. 54:4-3.30), senior/disabled deduction ($250 per N.J.S.A. 54:4-8.40), senior freeze (Property Tax Reimbursement Program for 65+ or disabled with income under ~$150,000).

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: in municipalities with low Director's Ratios (common — many NJ towns are at 50-80%), assessed value significantly understates market value. Frame this as: "The county's own assessment implies a value of only $X, while the market clearly supports $Y."
- Farmland Assessment Act (N.J.S.A. 54:4-23.1 et seq.): qualified farmland assessed at agricultural use value (often $100-500/acre instead of $100,000+/acre). Even 5 acres of productive land (hay, vegetables, nursery stock, horses with minimum $1,000 gross income for 5+ acres) can qualify. If the property has farmland assessment, the buyer should understand rollback tax implications.
- Document improvements: kitchen renovation ($25,000-$75,000), bathroom remodel ($10,000-$35,000), finished basement ($20,000-$50,000), new roof, updated HVAC. NJ's competitive market rewards turnkey properties.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: NJ property taxes are substantial. Calculate: assessed_value x local_tax_rate (typically $2.50-$5.00+ per $100 of assessed value). In revaluation municipalities, assessments reset to market value — your purchase price becomes the baseline.
- Farmland rollback taxes: if purchasing farmland-assessed property and changing use, rollback taxes for the last 2 years of farmland assessment difference become due (N.J.S.A. 54:4-23.8). This can amount to tens of thousands of dollars.
- Deferred maintenance: NJ's aging housing stock (average home age 40+ years) means hidden costs. Budget for: oil tank testing ($500-$1,000), radon test ($150-$300), lead paint inspection ($300-$600), sewer lateral inspection ($250-$500). Underground oil tank leaks are a common NJ nightmare — investigate before closing.
- Assessment vs market value gap: in non-revaluation years, the Director's Ratio reveals the gap. If the municipality hasn't revalued in 10+ years and the ratio is 60%, expect a 67% tax increase when revaluation eventually occurs.

COMMERCIAL PROPERTY TACTICS:
- Income approach: NJ Tax Court (for assessments over $1M) is a formal judicial proceeding with judges who are sophisticated in all three approaches to value. Income capitalization is the primary method for commercial properties. Cap rates: 5-8% for Class A office/retail, 7-10% for Class B, 8-12% for industrial.
- Classification verification: NJ uses property classes 1-4. Class 4A (commercial) vs Class 2 (residential) can affect tax rates in municipalities with split rates. Verify correct classification for mixed-use properties.
- Depreciation and obsolescence: NJ courts recognize all three forms. Economic obsolescence from proximity to Superfund sites, flood zones, or declining commercial corridors is particularly powerful in NJ. Functional obsolescence in older commercial buildings (inadequate parking, no elevator, poor HVAC) is also strong.
- Revaluation years reset ALL assessments. Challenge aggressively in revaluation years — the next chance may be 10+ years away, and the Chapter 123 freeze will protect your reduced value for 2 additional years.

SETTLEMENT & HEARING STRATEGY:
- At the County Tax Board hearing, say: "I am appealing the assessment of $X on the grounds that it exceeds the true market value of my property. Based on [number] comparable sales, the true value as of October 1 of the pre-tax year is $Y. I request a reduction to $Y, with the Chapter 123 freeze applied to the reduced assessment."
- For properties over $1M assessed value, file directly with the NJ Tax Court (N.J.S.A. 54:51A-1). Tax Court judges require professional-quality evidence: certified appraisals, income/expense statements, and formal comparable sales analysis.
- Present evidence as: comparable sales grid with adjustment explanations (location, condition, size, date of sale), property condition report with photos, Director's Ratio analysis, and a clear value conclusion. County Tax Board hearings are relatively informal — organized presentation wins.
- Common mistakes: missing the April 1 filing deadline (May 1 in revaluation years), not understanding the Director's Ratio and common level range, filing at County Tax Board when Tax Court is required (over $1M), failing to request the Chapter 123 freeze when winning an appeal, not preserving the right to appeal to Tax Court by filing at County Tax Board first.`,

  NM: `NEW MEXICO STRATEGIES — THE ONE-THIRD VALUE STATE:

ASSESSMENT FUNDAMENTALS:
- New Mexico assesses at 33.33% of market value (N.M. Stat. Ann. §7-36-15). Non-residential property at 33.33% as well. The math: assessed_value / 0.3333 must equal market value.
- New Mexico caps annual valuation increases at 3% for residential properties that received the head of family exemption in the prior year (N.M. Const. Art. VIII, §1(C)). If the increase exceeded 3%, it is unconstitutional.
- Burden of proof: at the County Valuation Protests Board, the taxpayer must present evidence that the assessed value exceeds 33.33% of market value. The assessor's value carries a presumption of correctness that must be overcome.
- Key statutes: N.M. Stat. Ann. §7-36-15 (assessment ratio), §7-38-17 through §7-38-26 (protest procedures), §7-36-20 (agricultural valuation), N.M. Const. Art. VIII, §1 (uniformity).
- Common assessor errors: applying incorrect land valuations in rural areas, failure to account for the 3% cap for qualifying residential properties, using comparable sales from different market areas (Albuquerque comps for rural properties), incorrect square footage or property characteristics.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: the 3% annual cap for head-of-family-exempt residential properties is frequently miscalculated. Verify: if you had the head of family exemption last year, your current year valuation cannot exceed last year's value x 1.03, regardless of market conditions. If it does, the increase is automatically illegal.
- Cost-to-cure: New Mexico's arid climate causes unique damage. Document adobe/stucco deterioration ($5,000-$20,000), flat roof (vigas/parapet) repair ($4,000-$18,000), evaporative cooler replacement ($2,000-$6,000), water damage from monsoon season ($3,000-$25,000), foundation settlement in expansive soils ($8,000-$30,000).
- Photo evidence: photograph cracking stucco, deteriorating flat roofs, aging swamp coolers, water damage from monsoon events, sun-damaged windows and doors. New Mexico's intense UV and temperature extremes (freeze-thaw at elevation) accelerate deterioration. Document the exterior condition that mass appraisal misses.
- Head of family exemption: $2,000 off assessed value for the head of household (§7-37-4). Veterans' exemption: $4,000 off assessed value (§7-37-5). Disabled veteran: up to $4,000 (§7-37-5.1). Verify ALL applicable exemptions are applied.
- Low-income valuation limitation: the Valuation Limitation for certain low-income taxpayers (§7-36-21.3) can freeze values. Verify eligibility.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: if (assessed / 0.3333) is well below listing price, frame the county's own valuation as outdated evidence that the market has moved beyond their estimates.
- Document improvements: solar panels ($15,000-$30,000 — common in NM's solar market), new roof/stucco ($8,000-$25,000), modern HVAC/refrigerated air conversion ($5,000-$12,000), kitchen remodel ($15,000-$45,000). New Mexico buyers value refrigerated air over evaporative cooling — document the upgrade.
- Neighborhood appreciation: cite recent comparable sales in the same community or pueblo area. Santa Fe, Albuquerque, and Las Cruces have distinct market dynamics — use market-specific evidence.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: calculate (purchase_price x 0.3333 x local_mill_rate / 1000). If the seller had the 3% cap, the assessment may be artificially low. After purchase, the cap resets and the assessment may jump to current market value in the next tax year.
- Deferred maintenance: New Mexico's unique building styles (adobe, territorial, pueblo revival) require specialized maintenance. Budget for stucco re-coating ($3,000-$10,000), flat roof maintenance ($2,000-$8,000), vigas inspection ($500-$2,000). Water infrastructure in rural areas: well testing ($200-$500), septic inspection ($300-$700).
- Assessment vs market value gap: in rapidly appreciating markets (Santa Fe, Albuquerque's Northeast Heights), the 3% cap can create large gaps between assessed and market value. After purchase, expect assessment to reset toward market value.

COMMERCIAL PROPERTY TACTICS:
- Income approach: the County Valuation Protests Board and District Court accept income capitalization for commercial properties. Cap rates: 7-10% for retail in major markets, 8-12% for office, 9-14% for rural commercial. New Mexico's thin commercial markets warrant higher cap rates than national averages.
- Classification verification: ensure commercial properties are correctly classified. Agricultural/ranch properties misclassified as commercial can face dramatic over-assessment. Verify land use designation.
- Depreciation and obsolescence: New Mexico allows physical depreciation (age, condition), functional obsolescence (outdated design, no ADA compliance), and economic obsolescence (remote location, tourism seasonality, tribal land adjacency affecting development potential). Document all applicable factors.

SETTLEMENT & HEARING STRATEGY:
- At the County Valuation Protests Board, say: "I protest the valuation of $X for my property on the grounds that it exceeds the market value. Based on [number] comparable sales within [radius] miles, the market value as of January 1 is $Y, making the correct assessed value $Z (33.33% of $Y)."
- The Protests Board is generally receptive to well-organized comparable sales evidence. Bring property-specific photos, a comparable sales grid with adjustments, and a clear value conclusion.
- If denied, appeal to the District Court within 30 days. District Court provides de novo review with a judge who can independently determine value.
- Present evidence as: comparable sales with photos and adjustment explanations, property condition documentation, exemption verification, and a single-page value summary.
- Common mistakes: missing the 30-day protest deadline from notice of value, not applying for head of family exemption before protesting value, failing to verify the 3% cap was applied correctly, using comparable sales from a different market area (e.g., urban comps for rural property).`,

  NY: `NEW YORK STRATEGIES — THE EQUALIZATION RATE & SCAR STATE:

ASSESSMENT FUNDAMENTALS:
- New York assessment practices vary DRAMATICALLY by municipality. NYC operates under a completely different system than the rest of the state. Outside NYC, assessment is done at the town/city level with widely varying levels of assessment (LOA).
- EQUALIZATION RATES: The state publishes equalization rates for every municipality (RPTL §1202). If your municipality's rate is below 100%, your assessment may be effectively higher than 100% of market value. Calculate: assessed_value / equalization_rate = implied_market_value. If this exceeds actual market value, you are over-assessed.
- Burden of proof: taxpayer must demonstrate by substantial evidence that the assessment is excessive, unequal, or unlawful. Under Matter of FMC Corp. v. Unmack (1980), the taxpayer must show the assessment exceeds full value by clear evidence.
- Key statutes: RPTL §524 (grievance complaint), RPTL §706 (SCAR proceedings), RPTL §720 (certiorari proceedings), RPTL §305 (standard of assessment). NYC: Administrative Code §11-207 through §11-228.
- Common assessor errors: incorrect level of assessment relative to equalization rate, wrong property class, outdated or incorrect physical characteristics on the property card, failure to reflect market decline, improper transitional assessment calculations (NYC).

FOR TAX APPEALS — PROVE LOWER VALUE:
- GRIEVANCE DAY: Third Tuesday in May for most municipalities (RPTL §512). This is your ONLY chance for the year. Miss it and you wait 12 months. File Form RP-524 with the Board of Assessment Review.
- SMALL CLAIMS ASSESSMENT REVIEW (SCAR): Available for residential properties assessed under $450,000 and farm properties under $450,000 (RPTL §730). Streamlined process with independent hearing officers appointed by the court. Highly recommended — success rates are strong and no attorney is needed.
- Primary winning tactic: use the equalization rate to prove over-assessment. If your town's equalization rate is 75% and your property is assessed at $200,000, the implied market value is $266,667. Present comparable sales showing actual market value is lower.
- Cost-to-cure: New York's climate causes significant damage. Document roof replacement ($8,000-$30,000), foundation waterproofing ($5,000-$25,000), boiler/furnace replacement ($5,000-$15,000), window replacement ($10,000-$30,000), siding repair ($8,000-$25,000). Older homes (pre-1950) in upstate NY often need $20,000-$50,000+ in deferred maintenance.
- Photo evidence: photograph water damage in basements (common in NY's wet climate), aging heating systems (many NY homes still have oil heat — conversion costs $8,000-$18,000), deteriorating roofing, and outdated electrical systems. Interior condition photos are critical since assessors use exterior-only inspections.
- NYC properties: assessed at different percentages by class — 6% for Class 1 (1-3 family residential), 45% for Class 4 (commercial). Transitional assessments phase in changes over 5 years for Class 1 and 5 years for Class 2. Verify the phase-in math — errors in the transition calculation are common.
- STAR exemption (School Tax Relief): verify both Basic STAR (up to $30,000 market value exemption) and Enhanced STAR for seniors 65+ (up to $74,900 market value exemption) are applied. Enhanced STAR requires annual income verification. Missing STAR costs $500-$1,500+ annually.
- Veterans' exemption (RPTL §458-a): up to 15% of assessed value for wartime service, additional 10% for combat zone, additional for disability. Verify all tiers are applied.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the equalization rate gap: if your municipality's equalization rate is low (50-80%), the assessed value dramatically understates market value. Frame this as: "The town's own assessment implies a value of only $X, while the market supports $Y — a clear indicator of rapid appreciation."
- Document improvements: kitchen renovation ($20,000-$75,000), bathroom remodel ($10,000-$40,000), finished basement ($15,000-$50,000), energy-efficient upgrades ($5,000-$20,000). Downstate/metro NYC buyers pay significant premiums for turnkey properties.
- Neighborhood appreciation: cite recent comparable sales showing consistent upward trends. NY has extremely localized markets — same-neighborhood sales are far more persuasive than same-town averages.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: New York property taxes vary enormously — from $5 per $1,000 in some NYC areas to $40+ per $1,000 in Westchester/Long Island/upstate cities. Calculate: (purchase_price x equalization_rate x local_tax_rate / 1000) for true annual burden.
- STAR eligibility: verify whether you qualify for Basic STAR ($30,000 exemption) or Enhanced STAR (65+ seniors). The exemption applies automatically if properly registered — verify transfer.
- Deferred maintenance: NY's aging housing stock (many homes 50-100+ years old) means significant hidden costs. Budget for: oil tank inspection ($500-$1,000), chimney inspection ($200-$500), lead paint testing ($300-$600), radon testing ($150-$300). Oil-to-gas conversion costs $8,000-$18,000.
- Assessment vs market value gap: in municipalities with low equalization rates, assessments may be 20-50% below market value. A future revaluation (which the municipality may be forced to conduct) could dramatically increase assessments and taxes.

COMMERCIAL PROPERTY TACTICS:
- Income approach: New York courts are sophisticated and expect professional-quality income analyses for commercial properties. Cap rates: 4-7% for Manhattan/Brooklyn commercial, 6-9% for suburban office/retail, 8-12% for upstate industrial. Present certified income/expense statements.
- NYC classification: Class 4 commercial at 45% assessment ratio is dramatically higher than Class 1 residential at 6%. Misclassification of mixed-use buildings is common and extremely costly. Verify the correct class and allocation between residential and commercial use.
- Depreciation and obsolescence: New York courts (especially the Tax Commission in NYC) recognize functional obsolescence (outdated commercial layouts, inadequate parking, no ADA compliance) and economic obsolescence (changing retail patterns, neighborhood decline, zoning restrictions limiting highest and best use).
- Certiorari proceedings (RPTL Article 7): for large commercial properties, file a certiorari proceeding in Supreme Court. These cases are typically settled through negotiation — the threat of litigation often produces significant reductions.

SETTLEMENT & HEARING STRATEGY:
- At the Board of Assessment Review (Grievance Day), say: "I am filing a grievance on the grounds that my assessed value of $X exceeds the full value of my property. Based on [number] comparable sales and the town's equalization rate of [rate]%, the current assessment implies a market value of $Y, which exceeds the actual market value of $Z."
- For SCAR proceedings: file within 30 days of BAR determination. The hearing officer conducts an independent review. Present comparable sales, photos, and a clear value argument. SCAR officers appreciate organized, data-driven presentations — they hear dozens of cases per day.
- Present evidence as: comparable sales grid with adjustments, equalization rate analysis, property condition photos with repair estimates, and a single-page value conclusion. For NYC properties, include ACRIS transaction data for comparable sales.
- Common mistakes: missing Grievance Day (third Tuesday in May — no extensions), filing SCAR after the 30-day window, not understanding how equalization rates affect your assessment, presenting unadjusted comparable sales without accounting for condition/location differences, challenging the tax rate instead of the assessment.`,

  NC: `NORTH CAROLINA STRATEGIES — THE OCTENNIAL REVALUATION STATE:

ASSESSMENT FUNDAMENTALS:
- North Carolina assesses at 100% of "true value in money" (market value) per N.C.G.S. §105-283. Counties must revalue at least every 8 years (N.C.G.S. §105-286), though many revalue every 4 years.
- Burden of proof: taxpayer must show by the "greater weight of evidence" that the assessment exceeds true value. Under In re McElwee (2002), taxpayer evidence must affirmatively show value — merely criticizing the county's methodology is insufficient.
- Key statutes: N.C.G.S. §105-286 (revaluation schedule), §105-317 (assessment methodology), §105-322 (Board of Equalization and Review), §105-290 (Property Tax Commission appeals), §105-277.2 through §105-277.7 (Present Use Value).
- Common assessor errors: applying neighborhood-wide percentage adjustments without individual property inspection, incorrect land-to-improvement allocation, failing to account for physical deterioration in mass appraisal models, using comparable sales from outside the subject's immediate market area.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: in revaluation years, challenge the base value aggressively — it sets the foundation for the next 4-8 years. Even a small reduction compounds over the entire cycle. Between revaluation years, you can only appeal if there was a factual error or the value exceeds true value.
- Cost-to-cure: North Carolina's humid subtropical climate causes significant damage. Document wood rot ($3,000-$15,000), termite damage ($3,000-$12,000), mold remediation ($5,000-$30,000), roof replacement ($7,000-$25,000), HVAC replacement ($5,000-$15,000), foundation moisture intrusion ($5,000-$20,000).
- Photo evidence: photograph moisture damage, wood rot in crawl spaces (extremely common in NC), termite damage evidence, aging HVAC systems, deteriorating siding. NC's humidity and rainfall make moisture-related issues the most common and costly deficiency — document thoroughly.
- Present Use Value (PUV): agricultural, horticultural, and forestland qualifies for use-value assessment (N.C.G.S. §105-277.2 through §105-277.7). Deferred taxes apply if the property exits the program (3 years of rollback). Even 10 acres of timber or agricultural use can qualify — verify enrollment.
- Elderly/disabled exclusion: $25,000 or 50% of appraised value (whichever is greater) excluded for homeowners 65+ or totally/permanently disabled with income under $33,800 (N.C.G.S. §105-277.1). Disabled veteran exclusion: first $45,000 of appraised value for qualifying veterans (N.C.G.S. §105-277.1C). Verify eligibility and application.
- Circuit breaker tax deferment: qualifying elderly/disabled homeowners with income under $46,500 can defer taxes exceeding 4% of income (N.C.G.S. §105-277.1B). This is a powerful but underutilized program.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: if the county hasn't revalued recently, assessed values may significantly lag market values. Frame this as evidence of rapid appreciation that the county's own schedule has not caught up with.
- Document improvements: kitchen renovation ($15,000-$50,000), bathroom remodel ($8,000-$30,000), deck/outdoor living ($5,000-$25,000), energy-efficient upgrades ($3,000-$15,000). NC buyers in the Triangle (Raleigh-Durham-Chapel Hill) and Charlotte metro pay premiums for updated properties.
- Neighborhood appreciation: cite recent comparable sales in the same subdivision or school district. NC's rapid population growth (particularly in Triangle, Charlotte, and Wilmington areas) drives strong appreciation — use recent sales to support higher listing price.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: NC assesses at 100% of market value. Calculate: purchase_price x county_tax_rate (typically $0.40-$1.00 per $100). Factor in municipal tax if within city limits (adds $0.30-$0.70 per $100). A revaluation year could reset all assessments upward.
- Deferred maintenance: NC's climate demands attention to moisture issues. Budget for: crawl space inspection ($200-$500), termite inspection (typically free from pest companies), HVAC inspection ($150-$300), roof inspection ($200-$400). Key costs: crawl space encapsulation ($5,000-$15,000), termite treatment ($1,000-$3,000), sewer line repair ($3,000-$10,000).
- Assessment vs market value gap: in hot markets (Charlotte, Raleigh-Durham, Asheville), properties purchased between revaluations may be assessed well below purchase price until the next revaluation. Budget for the tax increase when revaluation occurs.
- PUV rollback taxes: if purchasing property currently enrolled in Present Use Value, exiting the program triggers 3 years of deferred taxes. This can amount to thousands of dollars — verify PUV status before purchase.

COMMERCIAL PROPERTY TACTICS:
- Income approach: the NC Property Tax Commission accepts income capitalization as primary evidence for commercial properties. Cap rates: 6-8% for Charlotte/Triangle Class A retail/office, 7-10% for suburban commercial, 9-13% for rural commercial. Present certified income/expense statements.
- Classification verification: NC does not use a classified tax system (all property taxed at the same rate), but use classification (commercial vs residential) affects valuation methodology. Verify the property card reflects the correct use.
- Depreciation and obsolescence: NC allows physical depreciation (age, condition), functional obsolescence (outdated commercial layouts, inadequate parking), and economic obsolescence (market decline, oversupply in commercial corridors). Document all with market evidence — especially economic obsolescence in rural NC commercial markets.

SETTLEMENT & HEARING STRATEGY:
- At the Board of Equalization and Review, say: "I am requesting a reduction in the appraised value of my property from $X to $Y. Based on [number] comparable sales within my market area, the true value in money as of the valuation date is $Y. I have attached a comparable sales analysis with adjustments."
- If unsatisfied, appeal to the NC Property Tax Commission within 30 days of the Board's decision (N.C.G.S. §105-290). The PTC provides a formal hearing with appointed commissioners. Present professional-quality evidence.
- Present evidence as: comparable sales grid with photo and adjustment explanations, property condition report with photographs, contractor estimates for deferred maintenance, and a clear value conclusion with supporting math.
- Common mistakes: missing the Board of Equalization and Review filing window (varies by county — check your county's schedule), not filing during the revaluation year (waiting until a non-revaluation year limits grounds for appeal), presenting unadjusted comparable sales, challenging the tax rate instead of the assessed value.`,

  ND: `NORTH DAKOTA STRATEGIES — THE DUAL-RATIO AGRICULTURAL STATE:

ASSESSMENT FUNDAMENTALS:
- North Dakota assesses residential and commercial at 50% of true and full value, agricultural at 50% of agricultural value (which is based on productivity, not market value). Agricultural land is then taxed at a lower rate (N.D.C.C. §57-02-01).
- The assessed value for agricultural land uses the Soil Conservation Service (NRCS) soil productivity ratings multiplied by legislatively set values per acre. Non-cropland has separate rates.
- Burden of proof: taxpayer must show by a preponderance of evidence that the assessed value exceeds 50% of true and full value. At the State Board of Equalization, the standard is whether the county board acted reasonably.
- Key statutes: N.D.C.C. §57-02-01 (assessment standards), §57-02-11 (50% ratio), §57-02-14.1 (abatement procedure), §57-02-26 through §57-02-27 (appeal to county/state board), N.D. Const. Art. X, §5 (uniformity).
- Common assessor errors: incorrect soil classifications for agricultural land (using statewide averages instead of parcel-specific NRCS data), failure to account for physical depreciation on older homes, applying incorrect land values in transitional areas (ag to residential), not reflecting adverse site conditions.

FOR TAX APPEALS — PROVE LOWER VALUE:
- Primary winning tactic: challenge the soil productivity rating for agricultural land. The NRCS soil survey assigns specific productivity values to each soil type. If the assessor used an incorrect soil classification or failed to account for non-productive areas (wetlands, rocks, alkali), the agricultural assessment is wrong.
- Cost-to-cure: North Dakota's extreme climate causes severe damage. Document frost heaving foundation damage ($8,000-$30,000), roof damage from snow load ($6,000-$20,000), window failure from extreme cold ($8,000-$20,000), heating system replacement ($5,000-$15,000), siding damage from wind/hail ($5,000-$18,000).
- Photo evidence: photograph frost-damaged foundations, ice dam staining, aging heating systems (critical in ND's -30°F winters), storm-damaged roofing and siding, deteriorating outbuildings. ND's extreme temperature range (-40°F to 110°F) destroys building materials rapidly — document every deficiency.
- Homestead Credit: provides property tax relief for qualifying homeowners (N.D.C.C. §57-02-08.1). Income-based — maximum credit for qualifying homeowners with income under $42,000. Verify application annually.
- Disabled veteran property tax credit: up to $8,100 for qualifying disabled veterans (N.D.C.C. §57-02-08.8). Verify application.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: if (assessed / 0.50) is well below listing price, the county's own assessment demonstrates the property has appreciated beyond their valuation. ND's compressed assessment timeline (annual adjustments with limited inspection) means assessments lag in appreciating markets.
- Document improvements: energy-efficient windows ($8,000-$20,000), new heating system ($5,000-$15,000), insulation upgrades ($3,000-$10,000), updated kitchen ($15,000-$40,000), garage addition ($15,000-$40,000). ND buyers value cold-weather efficiency — heated garages, storm windows, and modern heating are premium features.
- Neighborhood appreciation: cite recent comparable sales in same city/township. Fargo, Bismarck, and western ND oil communities (Williston, Watford City) have distinct market dynamics.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: calculate (purchase_price x 0.50 x local_mill_rate / 1000) for residential. ND mill rates vary significantly by jurisdiction — rural rates can be half of urban rates.
- Deferred maintenance: ND's severe winters mean hidden damage is common. Budget for: foundation inspection ($300-$500), heating system inspection ($150-$300), roof inspection ($200-$400), chimney inspection ($200-$500). Critical costs: foundation repair ($8,000-$30,000), heating system replacement ($5,000-$15,000), well/septic issues in rural areas ($5,000-$25,000).
- Assessment vs market value gap: in western ND oil communities, market values fluctuate with energy prices. Assessments may not reflect rapid price changes in either direction.

COMMERCIAL PROPERTY TACTICS:
- Income approach: ND accepts income capitalization for commercial properties at both the county and state board level. Cap rates: 8-11% for retail/office in Fargo/Bismarck, 9-13% for rural commercial, 7-10% for oil-region commercial. Present income/expense statements with market-derived cap rate.
- Classification verification: residential at 50% vs agricultural land at productivity-based value — properties transitioning from agricultural to residential/commercial use must be reclassified. Verify the correct classification and valuation method.
- Depreciation and obsolescence: ND allows all three forms. Economic obsolescence from population decline in rural areas, distance from markets, and oil price volatility (western ND) can significantly reduce commercial assessments.

SETTLEMENT & HEARING STRATEGY:
- The appeal process is compressed: city/township board (first Tuesday after second Monday in April), then county equalization (first Tuesday in June). Prepare evidence BEFORE April.
- At the local board, say: "I am appealing the assessed value of $X for my property. Based on [comparable sales / soil productivity data / income analysis], the true and full value is $Y, making the correct assessed value $Z (50% of $Y)."
- Present evidence as: comparable sales grid with adjustments, NRCS soil maps for agricultural land, property condition photos with repair estimates, and a clear value conclusion.
- Common mistakes: missing the April local board meeting (the first step is mandatory — you cannot skip to county), not challenging agricultural soil classifications when they are clearly wrong, presenting comparable sales from a different market area, failing to apply for the Homestead Credit before appealing value.`,

  OH: `OHIO STRATEGIES — THE SEXENNIAL REAPPRAISAL & BOR STATE:

ASSESSMENT FUNDAMENTALS:
- Ohio reassesses every 6 years (sexennial reappraisal) with a triennial update at year 3. Assessed value is 35% of true (market) value (O.R.C. §5715.01). The math: assessed_value / 0.35 must equal market value.
- In triennial update years, values are adjusted by the county auditor using aggregate market data (sales ratio studies) — NOT individual property inspection. Challenge whether the aggregate adjustment accurately reflects YOUR specific property's condition and market.
- Burden of proof: at the Board of Revision (BOR), the taxpayer must present competent and probative evidence that the assessment exceeds true value. Under Vandalia-Butler City Schools v. Dayton (2011), recent arm's-length sales of the subject property are the "best evidence" of value.
- Key statutes: O.R.C. §5715.01 (35% assessment), §5715.19 (complaint to BOR), §5717.01 (appeal to BTA), §5713.31 (CAUV), O.R.C. §323.152 (homestead exemption).
- Common assessor errors: applying blanket percentage increases during triennial updates without considering individual property conditions, using stale comparable sales from before the tax lien date, incorrect physical characteristics on the property card (wrong square footage, room count, condition rating), failure to reflect recent market decline.

FOR TAX APPEALS — PROVE LOWER VALUE:
- COMPLAINT TO BOARD OF REVISION: File between January 1 and March 31 (O.R.C. §5715.19). You need evidence of value AS OF the tax lien date (January 1 of the tax year). Recent sales within 12-24 months of that date are most persuasive. The BOR must schedule a hearing — prepare professionally.
- Primary winning tactic: present 5-7 comparable sales within 1 mile, sold within 24 months of the tax lien date, adjusted for condition, size, and location differences. Under Berea City School District v. Cuyahoga County BOR (2008), the BTA requires adjustments to comparable sales — unadjusted comps are given less weight.
- Cost-to-cure: Ohio's freeze-thaw climate causes extensive damage. Document foundation cracking ($8,000-$30,000), basement waterproofing ($5,000-$20,000), roof replacement ($7,000-$25,000), window replacement ($8,000-$25,000), HVAC replacement ($5,000-$15,000), chimney repair ($2,000-$8,000).
- Photo evidence: photograph basement water intrusion (extremely common in Ohio), foundation cracks, aging mechanical systems, deteriorating siding, outdated kitchens and bathrooms. Ohio's clay soils and wet climate make moisture issues the most common deficiency — document water stains, efflorescence on basement walls, sump pump evidence.
- CAUV (Current Agricultural Use Value): farmland assessed at agricultural use value rather than market value (O.R.C. §5713.31). Can reduce land assessment by 80-95%. Requires initial application and annual renewal. Even 10 acres of actively farmed land can qualify. Verify enrollment — the savings are enormous.
- Owner-occupied tax reduction: 2.5% rollback on all owner-occupied residential property, plus 10% rollback on pre-existing levies (O.R.C. §323.152). Verify BOTH are applied.
- Homestead exemption: qualifying seniors (65+) or permanently/totally disabled homeowners can exempt up to $25,000 of market value (O.R.C. §323.152(A)). Income limit applies (~$36,100). Verify application.

FOR PRE-LISTING — PROVE HIGHER VALUE:
- Use the assessment gap: Ohio's 6-year reappraisal cycle means assessments can lag market values significantly, especially in years 4-6 of the cycle. If (assessed / 0.35) is below listing price, frame the gap as independent confirmation of appreciation.
- Document improvements: kitchen renovation ($15,000-$50,000), bathroom remodel ($8,000-$30,000), finished basement ($15,000-$40,000), new windows ($8,000-$25,000), new roof ($7,000-$25,000). Ohio buyers value updated mechanicals and dry basements — document these features prominently.
- Neighborhood appreciation: cite recent comparable sales in the same school district. Ohio property values are strongly tied to school district quality — use district-specific sales data.

FOR PRE-PURCHASE — PROTECT THE BUYER:
- Tax burden projection: calculate (purchase_price x 0.35 x effective_tax_rate / 1000). Ohio effective tax rates range from $15 to $40+ per $1,000 of assessed value depending on school district levies. Factor in where the property falls in the reappraisal cycle — a reappraisal or triennial update could increase assessment to match purchase price.
- CAUV rollback: if purchasing CAUV-enrolled farmland and converting to non-agricultural use, rollback taxes for 3 prior years become due (O.R.C. §5713.34). This can amount to tens of thousands of dollars. Verify CAUV status before purchase.
- Deferred maintenance: Ohio's wet climate and clay soils create endemic moisture issues. Budget for: basement/foundation inspection ($300-$600), sewer line scope ($200-$400), radon test ($150-$300), chimney inspection ($200-$500). Key costs: basement waterproofing ($5,000-$20,000), sewer line replacement ($5,000-$15,000), foundation stabilization ($8,000-$30,000).
- Assessment vs market value gap: in appreciating markets (Columbus, Cincinnati, Cleveland suburbs), properties purchased mid-cycle may be assessed well below purchase price until the next reappraisal. Budget for the tax increase.

COMMERCIAL PROPERTY TACTICS:
- Income approach: Ohio BOR and BTA accept income capitalization as primary evidence for commercial properties. Cap rates: 6-9% for Class A retail/office in major metros, 8-11% for suburban commercial, 9-13% for rural commercial. Present certified income/expense statements with market-derived cap rate.
- The BTA (Ohio Board of Tax Appeals) hears state-level appeals and its decisions are precedent-setting (O.R.C. §5717.01). Cite prior BTA decisions supporting your valuation methodology. Key precedent: Berea City School District (comparable sales adjustments required), Springfield Local Schools (income approach for commercial).
- Classification verification: Ohio does not use a classified tax system, but property type affects valuation methodology. Ensure commercial property is valued using appropriate commercial methods, not residential mass appraisal.
- Depreciation and obsolescence: Ohio recognizes physical depreciation, functional obsolescence (outdated commercial layouts, single-purpose buildings, inadequate loading/parking), and economic obsolescence (market oversupply, location decline, environmental contamination). Under Woda Ivy Glen v. Fayette County BOR, economic obsolescence must be supported by market data.

SETTLEMENT & HEARING STRATEGY:
- At the Board of Revision hearing, say: "I have filed a complaint requesting a reduction in the true value of my property from $X to $Y, based on [number] comparable sales within [radius] miles of the subject property, all sold within [timeframe] of the January 1 tax lien date. I have adjusted these sales for differences in size, condition, location, and age."
- BOR hearings are recorded. Treat them as formal proceedings. Bring organized evidence, speak clearly, and address each comparable sale's relevance. The assessor will present counter-evidence — be prepared to rebut.
- If the BOR denies your complaint, appeal to the BTA within 30 days (O.R.C. §5717.01). The BTA provides de novo review with professional hearing examiners. BTA proceedings are more formal — consider professional representation for high-value properties.
- Present evidence as: comparable sales analysis with detailed adjustment grid, property condition photos (especially basement/foundation), contractor estimates for repairs, CAUV soil maps if applicable, and a clear value conclusion.
- Common mistakes: missing the January 1-March 31 BOR filing window, presenting comparable sales without adjustments (the BTA will give them minimal weight), using sales outside the tax lien date window, not preserving the right to appeal to BTA by filing at BOR first, failing to apply for owner-occupied rollback and homestead exemption before appealing value.`,

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
