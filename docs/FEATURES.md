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

## Not included (be aware)

- No live carrier, customs (e.g. Dubai Trade/ICP), bank, or e-invoicing integrations; tracking and customs are manual entry plus links.
- EDI (IFTMIN, FWB, JSON) is generated for download, not transmitted.
- No WPS salary file; no year-end close; single accounting entity.
- No Arabic/RTL UI yet.
- PDF output is via browser print ("Save as PDF").
- SQLite single-node; default passwords must be changed.
