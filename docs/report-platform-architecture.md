# Resourceful Report Platform Architecture

**Status:** Required target architecture  
**Scope:** Customer-facing valuation reports, property-tax appeal reports, executive presentations, and supporting workfiles  
**Primary objective:** Produce evidence-backed, reproducible, professionally designed artifacts whose structure, calculations, branding, and jurisdictional claims are controlled by software rather than free-form model output.

## 1. Product principle

Resourceful is not a Markdown-to-PDF generator. It is a controlled publishing system for property evidence and valuation analysis.

The required production path is:

```text
Source evidence
  -> normalized workfile
  -> deterministic valuation policies
  -> canonical report model
  -> report-family composition
  -> branded component renderer
  -> content and jurisdiction preflight
  -> PDF rendering
  -> structural and visual QA
  -> artifact manifest and hash
  -> human review when required
  -> delivery or filing
```

AI may interpret and explain evidence. AI may not own authoritative arithmetic, jurisdiction routing, report hierarchy, table geometry, brand styling, certification status, or release approval.

## 2. Architectural boundaries

### 2.1 Evidence layer

Every consequential fact should eventually be represented with provenance:

- value
- unit
- source type and source name
- source URL or document identifier where available
- retrieval date
- effective or valuation date
- confidence
- verification status
- reviewer identity where manually confirmed

Examples include parcel identifiers, ownership, area, unit count, year built, zoning, assessments, sales, rents, vacancy, expenses, capitalization rates, tax-load inputs, maps, and photographs.

No consequential number should be promoted to a final report without a known provenance state.

### 2.2 Valuation layer

Deterministic code owns:

- unit conversions
- price per square foot
- price per unit
- rent normalization
- vacancy and expense calculations
- effective gross income
- net operating income
- capitalization
- tax loading
- comparable adjustments
- medians and reconciliations
- assessment ratios
- rounding
- cross-section numerical consistency

Model output may explain these calculations but may not replace them.

### 2.3 Narrative layer

Model-generated narrative is semantic content only.

Allowed:

- prose paragraphs
- concise bullet or numbered lists
- evidence-grounded explanations
- caveats
- reconciliation reasoning

Blocked from final delivery:

- model-authored section headings
- model-authored Markdown tables
- HTML or CSS
- fenced code
- arbitrary page-break instructions
- raw URLs used as layout
- certifications or professional credentials not present in structured data

The renderer owns section titles, hierarchy, tables, callouts, captions, page breaks, headers, footers, and visual emphasis.

### 2.4 Composition layer

The canonical report model must compose one of several report families while preserving a shared Resourceful shell.

Required families:

1. single-family residential
2. condominium or cooperative
3. two-to-four-unit residential
4. multifamily
5. office
6. retail
7. industrial or warehouse
8. mixed-use
9. land
10. agricultural

Each family defines:

- applicable valuation approaches
- accepted units of comparison
- required subject facts
- required comparable attributes
- required income fields
- required visual exhibits
- jurisdiction-specific disclosure slots
- mandatory and optional sections

A report family may omit an unsupported approach, but it must never relabel an area-based calculation as a unit-based calculation or present incomplete evidence as complete.

## 3. National and jurisdiction architecture

### 3.1 National core

The national core contains stable appraisal and report concepts:

- property taxonomy
- evidence schema
- valuation approach contracts
- units of comparison
- report components
- quality gates
- artifact manifest

### 3.2 Jurisdiction packages

Tax-appeal behavior is controlled by versioned state and county or assessment-jurisdiction packages.

Each package should define, where applicable:

- county FIPS and state
- active or inactive status
- verification date and verifier
- valuation date convention
- assessment cycle
- assessment ratios and classifications
- equalization rules
- appeal body
- appeal window and deadline rule
- filing methods
- forms and fees
- evidence requirements
- hearing process
- representation and authorization rules
- further appeal process
- source citations

Coverage status must be explicit:

- `verified`: active, matched, and verified within policy age
- `stale`: previously supported but overdue for reverification
- `partial`: some guidance exists but full delivery or filing is not supported
- `unsupported`: Resourceful must not claim jurisdiction-ready appeal support
- `not_applicable`: non-appeal report

A tax-appeal report must not pass final preflight when its jurisdiction package is missing, inactive, mismatched, stale, or incomplete.

## 4. Report design system

### 4.1 Tokens

All document components must use a controlled token set for:

- brand colors and semantic colors
- typography families, weights, and sizes
- page margins
- spacing scale
- border weights
- table density
- image framing
- caption styles
- callouts
- charts and maps
- headers and footers

Magic visual values in section components should be progressively eliminated.

### 4.2 Components

The report library should provide deterministic primitives and sections such as:

- transmittal page
- cover page
- evidence inventory and contents
- salient facts and valuation findings
- property identity and assessment facts
- regional, neighborhood, parcel, zoning, and flood maps
- subject photo exhibits
- comparable map and summary grid
- comparable sale profile
- adjustment grid
- rental comparable grid
- stabilized operating statement
- capitalization-rate evidence
- tax-loading bridge
- cost approach bridge
- approach reconciliation
- final value statement
- appeal impact and filing guide
- limitations, certification boundary, and source appendix

Components must receive structured data. They must not receive arbitrary HTML or layout instructions from a model.

### 4.3 PDF and presentation outputs

The canonical report model should eventually drive two separate products:

- detailed filing or review PDF
- concise executive presentation

The presentation is not a PDF converted to slides. It is a separate composition using the same authoritative facts and conclusions, preventing number drift while respecting different communication goals.

## 5. Artifact reproducibility

Every validated PDF must generate a machine-readable manifest containing at least:

- report and schema version
- renderer version
- report identity
- service and property type
- jurisdiction package identity and coverage status
- valuation and report dates
- concluded value
- evidence counts
- AI models used for narrative sections
- preflight results
- generation timestamp
- PDF byte length
- SHA-256 hash

The manifest should be persisted with the workfile before delivery. A later iteration should also record source snapshots, valuation-engine version, template version, font package version, and reviewer approval.

## 6. Required quality gates

### Gate A — identity and assignment

- property identity resolved
- property and service type resolved
- valuation date resolved
- report date resolved
- intended use and assignment kind resolved

### Gate B — jurisdiction

For tax appeals:

- FIPS resolved
- active rule package attached
- rule and report jurisdiction match
- verification is current
- filing authority and deadline identified
- filing steps and required documents present

### Gate C — evidence

- at least one complete valuation approach
- consequential facts have source states
- comparable sales pass minimum identity and transaction checks
- income calculations pass completeness and arithmetic checks
- unsupported approaches are omitted or explicitly limited

### Gate D — semantics

- units and labels agree
- cap-rate decimal units are valid
- no model-authored headings or tables
- no false certification
- no unsupported professional credential language
- final values agree across all sections and outputs

### Gate E — rendering

- deterministic font registration
- no missing images or glyphs
- no clipped content
- no overlapping elements
- no accidental blank pages
- controlled table and photo pagination
- no orphan headings or captions

### Gate F — visual regression

Every report-system release should render approved fixtures and compare each page to versioned baselines.

Required fixtures:

- residential single-family
- condominium
- multifamily
- office
- retail
- industrial
- land
- zero-comparable but supported income or cost case
- missing-optional-evidence case
- stress fixture with long text, addresses, captions, and large evidence sets

### Gate G — human review

Human review is mandatory when:

- jurisdiction status is partial
- evidence conflicts materially
- report requests licensed appraisal treatment
- high-value commercial or special-purpose property exceeds automated policy boundaries
- the system detects unusual valuation dispersion
- a customer or filing venue requires professional certification

## 7. Target module boundaries

The existing application can evolve incrementally toward:

```text
src/lib/reporting/
  schema/
  evidence/
  valuation/
  jurisdictions/
  composition/
  design-system/
  renderer/
  validation/
  manifest/
  fixtures/
  visual-regression/
```

The current `src/lib/pdf` implementation remains the production renderer during migration. New policy and validation code should remain pure, testable, and independent of UI or database clients.

## 8. Delivery roadmap

### Phase 1 — release control

- deterministic preflight
- jurisdiction freshness and matching gates
- artifact manifest
- semantic narrative restrictions
- complete report-quality specification

### Phase 2 — fixture and visual system

- canonical report fixtures
- PDF render scripts
- page-to-image conversion in CI
- visual regression baselines
- PDF structural checks
- brand-token cleanup

### Phase 3 — canonical report model

- provenance-aware fact schema
- explicit report families
- structured narrative output contracts
- presentation composer from the same data
- manifest persistence

### Phase 4 — nationwide coverage

- jurisdiction registry and coverage UI
- verification workflow
- source citation snapshots
- deadline monitoring
- assisted filing connectors
- explicit unsupported-state behavior

### Phase 5 — scaled operations

- review queues based on risk
- audit logs
- partner and white-label report themes under governed tokens
- filing outcomes and model evaluation
- automated regression evaluation against completed cases

## 9. Non-negotiable release rule

Resourceful must never market or deliver a report as nationally accurate merely because a national data provider returned property records. National property data and jurisdiction-ready appeal support are separate capabilities.

A final report may be released only when the evidence, valuation, jurisdiction, semantic, rendering, and review gates applicable to that assignment have passed.