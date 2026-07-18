# Resourceful Final Report Case Standard

## Operating model

Resourceful uses one branded report family whose analytical scope changes with the assignment and evidence. The authoritative path is:

`evidence -> normalized workfile -> deterministic policies -> case profile -> React-PDF renderer -> release preflight -> immutable manifest -> delivery verification`

AI may draft source-grounded prose. It does not control calculations, method applicability, jurisdiction rules, section hierarchy, layout, legal labeling, or release decisions.

## Fixed in every report

Every report uses the same Resourceful typography, spacing, colors, headings, tables, footers, numerical formats, source rules, limitation language, and immutable artifact flow. The default document identity is an AI-assisted property valuation analysis, not a signed or certified appraisal unless a qualified appraiser reviews, signs, and assumes responsibility.

## Variable by case

The report profile changes with:

- assignment purpose and review tier;
- property type and subtype;
- jurisdiction, assessment year, and effective date;
- evidence inventory and release-ready valuation methods;
- recent subject transfers;
- vacancy, distress, renovation, or deferred maintenance;
- regulatory or code issues;
- multifamily unit evidence; and
- industrial loading, door, clear-height, and office/warehouse utility.

Unsupported sections are omitted rather than filled with placeholders.

## Canonical sequence

1. Cover
2. Transmittal
3. Contents and evidence inventory
4. Salient facts and structured property facts
5. Executive valuation summary
6. Maps and complete subject-photo exhibit
7. Assignment and scope
8. Property history, assessment, subject, site, improvement, and condition analysis
9. Area, market, and highest-and-best-use analysis when applicable
10. Appeal position for tax appeals
11. Sales methodology, grid, and individual source profiles
12. Income and cost methodology plus reproducible calculations when release-ready
13. Assessment-equity analysis for tax appeals
14. Reconciliation and final conclusion
15. Filing, negotiation, pricing, or valuation-use guide
16. Hearing preparation when included
17. Certification boundary and limiting conditions

## Valuation method rules

### Sales comparison

Reviewed reports require source-backed transaction evidence. Each comparable profile discloses available deed or recorder evidence, sale condition, distress flag, physical attributes, distance, adjustments, and indication. A blank adjustment is not proof of zero adjustment.

### Income capitalization

Use only for an income-producing property with supported rent evidence, reproducible income and expenses, positive NOI, a valid decimal capitalization rate, an independent rate source, and a stored value that reconciles to NOI divided by the rate. Ordinary pro forma vacancy language must not classify the subject as physically vacant or distressed.

### Cost approach

Use only when replacement cost, depreciation, land value, and obsolescence are supported and reconcile. Jurisdiction-specific limitations must not be generalized nationwide.

### Reconciliation

The conclusion identifies only the methods actually developed, their evidence quality, contrary evidence, sensitivity, and assigned weight. Omitted methods do not support the conclusion.

## Case strategy rules

- **Recent subject sale:** analyze arm's-length status, financing, motivation, condition, renovation, market change, and relevance as of the effective date.
- **Distressed or vacant:** distinguish as-is from stabilized assumptions; disclose lease-up, renovation, cost-to-cure, marketability, and comparable adjustments.
- **Multifamily:** do not present verified price-per-unit metrics without source-labeled unit count and unit mix.
- **Industrial or flex:** require positive building area and review office/warehouse mix, clear height, loading, doors, parking, land-to-building ratio, zoning, and utility.
- **Regulatory issue:** identify the official source and separate zoning legality, code compliance, cure status, marketability, income, condition, and value effects.
- **Retrospective date:** analyze market, condition, regulations, tenancy, income, and expenses as of the valuation date, not the report date.

## Tax appeal rules

Every tax-appeal report identifies the assessment year, valuation date, property classification, raw assessed value, applied assessment level, jurisdiction reference level, assessor-implied market value when supportable, filing authority, deadline or deadline rule, channel, required evidence, and appeal theory.

A market-value gap or assessed-value gap is not a tax-dollar savings estimate.

## Cook County rules

Cook County is handled as a jurisdiction plugin, not a nationwide default. The workfile must:

- use the exact assessment year and valuation-date convention;
- use the verified class assessment level;
- document special classifications or incentives;
- keep the statutory assessment level separate from the annual state equalization multiplier; and
- source any multiplier for the exact assessment year rather than recycling another year's factor.

## Nationwide jurisdiction rules

Release requires an active, recently verified county package with matching FIPS and state, assessment methodology, property-type levels, valuation-date convention, filing authority, current deadline logic, filing channel, and required documents. Unsupported, stale, contradictory, or incomplete jurisdictions route to manual review.

## Canonical fixture matrix

- standard residential appeal;
- Cook County residential appeal;
- Cook County industrial or flex appeal;
- distressed vacant commercial appeal;
- multifamily tax appeal;
- multifamily retrospective estate valuation;
- pre-purchase analysis;
- pre-listing analysis;
- unsupported or stale jurisdiction hard failure; and
- incomplete income evidence with income pages omitted.

Each fixture requires structural PDF checks, page rasterization, visual review, and an approved baseline before production activation.

## Release contract

A report cannot be released unless assignment identity is consistent, profile narratives exist, strategy requirements pass, tax year and assessment context reconcile, jurisdiction data is current, at least one method supports the conclusion, reviewed sales have provenance, calculations reconcile, the contents match actual sections, no invented placeholders appear, the legal boundary is present, and the immutable PDF/manifest pair passes delivery verification.

`src/lib/pdf/index.ts` and the React-PDF tree are the sole authoritative final-report renderer. Production code must not invoke the dormant legacy `generateReportHtml` path.
