# Resourceful AI Operational Standards

This document codifies the engineering and operational standards for the Resourceful platform. All AI agents and human contributors must adhere to these principles.

## Core Engineering Principles

- **Dashboard-First Delivery:** All outputs must be delivered through the customer dashboard. Direct links to artifacts (like PDFs) should be signed, temporary, and generated on-demand.
- **Nationwide-First Architecture:** No county-specific logic should be hardcoded in the application. All jurisdiction-specific behavior must be driven by data in the `county_rules` table.
- **Strict Environment Validation:** All critical environment variables must be validated at startup via `src/instrumentation.ts` and `src/lib/utils/validate-env.ts`.
- **Structured Logging:** Use `src/lib/logger.ts` for all logging. Avoid `console.log` in production-bound code. Ensure PII (like emails) is masked using `src/lib/utils/pii.ts` before logging or sending to error trackers.
- **Type Safety:** Maintain strict TypeScript mode. Avoid `any` or `never` casts where possible. Ensure database row types match the schema exactly (see `src/types/database.ts`).

## AI & Data Trust

- **Payment Before Valuation:** The commercial model requires payment before revealing the full valuation.
- **Independent Evidence:** We prioritize proprietary data (user photos, measurements) and independent comparable analysis over county assessment data, which is treated as a baseline but not ground truth.
- **Dual-Provider Strategy:** Anthropic is our primary reasoning and narrative engine. Google Gemini handles multimodal vision and dense document OCR.

## Testing & Quality Assurance

- **Zero Regressions:** Every PR should be verified against the existing test suite (`pnpm test`).
- **Critical Paths:** Prioritize test coverage for:
    - Pricing logic (`src/config/pricing.ts`)
    - Template helpers for legal documents (`src/lib/templates/helpers.ts`)
    - Pipeline orchestration and stage skipping (`src/lib/pipeline/orchestrator.ts`)
    - API boundary validations (`src/lib/validations/report.ts`)
- **Pre-Deployment Check:** `pnpm lint && pnpm build` must pass before any deployment.

## Observability & Health

- **Sentry Integration:** All errors in production must be tracked in Sentry. PII masking must be applied in the `beforeSend` hook.
- **Health Checks:** The `/api/health` endpoint serves as the source of truth for service connectivity and environment readiness.

## Security

- **RLS Everywhere:** Every table in Supabase must have Row Level Security enabled.
- **Least Privilege:** API keys and service roles should only be used where necessary and never exposed to the client.
- **Content Security Policy:** Maintain a strict CSP in `next.config.mjs` to mitigate XSS and injection risks.
