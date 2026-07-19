# Resourceful Reference Final-Report Corpus Audit

Status: normative product and QA reference for the Resourceful final-report system

## 1. Corpus reviewed

The audit covers ten supplied final-report files representing nine unique report artifacts. One industrial/flex report was supplied twice and was byte-identical. The unique reports range from 58 to 85 pages and cover:

- small multifamily properties;
- estate/date-of-death multifamily assignments;
- neighborhood multi-tenant commercial property;
- office property;
- industrial property;
- flex office/industrial property;
- vacant or distressed income-producing property.
- mixed-use or multi-parcel commercial assignments.

The source documents are treated as professional workflow references, not as reusable templates. Client names, contact details, parcel identifiers, signatures, license numbers, and report prose must not be copied into Resourceful fixtures or documentation.

The corpus sets a high professional baseline for length, evidence density, and appraisal-style organization. It also demonstrates why Resourceful needs deterministic release controls: copied municipality or zoning-authority references, retrospective-date market-vintage issues, and stale local language can appear even in otherwise serious reports.

## 2. Report architecture worth preserving

Across the corpus, the strongest recurring sequence is:

1. branded cover with subject image, property identity, effective date, and report date;
2. transmittal letter with intended use, property-rights interest, subject synopsis, inspection disclosure, prior-services disclosure, and value conclusion;
3. table of contents derived from the actual report;
4. summary of salient facts and approach indications;
5. assignment, intended use/user, scope of work, assumptions, conditions, and exclusions;
6. subject-property identification, history, assessment, zoning, site, improvements, and condition;
7. regional, municipal, neighborhood, and property-type market analysis;
8. highest and best use as vacant and as improved;
9. applicable valuation approaches, each with methodology, source evidence, calculations, adjustment logic, and reliability discussion;
10. reconciliation and final value conclusion;
11. source exhibits, maps, photographs, comparable profiles, and supporting records;
12. certification boundary, limiting conditions, reviewer/signatory information, and qualifications where applicable.

Resourceful should preserve this professional information architecture while improving determinism, source attribution, internal consistency, accessibility, and jurisdiction portability.

## 3. Resourceful translation rules

### 3.1 One report family, case-specific composition

Resourceful must use one branded design and renderer, but the section plan must be generated from:

- assignment kind;
- intended use and intended user;
- property type and subtype;
- property rights analyzed;
- jurisdiction rule package;
- evidence inventory;
- applicable valuation approaches;
- review tier;
- condition, vacancy, regulatory, and retrospective-assignment flags.

A nationwide product must not solve regional variation by cloning county-specific templates. Local behavior belongs in versioned jurisdiction data and policy plugins.

### 3.2 Deterministic facts and calculations

The following must come from structured workfile fields and deterministic calculations, never free-form model invention:

- subject identity and location;
- parcel identifier and jurisdiction;
- effective date and report date;
- property rights and assignment type;
- land, building, living, rentable, and unit-area denominators;
- unit count and unit mix;
- comparable sale and rental facts;
- adjustment arithmetic;
- income statement arithmetic;
- capitalization arithmetic;
- cost arithmetic;
- assessment level, equalization factor, tax rate, and effective tax rate;
- approach indications and final conclusion;
- source authority, retrieval date, document identifier, and URL where available.

AI may draft explanatory prose from an approved structured payload. It may not create the payload, alter calculations, infer legal status, invent source authority, or silently reconcile contradictions.

### 3.3 Evidence order within every approach

Each applicable approach should follow the same evidence discipline:

1. applicability and methodology;
2. source inventory and data vintage;
3. calculation or adjustment exhibit;
4. reliability, weaknesses, and excluded evidence;
5. one source-rich profile for each comparable or input;
6. indicated value;
7. reconciliation weight.

This is stronger than placing a narrative several pages away from the calculation it describes.

## 4. Property-type strategy matrix

### Multifamily

Require, when applicable:

- verified unit count and source;
- unit mix, beds/baths, occupancy, and vacancy;
- gross and rentable area with explicit denominator labels;
- price per unit and price per square foot;
- market-rent evidence by unit type;
- stabilized vacancy and collection loss;
- operating-expense treatment;
- sales and income approaches where evidence supports both;
- legal-conforming or legal-nonconforming analysis when zoning and use differ.

### Industrial and flex

Require, when applicable:

- gross building area and site area;
- land-to-building ratio;
- office/warehouse or studio mix;
- clear height;
- dock and drive-in door counts;
- loading and circulation utility;
- parking and yard utility;
- occupancy, tenancy, and lease structure;
- price/rent per square foot using the correct area denominator;
- functional-obsolescence analysis for super-adequacy or obsolete utility.

### Office and neighborhood commercial

Require, when applicable:

- gross, net rentable, and occupied area distinctions;
- tenant roster and lease structure;
- vacancy and lease-up assumptions;
- market rent and expense evidence;
- location, access, visibility, parking, and frontage;
- capitalization-rate source and vintage;
- as-is versus stabilized value when the property is vacant or impaired.

### Distressed, vacant, or code-affected property

Require, when applicable:

- explicit as-is premise;
- condition and vacancy evidence;
- cost-to-cure or lease-up evidence when used;
- code, zoning, or regulatory claims tied to an official authority and URL;
- reduced reliance on distressed comparables unless their relevance is explained;
- separate stabilized analysis rather than embedding stabilization assumptions in the as-is conclusion.

### Estate and other retrospective assignments

Require:

- explicit retrospective assignment flag;
- verified effective date and source;
- market evidence screened to the effective date;
- separation of later hindsight evidence from effective-date evidence;
- property history and ownership context;
- complete signed package and source-exhibit retention requirements;
- intended-use language appropriate to the actual filing or decision.

## 5. Valuation-method controls

### Sales comparison

The corpus demonstrates that a credible sales approach needs more than a comp grid. Resourceful should require:

- property-rights, financing, conditions-of-sale, market-time, location, size, condition, utility, land ratio, and other applicable adjustments;
- explicit quantitative or qualitative adjustment support;
- net and gross adjustment diagnostics;
- arms-length and distress screening;
- deed/recorder evidence for reviewed reports;
- correct denominator labels such as total price, price per square foot, and price per unit;
- explanation of excluded or weak sales;
- reconciliation based on comparability and evidence quality, not a blind average.

### Income capitalization

Require:

- rent comparables or another documented rent source;
- potential gross income;
- vacancy and collection loss;
- effective gross income;
- operating expenses and reserves;
- net operating income;
- independently sourced capitalization-rate evidence;
- direct-capitalization calculation;
- as-is lease-up or vacancy treatment where relevant;
- reproducibility checks between stored and recomputed values.

### Cost approach

The source reports frequently omit the cost approach based on assignment-specific or local legal relevance. Resourceful must not generalize an Illinois-specific evidentiary preference nationwide.

A released cost approach must have:

- replacement-cost source and vintage;
- quantity/area basis;
- quality/class basis;
- physical depreciation source and method;
- functional and external obsolescence analysis;
- land-value source and effective date;
- deterministic recomputation;
- jurisdiction- and assignment-specific applicability explanation;
- qualified human review where the output is represented as appraisal work.

### Highest and best use

For complex property, the analysis must separately apply:

1. legal permissibility;
2. physical possibility;
3. financial feasibility;
4. maximum productivity.

The as-vacant and as-improved conclusions must reconcile with zoning, legal-nonconforming status, site utility, market demand, and the valuation approaches actually used.

## 6. Nationwide jurisdiction model

Resourceful must distinguish and source each of the following independently:

- assessment level or class ratio;
- equalization multiplier or factor;
- assessed value;
- taxable value;
- statutory tax rate;
- effective tax rate;
- valuation-date convention;
- assessment cycle;
- filing authority;
- deadline rule;
- hearing and representation rules;
- further-appeal route;
- terminology used by the state or local authority.

Cook County classification logic is a versioned plugin, not a default nationwide assumption. Other states may use counties, parishes, boroughs, municipalities, townships, appraisal districts, or state agencies. UI and report language should be generated from the verified jurisdiction package.

## 7. Branding and visual standard

The corpus supports the following professional design requirements:

- restrained cover with one dominant subject image;
- strong Resourceful identity without overwhelming the evidence;
- consistent running header/footer and page numbering;
- section-divider pages for long reports;
- compact tables with repeated headers and controlled row splitting;
- stable hierarchy for titles, labels, notes, and source lines;
- explicit exhibit identifiers;
- captions beneath every map and photo;
- source authority, evidence category, retrieval date, and license/public-record label for maps and third-party imagery;
- generous margins and no orphaned headings;
- deterministic table of contents;
- no Markdown artifacts, raw URLs in body prose, or uncontrolled AI formatting;
- accessible contrast and readable minimum type sizes.

The target is a modern evidentiary report, not a visual imitation of the source firm's typography.

## 8. Negative fixtures extracted from the corpus

The reference corpus is valuable because it contains realistic production defects. Resourceful must encode these as hard-failure or warning fixtures rather than reproduce them.

### Municipality template leak

A subject report can contain a table-of-contents or area-analysis reference to a different municipality. Any foreign municipality or county in a jurisdiction-specific section must fail release unless it is clearly identified as comparative context.

### Effective-date contradiction

A reconciliation heading can retain a different valuation date from the cover and transmittal. Labeled valuation/effective dates in executive and reconciliation sections must equal the structured workfile date.

### Final-value contradiction

A reconciliation paragraph can state a value that differs from the transmittal, summary table, and conclusion exhibit. Labeled final-value prose must equal the structured conclusion exactly.

### Local doctrine copied nationwide

A local court or assessment practice can be presented as a universal reason to omit an approach. Every legal or procedural statement must be scoped to a verified jurisdiction and effective date.

### Stale or post-effective-date market evidence

Market summaries may be copied from an earlier assignment or may post-date a retrospective effective date. Resourceful must expose the data vintage, compare it with the effective date, and identify hindsight evidence.

### Duplicate artifact

The identical flex report was supplied twice. Resourceful should identify immutable artifacts by SHA-256, avoid duplicate ingestion, and preserve a release manifest rather than treating filenames as identity.

## 9. Mandatory release gates

A report must not publish when any of the following applies:

- the effective date or its source is missing;
- labeled final value or effective date conflicts with structured data;
- jurisdiction, municipality, or county text leaks from another template;
- the county/state rule package is missing, stale, or mismatched for a tax appeal;
- assessment level and property classification are unsupported;
- reviewed comparable sales lack recorder/deed provenance;
- required property-type fields or narratives are missing;
- income or cost calculations are not reproducible;
- zoning and highest-and-best-use conclusions contradict each other;
- a definitive flood assertion lacks official evidence;
- regulated appraisal identity or credentials are used without an authorized signing professional;
- a retrospective or estate package lacks effective-date market analysis and certification boundaries;
- the PDF and manifest cannot be published atomically as immutable artifacts.

Warnings should remain visible for weaker but potentially releasable conditions such as fewer than three sales, one-year-offset market data with explanation, limited photo coverage, or distressed comparable reliance.

## 10. Regression fixture matrix

At minimum, automated fixtures should cover:

- small residential tax appeal outside Illinois;
- Cook County residential class assessment appeal;
- multifamily sales-and-income report;
- estate/date-of-death multifamily report;
- office report with vacancy;
- industrial report with loading and clear-height attributes;
- flex property with mixed office/industrial use;
- vacant neighborhood commercial property;
- cost-only report with complete provenance;
- no-sales report with complete income evidence;
- foreign municipality and county leakage;
- stale and post-effective-date market vintage;
- zoning/highest-and-best-use contradiction;
- unsourced flood assertion;
- unsupported appraisal identity;
- final-value contradiction;
- effective-date contradiction;
- duplicate artifact ingestion.

## 11. Current implementation mapping

The case-engine branch implements this standard through:

- `src/lib/pdf/report-profile.ts` for case-specific section planning;
- `src/lib/pdf/report-render-plan.ts` for deterministic composition and table of contents;
- `src/lib/valuation/nationwide-report-integrity-policy.ts` for locality, market-vintage, zoning, flood, identity, estate, and technology checks;
- `src/lib/valuation/report-conclusion-integrity-policy.ts` for final-value and effective-date contradictions;
- `src/lib/valuation/pdf-release-policy.ts` for evidence-backed approach release;
- `src/lib/valuation/assessment-context-policy.ts` and jurisdiction rule data for nationwide assessment controls;
- `src/lib/valuation/workfile-provenance.ts` for effective-date, unit-count, regulatory, classification, and jurisdiction-plugin provenance;
- `src/lib/pipeline/stages/stage7-pdf-assembly.ts` for fail-closed preflight and immutable publication;
- `src/lib/pdf/report-artifact-manifest.ts` for artifact, model, evidence, jurisdiction, and strategy provenance.

The supplied corpus should remain an external QA reference. It must not be committed to the repository or used as a source of reusable client data.
