# Resourceful

Resourceful is an **AI-led property tax and property intelligence business**. Instead of positioning the product as a one-off report shop, the platform is now framed as an operating system that Claude (Anthropic) runs on behalf of the company and its customers, with Gemini Vision handling multimodal photo analysis. The core idea is simple: Claude handles valuation research, comparable sales analysis, condition evidence review, county workflow preparation, and customer-ready case assembly so the business can scale with more consistency and less manual overhead.

This repository contains the customer-facing application, intake flow, pricing logic, dashboard delivery model, and supporting infrastructure for that business.

## Business Vision

The revised product vision treats Resourceful as a **compounding AI operator**, not just a document generator.

| Dimension | Previous framing | New framing |
|---|---|---|
| Core promise | Professional property tax appeal reports | Claude runs the property tax workflow end to end |
| Business model | Primarily report delivery | Multi-lane AI property intelligence business |
| Customer value | Get a report | Get an action package and next move |
| Strategic edge | Faster reporting | A system that compounds county knowledge and outcome data |
| Expansion path | Appeal support | Appeals, acquisition diligence, and seller strategy |

The business now emphasizes three strategic beliefs.

First, **property tax reduction is the wedge**, because it is painful, urgent, measurable, and easy for customers to understand.

Second, the same operating system can support multiple monetization lanes. Comparable analysis, valuation logic, workflow memory, and customer packaging can power tax reduction, acquisition intelligence, and seller strategy from the same core engine.

Third, the long-term value of the company comes from **compounding operational intelligence**. Every finished case strengthens the workflow library, county-specific playbooks, and the system’s ability to surface the best next action.

## Core Product Model

- **Dashboard-first delivery:** outputs are delivered in the customer experience, not as fragile expiring links.
- **Payment before valuation:** the commercial model still charges before revealing the completed output.
- **Nationwide workflow memory:** county-specific logic belongs in `county_rules`, not hardcoded UI copy or route handlers.
- **Admin-gated release:** the pipeline still supports review and approval before final customer delivery.
- **Outcome loop:** delivered work should continue feeding learning, calibration, and workflow refinement.

## Revenue Lanes

| Lane | Strategic role | Customer outcome |
|---|---|---|
| **Tax Reduction Engine** | Core wedge and most direct savings story | Lower an over-assessment with a Claude-built case |
| **Acquisition Intelligence** | Expand into pre-transaction diligence | Understand price, tax burden, and appeal risk before buying |
| **Seller Strategy Intelligence** | Strengthen seller and agent positioning | Give buyers a clearer tax story and pricing rationale |
| **Autopilot Appeal** | High-touch premium offer | Let Claude coordinate the workflow while humans execute filing and hearings where needed |

## Positioning Principles

When editing or extending the product, keep these principles intact.

| Principle | Guidance |
|---|---|
| **AI-first, not AI-washed** | Claude should be presented as actually operating core business workflows, not as a decorative assistant. |
| **Action over artifacts** | The product should feel like a next-step machine, not just a PDF generator. |
| **Compoundable systems** | Prefer changes that improve reusable workflows, structured memory, and feedback loops. |
| **Human judgment where necessary** | Use human review and representation for leverage, risk control, and trust. |
| **Measured value** | Keep copy close to savings, speed, operational leverage, and execution clarity. |

## Stack

- **Next.js 14** App Router, TypeScript strict mode
- **Supabase** for Postgres, Auth, Storage, and RLS
- **Anthropic Claude** for narrative generation and classification
- **Google Gemini** for multimodal image and document analysis
- **ATTOM Data API** for property details and comparable data
- **Azure Maps** for geocoding and autocomplete
- **Mapillary** for street-level imagery
- **Stripe** for payments and subscriptions
- **Resend** for transactional email
- **@sparticuz/chromium + puppeteer-core** for PDF generation
- **Vercel** for deployment and scheduled execution

Optional enrichment services remain available for specialized workflows.

## Important Paths

| Path | Purpose |
|---|---|
| `src/app` | App routes and page-level UX |
| `src/components/landing` | Homepage messaging and positioning |
| `src/lib/pipeline` | Report and case-generation pipeline |
| `src/lib/pdf` | PDF assembly logic |
| `src/lib/templates` | HTML report helpers |
| `src/lib/services` | External integrations |
| `src/lib/repository` | Typed data access |
| `supabase/migrations` | Database schema evolution |

## Local Development

1. Install dependencies.
2. Create `.env.local` from `.env.example`.
3. Start local services if required.
4. Run the app and validate the build.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

Helpful scripts include:

- `scripts/setup-local.sh`
- `scripts/seed-counties.ts`
- `scripts/seed-top-counties.ts`
- `scripts/rerun-report.ts`
- `scripts/debug-lock.ts`

## Environment

Production requires the standard application, data, and billing keys already documented in `.env.example`, including keys for AI providers, Supabase, ATTOM, Azure Maps, Stripe, Resend, and canonical app configuration.

Optional enrichment keys may be enabled as needed for additional data workflows.

## Shipping Standard

Before deploying changes, confirm the following.

| Check | Requirement |
|---|---|
| Quality | `pnpm lint && pnpm build` pass on the release commit |
| Database | Required migrations are applied |
| Payments | Stripe checkout and webhook flow are verified |
| Delivery | End-to-end customer flow works from intake to output |
| County logic | Jurisdiction rules are stored in data, not hardcoded |
| Review | Admin approval path remains functional where required |
| URLs | Canonical app URL is correct for metadata and email links |

## Operational Note

The most important architectural rule is that **the operating system must stay real**. If future changes make Claude look more central in the marketing copy, the underlying workflow should become more central in the product as well. The brand promise only works if the business genuinely becomes easier to run, easier to scale, and more valuable with each completed case.

## Deployment Runbook

See `docs/production-runbook.md` for deployment and incident-response details.
