# Vercel and Final Report Release Gates

**Status:** Required before PR #30 or any subsequent report-platform release may enter production  
**Current infrastructure finding:** The connected Vercel team contains `wireline` and `v0-project`; no Resourceful project is presently available for preview or production validation.

## 1. Purpose

This document defines the minimum deployment, test, visual, and operational controls required before Resourceful may deliver final customer PDFs or claim supported nationwide tax-appeal coverage.

A successful application build does not prove a report is correct or visually professional. Report release therefore requires both application deployment gates and artifact-specific gates.

## 2. Vercel project requirements

Create a dedicated Resourceful Vercel project connected to the Resourceful GitHub repository.

Required configuration:

- production branch: `main`
- automatic preview deployments for pull requests
- isolated preview, production, and local environment variables
- no production secrets exposed to previews unless explicitly required and restricted
- Node and package-manager versions pinned to repository requirements
- build command aligned with the repository `check` or approved equivalent
- framework preset verified for Next.js
- deployment protection enabled for non-public previews where customer or property data may appear
- function regions selected deliberately for data and latency requirements
- runtime and build logs retained sufficiently for incident investigation

Resourceful must not reuse the Wireline project or a generic Vercel project merely to obtain a green deployment badge.

## 3. Environment separation

### Preview

Preview deployments must use:

- non-production Supabase project or isolated schema
- test storage buckets
- non-production email sender
- Stripe test mode
- provider sandbox or restricted keys where available
- synthetic or redacted report fixtures only

### Production

Production requires:

- explicit approved environment inventory
- least-privilege credentials
- secret rotation process
- protected production database and storage
- Sentry or equivalent error monitoring
- audit logging for report generation and delivery
- rollback procedure

No report fixture used for visual testing may contain real customer personal information unless specifically authorized and access controlled.

## 4. Pull request deployment gates

Every report-system pull request should produce:

1. application preview deployment
2. successful install, lint, type-check, unit tests, and production build
3. canonical report fixture PDFs
4. rendered page images for each fixture
5. PDF manifests
6. visual-diff output against approved baselines
7. structural PDF validation results

PR checks must fail when any required artifact is missing.

## 5. Canonical fixture matrix

At minimum, maintain synthetic fixtures for:

| Fixture | Required analytical characteristics |
|---|---|
| Residential SFR | Sales comparison, assessment facts, photographs |
| Condominium | Unit facts, comparable sales, shared-property context |
| Multifamily | Verified unit count, per-unit and area metrics, income approach |
| Office | Rent comparables, pro forma, cap-rate support, $/SF |
| Retail | Lease structure, market rent, income and sales evidence |
| Industrial | Clear height, loading, site coverage, industrial sales |
| Land | Zoning, site utility, $/acre or $/buildable unit |
| Zero-sales supported case | Complete income or cost approach and reconciliation |
| Limited-evidence case | Proper omissions and visible limitations |
| Stress case | Long address, long captions, many photos/comps, large values, long narrative |

Fixtures must be deterministic and version controlled. They should not depend on live external APIs during regression testing.

## 6. PDF structural preflight

After generation, each PDF should be inspected programmatically for:

- valid PDF signature and readable page tree
- nonzero page count
- expected minimum and maximum page range by fixture
- embedded or otherwise deterministic fonts
- missing image resources
- zero-byte or implausibly small output
- unexpected blank or nearly blank pages
- duplicate pages where detectable
- invalid metadata
- final SHA-256 hash and manifest association

A later phase should add text-boundary and object-overlap checks using page-coordinate extraction.

## 7. Visual regression

Render every PDF page to a consistent image format using a pinned toolchain.

Pin:

- operating-system image
- rendering tool version
- fonts
- locale
- timezone
- image dimensions and DPI

Compare output against approved baselines with:

- pixel or perceptual difference threshold
- exclusion masks only for deliberately variable data
- page-count comparison
- human approval workflow for intended design changes

A baseline must never be automatically replaced because a test failed. Baseline changes require explicit review.

## 8. Visual review checklist

Human reviewers must confirm:

- cover and transmittal are unmistakably Resourceful
- typography and spacing are consistent
- section hierarchy is clear
- no raw Markdown appearance
- headings are not orphaned
- tables are readable and do not clip
- numeric columns align consistently
- captions remain attached to photographs and maps
- photos are not distorted
- source and limitation text is readable
- no nearly empty accidental pages
- no repeated or contradictory final values
- report length reflects evidence volume rather than artificial padding
- the final report remains professional in print and on screen

## 9. Cross-artifact consistency

When the same workfile produces a PDF, presentation, dashboard summary, email, or filing form, automated checks must confirm consistency for:

- property identity
- parcel number
- valuation date
- assessed value
- concluded value
- approach indications
- requested relief
- filing deadline
- jurisdiction and appeal authority

All artifacts must derive from the same canonical report model rather than copying numbers between documents.

## 10. Jurisdiction release gate

A county or assessment jurisdiction may be marketed as fully supported only when:

- authoritative sources have been identified
- rule package is active
- FIPS and state routing are tested
- valuation date and assessment methodology are known
- filing body and deadline rule are known
- required forms and documents are known
- representation limitations are known
- filing workflow has been tested or explicitly scoped out
- verification is current under the defined freshness policy
- a representative report fixture passes all report gates

Coverage levels shown to users must match actual support:

- Full appeal and filing support
- Report-ready, user-filed
- Research-assisted and reviewer-required
- Unsupported

## 11. OpenAI and model-output gate

Model configuration must be versioned and observable.

For every narrative section, persist where supported:

- provider and model identifier
- prompt or instruction version
- structured output schema version
- generation timestamp
- token usage
- evidence references
- reviewer edits

Model output must pass the semantic narrative preflight. Headings, tables, layout markup, unsupported certifications, invented sources, and unsupported numerical conclusions block final delivery.

The highest-capability approved reasoning model may be used for complex appraisal interpretation, but deterministic code remains authoritative for calculations, jurisdiction routing, and report composition.

## 12. Production approval gate

A report-platform release may move to production only when all are true:

- PR is not draft
- branch is current with `main`
- CodeRabbit or equivalent static review is clear
- executable CI actually ran and passed
- Vercel preview built successfully
- canonical PDFs were generated
- structural preflight passed
- visual regression passed or intended differences were approved
- representative PDFs received page-by-page human QA
- no unresolved critical review threads remain
- migration and rollback plans are documented
- production environment inventory is approved

A GitHub Actions run that fails before creating steps or logs is not a code-test result and does not satisfy this gate.

## 13. Post-release monitoring

Track:

- report-generation success and timeout rate
- preflight failure codes
- PDF size and page-count anomalies
- jurisdiction-staleness events
- model-output rejection rate
- human edit frequency by section
- customer download failures
- filing outcomes and assessor feedback
- visual-regression escapes

Every production report should be traceable to its manifest, deployment, code commit, jurisdiction package, and review event.

## 14. Immediate implementation sequence

1. Create and connect the dedicated Resourceful Vercel project.
2. Restore functioning executable CI.
3. Build synthetic canonical fixtures.
4. Add a script that generates PDFs and manifests from fixtures.
5. Render pages to images in CI.
6. Establish reviewed visual baselines.
7. Add PDF structural checks.
8. Persist manifests beside final report artifacts.
9. Add jurisdiction coverage status to admin and customer workflows.
10. Only then promote PR #30 from draft and consider a squash merge.