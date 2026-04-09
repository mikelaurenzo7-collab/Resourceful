# Production Runbook

## Deploy

1. Apply Supabase migrations.
2. Confirm all required environment variables are present.
3. Run:

```bash
pnpm lint
pnpm build
```

4. Verify Stripe webhook signing secret and endpoint.
5. Verify `CRON_SECRET` is configured for scheduled routes.
6. Smoke test:
   - create report
   - complete payment
   - confirm webhook marks report as paid
   - confirm pipeline reaches `pending_approval`
   - approve in admin
   - confirm dashboard delivery and notification email

## High-Risk Production Paths

- Payment webhook: `src/app/api/webhooks/stripe/route.ts`
- Pipeline orchestration: `src/lib/pipeline/orchestrator.ts`
- Narrative generation: `src/lib/pipeline/stages/stage5-narratives.ts`
- PDF assembly: `src/lib/pipeline/stages/stage7-pdf-assembly.ts`
- Delivery: `src/lib/pipeline/stages/stage8-delivery.ts`

## If a Report Gets Stuck

1. Check report status and pipeline logs.
2. Inspect lock state with `scripts/debug-lock.ts`.
3. If necessary, release stale locks using the SQL in `scripts/unlock.sql` only after confirming no active run is in progress.
4. Re-run the report with `scripts/rerun-report.ts`.
5. If the report is already assembled but not delivered, inspect Stage 8 notification state and retry path.

## If PDF Generation Fails

1. Check Stage 7 logs for missing comps, missing concluded value, or render timeout.
2. Verify the live PDF renderer still matches `ReportTemplateData`.
3. Confirm any new report sections are powered by existing payload fields or narrative content.
4. Re-run `pnpm build` and a targeted report generation test before retrying production assembly.

## If Stripe Webhooks Fail

1. Confirm the webhook secret matches the deployed environment.
2. Review webhook event logs in Stripe.
3. Confirm the report was still in `intake` when the event arrived.
4. Re-deliver the webhook from Stripe if the failure was transient.

## If Customer Email Fails

1. Remember delivery is dashboard-first.
2. Confirm the report is accessible at `/report/[id]`.
3. Check the notification retry cron and email provider logs.
4. Do not treat email failure as report delivery failure unless dashboard access is also broken.

## County Rules Hygiene

1. Keep `county_rules` current.
2. Verify newly added county enrichment fields before relying on them in prompts.
3. Never ship county-specific app logic when the data belongs in the database.