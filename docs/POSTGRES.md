# Running on PostgreSQL (Supabase)

Set `DATABASE_URL` and the app stores everything in PostgreSQL instead of the local SQLite file. Unset it and nothing changes (SQLite, `DATA_DIR`). Both drivers pass the same four test suites plus a 740-request endpoint sweep (`npm run test:all`; for Postgres set `TEST_PG_ADMIN_URL`, see `tests/run-all.sh`); CI runs both.

## Scoping – what the move involved

| Question | Finding |
|---|---|
| How coupled is the code to the database? | 428 synchronous query calls in 41 files; the engine, hooks, domain logic, reports and AI tools are all synchronous (no `async` in the data path). |
| Port to an async Postgres client? | Would turn nearly the whole server async (every hook chain, ~8,000 lines) – high regression risk, days of work. **Not done.** |
| What was done instead | A **synchronous bridge**: one `pg` client in a worker thread; the caller blocks (`Atomics.wait`) until the answer arrives (`src/server/pgbridge.ts`). Semantics equal the old single SQLite connection – one statement at a time, transactions cannot interleave – so none of the business logic changed. |
| SQLite-specific SQL | About 25 sites: `INSERT OR IGNORE/REPLACE`, `lastInsertRowid`, `PRAGMA`, `sqlite_master`, `AUTOINCREMENT`, `julianday`, `group_concat`, `IS ?`, `SUM(boolean)`, lenient `GROUP BY`/`HAVING` aliases, a NUL character in a sequence key, bare `month` alias. All ported to syntax valid on both databases or translated in `toPg()`. |
| Demo workspace | A separate schema (`<schema>_demo`) built beside the live one and swapped in; rebuilt at boot and nightly as before. |
| Backups | There is no file to copy: *Backup* now writes a gzip NDJSON snapshot of every table (`.json.gz`). Supabase's own backups (paid plans) and point-in-time recovery are the real safety net. |

## Trade-off to know about
Each query blocks the Node process for one network round trip, so **host the app in the same region as the database** (Supabase project `odejxqdftnbhtuvxqiwx` is `ap-southeast-1`, Singapore). At ~1–3 ms per query this is imperceptible for a freight-forwarding team; from another continent (150–250 ms) pages would crawl. The planned next step if load grows is an incremental async migration of the hottest paths.

## Configuration
* `DATABASE_URL` – Supabase **session pooler** (port 5432, user `postgres.<ref>`) or direct connection. Not the transaction pooler (6543): the app relies on `SET search_path` and multi-statement transactions on one session.
* `PG_SCHEMA` – production schema (default `elvora`); the app creates it. App tables never live in `public`, so Supabase's REST API does not expose them.
* TLS is on for any non-local host. The password is a secret: set it on the host, rotate it if it was ever shared in chat or e-mail.
* The earlier `public.*` mirror tables created for the "Supabase replica" integration are unused when the app runs on Postgres; leave the replica switched off.

## Upgrading existing SQLite data
There is no automatic copy. A fresh Postgres workspace is seeded with the reference data; for a database that already holds live records, export from the old install (CSV export per entity, or ask for a one-off migration script) before switching.
