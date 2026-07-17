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

- Connect this repository to the existing dedicated Resourceful project.
- Set the production branch to `main`.
- Set the project runtime to Node.js 22 and keep it aligned with `package.json`.
- Configure all production environment variables and redeploy from a reviewed commit.
- Set `NEXT_PUBLIC_APP_URL=https://resourceful-7x38.vercel.app`; never use a Vercel dashboard URL.
- Confirm cron jobs, function durations, domains, redirects, deployment protection settings, and the canonical `/api/health` response.

## 2. Environment variables

### Core application and database — required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET` — unique random secret, at least 32 characters
- `REPORT_ACCESS_TOKEN_SECRET` — separate unique random secret, at least 32 characters
- `FOUNDER_EMAILS`

### AI — OpenAI only

Resourceful uses OpenAI for valuation judgment, narrative generation, document extraction, vision analysis, fast classification, and evidence-grounded research synthesis. Do not configure Anthropic, Gemini, or Groq runtime paths.

- `OPENAI_API_KEY`
- `AI_MODEL_PRIMARY=gpt-5.6-sol`
- `AI_MODEL_RESEARCH=gpt-5.6-terra`
- `AI_MODEL_FAST=gpt-5.6-luna`
- `AI_MODEL_VISION=gpt-5.6-sol`
- `AI_MODEL_DOCUMENT=gpt-5.6-sol`
- `AI_REASONING_APPRAISER=high`
- `AI_REASONING_RESEARCH=medium`
- `AI_REASONING_FAST=low`
- `AI_REASONING_VISION=high`
- `AI_REASONING_DOCUMENT=high`

Model IDs and reasoning levels must remain pinned until representative property, document, vision, and filing evals justify a change.

### Property data, research, and maps — recommended capabilities

- `GOOGLE_MAPS_API_KEY` — server-only; primary geocoding, address search, static maps, and Street View
- `ATTOM_API_KEY` — structured property and comparable enrichment
- `SERPER_API_KEY` — current public-source retrieval for OpenAI research synthesis

Restrict the Google credential to the required APIs and approved server origins or egress controls. Resourceful must continue to boot when any enrichment provider is missing; the health endpoint should report a degraded capability rather than a process-wide outage.

Transitional or optional fallbacks:

- `AZURE_MAPS_SUBSCRIPTION_KEY`
- `NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN`
- `LIGHTBOX_API_KEY`
- `LIGHTBOX_API_SECRET`
- `RENTCAST_API_KEY`
- `REGRID_API_KEY`
- `LOB_API_KEY`

Enable an optional integration only after its contract, allowed use, cost, data provenance, retention rules, and failure behavior are documented.

### Payments and delivery — required before checkout

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
- Confirm Google Maps Platform attribution, caching, display, and static-image terms for every use in the application and delivered work product.
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

The GitHub Actions `CI` workflow must start, execute all steps, and finish green. A failed, empty, or absent status is a blocker.

## 8. End-to-end release test

Use a controlled test property and test payment first, then one refunded live transaction before public launch.

1. Complete each intake path, including tax bill and photo upload.
2. Confirm each service name, package, server-side price, and PaymentIntent amount.
3. Confirm the webhook transitions the case exactly once.
4. Observe stages 1–7, timeout handling, retries, and pipeline lock release.
5. Review source provenance, comparable relevance, assessment-ratio math, narrative consistency, and PDF output.
6. Confirm maps show only verified coordinates; never synthetic comparable locations.
7. Approve through the admin experience and verify delivery.
8. Test signed report access in an incognito session and confirm unauthorized access is rejected.
9. Test a failed property-data call, failed map call, failed AI call, failed email, stale pipeline, and duplicate webhook.
10. Confirm Sentry and structured logs contain enough context without customer PII or secrets.

## 9. Controlled launch

Launch with a deliberately narrow service area and human review on every case. Start with counties where the operator understands the filing process and where the county rules, forms, deadlines, and evidence standards have been verified manually. Do not expose nationwide checkout merely because the schema supports nationwide data.

During the first 30 paid cases, track:

- data-source success and fallback rates;
- comparable acceptance and rejection reasons;
- AI cost, vendor cost, human review time, refund rate, and gross margin per case;
- proposed versus reviewer-approved valuation;
- filing completion and outcome;
- customer acquisition channel and conversion;
- support burden and time to delivery.

Only automate release or expand jurisdictions after the quality and unit economics data support it.
