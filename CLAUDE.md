# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis and public property data APIs. Reports require admin approval before delivery to clients. Photos and tax bills are collected post-payment to strengthen the evidence package — never as a barrier to entry.

## User Flow — Trust First, Enhance Later
The intake is intentionally minimal: address, property type, service type, email, pay.
We do NOT ask for photos, tax bills, or detailed property issues before payment.

**Why:** Asking for too much upfront erodes trust. The user hasn't committed yet —
don't make them work for it. After they pay, they're invested and we can explain
how photos strengthen their case. The appeal deadline is weeks or months away;
there's no rush to collect evidence before generating the initial report.

### Wizard Steps (3 steps only)
1. **Goals** — Service type (tax appeal, pre-purchase, pre-listing)
2. **Property** — Address, county, property type
3. **Payment** — Choose tier, enter email, pay

### Post-Payment Enhancement
After payment, the success page and report dashboard encourage:
- **Photo uploads** — "Your photos are your strongest independent evidence.
  Upload them anytime before your hearing to strengthen your case."
- **Tax bill uploads** — Uploaded tax bills unlock a 15% refund/credit
  and provide more accurate baseline data.

Photos and tax bills enhance the report but are never required for generation.

## Delivery Model
The pipeline completes stages 1-7 (data gathering, AI analysis, PDF generation)
using ATTOM data + Anthropic AI. After completion, the report enters
status = 'pending_approval' for admin review. Admin can review, approve, reject,
or re-run reports via the admin dashboard. Stage 8 (sending the PDF and filing
guide via email) only executes after admin approval.

Quick turnaround is the goal — the initial report generates fast using AI + ATTOM
data. Photos uploaded later can trigger report enhancement/regeneration.

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

- **Pre-payment valuation**: Pure statistical estimate only (IAAO error rates).
  NEVER compare against ATTOM marketValue or any third-party "market value"
  that could originate from the same county records. The 8% human-error rate
  is mathematically defensible regardless of county data quality.
- **Initial report (ATTOM + AI)**: Uses comparable sales and AI analysis.
  This is the quick-turnaround product — generated with zero user effort
  beyond providing the address.
- **Enhanced report (+ user photos)**: When the user uploads photos
  post-payment, the report can be regenerated with photo-based condition
  adjustments. This is our strongest independent evidence.
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
- Never ask for photos, tax bills, or detailed property info before payment.
  The intake should feel effortless — address, type, pay.
- Tax bill uploaders get 15% off (TAX_BILL_DISCOUNT in config/pricing.ts).
  This is offered post-payment as an incentive, not a pre-payment requirement.
- Tax bill uploaders skip redundant ATTOM assessment lookups (we already have
  their assessed value). ATTOM is still called for building details and comps.

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
