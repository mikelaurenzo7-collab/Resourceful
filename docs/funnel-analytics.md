# Resourceful funnel analytics contract

Resourceful uses Vercel Web Analytics custom events to measure the intake funnel without sending property or customer identity data.

## Non-negotiable privacy boundary

Custom event payloads may contain only the allowlisted categorical fields defined in `src/lib/analytics/funnel-contract.ts`:

- intake step and step number;
- service type;
- property type;
- review tier;
- whether a tax bill was provided;
- bucketed photo-evidence volume;
- bucketed property-issue count;
- bucketed price range; and
- whether optional decision context was supplied.

Never send:

- street address, city, state, county, ZIP code, coordinates, or FIPS;
- customer name, email, phone number, or authentication identity;
- parcel/PIN values;
- report, payment-intent, referral, or partner identifiers;
- desired-outcome text, notes, captions, document contents, or report prose; or
- raw prices, assessed values, tax amounts, savings estimates, or other sensitive financial facts.

The analytics component is best-effort and fail-open. An analytics error must never interrupt intake, payment, evidence upload, report generation, or delivery.

## Event dictionary

| Event | Meaning | Primary denominator |
| --- | --- | --- |
| `Resourceful Intake Step Viewed` | A canonical intake route was reached during the browser session | Previous step views |
| `Resourceful Service Selected` | A valid service type was selected | Goals step views |
| `Resourceful Property Details Completed` | Property type and address selection were completed and the user advanced | Service selections |
| `Resourceful Situation Completed` | The situation/evidence-context step was completed | Property completions |
| `Resourceful Checkout Initialized` | Resourceful created the report/payment session and exposed the payment form | Situation completions |
| `Resourceful Photo Evidence Added` | At least one customer photo was attached | Checkout initializations |
| `Resourceful Photo Evidence Skipped` | The customer explicitly continued without photos | Checkout initializations |
| `Resourceful Intake Success Viewed` | The post-purchase success route was reached | Checkout initializations |

Events are deduplicated per browser session by stable milestone identity rather than by the full evolving wizard state. This prevents field edits and rerenders from inflating conversion counts.

## Core KPIs

Calculate these by service type, property type, review tier, and price band when sample sizes are sufficient:

1. **Service selection rate** = service selections / goals step views.
2. **Property completion rate** = property details completed / service selections.
3. **Situation completion rate** = situation completed / property details completed.
4. **Checkout initialization rate** = checkout initialized / situation completed.
5. **Photo evidence attachment rate** = photo evidence added / checkout initialized.
6. **Photo skip rate** = photo evidence skipped / checkout initialized.
7. **Client-side success arrival rate** = success views / checkout initialized.

`Intake Success Viewed` is a client-funnel indicator, not authoritative booked revenue. Stripe webhook and database payment state remain the source of truth for paid orders, refunds, chargebacks, and revenue.

## Operating cadence

- Review funnel rates weekly during launch and monthly after stabilization.
- Investigate any step-over-step decline greater than 15% relative to the trailing four-week baseline.
- Do not optimize a segment with fewer than 30 completed sessions.
- Pair conversion data with support tickets, refunds, jurisdiction block codes, report QA failures, and appeal outcomes before changing eligibility or pricing policy.
- Add new event properties only through the allowlisted contract and its regression tests.
