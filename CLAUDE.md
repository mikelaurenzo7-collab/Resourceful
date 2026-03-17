# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis, public property data APIs, and owner-provided photographs. Reports are auto-delivered to clients after pipeline completion.

## Delivery Model
Reports are automatically delivered to clients after the pipeline completes all stages (1-8). Stage 8 sends the PDF and filing guide via email. If auto-delivery fails, the report falls back to status = 'pending_approval' for admin manual delivery. Admin can still review, reject, or re-run reports via the admin dashboard.

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
- Tailwind CSS with navy/gold/cream color scheme, Playfair Display & Inter fonts
- Deployed on Vercel

## Commands
- `pnpm dev` — start development server
- `pnpm build` — production build
- `pnpm lint` — ESLint check
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (fonts, Supabase provider)
│   ├── page.tsx                # Landing page
│   ├── login/ & signup/        # Auth pages
│   ├── terms/ privacy/ disclaimer/  # Legal pages
│   ├── start/                  # Intake wizard (7 steps)
│   │   ├── situation/          # Service & property type selection
│   │   ├── property/           # Address input + tax bill upload
│   │   ├── measure/            # Optional measurement submission
│   │   ├── photos/             # Photo upload
│   │   ├── payment/            # Stripe checkout
│   │   └── success/            # Post-payment teaser valuation
│   ├── dashboard/              # User's report list & progress
│   ├── report/[id]/            # Public report viewer (no auth, keyed by UUID)
│   ├── admin/                  # Admin dashboard
│   │   ├── reports/            # Pending approval list + review
│   │   ├── counties/           # County rules management + edit
│   │   ├── calibration/        # Blind valuation & accuracy tracking
│   │   ├── metrics/            # System performance metrics
│   │   └── tax-bill-data/      # Tax bill data management
│   └── api/                    # API routes (28 endpoints)
│       ├── valuation/          # Quick ATTOM lookup (rate-limited, no auth)
│       ├── reports/            # Report CRUD + photos + measurements
│       ├── admin/              # Admin actions (approve/reject/rerun/calibration)
│       └── webhooks/stripe/    # Payment confirmation → pipeline trigger
├── components/                 # React components (24 files)
│   ├── admin/                  # ApprovalAuditTrail, QualityFlags, RejectModal, StatusBadge
│   ├── dashboard/              # PipelineProgress, ReportDownload
│   ├── intake/                 # WizardLayout, ServiceType/PropertyType selectors,
│   │                           # AddressInput, AssessmentCard, PhotoUploader, MeasurementTool
│   ├── landing/                # Hero, HowItWorks, ServiceCards, FAQ, Footer
│   ├── seo/                    # JsonLd structured data
│   └── ui/                     # Button, Input, Card, Badge, Modal
├── config/
│   ├── ai.ts                   # AI_MODELS.PRIMARY, AI_MODELS.FAST, token limits
│   └── pricing.ts              # Base prices, TAX_BILL_DISCOUNT, getPriceForReport()
├── lib/
│   ├── pipeline/               # 8-stage report generation
│   │   ├── orchestrator.ts     # runPipeline() — sequential stage execution with locking
│   │   ├── stage-1-data.ts     # Geocoding, ATTOM property detail, FEMA, county rules
│   │   ├── stage-2-comps.ts    # Sales/rental comps with adjustment grids
│   │   ├── stage-3-income.ts   # NOI, cap rate, income approach (commercial only)
│   │   ├── stage-4-photos.ts   # Vision API condition assessment, defect detection
│   │   ├── stage-5-narratives.ts  # AI-generated report sections (8 narrative types)
│   │   ├── stage-6-filing.ts   # County-specific filing instructions & deadlines
│   │   ├── stage-7-pdf.ts      # Puppeteer PDF generation
│   │   └── stage-8-delivery.ts # Email delivery with signed PDF URL (7-day expiry)
│   ├── services/               # External API integrations
│   │   ├── anthropic.ts        # analyzePhoto(), generateNarratives(), generateFilingGuide()
│   │   ├── attom.ts            # getPropertyDetail(), getSalesComps(), getRentalComps()
│   │   ├── data-router.ts      # Unified data collection (routes to ATTOM, extensible)
│   │   ├── google-maps.ts      # Geocoding, place details, static maps, Street View
│   │   ├── fema.ts             # Flood zone queries
│   │   ├── stripe-service.ts   # PaymentIntent creation & webhook verification
│   │   ├── resend-email.ts     # Client delivery, admin notifications, tax bill alerts
│   │   └── pdf.ts              # Puppeteer configuration
│   ├── repository/             # Typed database access
│   │   ├── reports.ts          # Report CRUD with joined relations
│   │   ├── county-rules.ts     # County lookup by FIPS
│   │   └── admin.ts            # Admin auth & approval event logging
│   ├── supabase/               # Client initialization
│   │   ├── admin.ts            # Service role client (server-only)
│   │   ├── server.ts           # User auth client (SSR)
│   │   ├── client.ts           # Browser client
│   │   └── middleware.ts       # Session refresh
│   ├── calibration/            # Accuracy feedback loop
│   │   ├── run-blind-valuation.ts  # Lightweight valuation for tracking
│   │   └── recalculate.ts      # Adjustment multipliers from outcomes
│   ├── templates/              # Email HTML templates
│   └── validations/            # Zod schemas for report creation/update
├── types/
│   └── database.ts             # Complete Supabase TypeScript schema (all table types)
└── middleware.ts               # Route protection (/admin, /dashboard → login redirect)

supabase/migrations/            # 8 SQL migrations defining schema
scripts/seed-counties.ts        # Seeds ~3,143 US counties from Census Bureau API
```

## Key Conventions
- All AI model identifiers: `AI_MODELS.PRIMARY` and `AI_MODELS.FAST` from `config/ai.ts`
- All database queries: typed repository functions in `lib/repository/`
- All external API calls: typed service modules in `lib/services/`
- All prices: `PRICING` constants from `config/pricing.ts`
- All env vars: documented in `.env.example`, never hardcoded
- Path alias: `@/*` maps to `./src/*` (configured in tsconfig.json)
- Supabase RLS enforced on every table — use service role client for server-only operations
- Report IDs are UUIDs — the report viewer (`/report/[id]`) requires no auth

## Pipeline Stages
The orchestrator (`lib/pipeline/orchestrator.ts`) runs stages 1-8 sequentially with stage locking to prevent concurrent execution. Stages can be skipped by property/service type. Errors are recorded in `pipeline_error_log` JSONB.

| Stage | File | Purpose |
|-------|------|---------|
| 1 | stage-1-data.ts | Geocoding, ATTOM property detail, FEMA flood zones, county rules |
| 2 | stage-2-comps.ts | Sales/rental comps with adjustment grid calculation |
| 3 | stage-3-income.ts | NOI, cap rate, income approach (commercial/industrial only) |
| 4 | stage-4-photos.ts | Vision API condition assessment, defect detection |
| 5 | stage-5-narratives.ts | AI-generated report sections (8 narrative types) |
| 6 | stage-6-filing.ts | County-specific filing instructions & deadlines (tax appeals only) |
| 7 | stage-7-pdf.ts | Puppeteer PDF generation with styled narratives |
| 8 | stage-8-delivery.ts | Email delivery with 7-day signed PDF URL |

## Payment Flow
1. `POST /api/reports` → Creates report + Stripe PaymentIntent
2. `/start/payment` → Stripe Elements checkout
3. `POST /api/webhooks/stripe` → `payment_intent.succeeded` is the ONLY pipeline trigger
4. Pipeline runs stages 1-8 → status becomes `pending_approval`
5. `POST /api/admin/reports/[id]/approve` → Triggers Stage 8 delivery
6. Client receives email via Resend with signed PDF URL

## Database Schema (Key Tables)
- **reports** — Status, payment, pipeline tracking, approval workflow
- **property_data** (59 cols) — Complete assessment with ATTOM/FEMA raw responses
- **photos** + **photo_ai_analysis** — Storage paths, vision analysis, defect tracking
- **measurements** — Building dimensions with source tracking (Google Earth/user/ATTOM)
- **comparable_sales** (30 cols) — Comp details with 9 adjustment categories
- **comparable_rentals** — Income comparables
- **income_analysis** — NOI, cap rate, income approach valuation
- **report_narratives** — AI-generated sections with model/token metadata
- **county_rules** (69 cols) — County-specific config (assessment ratios, appeal boards, deadlines)
- **calibration_entries** + **calibration_params** — Blind valuations & accuracy feedback loop

## Data Trust Hierarchy — CRITICAL
County assessment data is NOT trustworthy. ATTOM sources from county records.
If a county is corrupt or wrong, ATTOM inherits that same bad data. Therefore:

- **Pre-payment valuation**: Pure statistical estimate only (IAAO error rates).
  NEVER compare against ATTOM marketValue or any third-party "market value"
  that could originate from the same county records. The 8% human-error rate
  is mathematically defensible regardless of county data quality.
- **Full pipeline analysis**: Uses comparable sales, user photos, and our own
  measurements — independent evidence that does NOT depend on the county's numbers.
- **User photos + measurements**: This is OUR proprietary data. As it compounds
  over time, it becomes our strongest independent data source. It must always be
  treated as higher-trust than county or ATTOM assessment data.
- **Calibration system**: Learns from real outcomes to improve accuracy over time.
  This is the feedback loop that makes our data increasingly independent from
  county sources.

## Payment & Messaging Rules — CRITICAL
- ALL payments happen BEFORE the valuation is shown. No exceptions.
- Never use the word "free" anywhere in user-facing copy. Use "run the numbers"
  or similar. Saying "free" then charging is a trust violation.
- Tax bill uploaders get 15% off (TAX_BILL_DISCOUNT in config/pricing.ts).
- Tax bill uploaders skip redundant ATTOM assessment lookups (we already have
  their assessed value). ATTOM is still called for building details and comps.
- The post-payment optimistic result is a teaser, not the real analysis.
  The real numbers come from the full pipeline with comparable sales.

## What NOT To Do
- Never skip Stage 8 auto-delivery (if delivery fails, fall back to pending_approval)
- Never hardcode county-specific logic in application code
- Never hardcode AI model names anywhere except config/ai.ts
- Never use NEXT_PUBLIC_ prefix on service role keys or secret keys
- Never use ATTOM marketValue as ground truth for valuations or comparisons
- Never trust county assessment data as accurate — always verify independently
- Never say "free" in any user-facing text
- Never bypass Stripe webhook as pipeline trigger — it is the only entry point
- Never expose the service role Supabase client to client-side code
