# Resourceful

Resourceful is a nationwide property intelligence platform that generates professional property tax appeal reports, pre-purchase analyses, and pre-listing pricing reports. It combines structured public-record data, comparable sales, photo-based condition evidence, and AI-generated narratives into a deliverable that is reviewable in the admin workflow and accessible from the customer dashboard.

## Core Product Model

- Dashboard-first delivery: reports are delivered to the user dashboard and report page, not as fragile expiring PDF links.
- Payment before valuation: the customer pays before seeing the completed valuation output.
- Nationwide coverage: county-specific behavior lives in `county_rules`; application code must not hardcode county logic.
- Admin-gated delivery: stages 1 through 7 generate the report, then admin approval triggers final delivery and customer notification.
- Outcome loop: delivered reports request follow-up outcomes later so calibration can improve over time.

## Stack

- **Next.js 14** App Router, TypeScript strict mode
- **Supabase** — Postgres, Auth, Storage, RLS on every table
- **Anthropic Claude** — report narratives (PRIMARY), classification (FAST)
- **Google Gemini** — multimodal vision for photo analysis (VISION), tax bill OCR (DOCUMENT)
- **ATTOM Data API** — property details, sales comps, rental comps, deed history
- **Azure Maps** — geocoding, static maps, address autocomplete
- **Mapillary** — street-level imagery (replaces Google Street View)
- **Stripe** — checkout, payment webhooks, subscription management
- **Resend** — transactional email (delivery notifications, outcome follow-ups)
- **@sparticuz/chromium + puppeteer-core** — PDF generation
- **Vercel** — deployment, edge middleware, cron execution

Optional data enrichment services: RentCast (rental comps), LightBox RE (property data fallback), Regrid (parcel boundaries), Serper (web search), Lob (certified mail filing).

## Important Paths

- App routes: `src/app`
- Report pipeline: `src/lib/pipeline`
- PDF renderer: `src/lib/pdf`
- HTML report template helpers: `src/lib/templates`
- External integrations: `src/lib/services`
- Repository data access: `src/lib/repository`
- Database types: `src/types/database.ts`
- Supabase migrations: `supabase/migrations`

## Local Development

1. Install dependencies.
2. Create `.env.local` from `.env.example`.
3. Start Supabase locally if needed.
4. Run the app and supporting checks.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

Helpful scripts:

- `scripts/setup-local.sh`
- `scripts/seed-counties.ts`
- `scripts/seed-top-counties.ts`
- `scripts/rerun-report.ts`
- `scripts/debug-lock.ts`

## Environment

**Required** for production:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI — narratives, filing guides |
| `AI_MODEL_PRIMARY` | e.g. `claude-sonnet-4-6` |
| `AI_MODEL_FAST` | e.g. `claude-haiku-4-5-20251001` |
| `GEMINI_API_KEY` | Google Gemini — photo analysis, tax bill OCR |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-only) |
| `ATTOM_API_KEY` | ATTOM property data API |
| `AZURE_MAPS_SUBSCRIPTION_KEY` | Azure Maps geocoding + autocomplete |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client key (browser-safe) |
| `RESEND_API_KEY` | Transactional email |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (e.g. `https://resourceful.app`) |
| `CRON_SECRET` | Vercel cron job authentication |

**Optional** enrichment keys: `RENTCAST_API_KEY`, `LIGHTBOX_API_KEY`, `LIGHTBOX_API_SECRET`, `REGRID_API_KEY`, `SERPER_API_KEY`, `LOB_API_KEY`, `NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN`.

All variables are documented in `.env.example`.

## Production Checklist

Before shipping:

1. `pnpm lint && pnpm build` — must pass clean on the deployed commit.
2. All Supabase migrations applied (`supabase db push`).
3. All required env vars set in Vercel project settings (see table above).
4. Stripe webhook → `/api/webhooks/stripe` with correct `STRIPE_WEBHOOK_SECRET`.
5. Resend sending domain verified and `RESEND_FROM_ADDRESS` set.
6. `county_rules` seeded for target jurisdictions (`scripts/seed-counties.ts`).
7. At least one admin user in the database for report quality review.
8. End-to-end test: intake → payment → pipeline stages 1–7 → admin approval → delivery email → dashboard access.
9. Verify cron routes in `vercel.json` and `CRON_SECRET` set.
10. Confirm `NEXT_PUBLIC_APP_URL` is the production domain (used for canonical URLs, OG images, email links).

## Operational Notes

- Stage 7 PDF assembly is the live report generation path and must stay aligned with `ReportTemplateData`.
- Report delivery is non-fatal for email; the dashboard remains the source of truth.
- County enrichment must be stored in `county_rules` and referenced through typed data access, not hardcoded in route handlers.
- Appraisal-style enhancements should be introduced through the live payload and narrative contracts, not placeholder props.

## Deployment Runbook

See `docs/production-runbook.md` for a practical deployment and incident checklist.
