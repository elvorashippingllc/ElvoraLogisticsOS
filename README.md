# DigitalBurj ElvoraOS

A private freight operations app for Elvora Shipping, using DigitalBurj Business OS identity and the approved Elvora brand palette and fonts.

See [OPERATIONS.md](OPERATIONS.md) for workflows, implemented modules, current integration limits and configuration steps.

- Framework: React / Vinext Worker through Sites.
- Structured records: D1 with versioned schema migrations.
- Private documents: R2.
- Identity: platform-owned ChatGPT sign-in and Site access controls.
- Roles: one owner and one operator.
- Validation: `node scripts/verify-operations.mjs` and `node_modules/.bin/tsc --noEmit`.

External providers are not configured. Sample records are read-only and never seed company data. Source publication goes to the private Sites source store; no changes are pushed to the reference GitHub repositories.
