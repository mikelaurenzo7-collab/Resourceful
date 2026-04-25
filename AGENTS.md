# Resourceful Operational Standards (AGENTS.md)

As an AI-led property tax business, we maintain an "immaculate" codebase to ensure reliability, scalability, and security. Follow these standards for all contributions.

## Core Principles

- **Production-Ready by Default**: Every commit should be stable, typed, and linted.
- **AI-Native Architecture**: AI is a core operator, not an add-on. Keep `config/ai.ts` as the source of truth for models.
- **Data Integrity**: Never trust a single source. Cross-reference ATTOM with county data and user evidence.
- **Security First**: RLS on every table. Never leak PII (emails) into logs or Sentry.

## Coding Standards

### TypeScript & Linting
- Strict mode is mandatory.
- Avoid `any` at all costs. Use Zod schemas for external data boundaries.
- Run `pnpm lint` and `pnpm build` before submitting.

### Logging & Error Tracking
- Use `lib/logger.ts` for structured logging. Do not use `console.log`.
- All errors in production must be captured by Sentry.
- Use `maskEmails` from `lib/utils/pii.ts` for any user-identifiable strings.

### Testing (Vitest)
- Pure functions in `lib/templates/helpers.ts` and `config/pricing.ts` MUST have 100% coverage.
- API routes should have integration tests with mocked dependencies.
- Use `pnpm test` to verify no regressions.

## Database (Supabase)
- Use `lib/repository/` for all data access. Avoid direct Supabase client calls in components.
- Migrations must be numbered sequentially and never modified once applied.
- RLS must be enabled and verified for all new tables.

## Pipeline Integrity
- The `orchestrator.ts` is the single point of truth for the generation flow.
- Stages must be idempotent where possible.
- Use the `pipeline_error_log` for debugging failed reports.

## External Services
- **Stripe**: Handle webhooks idempotently. Never trigger critical business logic solely from the frontend.
- **AI**: Use `FAST` models for classification and `PRIMARY` for reasoning. Handle rate limits and timeouts gracefully with retries.

## Deployment Checklist
1. `pnpm lint`
2. `pnpm test`
3. `pnpm build`
4. Verify RLS: `select tablename, rowsecurity from pg_tables where schemaname = 'public';`
5. Test /api/health with `deepCheck=true` (internal only).

---
*Resourceful is a compounding AI operator. Every change should make the system smarter, faster, and more robust.*
