# Client handover guide

## The three accounts

| Purpose | E-mail | Initial password | Data |
|---|---|---|---|
| **Administrator** – all features | admin@elvorashipping.com | Elvora@Admin2026 | Production workspace, **empty** |
| **Manager** – all features | manager@elvorashipping.com | Elvora@Manager2026 | Production workspace, **empty** |
| **Demo presenter** – all features | demo@elvorashipping.com | Demo@Elvora2026 | Isolated demo workspace |

* Administrator and Manager have full access to every module. The only difference is naming; both can administer users, roles and integrations.
* On first sign-in each is forced to choose a personal password; nothing else in the application is reachable until they do. Rotate the initial passwords by setting `ADMIN_PASSWORD` / `MANAGER_PASSWORD` before the very first start if you prefer not to hand over known defaults.
* The production workspace contains **only configuration**: chart of accounts, VAT codes, currencies, countries, ports, carriers, charge codes, container types, roles, departments, the head-office branch, one legal entity, and seven AI employees (all switched off). It contains no customers, jobs, invoices, users (other than the two above), announcements or documents.

## The demo workspace

* **Separate database file** (`data/demo/demo.db`). Demo sessions are routed to it per request, so demo and production data can never mix: records created in the demo are invisible to production and vice-versa (verified by `tests/handover.ts`).
* **No outbound traffic**: e-mail, WhatsApp, e-invoice, EDI, tracking, Supabase, R2, SFTP and real AI calls are blocked while a demo session is active. Jarvis answers with a scripted assistant that really queries the demo data.
* **Rebuilt every night (03:00 Dubai)** so dates stay relative to today, and on every restart. The presenter can also press **Reset demo now** in the blue banner.
* Dates, amounts and company names are fictional (`.example` domains, dummy TRNs/IBANs).
* Turn it off completely with `DEMO_ENABLED=false`. The login page shows an **Explore the demo workspace** button only while it is enabled.

### Scenarios included in the demo

| Area | What you can show |
|---|---|
| Sales & CRM | Leads from several sources (including a WhatsApp enquiry), opportunities by stage, campaign, calls/activities, quotations in every state (draft, sent, awaiting margin approval, accepted→job, rejected, expired), rate cards, contract nearing renewal |
| Operations | Jobs in every status – open, in progress, on hold (customs query), delivered-not-invoiced, closed, cancelled; delayed vessel with rolled booking; dangerous goods; temperature-controlled air export; container free-time risk; sub-jobs, bookings with cut-offs, delivery order, trip with signed POD; public tracking link; EDI/tracking history |
| Customs | Cleared export declaration, import declaration with a raised query |
| Finance | Posted, partly paid, paid, void, draft, pro-forma and credit-note invoices; foreign-currency invoice; on-account receipt; receivables ageing in every bucket; vendor bills due soon, overdue, partly paid, pending approval; expense claims in each state; bank statement with matched and unmatched lines; e-invoice statuses; **previous year closed and locked**; **second legal entity and branch** |
| People | Employees with expiring visas/IDs, leave requests, attendance, payroll for last month, generated **WPS salary file** |
| Warehouse & transport | Low stock, near-expiry lots, posted and draft receipts, dispatch, vehicles with expiring registration, drivers |
| Support & risk | Tickets in every state, cargo claims (investigating, with insurer), insurance certificate |
| Work | Project with a Kanban of tasks (including blocked and overdue), reminders |
| AI & automation | Active AI employees, a briefing on the dashboard, runs, **pending approvals** to approve live, automation rules, a webhook |
| Platform | Documents with expiries (real viewable files), announcements, notifications, WhatsApp inbox, integration log, audit trail, custom field, Arabic/RTL toggle |

### Suggested 20-minute walkthrough
1. Dashboard & Jarvis briefing → alerts → drill into an overdue invoice.
2. Quotation awaiting approval → approve → convert to job.
3. Delayed job: timeline, tracking page, customs query, WhatsApp milestone.
4. Invoice from job → post → PDF → e-invoice XML → receipt → bank reconciliation.
5. AI Team → approve Collections Agent's e-mail → Activity.
6. Payroll → WPS file. Year-end close history. Entity filter on trial balance.
7. Switch language to Arabic.

## Go-live checklist (production)
1. Set `APP_SECRET`, `PUBLIC_URL`, `TRUST_PROXY`, `COOKIE_SECURE`, and (optionally) initial passwords in `.env`; run behind HTTPS.
2. Sign in as Administrator, set your own password, enable 2-step verification.
3. Company Settings: legal name, address, TRN, licence, bank details, document terms. Branches: confirm DXB details. Legal entities: edit the default entity.
4. Create real users and roles. (Customer-portal users are tied to a customer.)
5. Integrations: connect Resend, R2, Supabase, WhatsApp, AI provider as needed; press *Test connection* for each.
6. Import customers/opening balances; set the accounting lock date after opening balances are checked.
7. Enable nightly R2 backup; test a restore.
8. Switch on the AI employees you want, starting with approval-required autonomy.
9. Decide whether to keep `DEMO_ENABLED=true` on this server (recommended only for sales demonstrations).

## Ownership and support materials
* Source: this repository (React + Fastify + SQLite). `docs/` holds features, integrations, AI team, deployment and this guide; `corporate-templates/` holds the 82 document templates, 16 e-mails and marketing collateral.
* Automated checks: `npm run typecheck`, `npm test` (134), `npm run test:integrations` (83), `npm run test:handover` (48). A CI workflow runs them on every push.
