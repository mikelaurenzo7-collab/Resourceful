# Payment & Messaging Rules — CRITICAL

These rules are business-critical and must never be violated.

## Payment Gate
- **ALL payments happen BEFORE the valuation is shown. No exceptions.**
- The post-payment "optimistic result" is a teaser only — real numbers come from the full pipeline with comparable sales
- Tax bill uploaders get 15% off — use `TAX_BILL_DISCOUNT` from `src/config/pricing.ts`
- All prices come from `PRICING` constants in `src/config/pricing.ts` — never hardcode dollar amounts

## Tax Bill Uploader Path
- Tax bill uploaders **skip** ATTOM assessment lookups (we already have their assessed value from OCR)
- ATTOM is still called for building details and comps — never skip those

## Copy Rules
- **NEVER use the word "free"** in any user-facing text
  - ❌ "free report", "free analysis", "free estimate"
  - ✅ "run the numbers", "get your estimate", "check your assessment"
- Saying "free" then charging is a trust violation that damages the brand

## Stripe Integration
- All payment flows use Stripe — never build a custom payment path
- Use the existing Stripe service in `src/lib/services/`
- Webhook handlers must validate Stripe signatures before processing
