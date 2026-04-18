# Architecture Rules

## Nationwide Rule — Most Important
This platform serves every county in every state. **No county-specific logic is hardcoded in application code.**

- All county-specific behavior comes from the `county_rules` database table:
  - Assessment ratios
  - Appeal board names
  - Filing deadlines
  - Form names
  - Hearing formats
- The data-router supports future county-specific API adapters via `county_rules.assessor_api_url`
- ATTOM is the universal data source and handles everything nationwide

## Code Organization
| What | Where |
|------|-------|
| AI model identifiers | `src/config/ai.ts` via `AI_MODELS.*` |
| Database queries | Typed repository functions in `src/lib/repository/` |
| External API calls | Typed service modules in `src/lib/services/` |
| Prices | `PRICING` constants from `src/config/pricing.ts` |
| Env vars | `.env.example` (documented), never hardcoded |

## Pipeline Rules
- Stages 1-7 run automatically (data collection → PDF assembly)
- Stage 8 marks report as `'delivered'` — **NEVER skip Stage 8**
- If Stage 8 delivery fails, fall back to `pending_approval` — email is non-fatal
- `pipeline_last_completed_stage` tracks resume point on failure
- `pipeline_error_log` (JSONB) captures stage errors

## Security Rules
- RLS is enabled on every Supabase table — never bypass without explicit justification
- **NEVER** use `NEXT_PUBLIC_` prefix on service role keys or secret keys
- Use the admin client (`createAdminClient`) only in server-side code, never in browser context
- Validate all inputs before passing to AI models or external APIs
