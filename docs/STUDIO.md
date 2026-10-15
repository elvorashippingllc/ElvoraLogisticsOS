# Document Studio, starter data and data reset

## Document Studio (`/studio`)
A library of ready-made company documents (company profile, brochure, quotations, contracts, policies, HR letters, forms and more; 185 templates). Open one, edit the text, paste your own, or use **AI draft** (needs the AI provider configured under Admin), then **Print / PDF**. Placeholders in `[square brackets]` are highlighted; `{{company.name}}`-style tokens are filled from Admin → Company settings. Saved copies live in Studio → My documents.
- Output is sanitised on the server and in the browser; only safe formatting survives.
- PDF uses the company letterhead, page numbers and footer.
- Word versions of the templates are in `corporate-templates/` (regenerate with `npm run docs:studio`).

## Invoice without a job (`/finance/new-invoice`)
Create a tax invoice, proforma or credit note directly: choose the customer, add lines (per-line foreign currency and rate of exchange, billed in AED), optional round-to-whole-amount with a rounding account, own invoice number or the shared series, shipment details printed on the invoice. Numbering rules: Admin → Invoice numbering.

## Starter data
On an empty production workspace the first start loads Elvora's own clients, vendors and the four supplied invoices (ES101, ES101A, ES102, ES102A). `STARTER_DATA=false` skips it. The company TRN, licence and bank details are **not** invented; enter them in Admin → Company settings (invoices cannot be posted for VAT until the TRN exists).

## Clearing data
Customers, leads, jobs, invoices and every record tied to them can be removed:
1. Admin → Backup & data → "Delete all business data" (type `DELETE ALL BUSINESS DATA`), or
2. `npm run data:reset`, or
3. `RESET_BUSINESS_DATA_ON_START=DELETE ALL BUSINESS DATA` for one start, then remove the line.
A backup is written first. After a deliberate reset starter data is not re-added.
Users, roles, chart of accounts, settings and the template library are kept.

## Access control
Customer-portal users are default-denied on company-wide endpoints (`need()` requires `portal: true` per route plus a path allowlist); reference pickers list names only to roles that can view the entity or edit records that refer to it. Covered by `tests/access-control.ts`.

## Company particulars and deletion (15 October 2026)

Company Settings supplies the bilingual letterhead, registered address and company registration identifiers used in print views and Document Studio. New templates CO-FACTS, CO-LETTER and CO-REG provide bilingual particulars, a blank letter and an internal evidence register. The English building name is a working transliteration of the Arabic licence address; retain the Arabic original for exact identification.

The one-time company-document upgrade fills missing fields and replaces only the previously shipped generic address/name. Later administrator changes are retained. It does not change an existing VAT TRN or assume corporate tax approval. Application reference 101002831255 is stored separately from issued tax registration numbers. The supplied residential DEWA invoice is not accepted as an Ejari certificate. Source PDFs and personal account details are not bundled with the application. Existing saved documents keep their original content; review or recreate historical documents when details change.

Delete is visible on record lists, record detail pages and the dedicated job screen when the user has delete permission. Deletion uses the existing audited soft-delete endpoint. Linked records block deletion with a list of dependencies; closed jobs and protected financial records retain their existing cancel/void workflows. No cascade deletion of accounting records is introduced.

Validation: `npm run typecheck`, `npm run build`, `TEST_SUITES='company-documents compliance studio smoke' bash tests/run-all.sh`. PDF rendering requires Chromium on the host.
