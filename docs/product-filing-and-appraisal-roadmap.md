# Resourceful Filing, Representation, and Appraisal Roadmap

**Status:** Relaunch plan drafted July 14, 2026  
**Launch recommendation:** Illinois county-first, owner-first, evidence-led

## Executive Decision

Resourceful should become the easiest way for a property owner to complete the entire assessment-appeal lifecycle:

> **Check the assessment → build the evidence → complete the correct filing → prepare for the hearing → track the decision and savings.**

The immediate product is not a nationwide autonomous law firm and not an unlicensed appraisal company. It is a high-trust appeal execution platform with three controlled delivery modes:

1. **Owner files pro se** with a complete Resourceful packet and guided workflow.
2. **Resourceful prepares/manages the filing** only where the forum permits the applicable agent and the required authorization has been executed.
3. **A licensed attorney or appraiser partner takes responsibility** when the forum or intended use requires that credential.

This structure creates real demand while avoiding the most dangerous failure mode in the existing code: describing packet preparation as filing or generic power-of-attorney authority.

## What Exists Today

### Strong foundation

- Payment-gated intake, tax-bill upload, address lookup, photos, property issues, and service/review tiers.
- Seven-stage data, comparable, income, photo, narrative, filing-guide, and PDF pipeline.
- Admin review before delivery.
- County rules with deadlines, forms, filing channels, hearing details, representative fields, and escalation fields.
- Customer report/dashboard, email delivery, reminders, referrals, API partner fields, and outcome/calibration concepts.
- Filing service scaffolding for online, email, mail, and guided self-filing.
- GPT-5.6 Sol migration for valuation, vision, document extraction, and filing guidance.

### Not yet real

- Online filing is not implemented; it only creates an admin note.
- Email filing does not send an authorized filing email or preserve an accepted receipt.
- Mail filing does not call Lob or preserve certified-mail evidence.
- No executed authorization/POA object is required before managed filing.
- No county adapter proves exact field mappings, portal version, or submission result.
- No durable submission ledger separates prepared, reviewed, submitted, accepted, rejected, and cured.
- No customer task center for signatures, missing evidence, hearing dates, or proof upload.
- No attorney/appraiser partner acceptance workflow.
- The normal-appraisal concept is not separated from AI valuation analysis.

## Forum Rules Change the Product

### Cook County Assessor's Office (CCAO)

The CCAO's 2026 rules state that taxpayers—including business organizations—do not have to retain an attorney. Attorneys and other authorized agents may file through SmartFile, but must submit the CCAO Authorization Form. Pro se owners are encouraged to use SmartFile and have limited alternate submission methods. The appeal and all supporting documents are due by the township closing date.

**Product implication:** Resourceful may support owner filing and potentially an authorized-agent managed-filing service at the Assessor level, subject to Illinois legal review, correct authorization, SmartFile account/portal terms, and a controlled operator workflow.

Official source: https://www.cookcountyassessoril.gov/official-appeal-rules-cook-county-assessor

### Cook County Board of Review (CCBOR)

The Board's rules allow only licensed attorneys and individual taxpayers representing property titled in their own names. Non-attorneys may not represent another taxpayer. Corporations, LLCs, condominium associations, and similar entities must be represented by an attorney. Attorneys must file the Board's original Attorney Authorization Form before final submission. Complaints must use the official form or online system and meet the township deadline.

**Product implication:** Resourceful itself should not offer generic non-attorney full representation at the Board. The scalable products are:

- guided pro se for eligible individual owners;
- attorney handoff for entities or represented appeals;
- attorney-operated white-label filing infrastructure;
- evidence assembly and hearing preparation for either path.

Official sources:
- https://www.cookcountyboardofreview.com/board-review-official-rules
- https://www.cookcountyboardofreview.com/portal-guide-property-owners

### Illinois Property Tax Appeal Board (PTAB)

PTAB requires an appeal generally within 30 days of the county decision, on prescribed forms, with evidence supporting the claimed basis. It requires at least three sales for comparable-sales arguments and at least three properties for equity arguments; a complete appraisal can substitute for the grid in specified circumstances. Attorney-represented appellants must use the eFiling portal.

**Product implication:** PTAB should be a paid escalation lane triggered from the recorded county decision, not a generic static PDF. The product should calculate the 30-day deadline, import the county record, build the required grid, identify missing evidence, and route attorney-represented cases through counsel.

Official sources:
- https://www.ptab.illinois.gov/
- https://www.ptab.illinois.gov/filing.html

## Recommended Product Ladder

### 1. Assessment Check — free

Purpose: acquire qualified demand without making fabricated savings claims.

Deliver:
- verified public assessment and tax fields;
- notice/deadline capture;
- property-record discrepancy checklist;
- preliminary evidence inventory;
- clear result: `likely worth a full review`, `insufficient data`, or `unlikely to justify cost`;
- no invented market value or universal overassessment percentage.

Conversion event: upload notice/tax bill and purchase a case.

### 2. Appeal Case — recommended test price: $79 residential

Deliver:
- verified subject facts and source ledger;
- comparable-sales and assessment-equity grids;
- property-condition evidence index;
- requested value and calculation bridge;
- appeal brief/letter;
- filing guide and hearing script;
- human quality review before delivery.

The current $49 tier is likely too low once human review, vendor data, support, payment fees, and failed-case handling are included. Test $79–$99 against conversion and gross margin rather than assuming report-level AI cost is the full cost.

### 3. Expert-Reviewed Case — recommended test price: $199 residential

Deliver everything above plus:
- independent analyst/appraiser review;
- corrected comp selection and adjustment reasoning;
- signed review checklist;
- one revision cycle;
- confidence and missing-evidence explanation.

Do not call this a licensed appraisal unless a licensed appraiser is the responsible signer and the assignment is performed under the applicable professional standard.

### 4. Guided Pro Se Filing — recommended test price: $299 residential

This should be the flagship consumer offer.

Deliver:
- all case outputs;
- deadline lock and reminders;
- official-form field worksheet or prefill;
- live screen-share filing session;
- proof-of-filing capture;
- hearing-preparation session;
- decision and savings tracking.

The user remains the filer and signs/initials the official submission.

### 5. Managed Filing — jurisdiction-specific quote

Only enable when the forum permits the applicable agent and legal review confirms the service model.

Required controls:
- verified representative type;
- current official authorization form;
- signer identity and authority;
- executed authorization stored with checksum and timestamp;
- final packet preview;
- explicit customer consent to submit;
- trained human submission or verified adapter;
- durable proof of submission;
- cure/rejection workflow.

### 6. Attorney Representation — partner offer

Use a vetted property-tax attorney network for:
- Cook County Board of Review entity appeals;
- represented Board hearings;
- high-value commercial cases;
- legal-contention cases;
- circuit-court escalation;
- jurisdictions that restrict non-attorney practice.

Resourceful supplies the structured workfile and operations layer; counsel owns legal judgment, appearance, authorization, and filing.

Commercial model options requiring counsel review:
- fixed lead/referral fee where permitted;
- software/operations fee to the law firm;
- white-label subscription;
- customer pays firm directly and Resourceful charges separately for valuation/evidence services.

Avoid fee sharing with attorneys until ethics counsel confirms the structure.

### 7. PTAB Escalation — $349 guided or attorney quote

Trigger after an adverse/partial county decision.

Deliver:
- 30-day deadline engine;
- final decision import;
- PTAB form selection;
- sales/equity grid builder;
- evidence completeness validation;
- appraisal/testimony decision support;
- eFiling/mail checklist;
- attorney route where applicable.

### 8. Home Value & Sale Strategy — $149 test price

This is the direct-to-consumer non-lender product for owners, sellers, and buyers.

Deliver:
- evidence-based value range, not a single overconfident number;
- comparable selection and adjustments;
- tax burden and reassessment exposure;
- condition observations and inspection caveats;
- repair/value-enhancement priorities;
- listing-price scenarios and seller evidence packet;
- buyer negotiation and walk-away framework where applicable.

Market it as valuation and sale strategy, not a certified appraisal.

### 9. Licensed Appraisal — partner quote

Create a credentialed appraiser marketplace/workflow rather than asking GPT-5.6 Sol to impersonate a license.

Resourceful can provide:
- intake and intended-use scoping;
- subject data and workfile assembly;
- scheduling and document collection;
- draft analytical support;
- quality-control checklist;
- secure delivery and revision workflow.

The licensed appraiser must determine scope, verify the property, exercise independent judgment, sign the report, and assume responsibility. Mortgage/lender use should be accepted only through compliant lender/AMC channels.

## Filing State Machine

Replace ambiguous text states with an auditable state machine:

```text
not_started
  → eligibility_review
  → evidence_incomplete | packet_building
  → packet_ready
  → awaiting_owner_signature
  → awaiting_authorization
  → final_review
  → ready_to_submit
  → submitting
  → submitted
  → accepted | rejected | cure_required
  → hearing_scheduled | decision_pending
  → granted | partially_granted | denied | withdrawn
  → escalated_to_ptab | escalated_to_court | closed
```

Every transition records:
- actor;
- timestamp;
- prior/new state;
- reason;
- jurisdiction rule version;
- form/portal version;
- artifact hashes;
- confirmation/tracking data;
- customer consent where required.

## Jurisdiction Adapter Contract

Each automated or operator-assisted filing adapter must define:

```ts
interface JurisdictionFilingAdapter {
  jurisdictionId: string;
  forum: 'assessor' | 'board_of_review' | 'state_board' | 'court';
  ruleVersion: string;
  supportedPropertyTypes: string[];
  supportedFilerTypes: string[];
  requiredForms: FormDefinition[];
  requiredEvidence: EvidenceRule[];
  authorizationRule: AuthorizationRule;
  deadlineRule: DeadlineRule;
  validate(caseFile): ValidationResult;
  prepare(caseFile): PreparedSubmission;
  submit?(prepared, explicitApproval): SubmissionReceipt;
  verify?(receipt): AcceptanceStatus;
}
```

### Submission safeguards

- No adapter runs when the rule version is stale or unverified.
- Preview all mapped values before submission.
- Owner/attorney initials the final requested value and certifications.
- Idempotency key prevents duplicate complaints.
- Capture screenshots/HTML receipts where portal terms allow.
- Never bypass CAPTCHA, MFA, access controls, or portal terms.
- If automation cannot legally or technically submit, hand off to a human operator or the owner.

## Database Additions

Add normalized tables through new migrations:

- `jurisdictions`
- `jurisdiction_rule_versions`
- `filing_requirements`
- `filing_cases`
- `filing_tasks`
- `filing_artifacts`
- `authorizations`
- `submission_attempts`
- `submission_receipts`
- `hearings`
- `appeal_decisions`
- `professional_partners`
- `partner_assignments`
- `appraisal_assignments`
- `model_evaluations`

Do not overload `reports.admin_notes` as workflow storage.

## Customer Experience

### Dashboard navigation

- **Overview:** deadline, value at stake, current stage, next action.
- **Evidence:** records, comps, photos, discrepancies, missing items.
- **Case:** requested value, argument summary, full workfile, revisions.
- **File:** official form, fields, signatures, authorization, submit/hand-off.
- **Hearing:** date, agenda, script, likely questions, document order.
- **Decision:** result, savings, next appeal deadline, annual monitoring.

### Next-action design

Every screen should answer:
- What happened?
- What must I do next?
- By what exact date?
- What will Resourceful do?
- What is still unverified?

## AI Evaluation Program

GPT-5.6 Sol should be the appraiser engine only after passing a permanent evaluation set.

Required cases:
- Cook residential uniformity appeal;
- recent-sale appeal;
- property-record correction;
- condo appeal;
- commercial income appeal;
- industrial property;
- thin/rural market;
- zero-credible-comps case;
- severe photo-evidence case;
- misleading owner-caption case;
- underassessment/no-appeal case;
- CCAO filing guide;
- CCBOR pro se and attorney-routing cases;
- PTAB escalation;
- pre-listing value-enhancement plan.

Score:
- numerical accuracy;
- source fidelity;
- comp quality;
- unsupported assertion rate;
- uncertainty calibration;
- jurisdiction-rule correctness;
- required-section completeness;
- professional reviewer acceptance;
- customer task clarity;
- cost and latency.

## County-First Rollout

### Phase 0 — infrastructure recovery

- Rotate leaked ATTOM credential and audit every production secret.
- Locate or create a dedicated Resourceful Supabase project.
- Reconcile and apply migrations in a non-Wireline environment.
- Create a dedicated Resourceful Vercel project.
- Configure OpenAI, ATTOM, Stripe test mode, Resend, Sentry, and health checks.
- Establish passing CI outside the known Actions startup/billing blocker.

### Phase 1 — Cook County owner product

Ship:
- CCAO owner-guided SmartFile workflow;
- CCBOR individual-owner pro se workflow;
- attorney route for entities and represented Board cases;
- deadline/calendar sync;
- proof upload and decision tracking;
- 20–50 shadow cases reviewed against real professional work.

### Phase 2 — DuPage and McHenry

Add only after official forms, rules, deadlines, filer authority, and submission channels are verified and encoded. Build adapters from source documents, not inferred county defaults.

### Phase 3 — Illinois PTAB

Use county decisions and complete workfiles to drive PTAB eligibility, grids, forms, and attorney routing.

### Phase 4 — repeatable state expansion

Select states by:
- homeowner tax pain;
- appeal frequency;
- digital filing maturity;
- public-data availability;
- representative rules;
- average case value;
- competition and CAC;
- partner supply.

## Launch KPIs

Do not optimize for reports generated. Track:

- qualified checks → paid case conversion;
- paid case → packet-ready time;
- packet completeness at first review;
- filing completion rate before deadline;
- rejection/cure rate;
- hearing attendance rate;
- reduction win/partial-win rate;
- median assessment reduction and actual tax savings;
- customer effort minutes;
- human review minutes per case;
- vendor + AI + payment + support cost per case;
- refund/chargeback rate;
- annual repeat and referral rate;
- model error and unsupported-claim rate.

## Immediate Build Order

1. Recover dedicated infrastructure and rotate credentials.
2. Make the current report pipeline pass lint, type-check, tests, build, and a real OpenAI smoke case.
3. Add filing-case state, task, authorization, and receipt schema.
4. Build Cook CCAO guided pro se flow.
5. Build Cook CCBOR pro se/attorney routing flow.
6. Add decision and savings tracking.
7. Run shadow cases and calibrate GPT-5.6 Sol against professional review.
8. Launch a controlled Cook County pilot.
9. Add PTAB escalation.
10. Add appraiser and attorney partner workflows before selling regulated appraisal or representation products.

## Required Professional Review Before Public Launch

Obtain written review from:
- an Illinois property-tax attorney on representation, authorization, fee, portal, and unauthorized-practice boundaries;
- an Illinois-licensed appraiser on product naming, intended use, workfile, review/signature, and USPAP/licensing boundaries;
- vendor counsel or account representatives on ATTOM, listing/portal, imagery, and derived-data rights;
- a privacy/security professional on document retention, PII, payment, and customer authorization controls.

This review should alter jurisdiction configuration and product eligibility—not remain a disclaimer hidden in terms of service.
