# Test Coverage Analysis

## Current State

The codebase has **zero tests** — no test framework, no test files, no test scripts, and no coverage tooling. The only quality gates are ESLint and TypeScript strict mode.

---

## Priority Areas for Test Coverage

### Priority 1: Pure Functions (Unit Tests — Highest ROI)

These files contain deterministic, side-effect-free functions that are trivial to test and extremely valuable to protect.

| File | Functions | Why It Matters |
|---|---|---|
| `src/lib/templates/helpers.ts` | `formatCurrency`, `formatCurrencyWords`, `formatPercent`, `formatSqFt`, `formatLotSize`, `formatDate`, `formatDateShort`, `escapeHtml`, `formatNumber`, `adjustmentLabel`, `fullAddress`, `getConditionColor`, `imageOrPlaceholder`, `safeVal` | These render into **legal PDF documents** sent to clients. A formatting bug in `formatCurrencyWords` (e.g. wrong dollar amount in words) could undermine a tax appeal. Edge cases: negative numbers, zero, NaN, very large values, invalid dates. |
| `src/config/pricing.ts` | `getPriceForReport`, `formatPrice` | Pricing logic directly affects revenue. The tax-bill discount rounding (`Math.round((base * 0.85) / 100) * 100`) needs explicit test cases for all service/property/tier/discount combinations to prevent charging the wrong amount. |
| `src/lib/validations/report.ts` | Zod schemas: `reportCreateSchema`, `measurementSchema`, `photoUploadSchema`, `countyRuleSchema`, `adminRejectSchema` | Validation is the API boundary. Tests should verify that valid inputs pass, invalid inputs fail with correct error messages, and edge cases (empty strings, null vs undefined, boundary values like `assessment_ratio` at 0 and 1) behave correctly. |

**Estimated effort:** Low. No mocking required. ~50-80 test cases.

---

### Priority 2: Data Transformation Logic (Unit Tests with Mocking)

| File | Functions | Why It Matters |
|---|---|---|
| `src/lib/services/data-router.ts` | `attomToCollected`, `mergeCountyData`, `collectPropertyData` | The ATTOM-to-internal mapping (`attomToCollected`) is a pure function that can be tested without network calls. `mergeCountyData` has precedence rules (county > ATTOM for assessed values, ATTOM > county for physical attributes) that must be correct or the wrong data propagates through the entire pipeline. |
| `src/lib/calibration/run-blind-valuation.ts` | Comp adjustment calculations, search tier selection | The blind valuation math (size adjustments, condition adjustments, market trend adjustments) is used for calibration. Incorrect adjustments silently corrupt calibration feedback loops. The search tier logic per property type should be tested for correct escalation. |
| `src/lib/rate-limit.ts` | `getClientIp`, window key calculation | `getClientIp` parses `x-forwarded-for` headers — a wrong parse means rate-limiting the wrong entity. The window calculation math (floor division for fixed windows) has edge cases at window boundaries. |

**Estimated effort:** Medium. `attomToCollected` and `mergeCountyData` need no mocks. `collectPropertyData` needs ATTOM service mocked.

---

### Priority 3: Pipeline Orchestrator (Integration Tests)

| File | What to Test |
|---|---|
| `src/lib/pipeline/orchestrator.ts` | **Stage skip logic:** Stage 3 (income) runs only for commercial/industrial. Stage 6 (filing) runs only for tax_appeal. Test that residential tax appeals skip stage 3, commercial pre-purchase skips stage 6, etc. **Resume logic:** Starting from stage N should skip stages 1 through N-1. **Failure handling:** A stage returning `{ success: false }` should write to `pipeline_error_log`, set status to 'failed', and release the lock. **Lock behavior:** If lock is not acquired, pipeline should abort immediately. |
| `src/lib/pipeline/stages/*` | Each stage (1-8) should have at least smoke tests with mocked Supabase/API dependencies verifying that given valid input data, the stage produces the expected output shape and writes to the correct DB columns. |

**Estimated effort:** High. Requires mocking Supabase client and external APIs. The orchestrator's sequential stage execution and error propagation logic is the most critical integration to protect.

---

### Priority 4: API Route Handlers (Integration Tests)

| Route | What to Test |
|---|---|
| `src/app/api/reports/route.ts` | Report creation: validates input, applies pricing, creates Stripe checkout session, returns correct response shape. |
| `src/app/api/valuation/route.ts` | Pre-payment valuation endpoint: returns statistical estimate only (per CLAUDE.md, must NOT compare against ATTOM marketValue). |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook signature verification, idempotency on duplicate events, correct status transitions on payment success/failure. |
| `src/app/api/admin/reports/[id]/approve/route.ts` | Admin approval triggers delivery (stage 8). Auth check ensures only admins can call it. |
| `src/app/api/admin/calibration/*` | Calibration endpoints handle edge cases: no data, partial data, recalculation with stale inputs. |

**Estimated effort:** High. Requires mocking Next.js request/response, Supabase, Stripe, and Resend.

---

### Priority 5: Component Tests (React Testing Library)

| Component | What to Test |
|---|---|
| `src/components/intake/MeasurementTool.tsx` | User input → measurement schema output. Discrepancy flagging when user vs ATTOM sqft differ beyond threshold. |
| `src/components/intake/PhotoUploader.tsx` | File type validation, upload state management, sort ordering. |
| `src/components/intake/AddressInput.tsx` | Google Places autocomplete integration, address parsing into structured fields. |
| `src/components/dashboard/PipelineProgress.tsx` | Correct stage rendering for each pipeline state (processing, failed, pending_approval, completed). |
| `src/components/admin/ReviewControls.tsx` | Approve/reject/regenerate actions dispatch correctly. |

**Estimated effort:** Medium-High. Requires React Testing Library setup and component mocking.

---

## Recommended Test Framework Setup

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

**Why Vitest over Jest:** Native ESM support (this project uses Next.js 14 with TypeScript), faster execution, compatible with the existing Vite/Next.js toolchain, and first-class TypeScript support without extra config.

---

## Suggested Implementation Order

1. **Set up Vitest** with a basic config and a `test` script in package.json
2. **`src/lib/templates/helpers.test.ts`** — highest value, zero dependencies, fast to write
3. **`src/config/pricing.test.ts`** — protect revenue logic, small surface area
4. **`src/lib/validations/report.test.ts`** — protect API boundaries
5. **`src/lib/services/data-router.test.ts`** — protect data transformation correctness
6. **`src/lib/pipeline/orchestrator.test.ts`** — protect pipeline execution logic
7. **API route tests** — protect external-facing endpoints
8. **Component tests** — protect user-facing interactions

---

## Key Risk Areas Without Tests

- **Silent pricing bugs:** The discount rounding in `getPriceForReport` could charge $41 instead of $42 (or vice versa) without anyone noticing until revenue reconciliation.
- **Template formatting in legal documents:** `formatCurrencyWords(1_000_000)` producing incorrect English could invalidate a tax appeal filing.
- **Pipeline stage skipping:** If the `skipWhen` predicate for stage 3 or 6 regresses, commercial properties would miss income analysis, or non-tax-appeal reports would get unnecessary filing guides.
- **Data merge precedence:** If `mergeCountyData` stops preferring county assessed values, reports would silently use stale ATTOM data even when fresher county data is available.
- **XSS in PDFs:** The `escapeHtml` function protects against injection in rendered PDFs. A regression here is a security vulnerability.
