# Resourceful Final Report Case Standard

## Operating model

Resourceful uses one branded report family whose analytical scope changes with the assignment and evidence. The authoritative path is:

`evidence -> normalized workfile -> deterministic policies -> nationwide integrity preflight -> case profile -> React-PDF renderer -> release preflight -> immutable manifest -> delivery verification`

AI may draft source-grounded prose. It does not control calculations, method applicability, jurisdiction rules, section hierarchy, layout, legal labeling, professional credentials, or release decisions.

## Fixed in every report

Every report uses the same Resourceful typography, spacing, colors, headings, tables, footers, numerical formats, source rules, limitation language, and immutable artifact flow. The default document identity is an AI-assisted property valuation analysis, not a signed or certified appraisal unless a qualified appraiser accepts the assignment, independently verifies the work, holds the required active state credential, signs the report, and assumes professional responsibility.

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
11. Sales methodology, grid, adjustment and reliability analysis, and individual source profiles
12. Income and cost methodology plus reproducible calculations when release-ready
13. Assessment-equity analysis for tax appeals
14. Reconciliation and final conclusion
15. Filing, negotiation, pricing, or valuation-use guide
16. Hearing preparation when included
17. Certification boundary and limiting conditions

## Valuation method rules

### Sales comparison

Reviewed reports require source-backed transaction evidence. Each comparable profile discloses available deed or recorder evidence, sale condition, distress flag, physical attributes, distance, adjustments, and indication. A blank adjustment is not proof of zero adjustment. The report sequence is methodology, comparison grid, adjustment and reliability analysis, then individual comparable profiles.

### Income capitalization

Use only for an income-producing property with supported rent evidence, reproducible income and expenses, positive NOI, a valid decimal capitalization rate, an independent rate source, and a stored value that reconciles to NOI divided by the rate. Ordinary pro forma vacancy language must not classify the subject as physically vacant or distressed.

### Cost approach

Use only when replacement cost, physical depreciation, explicitly recorded functional obsolescence including zero when none, land value, and the concluded indication are supported and reconcile. Jurisdiction-specific limitations must not be generalized nationwide.

### Reconciliation

The conclusion identifies only the methods actually developed, their evidence quality, contrary evidence, sensitivity, and assigned weight. Omitted methods do not support the conclusion.

## Case strategy rules

- **Recent subject sale:** analyze arm's-length status, financing, motivation, condition, renovation, market change, and relevance as of the effective date.
- **Distressed or vacant:** distinguish as-is from stabilized assumptions; disclose lease-up, renovation, cost-to-cure, marketability, and comparable adjustments.
- **Multifamily:** do not present verified price-per-unit metrics without source-labeled unit count and unit mix.
- **Industrial or flex:** require positive building area and review office/warehouse mix, clear height, loading, doors, parking, land-to-building ratio, zoning, and utility.
- **Regulatory issue:** identify the official source and separate zoning legality, code compliance, cure status, marketability, income, condition, and value effects.
- **Retrospective date:** analyze market, condition, regulations, tenancy, income, and expenses as of the valuation date, not the report date. Later evidence must be identified as hindsight and its relevance explained.
- **Estate or date-of-death assignment:** identify the intended tax or planning use, preserve the retrospective effective date and source, include property history and effective-date market support, retain the complete signed report and exhibits, and route any appraisal identity through a credentialed professional.

## Source and evidence registry

Every material source record must preserve:

- source authority and publication or dataset name;
- geography and property type covered;
- reporting period, publication date, retrieval date, and valuation-date relevance;
- URL, document number, panel number, or durable reference when available;
- whether the source is official, licensed, owner-supplied, calculated, assumed, or professional judgment; and
- any coverage limitation, missing response, conflict, or manual verification requirement.

A missing source response is not evidence of absence. Empty, unavailable, or non-digitized records must remain unknown and route to manual review when the report would otherwise make a definitive assertion.

## Nationwide content-integrity rules

Before rendering, Resourceful performs a report-wide consistency pass:

- subject city, county or equivalent, state, address, parcel identifier, zoning authority, and filing authority must agree across the workfile, narratives, tables, maps, and contents;
- copy-forward references to another municipality, county, market, zoning district, or property are release-blocking, including subject, site, improvement, condition, zoning, and highest-and-best-use sections;
- market analysis must expose a machine-checkable data vintage reasonably proximate to the effective date;
- post-effective-date evidence must be identified and separated from evidence known as of the effective date; retrospective assignments block release when later evidence is used without a hindsight explanation and reviewer approval;
- zoning and highest-and-best-use conclusions must reconcile, including legal-nonconforming, variance, special-use, planned-development, or rezoning support when applicable;
- personal-property exclusions belong in property-rights or exclusions analysis, not under extraordinary assumptions unless an actual uncertain assignment-specific fact exists;
- definitive flood-hazard statements require official FEMA evidence or a stored map-panel reference; absent digital coverage is not equivalent to no flood risk; and
- automated reports may not claim appraisal, certified-appraisal, or licensed-appraiser identity.

## Technology and professional responsibility

Technology-assisted drafting, statistical analysis, automated valuation, computer vision, and generative AI do not transfer responsibility away from the signing professional. In an expert-reviewed or represented assignment, the reviewer must independently verify material inputs, methods, calculations, conclusions, disclosures, and final language. Any appraisal credential language triggers state-specific credential verification before release.

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

Release requires an active, recently verified county or equivalent local-jurisdiction package with matching FIPS and state, assessment methodology, property-type levels, valuation-date convention, filing authority, current deadline logic, filing channel, and required documents. Unsupported, stale, contradictory, or incomplete jurisdictions route to manual review. Parish, borough, census-area, municipality, township, city, and other state-specific administrative models must be represented explicitly rather than coerced into Cook County terminology.

## PDF usability and accessibility

Every canonical fixture must be checked for:

- deterministic section order and contents accuracy;
- no orphan headings, clipped tables, tiny unreadable text, image distortion, blank pages, or duplicated legal sections;
- bookmarks or document outline when supported by the renderer;
- selectable text, meaningful link annotations, stable page numbering, and usable print margins;
- descriptive captions and provenance labels for maps and photographs; and
- visual review at desktop, tablet, and print-equivalent sizes.

## Canonical fixture matrix

- standard residential appeal;
- Cook County residential appeal;
- Cook County industrial or flex appeal;
- non-Illinois tax appeal using a verified jurisdiction plugin;
- parish or borough jurisdiction normalization;
- distressed vacant commercial appeal;
- multifamily tax appeal;
- multifamily retrospective estate valuation;
- pre-purchase analysis;
- pre-listing analysis;
- unsupported or stale jurisdiction hard failure;
- copied municipality or county hard failure;
- stale market-vintage hard failure;
- zoning and highest-and-best-use contradiction hard failure;
- definitive flood assertion with missing FEMA evidence hard failure;
- automated appraisal-identity hard failure;
- incomplete estate package hard failure; and
- incomplete income evidence with income pages omitted.

Each fixture requires structural PDF checks, page rasterization, visual review, and an approved baseline before production activation.

## Release contract

A report cannot be released unless assignment identity is consistent, profile narratives exist, strategy requirements pass, nationwide integrity checks pass, tax year and assessment context reconcile, jurisdiction data is current, at least one method supports the conclusion, reviewed sales have provenance, calculations reconcile, market evidence is date-relevant, zoning and highest-and-best-use are internally consistent, definitive environmental or regulatory assertions have official support, the contents match actual sections, no invented placeholders or copied localities appear, the legal boundary is present, and the immutable PDF/manifest pair passes delivery verification.

`src/lib/pdf/index.ts` and the React-PDF tree are the sole authoritative final-report renderer. Production code must not invoke the dormant legacy `generateReportHtml` path.
