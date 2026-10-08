# Feature coverage

Reference products reviewed for scope: Fresa Gold/Vega (screenshots supplied), Zoho (CRM/Books/Inventory/Projects/Desk),
Odoo (CRM/Sales/Accounting/Inventory/HR/Helpdesk), CargoWise-style forwarding workflows.

| Area | Elvora Logistics OS |
|---|---|
| Master Job (Fresa) | Department, Job/B-L/Operational status, INCO terms, Generate EDI, KPI, Bulk PI, Track-Trace, tabs Accounting / SB-BOE / Customs / Shipments / Inventory, right rail Comments, Follow Up, Attachments, References, Tags, Links, Likes, Complaints, Video Call, History |
| Job search | Type / Filter / Value search with result grid; global Ctrl+K search |
| Dashboard | Sales by branch, recent jobs, calls, shipments |
| CRM (Zoho/Odoo) | Parties, contacts, leads, opportunities, calls/activities, campaigns, contracts |
| Sales | Quotations with margin approval -> convert to job, rate cards, e-mail/print |
| Operations | Sea/air/road/project jobs, sub-jobs, containers, cargo, milestones, public tracking links, carrier bookings, delivery orders, customs declarations |
| Transport | Vehicles, drivers, trips, dispatch |
| Warehouse | Items, bins, GRN, dispatch (FEFO), stock ledger, adjust/transfer, barcode scan |
| Accounting | Invoices, bills, receipts, payments, expenses, double-entry ledger, VAT codes, FX gain/loss, lock date, statements |
| People | Employees, attendance, leave, payroll records |
| Support | Tickets, claims/complaints |
| Work | Projects, tasks, calendar |
| Platform | Roles/permissions, audit log, automation rules, webhooks (HMAC), API keys, custom fields, SMTP outbox, backups, customer portal role, TOTP |

## Added in release 2

| Area | What was added |
|---|---|
| Carriers | Terminal49 live tracking + universal tracking webhook → job timeline |
| Customs | Gateway/broker API submission, JSON export |
| EDI | IFTMIN / FWB / JSON **transmission** over HTTP, e-mail or SFTP |
| Banking | CSV + MT940 import, bank-feed webhook, automatic matching |
| E-invoicing | UBL 2.1 PINT AE XML, ASP submission, status on the invoice |
| Payroll | UAE WPS SIF file with validation of every employee's IBAN / routing / person ID |
| Accounting | Year-end close & re-open, multiple legal entities with entity-filtered ledgers |
| Documents | Server-rendered **PDF** (download + e-mail with attachment); bilingual EN/AR document headings |
| Language | Arabic UI with right-to-left layout and Arabic web font (UI chrome, navigation and ~600 field labels) |
| Platform | Resend mail, Cloudflare R2 files & backups, PostgreSQL primary or optional Supabase replica, encrypted secrets |
| WhatsApp | Lead capture, staff & customer bots, milestone alerts, overdue reminders, owner daily report, inbox, automation actions |
| AI | Jarvis chat + 7 AI employees, approvals queue, schedules, free-provider presets with fallback |

## Added in release 3 – UAE compliance

Compliance Centre, licences & registrations register, licensed-activity guard, statutory calendar, exceptions log, UAE tax-invoice rules, sanctions-screening control, gratuity and related-party reports, PINT AE endpoint fix. See [UAE-COMPLIANCE.md](UAE-COMPLIANCE.md).

## Limits you should know about

- Integrations were verified against mock providers, not live services (see INTEGRATIONS.md). Credentials and provider approvals (Meta templates, ASP accreditation, bank WPS onboarding, Terminal49 plan) are yours to obtain.
- The primary database is PostgreSQL when `DATABASE_URL` is configured, otherwise SQLite. The optional Supabase replica is separate and should stay disabled when PostgreSQL is primary. MongoDB is not used.
- WPS SIF follows the common bank layout – confirm with your bank before first upload. Deductions are netted into the fixed component.
- Arabic translation covers navigation, buttons, statuses and field labels; free-text data, error messages and some long help texts stay in English. Printed documents are English with Arabic titles.
- No live customs-system integrations ship out of the box (Dubai Trade / Mirsal / ICP need your own registered API access); the gateway adapter accepts JSON.
- PDF engine is Chromium (included in the Docker image; set `CHROME_PATH` otherwise).
- Default passwords must be changed; set `APP_SECRET`.
