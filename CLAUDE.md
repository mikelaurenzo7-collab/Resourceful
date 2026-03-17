# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis, public property data APIs, and owner-provided photographs. Reports are auto-delivered to clients after pipeline completion.

## Delivery Model
Reports are automatically delivered to clients after the pipeline completes all stages (1-8). Stage 8 sends the PDF and filing guide via email. If auto-delivery fails, the report falls back to status = 'pending_approval' for admin manual delivery. Admin can still review, reject, or re-run reports via the admin dashboard.

## Nationwide Architecture Rule
This platform serves every county in every state. ATTOM is the universal data source that covers the entire country. No county-specific logic is hardcoded in application code. All county-specific behavior comes from the county_rules database table: assessment ratios, appeal board names, filing deadlines, form names, hearing formats. The data-router supports future county-specific API adapters via county_rules.assessor_api_url, but none are required — ATTOM handles everything.

## Tech Stack
- Next.js 14.2 App Router, TypeScript strict mode
- Supabase (Postgres, Storage, Auth) — RLS on every table
- Anthropic AI API (model names are env-var constants — never hardcoded)
- ATTOM Data API for property data
- Google Maps, Geocoding, Places, Street View, Static Maps APIs
- Stripe for payments, Resend for email
- @sparticuz/chromium + puppeteer-core for PDF generation
- Zod for runtime validation
- Tailwind CSS + lucide-react icons
- Deployed on Vercel

## Commands
- `pnpm dev` — start development server
- `pnpm build` — production build
- `pnpm lint` — ESLint check
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

Note: No test framework is configured (no Jest/Vitest).

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   ├── start/                    # Multi-step intake wizard
│   │   ├── property/             # Address & property type
│   │   ├── situation/            # Service type & issues
│   │   ├── photos/               # Photo upload
│   │   ├── measure/              # Square footage tool
│   │   ├── payment/              # Stripe checkout
│   │   └── success/              # Confirmation
│   ├── dashboard/                # User report history (auth required)
│   ├── report/[id]/              # Report viewer
│   ├── admin/                    # Admin panel (super-admin only)
│   │   ├── reports/              # Pending approval queue
│   │   ├── counties/[fips]/edit/ # County rule editor
│   │   ├── calibration/          # Accuracy metrics
│   │   ├── metrics/              # Revenue & error tracking
│   │   └── tax-bill-data/        # Tax bill submissions
│   ├── login/, signup/           # Auth pages
│   ├── disclaimer/, privacy/, terms/  # Legal pages
│   └── api/                      # API routes
│       ├── reports/              # CRUD + sub-resources
│       ├── valuation/            # Quick estimate (rate-limited)
│       ├── admin/                # Admin actions
│       └── webhooks/stripe/      # Payment webhook (300s timeout)
├── components/
│   ├── ui/                       # Primitives (Button, Input, Card, Modal)
│   ├── landing/                  # Homepage (Hero, ServiceCards, FAQ)
│   ├── intake/                   # Wizard components
│   │   ├── WizardLayout.tsx      # Multi-step form shell
│   │   ├── AddressInput.tsx      # Google Places autocomplete
│   │   ├── PhotoUploader.tsx     # Drag-drop upload + classification
│   │   └── MeasurementTool.tsx   # Manual/Google Earth sq ft input
│   ├── dashboard/                # PipelineProgress, ReportDownload
│   ├── admin/                    # ApprovalAuditTrail, QualityFlags
│   └── seo/                      # JSON-LD structured data
├── config/
│   ├── ai.ts                     # AI_MODELS.PRIMARY, AI_MODELS.FAST, token limits
│   └── pricing.ts                # PRICING, PRICING_EXPERT, TAX_BILL_DISCOUNT
├── lib/
│   ├── services/                 # External API integrations
│   │   ├── anthropic.ts          # Claude API (narratives, vision, filing guides)
│   │   ├── attom.ts              # Property data (details, comps, deeds)
│   │   ├── data-router.ts        # Nationwide routing (ATTOM + county adapters)
│   │   ├── google-maps.ts        # Geocoding, static maps
│   │   ├── fema.ts               # Flood zone lookup
│   │   ├── pdf.ts                # HTML→PDF via puppeteer
│   │   ├── resend-email.ts       # Email delivery (report, admin, rejection)
│   │   └── stripe-service.ts     # Payment intents
│   ├── repository/               # Typed database access
│   │   ├── reports.ts            # Report CRUD & queries
│   │   ├── county-rules.ts       # County lookup & upsert
│   │   └── admin.ts              # Approval events & audit trail
│   ├── pipeline/                 # 8-stage report generation
│   │   ├── orchestrator.ts       # Sequential stage runner with lock
│   │   └── stages/
│   │       ├── stage1-data-collection.ts   # Geocode, ATTOM, FEMA, county rules
│   │       ├── stage2-comparables.ts       # Find & score comparable sales
│   │       ├── stage3-income-analysis.ts   # Rent capitalization (commercial)
│   │       ├── stage4-photo-analysis.ts    # Claude vision on uploaded photos
│   │       ├── stage5-narratives.ts        # AI-generated report sections
│   │       ├── stage6-filing-guide.ts      # County-specific appeal instructions
│   │       ├── stage7-pdf-assembly.ts      # Markdown→HTML→PDF
│   │       └── stage8-delivery.ts          # Email PDF; fallback pending_approval
│   ├── calibration/              # Accuracy feedback loop
│   ├── templates/                # HTML report template + formatting helpers
│   ├── supabase/                 # DB client factories
│   │   ├── client.ts             # Browser client (anon key, RLS)
│   │   ├── server.ts             # SSR client (anon key + cookies)
│   │   ├── admin.ts              # Service role client (bypasses RLS)
│   │   └── middleware.ts         # Auth session refresh
│   ├── validations/              # Zod schemas (report, measurements, photos)
│   └── rate-limit.ts             # Postgres-backed distributed rate limiting
├── types/
│   └── database.ts               # Supabase-generated TypeScript types
└── middleware.ts                  # Auth guard for /admin, /dashboard
```

```
supabase/migrations/
├── 001_initial_schema.sql        # Core tables, RLS policies
├── 002_scalability.sql           # Indexes, rate_limit_entries table
├── 003_email_only_intake.sql     # Allow email-based report creation
├── 004_county_filing_details.sql # Appeal board, deadlines, hearing formats
├── 005_calibration.sql           # Predicted vs actual tracking
├── 006_review_tiers.sql          # Auto vs expert-reviewed pricing
├── 007_tax_bill_fields.sql       # Tax bill upload + 15% discount
└── 008_photo_value_attribution.sql # Photo impact on valuation
```

## Key Conventions
- All AI model identifiers: `AI_MODELS.PRIMARY` and `AI_MODELS.FAST` from `config/ai.ts`
- All database queries: typed repository functions in `lib/repository/`
- All external API calls: typed service modules in `lib/services/`
- All prices: `PRICING` constants from `config/pricing.ts`
- All env vars: documented in `.env.example`, never hardcoded
- Path alias: `@/*` maps to `./src/*` (use `@/lib/...`, `@/components/...`, etc.)
- Supabase clients: use `client.ts` in browser, `server.ts` in SSR, `admin.ts` for service-role operations
- Rate limiting: Postgres-backed via `increment_rate_limit()` RPC — works across serverless instances
- Validation: Zod schemas in `lib/validations/` for all user input

## Architecture Patterns

### API Routes
1. Rate limit check
2. Validate input with Zod
3. Call service layer (anthropic, attom, etc.)
4. Use repository for DB access
5. Return typed JSON response
6. Catch errors → 500 response

### Pipeline (Orchestrator)
1. Acquire pipeline lock (prevent concurrent runs on same report)
2. Resume from `pipeline_last_completed_stage` on retry
3. Run stages 1–8 sequentially; skip stages by property/service type
4. Each stage: fetch → process → store in DB
5. On error: log to `pipeline_error_log`, set status = 'failed'
6. Stage 8 success: report delivered via email
7. Stage 8 failure: fallback to status = 'pending_approval'

### Report Status Lifecycle
```
intake → paid → data_pull → photo_pending → processing →
pending_approval → approved → delivered
(any stage can → failed or rejected)
```

### Database Access
- Repository pattern: each table has typed CRUD + common queries
- All repos use admin client (service role) to bypass RLS
- RLS enforced for browser/SSR clients — users see only their own data

### Nationwide Data Strategy
1. ATTOM (universal) — covers every county in the US
2. County API (optional) — override via `county_rules.assessor_api_url`
3. No county-specific logic hardcoded in application code
4. All county rules stored in database `county_rules` table
5. `data-router.ts` extensible adapter pattern for future county APIs

## Security
- RLS on every Supabase table
- Middleware auth guard on `/admin` and `/dashboard` routes
- `SUPABASE_SERVICE_ROLE_KEY` never exposed with `NEXT_PUBLIC_` prefix
- Security headers: X-Frame-Options DENY, HSTS preload, nosniff, strict referrer
- Distributed rate limiting on report creation and valuation (10 req/15 min)
- Stripe webhook signature verification

## Environment Variables
See `.env.example` for the full list. Key groups:
- **AI**: `ANTHROPIC_API_KEY`, `AI_MODEL_PRIMARY`, `AI_MODEL_FAST`
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Google**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser), `GOOGLE_MAPS_SERVER_KEY` (server)
- **ATTOM**: `ATTOM_API_KEY`
- **Stripe**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `ADMIN_NOTIFICATION_EMAIL`

Rule: `NEXT_PUBLIC_` = browser-visible. Never use on secrets.

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
