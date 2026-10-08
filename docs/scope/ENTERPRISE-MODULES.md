# Enterprise implementation checkpoint

This checkpoint adds executable workflows to eight previously missing areas. Each area remains **Partial** until its remaining requirements and operational acceptance pass. It does not certify the complete 147-area ERP. The canonical specification is unchanged.

## Carrier RFQs

Sales → Carrier RFQs supports multiple invited vendors, cargo/route requirements and a response deadline. Issue RFQ freezes the request and queues provider email through the existing mail outbox. A queued email is not proof of delivery. Compare responses opens the rate-entry and comparison screen. Responses are immutable revisions with freight/local charges, currency/exchange rate, AED comparison total, transit/free days, validity, exclusions and source reference. The latest response per provider is compared; earlier responses remain visible.

An independent sales approver awards a current, unexpired response with a justification. The RFQ maker and response recorder cannot approve their own award. A second award, responses on closed requests and uninvited providers are rejected. Live provider self-service, delivery acceptance and award-to-booking execution are still outstanding.

## Knowledge and competency

Work → Knowledge Base contains SOPs, policies, manuals, customer SOPs, carrier instructions, customs guides and training content. An independent reviewer publishes a draft. Each version retains its content, author/reviewer, timestamp and SHA-256. Published text is locked; Start new revision retains prior versions and opens a reviewed amendment. Staff acknowledge individual published revisions. This does not yet distribute mandatory reading or enforce every customer/lane SOP in operations.

People & Support → Competency Matrix displays active staff and current verified skill levels across Ocean, Air, Customs, DG, Warehouse and Finance. Staff Qualifications records assessment evidence, levels and expiry. An independent assessor verifies or revokes qualifications; verified history is immutable. Qualification Rules optionally require a competency/level for a work activity and department. Assignment and starting/resuming work reject missing, expired or revoked qualifications. Automatic source queues leave an ineligible owner unassigned; manager recommendations exclude ineligible staff. Training curricula and all other operational assignment surfaces are not covered by these work-activity rules.

## BL/AWB and physical custody

Work → BL / AWB Engine records MBL/HBL/MAWB/HAWB data with an internal controlled number, carrier master number, original/copy counts and release mode. Independent approval retains an immutable content snapshot/hash and registers numbered originals for that revision. Published freight documents cannot be edited directly. Amendments require outstanding originals to return before a new draft is opened. Released documents cannot be amended through this initial workflow.

The master AWB validation uses the first seven serial digits and an unweighted modulo-7 check digit. Reference: [IATA Air Waybill number validation](https://dgautocheck.iata.org/help/AirWaybillnumbervalidation.html) and [Cargo Agent's Handbook, Resolution 600a](https://www.iata.org/contentassets/e9cb5a72b88f4f68a5cfc572a50b60c9/cah807-en-final.pdf). Number validation does not establish an airline allocation or authorised issuance.

Print produces an internal worksheet copy with draft/copy labelling. It is not a negotiable carrier original. Authorised carrier forms, electronic signatures, airline allocations and partner issuance/transmission remain outstanding.

Original Custody records office, employee, customer, bank and courier holders. Transfers capture named holders, internal recipients, tracking and evidence. The current holder remains recorded until acknowledgement. Only the named internal recipient acknowledges an internal receipt; an independent authorised reviewer records an external receipt. Duplicate and pending-transfer conflicts are rejected. Custody history and release dates remain retained. Closed/cancelled jobs require reopening before document/custody changes.

Release authorisation requires independent document authority, current approved content, customs clearance or independently verified non-applicability, invoiced/settled revenue and acknowledged custody. Telex/surrender requires returned originals; original release requires receipt by the custodian of every original. Authorisation records a controlled decision; it does not send carrier release instructions. Courier integration and company-specific authority/credit policies remain outstanding. Job closure evidence fingerprints now include freight documents and custody events; draft freight documents and pending original handovers block closure.

## Container deposits

Accounts → Container Deposits records a job container, vendor/agent, authorised AED amount, refund due and deposit asset account. Manage deposit transactions requests payments, refunds or damage deductions with bank/assessment evidence. A second finance approver posts the transaction and balanced bank/asset/expense journal together. Refund and damage requests cannot exceed the remaining recoverable balance; pending requests are revalidated at approval to prevent overpayment.

Counters reflect posted events only. Controlled reversals reverse the journal and recompute the deposit balance in the same transaction. Payments cannot be reversed until dependent refunds/damage are reversed. Direct generic journal reversal is blocked for deposit journals so it cannot silently corrupt the deposit balance. Period locks still apply. The implementation is AED-only; multicurrency, bank/carrier reconciliation and tax treatment policies remain outstanding. Financial recovery can continue after operational job closure.

## OCR and document matching

Open an attachment from Documents Library and choose Extract text and match job. OCR & Matching retains extraction history and review screens. Supported inputs are embedded/scanned PDFs, PNG/JPEG/TIFF/WebP and UTF-8 text. English Tesseract image extraction retains mean word confidence. Embedded PDF/text extraction does not invent an OCR confidence score.

Install these runtime executables on the deployment host:

```sh
apt-get update
apt-get install -y tesseract-ocr tesseract-ocr-eng poppler-utils
```

Each process invocation uses an argument array, a 30-second timeout and bounded output. Files are limited to 20 MB, embedded PDFs to the first 20 pages, and scanned PDFs to the first 10 pages at a bounded image scale. Stored review text is limited to 20,000 characters. Temporary extraction files are removed. Missing binaries/invalid files become visible Failed extractions; interrupted Running records become Failed after 15 minutes and require a fresh extraction. This initial workflow does not queue/resume partial pages.

Exact job/master/house references produce candidates; multiple candidates remain ambiguous. Nothing is automatically attached. A reviewer checks the original and chooses a permitted open job or records review without an association. SHA-256 revalidation rejects a changed source, duplicate reviews are rejected, and an existing association to another record cannot be overwritten. Extraction list/detail access follows the source record's module permission. Structured amounts/party/cargo ingestion, multilingual/custom layouts, fuzzy matching and controlled reassociation remain outstanding.

## Validation

```sh
npm run typecheck
npm run build
node tests/run-enterprise-modules.mjs
node tools/scope/verify.mjs
```

The new runner uses fresh domain fixtures and independent API servers so repeated test logins do not require weakening production rate limits. Its suite covers the 138 core smoke checks, existing approval/closure/workflow/work API acceptance, and the new RFQ, knowledge, qualification, cargo-document/custody, deposit and upload/extraction/matching controls. Real PDF extraction and real Tesseract image extraction use local test documents; no live company files or external providers are required. PostgreSQL bridge deployment and partner/provider acceptance still need their own validation.
