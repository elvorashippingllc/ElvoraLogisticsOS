# OS review — 11 October 2026

This review combined code inspection of document generation, settings, dashboard access and financial statements with the repository's cross-module acceptance runner and browser checks.

## Changes and confirmed defects fixed

| Area | Result |
| --- | --- |
| Documents | Recipient appears before the title. Every print layout includes a system-generated notice independently of custom footer text. Invoices explicitly require no signature; customer/delivery acknowledgements and carrier-original controls are retained. |
| Company seal | Original PNG/JPEG upload, administrator-controlled default, and per-document choice for print, downloaded PDF and emailed PDF. No company seal is fabricated; upload the original stamp in Company settings → Document text. |
| PDF readiness | Server export waits for record/related data, fonts and decoded images. Failed records cannot become printable error sheets. Each document in a multi-job print has its own letterhead. |
| Letterhead/VAT | Metadata now includes VAT-registration status, Arabic company name, information email, trade licence and licensing authority used by print layouts. |
| Settings | Stable field components preserve focus/caret during typing. SMTP testing stops when saving fails and reports connection errors. Image upload is validated; audit entries describe image changes without duplicating base64 image payloads. |
| Printing permissions | A limited party lookup returns only recipient details linked to a readable invoice, quotation or job. Finance/operations/portal users no longer need unrelated CRM permission to render those documents. |
| Statements | Customer portal users cannot read/export other companies' statements. Dates are validated; reversed ranges are rejected. Requested print/PDF dates are preserved, and deleted parties are excluded. |
| Dashboard | Neutral backgrounds, fewer duplicate figures, all alerts accessible, and expandable workflow/AI/report details. Financial results require finance view access. Job shortcuts match the displayed counts; report alerts require report permission. |
| Mobile/accessibility | Print preview scrolls within its container at A4 width. Dashboard tables retain readable references and contained scrolling. Error messages have alert semantics; tested light/dark contrast and keyboard controls are retained. Frontend AI permissions agree with server restrictions. |

## Verification

- TypeScript type checking and web/API builds passed.
- All 23 default SQLite acceptance suites passed. The smoke suite passed 147 checks, integrations 84, handover 51 and compliance 65. The entity sweep completed 822 requests with zero server errors. Other suites cover authentication, email, calendars, approvals, work queues/handovers, durable workflow restart, RFQ/knowledge/competency, AI controls, vendor services, cargo custody, deposits and real PDF/image OCR.
- The dashboard browser suite passed desktop/mobile/dark contrast, layout, navigation, carousel controls, sidebar keyboard/motion behavior, email drafts and vendor-service forms.
- The calendar browser suite passed persisted scheduling, four views, filters, mobile access and contrast/layout.
- `npm run test:documents` passed 30 checks, including original raster upload, recipient ordering, notices, seal overrides, mobile containment, delayed loading, metadata, date ranges, error handling and inspection of actual PDF text and embedded seal images. It is also included in the browser CI step.

The checks use isolated fresh data and fictional demo workspaces. Live email delivery, WhatsApp, payment/provider services and PostgreSQL were not exercised in this review. These results cover the existing automated workflows and inspected areas; they do not establish that every possible workflow is free of defects. Changes are in the checkout and have not been deployed.
