# Property Intelligence Platform — CLAUDE.md

## What This Is
A nationwide property intelligence platform that generates professional analysis reports using AI, public property data APIs, and owner-provided photographs. We offer three core services — **Tax Appeal**, **Pre-Purchase**, and **Pre-Listing** — for every property type across every county in the United States. We fight for the client in every situation, deploying advanced appraisal strategies tailored to their property type, county rules, and desired outcome.

Reports are automatically delivered to clients after the pipeline completes all stages (1-8). Stage 8 sends the PDF and action guide via email. If auto-delivery fails, the report falls back to `status = 'pending_approval'` for admin manual delivery. Admin can review, reject, or re-run reports via the admin dashboard.

---

## Three Core Services

### 1. Tax Appeal — Fight the Overassessment
**Objective**: Prove the county has overvalued the property and secure a reduction in assessed value, lowering the client's tax bill.

**Analyses run**: Sales comparison (all types) + income approach (commercial/industrial) + cost approach (all types) + uniformity/equity + physical/functional/economic obsolescence

**Advanced strategies**:
- **Market approach**: Adjusted comparable sales proving lower market value
- **Income approach**: NOI/cap rate proving income-justified value is below assessment
- **Cost approach**: Replacement cost new minus all forms of depreciation
- **Uniformity/equity**: Identify similarly-situated parcels assessed at lower ratios — proves unequal treatment under state constitution
- **Functional obsolescence**: Design defects, super-adequacy, floor plan obsolescence, mechanical system failures
- **Economic obsolescence**: External factors (nearby industrial, road changes, market decline, environmental stigma)
- **Physical depreciation**: Photo-documented deferred maintenance, effective age analysis (IAAO/Marshall & Swift)
- **Procedural errors**: Wrong property class, wrong acreage/sqft, wrong number of units, improper notice, assessment outside statute window
- **Assessment ratio analysis**: Compare assessed-to-market ratio against county average (COD/PRD analysis)

**Filing deliverables**: County-specific appeal form prefill, evidence checklist, deadline, board name, hearing format, strongest 3 arguments, pro se script or authorized rep instructions

---

### 2. Pre-Purchase — Know Before You Buy
**Objective**: Arm the buyer with an independent, data-driven fair market value, a complete risk profile, and negotiation leverage before closing.

**Analyses run**: Sales comparison + cost approach + income approach (investment properties) + tax trajectory forecast + red flag scan

**Advanced strategies by outcome**:
- **Buying at market**: Confirm listing price is justified; flag overpriced listings immediately
- **Negotiating down**: Identify comp-supported lower value; generate written negotiation memo with specific dollar justification
- **Investment analysis**: Projected NOI, cap rate, gross rent multiplier, cash-on-cash return, IRR at list vs. offer price
- **Tax planning**: Project assessed value post-purchase; estimate annual tax bill; flag counties with aggressive reassessment-on-sale policies
- **Due diligence depth**: Deferred maintenance cost estimate from photos; flood zone risk; functional layout score; environmental flag
- **Red flags**: Distressed sale history, title encumbrances flagged in ATTOM deed history, rapid turnover patterns
- **Highest & best use**: Confirm that the listed use is the HBU, or flag potential upside if it isn't

**Action deliverables**: Independent value conclusion, negotiation memo, projected tax bill, red flag summary, investment metrics (if applicable)

---

### 3. Pre-Listing — Maximize What You Sell For
**Objective**: Give the seller a defensible listing price with full market context, plus targeted value-add recommendations to maximize net proceeds before listing.

**Analyses run**: Sales comparison + cost approach + value-add ROI analysis + market timing + buyer profile targeting

**Advanced strategies by outcome**:
- **Pricing to sell fast**: Find the comp-supported sweet spot that drives multiple offers
- **Pricing for maximum proceeds**: Identify features that command premiums; find the ceiling the market will support
- **Value-add ROI**: Rank every possible improvement by net return (kitchen, bath, landscaping, roof, HVAC, paint) — only recommend if ROI > cost
- **Functional obsolescence cure**: Identify curable items that buyers will ask to negotiate away; eliminate them pre-listing
- **Buyer profile targeting**: Based on property type, location, and price band, identify the likely buyer profile and tailor staging/marketing strategy to that buyer
- **Market timing**: Compare absorption rate, days on market trend, and seasonal patterns to advise on optimal list date
- **Tax implication of listing price**: Identify if listing price triggers reassessment in the buyer's hands; use to set price just below threshold in counties where this matters
- **Assessment vs. list price gap**: If current assessed value is far below list price, flag it — it will be used by the buyer in negotiations

**Action deliverables**: Listing price recommendation with range and ceiling, value-add priority list with ROI estimates, comparable sales grid, market timing memo, buyer profile brief

---

## Property Type Matrix

The platform handles every property type. All subtypes route through ATTOM and the county_rules table — no hardcoded county logic.

### Residential
| Subtype | Internal Key | Notes |
|---|---|---|
| Single-Family Residence | `residential_sfr` | Most common; all three services |
| Condominium / Townhouse | `residential_condo` | Common element issues affect value |
| 2–4 Unit Multi-Family | `residential_multifamily` | Income approach available |
| Mobile / Manufactured | `residential_manufactured` | Title type matters; land-home vs. personal property |
| Cooperative (Co-op) | `residential_coop` | Share-based; uncommon outside NYC |

### Commercial
| Subtype | Internal Key | Notes |
|---|---|---|
| Retail Strip / Shopping Center | `commercial_retail_strip` | Anchor tenant analysis critical |
| Office Building | `commercial_office` | Remote-work vacancy risk |
| Restaurant / Food Service | `commercial_restaurant` | High functional obsolescence rate |
| Hotel / Motel | `commercial_hotel` | RevPAR income approach |
| Mixed-Use | `commercial_mixed_use` | Blended approach residential + commercial |
| Apartment Complex (5+ units) | `commercial_apartment` | Pure income approach; cap rate driven |
| Medical / Healthcare | `commercial_medical` | Build-out cost, specialized use |
| Self-Storage | `commercial_self_storage` | High NOI margins; cap rate sensitive |
| General Commercial | `commercial_general` | Catch-all fallback |

### Industrial
| Subtype | Internal Key | Notes |
|---|---|---|
| Warehouse / Distribution | `industrial_warehouse` | Clear height, dock count matter |
| Manufacturing / Heavy Industrial | `industrial_manufacturing` | Specialized equipment, contamination risk |
| Flex / R&D Space | `industrial_flex` | Office component ratio matters |
| Cold Storage | `industrial_cold_storage` | High mechanical cost, low cap rate |
| Industrial General | `industrial_general` | Fallback |

### Land
| Subtype | Internal Key | Notes |
|---|---|---|
| Vacant Residential | `land_residential` | Zoning/entitlement status drives value |
| Vacant Commercial | `land_commercial` | Highest & best use analysis critical |
| Agricultural | `land_agricultural` | Income from crops/leases; special valuation rules in many states |
| Timberland | `land_timberland` | Standing timber value separate from land |
| Vacant Land (General) | `land_general` | Catch-all |

### Special Purpose
| Subtype | Internal Key | Notes |
|---|---|---|
| Assisted Living / Senior Housing | `special_senior_living` | Per-bed income approach |
| Car Wash | `special_car_wash` | Revenue-based valuation |
| Parking Lot / Garage | `special_parking` | Income per space approach |
| Religious / Institutional | `special_institutional` | Often exempt — note if appeal is to contest exemption |

---

## Strategy Engine — How We Tailor Every Report

The pipeline selects and weights strategies based on four inputs: **service type**, **property type**, **desired outcome**, and **county rules**. This is not a one-size-fits-all report.

### Service Type → Stage Routing
```
tax_appeal    → All 8 stages: data → comps → income → photos → narratives → filing guide → PDF → delivery
pre_purchase  → Stages 1-5 + custom buyer guide (Stage 6) → PDF → delivery
pre_listing   → Stages 1-5 + custom listing strategy (Stage 6) → PDF → delivery
```

### Property Type → Approach Weights
```
residential_sfr / condo          → Sales comparison (primary) + cost approach (secondary)
residential_multifamily          → Sales comparison + income approach (NOI/GRM)
commercial / industrial          → Income approach (primary) + sales comparison + cost
land                             → Sales comparison + income from use + HBU analysis
special_purpose                  → Income approach (primary); cost as upper bound
```

### County Rules → Filing Strategy (tax_appeal only)
Every county has different: appeal deadlines, assessment ratios, authorized rep rules, board names, form names, hearing formats, equity analysis standards. All driven from `county_rules` table — never hardcoded.

### Desired Outcome → Narrative Emphasis
- `reduce_taxes` → Lead with overassessment magnitude; equity comps; strongest defect evidence
- `negotiate_purchase` → Lead with value gap below ask; red flags; buyer's leverage points
- `maximize_sale_price` → Lead with upside comps; value-add ROI; market timing
- `investment_analysis` → Lead with income metrics; cap rate; cash-on-cash; tax trajectory
- `due_diligence` → Lead with risk factors; deferred maintenance cost; flood/environmental

---

## Nationwide Architecture Rule
This platform serves every county in every state. ATTOM is the universal data source that covers the entire country. No county-specific logic is hardcoded in application code. All county-specific behavior comes from the `county_rules` database table: assessment ratios, appeal board names, filing deadlines, form names, hearing formats, authorized rep rules. The data-router supports future county-specific API adapters via `county_rules.assessor_api_url`, but none are required — ATTOM handles everything.

---

## Tech Stack
- Next.js 14 App Router, TypeScript strict mode
- Supabase (Postgres, Storage, Auth) — RLS on every table
- Anthropic AI API (model names are env-var constants — never hardcoded)
- ATTOM Data API for property data (nationwide coverage)
- Google Maps, Geocoding, Places, Street View, Static Maps APIs
- Stripe for payments, Resend for email
- @sparticuz/chromium + puppeteer-core for PDF generation
- Deployed on Vercel

---

## Key Conventions
- All AI model identifiers: `AI_MODELS.PRIMARY` and `AI_MODELS.FAST` from `config/ai.ts`
- All database queries: typed repository functions in `lib/repository/`
- All external API calls: typed service modules in `lib/services/`
- All prices: `PRICING` constants from `config/pricing.ts`
- All service/property/outcome types: `config/services.ts`
- All valuation parameters: `config/valuation.ts`
- All env vars: documented in `.env.example`, never hardcoded
- All strategy selection: service_type + property_type + desired_outcome → resolved in pipeline stages, never in UI code

---

## Commands
- `pnpm dev` — start development server
- `pnpm build` — production build
- `pnpm lint` — ESLint check
- `pnpm test` — run Vitest tests
- `supabase db push` — push schema changes
- `supabase gen types typescript` — regenerate TypeScript types from schema

---

## Data Trust Hierarchy — CRITICAL
County assessment data is NOT trustworthy. ATTOM sources from county records.
If a county is corrupt or wrong, ATTOM inherits that same bad data. Therefore:

- **Pre-payment valuation**: Pure statistical estimate only (IAAO error rates). NEVER compare against ATTOM `marketValue` or any third-party "market value" that could originate from the same county records. The 8% human-error rate is mathematically defensible regardless of county data quality.
- **Full pipeline analysis**: Uses comparable sales, user photos, and our own measurements — independent evidence that does NOT depend on the county's numbers.
- **User photos + measurements**: This is OUR proprietary data. As it compounds over time, it becomes our strongest independent data source. Always treat as higher-trust than county or ATTOM assessment data.
- **Admin photo review**: Stage 4 runs AI photo analysis automatically. The admin can adjust condition ratings, defects, captions, and adjustment notes in the review step (`/admin/reports/[id]/review`) before approving. Overrides are written to `photos.ai_analysis` via `PATCH /api/admin/reports/[id]/photos` and reflected in the final PDF.
- **Pre-purchase/pre-listing**: Market value conclusions are based on comparable sales and income analysis — NOT on the current assessed value. The assessed value is presented as a data point (potential tax liability, buyer leverage), not as value evidence.

---

## Payment & Messaging Rules — CRITICAL
- ALL payments happen BEFORE the valuation or analysis is shown. No exceptions.
- Never use the word "free" anywhere in user-facing copy. Use "run the numbers" or similar.
- Tax bill uploaders get 15% off (`TAX_BILL_DISCOUNT` in `config/pricing.ts`).
- Tax bill uploaders skip redundant ATTOM assessment lookups (we already have their assessed value). ATTOM is still called for building details and comps.
- The post-payment optimistic result is a teaser, not the real analysis. The real numbers come from the full pipeline.
- Pre-purchase and pre-listing pricing is per property type (residential vs. commercial/industrial) — see `config/pricing.ts`.

---

## Pipeline Stage Behavior by Service Type

| Stage | tax_appeal | pre_purchase | pre_listing |
|---|---|---|---|
| 1 Data Collection | Run (full) | Run (full) | Run (full) |
| 2 Comparables | Run (full) | Run (full) | Run (full) |
| 3 Income Analysis | Run if commercial/industrial | Run if investment type | Run if commercial/industrial |
| 4 Photo Analysis | Run | Run | Run |
| 5 Narratives | Full report + appeal argument | Buyer report + risk profile | Seller report + listing strategy |
| 6 Action Guide | Appeal filing guide | Buyer action guide | Listing strategy guide |
| 7 PDF Assembly | Run | Run | Run |
| 8 Delivery | Run (email PDF) | Run (email PDF) | Run (email PDF) |

Stage 6 is always run — content varies by service type. For tax_appeal it is the filing guide. For pre_purchase it is the buyer action guide. For pre_listing it is the listing strategy guide.

---

## What NOT To Do
- Never skip Stage 8 auto-delivery (if delivery fails, fall back to `pending_approval`)
- Never hardcode county-specific logic in application code
- Never hardcode AI model names anywhere except `config/ai.ts`
- Never use `NEXT_PUBLIC_` prefix on service role keys or secret keys
- Never use ATTOM `marketValue` as ground truth for valuations or comparisons
- Never trust county assessment data as accurate — always verify independently
- Never say "free" in any user-facing text
- Never run income approach on residential SFR or land (only multifamily 2+ units, commercial, industrial)
- Never omit the filing guide for tax_appeal (Stage 6 must always run for tax_appeal)
- Never add a new property subtype without adding it to: `ECONOMIC_LIFE`, `PROPERTY_SUBTYPE_MAP`, `REPLACEMENT_COST_PER_SQFT`, and `INCOME_PARAMS` (if commercial/industrial)
- Never add a service type without adding it to: `config/services.ts`, `config/pricing.ts`, the pipeline orchestrator's stage routing, and Stage 5 narrative section mapping
