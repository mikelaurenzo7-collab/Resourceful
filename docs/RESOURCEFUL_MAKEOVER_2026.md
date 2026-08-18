# Resourceful Makeover: From Report Generator to Property Assessment Operating System

**Prepared:** August 16, 2026  
**Scope:** Product, business model, automation architecture, operating controls, and release strategy

## Executive decision

Resourceful should not compete as another automated valuation report generator. The defensible business is a **jurisdiction-aware property assessment operating system** that moves a customer from an assessment notice through evidence, filing, hearing preparation, decision, and measured outcome.

The product already contains meaningful pieces of that system: intake, property data, comparable analysis, photo evidence, narratives, filing guidance, PDF generation, approval, delivery, reminders, partner APIs, and outcome tracking. The limiting factor is no longer feature count. It is dependable orchestration, verified jurisdiction coverage, operator visibility, and a precise commercial wedge.

This makeover therefore prioritizes:

1. durable ownership of every paid case;
2. one-stage-at-a-time execution with retries and dead-letter handling;
3. fail-closed release controls;
4. operator-visible queue and service health;
5. county-by-county automation rather than unverified nationwide claims;
6. a product ladder that increases automation and revenue without overstating legal or appraisal scope.

## What was materially wrong

### Paid work had no durable execution owner

The Stripe webhook marked a report paid and launched a seven-stage pipeline without awaiting it. Admin reruns and stale-case recovery used the same fire-and-forget pattern. A successful HTTP response could therefore precede any durable commitment to execute the work.

The workflow also wrapped stages in `Promise.race` timeouts. A rejected timeout promise does not cancel the underlying work. That allowed a stage to continue after the orchestrator treated it as failed and released its lock.

### The database lock was not an execution ledger

The existing advisory-lock functions use session-level PostgreSQL locks. They are invoked through separate Supabase RPC requests that may use different pooled database sessions. That is not a reliable ownership boundary for a multi-minute serverless workflow.

A lock also does not answer the operational questions Resourceful needs:

- Which paid cases are queued?
- Which stage owns the case?
- When does its lease expire?
- How many times has the current stage failed?
- What is the oldest overdue case?
- Which cases exhausted automation and require intervention?
- Can an operator safely replay or replace work?

### Release automation could promote before health verification

The production workflow used `vercel deploy --prod`, which can assign production domains before the subsequent health check. A failed health check could therefore identify a broken release only after traffic had moved.

The revised flow stages a production deployment with `--skip-domain`, verifies its authenticated dependency health and exact commit identity, and promotes it only after those checks pass.

### Runtime policy and tests had drifted

The test suite asserted that stage 6 was tax-appeal-only, while production intentionally generates assignment-specific guidance for pre-purchase and pre-listing work. Stage applicability now lives in a shared policy module consumed by runtime and tests.

### Production control is currently disconnected

The repository pins a Resourceful Vercel project and canonical deployment, but the connected Vercel team currently exposes only the Wireline project and returns `404` for the pinned Resourceful project. GitHub Actions also cannot start because the GitHub account is locked for billing. Those are external release blockers, not application-code failures.

## Implemented control-plane architecture

### `pipeline_runs` is now the durable source of execution truth

Migration `036_durable_pipeline_control_plane.sql` adds a service-role-only ledger with:

- trigger source;
- idempotency key;
- current and starting stage;
- per-stage and total attempt counts;
- retry schedule;
- worker identity;
- expiring lease;
- workflow version;
- last completed stage;
- structured error;
- terminal success, dead-letter, cancellation, and timestamps.

Only one active run may exist per report. Stripe retries return the same idempotent run. The stale reconciler returns an existing active run rather than starting duplicate work. An authorized admin rerun may explicitly cancel queued or expired work and replace it transactionally; it cannot interrupt a live worker lease.

### Atomic SQL transitions own concurrency

The control plane provides security-definer RPCs for:

- enqueue;
- claim with `FOR UPDATE SKIP LOCKED`;
- advance;
- complete;
- retry or dead-letter;
- queue health.

A worker cannot advance, complete, or fail a run it does not currently lease. A killed worker leaves an expiring lease. Another invocation can reclaim that stage. A lease that expires after the final allowed attempt becomes an explicit dead letter and moves the report to failed.

### One invocation owns one stage

`/api/cron/pipeline-worker` claims one run, executes one stage, persists report progress, and either:

- queues the next stage;
- completes the workflow;
- records a bounded retry;
- moves the run to dead letter.

The Vercel function limit is no longer expected to contain the entire workflow. The lease is longer than the function duration, preventing normal overlap while still allowing recovery after termination.

### Payment acknowledgement is now safe

The Stripe flow is:

1. verify signature;
2. reconcile the report's payment identity;
3. persist `paid`;
4. atomically enqueue or recover durable pipeline ownership;
5. return success;
6. attempt the receipt only after ownership exists; receipt failure is logged without undoing paid-work ownership.

If enqueueing fails after the payment transition, the webhook returns `500`. Stripe can retry, and the retry will recognize the already-paid report and attempt the same idempotent queue operation instead of skipping it.

### The stale cron is now a reconciler

The hourly stale-case route no longer executes or force-fails the pipeline. It identifies paid or processing reports without healthy progress and ensures each has an active durable run beginning at the first incomplete stage.

### Authenticated health now validates the control plane

`/api/health` verifies that the queue RPC is deployed and available. It reports queued, running, retrying, dead-letter, expired-lease, and oldest-due signals. A materially stalled queue makes dependency health fail before production promotion.

### Repository checks prevent regression

`pnpm check:operability` verifies:

- every Vercel cron has a real route;
- the worker is scheduled and has the required duration;
- payment, rerun, and stale recovery establish durable ownership;
- no API route imports or calls the legacy inline orchestrator;
- the non-cancelling timeout pattern does not return;
- authenticated health checks include the control plane;
- migration and worker artifacts exist.

## Product strategy

## Positioning

**Recommended category:** Property assessment operating system  
**Customer promise:** Build, file, and manage a defensible property assessment case with verified local rules and visible evidence.  
**Internal doctrine:** Evidence first, jurisdiction first, outcome measured.

Avoid leading with “AI appraisal,” “automatic nationwide filing,” or guaranteed savings. Those claims create trust, regulatory, and refund risk before the coverage and evidence systems can support them.

### Primary wedge

Launch with a narrow set of verified counties where Resourceful can deliver the full loop:

1. retrieve and normalize assessment data;
2. identify the filing authority and live deadline;
3. screen value at stake and evidence sufficiency;
4. assemble comparable and condition evidence;
5. produce the correct filing packet;
6. guide or submit through a tested adapter;
7. retain proof of filing;
8. track hearing, decision, and realized savings.

Every jurisdiction should carry one public operating label:

- **Verified:** rules, forms, deadlines, evidence requirements, and any filing adapter have current human verification and passing fixtures.
- **Pilot:** rules and packet generation are reviewed, but submission remains human-led and closely monitored.
- **Researching:** Resourceful may collect intake and evidence, but it does not claim filing readiness or automated coverage.

Coverage outside Verified or Pilot jurisdictions should become a waitlist, research task, or owner-guided service—not a generic national promise.

## Product ladder

### Free assessment screen

- public-record match;
- assessment and tax summary;
- verified deadline status;
- preliminary evidence checklist;
- clear statement of unknowns;
- value-at-stake range only when inputs support it.

Purpose: qualified lead generation, deadline capture, and trust.

### Evidence Pack

- normalized subject-property workfile;
- screened comparable sales;
- condition/photo evidence;
- source register;
- calculation register;
- owner-editable fact corrections;
- AI-assisted valuation analysis with explicit scope.

Purpose: scalable self-service revenue.

### Guided Filing

- county-specific form and instructions;
- deterministic field mapping;
- evidence attachment ordering;
- deadline reminders;
- pre-submission completeness check;
- owner submits in their own name;
- proof-of-filing upload and validation.

Purpose: higher conversion without representation risk.

### Managed Case

- human review;
- filing adapter for verified jurisdictions;
- authorization workflow where legally permitted;
- submission confirmation;
- hearing preparation;
- decision and savings tracking.

Purpose: premium revenue and outcome data.

### Professional / Partner Platform

- portfolio intake;
- white-label case workspace;
- API and bulk upload;
- role-based approval;
- attorney, CPA, broker, lender, and property-manager workflows;
- per-case or committed-volume pricing;
- outcome and portfolio analytics.

Purpose: lower acquisition cost, repeat volume, and defensible distribution.

## Automation roadmap

### Phase 0 — Release control

Required before any live expansion:

- restore GitHub Actions billing;
- recover or recreate the dedicated Resourceful Vercel project;
- confirm Resourceful uses its own Supabase project;
- apply migration 036 before deploying code that calls its RPCs;
- confirm the Resourceful Vercel project is on Pro or Enterprise and supports the one-minute worker schedule;
- disable uncontrolled Git auto-promotion or configure Vercel Deployment Checks;
- run `pnpm check`;
- execute payment-to-delivery and failure-recovery drills.

### Phase 1 — Operator control tower

Build an authenticated operations surface containing:

- queue depth and oldest due age;
- paid reports without active ownership;
- running stages and lease expiry;
- retries by stage and vendor;
- dead-letter queue;
- pending approvals by SLA;
- failed delivery and notification attempts;
- county-rule freshness;
- filing deadlines within 7, 14, and 30 days;
- production dependency status;
- manual replay, replace, cancel, and escalation actions with audit logs.

Alert channels:

- Sentry for unhandled runtime failures;
- Slack for dead letters, payment-without-ownership, and breached approval SLA;
- Linear for repeatable engineering or jurisdiction defects;
- email/SMS only for customer-facing status and deadlines.

### Phase 2 — Durable workflow platform

The Supabase control plane is the immediate reliability layer. The strategic execution engine should be evaluated against Vercel Workflow once the Vercel project is restored.

A workflow-platform migration should retain the same business invariants:

- Stripe acknowledges only durable workflow creation;
- each stage is idempotent;
- retries are bounded and observable;
- human approvals are durable pauses;
- workflow state is correlated to report and payment;
- customer-facing state remains in Supabase;
- no stage can mark a filing complete without durable proof.

### Phase 3 — Canonical case compiler and jurisdiction compiler

Use one versioned case schema as the source for dashboard data, evidence manifests, filing packets, review views, and final reports. Deterministic code owns arithmetic, adjustment application, status transitions, and release eligibility. AI is constrained to extraction, evidence classification, research assistance, and narrative drafting against that schema.

Move county rules from descriptive rows into versioned, testable jurisdiction packages:

- source authority;
- effective dates;
- filing window computation;
- property-type eligibility;
- required forms;
- signature and authorization rules;
- accepted submission channels;
- evidence requirements;
- fee computation;
- hearing process;
- appeal escalation path;
- adapter capability status;
- last human verification;
- next required review.

Every rule change should run fixtures for known parcels and deadline dates. Unknown or stale rules create a verification task and block automation.

### Phase 4 — Filing adapters

For each verified jurisdiction:

- deterministic field mapping;
- form-version pinning;
- screenshot or rendered-packet review;
- explicit human approval before submission;
- idempotency key;
- submission receipt capture;
- confirmation number and timestamp;
- rejection parser;
- retry policy that never double-submits;
- adapter health test.

Do not build a universal browser bot. Build narrow adapters with evidence.

### Phase 5 — Outcome learning loop

Capture:

- requested assessed value;
- submitted evidence;
- hearing date;
- granted assessed value;
- tax-rate basis;
- actual tax savings;
- decision document;
- failure reason;
- jurisdiction and reviewer;
- model, prompt, and data versions.

Use outcomes to calibrate triage, comparable selection, adjustment ranges, and county playbooks. Do not train on outcomes without preserving source rights and separating correlation from causal evidence.

## Recommended integrations

### Now

- **Supabase:** case system, durable queue, RLS, signed artifacts, operational SQL.
- **Stripe:** payment identity, refunds/disputes, product/tier analytics, webhook event reconciliation.
- **Resend:** transactional delivery with an explicit outbox and delivery ledger.
- **Sentry:** errors, traces, release correlation, PII scrubbing.
- **Vercel:** staged production deployments, authenticated health, cron worker, runtime logs.
- **Slack + Linear:** operational alerts and durable issue escalation.
- **Twilio:** opt-in deadline and status SMS after consent and quiet-hours controls.
- **DocuSign or Dropbox Sign:** jurisdiction-specific authorization and POA flows only after legal verification.

### Data and evidence

Each vendor must have a data-rights register recording:

- licensed fields;
- permitted derivatives;
- customer-facing display rights;
- retention limits;
- training restrictions;
- audit requirements;
- fallback behavior;
- vendor cost per case.

ATTOM, Regrid, mapping, assessor, recorder, FEMA, and other sources should populate a shared evidence registry rather than writing opaque conclusions directly.

## Economics and measurement

### North-star operating metric

**Verified cases moved to a durable next action per week.**

A PDF generated is not a completed customer outcome. A durable next action is one of:

- evidence requested;
- packet ready for owner;
- human review required;
- submitted with proof;
- hearing scheduled;
- decision received;
- savings measured;
- closed with explicit failure reason.

### Reliability SLOs

- payment to durable ownership: under 2 seconds at p95;
- paid to first-stage start: under 2 minutes at p95;
- no paid report without active or terminal run;
- expired worker leases: zero under normal operation;
- dead-letter acknowledgement: under 15 minutes during staffed hours;
- approval queue SLA: tier-specific;
- delivery success: above 99.5%;
- filing state without proof: zero.

### Business metrics

- screen-to-paid conversion;
- paid tier mix;
- acquisition cost by county and channel;
- gross margin per case;
- vendor and model cost per case;
- evidence sufficiency rate;
- filing completion rate;
- grant rate by jurisdiction and case-strength band;
- requested versus granted reduction;
- realized customer savings;
- refund and dispute rate;
- partner retention and cases per account;
- time from payment to durable next action.

## Commercial priorities

1. Prove one full county loop before broadening claims.
2. Sell guided filing before assuming representation complexity.
3. Build partner distribution before scaling paid consumer acquisition.
4. Use outcomes to identify where automation creates real margin.
5. Price around service scope and human work, not report page count.
6. Make coverage, assumptions, and unknowns visible before checkout.
7. Treat each failed case as structured product data, not an exception hidden in logs.

## Release gates for this makeover

Do not merge or promote this change until all of the following are true:

- GitHub Actions can start runners;
- the dedicated Resourceful Vercel project is visible, matches the pinned project ID, and is on Pro or Enterprise for one-minute Cron execution;
- migration 036 has been applied to a non-production environment;
- database function privileges are verified;
- a preview build passes lint, typecheck, tests, and build;
- Stripe test webhook creates exactly one run across duplicate deliveries;
- killing a worker invocation results in lease recovery;
- three stage failures produce retry, retry, then dead letter;
- admin rerun replaces prior active ownership and starts at stage 1;
- stage 7 creates `pending_approval` before queue success;
- authenticated health fails when the control-plane RPC is absent;
- staged Vercel production deployment remains unaliased until health passes;
- canonical production serves the exact promoted commit.

## Next build sequence

1. Restore CI and dedicated Vercel access.
2. Apply and verify migration 036 in preview.
3. Run the failure-injection matrix.
4. Ship the operator control tower.
5. Add a transactional email/notification outbox.
6. Convert county rules into versioned jurisdiction packages.
7. Implement the first end-to-end filing adapter.
8. Add e-sign and consent controls for eligible managed cases.
9. Launch one verified county with full outcome tracking.
10. Expand only where the same operating standard can be maintained.
