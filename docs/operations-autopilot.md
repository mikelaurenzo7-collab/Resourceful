# Operations Autopilot

Resourceful's production constraint is no longer report generation alone. It is the ability to keep jurisdiction rules, evidence, filing work, and customer delivery continuously correct without hiding operational state in free-text notes.

This control plane introduces a reusable, fail-closed operations architecture. The first implemented source is jurisdiction-rule reconciliation because stale or incomplete rules can make a paid tax-appeal workflow incorrect before any valuation work begins.

## What ships in migration 036

### Immutable jurisdiction rule versions

Every material `county_rules` insert or update creates a content-addressed snapshot in `jurisdiction_rule_versions`.

- `created_at` and `updated_at` are excluded from the content hash so timestamp-only writes do not create false versions.
- Each county receives monotonically increasing rule versions.
- Snapshot rows are append-only and retain verification identity plus official source references.
- Existing county records receive a baseline version during migration.

This makes it possible to prove which legal/filing rules were in force when a report was sold, prepared, approved, or filed.

### Durable operations queue

`operations_tasks` is the single work-object model for deterministic automation and human intervention.

Each task has:

- a stable idempotency key;
- source, category, task type, and subject identity;
- priority, status, due date, assignment, and snooze state;
- first/last detection timestamps;
- resolution state and structured metadata;
- automation-run and actor provenance.

The same queue is designed to accept later task sources such as filing authorization, missing evidence, portal submission, delivery failure, partner acceptance, and outcome follow-up.

### Append-only task history

`operations_task_events` records every task creation, status transition, priority transition, reopening, and automatic resolution. Events retain the actor, automation run, prior state, and resulting state.

### Automation run ledger

`automation_runs` records every reconciliation invocation and its counts, completion state, details, and failure message. A failed execution can no longer disappear into transient logs.

## Jurisdiction reconciliation

The planner mirrors the production release gate in `jurisdiction-eligibility.ts`:

- current verification within 180 days;
- filing authority;
- current deadline logic;
- at least one usable filing channel;
- evidence or required-document requirements.

It also creates proactive work for:

- verification records entering the 30-day expiry window;
- missing verifier identity;
- missing official source references;
- expired explicit deadlines;
- filing deadlines within 21 days.

The reconciliation service is safe to retry. Persistent conditions update the same task, cleared conditions auto-resolve, and conditions that return after being cleared reopen the original work object.

## Execution paths

- Scheduled: `GET /api/cron/jurisdiction-operations`, authenticated with the existing timing-safe `CRON_SECRET` contract.
- Manual: **Admin → Operations → Run reconciliation**.
- Schedule: daily at `12:00 UTC` through `vercel.json`.

## Operator workflow

The operations console sorts critical work first and exposes:

- release-blocking eligibility code;
- due/overdue state;
- source county or report link;
- start, block, snooze, resolve, dismiss, and reopen actions;
- latest automation-run counts.

Snoozed work remains detectable but stays snoozed until its deadline expires. Dismissed work remains dismissed while the condition persists, is auto-resolved when the condition clears, and can reopen if it later returns.

## Deployment sequence

1. Apply Supabase migration `036_operations_autopilot.sql` to the dedicated Resourceful project.
2. Deploy the application with the existing `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and founder/admin configuration.
3. Run the reconciliation manually from `/admin/operations`.
4. Verify one `automation_runs` row, expected active tasks, baseline jurisdiction snapshots, and task events.
5. Correct critical jurisdiction work before accepting tax-appeal payment.
6. Confirm the daily Vercel cron invocation succeeds.

## Next control-plane sources

### 1. Filing execution ledger

Replace `reports.admin_notes` as filing truth with:

- `filing_cases`;
- executed authorization records;
- jurisdiction-adapter version;
- submission attempts;
- immutable receipt/confirmation artifacts;
- retry and escalation tasks.

Portal automation should remain human-approved until each adapter has deterministic validation, terms-of-use review, receipt capture, and rollback behavior.

### 2. Customer task center

Create structured requests for signatures, ownership evidence, tax notices, missing photographs, and authorization forms. Every request needs due date, delivery history, reminders, completion evidence, and escalation into `operations_tasks`.

### 3. Evidence acquisition orchestrator

Run county/assessor, recorder, licensed-data, and public-record acquisition as source-specific jobs with:

- request fingerprints and idempotency;
- provenance and retrieval timestamps;
- quality checks;
- bounded retries;
- manual exception tasks;
- immutable evidence bundles tied to report artifacts.

LLMs may extract and classify evidence. Deterministic policy must decide admissibility, valuation inclusion, and release.

### 4. Outcome learning loop

Join filed cases, hearing outcomes, final assessed values, argument patterns, comparable selection, and jurisdiction-rule versions. Calibration may propose policy changes, but no automated proposal should alter released valuation policy or jurisdiction rules without review and a new version.

### 5. Operational notifications and ownership

Add configurable assignment rules and critical-task notifications to email/Slack while keeping the database queue authoritative. Notification delivery must be retried independently and never substitute for task persistence.

### 6. Jurisdiction onboarding pipeline

Model research, source verification, legal/filing review, sandbox adapter validation, launch approval, and periodic reverification as explicit stages. A county becomes active only when all release predicates pass and the onboarding approval is recorded.

## Non-negotiable controls

- No payment for an unsupported, inactive, stale, or incomplete jurisdiction.
- No filing claim without an immutable receipt or explicit manual status.
- No AI-authored fact without source provenance.
- No mutable artifact presented as the originally approved or delivered artifact.
- No county-rule edit without a new immutable version.
- No operational exception that exists only in logs, email, or a report note.
