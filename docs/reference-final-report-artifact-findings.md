# Reference Final-Report Artifact Findings

Status: normative second-pass QA reference for Resourceful report design, case strategy, and release controls

## 1. Review scope and privacy boundary

The supplied corpus contains ten PDF files representing nine unique final-report artifacts. One Schaumburg flex report is an exact duplicate and must be treated as the same immutable artifact rather than a second case. The unique reports range from 58 to 85 pages and cover:

- small multifamily tax-appeal work;
- retrospective estate/date-of-death multifamily work;
- occupied, partially vacant, and fully vacant neighborhood retail;
- office property;
- industrial property;
- flex office/industrial property;
- code-affected and deferred-maintenance scenarios; and
- multi-parcel or mixed commercial configurations.

This document records workflow and QA lessons only. Source-firm branding, client names, contact information, parcel identifiers, signatures, license numbers, and report prose are not reusable Resourceful content.

## 2. Artifact-by-artifact findings

| Artifact profile | Length | Method strategy | Strong baseline behavior | Defect or risk Resourceful must prevent |
| --- | ---: | --- | --- | --- |
| Arlington Heights six-unit retail; 50% vacant | 58 pages | Sales and income | Clear front-end synopsis, subject photographs, sales grid, rent evidence, direct capitalization, reconciliation | Market section is labeled for a different suburb. The income model applies stabilized vacancy without an explicit lease-up, downtime, tenant-improvement, leasing-commission, carrying-cost, or present-value bridge to the as-is conclusion. |
| Schaumburg multi-unit flex | 74 pages | Sales and income | Strong industrial/flex utility inventory: office mix, clear height, docks, drive-ins, site ratio, and tenancy | Table of contents and local analysis retain another municipality. The market section emphasizes retail and office rather than the subject's industrial/flex market. Inspection dates conflict between executive sections. |
| Chicago two-unit retrospective estate assignment | 75 pages | Sales and income | Intended use, retrospective effective date, code-violation discussion, unit economics, and two-method reconciliation | A later quarterly market period is not clearly separated as hindsight context. Commercial zoning and residential use require explicit conforming, legal-nonconforming, variance, special-use, or other legal-status evidence. |
| Elmwood Park three-unit tax appeal | 63 pages | Sales and income | Compact salient-facts summary, unit-level metrics, comparable grid, direct capitalization, and appeal-focused conclusion | A reconciliation date conflicts with the cover's effective date. This is a release-blocking contradiction, not a cosmetic typo. |
| Chicago fully vacant neighborhood commercial property in disrepair | 66 pages | Sales and income | The report recognizes vacancy, physical impairment, market rent, expenses, and cap-rate evidence | The income analysis uses a stabilized vacancy assumption without a reproducible as-is bridge. A one-year-offset market report also needs an explicit relevance and vintage explanation. |
| Morton Grove office property | 67 pages | Sales and income | Site, office utility, sales, rent, expenses, and cap-rate support are all present | Zoning and area sections retain a different municipality. The market section is labeled retail rather than office. Site acreage conflicts with the square-foot area. Exact convergence of independently derived approaches deserves a reviewer diagnostic. |
| Chicago two-unit retrospective estate assignment with deferred maintenance | 78 pages | Sales and income | Deferred-maintenance observations, unit economics, separate approach indications, and balanced reconciliation | Later-quarter market evidence is not clearly separated. Single-unit zoning and existing two-unit use require legal-status support. The table of contents contains unnamed or blank addendum entries. |
| Chicago two-unit retrospective estate assignment with one vacant unit | 64 pages | Sales and income | Concise subject summary, occupancy disclosure, unit metrics, and separate approach indications | The stabilized vacancy assumption does not explain the as-is treatment of one vacant unit. Later-quarter market evidence and single-unit zoning require the same retrospective and legal-status controls described above. |
| Palatine owner-occupied industrial property | 85 pages | Sales and income | The strongest operational baseline in the corpus: extensive subject exhibits, industrial utility attributes, sales profiles, rent and cap-rate support, and a two-person certification workflow | Document identity shifts between “appraisal report” and “valuation consulting report.” Visual structure differs materially from the rest of the corpus. Loaded capitalization must clearly separate market cap rate, effective tax load, and any other components. |
| Duplicate Schaumburg flex file | duplicate | n/a | Demonstrates a real ingestion edge case | Filename is not identity. SHA-256 and immutable manifests must detect duplicate artifacts and preserve one release lineage. |

## 3. What the corpus establishes as the quality floor

Every final Resourceful report should preserve the following evidence sequence when applicable:

1. restrained branded cover with one dominant subject image, assignment-accurate document title, effective date, and report date;
2. transmittal or executive letter with intended use, intended user, property rights, inspection disclosure, prior-services disclosure, subject synopsis, and conclusion;
3. deterministic table of contents generated from the actual render plan;
4. summary of salient facts and all approach indications;
5. assignment conditions, scope of work, assumptions, exclusions, and technology responsibility;
6. subject identity, property history, assessment/classification, zoning, flood, site, improvements, occupancy, condition, and regulatory evidence;
7. regional, municipal, neighborhood, and property-type market analysis with explicit geography and data vintage;
8. highest and best use as vacant and as improved when the assignment requires it;
9. each applicable valuation method with source inventory, calculations, adjustment logic, weaknesses, excluded evidence, and indicated value;
10. reconciliation that explains weight rather than averaging conclusions;
11. complete maps, photographs, comparable profiles, deed/recorder support, rent and cap-rate support, and regulatory exhibits; and
12. one consistent certification boundary and signatory identity appropriate to the assignment and review tier.

## 4. Evidence-driven length standard

Page count is an output of case complexity, not a target to pad. Resourceful should use these operating ranges as diagnostics, not hard limits:

- standard residential case analysis: approximately 20–35 pages;
- reviewed residential or small multifamily: approximately 35–60 pages;
- complex commercial, industrial, flex, distressed, or retrospective work: approximately 50–85 pages;
- larger source appendices may extend beyond these ranges without making the analytical core longer.

A short report is unacceptable when required evidence is missing. A long report is also unacceptable when length comes from blank divider pages, repeated boilerplate, oversized whitespace, duplicate maps, stale market summaries, or generic prose.

## 5. Method strategy by scenario

### 5.1 Sales comparison

Require source-backed sales, correct unit denominators, arms-length screening, transaction-rights and financing review, conditions-of-sale review, time, location, size, condition, site ratio, utility, and other relevant adjustments. Net and gross adjustment diagnostics must be visible. Reconciliation must favor the most comparable and best-supported evidence rather than a mechanical mean.

### 5.2 Income capitalization

Require rent evidence, potential gross income, vacancy and collection loss, effective gross income, operating expenses, reserves, net operating income, independently sourced capitalization evidence, deterministic arithmetic, and reconciliation to the final conclusion.

When actual vacancy or impairment materially exceeds stabilized market assumptions, the report must show both:

- a stabilized indication; and
- a reproducible as-is bridge covering the applicable lease-up period, downtime, lost rent, tenant improvements, leasing commissions, carrying costs, deferred maintenance, cost-to-cure, and present-value treatment.

The as-is conclusion may not silently inherit a stabilized assumption.

### 5.3 Cost approach

The corpus often omits cost based on local or assignment-specific reasoning. Resourceful must not copy that omission nationwide. A released cost method requires current replacement-cost evidence, quantity and quality basis, physical depreciation, functional and external obsolescence, land value, effective-date support, deterministic recomputation, and qualified review when represented as appraisal work.

### 5.4 Retrospective assignments

Require an explicit effective date and source, evidence screened to that date, later information separately labeled as hindsight context, inspection-date disclosure, and a condition bridge from the later inspection to the effective-date condition. Dated photographs, repair records, leases, code records, owner interviews, prior listings, and other historical evidence must be identified by source and reliability.

## 6. Visual and branding standard

The source reports are structurally professional but visually dated. Resourceful should preserve seriousness while improving legibility and evidence navigation:

- one modern navy-and-gold Resourceful system across every assignment;
- clear distinction between automated analysis, expert-reviewed work, and a signed appraisal;
- larger minimum type sizes and accessible contrast;
- compact tables that remain readable at 100% zoom;
- repeated table headers and controlled row splitting;
- one evidence card/profile per comparable with source and verification status;
- fewer blank section-divider pages;
- no fully justified rivers of text;
- no raw URLs or Markdown artifacts in body prose;
- consistent map/photo aspect ratios and captions;
- source authority, evidence category, retrieval date, effective date, and license/public-record label beneath every third-party exhibit;
- effective date, report date, and assignment identity repeated in executive and reconciliation sections; and
- deterministic pagination with no orphaned headings, blank addenda, or contradictory table-of-contents entries.

## 7. Corpus-derived release controls

The following findings are now mandatory preflight concerns:

- foreign municipality or county leakage;
- market-geography mismatch requiring explicit reviewer confirmation;
- property-type market mismatch;
- stale, later, or partially post-effective-date market periods;
- conflicting inspection dates;
- missing retrospective condition reconciliation;
- high actual vacancy paired with a materially lower stabilized vacancy assumption and no as-is bridge;
- zoning/highest-and-best-use contradiction;
- unsupported flood conclusion;
- contradictory appraisal/consulting document identity;
- unauthorized appraisal credential language;
- final-value or effective-date contradiction;
- unsupported income or cost arithmetic; and
- duplicate artifact ingestion.

Hard failures prevent immutable publication. Warnings remain visible in the workfile and require an explicit reviewer disposition before release where the review tier calls for professional acceptance.

## 8. User-flow implications

Resourceful intake and review surfaces should collect only facts that are used downstream. Every customer answer must appear in the workfile, influence an evidence checklist, or be removed from the flow. Case-specific follow-up should be progressive:

- multifamily: unit count, unit mix, occupancy, rent roll, lease dates, utilities, and legal status;
- commercial/office/retail: occupied area, tenant roster, lease structure, vacancy, asking rent, concessions, and lease-up facts;
- industrial/flex: clear height, docks, drive-ins, office ratio, yard/loading utility, and owner occupancy;
- distressed property: dates, scope, estimates, permits, code notices, and before/after evidence;
- retrospective work: effective-date source, inspection timing, historical condition evidence, and later-event disclosure.

The customer experience should show why each request matters, label optional versus release-critical evidence, save progress continuously, and present a final evidence-readiness review before payment or professional acceptance.

## 9. Definition of done for this report tranche

A report tranche is not complete until:

- the report profile and section plan match the assignment;
- all displayed facts trace to structured or source-labeled evidence;
- every calculation recomputes;
- dates, values, locality, property type, and document identity agree globally;
- as-is and stabilized premises are not conflated;
- retrospective evidence is temporally disciplined;
- review and signatory boundaries are accurate;
- the PDF passes rasterized visual QA at page, table, map, and photo level;
- the immutable PDF and manifest publish atomically; and
- the delivered artifact is the exact artifact approved by the reviewer.
