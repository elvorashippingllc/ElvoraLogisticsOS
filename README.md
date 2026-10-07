# Elvora Logistics OS

Full-stack freight-forwarding and logistics ERP for Elvora Shipping L.L.C.: CRM, quotations, master jobs and
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

Copy `.env.example` to `.env` to configure. `SEED_DEMO=true` loads fictional demo data into an empty database
(admins can also load it from the Administration area).

## First sign-in

| Role | E-mail | Password |
|---|---|---|
| Administrator (all access) | admin@elvorashipping.com | Elvora@Admin2026 |
| Manager (all access) | manager@elvorashipping.com | Elvora@Manager2026 |

These are defaults. **Change both passwords at first login** (the app shows a banner until you do) or set
`ADMIN_PASSWORD` / `MANAGER_PASSWORD` before the first start.

## Design

One entity definition (`src/shared/entities/*`) drives the SQLite schema, REST API, validation, list/form UI, CSV
import/export, permissions and audit — 84 entities across 16 permission modules (view / create / edit / delete /
approve / export). Money is stored as integer cents; invoices post to a double-entry ledger; job numbers follow
`{branch}{MM}{YY}{seq}` (e.g. DXB10260136).

Security: scrypt password hashing, httpOnly session cookie, CSRF header, login lockout, optional TOTP, API keys,
helmet, rate limiting, audit log. Backups via Administration → Backup.

See [docs/FEATURES.md](docs/FEATURES.md) for the feature list and limits, and [docs/DEPLOY.md](docs/DEPLOY.md).

## Tests

`npm run typecheck`; with the server running on an empty database: `npm test` (134 API checks).
