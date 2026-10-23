# Elvora Logistics OS

Full-stack freight-forwarding and logistics ERP with AI employees, WhatsApp automation and integrations for Elvora Shipping L.L.C.: CRM, quotations, master jobs and shipments, tracking, customs, transport, warehouse, double-entry accounting, HR, support, projects, documents, reports/KPI and administration — in one app.

**Stack:** Node 22, Fastify 5, SQLite (better-sqlite3, WAL) or PostgreSQL/Supabase ([docs/POSTGRES.md](docs/POSTGRES.md)), zod · React 19, Vite, Tailwind 4, react-query, recharts.

## Run

```bash
npm ci
npm run dev            # API :8080 + web :5173
# production
npm run build && npm start
# or
docker compose up -d --build
```

Copy `.env.example` to `.env` and configure secrets before starting. The fictional **demo workspace** is off by default (`DEMO_ENABLED=true` turns it on, see [docs/HANDOVER.md](docs/HANDOVER.md)); production data is never mixed with it. A new production workspace starts with Elvora's starter data; see [docs/STUDIO.md](docs/STUDIO.md) for Document Studio and starter-data/reset options.

## Sign-in and bootstrap

For security, this public README does not publish usernames/passwords or reusable initial credentials. Bootstrap production accounts using the supported environment variables and the first-login password-change flow. Never enable demo mode on a production workspace unless the isolation and outbound-communication safeguards have been explicitly verified. Rotate any credentials that may have been exposed in repository history or deployment logs.

## Design

One entity definition (`src/shared/entities/*`) drives the SQLite schema, REST API, validation, list/form UI, CSV import/export, permissions and audit — 97 entities across 18 permission modules (view / create / edit / delete / approve / export). Money is stored as integer cents; invoices post to a double-entry ledger; job numbers follow `{branch}{MM}{YY}{seq}` (e.g. DXB10260136).

Security controls include scrypt password hashing, HTTP-only session cookies, CSRF header, login lockout, optional TOTP, API keys, Helmet, rate limiting and audit logging. Backups are available via Administration → Backup. Before production, complete the [Production Readiness Checklist](docs/PRODUCTION-READINESS.md).

UAE compliance (licence register, licensed-activity guard, VAT/TRN rules, sanctions, calendar): [docs/UAE-COMPLIANCE.md](docs/UAE-COMPLIANCE.md).

See [docs/FEATURES.md](docs/FEATURES.md) (features & limits), [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) (Resend, R2, Supabase, WhatsApp, e-invoicing…), [docs/AI-TEAM.md](docs/AI-TEAM.md) (Jarvis & AI employees) and [docs/DEPLOY.md](docs/DEPLOY.md).

## Company calendar

Open Calendar to view dated records across the OS in Month, Week, Day or Agenda view. Filter by activity color, assignment and urgency; schedule meetings, calls, visits and tasks; review unread alerts. See [docs/CALENDAR.md](docs/CALENDAR.md).

## Tests

Run `npm run typecheck`; with the server running on an empty database, `npm test` runs API checks. Integrations/AI/finance extensions: start the API with `WA_GRAPH_URL=http://localhost:9099/graph RESEND_API_URL=http://localhost:9099/resend R2_ENDPOINT=http://localhost:9099/r2` on a fresh data directory, then `npm run test:integrations` against built-in mock providers. Run `npm run test:compliance` and `npm run test:handover` on a fresh data directory. See [docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) for release-gate tests.

The complete acceptance runner is `npm run test:all`. It includes enterprise approvals, durable automation (including a process restart), work queues/handovers, RFQ/knowledge/competency, BL/AWB custody, container deposits and real PDF/image OCR. Install `tesseract-ocr tesseract-ocr-eng poppler-utils` for OCR checks; these executables are included in the production Docker image and CI. Each suite uses an isolated empty data directory and, when `TEST_PG_ADMIN_URL` is supplied, its own fresh PostgreSQL database.
