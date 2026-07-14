# Resourceful

Resourceful is an **AI-assisted property tax appeal and property intelligence platform**. Its primary job is not to generate a report; it is to move an owner from an assessment notice to a defensible case, a completed filing workflow, hearing preparation, and a recorded outcome.

GPT-5.6 Sol serves as the high-judgment valuation and case-assembly engine. Terra performs research and Luna handles lower-cost extraction and classification. All material conclusions, submissions, and regulated appraisal products remain subject to appropriate human review.

## Product Thesis

Property tax appeals are the wedge because the pain is recurring, deadline-driven, measurable, and fragmented across thousands of jurisdictions. Resourceful turns that fragmentation into structured jurisdiction data, reusable filing adapters, outcome intelligence, and a guided customer workflow.

The product should answer five questions for every owner:

1. **Should I appeal?** Verify records, eligibility, deadline, evidence strength, and value at stake.
2. **What is the strongest supportable case?** Reconcile comparable sales, assessment equity, property facts, condition evidence, income/cost indicators, and prior sales.
3. **Exactly what must I file?** Generate the correct forms, requested value, evidence index, signatures, authorizations, and submission checklist.
4. **How do I win the process?** Provide reminders, hearing preparation, likely questions, concise answers, and escalation options.
5. **What happened?** Capture confirmation, hearing, decision, granted value, savings, and failure reason for the customer and the calibration loop.

## Product Lanes

| Lane | Delivery model | Customer outcome |
|---|---|---|
| **Appeal Screening** | Public-record check plus paid case analysis | Know whether a case is worth pursuing and what evidence is missing |
| **Appeal Case** | AI-assisted valuation workfile and appeal packet | Receive a reviewable, evidence-led reduction case |
| **Guided Pro Se Filing** | Packet, deadline control, live filing session, mock hearing | File correctly in the owner's name without hiring counsel |
| **Managed Filing** | Jurisdiction-specific preparation and human-controlled submission | Reduce procedural burden while preserving proof and authorization |
| **Attorney Representation** | Vetted Illinois/property-tax counsel partner | Representation where only attorneys may practice or appear |
| **PTAB Escalation** | Post-decision packet, evidence grid, deadline workflow | Continue a qualifying case after the county decision |
| **Sale & Purchase Intelligence** | AI valuation, tax exposure, repair/condition, negotiation strategy | Make a better buy, sell, or hold decision |
| **Licensed Appraisal** | Credentialed appraiser partner reviews/inspects, signs, and assumes responsibility | Obtain a regulated appraisal when the intended use requires one |
| **Value Enhancement Plan** | Condition evidence plus prioritized improvement strategy | Focus spending on defensible marketability/value improvements |

## Non-Negotiable Boundaries

- An unsigned AI work product is an **AI-assisted valuation analysis**, not a certified, licensed, lender, or USPAP appraisal.
- A filing packet marked ready is not filed. Filing is confirmed only by durable proof such as a portal confirmation, accepted email, timestamped receipt, or certified-mail tracking event.
- Representative authority is jurisdiction- and forum-specific. Resourceful must fail closed when the eligible representative, authorization form, or signature requirement is unknown.
- Jurisdiction rules belong in versioned data and tested filing adapters, not generic browser automation.
- Resourceful must use dedicated Supabase and Vercel projects. Wireline infrastructure is out of scope.

## Architecture

- **Next.js 14**, React 18, strict TypeScript
- **Supabase** for Postgres, Auth, Storage, RLS, and workflow state
- **OpenAI Responses API**
  - GPT-5.6 Sol: valuation, narrative, filing, vision, and document analysis
  - GPT-5.6 Terra: research
  - GPT-5.6 Luna: extraction and classification
- **ATTOM** and approved public/licensed sources for property data
- **Azure Maps** for geocoding and autocomplete
- **Mapillary** for street-level imagery where permitted
- **Stripe** for payments
- **Resend** for transactional email
- **Vercel** for application hosting and scheduled workflows

Optional enrichment vendors are enabled only after contract, data-rights, accuracy, and unit-economics review.

## Core System Principles

- **Action over artifacts:** Dashboard states, tasks, deadlines, submissions, and outcomes matter more than PDF volume.
- **Human-controlled legal operations:** Automation prepares and verifies; final submission and representation follow the forum's rules.
- **Evidence provenance:** Every conclusion identifies its source and confidence.
- **Outcome calibration:** Granted values and reasons feed jurisdiction playbooks and model evaluation.
- **County-first launch:** Prove end-to-end quality in a small number of jurisdictions before broadening coverage.
- **Payment before full valuation:** Public screening remains conservative; the full workfile is a paid product.

## Important Paths

| Path | Purpose |
|---|---|
| `src/app` | Routes and customer/admin experiences |
| `src/components/landing` | Public positioning and conversion UX |
| `src/lib/pipeline` | Case-generation pipeline |
| `src/lib/services/openai-appraiser.ts` | GPT-5.6 Sol valuation, vision, document, and filing service |
| `src/lib/services/filing-service.ts` | Filing preparation and jurisdiction routing |
| `src/lib/pdf` | Customer work-product assembly |
| `src/lib/repository` | Typed data access |
| `supabase/migrations` | Database schema evolution |
| `docs/product-filing-and-appraisal-roadmap.md` | Product, compliance, and launch roadmap |

## Local Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Run the complete quality gate before merge or deployment:

```bash
pnpm check
```

## Shipping Standard

| Check | Requirement |
|---|---|
| Quality | Lint, type-check, tests, and production build pass |
| Security | Exposed credentials rotated; RLS and signed access verified |
| Database | Dedicated Resourceful project linked and migrations reconciled |
| AI | Representative evaluation set passes for the pinned model configuration |
| Payments | Test and live webhook idempotency verified |
| Filing | Jurisdiction rules current; no prepared case is mislabeled as submitted |
| Delivery | Intake → payment → case → review → filing workflow → proof works end to end |
| Operations | Health checks, Sentry, cron jobs, incident runbook, and rollback are active |

See `docs/production-runbook.md` and `docs/deploy-checklist.md` for deployment controls.
