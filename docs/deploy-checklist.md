# Production Relaunch Checklist

Resourceful is not considered launch-ready until every blocking item below is verified against the actual production accounts. A green local build is necessary, but it does not prove that the database, vendors, payments, email, or scheduled jobs are operational.

## 0. Credential incident response

- Revoke and rotate the ATTOM credential that appeared in public Git history.
- Review ATTOM usage logs and billing for unexpected activity.
- Replace the credential only in the production secret manager; never place keys in commits, issue text, screenshots, or commit messages.
- Decide whether to make the repository private and whether the exposed commit history should be rewritten. Rotate first; history cleanup does not invalidate a leaked key.

## 1. Restore the production infrastructure

### Supabase

- Locate the original Resourceful project in the correct Supabase account or organization. Do not reuse the Wireline project.
- If the original project cannot be recovered, create a dedicated Resourceful project and treat it as a clean rebuild.
- Record the project ref and region in the operator password manager.
- Apply every migration in `supabase/migrations` in order.
- Create the private `reports` and `photos` storage buckets defined in `supabase/config.toml`.
- Verify Row Level Security, policies, database functions, indexes, and storage policies against the deployed schema.
- Seed and manually validate the initial launch counties before enabling nationwide checkout.

### Vercel

- Connect this repository to a dedicated Resourceful project.
- Set the production branch to `main`.
- Configure all production environment variables and redeploy from a reviewed commit.
- Confirm cron jobs, function durations, domains, redirects, and deployment protection settings.

## 2. Required environment variables

### Application and database

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET` — unique random secret, at least 32 characters
- `REPORT_ACCESS_TOKEN_SECRET` — separate unique random secret, at least 32 characters
- `FOUNDER_EMAILS`

### AI

Resourceful currently uses Anthropic for narratives, photo analysis, multi-image deferred-maintenance analysis, and tax-document extraction. Gemini is not a required production dependency.

- `ANTHROPIC_API_KEY`
- `AI_MODEL_PRIMARY`
- `AI_MODEL_FAST`
- `AI_PROVIDER_FAST=anthropic` by default
- `AI_MODEL_RESEARCH` when explicitly separating research traffic
- `GROQ_API_KEY` only when `AI_PROVIDER_FAST=groq`

### Property data and mapping

- `ATTOM_API_KEY`
- `AZURE_MAPS_SUBSCRIPTION_KEY`
- `NEXT_PUBLIC_AZURE_MAPS_CLIENT_ID`
- `NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN`

Optional integrations must be enabled only after their contract, allowed use, cost, and failure behavior are documented: `SERPER_API_KEY`, `LIGHTBOX_API_KEY`, `LIGHTBOX_API_SECRET`, `RENTCAST_API_KEY`, `REGRID_API_KEY`, and `LOB_API_KEY`.

### Payments and delivery

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_ADDRESS`
- `ADMIN_NOTIFICATION_EMAIL`

### Observability

- `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` for readable production source maps
- `LOG_LEVEL=info`

## 3. Vendor and legal acceptance

Before accepting money:

- Confirm that each property-data agreement permits the intended caching, transformation, display, PDF inclusion, customer delivery, and commercial resale use.
- Confirm county-by-county filing deadlines and evidence requirements from official sources.
- Restrict guided filing and representation to jurisdictions where the operating entity and assigned professional are legally authorized.
- Review customer terms, privacy policy, refund policy, outcome disclaimers, AI disclosure, data retention, and authorization language with qualified counsel.
- Never market an AI-generated product as an appraisal, legal opinion, guaranteed reduction, or licensed representation unless the service and responsible professional actually satisfy those requirements.

## 4. Database verification

Run against the dedicated Resourceful production project:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Every customer-data table must have RLS enabled and an intentional policy set. Then verify:

- no anonymous reads of reports, photos, property data, admin data, or access tokens;
- service-role use is limited to server-only routes;
- report access tokens are signed, scoped to one report, and independently rotatable;
- payment events are idempotent;
- pipeline locks recover safely;
- required indexes and cleanup jobs exist;
- generated TypeScript types match production.

## 5. Stripe

- Use test mode until the entire flow passes.
- Configure the webhook at `/api/webhooks/stripe`.
- Verify signature rejection, duplicate-event idempotency, successful payment, failed payment, refund, and dispute behavior.
- Confirm prices displayed in the UI exactly match server-calculated PaymentIntent amounts.
- Switch to live keys only after the production smoke test plan is approved.

## 6. Email and domain

- Verify the sending domain with Resend.
- Configure SPF, DKIM, and DMARC.
- Test admin alerts, customer notifications, access links, retry behavior, and suppression/bounce handling.
- Confirm customer access remains dashboard-first when email delivery is delayed.

## 7. Quality gate

Every release commit must pass:

```bash
pnpm install --frozen-lockfile
pnpm check
```

The GitHub Actions `CI` workflow must be green. A failed or absent status is a blocker.

## 8. End-to-end release test

Use a controlled test property and test payment first, then one refunded live transaction before public launch.

1. Complete intake and tax-bill/photo upload paths.
2. Confirm server-side pricing and PaymentIntent amount.
3. Confirm the webhook transitions the case exactly once.
4. Observe stages 1–7, timeout handling, retries, and pipeline lock release.
5. Review source provenance, comparable relevance, assessment-ratio math, narrative consistency, and PDF output.
6. Approve through the admin experience and verify delivery.
7. Test signed report access in an incognito session and confirm unauthorized access is rejected.
8. Test a failed vendor call, failed AI call, failed email, stale pipeline, and duplicate webhook.
9. Confirm Sentry and structured logs contain enough context without customer PII or secrets.

## 9. Controlled launch

Launch with a deliberately narrow service area and human review on every case. Start with counties where the operator understands the filing process and where the county rules, forms, deadlines, and evidence standards have been verified manually. Do not expose nationwide checkout merely because the schema supports nationwide data.

During the first 30 paid cases, track:

- data-source success and fallback rates;
- comparable acceptance/rejection reasons;
- AI cost, vendor cost, human review time, refund rate, and gross margin per case;
- proposed versus reviewer-approved valuation;
- filing completion and outcome;
- customer acquisition channel and conversion;
- support burden and time to delivery.

Only automate release or expand jurisdictions after the quality and unit economics data support it.
