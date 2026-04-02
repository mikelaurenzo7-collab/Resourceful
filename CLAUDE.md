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
- Vitest for testing, Zod for validation
- Tailwind CSS for styling, Lucide React for icons
- Deployed on Vercel

## Project Structure
```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── start/              # Intake wizard (property → situation → photos → measure → payment → success)
│   ├── dashboard/          # Authenticated user dashboard
│   ├── report/[id]/        # Dynamic report view & download
│   ├── admin/              # Admin panel (reports, counties, partners, outcomes, metrics)
│   ├── appeal/[slug]/      # Appeal type-specific info pages
│   ├── api/                # API routes (see API Routes below)
│   ├── login/ signup/      # Auth pages
│   └── (legal pages)       # disclaimer, privacy, terms
├── components/
│   ├── ui/                 # Design system (Button, Card, Input, Badge, Modal)
│   ├── landing/            # Homepage (Hero, HowItWorks, ServiceCards, FAQ, Footer)
│   ├── intake/             # Wizard forms (AddressInput, PhotoUploader, MeasurementTool)
│   ├── dashboard/          # User dashboard (PipelineProgress, ReportDownload)
│   ├── admin/              # Admin UI (RejectModal, ApprovalAuditTrail, QualityFlags)
│   └── seo/                # SEO helpers (JsonLd)
├── config/
│   ├── ai.ts               # AI_MODELS.PRIMARY, AI_MODELS.FAST, token limits
│   ├── pricing.ts          # 4-tier pricing + TAX_BILL_DISCOUNT
│   ├── founders.ts         # Founder email bypass for free access
│   └── valuation.ts        # Valuation methodology constants
├── hooks/                  # Custom React hooks (useScrollAnimation)
├── lib/
│   ├── pipeline/           # 8-stage report generation orchestrator
│   │   ├── orchestrator.ts # Main pipeline runner
│   │   └── stages/         # stage1.ts through stage8.ts
│   ├── services/           # External API integrations (see Services below)
│   ├── repository/         # Data access layer (Supabase typed queries)
│   │   ├── reports.ts      # Report CRUD + joins
│   │   ├── admin.ts        # Admin operations
│   │   └── county-rules.ts # County configuration queries
│   ├── supabase/           # Supabase client setup (server, admin, client, middleware)
│   ├── templates/          # Report HTML/Markdown template generation
│   ├── validations/        # Zod schemas for all user inputs
│   ├── utils/              # Helpers (semaphore, retry, county-slug, deadline-calculator)
│   └── rate-limit.ts       # IP-based rate limiting
├── middleware.ts            # Auth + route protection (/admin, /dashboard)
└── types/
    └── database.ts          # Auto-generated Supabase TypeScript types
```

### Pipeline Stages (lib/pipeline/stages/)
1. **Data collection** — property data, ATTOM lookups, assessments
2. **Comparable sales analysis** — find and analyze comparable properties
3. **Income analysis** — commercial/industrial properties only
4. **Photo analysis** — AI vision analysis of user-uploaded photos
5. **Narrative generation** — AI-written report narratives
6. **Filing guide generation** — county-specific appeal filing instructions
7. **PDF assembly** — puppeteer-core renders HTML to PDF
8. **Email delivery** — sends PDF + filing guide to client via Resend

### Services (lib/services/)
- `anthropic.ts` — Claude AI (narratives, photo analysis, filing strategies)
- `attom.ts` — ATTOM property data API
- `google-maps.ts` — Maps, Geocoding, Places, Street View
- `stripe-service.ts` — Payment processing
- `resend-email.ts` — Transactional email
- `data-router.ts` — Routes requests to appropriate data sources
- `public-records.ts` — County public records
- `filing-service.ts` / `filing-intelligence.ts` — Appeal filing logic
- `photo-intelligence.ts` — Photo valuation analysis
- `research-agent.ts` — County research via Claude
- `county-enrichment.ts` — County-specific data enrichment
- `fema.ts` — FEMA flood zone data
- `partner-api-service.ts` / `referral-service.ts` — Partners & referrals

### API Routes (src/app/api/)
- `reports/` — Report CRUD, photos, measurements, assessments, valuations
- `v1/reports/` — Public API for external integrations
- `admin/reports/[id]/` — Approve, reject, regenerate, rerun pipeline
- `cron/reminders/` — Monthly reminder emails (1st of month, 9am UTC)
- `cron/cleanup/` — Daily data cleanup (3am UTC)
- `webhooks/stripe/` — Stripe payment webhook (300s timeout)
- `health/` — Health check endpoint
- `valuation/` — Quick valuation endpoint
- `referral/` — Referral tracking

## Key Conventions
- All AI model identifiers: AI_MODELS.PRIMARY and AI_MODELS.FAST from config/ai.ts
- All database queries: typed repository functions in lib/repository/
- All external API calls: typed service modules in lib/services/
- All prices: PRICING constants from config/pricing.ts
- All env vars: documented in .env.example, never hardcoded
- All input validation: Zod schemas in lib/validations/
- Path alias: `@/*` maps to `./src/*`
- Email-only identification — no Supabase auth accounts; users identified by email
- Founder emails in FOUNDER_EMAILS env var get free access (config/founders.ts)

## Commands
- `pnpm dev` — start development server
- `pnpm build` — production build
- `pnpm lint` — ESLint check
- `pnpm test` — run tests (Vitest, single run)
- `pnpm test:watch` — run tests in watch mode
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

## Testing
Tests use Vitest (Node environment) with globals enabled. Test files:
- `src/config/pricing.test.ts` — pricing logic
- `src/lib/services/data-router.test.ts` — data routing
- `src/lib/pipeline/orchestrator.test.ts` — pipeline orchestration
- `src/lib/templates/helpers.test.ts` — template helpers
- `src/lib/validations/report.test.ts` — Zod schema validation

Config: `vitest.config.ts` at project root.

## Database
Supabase Postgres with 16 migrations in `supabase/migrations/`. Key tables:
- `users`, `reports`, `property_data`, `photos`, `comparable_sales`
- `income_analysis`, `report_narratives`, `measurements`
- `county_rules` — all county-specific configuration
- RLS enabled on every table; admin client (`lib/supabase/admin.ts`) uses service role key to bypass RLS for pipeline/background jobs

Seed data: `supabase/seed.sql` + scripts in `scripts/` for county seeding.

## Deployment
Vercel with auto-deploy from git. Key config in `vercel.json`:
- Stripe webhook: 300s function timeout
- Cron jobs: 120s timeout each
- Security headers configured in `next.config.mjs` (CSP, HSTS, X-Frame-Options)

Environment variables: 25+ vars across AI, Supabase, Google, ATTOM, Stripe, Resend, and app config. All documented in `.env.example`. Only `NEXT_PUBLIC_*` vars are browser-safe.

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
