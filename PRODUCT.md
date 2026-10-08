# Elvora Logistics OS

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
The redesigned home prioritizes the owner and operations team together, confirmed in this session.

## Product Purpose
Manage freight jobs, sales, shipments, warehouse activity, finance, documents and administration in one permission-aware workspace.

## Capabilities and Constraints
Preserve existing routes, API contracts, permissions, demo isolation and operational workflows. Figures must come from the existing API. Repository evidence: React, TypeScript, Fastify and SQLite/Postgres integration.

## Brand Commitments
Use only the supplied repository's Elvora logos, icon marks, fonts and brand palette. The uploaded wallet dashboard is a composition reference for the complete interface redesign.

## Product Principles
- Give owner figures and operational work equal access.
- Keep tasks and actions discoverable.
- Apply one shared visual system throughout.
- Preserve working business logic.

## Canonical Enterprise Scope
The full user-supplied target is [ELVORA CONTROL](docs/scope/MASTER-SPECIFICATION.md), with 147 numbered areas, the enterprise lifecycle and six primary areas: SELL, MOVE, CONTROL, MONEY, CONNECT and MANAGE. It supersedes earlier piecemeal feature lists as the target specification; the current product name and navigation remain unchanged pending implementation.

[Coverage and acceptance gaps](docs/scope/COVERAGE.md) explicitly separate the target from existing implementation. The administration workspace exposes the same assessment at `/admin/scope`. A record or generic screen does not establish completion of a business workflow. No feature is certified production-complete by this assessment.

Run `node tools/scope/verify.mjs` to verify exact preservation of every numbered requirement, the source checksum, lifecycle, product areas and referenced evidence files. Update the coverage record deliberately when implementation or acceptance evidence changes.
