# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis and public property data APIs. Reports require admin approval before delivery to clients. Photos and tax bills are collected post-payment to strengthen the evidence package — never as a barrier to entry.

## Business Model — Option C: Full Payment with Money-Back Preview
The user flow is designed to minimize friction and maximize trust:

1. **Minimal intake** — Address, property type, service type, email, choose tier, pay.
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
2. **Property** — Address, county, property type
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
 0h  — Customer pays. Instant preview shown. Photo upload encouraged.
12h  — Photo reminder email sent (cron).
14h  — Pipeline triggered (cron). Runs with ATTOM + AI + photos if any.
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

- **Instant preview (post-payment)**: Pure statistical estimate only (IAAO 8% error
  rate). NEVER compare against ATTOM marketValue. This is the number shown
  immediately after payment to validate the purchase.
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
- Money-back guarantee: if no savings found, full refund. Displayed prominently
  on payment page and success page.
- Tax bill uploaders get 15% off (TAX_BILL_DISCOUNT in config/pricing.ts).
  This is offered post-payment as an incentive, not a pre-payment requirement.
- Tax bill uploaders skip redundant ATTOM assessment lookups.

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
