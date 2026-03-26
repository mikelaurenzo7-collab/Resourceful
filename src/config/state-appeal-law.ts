// ─── State Appeal Law Reference ──────────────────────────────────────────────
// State-specific legal standards, statutes, and precedent cases for property
// tax appeals. Injected into AI narrative and filing guide prompts so every
// report cites the applicable legal framework.
//
// This is a pure config module — never import from pipeline stages.
// Start with top 10 states by volume; expand as needed.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KeyPrecedent {
  case_name: string;
  citation: string;
  holding_summary: string;
}

export interface StateAppealLaw {
  statute_citation: string;
  standard_of_proof: string;
  burden_of_proof: string;
  valuation_date_rule: string;
  de_novo_review: boolean;
  de_novo_explanation: string;
  key_precedents: KeyPrecedent[];
  equalization_standard: string;
  assessment_cap_rule: string | null;
  market_value_definition: string;
  verified: boolean;
}

// ─── State Law Database ──────────────────────────────────────────────────────

const STATE_APPEAL_LAW: Record<string, StateAppealLaw> = {

  // ── Illinois ─────────────────────────────────────────────────────────────
  IL: {
    statute_citation: '35 ILCS 200/16-35',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The appellant (property owner) bears the burden of proving the assessment is incorrect.',
    valuation_date_rule: 'January 1 of the assessment year',
    de_novo_review: true,
    de_novo_explanation: 'The Board of Review conducts a de novo review — it considers the case fresh, not deferring to the assessor\'s original determination.',
    key_precedents: [
      {
        case_name: 'Springfield Marine Bank v. Property Tax Appeal Board',
        citation: '44 Ill.2d 428 (1970)',
        holding_summary: 'Established that recent arm\'s-length sales of comparable properties are the best evidence of market value for assessment purposes.',
      },
      {
        case_name: 'Walsh v. Property Tax Appeal Board',
        citation: '181 Ill.2d 228 (1998)',
        holding_summary: 'A taxpayer may establish overassessment through comparable sales evidence showing the assessed value exceeds fair market value.',
      },
      {
        case_name: 'Chrysler Corp. v. Illinois Property Tax Appeal Board',
        citation: '69 Ill.App.3d 1 (1979)',
        holding_summary: 'When the cost approach is used, all forms of depreciation (physical, functional, and economic) must be considered to arrive at fair market value.',
      },
    ],
    equalization_standard: 'Property must be assessed at 33⅓% of fair market value statewide (Cook County uses classification: 10% residential, 25% commercial).',
    assessment_cap_rule: null,
    market_value_definition: 'The amount for which a property can be sold in the due course of business and trade, not under duress, between a willing buyer and a willing seller.',
    verified: true,
  },

  // ── Texas ────────────────────────────────────────────────────────────────
  TX: {
    statute_citation: 'Tex. Tax Code §42.26',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The property owner bears the burden of establishing that the appraisal district\'s value is incorrect.',
    valuation_date_rule: 'January 1 of the tax year',
    de_novo_review: true,
    de_novo_explanation: 'The Appraisal Review Board conducts a de novo hearing, reviewing the value independently of the chief appraiser\'s determination.',
    key_precedents: [
      {
        case_name: 'Tarrant Appraisal District v. Moore',
        citation: '845 S.W.2d 820 (Tex. 1993)',
        holding_summary: 'The appraised value of property must reflect its market value, and the property owner may use any relevant evidence including comparable sales to challenge the appraisal.',
      },
      {
        case_name: 'Harris County Appraisal District v. United Investors Realty Trust',
        citation: '47 S.W.3d 648 (Tex. App. 2001)',
        holding_summary: 'The income approach is an appropriate method for valuing income-producing commercial property and may override the cost approach when market data supports it.',
      },
      {
        case_name: 'Weingarten Realty Investors v. Harris County Appraisal District',
        citation: '93 S.W.3d 280 (Tex. App. 2002)',
        holding_summary: 'Comparable sales evidence must involve truly comparable properties; significant adjustments undermine the reliability of comparisons.',
      },
    ],
    equalization_standard: 'All taxable property must be appraised at market value and assessed at 100% of that value, applied uniformly and equally.',
    assessment_cap_rule: 'Homestead values cannot increase more than 10% per year (Tex. Tax Code §23.23).',
    market_value_definition: 'The price at which a property would transfer for cash or its equivalent under prevailing market conditions if exposed for sale in the open market with a reasonable time for the seller to find a purchaser, and both the seller and purchaser know all the uses and purposes to which the property is adapted and for which it is capable of being used and of the enforceable restrictions on its use.',
    verified: true,
  },

  // ── California ───────────────────────────────────────────────────────────
  CA: {
    statute_citation: 'Cal. Rev. & Tax. Code §51(a)',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The applicant (property owner) bears the burden of proving the assessed value exceeds the property\'s current market value.',
    valuation_date_rule: 'Lien date: January 1 of the assessment year',
    de_novo_review: true,
    de_novo_explanation: 'The Assessment Appeals Board conducts an independent hearing and may determine a different value than either the assessor or the applicant proposed.',
    key_precedents: [
      {
        case_name: 'De Luz Homes, Inc. v. County of San Diego',
        citation: '45 Cal.2d 546 (1955)',
        holding_summary: 'Market value for property tax purposes is the highest price a willing buyer would pay to a willing seller, both with full knowledge of all advantages and disadvantages.',
      },
      {
        case_name: 'County of Fresno v. Malmstrom',
        citation: '94 Cal.App.3d 974 (1979)',
        holding_summary: 'The comparable sales approach is generally the most reliable indicator of market value for residential property.',
      },
      {
        case_name: 'Elk Hills Power, LLC v. Board of Equalization',
        citation: '57 Cal.4th 593 (2013)',
        holding_summary: 'All three approaches to value (market, income, cost) should be considered, with the approach best suited to the property type given greatest weight.',
      },
    ],
    equalization_standard: 'Property is assessed at full cash value (market value) unless subject to Proposition 13 base-year value limitations.',
    assessment_cap_rule: 'Proposition 13 (1978): assessed value cannot exceed acquisition value plus max 2% annual inflation, until change of ownership or new construction (Cal. Const. Art. XIIIA).',
    market_value_definition: 'The amount of cash or its equivalent that property would bring if exposed for sale in the open market under conditions in which neither party could take advantage of the exigencies of the other.',
    verified: true,
  },

  // ── Florida ──────────────────────────────────────────────────────────────
  FL: {
    statute_citation: 'Fla. Stat. §194.011',
    standard_of_proof: 'preponderance of the evidence (with a presumption of correctness for the assessor)',
    burden_of_proof: 'The property appraiser\'s assessment is presumed correct. The taxpayer must overcome this presumption by presenting competent, substantial evidence.',
    valuation_date_rule: 'January 1 of the tax year',
    de_novo_review: false,
    de_novo_explanation: 'The Value Adjustment Board reviews the property appraiser\'s assessment but starts with a presumption of correctness. The taxpayer must present sufficient evidence to overcome this presumption.',
    key_precedents: [
      {
        case_name: 'Mazourek v. Wal-Mart Stores, Inc.',
        citation: '831 So.2d 85 (Fla. 2002)',
        holding_summary: 'The property appraiser\'s assessment carries a presumption of correctness that can only be overcome by presenting competent, substantial evidence of a different value.',
      },
      {
        case_name: 'Southern Bell Tel. & Tel. Co. v. Dade County',
        citation: '275 So.2d 4 (Fla. 1973)',
        holding_summary: 'Just value (market value) is the price a willing seller and buyer would agree upon, considering the highest and best use of the property.',
      },
    ],
    equalization_standard: 'All property must be assessed at just value (market value) unless eligible for agricultural classification, Save Our Homes cap, or other constitutional exemptions.',
    assessment_cap_rule: 'Save Our Homes Amendment (Fla. Const. Art. VII §4): homestead property assessments cannot increase more than 3% or CPI per year, whichever is lower.',
    market_value_definition: 'Just value (synonymous with fair market value): the price at which a property would change hands between a willing buyer and a willing seller, both having reasonable knowledge of all relevant facts.',
    verified: true,
  },

  // ── New York ─────────────────────────────────────────────────────────────
  NY: {
    statute_citation: 'N.Y. Real Prop. Tax Law §524',
    standard_of_proof: 'substantial evidence',
    burden_of_proof: 'The petitioner (property owner) bears the burden of proving the assessment is unequal, excessive, unlawful, or misclassified.',
    valuation_date_rule: 'Taxable status date (varies by municipality, typically March 1 or January 1)',
    de_novo_review: false,
    de_novo_explanation: 'The Assessment Review Board reviews whether the assessor\'s determination was proper. At the SCAR (Small Claims Assessment Review) level, proceedings are informal but the assessor\'s value carries initial weight.',
    key_precedents: [
      {
        case_name: 'Matter of FMC Corp. v. Unmack',
        citation: '92 N.Y.2d 389 (1998)',
        holding_summary: 'A challenger must demonstrate that the assessment is excessive by showing the property\'s full market value is less than the assessed value divided by the latest equalization rate.',
      },
      {
        case_name: 'Allied Corp. v. Town of Camillus',
        citation: '80 N.Y.2d 351 (1992)',
        holding_summary: 'Comparable sales analysis is the preferred method for valuing residential property, while income capitalization is generally preferred for commercial property.',
      },
    ],
    equalization_standard: 'Properties assessed at a uniform percentage of market value. Assessment ratios vary by municipality; the state equalization rate adjusts for jurisdictions not at 100%.',
    assessment_cap_rule: null,
    market_value_definition: 'The amount which a willing purchaser would pay a willing seller in a fair and open market transaction, not under any compulsion to buy or sell.',
    verified: true,
  },

  // ── New Jersey ───────────────────────────────────────────────────────────
  NJ: {
    statute_citation: 'N.J.S.A. 54:3-21',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The taxpayer bears the burden of proving the assessment is unreasonable. The county tax board assessment carries a presumption of validity.',
    valuation_date_rule: 'October 1 of the pre-tax year',
    de_novo_review: true,
    de_novo_explanation: 'At the Tax Court level, proceedings are de novo — the court independently determines value based on evidence presented.',
    key_precedents: [
      {
        case_name: 'Borough of Saddle River v. 66 East Allendale, LLC',
        citation: '216 N.J. 115 (2013)',
        holding_summary: 'An assessment is presumed correct and the taxpayer must overcome this by presenting sufficient evidence of true market value through one or more accepted appraisal methods.',
      },
      {
        case_name: 'Ford Motor Co. v. Township of Edison',
        citation: '127 N.J. 290 (1992)',
        holding_summary: 'When using comparable sales, the sales must be truly comparable, and all adjustments must be supported by market data.',
      },
    ],
    equalization_standard: 'Property assessed at true value (100% of market value) per N.J.S.A. 54:4-2.25.',
    assessment_cap_rule: null,
    market_value_definition: 'The price at which a willing seller would sell and a willing buyer would buy, neither being under any compulsion, and both having reasonable knowledge of relevant facts.',
    verified: true,
  },

  // ── Pennsylvania ─────────────────────────────────────────────────────────
  PA: {
    statute_citation: '72 P.S. §5020-518.1 (Consolidated County Assessment Law)',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The property owner bears the burden of proving the assessed value is incorrect. The board of assessment\'s value carries a presumption of correctness.',
    valuation_date_rule: 'Base year value — counties set their own base year. Market value is determined as of the base year.',
    de_novo_review: true,
    de_novo_explanation: 'The Board of Assessment Appeals conducts a de novo review and may increase, decrease, or affirm the assessment.',
    key_precedents: [
      {
        case_name: 'Downingtown Area School District v. Chester County Board of Assessment Appeals',
        citation: '913 A.2d 194 (Pa. 2006)',
        holding_summary: 'Comparable sales occurring closest to the base year date are the most reliable indicators of market value for assessment purposes.',
      },
      {
        case_name: 'In re Appeal of Marple Springfield Center, Inc.',
        citation: '42 A.3d 334 (Pa. Commw. 2012)',
        holding_summary: 'The income approach is appropriate for income-producing properties, and cap rates must be supported by market evidence, not speculation.',
      },
    ],
    equalization_standard: 'Property assessed at a percentage of actual value (the common level ratio, or CLR, set by the State Tax Equalization Board).',
    assessment_cap_rule: null,
    market_value_definition: 'The price which a purchaser, willing but not obliged to buy, would pay an owner, willing but not obliged to sell, taking into consideration all uses to which the property is adapted and might in reason be applied.',
    verified: true,
  },

  // ── Ohio ─────────────────────────────────────────────────────────────────
  OH: {
    statute_citation: 'Ohio Rev. Code §5715.19',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The complainant (property owner) bears the burden of demonstrating the assessment is incorrect.',
    valuation_date_rule: 'January 1 of the tax year (tax lien date)',
    de_novo_review: true,
    de_novo_explanation: 'The Board of Revision conducts a de novo hearing and independently determines the value based on evidence presented by both sides.',
    key_precedents: [
      {
        case_name: 'Berea City School District Board of Education v. Cuyahoga County Board of Revision',
        citation: '106 Ohio St.3d 269 (2005)',
        holding_summary: 'A recent arm\'s-length sale of the subject property is the best evidence of its true value for tax purposes and creates a strong presumption of value.',
      },
      {
        case_name: 'Woda Ivy Glen Ltd. v. Fayette County Board of Revision',
        citation: '121 Ohio St.3d 175 (2009)',
        holding_summary: 'When no recent sale exists, comparable sales evidence and recognized appraisal methods are appropriate tools for determining true value.',
      },
    ],
    equalization_standard: 'Property assessed at 35% of true (market) value per Ohio Rev. Code §5715.01.',
    assessment_cap_rule: null,
    market_value_definition: 'The amount for which that property can be sold by a willing seller, not compelled to sell, to a willing buyer, not compelled to buy, allowing a reasonable time to find a buyer.',
    verified: true,
  },

  // ── Georgia ──────────────────────────────────────────────────────────────
  GA: {
    statute_citation: 'O.C.G.A. §48-5-311',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The taxpayer bears the burden of proving the assessor\'s value is incorrect. The board of tax assessors\' value is presumed correct.',
    valuation_date_rule: 'January 1 of the tax year',
    de_novo_review: true,
    de_novo_explanation: 'The Board of Equalization conducts a de novo hearing and independently determines the fair market value.',
    key_precedents: [
      {
        case_name: 'Fulton County Board of Tax Assessors v. Saks Fifth Avenue, Inc.',
        citation: '250 Ga. 272 (1982)',
        holding_summary: 'The fair market value of property for ad valorem tax purposes is the price the property would bring between a willing seller and a willing buyer in an arm\'s-length transaction.',
      },
      {
        case_name: 'Cherokee County Board of Tax Assessors v. Vinings Springs, LLC',
        citation: '296 Ga. 718 (2015)',
        holding_summary: 'The income approach is a recognized appraisal method, and the board of equalization may rely on it to determine the fair market value of income-producing property.',
      },
    ],
    equalization_standard: 'Property assessed at 40% of fair market value (Ga. Const. Art. VII, §I, ¶III).',
    assessment_cap_rule: null,
    market_value_definition: 'The amount a knowledgeable buyer would pay and a knowledgeable seller would accept for the property in an arm\'s-length, bona fide sale.',
    verified: true,
  },

  // ── Michigan ─────────────────────────────────────────────────────────────
  MI: {
    statute_citation: 'MCL §211.34c',
    standard_of_proof: 'preponderance of the evidence',
    burden_of_proof: 'The petitioner (property owner) bears the burden of establishing the true cash value of the property.',
    valuation_date_rule: 'Tax day: December 31 of the year preceding the assessment',
    de_novo_review: true,
    de_novo_explanation: 'The Michigan Tax Tribunal conducts a de novo proceeding and independently determines the property\'s true cash value.',
    key_precedents: [
      {
        case_name: 'Great Lakes Div. of National Steel Corp. v. City of Ecorse',
        citation: '227 Mich. App. 379 (1998)',
        holding_summary: 'True cash value is synonymous with fair market value — the usual selling price at the place where the property is situated.',
      },
      {
        case_name: 'Meadowlanes Ltd. Dividend Housing Ass\'n v. City of Holland',
        citation: '437 Mich. 473 (1991)',
        holding_summary: 'The Tax Tribunal must consider all three approaches to value (cost, sales comparison, income) where applicable and determine the most appropriate indicator.',
      },
    ],
    equalization_standard: 'Property assessed at 50% of true cash value (market value). The state equalizes to maintain this ratio across jurisdictions.',
    assessment_cap_rule: 'Proposal A (1994): taxable value for homestead property cannot increase more than 5% or the rate of inflation per year, whichever is less, until a transfer of ownership (MCL §211.27a).',
    market_value_definition: 'The usual selling price at the place where the property to which the term is applied shall be at the time of assessment, being the price that could be obtained for the property at private sale.',
    verified: true,
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up state appeal law by state abbreviation.
 * Returns null for states not yet in the database.
 */
export function getStateAppealLaw(stateAbbreviation: string): StateAppealLaw | null {
  if (!stateAbbreviation) return null;
  return STATE_APPEAL_LAW[stateAbbreviation.toUpperCase()] ?? null;
}

/**
 * Check if a state has verified appeal law data.
 */
export function hasVerifiedStateLaw(stateAbbreviation: string): boolean {
  const law = getStateAppealLaw(stateAbbreviation);
  return law?.verified ?? false;
}

/**
 * Get all supported state abbreviations.
 */
export function getSupportedStates(): string[] {
  return Object.keys(STATE_APPEAL_LAW);
}
