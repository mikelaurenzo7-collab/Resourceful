# Resourceful

Resourceful is a nationwide property intelligence platform that generates professional property tax appeal reports, pre-purchase analyses, and pre-listing pricing reports. It combines structured public-record data, comparable sales, photo-based condition evidence, and AI-generated narratives into a deliverable that is reviewable in the admin workflow and accessible from the customer dashboard.

## Core Product Model

- Dashboard-first delivery: reports are delivered to the user dashboard and report page, not as fragile expiring PDF links.
- Payment before valuation: the customer pays before seeing the completed valuation output.
- Nationwide coverage: county-specific behavior lives in `county_rules`; application code must not hardcode county logic.
- Admin-gated delivery: stages 1 through 7 generate the report, then admin approval triggers final delivery and customer notification.
- Outcome loop: delivered reports request follow-up outcomes later so calibration can improve over time.

## Stack

- Next.js 14 App Router
- TypeScript strict mode
- Supabase for Postgres, Auth, Storage, and RLS
- Stripe for checkout and payment webhooks
- Anthropic for narratives and image analysis
- ATTOM plus supporting services for property data and comps
- React PDF for the production report renderer
- Vercel for deployment and cron execution

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

Required production variables include:

- `ANTHROPIC_API_KEY`
- `AI_MODEL_PRIMARY`
- `AI_MODEL_FAST`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ATTOM_API_KEY`
- `CRON_SECRET`

Recommended variables are documented in `.env.example` and validated at startup by `src/lib/utils/validate-env.ts`.

## Production Checklist

Before shipping:

1. Run `pnpm lint` and `pnpm build` on the exact commit being deployed.
2. Ensure the latest Supabase migrations have been applied.
3. Verify Stripe webhook configuration points to `/api/webhooks/stripe` with the correct secret.
4. Confirm `county_rules` contains the jurisdictions you intend to support.
5. Verify at least one admin user can review and approve reports.
6. Test the happy path end to end: intake, payment, pipeline, admin approval, delivery email, dashboard access.
7. Verify cron authentication and scheduled routes in `vercel.json`.

## Operational Notes

- Stage 7 PDF assembly is the live report generation path and must stay aligned with `ReportTemplateData`.
- Report delivery is non-fatal for email; the dashboard remains the source of truth.
- County enrichment must be stored in `county_rules` and referenced through typed data access, not hardcoded in route handlers.
- Appraisal-style enhancements should be introduced through the live payload and narrative contracts, not placeholder props.

## Deployment Runbook

See `docs/production-runbook.md` for a practical deployment and incident checklist.
