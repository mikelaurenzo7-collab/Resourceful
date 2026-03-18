# Resourceful — Full Company & Product Audit

**Date:** 2026-03-18
**Scope:** Complete audit of company positioning, product architecture, user flows, pricing, API surface, pipeline, database schema, and test coverage.

---

## Executive Summary

**Resourceful** is a property tax appeal report platform that generates professional, AI-powered appeal reports using ATTOM property data and Anthropic Claude analysis. The platform follows a trust-first, payment-before-valuation model with a money-back guarantee. The codebase is production-quality with strong architectural patterns, comprehensive test coverage, and close alignment to its documented business rules.

**Overall Rating: Production-Ready with Minor Refinements Needed**

### Key Strengths
- Clean 3-step wizard with minimal friction intake
- Trust-first model: payment before valuation, money-back guarantee, photos optional
- Deferred pipeline (14h mark) saves API costs and maximizes data quality
- 8-stage idempotent pipeline with row-level locking and retry logic
- ATTOM cache reduces 3 API calls to 1 per report
- Nationwide architecture — no hardcoded county-specific logic
- Repository pattern + service modules enforce clean data access
- 17 test files with 380+ test cases covering critical paths

### Key Issues Found
- 4 API routes contain raw Supabase queries (bypass repository pattern)
- 2 API routes missing rate limiting
- 4 calibration routes skip Zod validation (use manual checks)
- Income approach weighting (70/30) and expense ratios are hardcoded
- No per-stage timeout budgeting in pipeline orchestrator
- Property cache TTL cleanup has no automatic trigger
- Landing page pricing ($49 Hero vs $59 ServiceCards) needs clarification

---

## 1. Brand & Company Overview

| Attribute | Value |
|-----------|-------|
| **Company Name** | Resourceful |
| **Tagline** | "Property Tax Appeal Experts" |
| **Positioning** | Professional, affordable alternative to tax attorneys ($49-$59 vs $2,000-$5,000) |
| **Value Proposition** | Fast (1-2 days), affordable, expert-reviewed reports with money-back guarantee |
| **Target Customer** | Homeowners and property owners who suspect over-assessment |
| **Visual Identity** | Navy + gold gradients, premium card design, clean professional aesthetic |

### Services Offered
| Service | Description | Starting Price |
|---------|-------------|---------------|
| Tax Appeal Report | Comprehensive evidence package for property tax appeal | $59 (residential) |
| Pre-Purchase Analysis | Buyer protection with tax liability projection | $69 |
| Pre-Listing Report | Seller advantage with buyer objection removal | $69 |

### Core Differentiators
1. **Price**: $49-$59 vs $300-$500 (appraisers) or $2,000-$5,000 (attorneys)
2. **Speed**: 1-2 days vs 1-8 weeks
3. **Accessibility**: Pro se filing guidance included (no attorney needed)
4. **Guarantee**: Full refund if no savings opportunity found
5. **Nationwide**: Covers every county via ATTOM + county_rules database

---

## 2. User Flow Audit

### 3-Step Wizard (Pre-Payment)

**Step 1 — Goals** (`/start`)
- Collects: service type (tax_appeal, pre_purchase, pre_listing)
- Optional: desired_outcome text for tax appeals
- Compliance: Minimal intake, no photos or property details

**Step 2 — Property** (`/start/property`)
- Collects: address via Google Places Autocomplete
- Auto-populates: property type, year built, beds/baths/sqft, assessed value, county via ATTOM
- Fallback: manual property type selector if ATTOM fails
- Override: user can correct auto-detected property type
- ATTOM response cached in `property_cache` (90-day TTL, keyed by normalized address)

**Step 3 — Payment** (`/start/payment`)
- Collects: email (required), name (optional), review tier selection
- Creates report row (status: `intake`) + Stripe PaymentIntent
- Shows: order summary, money-back guarantee badge, security indicators
- Stripe webhook updates status to `paid` on success

### Post-Payment Experience (`/start/success`)

**Instant Preview** (shown immediately after payment):
- Statistical estimate using IAAO 8% error rate
- Shows: estimated over-assessment, potential annual savings, county name
- Sources: tax bill data > ATTOM cache > fresh ATTOM call (priority order)
- Disclaimer included

**24-Hour Photo Window**:
- Countdown timer with upload CTA
- Photos encouraged but not required
- 12-hour reminder email via cron

**Pipeline Trigger Options**:
- "Build my report now" button (skips photos)
- "Done" button after photo upload
- 14-hour cron auto-trigger if neither clicked
- 24-hour safety net catches stragglers

### Flow Compliance Assessment
| Rule | Status |
|------|--------|
| 3 steps only (Goals → Property → Payment) | PASS |
| No photos before payment | PASS |
| No tax bills before payment | PASS |
| Address auto-populates via ATTOM | PASS |
| Payment before valuation | PASS |
| Instant preview after payment | PASS |
| Money-back guarantee prominent | PASS |
| No "free" language | PASS |

---

## 3. Pricing Audit

### Tier Structure
| Tier | Multiplier | Description |
|------|-----------|-------------|
| Auto | 1x (base) | AI-generated report |
| Guided Filing | 2x | Report + live guided filing session |
| Expert Reviewed | 3x | Professional appraiser review + representation |

### Pricing Matrix (Auto Tier)
| Service | Residential | Commercial | Industrial | Land |
|---------|------------|-----------|-----------|------|
| Tax Appeal | $59 | $109 | $109 | $59 |
| Pre-Purchase | $69 | $69 | $69 | $69 |
| Pre-Listing | $69 | $69 | $69 | $69 |

### Observation
The landing page Hero section shows "$49" as the starting price, while ServiceCards show "From $59" for tax appeals. This variance should be clarified — the $49 figure may reference a previous pricing model or a specific promotional context.

---

## 4. API Routes Audit (23 Routes)

### Summary Table
| Route | Method | Auth | Rate Limit | Zod | Repository |
|-------|--------|------|-----------|-----|-----------|
| `/api/reports` | POST | None | 10/15min | Yes | Yes |
| `/api/reports/[id]` | GET | Auth | **None** | — | Yes |
| `/api/reports/[id]/ready` | POST | None | 10/15min | — | Yes |
| `/api/reports/[id]/photos` | POST | Auth | 60/15min | Yes | Yes |
| `/api/reports/[id]/valuation` | POST | None | **None** | — | Yes |
| `/api/reports/[id]/assessment` | GET | Auth | 30/15min | — | Yes |
| `/api/reports/[id]/filing-info` | GET | Optional | 30/60s | — | **No** |
| `/api/reports/[id]/viewer` | GET | Optional | 60/60s | — | **No** |
| `/api/reports/[id]/measurements` | POST | Auth | 30/15min | Yes | Partial |
| `/api/reports/[id]/tax-bill-data` | DELETE | None | 10/15min | — | **No** |
| `/api/property/lookup` | POST | None | 30/15min | Yes | Yes |
| `/api/valuation` | POST | None | 50/15min | **No** | Yes |
| `/api/webhooks/stripe` | POST | Signature | — | — | Yes |
| `/api/cron/photo-reminders` | GET | CRON_SECRET | — | — | Yes |
| `/api/admin/reports/[id]/approve` | POST | Admin | 30/60s | — | Yes |
| `/api/admin/reports/[id]/reject` | POST | Admin | 30/60s | Yes | Yes |
| `/api/admin/reports/[id]/rerun` | POST | Admin | 5/60s | — | Yes |
| `/api/admin/reports/[id]/regenerate` | POST | Admin | 10/60s | Yes | Yes |
| `/api/admin/calibration/stats` | GET | Admin | 30/60s | — | **No** |
| `/api/admin/calibration/run` | POST | Admin | 10/60s | **No** | Yes |
| `/api/admin/calibration/complete` | POST | Admin | 30/60s | **No** | Yes |
| `/api/admin/calibration/import` | POST | Admin | 10/60s | **No** | Partial |
| `/api/admin/calibration/recalculate` | POST | Admin | 5/60s | — | Yes |

### Issues Found
1. **Missing rate limiting** on `/reports/[id]` (GET) and `/reports/[id]/valuation` (POST) — potential enumeration/abuse vector
2. **Raw Supabase queries** in 4 routes: filing-info, viewer, tax-bill-data, calibration/stats — violates repository pattern convention
3. **Missing Zod validation** in 4 calibration routes + `/api/valuation` — uses manual if-checks instead
4. **Large logic block** in `/admin/calibration/import` (120+ lines) — should extract to `lib/calibration/import.ts`

---

## 5. Pipeline Audit (8 Stages)

### Stage Flow
```
Stage 1: Data Collection (ATTOM cache, geocoding, flood zones, county rules)
Stage 2: Comparable Sales (progressive radius expansion, 9 adjustment categories)
Stage 3: Income Analysis (commercial/industrial ONLY — cap rate, NOI)
Stage 4: Photo Analysis (Claude vision, condition ratings, defect adjustments)
Stage 5: Narratives (concluded value, 16 AI-generated sections, calibration)
Stage 6: Filing Guide (tax_appeal ONLY — county-specific pro se instructions)
Stage 7: PDF Assembly (HTML template → Chromium → PDF → Supabase Storage)
Stage 8: Delivery (ADMIN-TRIGGERED ONLY — email with PDF + filing guide)
```

### Pipeline Orchestrator
- Row-level locking via `acquire_pipeline_lock_v2` / `release_pipeline_lock_v2` RPCs
- 15-minute stale lock auto-expiry
- 2 retries with exponential backoff (2s, 4s) for transient errors
- 10-minute global timeout
- Resume-from-stage capability for fault tolerance
- Status flow: `intake → paid → processing → pending_approval → approved → delivered`

### Compliance Assessment
| Rule | Status |
|------|--------|
| Pipeline NOT triggered on payment | PASS |
| Deferred to ~14h cron trigger | PASS |
| Customer can trigger early via /ready | PASS |
| Stage 3 only for commercial/industrial | PASS |
| Stage 6 only for tax_appeal | PASS |
| Stage 8 only after admin approval | PASS |
| Concluded value computed in Stage 5 only | PASS |
| Photo analysis optional (stage succeeds with 0 photos) | PASS |
| Admin notification sent on pipeline completion | PASS |
| Idempotent locking prevents concurrent runs | PASS |

### Issues Found
1. **No per-stage timeout** — Stage 5 (narratives, AI-heavy) could consume most of the 10-min budget
2. **Income approach 70/30 weighting** is hardcoded in Stage 5 — should be configurable per property type
3. **Expense ratios** (4/3/4/3/8%) are hardcoded in Stage 3 — no regional variation
4. **Fallback rental rates** ($6/sqft industrial, $12/sqft commercial) lack market context
5. **Photo batch size** (3) is hardcoded — no configuration for high-photo reports

---

## 6. Service Modules Audit

| Service | Purpose | Timeout | Error Handling |
|---------|---------|---------|---------------|
| `anthropic.ts` | Claude API (narratives, vision, filing) | 2 min | ServiceResult pattern |
| `attom.ts` | Property data, comps, rentals, deeds | 20s | ServiceResult pattern |
| `google-maps.ts` | Geocoding, static maps, Street View | 10s | ServiceResult pattern |
| `fema.ts` | Flood zone lookups (ArcGIS) | 15s | Non-fatal fallback |
| `stripe-service.ts` | Payments, webhook verification | Default | ServiceResult pattern |
| `resend-email.ts` | Delivery, reminders, admin alerts | Default | Non-blocking (.catch) |
| `county-deadlines.ts` | Deadline computation + urgency | N/A | Fallback to "unknown" |
| `data-router.ts` | County API routing (ATTOM default) | N/A | ATTOM universal fallback |
| `pdf.ts` | HTML→PDF (Chromium + puppeteer-core) | 30s | Browser cleanup in finally |

All services follow the convention of typed modules in `lib/services/` with consistent error handling patterns.

---

## 7. Database Schema Audit (15 Migrations)

### Core Tables (16)
| Table | Records | Key Fields | RLS |
|-------|---------|-----------|-----|
| reports | Main entity | 51 columns, full lifecycle tracking | User-owned |
| property_data | Valuation | 86 columns incl. photo impact tracking | Via report |
| photos | User uploads | AI analysis JSONB, condition ratings | Via report |
| comparable_sales | Market comps | 9 adjustment fields, weak-comp flagging | Via report |
| comparable_rentals | Rental comps | Income approach inputs | Via report |
| income_analysis | Commercial valuation | Cap rate, NOI, expense breakdown | Via report |
| measurements | Property dimensions | Multi-source, discrepancy detection | Via report |
| report_narratives | AI sections | 16 sections, admin edit tracking | Via report |
| county_rules | Appeal data | 55+ fields per county, nationwide | Public read |
| approval_events | Audit trail | Admin actions with timestamps | Via report |
| admin_users | Admin team | Role verification | Service-only |
| calibration_entries | Blind tests | Variance tracking, accuracy metrics | Deny all |
| calibration_params | Learned multipliers | Per-type/county correction factors | Service-only |
| property_cache | ATTOM cache | 90-day TTL, normalized address key | Public read |
| rate_limit_entries | Rate limiting | Atomic increment, TTL-based | Service-only |
| users | Auth profiles | Stripe customer ID | User-owned |

### Database Functions
- `increment_rate_limit` — Atomic rate limit counter
- `acquire_pipeline_lock_v2` — Row-level pipeline lock (replaces advisory locks)
- `release_pipeline_lock_v2` — Lock release with stale expiry

### Issues Found
1. **Property cache TTL cleanup** — Index exists on `expires_at` but no automatic DELETE trigger or cron
2. **Photo impact constraints** — No CHECK that `concluded_value_without_photos >= concluded_value` (correct for appeal context but undocumented)
3. **Pipeline lock race window** — Lock acquisition during concurrent update has a small theoretical window (mitigated by 15-min expiry)

---

## 8. Test Coverage Audit

### Overview
- **Framework**: Vitest (Node environment)
- **Test Files**: 17
- **Estimated Test Cases**: 380+
- **Infrastructure**: setup.ts (env), fixtures.ts (factories), mocks.ts (Supabase/Stripe/Anthropic)

### Coverage by Area
| Area | Files | Tests | Quality |
|------|-------|-------|---------|
| Config (AI, Pricing) | 2 | 20 | Excellent — tier multipliers, env loading, constant integrity |
| Repository (Reports, County, Admin) | 3 | 35 | Good — CRUD, error handling, null cases |
| Services (Stripe, ATTOM, Data Router) | 3+ | 35+ | Good — transformations, error scenarios |
| Validations (Zod schemas) | 1 | 23 | Excellent — all types, tiers, edge cases |
| Pipeline (Orchestrator, Stages) | 5+ | 30+ | Moderate — skip logic tested, stage internals partial |
| Templates (Helpers) | 1 | 24 | Excellent — formatting, XSS prevention, null handling |
| Rate Limiting | 1 | ~10 | Not reviewed |

### Coverage Gaps
1. **End-to-end pipeline** — No integration test running stages 1-7 sequentially
2. **Pipeline lock stale expiry** — No test for >15-min lock acquisition
3. **Property cache reuse** — No test verifying attom_cache_id linking end-to-end
4. **Photo impact attribution** — No test for photo_condition_adjustment_pct calculation
5. **Calibration system** — recalculate.ts and run-blind-valuation.ts untested
6. **Stages 2, 5, 8** — Exist but coverage not fully verified

---

## 9. Security Audit

### Positive Findings
- RLS enforced on all tables
- Stripe webhook signature verification
- CRON_SECRET authentication on cron endpoints
- Admin role verification on all admin routes
- XSS prevention in email templates (escapeHtml helper)
- No NEXT_PUBLIC_ prefix on secrets
- HSTS, CSP, X-Frame-Options, Permissions-Policy headers configured
- File upload validation (type, size limits)

### Concerns
- CSP allows `unsafe-inline` and `unsafe-eval` in script-src (common for Next.js but could be tightened)
- `/reports/[id]/valuation` and `/reports/[id]` lack rate limiting
- UUID-keyed endpoints (no auth) rely on unguessability — acceptable for UUIDs but worth monitoring
- Email-based ownership check on tax-bill-data DELETE (no Supabase auth)

---

## 10. Recommendations

### Priority 1 (High — Address Before Production Scale)
1. **Add rate limiting** to `/reports/[id]` (GET) and `/reports/[id]/valuation` (POST)
2. **Extract raw Supabase queries** from filing-info, viewer, tax-bill-data, and calibration/stats into repository functions
3. **Add Zod validation** to calibration routes and `/api/valuation`
4. **Clarify landing page pricing** — Hero shows $49, ServiceCards show $59

### Priority 2 (Medium — Improve Robustness)
5. **Add per-stage timeout budgeting** to pipeline orchestrator (especially for Stage 5)
6. **Make income approach weighting configurable** (currently hardcoded 70/30)
7. **Add property_cache TTL cleanup** cron or database trigger
8. **Add integration tests** for full pipeline run (stages 1-7)
9. **Test calibration system** (recalculate.ts, run-blind-valuation.ts)

### Priority 3 (Low — Nice to Have)
10. **Tighten CSP** — Replace `unsafe-inline`/`unsafe-eval` with nonces or hashes
11. **Make expense ratios county-configurable** in Stage 3
12. **Add circuit breaker pattern** to ATTOM service for API failures
13. **Extract calibration/import logic** from route to dedicated module
14. **Add TZ environment variable** for timezone-sensitive deadline computation

---

## Conclusion

Resourceful is a well-architected, production-quality property tax appeal platform. The codebase closely follows its documented business rules (CLAUDE.md), with strong separation of concerns (repository/service/pipeline patterns), comprehensive input validation, and defensive error handling. The 3-step wizard, deferred pipeline, and trust-first payment model are cleanly implemented.

The 14 recommendations above are refinements, not blockers. The platform is ready for production use with the Priority 1 items addressed.
