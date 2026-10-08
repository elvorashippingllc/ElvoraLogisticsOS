# Enterprise scope coverage

Source-based coverage assessment, not production certification. Partial means an implementation foundation exists; remaining requirements are not complete. All original scope is retained verbatim. Go-live needs company policies, authority matrices, credentials and external validation.

Reviewed source: `d6ed04293dc1e363cc9978e317749e9a3eaece57` on 2026-10-08.

147 areas: 129 partial foundations, 14 missing dedicated implementations, 4 adapters requiring external validation. No area is certified complete by this audit.

[Canonical specification](MASTER-SPECIFICATION.md) includes every original section, final lifecycle, six product areas and deployment caveat. The machine-readable record is `src/shared/enterprise-scope.json`.

## Delivery gates

Prioritise identity/scoping, maker/checker, approval authority, immutable audit, closure/reopening and AI prohibitions before relying on enterprise controls. Then complete commercial/operational workflows, finance policies, portals and communications. Validate partner/regulatory integrations and recovery using real configuration before go-live.

## Requirement traceability

### 1. Corporate Administration

**Status: Partial**

Organisation, roles and master records exist.

**Remaining acceptance work:** Complete group/team hierarchy, cost/profit centres, delegated entity administration and per-company fiscal/registration policies.

**Evidence:** `src/shared/entities/platform.ts`, `src/shared/entities/masters.ts`, `src/shared/entities/automation.ts`

### 2. Enterprise Identity & Security

**Status: Partial**

Password authentication, TOTP, sessions, module/action permissions and customer record scoping exist.

**Remaining acceptance work:** SSO, passkeys, department/branch/field scopes, delegation, temporary access, segregation of duties and export/IP policies.

**Evidence:** `src/server/auth.ts`, `src/server/engine.ts`, `src/web/pages/ProfilePage.tsx`

### 3. Enterprise User Roles

**Status: Partial**

Organisation, roles and master records exist.

**Remaining acceptance work:** Validate every listed role, permission matrix and substitute/delegated authority against workflows.

**Evidence:** `src/shared/entities/platform.ts`, `src/shared/entities/masters.ts`, `src/shared/entities/automation.ts`

### 4. Owner / CEO Command Center

**Status: Partial**

Dashboard aggregates and selected operational alerts exist.

**Remaining acceptance work:** Full owner KPI set including DSO, forecasts, exposure and role/branch visibility.

**Evidence:** `src/server/routes/insights.ts`, `src/web/pages/Dashboard.tsx`

### 5. Executive Exception Center

**Status: Partial**

Dashboard aggregates and selected operational alerts exist.

**Remaining acceptance work:** Central prioritised exception lifecycle, accountable owner, escalation and resolution evidence.

**Evidence:** `src/server/routes/insights.ts`, `src/web/pages/Dashboard.tsx`

### 6. CRM

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Complete enquiry, assignment and sales stage rules with required communication history.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 7. Customer 360°

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Unified customer financial, operational, document, risk and communication view.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 8. Customer Onboarding

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Enforced onboarding checklist, approval gates and customer-specific operating setup.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 9. KYC / Compliance

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** KYC verification, sanctions screening, expiry gates and evidence review.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 10. Key Account Management

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Account plans, review cadence, retention targets and relationship ownership.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 11. Pricing Department

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Dedicated pricing work queues, procurement lifecycle and SLA controls.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 12. Tariff Management

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Full tariff validity, contract versions, surcharges and lane-specific pricing rules.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 13. Carrier RFQ

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Carrier RFQ issuance, response capture, comparison and award workflow.

### 14. Rate Intelligence

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Rate history, benchmarks and actionable pricing intelligence.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 15. Quotations

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Complete versions, alternatives, terms and approval/sign-off requirements.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 16. Margin Controls

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Configurable margin bands and escalation tiers, controlled overrides and approval history.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 17. Booking Management

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Capacity confirmation, cut-off checks and all booking approval/document gates.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 18. Master Job / House Job

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Validate full master/house allocation, consolidation and cross-record lifecycle, beyond parent linking.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 19. Freight Departments

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Department-specific workflow, authority, queues and KPI acceptance.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 20. Shipment / Job Record

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Verify every requested job field, document and linked record, not just base CRUD.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 21. Separate Status Models

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Independent operational, documentation, customs and financial state machines with transition guards.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 22. Routing Engine

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Multi-leg constraints, routing changes, exception propagation and handover controls.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 23. Ocean Freight

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Full ocean carrier lifecycle, manifest, releases, cut-offs and equipment controls.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 24. Air Freight

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Full air execution, capacity, AWB handling and airline-specific acceptance.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 25. Road Freight

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Full road permits, border events, vehicle assignment and delivery/POD workflow.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 26. NVOCC / Consolidation

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** NVOCC consolidation planning, deconsolidation, manifest and cost allocations.

### 27. Containers

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Equipment interchange, movement lifecycle, releases and return validation.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 28. Detention / Demurrage

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Contract free-time rules, charge computation, liability and alerts across all equipment events.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 29. Container Deposit

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Container deposit collection, settlement, refund and reconciliation ledger.

### 30. BL / AWB Engine

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Controlled BL/AWB numbering, amendments, approvals, versions and releases.

### 31. Original Document Custody

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Original document custody chain, handovers, release authority and acknowledgements.

### 32. Documentation Department

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Document checklists, verification, release gates and departmental work queues.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 33. Manifest Management

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Controlled manifest generation, versions, submission and reconciliation.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 34. Customs

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Full declaration lifecycle, validation, duty reconciliation and release gating.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 35. Customs Integration Layer

**Status: External validation**

Generic customs/EDI transport exists; certified gateway behaviour is unverified.

**Remaining acceptance work:** Real gateway credentials, supported message schema, acknowledgement/rejection, sandbox and live acceptance.

**Evidence:** `src/server/integrations/edi.ts`

### 36. MPCI / Future Compliance Requirements

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Versioned MPCI/future regulatory rules and effective-date compliance checks.

### 37. Dangerous Goods

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** DG classification, segregation, approvals, certificates and operating restrictions.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 38. Reefer / Cold Chain

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Temperature events, excursion response, evidence and cold-chain handling controls.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 39. Project Cargo

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Project cargo engineering, route surveys, lift planning and execution controls.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 40. Insurance

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Coverage validation, policy limits, certificate workflows and insurer integration.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 41. Claims

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Claim reserves, liability, recovery, insurer correspondence and financial settlement.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 42. Transport Management

**Status: Partial**

Transport orders, drivers, fleet, warehouses, stock movements, GRNs and dispatch records exist; warehouse posting includes stock controls.

**Remaining acceptance work:** Complete assignment, permits, driver communication and POD controls.

**Evidence:** `src/shared/entities/operations2.ts`, `src/server/domain/warehouse.ts`

### 43. Dispatch Board

**Status: Partial**

Transport orders, drivers, fleet, warehouses, stock movements, GRNs and dispatch records exist; warehouse posting includes stock controls.

**Remaining acceptance work:** Live dispatch board with capacity, conflicts and reassignment handling.

**Evidence:** `src/shared/entities/operations2.ts`, `src/server/domain/warehouse.ts`

### 44. Driver Application

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Dedicated driver workflow, mobile POD, signatures/photos and offline synchronisation.

### 45. Fleet

**Status: Partial**

Transport orders, drivers, fleet, warehouses, stock movements, GRNs and dispatch records exist; warehouse posting includes stock controls.

**Remaining acceptance work:** Fleet availability, licensing, planned maintenance and operating cost controls.

**Evidence:** `src/shared/entities/operations2.ts`, `src/server/domain/warehouse.ts`

### 46. Warehouse Management

**Status: Partial**

Transport orders, drivers, fleet, warehouses, stock movements, GRNs and dispatch records exist; warehouse posting includes stock controls.

**Remaining acceptance work:** Complete receiving, putaway, pick/pack and stock reconciliation lifecycle.

**Evidence:** `src/shared/entities/operations2.ts`, `src/server/domain/warehouse.ts`

### 47. Advanced Warehouse

**Status: Partial**

Transport orders, drivers, fleet, warehouses, stock movements, GRNs and dispatch records exist; warehouse posting includes stock controls.

**Remaining acceptance work:** Replenishment, quarantine, serials, slotting and all advanced warehouse rules.

**Evidence:** `src/shared/entities/operations2.ts`, `src/server/domain/warehouse.ts`

### 48. Barcode / QR

**Status: Partial**

Transport orders, drivers, fleet, warehouses, stock movements, GRNs and dispatch records exist; warehouse posting includes stock controls.

**Remaining acceptance work:** Scanning workflows and barcode/QR identity validation across operations.

**Evidence:** `src/shared/entities/operations2.ts`, `src/server/domain/warehouse.ts`

### 49. Warehouse Billing

**Status: Partial**

Transport orders, drivers, fleet, warehouses, stock movements, GRNs and dispatch records exist; warehouse posting includes stock controls.

**Remaining acceptance work:** Storage/handling tariffs, automated accrual and warehouse invoice generation.

**Evidence:** `src/shared/entities/operations2.ts`, `src/server/domain/warehouse.ts`

### 50. Vendor / Carrier / Agent Management

**Status: Partial**

Party records include business counterparties; selected profitability reports are available.

**Remaining acceptance work:** Counterparty contracts, compliance, terms, risk and complete lifecycle.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/reports.ts`

### 51. Vendor Onboarding

**Status: Partial**

Party records include business counterparties; selected profitability reports are available.

**Remaining acceptance work:** Vendor approval checks, banking verification and purchasing/payment gates.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/reports.ts`

### 52. Vendor Performance

**Status: Partial**

Party records include business counterparties; selected profitability reports are available.

**Remaining acceptance work:** Vendor scorecards, service measurements and corrective action.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/reports.ts`

### 53. Overseas Agent Management

**Status: Partial**

Party records include business counterparties; selected profitability reports are available.

**Remaining acceptance work:** Agent agreements, settlements, overseas agency controls and permissions.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/reports.ts`

### 54. Job Costing

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Final GP validation, complete cost capture, accruals and variance review.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 55. Cost Allocation

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Controlled shared-cost allocation methods, audit and reversals.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 56. Accrual Accounting

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Accrual creation, reversal, matching, approvals and ledger reconciliation.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 57. WIP / Revenue Recognition

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** WIP and revenue-recognition policies, schedules and approved ledger postings.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 58. Double-Entry Accounting

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Verify complete accounting policies, control accounts and fiscal close against company COA.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 59. Accounts Receivable

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Complete collections, disputes, reminders, statements and authority controls.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 60. Accounts Payable

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Three-way matching, vendor disputes, payment authority and reconciliation.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 61. Credit Control

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Credit risk workflow, holds, overrides and approval evidence.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 62. Credit Limits

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Exposure calculations across jobs, unbilled work, invoices and guarantees.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 63. Treasury

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Cash forecasts, bank/cash controls, guarantees and treasury authorisation.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 64. Cheque / PDC

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Cheque custody, PDC maturity, deposit, clearance and bounced-cheque lifecycle.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 65. Bank Reconciliation

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Complete bank reconciliation review, adjustments and sign-off, beyond import/matching.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 66. Multicurrency

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** FX revaluation, realised/unrealised differences and consolidation policies.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 67. UAE VAT

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Company tax mapping, validations, filing review and regulatory acceptance.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 68. UAE e-Invoicing

**Status: External validation**

UBL/PINT-style export and configurable provider transport exist; provider/regulatory acceptance is unverified.

**Remaining acceptance work:** Provider onboarding, accepted schema, response handling, sandbox/live validation and mandated record retention.

**Evidence:** `src/server/integrations/einvoice.ts`

### 69. Corporate Tax Support

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Corporate-tax schedules, adjustments, supporting records and approved compliance review.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 70. Fixed Assets

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Depreciation engine, disposal posting, transfers and asset reconciliation.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 71. Budgeting

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Budgets, scenarios, ownership, revisions and variance approvals.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 72. Financial Consolidation

**Status: Partial**

Accounts, balanced posting, invoices, bills, allocations, banks, FX, tax and selected approvals/reports provide a finance foundation.

**Remaining acceptance work:** Intercompany eliminations, consolidations and group currency reporting.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`

### 73. Procurement

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Purchase requisitions, RFQs, comparisons, award, receipt matching and approvals.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 74. Operational Advances

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Advance issuance, settlement, ageing and accountable-party reconciliation.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 75. Approval Engine

**Status: Partial**

Independent maker/checker requests and decisions now cover bills, payments, quotations and purchase orders. Threshold posting bypass is removed; edited or pending documents invalidate approval.

**Remaining acceptance work:** Configurable multi-level authority matrices, delegation, temporary substitutes, escalation, budget and credit approvals remain.

**Evidence:** `src/shared/entities/finance.ts`, `src/server/domain/accounting.ts`, `src/server/domain/finance.ts`, `src/server/reports.ts`, `src/server/engine.ts`

### 76. Workflow Engine

**Status: Partial**

Workflow events now enqueue atomically with source changes. Durable runs support delays, event deduplication, transaction-safe internal retries, attempt history, edited/disabled-rule cancellation, failed-run handling and independent database processing for the demo. Uncertain external outcomes require review and are not replayed automatically.

**Remaining acceptance work:** Multi-step workflow templates, branching, business calendars, approval escalation, department/shift queues, SLA policies and company acceptance remain.

**Evidence:** `src/server/automation.ts`, `src/shared/entities/platform.ts`, `src/shared/entities/people.ts`, `src/server/routes/admin.ts`, `src/shared/entities/automation.ts`, `src/server/scheduler.ts`

### 77. SLA Engine

**Status: Partial**

Customer/service/department/activity policies set persisted elapsed deadlines; waiting pause/resume, owner/escalation notifications and a scheduler record one-time breaches.

**Remaining acceptance work:** Working calendars, holidays, authority/escalation tiers, retrospective migration and operational acceptance remain outstanding.

**Evidence:** `src/server/domain/work.ts`, `src/server/routes/work.ts`, `src/shared/entities/work.ts`, `src/web/pages/WorkPages.tsx`, `tests/work-controls.ts`, `tests/work-api.ts`

### 78. Department Work Queues

**Status: Partial**

Source-linked department queues automatically track quotations, carrier confirmations, sea/air BL drafts and delivered shipment POD; source transitions complete activities, and source module permissions filter visibility.

**Remaining acceptance work:** Full activity catalogue, branch/entity record isolation, skill-based routing, reassignment approval policies and production queue acceptance remain outstanding.

**Evidence:** `src/server/domain/work.ts`, `src/server/routes/work.ts`, `src/shared/entities/work.ts`, `src/web/pages/WorkPages.tsx`, `tests/work-controls.ts`, `tests/work-api.ts`

### 79. Workload Management

**Status: Partial**

Staff capacity points, activity complexity, open jobs/tasks and overdue counts drive workload summaries and manager-reviewed same-department recommendations with source-permission checks.

**Remaining acceptance work:** Skill qualifications, availability calendars, forecasts, capacity history and optimisation/operational acceptance remain outstanding.

**Evidence:** `src/server/domain/work.ts`, `src/server/routes/work.ts`, `src/shared/entities/work.ts`, `src/web/pages/WorkPages.tsx`, `tests/work-controls.ts`, `tests/work-api.ts`

### 80. Shift Handover

**Status: Partial**

Senders capture active activities, open jobs, tasks, critical issues and permission-gated linked email; only the named recipient can acknowledge, and current source permissions redact historical activity snapshots.

**Remaining acceptance work:** Shift calendars, WhatsApp/conversation assignment, escalation of unacknowledged handovers, exception responsibility transfer and production continuity acceptance remain outstanding.

**Evidence:** `src/server/domain/work.ts`, `src/server/routes/work.ts`, `src/shared/entities/work.ts`, `src/web/pages/WorkPages.tsx`, `tests/work-controls.ts`, `tests/work-api.ts`

### 81. Customer SOP Engine

**Status: Partial**

CRM, parties, contracts, rate cards, quotations and a margin approval threshold provide a commercial foundation.

**Remaining acceptance work:** Versioned customer SOPs enforced in job/document/approval workflows.

**Evidence:** `src/shared/entities/crm.ts`, `src/server/domain/sales.ts`

### 82. Route / Lane SOP

**Status: Partial**

Event-triggered rules, tasks and notifications exist; they do not establish a full enterprise workflow engine.

**Remaining acceptance work:** Versioned lane SOPs with mandatory operational and customs steps.

**Evidence:** `src/server/automation.ts`, `src/shared/entities/platform.ts`, `src/shared/entities/people.ts`

### 83. Workflow Templates

**Status: Partial**

Event-triggered rules, tasks and notifications exist; they do not establish a full enterprise workflow engine.

**Remaining acceptance work:** Configurable workflow templates with conditions, approvals and validated transitions.

**Evidence:** `src/server/automation.ts`, `src/shared/entities/platform.ts`, `src/shared/entities/people.ts`

### 84. Cut-Off Management

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Enforced cut-off calendar, dependencies, alerts and overrides.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 85. Pre-Alert Automation

**Status: Partial**

Jobs, shipments, bookings, cargo, containers, legs, milestones, charges and customs records provide an operations foundation.

**Remaining acceptance work:** Automated validated pre-alert bundles, delivery tracking and exceptions.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`

### 86. Unified Inbox

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Unified inbound email/WhatsApp inbox with ownership and message threading.

### 87. WhatsApp Business

**Status: Partial**

WhatsApp messaging/webhooks and selected scheduled notifications exist; email supports outbound delivery.

**Remaining acceptance work:** Verify complete requested WhatsApp staff/customer flows and consent/template policy using live provider.

**Evidence:** `src/server/integrations/whatsapp.ts`, `src/server/mailer.ts`, `src/server/scheduler.ts`, `src/web/pages/WhatsAppPage.tsx`

### 88. WhatsApp Automation

**Status: Partial**

WhatsApp messaging/webhooks and selected scheduled notifications exist; email supports outbound delivery.

**Remaining acceptance work:** Durable triggers, retry/escalation and full template/message lifecycle.

**Evidence:** `src/server/integrations/whatsapp.ts`, `src/server/mailer.ts`, `src/server/scheduler.ts`, `src/web/pages/WhatsAppPage.tsx`

### 89. Daily Owner WhatsApp Brief

**Status: Partial**

WhatsApp messaging/webhooks and selected scheduled notifications exist; email supports outbound delivery.

**Remaining acceptance work:** Validate complete owner briefing metrics, schedule, authorised recipients and successful delivery.

**Evidence:** `src/server/integrations/whatsapp.ts`, `src/server/mailer.ts`, `src/server/scheduler.ts`, `src/web/pages/WhatsAppPage.tsx`

### 90. Email Automation

**Status: Partial**

WhatsApp messaging/webhooks and selected scheduled notifications exist; email supports outbound delivery.

**Remaining acceptance work:** Inbound capture, threading, parsing and complete event-triggered email rules.

**Evidence:** `src/server/integrations/whatsapp.ts`, `src/server/mailer.ts`, `src/server/scheduler.ts`, `src/web/pages/WhatsAppPage.tsx`

### 91. Communication Timeline

**Status: Partial**

WhatsApp messaging/webhooks and selected scheduled notifications exist; email supports outbound delivery.

**Remaining acceptance work:** Unified permission-scoped communication timeline across channels and entities.

**Evidence:** `src/server/integrations/whatsapp.ts`, `src/server/mailer.ts`, `src/server/scheduler.ts`, `src/web/pages/WhatsAppPage.tsx`

### 92. Universal Side Panel

**Status: Partial**

Shared navigation, document screens, search, task records and responsive layouts exist.

**Remaining acceptance work:** Consistent contextual side panel across all requested records and communication actions.

**Evidence:** `src/web/components/Shell.tsx`, `src/web/pages/DocumentsPage.tsx`, `src/web/pages/SearchPages.tsx`, `src/web/pages/Workspaces.tsx`, `src/web/reference.css`

### 93. Document Management

**Status: Partial**

Shared navigation, document screens, search, task records and responsive layouts exist.

**Remaining acceptance work:** Version control, retention, access restrictions, verification and release gates.

**Evidence:** `src/web/components/Shell.tsx`, `src/web/pages/DocumentsPage.tsx`, `src/web/pages/SearchPages.tsx`, `src/web/pages/Workspaces.tsx`, `src/web/reference.css`

### 94. OCR

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** OCR extraction, confidence review and validated structured field ingestion.

### 95. Document Matching

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Document-to-job matching with confidence, conflict handling and human verification.

### 96. Customer Portal

**Status: Partial**

Password authentication, TOTP, sessions, module/action permissions and customer record scoping exist.

**Remaining acceptance work:** Complete scoped portal workflows, upload/approval/statement and customer acceptance tests.

**Evidence:** `src/server/auth.ts`, `src/server/engine.ts`, `src/web/pages/ProfilePage.tsx`

### 97. Agent Portal

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Dedicated agent portal with scoped access, handovers, billing and settlement.

### 98. Vendor Portal

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Dedicated vendor portal with onboarding, invoices, approvals and remittance.

### 99. Employee Portal

**Status: Partial**

Password authentication, TOTP, sessions, module/action permissions and customer record scoping exist.

**Remaining acceptance work:** Complete employee self-service for HR, approvals and requested records.

**Evidence:** `src/server/auth.ts`, `src/server/engine.ts`, `src/web/pages/ProfilePage.tsx`

### 100. HRMS

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Recruitment, onboarding, performance, training and full HR lifecycle.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 101. UAE Payroll

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Complete payroll calculations, approvals, deductions and ledger reconciliation.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 102. WPS

**Status: External validation**

WPS SIF export exists; employer/bank submission acceptance is unverified.

**Remaining acceptance work:** Employer/company configuration, validated SIF content and bank/WPS acceptance with rejection handling.

**Evidence:** `src/server/integrations/wps.ts`

### 103. EOSB

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Validated EOSB calculations, entitlement policy, approvals and settlement posting.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 104. Employee Documents

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Employee document expiry, renewal evidence and access controls.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 105. Training & Competency

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Skill/competency framework, qualifications and assignment restrictions.

### 106. Knowledge Base

**Status: Missing**

No dedicated implementation identified for this capability in the reviewed source.

**Remaining acceptance work:** Versioned searchable knowledge base, ownership, approval and acknowledgement.

### 107. Internal Helpdesk

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Internal support categories, SLA, escalation and resolution knowledge.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 108. Customer Helpdesk

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Customer service SLA, channel threading, ownership and portal closure feedback.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 109. Complaint Management

**Status: Partial**

Employee, leave, attendance, payslip, insurance, claims, ticket, asset and purchase-order records exist; record availability is not a complete departmental workflow.

**Remaining acceptance work:** Complaint investigation, root cause, corrective action and feedback controls.

**Evidence:** `src/shared/entities/people.ts`, `src/server/domain/misc.ts`

### 110. Quality Management

**Status: Partial**

Compliance records, exceptions and change audit history provide a foundation; audit storage is not tamper-evident.

**Remaining acceptance work:** Quality management, CAPA, nonconformance and controlled quality records.

**Evidence:** `src/shared/entities/compliance.ts`, `src/server/domain/compliance.ts`, `src/server/engine.ts`

### 111. HSE

**Status: Partial**

Compliance records, exceptions and change audit history provide a foundation; audit storage is not tamper-evident.

**Remaining acceptance work:** HSE incidents, risk assessments, training and corrective action.

**Evidence:** `src/shared/entities/compliance.ts`, `src/server/domain/compliance.ts`, `src/server/engine.ts`

### 112. Compliance Calendar

**Status: Partial**

Compliance records, exceptions and change audit history provide a foundation; audit storage is not tamper-evident.

**Remaining acceptance work:** Complete recurring compliance obligations, reminders, evidence and escalation.

**Evidence:** `src/shared/entities/compliance.ts`, `src/server/domain/compliance.ts`, `src/server/engine.ts`

### 113. Risk Register

**Status: Partial**

Compliance records, exceptions and change audit history provide a foundation; audit storage is not tamper-evident.

**Remaining acceptance work:** Formal risk register, scoring, mitigation, owner and review history.

**Evidence:** `src/shared/entities/compliance.ts`, `src/server/domain/compliance.ts`, `src/server/engine.ts`

### 114. Audit Module

**Status: Partial**

Compliance records, exceptions and change audit history provide a foundation; audit storage is not tamper-evident.

**Remaining acceptance work:** Audit planning, execution, findings, actions and closure evidence.

**Evidence:** `src/shared/entities/compliance.ts`, `src/server/domain/compliance.ts`, `src/server/engine.ts`

### 115. Immutable Audit Trail

**Status: Partial**

Compliance records, exceptions and change audit history provide a foundation; audit storage is not tamper-evident.

**Remaining acceptance work:** Tamper-evident append-only audit, integrity verification, retention and privileged-change controls.

**Evidence:** `src/shared/entities/compliance.ts`, `src/server/domain/compliance.ts`, `src/server/engine.ts`

### 116. Reports

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Validate every specified report, reconciliation and permission scope.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 117. Profitability Analytics

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Full dimensional profitability, allocation and drilldown acceptance.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 118. Staff Productivity

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Measured productivity, workload and service metrics with valid attribution.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 119. Carrier Performance

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Carrier reliability, cost/service scorecards and source-event completeness.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 120. Customer Churn / Growth

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Churn, growth, retention and predictive/account-owner measures.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 121. Report Builder

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Custom report datasets, joins, expressions, access control and safe export.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 122. Scheduled Reports

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Scheduled report generation, scoped recipients, delivery/retry and audit.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 123. BI Layer

**Status: Partial**

Fixed operational, finance and profitability reports and dashboard aggregates exist.

**Remaining acceptance work:** Governed historical BI model, dimensions, refresh and reconciliation.

**Evidence:** `src/server/reports.ts`, `src/server/routes/insights.ts`

### 124. Universal Search

**Status: Partial**

Shared navigation, document screens, search, task records and responsive layouts exist.

**Remaining acceptance work:** Cross-module permission-aware search including documents and communication.

**Evidence:** `src/web/components/Shell.tsx`, `src/web/pages/DocumentsPage.tsx`, `src/web/pages/SearchPages.tsx`, `src/web/pages/Workspaces.tsx`, `src/web/reference.css`

### 125. EDI

**Status: External validation**

HTTP, email and SFTP transport exists; partner-specific message contracts are unverified.

**Remaining acceptance work:** Each trading partner schema, acknowledgements, idempotency, retries and contracted acceptance.

**Evidence:** `src/server/integrations/edi.ts`

### 126. Integration Hub

**Status: Partial**

Integration configuration/logging, webhooks and user-bound API keys exist.

**Remaining acceptance work:** Connector lifecycle, health, credentials rotation and documented contracts.

**Evidence:** `src/server/integrations/catalog.ts`, `src/server/integrations/log.ts`, `src/server/webhooks.ts`, `src/shared/entities/platform.ts`

### 127. Integration Monitoring

**Status: Partial**

Integration configuration/logging, webhooks and user-bound API keys exist.

**Remaining acceptance work:** Alerting, replay, dead-letter/retry and integration health ownership.

**Evidence:** `src/server/integrations/catalog.ts`, `src/server/integrations/log.ts`, `src/server/webhooks.ts`, `src/shared/entities/platform.ts`

### 128. API Platform

**Status: Partial**

Integration configuration/logging, webhooks and user-bound API keys exist.

**Remaining acceptance work:** Key-specific scopes, quotas, versioning, idempotency and developer contracts.

**Evidence:** `src/server/integrations/catalog.ts`, `src/server/integrations/log.ts`, `src/server/webhooks.ts`, `src/shared/entities/platform.ts`

### 129. AI Operations Copilot

**Status: Partial**

AI agents, tool allowlists, review queues and selected read/write tools exist. Higher autonomy can execute permitted tools without per-action approval.

**Remaining acceptance work:** Validate full operational assistance and human approval boundaries.

**Evidence:** `src/server/ai/agents.ts`, `src/server/ai/tools.ts`, `src/server/ai/templates.ts`

### 130. AI Pricing Assistant

**Status: Partial**

AI agents, tool allowlists, review queues and selected read/write tools exist. Higher autonomy can execute permitted tools without per-action approval.

**Remaining acceptance work:** Verified pricing data, recommendations, margin policy and approver sign-off.

**Evidence:** `src/server/ai/agents.ts`, `src/server/ai/tools.ts`, `src/server/ai/templates.ts`

### 131. AI Documentation QA

**Status: Partial**

AI agents, tool allowlists, review queues and selected read/write tools exist. Higher autonomy can execute permitted tools without per-action approval.

**Remaining acceptance work:** Document extraction/QA, evidence, confidence and human review gates.

**Evidence:** `src/server/ai/agents.ts`, `src/server/ai/tools.ts`, `src/server/ai/templates.ts`

### 132. AI Finance Analyst

**Status: Partial**

AI agents, tool allowlists, review queues and selected read/write tools exist. Higher autonomy can execute permitted tools without per-action approval.

**Remaining acceptance work:** Finance analysis reconciled to ledger with immutable prohibited-action boundaries.

**Evidence:** `src/server/ai/agents.ts`, `src/server/ai/tools.ts`, `src/server/ai/templates.ts`

### 133. AI Management Analyst

**Status: Partial**

AI agents, tool allowlists, review queues and selected read/write tools exist. Higher autonomy can execute permitted tools without per-action approval.

**Remaining acceptance work:** Full management insight, source attribution, access control and decision traceability.

**Evidence:** `src/server/ai/agents.ts`, `src/server/ai/tools.ts`, `src/server/ai/templates.ts`

### 134. AI Guardrails

**Status: Partial**

Reviewed capability policy rejects unreviewed tools. External messages require approval at every autonomy level. Approval rechecks the current agent allowlist and atomically claims execution to prevent duplicate actions.

**Remaining acceptance work:** Branch/user-scoped AI reads, complete action auditing, evidence quality, provider acceptance and incident/recovery controls remain. Financial posting, customs filing and cargo release tools are denied.

**Evidence:** `src/server/ai/agents.ts`, `src/server/ai/tools.ts`, `src/server/ai/templates.ts`, `src/server/ai/policy.ts`

### 135. Master Data Governance

**Status: Partial**

Organisation, roles and master records exist.

**Remaining acceptance work:** Master-data ownership, duplicate checks, change approvals and merge history.

**Evidence:** `src/shared/entities/platform.ts`, `src/shared/entities/masters.ts`, `src/shared/entities/automation.ts`

### 136. Data Quality

**Status: Partial**

Compliance records, exceptions and change audit history provide a foundation; audit storage is not tamper-evident.

**Remaining acceptance work:** Field/relationship quality rules, duplicate remediation, completeness and ownership.

**Evidence:** `src/shared/entities/compliance.ts`, `src/server/domain/compliance.ts`, `src/server/engine.ts`

### 137. Job Closure

**Status: Partial**

Closure review now validates delivery, POD or independently verified non-applicability, document review, cleared customs/returned equipment or applicable exceptions, invoiced revenue, billed/reviewed costs and no draft invoices. Evidence is invalidated by relevant record changes.

**Remaining acceptance work:** Company/lane-specific closure policies, cost accrual and WIP alternatives, required document sets, full linked-record locking and role acceptance still need implementation.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`, `src/server/domain/job-controls.ts`, `src/server/routes/jobs.ts`, `src/web/pages/JobControlPage.tsx`

### 138. Controlled Reopening

**Status: Partial**

Closed jobs are locked. Reopening requires a recorded reason and decision from a different authorised user; duplicate decisions are rejected and closure evidence requires review again. Core linked operational records cannot be changed while the job is closed.

**Remaining acceptance work:** Configurable reopening scope/expiry, delegated authorities, complete linked-document controls and company acceptance remain.

**Evidence:** `src/shared/entities/ops.ts`, `src/server/domain/jobs.ts`, `src/web/pages/JobPage.tsx`, `src/server/domain/job-controls.ts`, `src/server/engine.ts`

### 139. Production Environments

**Status: Partial**

Runtime configuration, backups and replica support exist; this is not evidence of enterprise deployment or recovery certification.

**Remaining acceptance work:** Isolated environments, release promotion, secrets/data separation and validated rollback.

**Evidence:** `src/server/config.ts`, `src/server/integrations/storage.ts`, `src/server/integrations/snapshot.ts`, `src/server/pgbridge.ts`

### 140. Backup & Disaster Recovery

**Status: Partial**

Runtime configuration, backups and replica support exist; this is not evidence of enterprise deployment or recovery certification.

**Remaining acceptance work:** Restore drills, measured RPO/RTO, retention, failover and disaster-recovery acceptance.

**Evidence:** `src/server/config.ts`, `src/server/integrations/storage.ts`, `src/server/integrations/snapshot.ts`, `src/server/pgbridge.ts`

### 141. Monitoring

**Status: Partial**

Runtime configuration, backups and replica support exist; this is not evidence of enterprise deployment or recovery certification.

**Remaining acceptance work:** Metrics, health checks, central alerting, incident response and service-level validation.

**Evidence:** `src/server/config.ts`, `src/server/integrations/storage.ts`, `src/server/integrations/snapshot.ts`, `src/server/pgbridge.ts`

### 142. Release Management

**Status: Partial**

Runtime configuration, backups and replica support exist; this is not evidence of enterprise deployment or recovery certification.

**Remaining acceptance work:** Release approvals, migrations, regression gates, rollback and change history.

**Evidence:** `src/server/config.ts`, `src/server/integrations/storage.ts`, `src/server/integrations/snapshot.ts`, `src/server/pgbridge.ts`

### 143. Migration from Fresa

**Status: Partial**

Runtime configuration, backups and replica support exist; this is not evidence of enterprise deployment or recovery certification.

**Remaining acceptance work:** Fresa source mappings, cleansing, trial imports, financial reconciliation and signed migration acceptance.

**Evidence:** `src/server/config.ts`, `src/server/integrations/storage.ts`, `src/server/integrations/snapshot.ts`, `src/server/pgbridge.ts`

### 144. UX — do NOT copy Fresa visually

**Status: Partial**

Shared navigation, document screens, search, task records and responsive layouts exist.

**Remaining acceptance work:** Validate every requested UX pattern and access path across modules.

**Evidence:** `src/web/components/Shell.tsx`, `src/web/pages/DocumentsPage.tsx`, `src/web/pages/SearchPages.tsx`, `src/web/pages/Workspaces.tsx`, `src/web/reference.css`

### 145. Staff Homepage

**Status: Partial**

Shared navigation, document screens, search, task records and responsive layouts exist.

**Remaining acceptance work:** Complete personal queue, priorities, SLA, calendar, messages and assigned work.

**Evidence:** `src/web/components/Shell.tsx`, `src/web/pages/DocumentsPage.tsx`, `src/web/pages/SearchPages.tsx`, `src/web/pages/Workspaces.tsx`, `src/web/reference.css`

### 146. Management Homepage

**Status: Partial**

Dashboard aggregates and selected operational alerts exist.

**Remaining acceptance work:** Complete management command centre including exceptions, risk, productivity and decisions.

**Evidence:** `src/server/routes/insights.ts`, `src/web/pages/Dashboard.tsx`

### 147. Mobile

**Status: Partial**

Shared navigation, document screens, search, task records and responsive layouts exist.

**Remaining acceptance work:** Full mobile task/POD/scanning/approvals and offline/device workflow acceptance.

**Evidence:** `src/web/components/Shell.tsx`, `src/web/pages/DocumentsPage.tsx`, `src/web/pages/SearchPages.tsx`, `src/web/pages/Workspaces.tsx`, `src/web/reference.css`

