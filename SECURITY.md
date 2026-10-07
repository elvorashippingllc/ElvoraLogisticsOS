# Security

* Passwords: scrypt; 5 failed sign-ins lock an account for 15 minutes; optional TOTP 2-step verification; forced change of initial passwords.
* Sessions: httpOnly, SameSite cookies, sliding expiry, CSRF header on every cookie-authenticated mutation; API keys are hashed.
* Secrets saved in Integrations are encrypted with AES-256-GCM (`APP_SECRET`).
* Every create/update/delete/login is audit-logged; permissions are enforced on the server per module and action.
* The demo workspace is a separate database with all outbound connections disabled.
* Report vulnerabilities privately to the maintainer named in your contract; do not open public issues for them.
