# Two-person pilot security fixes — 8 October 2026

This patch fixes reproduced authentication defects and related account/workspace controls. It does not claim completion of the 147-area enterprise scope.

- The API blocks business reads, writes and API-key access while a temporary password must be changed. Profile, password change and logout remain available to the browser. Setup metadata exposes only branding and currency until the password is changed.
- Authenticator setup requires the current password, preserves existing protection, encrypts the pending secret, binds confirmation to the requesting session and expires after ten minutes. Enabling/disabling revokes other browser sessions. Disabling requires both password and a current authenticator code. Active secrets are encrypted; existing plaintext secrets remain usable. Bad login codes participate in account lockout; account security endpoints are rate limited and unavailable to API keys.
- Internal settings, including pending authenticator secrets, are excluded from settings API responses.
- Public requests ignore browser workspace cookies. API-key requests always use production. An unavailable demo workspace cannot fall back to production.
- Current company-wide AI tools are limited to full-access, non-portal users. The two seeded full-access accounts retain access. Granular AI access requires caller-aware tool scoping in a later change.
- Remote PostgreSQL requires verified TLS. Private provider CAs are supplied with `PG_CA_CERT`. Logical backups use a repeatable-read, read-only transaction.
- Oracle images publish only after successful CI for the same main commit. Images carry a revision label and `sha-<commit>` tag for identifiable releases. A superseded build cannot replace `latest` at the publication check.

`tests/auth-security.ts` exercises the authentication, settings, session, demo/API-key, AI permission and TLS regressions. Other API suites perform real first-login password changes instead of bypassing the guard. The security suite is part of SQLite and PostgreSQL CI.

Before deployment, preserve the encryption key (`APP_SECRET` or the data directory's `.secret`) and database backup. If PostgreSQL uses a private CA, configure its trusted PEM certificate. Existing TOTP users do not need to re-enrol. The profile now asks for password confirmation during setup and the current code when disabling.

Still pending: live Oracle deployment verification, backup restoration drill, provider acceptance, staff branch/field scopes and the remaining enterprise scope. No production data or company permission assignments are changed by this patch.
