# Resourceful Operational Standards

These standards govern every human and automated change to Resourceful.

## Product and Engineering

- **Action-first delivery:** The product must move a property owner from assessment notice to evidence, filing, hearing, and outcome—not stop at a PDF.
- **Jurisdiction-driven behavior:** County and state requirements belong in versioned jurisdiction data and filing adapters, never scattered through UI copy or route handlers.
- **Fail closed:** Unknown deadlines, authority, forms, filing rules, or data rights must create a verification task rather than a confident guess.
- **Dashboard-first delivery:** Reports, filing packets, confirmations, hearing dates, and outcomes live in the customer dashboard. Shared artifacts use signed, temporary access.
- **Dedicated infrastructure:** Resourceful must use its own Supabase and Vercel projects. Never point Resourceful migrations, service-role credentials, or deployment variables at Wireline.
- **Strict environment validation:** Critical configuration is validated through `src/instrumentation.ts` and `src/lib/utils/validate-env.ts`.
- **Structured logging and privacy:** Use `src/lib/logger.ts`; mask PII before external logging; do not log full documents, report contents, credentials, or authorization forms.
- **Type and schema integrity:** Strict TypeScript, generated/verified database types, migrations for schema changes, and no unexplained `any`/`never` casts.

## AI Appraiser and Evidence Trust

- **OpenAI-first runtime:** GPT-5.6 Sol is the primary valuation, narrative, vision, document, and filing model. Terra handles research and Luna handles lower-cost extraction/classification unless evals justify different routing.
- **Evidence outranks persuasion:** The model may advocate for the customer only within the evidence. It may not manufacture comps, adjustments, defects, deadlines, market statistics, inspection findings, or representative authority.
- **Source separation:** Clearly distinguish owner statements, photographs, public records, licensed data, calculations, assumptions, and professional judgment.
- **No false appraisal claims:** Unsigned AI work is an AI-assisted valuation analysis, not a certified, licensed, lender, or USPAP appraisal. A credentialed appraiser must inspect/review as required, sign, and assume responsibility before a regulated appraisal is marketed or delivered.
- **No false filing claims:** A packet marked ready is not filed. Filing status becomes submitted/accepted only after durable proof such as a confirmation number, timestamped receipt, accepted email, or certified-mail tracking event.
- **Human review gates:** High-value conclusions, representative filings, portal submissions, and regulated appraisal products require explicit human approval.
- **Evaluation before model changes:** Model, prompt, and reasoning changes require representative residential, commercial, thin-market, photo-heavy, and county-rule evals.

## Filing and Representation

- **Pro se by default:** When representation authority is unknown or unavailable, Resourceful prepares and coaches the owner to file in their own name.
- **POA is jurisdiction-specific:** Full representation requires verified eligibility, the correct county/state authorization form, an executed authorization, identity/signature controls, and a retained audit trail.
- **Adapter-based automation:** Automated filing uses a tested jurisdiction adapter with deterministic field mapping, screenshots/receipts, idempotency, and a human review step before final submission.
- **No generic browser bot:** Never submit a legal/tax filing through an unverified universal Playwright flow.
- **Outcome loop:** Track filing, hearing, decision, requested value, granted value, savings, failure reason, and source documents to improve county playbooks and model calibration.

## Quality Gates

- Run `pnpm check` before deployment or merge.
- Maintain tests around pricing, payment/webhook idempotency, access controls, valuation math, filing-state transitions, jurisdiction routing, document extraction, and AI output validation.
- Browser-level tests must cover intake, payment, report review, pro se packet completion, proof-of-filing upload, and admin approval.
- `/api/health` is the authenticated source of truth for production dependencies.
- Sentry must mask PII and production source maps must be verifiable.

## Security

- RLS on every customer-data table, least-privilege service-role usage, strict report-access tokens, webhook signature verification, and a restrictive CSP.
- Any credential exposed in source, logs, commit text, screenshots, or tickets is compromised and must be rotated before release.
- Vendor contracts and licenses must permit every stored field, derivative analysis, customer-facing output, and retention period used by the product.
