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
- Zod for runtime validation schemas
- Tailwind CSS with custom design tokens
- Deployed on Vercel

## Project Structure
```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── page.tsx            # Landing page
│   ├── layout.tsx          # Root layout (metadata, fonts, analytics)
│   ├── middleware.ts        # → see src/middleware.ts
│   ├── start/              # Intake wizard (public, no auth required)
│   │   ├── property/       # Address input
│   │   ├── situation/      # User situation/issues
│   │   ├── measure/        # Building measurement tool
│   │   ├── photos/         # Photo uploader
│   │   ├── payment/        # Stripe payment form
│   │   └── success/        # Post-payment confirmation
│   ├── dashboard/          # User report list (auth required)
│   ├── report/[id]/        # Report viewer + PDF download (auth required)
│   ├── admin/              # Admin dashboard (auth + admin role required)
│   │   ├── reports/        # Report list + review
│   │   ├── counties/       # County rules management
│   │   ├── metrics/        # System analytics
│   │   ├── calibration/    # Accuracy calibration
│   │   └── tax-bill-data/  # Tax bill data import
│   ├── api/                # API routes
│   │   ├── valuation/      # Pre-payment blind estimate
│   │   ├── reports/[id]/   # Report CRUD + sub-resources
│   │   ├── admin/          # Admin actions (approve, reject, rerun, calibration)
│   │   └── webhooks/stripe # Stripe payment webhook (300s timeout)
│   ├── login/              # Auth pages
│   ├── signup/
│   ├── disclaimer/         # Legal pages
│   ├── privacy/
│   └── terms/
├── lib/
│   ├── pipeline/           # 8-stage report generation engine
│   │   ├── orchestrator.ts # Pipeline controller (locking, stage sequencing, error recovery)
│   │   └── stages/         # Individual pipeline stages (see Pipeline section)
│   ├── services/           # External API integrations
│   │   ├── anthropic.ts    # Claude AI (narratives, vision, filing guides)
│   │   ├── attom.ts        # Property data (sales, rentals, details)
│   │   ├── data-router.ts  # Data source orchestration (ATTOM + county adapters)
│   │   ├── google-maps.ts  # Geocoding, Street View, static maps
│   │   ├── fema.ts         # Flood zone queries
│   │   ├── pdf.ts          # PDF generation (Puppeteer + Chromium)
│   │   ├── resend-email.ts # Email delivery (reports, admin alerts, errors)
│   │   └── stripe-service.ts # Payment processing
│   ├── repository/         # Database access layer (typed Supabase queries)
│   │   ├── reports.ts      # Report CRUD + joined queries
│   │   ├── county-rules.ts # County metadata lookups
│   │   └── admin.ts        # Admin user queries
│   ├── supabase/           # Supabase client factories
│   │   ├── admin.ts        # Service role client (server-only)
│   │   ├── server.ts       # Server-side client (per-request)
│   │   ├── client.ts       # Browser client
│   │   └── middleware.ts    # Session refresh for middleware
│   ├── calibration/        # Accuracy tracking & improvement
│   │   ├── recalculate.ts  # Recalculate error rates from outcomes
│   │   └── run-blind-valuation.ts # Pre-payment statistical estimate
│   ├── templates/
│   │   ├── report-template.ts # Full PDF HTML template (54 KB)
│   │   └── helpers.ts      # Template utilities
│   ├── validations/
│   │   └── report.ts       # Zod schemas for report data
│   └── rate-limit.ts       # API rate limiting
├── components/
│   ├── admin/              # Admin review UI (audit trail, quality flags, status badges)
│   ├── dashboard/          # User dashboard (pipeline progress, report download)
│   ├── intake/             # Wizard components (address input, photo uploader, measurement tool)
│   ├── landing/            # Marketing (hero, FAQ, service cards, footer)
│   ├── seo/                # Structured data (JSON-LD)
│   └── ui/                 # Design system (Button, Card, Modal, Input, Badge)
├── config/
│   ├── ai.ts               # AI_MODELS.PRIMARY, AI_MODELS.FAST, AI_TOKEN_LIMITS
│   └── pricing.ts          # PRICING, PRICING_EXPERT, TAX_BILL_DISCOUNT, getPriceForReport()
├── types/
│   └── database.ts         # All TypeScript types, enums, and table interfaces
└── middleware.ts            # Route protection (auth redirect for /admin, /dashboard)

supabase/
└── migrations/             # 8 migration files (001–008)
    ├── 001_initial_schema.sql    # Core tables, enums, RLS policies
    ├── 002_scalability.sql       # Performance indexes
    ├── 003_email_only_intake.sql # Client email field
    ├── 004_county_filing_details.sql # County filing rules
    ├── 005_calibration.sql       # Calibration tracking
    ├── 006_review_tiers.sql      # Expert review tier
    ├── 007_tax_bill_fields.sql   # Tax bill data fields
    └── 008_photo_value_attribution.sql # Photo impact tracking

scripts/
└── seed-counties.ts        # County rules seeder
```

## Key Conventions
- All AI model identifiers: AI_MODELS.PRIMARY and AI_MODELS.FAST from config/ai.ts
- All database queries: typed repository functions in lib/repository/
- All external API calls: typed service modules in lib/services/
- All prices: PRICING constants from config/pricing.ts
- All env vars: documented in .env.example, never hardcoded
- Path alias: `@/*` maps to `./src/*` (configured in tsconfig.json)
- All components use Tailwind CSS with the custom design tokens defined in tailwind.config.ts

## Commands
- `pnpm dev` — start development server
- `pnpm build` — production build
- `pnpm lint` — ESLint check
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

## Pipeline Architecture
The report generation pipeline runs 8 sequential stages via `lib/pipeline/orchestrator.ts`:

| Stage | File | Purpose |
|-------|------|---------|
| 1 | stage1-data-collection.ts | Collect property data (ATTOM + geocoding + FEMA flood zones) |
| 2 | stage2-comparables.ts | Find and analyze comparable sales |
| 3 | stage3-income-analysis.ts | Income approach analysis (commercial/industrial only, skipped otherwise) |
| 4 | stage4-photo-analysis.ts | AI vision analysis of user-uploaded photos |
| 5 | stage5-narratives.ts | Generate report narrative sections (Claude AI) |
| 6 | stage6-filing-guide.ts | Generate county-specific filing instructions (Claude AI) |
| 7 | stage7-pdf-assembly.ts | Render HTML template to PDF (Puppeteer) |
| 8 | stage8-delivery.ts | Email report + filing guide to client (Resend) |

Key behaviors:
- Pipeline acquires a lock to prevent concurrent runs on the same report
- Supports resuming from the last completed stage on error
- Stage 3 is skipped for residential/land properties
- Stage 8 auto-delivers; falls back to `pending_approval` if delivery fails
- Admin can rerun the pipeline from any stage N

## Data Flow
```
User Intake Form (/start/*) → Create Report (status: intake)
    → Stripe Payment (webhook) → status: paid
    → Pipeline Trigger (orchestrator.ts)
    → [Stages 1–8] → status: approved → delivered
    → (If delivery fails → status: pending_approval for admin review)
```

## Report Status Lifecycle
`intake` → `paid` → `data_pull` → `photo_pending` → `processing` → `pending_approval` → `approved` → `delivered`

Error states: `rejected`, `failed`

## Type System
All types are in `src/types/database.ts`. Key types:
- **Enums**: ReportStatus, ServiceType (tax_appeal | pre_purchase | pre_listing), PropertyType (residential | commercial | industrial | land), PhotoType (28 specific photo categories)
- **Core tables**: Report, PropertyData, Measurement, Photo, ComparableSale, ComparableRental, IncomeAnalysis, ReportNarrative, CountyRule, CalibrationEntry, CalibrationParams
- **Admin types**: AdminUser, ApprovalEvent, ApprovalAction, ReviewTier

## Authentication & Middleware
- `src/middleware.ts` protects `/admin` and `/dashboard` routes — unauthenticated users are redirected to `/login`
- The `/start` intake wizard is public (no auth required)
- Admin routes require both authentication and an entry in the `admin_users` table
- Supabase RLS enforces row-level access: users can only see their own reports

## Database
- All tables have RLS (Row Level Security) enabled — no exceptions
- Schema is defined across 8 migration files in `supabase/migrations/`
- Key indexes: `idx_reports_user_id`, `idx_reports_status`, `idx_reports_county_fips`
- County-specific metadata is stored in the `county_rules` table (assessment ratios, appeal board names, filing deadlines, form names, hearing formats)

## Design System
- **Colors**: Navy primary (#1a2744), Gold accent (#d4a847), Cream background (#f5f0e8)
- **Typography**: Playfair Display (display/headings), Inter (body/sans)
- **Custom animations**: fade-in, slide-up (600ms)
- **Custom shadows**: gold, gold-lg, premium
- All defined in `tailwind.config.ts`

## Environment Variables
All documented in `.env.example`. Key groups:
- **AI**: ANTHROPIC_API_KEY, AI_MODEL_PRIMARY, AI_MODEL_FAST
- **Supabase**: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- **Google**: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser), GOOGLE_MAPS_SERVER_KEY (server)
- **ATTOM**: ATTOM_API_KEY
- **Stripe**: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- **Email**: RESEND_API_KEY, RESEND_FROM_ADDRESS, ADMIN_NOTIFICATION_EMAIL
- **App**: NEXT_PUBLIC_APP_URL, NODE_ENV

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
- Never bypass RLS — every table must have row-level security policies
- Never import from lib/supabase/admin.ts in client-side code
