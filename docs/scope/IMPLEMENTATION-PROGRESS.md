# Implementation progress — enterprise controls

This checkpoint implements real workflows for parts of sections 75, 76, 134, 137 and 138. The complete 147-area scope remains unfinished. Source-based status labels remain Partial; the original specification is unchanged.

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

## Durable workflow automation

Rules now enqueue a durable event snapshot inside the source record transaction. Administration → Workflow Runs shows each queued/running/succeeded/failed/uncertain run and its attempt history. Rule forms support delay minutes and bounded internal attempts. Event keys prevent duplicate trigger enqueueing. Disabling or editing a rule cancels queued work from its old version. Deleted source records cancel their queued work. Recursive field-update chains stop at a bounded depth.

Internal actions (task creation, notifications, email queuing and permitted ordinary field edits) execute transactionally. Failures roll back their effects and retry with backoff; exhausted runs remain Failed. An administrator can authorise another internal retry with a reason. An email-queuing run succeeding means the email reached the outbox, not that it was delivered: delivery remains tracked by the mail outbox.

WhatsApp sends and AI reviews execute with an atomic claim. Failures or interrupted execution become Needs review. The administrator must inspect provider/integration evidence and confirm completion or cancel; these outcomes cannot be replayed through the retry action. A partly sent multi-recipient message must be checked recipient by recipient. There is no claim of exactly-once provider delivery.

The worker processes production and isolated demo databases separately. Manual replay cannot bypass the domain's financial/status actions: Set field value accepts only ordinary editable text/textarea/bool fields and excludes status, approval, reference and financial state. Delayed field edits also reject stale record versions.

Additional checks pass for atomic enqueue/rollback, event deduplication, internal execution concurrency, delays, edited-rule cancellation, retries/dead letters/attempt history, persistence across a process restart, protected-state rejection, external uncertainty without replay, authenticated retry/review endpoints and permissions. Multi-step branching and working/holiday SLA calendars remain unimplemented. The next checkpoint adds elapsed SLA timers and work queues below.

## Work queues, elapsed SLA timers and shift handovers

Work → Work Queues includes personal and department queues, elapsed deadlines, pause/resume and owner/manager-controlled transitions. Quotations, carrier booking confirmations, sea/air job BL drafts and delivered shipment POD automatically create deduplicated activities and complete them when the source workflow completes. Tracked activities cannot be marked Completed while their source remains incomplete. Custom activities can be resolved with a recorded explanation.

Administration → SLA Policies selects the most specific customer/service/department/activity match before priority. The applied deadline and pause policy are captured when the activity starts; later policy edits do not rewrite an existing timer. A waiting activity pauses only where its applied policy allows. The worker records each first breach and alerts the owner and policy escalation owner or department manager. Timestamps preserve UTC precision. These are elapsed-minute timers, not working/holiday calendars.

Managers see capacity points and workload (activity complexity + two points per open job + one per open task). Recommendations propose a lower-load, same-department staff member with source access. Assignment is a reviewed manager action; no automated optimiser or skill qualification is claimed.

Work → Shift Handovers captures the sender's active activities, open jobs, tasks, critical activities and linked pending email where both staff accounts can read administration records. Recipients must be permitted to see every captured source activity. Only the named recipient acknowledges with a note; duplicate acknowledgement is rejected. Current permissions redact historical activity/job/email snapshots if access changes. Sending a handover does not reassign the work or change source responsibilities. WhatsApp conversation assignment and unattended handover escalation remain outstanding.

Dedicated domain and authenticated API checks cover timer specificity, source synchronization, deduplication, pause/resume, one-time escalation, controlled source completion, workload, snapshot capture/redaction, recipient-only acknowledgement and duplicate/state/permission rejection. Full enterprise completion and production certification remain outstanding; the original 147-area scope is preserved.

## Eight missing enterprise areas implemented as working foundations

Carrier RFQs, container deposits, BL/AWB records, original document custody, OCR, document matching, competency management and versioned knowledge now have usable workflows, guarded server actions and domain/API checks. See [Enterprise modules](ENTERPRISE-MODULES.md) for entry points, runtime dependencies, transaction rules, validation and explicit remaining limitations. Coverage is now 137 Partial, 6 Missing and 4 External validation; no area is certified complete.
