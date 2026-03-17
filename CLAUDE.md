# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis, public property data APIs, and owner-provided photographs. After the 7-stage pipeline completes, reports route to admin for review and approval before delivery to clients via email.

## Delivery Model
After stages 1–7 complete, every report is set to `status = 'pending_approval'`. Admin reviews via `/admin/reports/[id]/review` and clicks "Approve and Send." Stage 8 (`runDelivery`) is admin-triggered — it generates a signed 7-day PDF URL, sends the client email via Resend, records `approved_at`/`delivered_at`, and sets `status = 'delivered'`. If delivery fails, the report stays at `pending_approval` for retry.

## Nationwide Architecture Rule
This platform serves every county in every state. ATTOM is the universal data source that covers the entire country. No county-specific logic is hardcoded in application code. All county-specific behavior comes from the `county_rules` database table: assessment ratios, appeal board names, filing deadlines, form names, hearing formats. The data-router supports future county-specific API adapters via `county_rules.assessor_api_url`, but none are required — ATTOM handles everything.

## Tech Stack
- Next.js 14 App Router, TypeScript strict mode
- Supabase (Postgres, Storage, Auth) — RLS on every table
- Anthropic AI API (model names are env-var constants — never hardcoded)
- ATTOM Data API for property data
- Google Maps, Geocoding, Places, Street View, Static Maps APIs
- FEMA Flood Zone API (public, no key required)
- Stripe for payments, Resend for email
- `@sparticuz/chromium` + `puppeteer-core` for PDF generation
- Deployed on Vercel
- Vitest for testing

## Key Conventions
- All AI model identifiers: `AI_MODELS.PRIMARY` and `AI_MODELS.FAST` from `config/ai.ts`
- All token limits: `AI_TOKEN_LIMITS` from `config/ai.ts` (REPORT_NARRATIVES: 8000, VISION_ANALYSIS: 1000, FILING_GUIDE: 3000, CLASSIFICATION: 300)
- All database queries: typed repository functions in `lib/repository/`
- All external API calls: typed service modules in `lib/services/`
- All prices: `PRICING`, `PRICING_EXPERT`, `PRICING_GUIDED`, `PRICING_FULL_REPRESENTATION` constants from `config/pricing.ts`
- `getPriceForReport(serviceType, propertyType, reviewTier, hasTaxBill)` — canonical pricing function
- All env vars: documented in `.env.example`, never hardcoded
- Service functions always return `ServiceResult<T> = { data: T | null; error: string | null }` — never throw
- Repository functions throw on error (caller handles)

## Commands
- `pnpm dev` — start development server
- `pnpm build` — production build
- `pnpm lint` — ESLint check
- `pnpm test` — run Vitest tests
- `pnpm test:watch` — Vitest in watch mode
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

## Directory Structure

```
src/
  app/                        # Next.js App Router pages and API routes
    page.tsx                  # Landing page
    layout.tsx                # Root layout (fonts, globals)
    (auth)
      login/page.tsx
      signup/page.tsx
    dashboard/page.tsx        # User's report list (auth required)
    start/                    # Multi-step intake wizard
      page.tsx                # Step 1: property address
      property/page.tsx       # Step 2: property type
      situation/page.tsx      # Step 3: situation / issues
      photos/page.tsx         # Step 4: photo upload
      measure/page.tsx        # Step 5: measurements
      payment/page.tsx        # Step 6: Stripe payment
      success/page.tsx        # Post-payment confirmation
    report/[id]/page.tsx      # Public report viewer (signed URL)
    admin/                    # Admin dashboard (auth + admin_users required)
      page.tsx                # Admin home
      reports/page.tsx        # Reports queue
      reports/[id]/review/    # Report review + approval
      counties/page.tsx       # County rules list
      counties/[fips]/edit/   # County rule editor
      calibration/page.tsx    # Calibration dashboard
      metrics/page.tsx        # Business metrics
      tax-bill-data/page.tsx  # Tax bill uploads review
    api/
      reports/                # CRUD for reports
      reports/[id]/
        route.ts              # GET/PATCH single report
        assessment/route.ts   # Assessment data
        filing-info/route.ts  # County filing info
        measurements/route.ts # Measurement upsert
        photos/route.ts       # Photo upload
        tax-bill-data/route.ts
        valuation/route.ts    # Pre-payment valuation estimate
        viewer/route.ts       # Report viewer access
      valuation/route.ts      # Pre-payment valuation (public)
      webhooks/stripe/route.ts  # Stripe webhook handler
      admin/
        calibration/          # Calibration management endpoints
        reports/[id]/
          approve/route.ts    # Trigger stage 8 delivery
          reject/route.ts     # Reject report
          regenerate/route.ts # Regenerate specific section
          rerun/route.ts      # Re-run pipeline from stage N

  components/
    admin/                    # Admin-specific UI
      ApprovalAuditTrail.tsx
      QualityFlags.tsx
      RejectModal.tsx
      ReportStatusBadge.tsx
    dashboard/
      PipelineProgress.tsx    # Real-time pipeline stage display
      ReportDownload.tsx
    intake/                   # Wizard step components
      AddressInput.tsx        # Google Maps autocomplete
      AssessmentCard.tsx
      MeasurementTool.tsx
      PhotoUploader.tsx
      PropertyTypeSelector.tsx
      ServiceTypeSelector.tsx
      WizardLayout.tsx
    landing/
      Hero.tsx, FAQ.tsx, Footer.tsx, HowItWorks.tsx, ServiceCards.tsx
    seo/JsonLd.tsx
    ui/                       # Primitive UI: Badge, Button, Card, Input, Modal

  config/
    ai.ts                     # AI_MODELS, AI_TOKEN_LIMITS, AI_CONFIG — ONLY place for model names
    pricing.ts                # All pricing constants + getPriceForReport()

  lib/
    pipeline/
      orchestrator.ts         # runPipeline(reportId, startFromStage?) — stages 1-7
      stages/
        stage1-data-collection.ts   # Geocode + ATTOM + FEMA + county_rules lookup
        stage2-comparables.ts       # ATTOM comps + adjustments (with calibration)
        stage3-income-analysis.ts   # Rental comps + income approach (commercial/industrial only)
        stage4-photo-analysis.ts    # AI vision analysis of uploaded photos
        stage5-narratives.ts        # Full AI narrative generation (all sections)
        stage6-filing-guide.ts      # AI-generated county-specific filing guide (tax_appeal only)
        stage7-pdf-assembly.ts      # Puppeteer PDF assembly + Supabase Storage upload
        stage8-delivery.ts          # Admin-triggered: signed URL + Resend email + status update
    calibration/
      recalculate.ts          # Compute calibration_params from calibration_entries
      run-blind-valuation.ts  # Blind valuation runner for calibration testing
    services/
      anthropic.ts            # generateNarratives(), generateFilingGuide(), analyzePhoto()
      attom.ts                # getPropertyDetail(), getSalesComparables(), getRentalComparables(), getDeedHistory()
      data-router.ts          # collectPropertyData() — ATTOM + optional county API merge
      fema.ts                 # Flood zone lookup (FEMA public API)
      google-maps.ts          # geocodeAddress(), getStreetViewUrl(), getStaticMapUrl()
      pdf.ts                  # generatePdf() via puppeteer-core + @sparticuz/chromium
      resend-email.ts         # sendReportDeliveryEmail(), sendAdminNotification(), sendReportRejectionAlert()
      stripe-service.ts       # createPaymentIntent(), constructWebhookEvent(), getPaymentIntent()
    repository/
      reports.ts              # createReport(), getReportById(), getReportWithDetails(), updateReport(), etc.
      admin.ts                # getAdminUser(), isAdmin(), getApprovalEvents(), createApprovalEvent()
      county-rules.ts         # getCountyByFips(), getCountyByName(), getActiveCounties(), upsertCountyRule()
    supabase/
      admin.ts                # createAdminClient() — service role, server-only
      client.ts               # createBrowserClient() — browser-safe anon key
      server.ts               # createServerClient() — SSR cookie-based auth
      middleware.ts           # updateSession() — used by src/middleware.ts
    templates/
      report-template.ts      # HTML template for PDF generation
      helpers.ts              # Template helper utilities
    validations/
      report.ts               # Zod schemas for report intake validation
    rate-limit.ts             # checkRateLimit(), applyRateLimit() — Supabase-backed distributed rate limiting

  middleware.ts               # Auth guard: /admin and /dashboard require login; /start is public
  types/
    database.ts               # All DB types: Report, PropertyData, ComparableSale, CountyRule, etc. + Database type

supabase/
  migrations/
    001_initial_schema.sql    # Core tables: reports, property_data, photos, comparable_sales, etc.
    002_scalability.sql       # Indexes, RLS, rate_limit_entries, pipeline lock RPCs
    003_email_only_intake.sql # Email-only intake (no account required at purchase)
    004_county_filing_details.sql  # Extended county_rules: filing steps, hearing, rep rules
    005_calibration.sql       # calibration_entries + calibration_params tables
    006_review_tiers.sql      # review_tier enum: auto, expert_reviewed, guided_filing, full_representation
    007_tax_bill_fields.sql   # has_tax_bill, tax_bill_assessed_value, tax_bill_tax_amount
    008_photo_value_attribution.sql # concluded_value, photo_impact_dollars/pct fields

scripts/
  seed-counties.ts            # Seed county_rules table with initial county data
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `reports` | Core report record: status, intake data, payment, pipeline state, filing tracking |
| `property_data` | All collected property attributes (ATTOM + FEMA + tax bill) |
| `photos` | Uploaded photos with AI analysis results |
| `comparable_sales` | Sales comps with adjustment grid (up to 10 per report) |
| `comparable_rentals` | Rental comps for income approach (commercial/industrial) |
| `income_analysis` | Income approach: NOI, cap rate, capitalized value |
| `report_narratives` | AI-generated narrative sections keyed by `section_name` |
| `measurements` | User/Google Earth measurements with discrepancy flagging |
| `county_rules` | County-specific appeal rules, deadlines, forms, filing steps. PK = `county_fips` |
| `admin_users` | Admin access control (separate from `users`) |
| `approval_events` | Audit trail: every admin action on a report |
| `calibration_entries` | Real appraisal outcomes submitted for model calibration |
| `calibration_params` | Learned adjustment multipliers per property_type (and county_fips) |
| `rate_limit_entries` | Supabase-backed distributed rate limiting (works across Vercel instances) |

### Report Status Flow
```
intake → paid → data_pull → photo_pending → processing
       → pending_approval → approved → delivered
                          → rejected
                          → failed
```

## Pipeline Stages (stages 1-7 automated, stage 8 admin-triggered)

| Stage | Name | Description | Skip Condition |
|-------|------|-------------|----------------|
| 1 | `stage-1-data` | Geocode address, ATTOM property detail, FEMA flood zone, county_rules lookup, write `property_data` | Never |
| 2 | `stage-2-comps` | ATTOM sales comps with progressive radius expansion, adjustment grid calculation, calibration multipliers | Never |
| 3 | `stage-3-income` | ATTOM rental comps, income approach (NOI, cap rate, capitalized value) | Non-commercial/industrial |
| 4 | `stage-4-photos` | AI vision analysis of uploaded photos (condition rating, defects, captions) | Never |
| 5 | `stage-5-narratives` | Full AI narrative: 16 sections (exec summary → appeal argument) | Never |
| 6 | `stage-6-filing` | AI-generated county-specific pro se filing guide | Non-`tax_appeal` service type |
| 7 | `stage-7-pdf` | Puppeteer PDF assembly, upload to Supabase Storage | Never |
| 8 | `stage-8-delivery` | Admin-triggered: signed PDF URL, Resend email, status → `delivered` | Admin must approve |

### Pipeline Features
- **Concurrency lock**: `acquire_pipeline_lock` / `release_pipeline_lock` RPCs prevent concurrent runs for the same report
- **Resumability**: `runPipeline(reportId, startFromStage)` resumes from any stage; `pipeline_last_completed_stage` tracks progress
- **Error handling**: On failure, writes to `pipeline_error_log` JSONB, sets `status = 'failed'`
- **Admin rerun**: `/api/admin/reports/[id]/rerun` triggers `runPipeline` from a specified stage

### Stage 1 — County Resolution Priority
1. `attom.location.countyFips` (most reliable — from verified property records)
2. User-provided `county_fips` (set at intake)
3. Google Geocode county name (fallback)

## Pricing Tiers

| Tier | Description |
|------|-------------|
| `auto` | Base price — fully automated report |
| `expert_reviewed` | Professional appraiser reviews before delivery |
| `guided_filing` | Report + live guided filing session (tax_appeal only) |
| `full_representation` | Report + we file + attend hearing (requires `authorized_rep_allowed = true` in county_rules) |

**Base prices (cents):**
- Residential tax appeal: $49 / $149 / $199 / $399
- Commercial/Industrial tax appeal: $99 / $249 / $349 / $599
- Land tax appeal: $49 / $149 / $199 / $399
- Pre-purchase / Pre-listing: $59 / $179 / $179 / $179

**Tax bill discount**: 15% off if user uploads tax bill (`TAX_BILL_DISCOUNT = 0.15`). Rounded to nearest dollar.

## Data Trust Hierarchy — CRITICAL

County assessment data is NOT trustworthy. ATTOM sources from county records. If a county is corrupt or wrong, ATTOM inherits that same bad data. Therefore:

- **Pre-payment valuation**: Pure statistical estimate only (IAAO error rates). NEVER compare against ATTOM `marketValue` or any third-party "market value" that could originate from the same county records. The 8% human-error rate is mathematically defensible regardless of county data quality.
- **Full pipeline analysis**: Uses comparable sales, user photos, and our own measurements — independent evidence that does NOT depend on the county's numbers.
- **User photos + measurements**: This is OUR proprietary data. As it compounds over time, it becomes our strongest independent data source. It must always be treated as higher-trust than county or ATTOM assessment data.
- **Calibration system**: Learns from real outcomes to improve accuracy over time. This is the feedback loop that makes our data increasingly independent from county sources.

## Payment & Messaging Rules — CRITICAL
- ALL payments happen BEFORE the valuation is shown. No exceptions.
- Never use the word "free" anywhere in user-facing copy. Use "run the numbers" or similar. Saying "free" then charging is a trust violation.
- Tax bill uploaders get 15% off (`TAX_BILL_DISCOUNT` in `config/pricing.ts`).
- Tax bill uploaders skip redundant ATTOM assessment lookups (we already have their assessed value). ATTOM is still called for building details and comps.
- The post-payment optimistic result is a teaser, not the real analysis. The real numbers come from the full pipeline with comparable sales.

## Calibration System

The calibration system learns from real appraisal outcomes to improve adjustment accuracy over time.

- **`calibration_entries`**: Each entry records a real appraised value vs. our concluded value for a property, plus the actual adjustment percentages used.
- **`calibration_params`**: Computed from entries. Contains `size_multiplier`, `condition_multiplier`, `market_trend_multiplier`, `land_ratio_multiplier`, `value_bias_pct`, `sqft_correction_factor`. Keyed by `(property_type, county_fips)` — county-level when ≥5 entries, otherwise national.
- Stage 2 loads calibration params and applies multipliers to every comp adjustment calculation.
- Minimum sample thresholds: 5 (bias only), 10 (rough multipliers), 50 (full regression).
- Multipliers are clamped to [0.3, 3.0] to prevent runaway calibration.

## Auth & Security

- `src/middleware.ts` guards `/admin` and `/dashboard` — redirect to `/login` if unauthenticated. `/start` is fully public (no account needed to purchase).
- Admin access requires a row in `admin_users` table (not just a Supabase user).
- `createAdminClient()` — service role key, server-only. Never expose to browser.
- `createBrowserClient()` — anon key, safe for browser.
- Rate limiting: `applyRateLimit()` uses Supabase-backed `rate_limit_entries` table — works correctly across all Vercel serverless instances.
- PDF URLs are signed 7-day Supabase Storage URLs — not publicly guessable.

## Environment Variables

```
# AI
ANTHROPIC_API_KEY=
AI_MODEL_PRIMARY=claude-sonnet-4-6        # report narratives
AI_MODEL_FAST=claude-haiku-4-5-20251001   # photo analysis, filing guide

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=               # server-only, never NEXT_PUBLIC_
SUPABASE_PROJECT_REF=

# Google APIs (need: Maps JS, Geocoding, Places, Street View Static, Maps Static)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=         # browser key — restrict to domain
GOOGLE_MAPS_SERVER_KEY=                  # server key for geocoding + static maps

# ATTOM
ATTOM_API_KEY=                           # endpoints: /property/detail, /sale/snapshot, /rental/snapshot

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=                       # server-only
STRIPE_WEBHOOK_SECRET=                   # for /api/webhooks/stripe

# Resend
RESEND_API_KEY=
RESEND_FROM_ADDRESS=reports@yourdomain.com   # must be verified domain
ADMIN_NOTIFICATION_EMAIL=your@email.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Report Narrative Sections

Stage 5 generates these sections (stored in `report_narratives` with `section_name`):

1. `executive_summary`
2. `property_description`
3. `site_description_narrative`
4. `improvement_description_narrative`
5. `condition_assessment`
6. `area_analysis_county`
7. `area_analysis_city`
8. `area_analysis_neighborhood`
9. `market_analysis`
10. `hbu_as_vacant`
11. `hbu_as_improved`
12. `sales_comparison_narrative`
13. `adjustment_grid_narrative`
14. `income_approach_narrative` (commercial/industrial only)
15. `reconciliation_narrative`
16. `appeal_argument_summary`

Stage 6 generates: `pro_se_filing_guide` (tax_appeal only)

Admin can regenerate individual sections via `/api/admin/reports/[id]/regenerate`.

## What NOT To Do
- Never skip Stage 8 approval flow — all reports must go through admin before delivery
- Never hardcode county-specific logic in application code
- Never hardcode AI model names anywhere except `config/ai.ts`
- Never use `NEXT_PUBLIC_` prefix on service role keys or secret keys
- Never use ATTOM `marketValue` as ground truth for valuations or comparisons
- Never trust county assessment data as accurate — always verify independently
- Never say "free" in any user-facing text
- Never throw from service functions — return `{ data: null, error: '...' }`
- Never add county adapter cases hardcoded by county name — key by FIPS from `county_rules`
