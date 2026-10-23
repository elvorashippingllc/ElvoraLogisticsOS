# Production Readiness and Implementation Plan

This checklist is a release gate, not a claim that every item is already implemented or passed. Record evidence for each item in the release ticket. Never store credentials, tokens, customer data, or private logs in this document.

## 1. P0 — Security release gate

- [ ] Remove reusable credentials from all public documentation, examples, screenshots, CI logs, and deployment notes.
- [ ] Rotate any credential that was ever committed or published; removing it from the latest README does not remove it from Git history.
- [ ] Confirm production bootstrap requires unique administrator credentials and forces password change where intended.
- [ ] Confirm `APP_SECRET` and all session/signing keys are strong, unique per environment, persisted securely, and not committed.
- [ ] Confirm integration secrets are never returned by API responses, logs, exports, or error messages.
- [ ] Verify session cookies are HTTP-only, Secure in HTTPS production, and have appropriate SameSite settings.
- [ ] Verify CSRF checks for every state-changing cookie-authenticated route.
- [ ] Verify login throttling, lockout behavior, password reset, TOTP recovery, API-key revocation, and session invalidation.
- [ ] Test authorization for every module action (view/create/edit/delete/approve/export), including direct API calls and object IDs supplied by another customer.
- [ ] Test customer-portal isolation from internal records, other customers, attachments, exports, and search results.
- [ ] Verify upload type/size limits, path traversal defenses, malware scanning strategy, and private-file authorization.
- [ ] Confirm demo workspace is disabled in production by default and cannot send real outbound messages.
- [ ] Review dependencies and container image for known vulnerabilities; record exceptions and remediation owners.

## 2. P0 — Backup and disaster recovery

- [ ] Identify all durable state: primary database, uploaded documents, object-storage objects, generated files, encryption keys, and integration configuration.
- [ ] Run a full backup from the deployed environment and confirm it completes with a verifiable checksum.
- [ ] Restore the backup into a clean, isolated environment.
- [ ] Verify database integrity, file availability, permissions, and references between database rows and stored objects.
- [ ] Verify retention, off-site storage, encryption, and access controls.
- [ ] Document recovery time objective (RTO), recovery point objective (RPO), and named recovery owner.
- [ ] Test recovery after accidental deletion and after a simulated server loss.
- [ ] Alert on missed backups, failed uploads, low disk space, and failed restore verification.

## 3. P0 — Release and rollback

- [ ] Build from a clean checkout using the lockfile and supported Node version.
- [ ] Run `npm ci`, `npm run typecheck`, `npm run build`, and `npm run test:all`.
- [ ] Record commit SHA, image digest, test outputs, database mode, and deployment timestamp.
- [ ] Deploy to staging first and run smoke tests against a fresh database.
- [ ] Verify health/readiness endpoints and that they do not leak secrets or internal configuration.
- [ ] Verify graceful shutdown, restart behavior, persistent storage mounts, log rotation, and disk limits.
- [ ] Test rollback to the previous image and ensure database changes remain compatible.
- [ ] Never run data-reset utilities against production without explicit, separately reviewed authorization.

## 4. P1 — End-to-end logistics workflow acceptance

Use synthetic records and document the expected result at every step.

- [ ] Lead/enquiry → quotation → margin approval → booking → job creation.
- [ ] Job → milestones → carrier event → document custody → delivery confirmation.
- [ ] Job charges → supplier bill → customer invoice → ledger postings → receipt → reconciliation.
- [ ] Validate duplicate-submit/idempotency behavior for invoices, receipts, provider webhooks, and automated jobs.
- [ ] Confirm a failed step is visible, retryable, and does not silently mark the workflow complete.
- [ ] Confirm job profitability reconciles to the underlying posted ledger entries.
- [ ] Test timezone, currency rounding, partial payments, credit notes, reversals, and period locks.

## 5. P1 — Integration acceptance (real providers)

Mock tests validate application behavior only; they do not prove live provider acceptance.

For each enabled provider, record owner, environment, credential expiry/rotation plan, last successful test, failure alert, retry behavior, and support contact.

- [ ] Email: sender-domain authentication, delivery, bounce/complaint handling, retry and queue visibility.
- [ ] WhatsApp: webhook signature verification, approved templates, opt-in, delivery statuses and rate limits.
- [ ] Object storage: upload/download authorization, retention, outage retry and restore test.
- [ ] Tracking: event signature/authentication, duplicate events, out-of-order events and carrier mapping.
- [ ] E-invoicing: provider sandbox validation, accepted/rejected responses, idempotency and audit trail.
- [ ] Customs/EDI: authorized access, partner schema, acknowledgements, retry/dead-letter handling and reconciliation.
- [ ] Bank/WPS: provider or bank validation, rejected-file handling, reconciliation and explicit approval controls.
- [ ] AI: provider outage, quota exhaustion, tool permission enforcement, action approval, cost budget and traceability.

Do not describe an integration as live, certified, or government-connected until the real end-to-end test has succeeded and evidence is retained.

## 6. P1 — UAE legal and operational review

- [ ] Have a qualified UAE adviser verify licensed activities against actual marketed and performed services.
- [ ] Confirm website company particulars, address, privacy notice, terms, consent language, and data-retention disclosures.
- [ ] Verify VAT registration/TRN rules, tax invoice and credit-note fields, tax codes, and evidence for zero-rated transactions.
- [ ] Verify current e-invoicing obligations and provider requirements with the relevant authority/adviser.
- [ ] Verify WPS and payroll outputs with the applicable bank and authority requirements.
- [ ] Validate sanctions-screening provider, list update frequency, match handling, false-positive review, and audit evidence.
- [ ] Document data retention, customer access requests, deletion/retention conflicts, and incident response.

## 7. P2 — Performance, scale and observability

- [ ] Benchmark common list/search pages, shipment updates, reporting, and financial posting under expected concurrent users.
- [ ] Measure database latency, event-loop delay, memory, CPU, connection saturation, and slow queries.
- [ ] Test large imports/exports, attachments, report generation, and simultaneous edits.
- [ ] Test process restart while jobs are queued and verify durable retry behavior.
- [ ] Define service-level objectives and alert thresholds for availability, latency, job failures, and integration failures.
- [ ] If PostgreSQL is used, test connection lifecycle, transaction boundaries, concurrent writes, and recovery.
- [ ] Evaluate an asynchronous PostgreSQL access path before scaling workloads that are sensitive to the current synchronous bridge.

## 8. Release evidence template

For every checklist item, capture:

| Field | Value |
|---|---|
| Status | Not started / In progress / Passed / Blocked / Not applicable |
| Evidence | Test run, sanitized screenshot, report, or ticket URL |
| Environment and commit | Staging/production and exact commit SHA |
| Owner | Named responsible person |
| Date | Date verified |
| Follow-up | Defect, mitigation, due date |

## 9. Suggested implementation sequence

1. Security and secret hygiene.
2. Backup restore and rollback proof.
3. Clean build, typecheck, and complete automated test run.
4. End-to-end shipment-to-cash acceptance.
5. Live integration acceptance, one provider at a time.
6. UAE legal/compliance review.
7. Performance and observability improvements.
8. Advanced predictive analytics and AI autonomy only after the above gates pass.
