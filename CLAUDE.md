# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis, public property data APIs, and owner-provided photographs. Reports are auto-delivered to clients after pipeline completion.

## Delivery Model
Reports are automatically delivered to clients after the pipeline completes all stages (1-8). Stage 8 sends the PDF and filing guide via email. If auto-delivery fails, the report falls back to status = 'pending_approval' for admin manual delivery. Admin can still review, reject, or re-run reports via the admin dashboard.

## Nationwide Architecture Rule
This platform serves every county in every state. ATTOM is the universal data source that covers the entire country. No county-specific logic is hardcoded in application code. All county-specific behavior comes from the county_rules database table: assessment ratios, appeal board names, filing deadlines, form names, hearing formats. The data-router supports future county-specific API adapters via county_rules.assessor_api_url, but none are required — ATTOM handles everything.

## Tech Stack
- Next.js 14 App Router (14.2.x), TypeScript strict mode, React 18
- Supabase (Postgres, Storage, Auth) — RLS on every table
- Anthropic AI API (`@anthropic-ai/sdk`) — model names are env-var constants, never hardcoded
- ATTOM Data API for property data
- Google Maps, Geocoding, Places, Street View, Static Maps APIs
- Stripe for payments (`stripe` + `@stripe/react-stripe-js`), Resend for email
- @sparticuz/chromium + puppeteer-core for PDF generation
- Zod for input validation
- Tailwind CSS 3.4 for styling, lucide-react for icons
- Deployed on Vercel

## Key Conventions
- All AI model identifiers: `AI_MODELS.PRIMARY` and `AI_MODELS.FAST` from `src/config/ai.ts`
- All database queries: typed repository functions in `src/lib/repository/`
- All external API calls: typed service modules in `src/lib/services/`
- All prices: `PRICING` constants from `src/config/pricing.ts`
- All env vars: documented in `.env.example`, never hardcoded
- Input validation: Zod schemas in `src/lib/validations/`
- Rate limiting: distributed via Supabase RPC in `src/lib/rate-limit.ts`

## Commands
- `pnpm dev` — start development server
- `pnpm build` — production build
- `pnpm lint` — ESLint check
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

## Project Structure

```
src/
├── config/
│   ├── ai.ts                  # AI model constants (AI_MODELS, AI_TOKEN_LIMITS)
│   └── pricing.ts             # Pricing tiers, tax bill discount, price calculation
├── lib/
│   ├── services/              # External API integrations
│   │   ├── anthropic.ts       # Claude API: narratives, photo analysis, filing guides
│   │   ├── attom.ts           # ATTOM: property details, comps, deeds (universal)
│   │   ├── data-router.ts     # Routes data requests: ATTOM + optional county adapters
│   │   ├── stripe-service.ts  # PaymentIntent creation, webhook verification
│   │   ├── resend-email.ts    # Report delivery & admin notification emails
│   │   ├── google-maps.ts     # Geocoding, Street View, static maps
│   │   ├── fema.ts            # Flood zone lookups (NFHL/ArcGIS)
│   │   └── pdf.ts             # HTML-to-PDF via Puppeteer (serverless-compatible)
│   ├── repository/            # Typed data access layer (no raw SQL in components)
│   │   ├── reports.ts         # Report CRUD, joins with all related tables
│   │   ├── county-rules.ts    # County rules by FIPS code (PK: county_fips)
│   │   └── admin.ts           # Admin dashboard queries
│   ├── pipeline/
│   │   ├── orchestrator.ts    # Sequential 8-stage coordinator, resumable
│   │   └── stages/
│   │       ├── stage1-data-collection.ts   # Geocode, county ID, FEMA flood zone
│   │       ├── stage2-comparables.ts       # Sale comps with progressive radius
│   │       ├── stage3-income-analysis.ts   # NOI/cap rate (commercial only)
│   │       ├── stage4-photo-analysis.ts    # Claude vision analysis of user photos
│   │       ├── stage5-narratives.ts        # AI-generated report sections (16+)
│   │       ├── stage6-filing-guide.ts      # County-specific appeal instructions
│   │       ├── stage7-pdf-assembly.ts      # HTML template → PDF via Puppeteer
│   │       └── stage8-delivery.ts          # Email delivery (admin-triggered)
│   ├── calibration/           # Prediction vs actual outcome feedback loop
│   ├── templates/             # HTML report template and helpers
│   ├── supabase/              # Client initialization (admin, server, client)
│   ├── validations/           # Zod schemas for input validation
│   └── rate-limit.ts          # Distributed rate limiting via Supabase RPC
├── middleware.ts              # Auth guards: /admin, /dashboard require auth; /start is public
├── types/
│   └── database.ts            # Supabase-generated TypeScript types
├── components/
│   ├── admin/                 # ApprovalAuditTrail, QualityFlags, RejectModal, StatusBadge
│   ├── dashboard/             # PipelineProgress, ReportDownload
│   ├── intake/                # AddressInput, PhotoUploader, WizardLayout, etc.
│   ├── landing/               # Hero, HowItWorks, FAQ, Footer, ServiceCards
│   ├── seo/                   # JsonLd structured data
│   └── ui/                    # Badge, Button, Card, Input, Modal
└── app/
    ├── api/
    │   ├── reports/           # POST create, GET by ID
    │   │   └── [id]/          # photos, measurements, assessment, tax-bill-data,
    │   │                      # valuation, filing-info, viewer
    │   ├── admin/
    │   │   ├── reports/       # Queue management
    │   │   │   └── [id]/      # approve, reject, regenerate, rerun
    │   │   └── calibration/   # run, import, recalculate, stats, complete
    │   ├── valuation/         # Public pre-payment valuation endpoint
    │   └── webhooks/stripe/   # Payment confirmation → triggers pipeline
    ├── start/                 # Intake wizard (public, no auth)
    │   ├── situation/         # Service type selection
    │   ├── property/          # Address and property details
    │   ├── photos/            # Multi-upload with photo type enum
    │   ├── measure/           # Optional building dimensions
    │   ├── payment/           # Stripe Elements, order summary, tier selection
    │   └── success/           # Optimistic valuation preview
    ├── dashboard/             # User's active/past reports
    ├── admin/                 # Admin dashboard
    │   ├── reports/           # Queue (pending, all, delivered, rejected, failed)
    │   │   └── [id]/review/   # Individual report review
    │   ├── counties/          # County rules management
    │   │   └── [fips]/edit/   # Edit county-specific rules
    │   ├── calibration/       # Calibration metrics
    │   ├── tax-bill-data/     # Tax bill audit
    │   └── metrics/           # System metrics
    ├── report/[id]/           # Report viewer
    ├── login/                 # Auth pages
    ├── signup/
    ├── disclaimer/            # Legal pages
    ├── privacy/
    └── terms/
```

## Pipeline Architecture (8 Stages)
Stages 1-7 run automatically after payment (triggered by Stripe webhook). Stage 8 is admin-triggered.

| Stage | Name | Description | Conditional? |
|-------|------|-------------|--------------|
| 1 | Data Collection | Geocode address, identify county (FIPS), query FEMA flood zone | Always |
| 2 | Comparables | Progressive-radius comp search, adjustments, Street View | Always |
| 3 | Income Analysis | NOI and cap rate valuation | Commercial/industrial only |
| 4 | Photo Analysis | Claude vision analysis of uploaded photos | Always |
| 5 | Narratives | AI-generated 16+ report sections with calibration | Always |
| 6 | Filing Guide | County-specific appeal filing instructions | Tax appeal only |
| 7 | PDF Assembly | HTML template rendered to PDF via Puppeteer | Always |
| 8 | Delivery | Email report + filing guide to client | Admin-triggered |

Pipeline is resumable — tracks `pipeline_last_completed_stage` per report. Errors logged to `pipeline_error_log` (JSONB).

## Database Schema (Key Tables)
- **reports**: Main entity. Statuses: intake → paid → data_pull → photo_pending → processing → pending_approval → approved → delivered | rejected | failed
- **property_data**: One-to-one with reports. Assessment, building, lot, zoning, flood zone data
- **photos**: Multi-upload per report. 26 photo_type enum values. AI analysis stored as JSONB
- **comparable_sales**: 3-10 comps per report with 11 adjustment categories
- **comparable_rentals**: For income approach analysis
- **income_analysis**: NOI, cap rate, concluded value
- **report_narratives**: 16+ sections with model/token metadata
- **county_rules**: PK is `county_fips` (not id). All county-specific behavior lives here
- **calibration_entries / calibration_params**: Prediction accuracy feedback loop
- **measurements**: Building dimensions from multiple sources with discrepancy detection

Migrations in `supabase/migrations/` (001 through 008).

## Report Statuses Flow
```
intake → paid → data_pull → photo_pending → processing → pending_approval → approved → delivered
                                                       ↘ rejected
                                                       ↘ failed
```

## Authentication & Authorization
- Supabase Auth with RLS on every table
- Middleware guards `/admin` and `/dashboard` (redirect to `/login`)
- `/start` intake wizard is public (email-only, no account required until payment)
- Service role key used for admin/pipeline operations (server-side only)

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
- Two pricing tiers: Auto ($49-$99) and Expert-reviewed ($149-$249).

## Environment Variables
All documented in `.env.example`. Key groups:
- **AI**: `ANTHROPIC_API_KEY`, `AI_MODEL_PRIMARY`, `AI_MODEL_FAST`
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Google**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser), `GOOGLE_MAPS_SERVER_KEY` (server)
- **ATTOM**: `ATTOM_API_KEY`
- **Stripe**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Resend**: `RESEND_API_KEY`, `FROM_EMAIL_ADDRESS`, `ADMIN_EMAIL`

Only `NEXT_PUBLIC_` vars are safe for browser. Never prefix secrets with `NEXT_PUBLIC_`.

## What NOT To Do
- Never skip Stage 8 auto-delivery (if delivery fails, fall back to pending_approval)
- Never hardcode county-specific logic in application code
- Never hardcode AI model names anywhere except config/ai.ts
- Never use NEXT_PUBLIC_ prefix on service role keys or secret keys
- Never use ATTOM marketValue as ground truth for valuations or comparisons
- Never trust county assessment data as accurate — always verify independently
- Never say "free" in any user-facing text
- Never write raw SQL in components — use repository functions
- Never call external APIs directly — use service modules in lib/services/
- Never bypass the data-router for property data — it handles ATTOM + county adapter routing
