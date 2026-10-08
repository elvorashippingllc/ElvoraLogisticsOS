# Implementation progress — enterprise controls

This checkpoint implements real workflows for parts of sections 75, 134, 137 and 138. The complete 147-area scope remains unfinished. Source-based status labels remain Partial; the original specification is unchanged.

## Job closure and reopening

Open a master job and select **Closure review**. The server checks delivery, POD, documents, customs, equipment, revenue invoicing, cost billing/review and draft invoices. Submit document/cost review or non-applicability evidence with a reference. Another authorised user must verify it. Verification fingerprints the job and linked shipments, equipment, charges, customs declarations, invoices and attachments; changes invalidate prior verification. An authorised approver can close only after all gates pass.

Closed job edits and direct status reopening are blocked. Reopening requires a reason, an independently approved request and a recorded decision. Reopening clears evidence verification. Duplicate decisions are rejected. Shipments, bookings, delivery orders, customs declarations and transport orders linked to closed jobs cannot be created, updated or deleted through the entity engine.

This initial closure policy requires costs to be billed: it does not yet support approved accrual/WIP alternatives or company/lane-specific policies. Non-applicability is an independently reviewed attestation, not automatic documentary proof. Payments/collections remain available after closure. Documents/comments and other linked subsystems still require broader enterprise permission/retention controls.

## Independent financial approvals

Bills, payments, quotations and purchase orders track durable requests and decisions. Creators/requesters cannot decide their own approval. Rejection needs a reason. Commercial edits supersede pending approvals and invalidate approved status. Purchase orders cannot be created as Approved or marked Approved through ordinary CRUD. Configured bill/payment thresholds require approved status even for users with approval rights. Below-margin quotations automatically record a pending maker request. Expense approvals exclude the claim creator and employee.

Authority tiers, delegation, escalation and budgets/credit override workflows are not implemented by this checkpoint. Legacy pending records can use the existing Request approval action to enter the new workflow. These approval rules intentionally require a second staff account; a one-account company must provision an authorised checker.

## AI action controls

A reviewed capability allowlist rejects newly introduced, unreviewed tools. External email/WhatsApp actions require human approval at every autonomy level. No financial-posting, customs-filing or cargo-release capability is permitted. Approval revalidates agent capabilities and atomically changes Pending to Executing before the tool runs. A simultaneous or repeated decision cannot execute the same action again. Revoked tools fail before execution.

A crash during external execution leaves an Executing record requiring investigation; do not blindly replay a message that may already have been delivered. User/branch-scoped reads, stronger tool/action auditing and recovery processes remain outstanding.

## Validation

- TypeScript and production web/API build.
- 138 core API smoke checks, including independent quote approval.
- Dedicated enterprise API acceptance checks for closure gates, stale evidence, maker/checker verification/reopening, duplicate decisions, closed-job locks, purchase-order approval guards, edited/pending approval invalidation, rejection reasons and threshold posting bypass.
- AI concurrent-execution, duplicate-decision, revoked-tool and prohibited-tool checks.
- Browser checks for the scope page and closure review at desktop and 390px mobile widths.
- Original scope checksum, all 147 sections, lifecycle, product areas and evidence paths.

The demo data now follows the new independent-review controls instead of closing a job with an unassigned/unbilled freight cost.
