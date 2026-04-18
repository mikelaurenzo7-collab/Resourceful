# Data Trust Hierarchy — CRITICAL

County assessment data is NOT trustworthy. ATTOM sources from county records.
If a county record is wrong, ATTOM inherits that same bad data.

## Trust Ranking (highest → lowest)

1. **User photos + our measurements** — OUR proprietary data. As it compounds, it becomes the strongest independent data source. Always treated as higher-trust than anything from county or ATTOM.
2. **Calibration outcomes** — Real appeal results reported by users. Feeds the calibration system which learns predicted vs actual values over time.
3. **Comparable sales** (ATTOM) — Independent market evidence. Used in full pipeline analysis.
4. **Building details** (ATTOM) — Square footage, year built, etc. Useful but may reflect county records.
5. **ATTOM marketValue / assessedValue** — Do NOT use as ground truth for valuations or comparisons. This may originate from the same corrupt county records.
6. **County assessment data** — NEVER trust as accurate. Always verify independently.

## Pre-Payment Valuation Rule
- Use **pure statistical estimate only** (IAAO error rates — 8% human-error rate)
- **NEVER** compare against `ATTOM marketValue` or any third-party "market value"
- The 8% human-error rate is mathematically defensible regardless of county data quality

## Full Pipeline Analysis Rule
- Use comparable sales, user photos, and our own measurements
- This is independent evidence that does NOT depend on the county's numbers

## Calibration Feedback Loop
- 60 days after delivery → follow-up email "How did your appeal go?"
- Users can report outcomes from `/report/[id]` page (30+ days after delivery)
- Outcomes update county-level stats: win rate, avg savings
- This is the feedback loop that makes our data increasingly independent from county sources
