# Operational Standards & Principles

This document codifies the core architectural, operational, and engineering standards for Resourceful. These principles ensure the platform remains production-ready, scalable, and true to its "AI-led" promise.

## 1. Engineering Principles

- **Structured Logging:** All logs must use the centralized `logger` (Pino) from `@/lib/logger`. Standard `console.log` is for local debugging only and should not be committed.
- **PII Masking:** Personally Identifiable Information (primarily emails) must be masked before being sent to external log aggregators or error trackers. Use the utility in `src/lib/utils/pii.ts`.
- **Environment Validation:** New critical environment variables must be added to `src/lib/utils/validate-env.ts` to ensure the application fails fast at startup if misconfigured.
- **Strict TypeScript:** No `any` types. All data access must be typed via `@/lib/repository`.
- **Atomic Operations:** Database updates, especially those affecting report status or payment, must be atomic and idempotent.

## 2. AI Operational Standards

- **Claude as the Operator:** Anthropic Claude (Sonnet) is the primary engine for narrative generation and classification.
- **Gemini for Vision:** Google Gemini Vision is the primary engine for multimodal analysis (photo and document review).
- **Service Resilience:** External AI calls must implement retry logic with exponential backoff. See `src/lib/utils/retry.ts`.
- **Configuration over Hardcoding:** Jurisdiction-specific rules and AI prompts should be stored in the database (`county_rules`) or specialized configuration files, never hardcoded in UI components.

## 3. Production Readiness

- **Health Checks:** The `/api/health` endpoint is the source of truth for service connectivity (Supabase, Stripe, AI).
- **Sentry Integration:** Errors are tracked via Sentry. Configuration is centralized in `src/instrumentation.ts` (for server/edge) and `sentry.client.config.ts` (for browser).
- **Database Migrations:** All schema changes must be handled via Supabase migrations. Manual schema changes in production are prohibited.
- **Testing Standard:** Every new feature should include unit or integration tests using Vitest. The goal is to maintain high confidence in the core pipeline and pricing logic.

## 4. Maintenance & Incident Response

- **Stuck Reports:** If a report is stuck in `paid` or `processing`, use the `scripts/debug-lock.ts` and `scripts/rerun-report.ts` tools to diagnose and recover.
- **Manual Intervention:** Only use `scripts/unlock.sql` as a last resort when the pipeline lock is definitely stale.
- **Performance:** Maintain the 300s timeout for the pipeline webhook and 120s for PDF assembly to ensure reliable delivery of complex reports.
