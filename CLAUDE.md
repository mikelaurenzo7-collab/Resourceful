# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis and public property data APIs. Reports require admin approval before delivery to clients. Photos and tax bills are collected post-payment to strengthen the evidence package — never as a barrier to entry.

## Business Model — Option C: Full Payment with Money-Back Preview
The user flow is designed to minimize friction and maximize trust:

1. **Minimal intake** — Address (property type auto-detected via ATTOM), service type, email, choose tier, pay.
2. **Instant preview** — Immediately after payment, show a statistical estimate:
   "Based on comparable sales, we estimate your property may be over-assessed by $X,
   saving you $Y/year in taxes." This uses the IAAO 8% error rate — always defensible.
3. **24-hour photo window** — Success page shows a countdown timer and encourages
   photo uploads: "Strengthen your evidence — upload photos within 24 hours."
   A reminder email fires at the 12-hour mark.
4. **Money-back guarantee** — If our full analysis finds no savings opportunity,
   the customer gets a complete refund. No questions asked.

**Why this works:** The instant preview gives the customer immediate value and
validates their purchase. The money-back guarantee removes all risk. Photos become
"how do I make this number even bigger" — a much stronger motivator than
"please upload photos before we can help you."

### Wizard Steps (3 steps only)
1. **Goals** — Service type (tax appeal, pre-purchase, pre-listing)
2. **Property** — Address (ATTOM auto-populates: property type, year built, beds/baths/sqft, assessed value, county). User can override property type if needed. Manual selector shown only when ATTOM lookup fails.
3. **Payment** — Choose tier, enter email, pay

### Post-Payment Enhancement (24-Hour Window)
After payment, the success page shows:
- **Instant preview** — Statistical over-assessment estimate + potential savings
- **Money-back guarantee** — Prominent badge: "No savings found? Full refund."
- **24-hour photo timer** — Countdown with upload CTA
- **12-hour reminder email** — Automated nudge with photo tips

Photos and tax bills enhance the report but are never required for generation.

## Delivery Model — Deferred Pipeline, Within 24 Hours
Pipeline does NOT fire on payment. The Stripe webhook only:
1. Updates report status to 'paid'
2. Sends payment confirmation email

The pipeline is triggered by a Vercel cron job at the ~14 hour mark:

```
-1m  — User enters address. ATTOM lookup auto-populates property details + cached.
 0h  — Customer pays. Instant preview uses cached ATTOM data (no 2nd call).
12h  — Photo reminder email sent (cron).
14h  — Pipeline triggered (cron). Stage 1 reuses cached ATTOM data (no 3rd call).
~14.5h — Pipeline complete. Report enters pending_approval.
18-24h — Admin reviews and delivers.
```

**Why deferred?** Running the pipeline immediately wastes API costs. If the
customer uploads photos later, we'd have to re-run AI analysis, narratives,
and PDF — paying Anthropic twice. By waiting for the customer's signal or
the 14h mark, we run the full pipeline ONCE with the best available data.

**Intent-based trigger:** The customer controls when the pipeline runs:
- **"Build my report now"** button on success page (skips photos)
- **"Done" button** on photo upload page (after uploading photos)
- Both call `POST /api/reports/[id]/ready` which triggers the pipeline
- If the customer never clicks either, the 14h cron triggers automatically
- 24h safety net catches anything that slipped through

**Endpoint:** `POST /api/reports/[id]/ready` — idempotent, rate-limited,
UUID-keyed (no auth required). Returns success even if pipeline already started.

Stage 8 (delivery email with PDF + filing guide) only executes after
admin approval.

**Cron endpoint:** `/api/cron/photo-reminders` (every 30 min, secured by CRON_SECRET)

## Nationwide Architecture Rule
This platform serves every county in every state. ATTOM is the universal data source that covers the entire country. No county-specific logic is hardcoded in application code. All county-specific behavior comes from the county_rules database table: assessment ratios, appeal board names, filing deadlines, form names, hearing formats. The data-router supports future county-specific API adapters via county_rules.assessor_api_url, but none are required — ATTOM handles everything.

## Tech Stack
- Next.js 14 App Router, TypeScript strict mode
- Supabase (Postgres, Storage, Auth) — RLS on every table
- Anthropic AI API (model names are env-var constants — never hardcoded)
- ATTOM Data API for property data
- Google Maps, Geocoding, Places, Street View, Static Maps APIs
- Stripe for payments, Resend for email
- @sparticuz/chromium + puppeteer-core for PDF generation
- Deployed on Vercel

## Key Conventions
- All AI model identifiers: AI_MODELS.PRIMARY and AI_MODELS.FAST from config/ai.ts
- All database queries: typed repository functions in lib/repository/
- All external API calls: typed service modules in lib/services/
- All prices: PRICING constants from config/pricing.ts
- All env vars: documented in .env.example, never hardcoded

## Commands
- pnpm dev — start development server
- pnpm build — production build
- pnpm lint — ESLint check
- pnpm test — run test suite
- supabase db push — push schema changes
- supabase gen types typescript — regenerate TypeScript types from schema

## Data Trust Hierarchy — CRITICAL
County assessment data is NOT trustworthy. ATTOM sources from county records.
If a county is corrupt or wrong, ATTOM inherits that same bad data. Therefore:

- **Property lookup (pre-payment)**: ATTOM data used ONLY for auto-populating
  property details (type, year built, beds/baths/sqft) to show expertise. The
  assessed value is displayed but NOT used for any savings estimate pre-payment.
  Cached in `property_cache` for reuse by instant preview and pipeline.
- **Instant preview (post-payment)**: Pure statistical estimate only (IAAO 8% error
  rate). NEVER compare against ATTOM marketValue. This is the number shown
  immediately after payment to validate the purchase. Uses cached ATTOM data.
- **Full report (ATTOM + AI)**: Uses comparable sales and AI analysis.
  Generated with zero user effort beyond providing the address.
- **Enhanced report (+ user photos)**: When the user uploads photos during
  the 24-hour window, the report incorporates photo-based condition adjustments.
  This is our strongest independent evidence.
- **User photos + measurements**: This is OUR proprietary data. As it compounds
  over time, it becomes our strongest independent data source. Always treated
  as higher-trust than county or ATTOM assessment data.
- **Calibration system**: Learns from real outcomes to improve accuracy over time.

## Payment & Messaging Rules — CRITICAL
- ALL payments happen BEFORE the valuation is shown. No exceptions.
- The instant preview is shown AFTER payment — it validates, not sells.
- Never use the word "free" anywhere in user-facing copy.
- Never ask for photos, tax bills, or detailed property info before payment.
  The intake should feel effortless — address, type, pay.
- Money-back guarantee structure:
  - **No savings found** → Full refund (our analysis says assessment is fair)
  - **Appeal denied by Board** → No refund, but free re-analysis next cycle
  - **Customer didn't file** → No refund (we delivered the product)
  - Guarantee triggers on OUR failure to find savings, not Board decisions
- Tax bill upload is an optional post-payment enhancement (alongside photos).
  No discount — the money-back guarantee is the primary trust signal.
- Tax bill uploaders skip redundant ATTOM assessment lookups.

## AI Directive — CRITICAL
All Anthropic AI prompts must follow these principles:
- **User-friendly first**: Write in language that empowers and reassures the homeowner
- **Investigative**: Leave no angle unexplored, no data point unquestioned
- **Find EVERY possibility**: Every single reason the assessment might be incorrect
- **Service-type aware**: Tax appeals → advocate for lower value. Pre-listing → advocate
  for higher value. Pre-purchase → protect the buyer with honest assessment.
- The AI is NOT neutral. It is the customer's expert witness and advocate.

## Retention — 50% Lock-In Offer
After report delivery, offer 50% off the next annual report:
- Shown in the delivery email and on the report viewer page
- One-time payment ($29.50 for residential auto tier)
- Activates when the next assessment is published
- NOT a subscription — explicit one-time lock-in

## Project Structure

```
src/
├── app/                            # Next.js App Router pages & API routes
│   ├── api/
│   │   ├── reports/                # Report CRUD & lifecycle
│   │   │   └── [id]/
│   │   │       ├── ready/          # POST — trigger pipeline (idempotent)
│   │   │       ├── photos/         # POST — upload property photos
│   │   │       ├── measurements/   # POST — record dimensions
│   │   │       ├── tax-bill-data/  # POST — upload tax bill
│   │   │       ├── valuation/      # GET  — instant preview
│   │   │       ├── assessment/     # GET  — assessment data
│   │   │       ├── viewer/         # GET  — HTML report preview
│   │   │       └── filing-info/    # GET  — county filing instructions
│   │   ├── property/
│   │   │   └── lookup/             # POST — ATTOM property lookup + cache
│   │   ├── admin/                  # Admin approval, calibration, rerun
│   │   ├── webhooks/stripe/        # Stripe payment webhook
│   │   ├── cron/photo-reminders/   # Vercel cron (every 30 min)
│   │   └── valuation/              # Instant preview estimation
│   ├── start/                      # 3-step wizard flow
│   │   ├── situation/              # Step 1: service & property type
│   │   ├── property/               # Step 2: address & details
│   │   ├── payment/                # Step 3: checkout
│   │   ├── success/                # Post-payment preview + photo timer
│   │   ├── photos/                 # 24-hour photo upload window
│   │   └── measure/                # Measurement tool
│   ├── admin/                      # Admin dashboard, review queue, calibration
│   ├── dashboard/                  # User report status dashboard
│   └── report/[id]/               # Report viewer
│
├── components/
│   ├── admin/                      # ApprovalAuditTrail, QualityFlags, RejectModal
│   ├── dashboard/                  # PipelineProgress, ReportDownload
│   ├── intake/                     # AddressInput, PropertyDetails, PhotoUploader, MeasurementTool
│   ├── landing/                    # Hero, ServiceCards, HowItWorks, FAQ, etc.
│   ├── seo/                        # JsonLd
│   └── ui/                         # Button, Input, Card, Modal, Badge
│
├── config/
│   ├── ai.ts                       # AI_MODELS.PRIMARY / AI_MODELS.FAST (env-var driven)
│   └── pricing.ts                  # PRICING constants (3 tiers × 6 service types)
│
├── lib/
│   ├── pipeline/
│   │   ├── orchestrator.ts         # Stage sequencer, retry logic, pipeline lock
│   │   └── stages/                 # 8-stage report generation pipeline
│   │       ├── stage1-data-collection.ts   # ATTOM, geocoding, flood zones
│   │       ├── stage2-comparables.ts       # Recent sales analysis
│   │       ├── stage3-income-analysis.ts   # Cap rate (commercial/industrial)
│   │       ├── stage4-photo-analysis.ts    # Vision AI condition ratings
│   │       ├── stage5-narratives.ts        # AI report writing
│   │       ├── stage6-filing-guide.ts      # AI filing instructions
│   │       ├── stage7-pdf-assembly.ts      # Puppeteer HTML→PDF
│   │       └── stage8-delivery.ts          # Email delivery (admin-triggered)
│   │
│   ├── services/                   # External API integrations
│   │   ├── anthropic.ts            # Claude API wrapper
│   │   ├── attom.ts                # ATTOM property data API
│   │   ├── data-router.ts          # County-specific API routing
│   │   ├── google-maps.ts          # Maps, geocoding, Street View
│   │   ├── fema.ts                 # Flood zone lookups
│   │   ├── pdf.ts                  # Puppeteer PDF generation
│   │   ├── stripe-service.ts       # Stripe payment handling
│   │   └── resend-email.ts         # Resend email service
│   │
│   ├── repository/                 # Typed data access layer (no raw SQL in components)
│   │   ├── reports.ts              # Report CRUD + joins
│   │   ├── admin.ts                # Approval audit trail
│   │   ├── county-rules.ts         # County data lookups
│   │   └── property-cache.ts       # ATTOM response caching (lookup, upsert)
│   │
│   ├── calibration/                # Valuation accuracy learning system
│   │   ├── recalculate.ts          # Compute correction multipliers
│   │   └── run-blind-valuation.ts  # Blind valuation for calibration
│   │
│   ├── supabase/                   # Database client initialization
│   │   ├── client.ts               # Browser client (SSR)
│   │   ├── server.ts               # Server component client
│   │   ├── admin.ts                # Service role (full access)
│   │   └── middleware.ts           # Auth middleware
│   │
│   ├── templates/
│   │   ├── report-template.ts      # HTML report template (1648 lines)
│   │   └── helpers.ts              # Template formatting helpers
│   │
│   ├── validations/
│   │   └── report.ts               # Zod input validation schemas
│   │
│   └── rate-limit.ts              # IP-based rate limiting
│
├── types/
│   └── database.ts                 # Supabase table types & enums
│
└── middleware.ts                   # Next.js request middleware (auth, redirects)

supabase/migrations/                # 13 SQL migration files (001–013)
scripts/                            # seed-county-rules.ts, seed-counties.ts
```

## Architecture Patterns

### Pipeline (8 Stages)
The report generation pipeline runs as an ordered sequence of stages. Each stage is idempotent and the orchestrator can resume from the last successful stage on retry.

**Status flow:** `intake → paid → processing → pending_approval → approved → delivered`

Stage 3 (income analysis) only runs for commercial/industrial properties. Stage 6 (filing guide) only runs for tax appeals. Stage 8 (delivery) only executes after admin approval.

The orchestrator uses a database lock (`acquire_pipeline_lock` / `release_pipeline_lock` RPCs) to prevent concurrent runs on the same report. Retries up to 2 times for transient errors. 10-minute timeout.

### Data Access
- **Repository pattern**: All database queries go through typed functions in `lib/repository/`. Never write raw Supabase queries in pages or API routes.
- **Service modules**: All external API calls go through typed service modules in `lib/services/`. Each service handles its own error handling and response typing.
- **Supabase clients**: Use `lib/supabase/client.ts` in browser, `lib/supabase/server.ts` in server components, `lib/supabase/admin.ts` for service-role operations. RLS is enforced on every table.

### ATTOM Property Cache
ATTOM responses are cached in `property_cache` (keyed by normalized address, 90-day TTL). The cache is populated during the wizard's property lookup (Step 2) and reused by:
1. Instant preview (`/api/reports/[id]/valuation`) — reads cache instead of calling ATTOM
2. Pipeline Stage 1 (`stage1-data-collection.ts`) — reads cache instead of calling ATTOM
This reduces 3 ATTOM API calls per report to 1. The `reports.attom_cache_id` FK links each report to its cached data. For repeat lookups of the same address (e.g., neighbors), the cache hit eliminates the ATTOM call entirely.

### API Routes
All API routes live under `src/app/api/`. Report lifecycle endpoints use UUID-keyed URLs (`/api/reports/[id]/...`). The `/ready` endpoint is idempotent and rate-limited. The `/api/property/lookup` endpoint is rate-limited (30/15min) and returns cached or fresh ATTOM data. Admin endpoints require authentication. The Stripe webhook verifies signatures. The cron endpoint requires `CRON_SECRET`.

## Database

**14 migrations** in `supabase/migrations/` (001–014). Core tables:
- `reports` — Main entity with status tracking, payment, filing info
- `property_data` — Valuation data from ATTOM + calculations
- `photos` — User-uploaded property photos with AI analysis results
- `comparable_sales` — Recent comparable sales data
- `measurements` — Property dimensions (multiple sources)
- `report_narratives` — AI-generated written analysis
- `filing_guides` — State/county-specific filing instructions
- `county_rules` — Assessment ratios, appeal boards, deadlines, hearing formats
- `calibration_entries` / `calibration_params` — Accuracy learning system
- `property_cache` — Cached ATTOM property lookups (90-day TTL, keyed by normalized address)

All tables have RLS policies. County rules are publicly readable. Users can only access their own reports and photos.

To modify the schema: create a new migration file in `supabase/migrations/`, then run `supabase db push`. After schema changes, regenerate types with `pnpm types:generate` (alias for `supabase gen types typescript --local > src/types/supabase.ts`).

## Testing

**Framework:** Vitest (configured in `vitest.config.ts`)
- Test environment: Node
- Path alias: `@/` → `./src/`
- Setup file: `src/lib/__tests__/setup.ts`
- Fixtures: `src/lib/__tests__/fixtures.ts`
- Mocks: `src/lib/__tests__/mocks.ts`

**17 test files** covering pipeline stages, services, repository, config, validations, and templates. Tests are co-located with source files (`*.test.ts`).

**Commands:**
- `pnpm test` — run all tests once
- `pnpm test:watch` — watch mode
- `pnpm test:coverage` — with coverage report

## Environment Variables

All env vars are documented in `.env.example`. Key groups:
- **AI**: `AI_MODEL_PRIMARY`, `AI_MODEL_FAST`, `ANTHROPIC_API_KEY`
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Google**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`
- **ATTOM**: `ATTOM_API_KEY`
- **Stripe**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `ADMIN_NOTIFICATION_EMAIL`
- **Infra**: `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`

Never use `NEXT_PUBLIC_` prefix on secret keys (service role, Stripe secret, webhook secret).

## Deployment

Hosted on **Vercel** with Next.js 14 App Router. Configuration in `vercel.json`:
- Stripe webhook route: 300s max duration
- Cron endpoint: 60s max duration
- Cron schedule: `/api/cron/photo-reminders` runs every 30 minutes

Node version pinned to 18 (`.nvmrc`).

## What NOT To Do
- Never send a report to a client without admin approval first
- Never hardcode county-specific logic in application code
- Never hardcode AI model names anywhere except config/ai.ts
- Never use NEXT_PUBLIC_ prefix on service role keys or secret keys
- Never use ATTOM marketValue as ground truth for valuations or comparisons
- Never trust county assessment data as accurate — always verify independently
- Never say "free" in any user-facing text
- Never ask for photos or tax bills before payment — trust first, enhance later
- Never block report generation on missing photos — AI + ATTOM is enough to start
- Never show the instant preview BEFORE payment — it comes after as validation
- Never write raw Supabase queries outside of lib/repository/ functions
- Never call external APIs outside of lib/services/ modules
- Never skip Zod validation on API route inputs
