# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis, public property data APIs, and owner-provided photographs. All reports are routed to admin for quality review before delivery.

## Business Model — Pay-After (Submit Free, Pay to Unlock)
Users submit property info for free. The pipeline runs on the platform's schedule (admin-triggered). Admin reviews every report before notifying the client. Clients receive a "report ready" email with a savings teaser. They visit `/report/[id]`, see the summary (assessed value, concluded value, potential savings), and pay to unlock the full PDF + filing guide.

### Status Flow
```
submitted → processing → pending_approval → approved → delivered
                └→ failed                    └→ rejected
```
- `submitted`: User completed intake, no payment yet
- `processing`: Pipeline stages running
- `pending_approval`: Pipeline complete, awaiting admin review
- `approved`: Admin approved, "report ready" email sent, awaiting client payment
- `delivered`: Client paid, full report access unlocked

### Admin Approval Required
ALL reports are routed to admin for quality review after the pipeline completes stages 1-7. Admin can review, approve, reject, re-run, or manually adjust valuations. Approval triggers a "report ready" email — NOT direct delivery. The client must pay at `/report/[id]` to unlock full access. The Stripe webhook handler transitions `approved → delivered`.

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
- `npm run dev` — start development server
- `npm run build` — production build
- `npm run lint` — ESLint check
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

## User Intake Model — Email-Only (No Accounts)
Users do NOT create accounts. The intake flow collects an email address, not auth credentials. Reports are identified by UUID and `client_email`. The user-facing flow is:
1. Intake wizard (service type → address → situation → photos) → submit (email + review tier, NO PAYMENT) → confirmation page
2. Admin triggers pipeline → stages run → admin reviews → approves
3. Client receives "report ready" email with savings teaser → visits `/report/[id]`
4. Client sees summary + paywall → pays via Stripe → full report unlocked

The `/dashboard` page requires Supabase Auth login and queries `user_id`, but email-only users have `user_id = null`. The dashboard is currently non-functional for email-only users — clients use the emailed report link instead.

## Admin Setup
1. Create a user in Supabase Auth (email + password)
2. Insert into `admin_users` table: `(user_id, email, name, is_super_admin) = (auth-user-uuid, 'your@email', 'Name', true)`
3. Log in at `/login`, then navigate to `/admin`

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
The orchestrator (`lib/pipeline/orchestrator.ts`) runs stages 1-7 sequentially with stage locking to prevent concurrent execution, then routes to admin for approval. Stage 8 (delivery) is admin-triggered only. Stages can be skipped by property/service type. Errors are recorded in `pipeline_error_log` JSONB.

| Stage | File | Purpose |
|-------|------|---------|
| 1 | stage-1-data.ts | Geocoding, ATTOM property detail, FEMA flood zones, county rules |
| 2 | stage-2-comps.ts | Sales/rental comps with adjustment grid calculation |
| 3 | stage-3-income.ts | NOI, cap rate, income approach (commercial/industrial only) |
| 4 | stage-4-photos.ts | Vision API condition assessment, defect detection |
| 5 | stage-5-narratives.ts | AI-generated report sections (8 narrative types) |
| 6 | stage-6-filing.ts | County-specific filing instructions & deadlines (tax appeals only) |
| 7 | stage-7-pdf.ts | Puppeteer PDF generation with styled narratives |
| 8 | stage-8-delivery.ts | Email delivery with 7-day signed PDF URL (admin-triggered only) |

## Payment Flow (Pay-After Model)
1. `POST /api/reports` → Creates report with `status: 'submitted'` (NO Stripe PaymentIntent)
2. `/start/payment` → Collects email + review tier, calls API, redirects to `/start/success`
3. Admin triggers pipeline via dashboard → `POST /api/admin/reports/[id]/run-pipeline`
4. Pipeline runs stages 1-7 → status becomes `pending_approval`
5. Admin reviews → approves → `POST /api/admin/reports/[id]/approve` → sends "report ready" email → status `approved`
6. Client visits `/report/[id]` → sees savings teaser + paywall → initiates payment via `POST /api/reports/[id]/pay`
7. `POST /api/webhooks/stripe` → `payment_intent.succeeded` transitions `approved → delivered` (unlocks full report)

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
- Users submit for analysis without paying. Payment happens AFTER the report is
  generated and approved — at `/report/[id]` when status is `approved`.
- Never use the word "free" anywhere in user-facing copy. Use "submit for analysis"
  or similar. The service is not free — payment comes later.
- Tax bill uploaders get 15% off (TAX_BILL_DISCOUNT in config/pricing.ts).
- Tax bill uploaders skip redundant ATTOM assessment lookups (we already have
  their assessed value). ATTOM is still called for building details and comps.
- The "report ready" email shows concluded value and savings as a teaser to
  motivate payment. Full PDF and filing guide are locked behind payment.
- Prices are ~20% higher than original tiers to absorb non-converting submissions.

## What NOT To Do
- Never auto-deliver reports — all reports must go through admin approval before Stage 8 runs
- Never bypass the admin approval gate in the pipeline orchestrator
- Never hardcode county-specific logic in application code
- Never hardcode AI model names anywhere except config/ai.ts
- Never use NEXT_PUBLIC_ prefix on service role keys or secret keys
- Never use ATTOM marketValue as ground truth for valuations or comparisons
- Never trust county assessment data as accurate — always verify independently
- Never say "free" in any user-facing text
- Never bypass Stripe webhook for report unlock — it is the only path from `approved` to `delivered`
- Never expose the service role Supabase client to client-side code
