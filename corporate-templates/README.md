# Elvora Shipping LLC Corporate Template Set

## Start here
This pack contains 155 document designs, each supplied as editable DOCX and reusable DOTX, plus 16 e-mails in HTML and plain text, an HTML e-mail signature, the logo asset, and ready-to-print marketing material (company pamphlet, corporate brochure, capability statement and four service flyers, as HTML source and PDF).

Open a DOTX in Microsoft Word to create a new document without overwriting the template. In Google Docs or LibreOffice, use the DOCX copy. Replace all bracketed fields and review the final page layout after entering real data. The blank templates are not completed transactions.

## Company details
Office: Bur Dubai, Dubai, United Arab Emirates
Phone: +971 50 422 1950
Email: sales@elvorashipping.com
Website: [www.elvorashipping.com](https://www.elvorashipping.com)
Hours: Sun-Thu 09:00-18:00 GST; 24/7 for active shipments

Before issue, verify and enter the full registered address, trade licence, VAT TRN if registered, bank beneficiary and IBAN, authorised signatories and approved contract terms. No registration, tax number, banking detail or certification has been invented. In the marketing material, claims are limited to how the company works; add years in operation, memberships and certifications only when you can prove them.

## Folder layout
- `documents/<category>/` – ELV-001 to ELV-155 as `.docx` and `.dotx`
- `emails/` – EM-01 to EM-16 (`.html` and `.txt`), `email-signature.html`, `logo.png`, `INDEX.md`
- `marketing/` – pamphlet, brochure, capability statement and flyers (`.html` editable source, `.pdf` print-ready)
- `assets/` – logo files (primary, reverse, icon)
- `inventory.json` – machine-readable list of all documents

To regenerate everything after editing the content: `npm run docs:build`. The same content, plus the e-mail and marketing pieces, is built into the Elvora Logistics OS **Document Studio** (`npm run docs:studio`), where staff fill, edit, generate text with AI and print the documents without Word.

## Format
Letter portrait 8.5 x 11 inches; 0.95 inch side margins; Arial 10.5 pt body; 22 pt black titles; 11 pt bold black section headings; 1.12 body line spacing; 9 pt tables with repeatable header rows, light grey borders and expandable rows. Colour is concentrated in the approved logo; restrained charcoal tables keep operational forms readable. Headers have no decorative rule. Footer contact details and automatic page number repeat on every page. Marketing pieces use the brand green and red on a dark band and are designed for Letter; resize to A4 before printing in the UAE if your printer requires it.

Body text and descriptions are left aligned. Short quantities, dates and status fields use compact columns. Enter monetary amounts consistently to two decimals and check totals manually; these Word templates do not calculate. Dates should use DD MMM YYYY, times should include GST or the relevant local time zone, and cargo measurements must specify their units.

## Operational and regulatory boundaries
Use the current official carrier, customs, employment and dangerous-goods documents when required. The corresponding preparation worksheets in this pack do not replace them. A company letter is not a carrier release order. The commercial invoice for goods is for the seller to complete and issue. Contracts are editable starting templates with essential fields and schedules to complete and approve before signature. Employment offer and appointment summaries support administration and do not replace official employment contracts.

Tax document fields follow the referenced FTA invoice guidance, but finance must determine registration, place of supply, VAT rate, exchange rate and any applicable electronic invoicing requirements. Do not automatically apply one VAT rate to all freight services. These documents are not connected to an accounting or electronic invoicing platform (the Elvora Logistics OS application in this repository produces its own invoices and e-invoice files).

## Official reference sources
- FTA Tax Invoices clarification VATP006: https://tax.gov.ae/DataFolder/Files/Pdf/06-Tax-Invoices.pdf
- IMO verified gross mass guidance: https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx
- IATA dangerous goods declaration and official form downloads: https://www.iata.org/en/programs/cargo/dangerous-goods/shippers-declaration/
- MOHRE contract documentation guidance: https://taqyeem.mohre.gov.ae/en/media-center/Awareness-and-Guidance/workers-rights.aspx

## Release checklist
1. Correct customer, supplier, employee and company identity.
2. Correct reference, date, scope, cargo and units.
3. Reconciled figures, currency, tax and bank details.
4. All placeholders replaced and unnecessary rows removed.
5. Supporting evidence and attachments checked.
6. Required approvals and signatures obtained.
7. Filled document previewed, exported and archived under its reference.

## Inventory

### 01 Corporate

- ELV-001 — Corporate Letterhead
- ELV-002 — Business Letter
- ELV-003 — Internal Memorandum
- ELV-004 — Meeting Agenda
- ELV-005 — Meeting Minutes
- ELV-006 — Company Resolution
- ELV-007 — Authority Letter
- ELV-008 — Company Profile
- ELV-009 — Management Report
- ELV-010 — Standard Operating Procedure
- ELV-011 — Document Control Register
- ELV-012 — Customer Complaint Response
- ELV-135 — Emergency Contact List
- ELV-136 — Visitor Log
- ELV-137 — Asset Disposal / Write-off Approval

### 02 Sales and Customers

- ELV-013 — Freight Enquiry Form
- ELV-014 — Freight Quotation
- ELV-015 — Logistics Service Proposal
- ELV-016 — Freight Rate Schedule
- ELV-017 — Customer Account Opening Form
- ELV-018 — Customer Credit Application
- ELV-019 — Shipment Booking Confirmation
- ELV-020 — Customer Service Review
- ELV-021 — Confidentiality Agreement
- ELV-022 — Freight Service Agreement
- ELV-122 — Customer Visit / Sales Call Report
- ELV-123 — Customer Onboarding Checklist
- ELV-124 — Tender / RFQ Response Cover Letter
- ELV-143 — Transport (Trucking) Quotation
- ELV-144 — Customer Booking Order Form
- ELV-155 — Sales Target and Pipeline Tracker

### 03 Finance and Procurement

- ELV-023 — Tax Invoice
- ELV-024 — Service Invoice
- ELV-025 — Pro Forma Invoice
- ELV-026 — Commercial Invoice for Goods
- ELV-027 — Tax Credit Note
- ELV-028 — Debit Adjustment Note
- ELV-029 — Payment Receipt
- ELV-030 — Payment Approval Voucher
- ELV-031 — Customer Statement of Account
- ELV-032 — Employee Expense Claim
- ELV-033 — Purchase Order
- ELV-034 — Supplier Account Opening Form
- ELV-035 — Remittance Advice
- ELV-036 — Account Reconciliation
- ELV-125 — Credit Limit Increase Request
- ELV-126 — Petty Cash Voucher
- ELV-127 — Quotation Cover Letter
- ELV-145 — Job Cost Sheet
- ELV-146 — Journal Voucher

### 04 Shipping and Warehouse

- ELV-037 — Carrier Booking Request
- ELV-038 — Shipper Instructions
- ELV-039 — Packing List
- ELV-040 — Cargo Manifest
- ELV-041 — Bill of Lading Draft Data Sheet
- ELV-042 — Air Waybill Instruction Sheet
- ELV-043 — Shipment Pre Alert
- ELV-044 — Shipment Arrival Notice
- ELV-045 — Delivery Order Request
- ELV-046 — Delivery Note
- ELV-047 — Proof of Delivery
- ELV-048 — Cargo Collection Order
- ELV-049 — Verified Gross Mass Submission
- ELV-050 — Container Condition Inspection
- ELV-051 — Container Seal Record
- ELV-052 — Customs Document Checklist
- ELV-053 — Customs Clearance Authority
- ELV-054 — Cargo Insurance Instruction
- ELV-055 — Dangerous Goods Intake Worksheet
- ELV-056 — Temperature Controlled Cargo Instructions
- ELV-057 — Warehouse Goods Receipt
- ELV-058 — Warehouse Dispatch Note
- ELV-059 — Warehouse Stock Count
- ELV-060 — Cargo Claim Notice
- ELV-061 — Cargo Damage Incident Report
- ELV-062 — Shipment Delay Advisory
- ELV-138 — Forwarder’s Cargo Receipt
- ELV-139 — Equipment Interchange Receipt (Container)
- ELV-140 — Gate Pass Request
- ELV-141 — Delivery Instruction
- ELV-142 — Empty Container Release Request
- ELV-153 — Vehicle Pre-trip Inspection Checklist

### 05 HR and Administration

- ELV-063 — Employment Offer Summary
- ELV-064 — Employee Appointment Memorandum
- ELV-065 — Job Description
- ELV-066 — Employee Joining Checklist
- ELV-067 — Leave Request
- ELV-068 — Employee Timesheet
- ELV-069 — Salary Certificate
- ELV-070 — Employment Experience Certificate
- ELV-071 — Employee Performance Notice
- ELV-072 — Employee Exit Clearance
- ELV-073 — Company Asset Handover
- ELV-074 — Business Travel Request
- ELV-128 — No Objection Certificate (NOC) Letter
- ELV-129 — Disciplinary Warning Letter
- ELV-130 — Resignation Acceptance Letter
- ELV-131 — Salary Transfer / Bank Letter
- ELV-132 — End of Service Settlement Statement
- ELV-133 — Overtime Request and Approval
- ELV-134 — Training Attendance Record
- ELV-150 — Employee Performance Appraisal Form
- ELV-151 — Employee Handbook (Outline)
- ELV-152 — Driver Daily Trip Log

### 06 Control and Guidance

- ELV-075 — Operational Risk Register
- ELV-076 — Corrective Action Record
- ELV-077 — Supplier Performance Review
- ELV-078 — Information Security Incident Record
- ELV-079 — Weekly Operations Dashboard
- ELV-080 — Monthly Business Review
- ELV-081 — Shipment Register
- ELV-082 — Template Use and Company Setup Guide
- ELV-115 — Anti-Bribery and Ethics Policy
- ELV-116 — Data Protection and Privacy Policy
- ELV-117 — Health, Safety and Environment Policy
- ELV-118 — Quality Policy
- ELV-119 — Business Continuity Plan (Summary)
- ELV-120 — Incident Report (Health and Safety)
- ELV-121 — Customer Feedback Form
- ELV-154 — Annual Budget Sheet

### 07 Legal and Contracts

- ELV-083 — Standard Trading Conditions
- ELV-084 — Power of Attorney (Shipping and Customs)
- ELV-085 — Letter of Indemnity (Cargo Release)
- ELV-086 — Agency Appointment Letter
- ELV-087 — Service Level Agreement (Customer)
- ELV-088 — Sub-contractor / Vendor Agreement

### 08 Letters and Notices

- ELV-089 — Letter of Introduction
- ELV-090 — Payment Reminder Letter – First
- ELV-091 — Payment Reminder Letter – Second
- ELV-092 — Final Demand Letter
- ELV-093 — Apology Letter (Service Failure)
- ELV-094 — Notice of Rate or Surcharge Change
- ELV-095 — Notice of Change of Address or Bank Details
- ELV-096 — Holiday and Office Closure Notice
- ELV-097 — Thank-you Letter to Customer
- ELV-098 — Business Reference Letter
- ELV-099 — Bank Letter (Account Opening or Facility Request)
- ELV-100 — Invitation Letter (Visit or Meeting)

### 09 Customs and Compliance

- ELV-101 — Bill of Lading Amendment Request
- ELV-102 — Telex / Express Release Request
- ELV-103 — Demurrage / Detention Dispute Letter
- ELV-104 — Free Time Extension Request
- ELV-105 — Cargo Release Authorisation Letter
- ELV-106 — Import Clearance Instructions
- ELV-107 — Export Clearance Instructions
- ELV-108 — Customs Duty Exemption / Refund Request
- ELV-109 — Certificate of Origin Application Checklist
- ELV-110 — Know Your Customer (KYC) Declaration
- ELV-111 — Sanctions and Export Control Declaration
- ELV-112 — Cargo Survey / Inspection Request
- ELV-113 — Short-Shipment / Shut-out Notice
- ELV-114 — Seal Discrepancy Report
- ELV-147 — Cargo Insurance Claim Letter
- ELV-148 — Fumigation / ISPM-15 Certificate Request
- ELV-149 — Customs Release Follow-up Letter

### 07 Marketing and e-mail

- EM-01 to EM-16 — customer, supplier and accounts e-mails (see emails/INDEX.md)
- Company pamphlet, corporate brochure, capability statement
- Flyers: ocean freight, air freight, customs clearance, warehousing and distribution
