# Deployment

1. Provision a host with Docker (or Node 22 and a C toolchain for better-sqlite3).
2. `cp .env.example .env`, set `PUBLIC_URL`, passwords, SMTP.
3. `docker compose up -d --build`. Data lives in the `elvora-data` volume (SQLite file + uploads + backups).
4. Put a TLS reverse proxy in front (Caddy/nginx), keep `TRUST_PROXY=true` and `COOKIE_SECURE=true`.
5. Sign in, change both default passwords, enable TOTP for admins, set company details under Administration → Settings.

**Backups:** Administration → Backup creates consistent SQLite snapshots; also snapshot the volume externally.
**Scaling:** SQLite is single-node. It suits one company's workload; for multi-node or HA, migrate the data layer to PostgreSQL.
**Upgrades:** rebuild the image; schema changes are applied automatically on start.
