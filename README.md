# Elvora Logistics OS

Full-stack freight-forwarding and logistics ERP with AI employees, WhatsApp automation and integrations for Elvora Shipping L.L.C.: CRM, quotations, master jobs and
shipments, tracking, customs, transport, warehouse, double-entry accounting, HR, support, projects, documents,
reports/KPI and administration — in one app.

**Stack:** Node 22, Fastify 5, SQLite (better-sqlite3, WAL), zod · React 19, Vite, Tailwind 4, react-query, recharts.

## Run

```bash
npm install
npm run dev            # API :8080 + web :5173
# production
npm run build && npm start
# or
docker compose up -d --build
```

Copy `.env.example` to `.env` to configure. A separate, fictional **demo workspace** is built at start-up (see [docs/HANDOVER.md](docs/HANDOVER.md)); production data is never mixed with it.

## Sign-in

| Account | E-mail | Password | Workspace |
|---|---|---|---|
| Administrator (all access) | admin@elvorashipping.com | Elvora@Admin2026 | Production – empty, no sample data |
| Manager (all access) | manager@elvorashipping.com | Elvora@Manager2026 | Production – empty, no sample data |
| Demo presenter (all access) | demo@elvorashipping.com | Demo@Elvora2026 | Isolated demo – fictional data, resets nightly |

The two production accounts must set their own password at first sign-in (the app blocks everything else until they do), or set
`ADMIN_PASSWORD` / `MANAGER_PASSWORD` before the first start. The demo account can be disabled with `DEMO_ENABLED=false`.

## Design

One entity definition (`src/shared/entities/*`) drives the SQLite schema, REST API, validation, list/form UI, CSV
import/export, permissions and audit — 97 entities across 18 permission modules (view / create / edit / delete /
approve / export). Money is stored as integer cents; invoices post to a double-entry ledger; job numbers follow
`{branch}{MM}{YY}{seq}` (e.g. DXB10260136).

Security: scrypt password hashing, httpOnly session cookie, CSRF header, login lockout, optional TOTP, API keys,
helmet, rate limiting, audit log. Backups via Administration → Backup.

UAE compliance (licence register, licensed-activity guard, VAT/TRN rules, sanctions, calendar): [docs/UAE-COMPLIANCE.md](docs/UAE-COMPLIANCE.md).

See [docs/FEATURES.md](docs/FEATURES.md) (features & limits), [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) (Resend, R2, Supabase, WhatsApp, e-invoicing…), [docs/AI-TEAM.md](docs/AI-TEAM.md) (Jarvis & AI employees) and [docs/DEPLOY.md](docs/DEPLOY.md).

## Tests

`npm run typecheck`; with the server running on an empty database: `npm test` (135 API checks). Integrations/AI/finance extensions: start the API with `WA_GRAPH_URL=http://localhost:9099/graph RESEND_API_URL=http://localhost:9099/resend R2_ENDPOINT=http://localhost:9099/r2` on a fresh data dir, then `npm run test:integrations` (83 checks against built-in mock providers). `npm run test:compliance` (65 checks, UAE rules) and `npm run test:handover` (48 checks) proves production is empty, the demo is rich and the two are isolated; run it on a fresh data directory.
