# Resourceful Property-Type and Appeal Income Report Standard

This supplement is binding alongside `docs/final-report-quality-standard.md`.

## Why this exists

Real appraisal reports do not use one generic unit of comparison or one generic income-capitalization template for every property. Resourceful must adapt the report to the property type while preserving evidence integrity and its non-appraiser boundary.

## Structured front matter

Every final report must contain a structured **Summary of Salient Facts and Valuation Findings** page, even when a generated narrative is unavailable.

It must identify, when documented:

- assignment and intended use;
- property type and class;
- address, jurisdiction, parcel number, and owner;
- zoning, site area, building area, age, remaining life, and condition;
- effective valuation date;
- each supported approach indication and its role;
- the relevant unit of comparison; and
- the Resourceful concluded market value.

Narrative may supplement this page but must not replace the structured facts.

## Property-type unit of comparison

The report must use the market unit appropriate to the property type and the stored evidence.

- Office, retail, industrial, warehouse, and flex properties ordinarily use value per rentable or gross building square foot when supported.
- Multifamily properties may require value per dwelling unit, value per bedroom, or value per square foot depending on documented market practice.
- Land requires a market-supported unit such as value per square foot, acre, frontage foot, or buildable unit.
- Specialized assets require a separately documented market unit.

`Total value / building area` is **value per square foot**. It must never be labeled `per unit`.

A multifamily per-unit analysis is allowed only when source-labeled unit counts exist for the subject and every materially relied-upon comparable. Unit count must not be inferred from bedroom count, story count, property class, or free-text narrative.

When verified unit counts are unavailable:

1. retain an explicitly labeled area-normalized fallback only when it is otherwise supported;
2. disclose that the result is not a per-unit indication; and
3. do not release a final report that claims a per-unit conclusion.

## Comparable-sale presentation

A material sales-comparison section should contain:

- a summary grid;
- a comparable-location map when available;
- one evidence profile per materially relied-upon sale;
- transaction parties, deed/source status, sale date, sale price, sale condition, and distress screening;
- property-type physical characteristics;
- transaction and property adjustments with stated support; and
- unadjusted range, adjusted range, central tendency, and concluded market unit.

Blank adjustment fields mean no supported adjustment is stored. They do not prove that a zero adjustment is warranted.

## Appeal-oriented income capitalization

A property-tax appeal income approach must state how real estate taxes are treated.

### Taxes included in stabilized expenses

The report must identify:

- the real estate tax expense;
- the source and applicable period;
- whether the amount is actual, normalized, or assumed; and
- that an unloaded market capitalization rate is applied consistently.

### Taxes excluded from stabilized expenses

The report must identify:

- the tax rate or tax-rate component used;
- the equalization and assessment-level inputs when applicable;
- the tax-load calculation;
- the resulting tax-load factor;
- the unloaded market capitalization rate;
- the loaded capitalization rate; and
- the arithmetic connecting those inputs to the value indication.

The report must not combine an NOI that excludes real estate taxes with an unloaded market capitalization rate without a supported tax load.

Until real estate tax treatment is documented and internally consistent, an income indication is analytical support rather than appeal-ready evidence.

## Income evidence requirements

A completed income approach requires:

- source-labeled rental evidence or a clearly labeled assumption basis;
- market-rent conclusion and rationale;
- vacancy and collection loss support;
- operating-expense support;
- positive finite NOI;
- a decimal capitalization rate greater than zero and no more than one;
- a source or documented derivation for the rate;
- arithmetic reconciliation of NOI divided by the applied rate; and
- an explained material variance between calculated and stored indications.

An input of `8` is not treated as an 8 percent capitalization rate. The valid decimal form is `0.08`.

## Release gates

Do not release a final report when any applicable condition exists:

- a value-per-square-foot result is labeled per unit;
- a multifamily per-unit conclusion lacks verified subject or comparable unit counts;
- the unit of comparison is inappropriate for the property type and unsupported by market evidence;
- a property-tax appeal income approach does not state real estate tax treatment;
- taxes are excluded but no supported loaded capitalization rate is shown;
- taxes are included but the tax expense and source are not identified;
- NOI, capitalization rate, or stored conclusion is missing or invalid; or
- displayed capitalization arithmetic is materially unreconciled.

## Required QA set

Before this standard is considered fully implemented, generate and visually review at least:

1. a residential report;
2. a multifamily report;
3. an office or retail report;
4. an industrial or flex report; and
5. an appeal report whose income approach demonstrates documented real estate tax treatment.

Review each PDF page-by-page for section order, table fit, image quality, unit labels, arithmetic, source boundaries, and credential claims.