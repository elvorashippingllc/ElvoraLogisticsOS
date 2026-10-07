# DigitalBurj ElvoraOS

DigitalBurj Business OS identity, styled with the approved Elvora emerald ribbon palette, signal red, graphite and self-hosted Plus Jakarta Sans / Instrument Sans. GitHub repositories are read-only references for this application. Publishing uses the private Sites source store.

## Start working

1. Open **Company records**. The first owner visit creates the private company workspace. Sample records never become company records.
2. In **Settings**, enter company details, tax registration, margin controls and the configured tax rate.
3. Assign the second person an operator role. Grant that same email access in the Site’s sharing settings. The application itself sends no invitation message.
4. Create customers and suppliers, then enquiries, quotes and jobs. An accepted quote retains its version and acceptance evidence and creates a single draft job.
5. Use a job’s **Linked work** tab for legs, bookings, cargo units and permits. Add milestone evidence and upload documents to the correct record.
6. Enter supplier costs, customer invoices and supplier bills. Posting requires a tax rationale and creates balanced journal entries. Record actual collections or owner-authorised supplier settlements with unique references.
7. Activate warehouse custody only after confirming the facility and opening stock. Record stock owner, location, lot, quantity, condition and opening evidence. Controlled cargo starts held. Owner-authorised release evidence is required before dispatch.
8. Run operational rules from **Automations** to create traceable follow-up tasks. Repeated runs do not create the same source/date/rule task again.

## Implemented workflows

| Workspace | Functions |
|---|---|
| Owner command centre | Active jobs, expected gross profit, receivables, approvals, attention queue, daily brief, freight mix and tasks |
| Commercial | Enquiries, customers, contracts, quotes, minimum-margin approvals, acceptance snapshots and job handover |
| Freight | Ocean/air/road/multimodal job files, customer orders, legs, bookings, cargo units, permits, manual source-labelled milestones and closure controls |
| Consolidation | Multiple open job members, weight/volume/equal-share allocation and reconciled integer-cent allocation snapshots |
| Transport | Subcontractor, driver, vehicle, appointment, pickup/delivery instructions and completion with uploaded POD |
| Warehouse | Cargo-owner custody balances, receipt/dispatch history, regulated holds, warehouse instructions and billable services |
| Customs | Internal readiness, classification/valuation inputs, permit references, jurisdiction, broker and separate owner-recorded authority release evidence |
| Finance | Job budgets/current expected/recorded/posted cost stages, invoices, supplier bills, postings, collections, owner settlements, trial balance, ageing and job/customer/lane profitability |
| Documents | Private uploads/downloads, categories, expiry, versions, job readiness and print/PDF views for saved records |
| Service / quality | Customer tickets, deadlines, claims, evidence and completed-work records |
| People / assets | Private employee/payroll records, compliance obligations, equipment register and maintenance/calibration due dates |
| Projects | Cargo project scopes, budgets, handover dates, permit/route/lifting instructions and completion evidence |
| Tools | CBM, configurable air-weight divisor and clearly labelled free-time calendar estimate |
| Control | Owner/operator permissions, audit history, optimistic record versions, idempotent create requests, unique supplier references and repeat-safe follow-up rules |

## Integration and scope status

Live WhatsApp Business, email delivery, carrier feeds, authority submission, banking feeds, accredited eInvoice exchange, model/OCR providers and external customer portals are **not connected**. The connection page lists the required access for each. Messages can be copied or opened as reviewed email drafts. Creating or completing internal records does not confirm an external booking, authority submission, customs release decision, carrier event or sent message.

Provider runtime app eligibility is unavailable in the authoring session. No connector declarations, provider credentials or user tokens are invented or copied into the application. Configured provider-specific integrations require supported interfaces, account consent and scoped credentials.

This release is a single-company, AED operational application for an owner and one operator. It does not implement the blueprint’s full multi-entity/intercompany accounting, currency revaluation, revenue recognition, payroll/WPS processing, bank reconciliation, regulated-zone filings, advanced FEFO allocation, customs declarations, carrier document issuance, full port tariff slabs, offline conflict synchronisation or external identity portals. Those require a subsequent configured release. A payroll record is a private record, not a payment execution.

Cargo and regulatory events capture supplied evidence; the app cannot independently validate its authenticity. Custody quantities do not become company inventory ledger assets. Tax treatment is explicitly reviewed by the operator; the app does not infer legal treatment from a route or zone.

The main workspace loads the latest 2,000 records and warns when capped. Per-kind CSV exports include up to 10,000 records. Dashboard KPIs use the loaded set. Larger data volumes require paginated queries and server-side aggregates before operational use.

## Verification and deployment

`node scripts/verify-operations.mjs` executes the actual route handlers and schema migrations against SQLite with simulated hosted identity and D1/R2 adapters. It verifies role rejection, duplicate creates, quote acceptance, concurrent dispatch, evidence-controlled release, balanced postings, duplicate receipts and service-invoice creation. It does not prove live provider integrations or browser interaction.

`node_modules/.bin/tsc --noEmit` validates types. Publish with the installed Sites workflow after a successful build. D1 is the structured record store; R2 holds private documents. Migrations remain schema-only. The hosted platform applies migrations and owns authentication/access. Real restore drills, independent backups, opening-balance reconciliation and browser acceptance testing remain deployment administration tasks.

Private deployment defaults to the owner. Use Site sharing controls intentionally before another person can visit, in addition to assigning the application’s operator role.
