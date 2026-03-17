# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide web app that generates professional property tax appeal reports using AI analysis, public property data APIs, and owner-provided photographs. Reports go through human approval before delivery to clients.

## The Single Most Important Rule
Nothing reaches the client without explicit admin approval. The pipeline always halts at status = 'pending_approval'. Client delivery only happens when an admin clicks Approve. This is not a temporary workaround — it is a core feature.

## Nationwide Architecture Rule
This platform serves every county in every state. ATTOM is the universal data source that covers the entire country. County-specific assessor APIs (like Cook County IL) are optional enhancements — when a county_rules row has an assessor_api_url, we try the direct API first for more accurate assessed values, then merge with ATTOM. Assessment ratios, appeal board names, filing deadlines, form names — all from the county_rules database table. Never hardcoded in application logic.

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
- supabase db push — push schema changes
- supabase gen types typescript — regenerate TypeScript types from schema

## What NOT To Do
- Never set status past 'pending_approval' automatically
- Never send email to clients from pipeline stages
- Never hardcode county-specific logic in application code
- Never hardcode AI model names anywhere except config/ai.ts
- Never use NEXT_PUBLIC_ prefix on service role keys or secret keys
