# Production Deploy Checklist

Follow these steps top-to-bottom before opening the platform to real users.
Everything here is an action **you** take — the codebase itself is production-ready.

---

## 1. Environment Variables (Vercel → Project Settings → Environment Variables → Production)

### Required secrets

| Variable | Source |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service_role key) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys (**live** `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Generated when you create the webhook in step 3 |
| `RESEND_API_KEY` | resend.com → API Keys |
| `ATTOM_API_KEY` | api.gateway.attomdata.com |
| `AZURE_MAPS_SUBSCRIPTION_KEY` | portal.azure.com → Maps Account → Authentication |
| `CRON_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REPORT_ACCESS_TOKEN_SECRET` | Generate (same command as CRON_SECRET). **Do not reuse any other secret.** |
| `FOUNDER_EMAILS` | Comma-separated, e.g. `mikelaurenzo7@gmail.com` |

### Required public vars

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API (anon key) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe (live `pk_live_…`) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` (no trailing slash) |
| `NEXT_PUBLIC_AZURE_MAPS_CLIENT_ID` | Azure Maps Web SDK client ID |
| `NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN` | mapillary.com/developer |

### Required config

| Variable | Value |
|---|---|
| `AI_MODEL_PRIMARY` | `claude-sonnet-4-6` |
| `AI_MODEL_FAST` | `claude-haiku-4-5-20251001` |
| `RESEND_FROM_ADDRESS` | e.g. `reports@yourdomain.com` — must be a verified Resend domain |
| `ADMIN_NOTIFICATION_EMAIL` | Your inbox |

### Strongly recommended

| Variable | Notes |
|---|---|
| `SENTRY_DSN` | sentry.io project DSN (server-side) |
| `NEXT_PUBLIC_SENTRY_DSN` | Same DSN (client-side). Without Sentry, errors disappear silently. |
| `SENTRY_AUTH_TOKEN` | Enables source-map upload; creates readable stack traces |

### Optional (features degrade gracefully without them)

`SERPER_API_KEY`, `LIGHTBOX_API_KEY`, `LIGHTBOX_API_SECRET`, `RENTCAST_API_KEY`,
`REGRID_API_KEY`, `LOB_API_KEY`, `GROQ_API_KEY`.

---

## 2. Supabase

1. **Apply all migrations** against the production project:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   30 migrations total (`001_initial_schema.sql` through `030_county_rules_enrichment.sql`).

2. **Verify RLS is enabled on every table:**
   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public'
   order by tablename;
   ```
   Every row must show `rowsecurity = true`. If any is `false`, fix before going live.

3. **Seed county rules:**
   ```bash
   pnpm tsx scripts/seed-top-counties.ts
   pnpm tsx scripts/seed-extended-counties.ts   # optional — broader coverage
   ```

4. **Create your admin account:**
   - Sign up at `https://<your-domain>/signup` using your founder email
   - Visit `/admin` — the layout auto-provisions the `admin_users` row the first time a founder email loads it

---

## 3. Stripe

1. Switch to **Live mode** in dashboard.stripe.com (top-left toggle)
2. Copy the live keys into Vercel env vars (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
3. Create a webhook endpoint:
   - URL: `https://<your-domain>/api/webhooks/stripe`
   - Events to send:
     - `payment_intent.succeeded`
     - `charge.dispute.created`
     - `charge.dispute.closed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`
4. Click **"Send test webhook"** in Stripe — expect a `200` response

---

## 4. Resend (email)

1. Add your sending domain in Resend
2. Add the SPF, DKIM, and DMARC DNS records Resend provides to your DNS host
3. Wait for verification (usually minutes)
4. Confirm `RESEND_FROM_ADDRESS` uses that verified domain

---

## 5. Sentry (recommended)

1. Create a new project in sentry.io
2. Copy the DSN into **both** `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`
3. Create an auth token with `project:releases` scope → `SENTRY_AUTH_TOKEN`

Without these, the deploy still works — you'll just see a warning in Vercel logs
and lose stack-trace visibility.

---

## 6. Vercel

1. Connect the repo to a new Vercel project
2. Set production branch to `main`
3. After first deploy, confirm in Vercel dashboard:
   - **Cron Jobs** tab shows 7 crons active (reminders, cleanup, outcome-followup,
     calibration, notification-retry, cart-recovery, stale-pipeline)
   - **Functions** tab shows timeouts applied: webhook 300s, download 120s,
     cron routes 60–120s

---

## 7. Smoke Test (before opening to real users)

Use a real credit card on a real address you own — refund via Stripe after.

1. `/start` → complete onboarding
2. Complete Stripe checkout
3. Watch Vercel logs: pipeline should run stages 1–7 in roughly 5–10 minutes
4. Report lands in `/admin` with status `pending_approval`
5. Click approve — stage 8 runs, status becomes `delivered`, notification email lands
6. Open `/report/[id]`, download the PDF via the signed URL
7. In an incognito window with a different account, try downloading — expect `403`
8. Confirm the payment receipt email arrived

If any step fails, check `docs/production-runbook.md` for the known failure modes.

---

## 8. First 48 Hours

- **Sentry** — watch for new error patterns; triage anything that fires more than twice
- **Vercel Cron Jobs** — all 7 should fire on schedule with `200` responses
- **Stripe** — no failed webhook attempts, no unexpected dispute activity
- **Report quality** — spot-check 3–5 real reports; regenerate individual sections
  from `/admin/reports/[id]/review` if narrative quality is off

---

## 9. Non-Blockers (documented, do not "fix")

These look flaggable in a security scan but are intentional and correct:

- `unsafe-inline` in CSP `script-src` — required by Next.js. Standard.
- `NEXT_PUBLIC_SENTRY_DSN` in the client bundle — Sentry DSNs are designed to be
  public; they identify the project but cannot read data.
- In-memory rate-limit fallback during Supabase outage — intentional trade-off.
  Per-instance limits still prevent unbounded abuse; the alternative is open firehose.
- Migration `018_founder_admin_lockdown.sql` has a hardcoded
  `DELETE FROM admin_users WHERE email != 'mikelaurenzo7@gmail.com'` — this is
  intentional lockdown behavior and only runs once per Supabase migration history.
  **Do not modify already-applied migrations.**

---

## 10. Operational Runbook

Day-to-day ops, stuck reports, failed PDFs, failed webhooks, email issues, and
county-rules hygiene are documented in [`docs/production-runbook.md`](./production-runbook.md).

Scripts for common fixes:
- `scripts/debug-lock.ts` — inspect pipeline lock state
- `scripts/unlock.sql` — release stale locks (read the comments first)
- `scripts/rerun-report.ts` — re-run a stuck report
- `scripts/run-setauket-e2e.mjs` — full live E2E smoke test (25W050 Setauket Ave, DuPage County)
