Yes. I would now **recreate the specification from zero rather than continue adding patches to the earlier list**.

The target should be a single coherent system capable of replacing the relevant functionality of **Fresa + Odoo + Zoho** for a UAE freight forwarder with **1–80+ staff**, while adding better workflow automation, WhatsApp operations, management control, portals and AI.

I would treat the following as the **canonical master scope**.

> **Important:** “100% complete” here means a complete product/architecture baseline. Production go-live still requires Vega/Elvora-specific SOPs, chart of accounts, authority matrices, contracts, customs credentials, bank/payment setup and regulatory validation.

# ELVORA / VEGA-CLASS LOGISTICS OS

## 1. Corporate Administration

Support the complete organisation hierarchy:

```text
Group
└── Legal Entity
    └── Branch
        └── Department
            └── Team
                └── Employee
```

Including:

- multi-company
- multi-branch
- multiple departments
- cost centres
- profit centres
- business units
- currencies
- languages
- time zones
- financial years
- numbering sequences
- custom fields
- custom statuses
- document templates
- company branding
- tax registrations
- UAE TRN
- trade licence records
- customs registrations
- bank accounts
- branches
- warehouses

---

# 2. Enterprise Identity & Security

### Authentication

- username/password
- MFA
- Microsoft SSO
- Google SSO
- passkeys
- session/device management
- password policies
- login history
- account lockout

### Authorization

- role permissions
- department permissions
- branch permissions
- record-level permissions
- field-level permissions
- action permissions
- temporary permissions
- delegation
- substitute user

### Security

- maker/checker
- segregation of duties
- privileged-user monitoring
- API permissions
- IP policies
- session timeout
- download/export restrictions
- security events
- audit history

---

# 3. Enterprise User Roles

Examples:

### Management

- Owner
- CEO
- General Manager
- Branch Manager
- Department Head

### Commercial

- Sales Manager
- Sales Executive
- Key Account Manager
- Pricing Manager
- Pricing Executive

### Operations

- Ocean Import
- Ocean Export
- FCL
- LCL
- Air Import
- Air Export
- Road Freight
- Cross Trade
- Project Cargo
- Documentation
- Customer Service

### Customs

- Customs Manager
- Clearance Executive

### Warehouse

- Warehouse Manager
- Supervisor
- Operator

### Transport

- Transport Manager
- Dispatcher
- Driver

### Finance

- CFO
- Finance Manager
- Accountant
- AR
- AP
- Credit Controller
- Treasury

### Corporate

- HR
- Payroll
- Admin
- Compliance
- Quality
- Internal Audit
- IT

---

# 4. Owner / CEO Command Center

This should be the most powerful screen in the system.

## Today

- revenue
- gross profit
- cash position
- expected receipts
- payments due
- bookings
- jobs created
- jobs completed
- deliveries
- arrivals
- customs pending
- quotes pending
- approvals
- exceptions

## Financial health

- AR
- AP
- DSO
- overdue percentage
- cash forecast
- bank balances
- GP%
- operating expenses
- P&L
- working capital

## Operational health

- shipments delayed
- customs holds
- documents missing
- BL pending
- POD pending
- containers approaching free-time expiry
- SLA failures

## Commercial health

- leads
- quotations
- conversion
- lost business
- dormant customers
- pipeline
- customer profitability

---

# 5. Executive Exception Center

Management should not need to search reports.

Show only what needs action.

Examples:

> 7 shipments require intervention.

> 4 containers may incur detention.

> AED 420,000 overdue.

> 3 supplier invoices exceed expected costs.

> 12 quotations worth AED 310K have no follow-up.

> 2 key customers show declining shipment volume.

---

# 6. CRM

Complete customer lifecycle.

### Leads

- website
- email
- WhatsApp
- phone
- referral
- campaigns
- manual entry
- API

### Pipeline

```text
New
Qualified
Rate Requested
Pricing
Quote Sent
Negotiation
Won
Lost
Dormant
```

### CRM functionality

- lead scoring
- lead assignment
- round-robin
- territories
- activities
- calls
- meetings
- tasks
- reminders
- follow-ups
- notes
- tags
- attachments
- duplicate detection
- lost reasons
- source attribution
- sales forecasting

---

# 7. Customer 360°

One customer record contains:

- company
- branches
- contacts
- TRN
- licence
- credit limit
- payment terms
- contracts
- SOP
- rates
- quotations
- bookings
- shipments
- BL/AWB
- documents
- invoices
- statements
- payments
- emails
- WhatsApp
- complaints
- claims
- support tickets

No disconnected customer records.

---

# 8. Customer Onboarding

Workflow:

```text
Lead
→ Company Verification
→ KYC
→ Trade Licence
→ TRN
→ Credit Application
→ Credit Approval
→ Contract
→ SOP Approval
→ Pricing
→ Portal Activation
→ Active Customer
```

---

# 9. KYC / Compliance

Support:

- trade licence
- owner/UBO information
- business activity
- TRN
- sanctions checks
- restricted-party checks
- country-risk flags
- compliance review
- approvals
- expiry/review schedule

---

# 10. Key Account Management

For important customers:

- account hierarchy
- global contacts
- contracts
- SOP
- SLA
- shipment statistics
- revenue
- GP
- DSO
- outstanding
- complaints
- quote conversion
- lane distribution
- performance dashboard

---

# 11. Pricing Department

Dedicated pricing workspace.

```text
RFQ
→ Rate Procurement
→ Carrier Comparison
→ Cost Sheet
→ Markup
→ Approval
→ Sales Quote
```

---

# 12. Tariff Management

Buying and selling tariffs by:

- customer
- carrier
- agent
- origin
- destination
- port
- airport
- service
- container
- weight band
- commodity
- validity
- currency

Support:

- contract rates
- spot rates
- named-account rates
- surcharges
- seasonal charges
- customer tariffs
- markup formulas
- minimum margin

---

# 13. Carrier RFQ

Request rates from multiple providers.

Compare:

| Provider | Freight | Local Charges | Transit | Free Days | Total |
|---|---:|---:|---:|---:|---:|

Store historical responses.

---

# 14. Rate Intelligence

Show:

- previous buying rate
- previous selling rate
- average lane cost
- GP history
- rate trend
- last vendor
- last customer quote
- winning rates

---

# 15. Quotations

Support:

- ocean
- air
- road
- customs
- warehouse
- multimodal

Features:

- cost sheet
- selling charges
- margin
- GP
- versions
- validity
- transit time
- terms
- exclusions
- optional charges
- approval
- e-sign acceptance
- customer portal acceptance

---

# 16. Margin Controls

Examples:

```text
GP < 15%
→ Sales Manager

GP < 10%
→ Branch Manager

GP < 5%
→ CEO
```

Configurable.

---

# 17. Booking Management

Statuses:

```text
Draft
Requested
Submitted
Confirmed
Amended
Rolled
Cancelled
Converted
```

Support:

- carrier booking
- allocation
- equipment request
- booking confirmation
- amendment
- rollover
- cancellation

---

# 18. Master Job / House Job

Critical Fresa-style architecture.

```text
Master Job
├── House Job
├── House Job
├── House Job
└── House Job
```

Ocean:

```text
MBL
├── HBL
├── HBL
└── HBL
```

Air:

```text
MAWB
├── HAWB
├── HAWB
└── HAWB
```

---

# 19. Freight Departments

Native workflows for:

- FCL Export
- FCL Import
- LCL Export
- LCL Import
- Air Export
- Air Import
- Road Export
- Road Import
- Cross Trade
- Customs
- Project Cargo
- Warehousing
- Transportation

---

# 20. Shipment / Job Record

Single operational truth.

### Commercial

- customer
- quotation
- sales owner
- pricing owner

### Operational

- department
- mode
- job number
- master job
- booking
- carrier
- route

### Cargo

- packages
- commodity
- weights
- volume
- dimensions
- HS code
- DG

### Finance

- selling
- costs
- invoices
- supplier bills
- GP

### Documents

Everything belonging to the job.

---

# 21. Separate Status Models

### Job Status

- Draft
- Open
- On Hold
- Completed
- Closed
- Cancelled

### Operational Status

- Booking
- Cargo Pending
- Cargo Received
- Ready
- Loaded
- Departed
- In Transit
- Arrived
- Clearance
- Delivery
- Delivered

### BL Status

- Pending
- Draft
- Approval
- Approved
- Issued
- Surrendered
- Telex
- Released

---

# 22. Routing Engine

Support multiple legs.

```text
Place of Receipt
→ Pre-carriage
→ POL
→ Vessel 1
→ Transshipment
→ Vessel 2
→ POD
→ On-carriage
→ Place of Delivery
```

Each leg:

- mode
- vendor
- vessel/flight
- voyage
- ETD
- ATD
- ETA
- ATA
- status

---

# 23. Ocean Freight

Everything for:

- FCL
- LCL
- consolidation
- NVOCC
- import/export
- transshipment
- cross trade
- RoRo
- breakbulk

---

# 24. Air Freight

Support:

- direct
- consolidation
- import/export
- door-door
- airport-airport

Including:

- MAWB
- HAWB
- airline
- flight
- actual weight
- volumetric
- chargeable weight
- routing

---

# 25. Road Freight

Support:

- FTL
- LTL
- UAE
- GCC
- cross-border
- multimodal

With:

- truck
- driver
- trailer
- border
- permits
- tolls
- waiting
- POD

---

# 26. NVOCC / Consolidation

Include:

- master consolidation
- houses
- stuffing
- allocation
- CBM utilization
- weight utilization
- deconsolidation
- manifest
- profitability allocation

---

# 27. Containers

Full container lifecycle:

```text
Requested
Released
Picked Up
Stuffed
Gate-In
Loaded
Departed
Arrived
Discharged
Gate-Out
Delivered
Empty Returned
Closed
```

Store:

- container
- type
- seal
- free days
- depot
- terminal

---

# 28. Detention / Demurrage

Calculate:

- discharge date
- free days
- last free day
- daily tariff
- estimated exposure

Alerts:

- 5 days
- 3 days
- 1 day
- expired

---

# 29. Container Deposit

Track:

- amount
- paid
- refund due
- refund received
- damage deduction
- balance

---

# 30. BL / AWB Engine

Generate:

- MBL information
- HBL
- MAWB
- HAWB

Support:

- revision
- approval
- amendment
- original count
- copies
- surrender
- telex
- sea waybill

---

# 31. Original Document Custody

Track each original:

- original number
- office
- employee
- customer
- bank
- courier
- tracking
- release date

---

# 32. Documentation Department

Queues for:

- shipping instruction
- BL draft
- BL approval
- manifest
- pre-alert
- arrival notice
- COO
- DO
- VGM
- customs documents

---

# 33. Manifest Management

Support:

- master manifest
- house manifest
- consol manifest
- export manifest
- import manifest
- amendments
- EDI

---

# 34. Customs

Complete UAE customs workspace:

- BOE
- declaration
- declaration type
- customs code
- importer
- exporter
- HS codes
- CIF
- duty
- VAT
- deposits
- permits
- inspection
- clearance
- release

---

# 35. Customs Integration Layer

Provider adapters for:

- Dubai Customs
- Mirsal-compatible flows
- customs brokers
- other emirate systems

Track:

- submission
- response
- rejection
- correction
- resubmission

---

# 36. MPCI / Future Compliance Requirements

Create compliance-rule engine rather than hard-code one scheme.

```text
Shipment
→ Rule Evaluation
→ Required Filing
→ Validation
→ Submission
→ Confirmation
```

This allows UAE regulatory requirements to change without rebuilding the system.

---

# 37. Dangerous Goods

Include:

- UN number
- class
- packing group
- proper shipping name
- SDS
- DG declaration
- acceptance
- trained employee
- carrier approval

---

# 38. Reefer / Cold Chain

Track:

- set temperature
- actual temperature
- tolerance
- ventilation
- humidity
- alerts
- logger
- excursion incidents

---

# 39. Project Cargo

For oversized/special cargo:

- equipment
- dimensions
- heavy lift
- permits
- route survey
- crane
- escort
- engineering
- milestones

---

# 40. Insurance

- insured value
- insurer
- certificate
- premium
- claim
- recovery

---

# 41. Claims

```text
Incident
→ Claim
→ Evidence
→ Reserve
→ Carrier/Insurance
→ Settlement
→ Recovery
→ Close
```

---

# 42. Transport Management

Complete TMS:

- transport orders
- planning
- dispatch
- vehicles
- drivers
- subcontractors
- pickup
- delivery
- route
- POD

---

# 43. Dispatch Board

Visual scheduler:

```text
Truck
Driver
Pickup
Time
Delivery
Capacity
Status
```

---

# 44. Driver Application

Driver sees:

- assigned jobs
- route
- contacts
- pickup
- delivery
- signature
- photos
- POD
- incidents

---

# 45. Fleet

- vehicles
- registration
- insurance
- maintenance
- tyres
- fuel
- Salik
- fines
- GPS
- documents

---

# 46. Warehouse Management

Full WMS:

- warehouses
- zones
- aisles
- racks
- bins
- receipts
- putaway
- reservations
- picking
- packing
- dispatch
- cross-dock

---

# 47. Advanced Warehouse

- pallets
- packages
- batches
- serial numbers
- expiry
- FIFO
- FEFO
- LIFO
- quarantine
- damaged stock
- cycle counting
- replenishment

---

# 48. Barcode / QR

Mobile scan for:

- receiving
- putaway
- picking
- packing
- transfer
- dispatch
- inventory count

---

# 49. Warehouse Billing

Automatic charges for:

- receiving
- handling
- storage
- pallet/day
- CBM/day
- loading
- unloading
- repacking
- labelling
- forklift

---

# 50. Vendor / Carrier / Agent Management

Master profiles:

- carriers
- airlines
- NVOCC
- agents
- trucking
- warehouse
- customs broker
- couriers
- inspectors

Include contracts and performance.

---

# 51. Vendor Onboarding

- KYC
- licence
- bank
- tax
- insurance
- contract
- rates
- approval

---

# 52. Vendor Performance

Score:

- price
- transit
- reliability
- response
- documentation
- invoice accuracy
- claims

---

# 53. Overseas Agent Management

Include:

- agent references
- shipment instructions
- debit note
- credit note
- commission
- profit share
- settlement
- outstanding

---

# 54. Job Costing

Per shipment:

```text
Expected Revenue
Expected Cost
Expected GP

Actual Revenue
Actual Cost
Actual GP
```

---

# 55. Cost Allocation

For consolidated shipments allocate by:

- CBM
- weight
- revenue
- house count
- custom percentage

---

# 56. Accrual Accounting

Expected supplier costs become accruals before invoice arrival.

Reverse automatically when actual bill arrives.

---

# 57. WIP / Revenue Recognition

Support shipments crossing financial periods.

- work in progress
- accrued revenue
- accrued expense
- deferred revenue
- deferred expenses

---

# 58. Double-Entry Accounting

Full financial core:

- COA
- GL
- journals
- AR
- AP
- cash
- bank
- adjustments
- closing
- reversals

---

# 59. Accounts Receivable

- invoices
- advances
- deposits
- credit notes
- partial payments
- allocations
- statements
- ageing

---

# 60. Accounts Payable

- vendor bills
- expected costs
- duplicate detection
- PO/job matching
- approvals
- settlement

---

# 61. Credit Control

Buckets:

```text
Current
1–7
8–30
31–60
61–90
90+
```

Track:

- calls
- emails
- WhatsApp
- disputes
- promise to pay
- escalation

---

# 62. Credit Limits

Block or approve shipment based on:

```text
Credit Limit
-
Outstanding
-
Unbilled Exposure
-
New Job Exposure
```

---

# 63. Treasury

- banks
- cash
- payment runs
- liquidity
- payment approvals
- transfers
- FX purchases
- forecast

---

# 64. Cheque / PDC

UAE-relevant:

- cheque number
- bank
- date
- deposit
- clearing
- bounce
- replacement
- PDC calendar

---

# 65. Bank Reconciliation

Automatic matching with:

- invoices
- payments
- bills
- expenses

---

# 66. Multicurrency

Store:

- operational rate
- invoice rate
- settlement rate
- realized FX
- unrealized FX

---

# 67. UAE VAT

Complete:

- standard
- zero-rated
- exempt
- out-of-scope
- reverse charge where applicable
- imports
- VAT invoices
- tax credit notes
- reconciliation
- VAT reports

---

# 68. UAE e-Invoicing

Architecture-ready for accredited provider integration:

```text
ERP Invoice
→ Structured Invoice
→ Validation
→ ASP
→ Peppol
→ Buyer / Reporting
```

Include:

- status
- acknowledgement
- rejection
- retry
- archive

---

# 69. Corporate Tax Support

- accounting books
- supporting documents
- adjustments
- related parties
- fixed assets
- tax records
- retention

---

# 70. Fixed Assets

- acquisition
- category
- depreciation
- transfer
- disposal

---

# 71. Budgeting

Budget by:

- company
- branch
- department
- cost centre

Compare:

- budget
- actual
- forecast

---

# 72. Financial Consolidation

For future multi-company group:

- intercompany
- eliminations
- group accounts
- consolidated reporting

---

# 73. Procurement

```text
Request
→ Approval
→ RFQ
→ Comparison
→ PO
→ Receipt
→ Bill
→ Payment
```

---

# 74. Operational Advances

For staff/customs/transport:

```text
Advance Request
→ Approval
→ Payment
→ Expense Evidence
→ Reconciliation
→ Balance Return
```

---

# 75. Approval Engine

One engine for everything:

- quote
- discount
- credit
- purchase
- supplier bill
- payment
- refund
- journal
- expenses
- leave
- HR
- vendor creation

---

# 76. Workflow Engine

Configurable:

```text
Trigger
Condition
Action
Delay
Escalation
Retry
Approval
Audit
```

---

# 77. SLA Engine

SLA by:

- customer
- service
- department
- activity

Examples:

- quote ≤ 2 hours
- booking confirmation ≤ 4 hours
- BL draft ≤ 8 hours
- POD ≤ 4 hours

---

# 78. Department Work Queues

### Pricing

Rates awaiting action.

### Operations

Jobs requiring intervention.

### Documentation

BL/documents.

### Accounts

Billing/costing.

### Credit

Collections.

---

# 79. Workload Management

Track:

- workload/person
- jobs
- tasks
- overdue
- complexity
- utilization

Recommend reassignment.

---

# 80. Shift Handover

Automatic:

```text
Employee Ending Shift
→ Outstanding Jobs
→ Critical Issues
→ Pending Communications
→ Handover
→ Recipient Acknowledges
```

---

# 81. Customer SOP Engine

Customer-specific rules applied automatically.

Example:

> Always send pre-alert 48 hours before ETA.

System creates that task automatically.

---

# 82. Route / Lane SOP

Country/lane-specific instructions.

---

# 83. Workflow Templates

Per operation:

- FCL export
- FCL import
- LCL
- air
- road
- customs
- warehouse

---

# 84. Cut-Off Management

Track:

- SI
- VGM
- gate-in
- cargo
- documents
- airline acceptance

Countdown alerts.

---

# 85. Pre-Alert Automation

Automatically compile documents and send.

---

# 86. Unified Inbox

Single interface for:

- WhatsApp
- email
- website
- customer portal
- internal notes

---

# 87. WhatsApp Business

Full operational channel, not a button.

### Customer

- enquiries
- quotes
- booking
- tracking
- documents
- invoices
- payment reminders

### Internal

- approval
- owner brief
- alerts
- exceptions

---

# 88. WhatsApp Automation

Examples:

- booking confirmed
- shipment departed
- ETA change
- customs clearance
- documents missing
- delivery
- POD
- invoice
- overdue

---

# 89. Daily Owner WhatsApp Brief

Automatically send:

```text
Active Jobs
Arrivals
Deliveries
Customs Pending
Critical Exceptions
Outstanding AR
Collections Expected
Cash Position
GP MTD
Approvals
```

---

# 90. Email Automation

Shared addresses:

- sales@
- pricing@
- operations@
- imports@
- exports@
- accounts@

Automatically link incoming email to:

- customer
- job
- invoice
- booking

---

# 91. Communication Timeline

Every record has:

- email
- WhatsApp
- call
- comments
- notes
- tasks
- activity

---

# 92. Universal Side Panel

Like the good part of Fresa:

```text
Comments
Follow-ups
Attachments
References
Tags
Links
Complaints
History
```

---

# 93. Document Management

- versioning
- permission
- secure links
- OCR
- AI extraction
- expiry
- retention
- audit

---

# 94. OCR

Extract:

- BL
- AWB
- invoices
- packing lists
- COO
- customs documents
- receipts

---

# 95. Document Matching

Automatically attach uploaded files to the correct job.

---

# 96. Customer Portal

Complete self-service:

```text
Dashboard
Quotes
Bookings
Shipments
Tracking
Documents
Invoices
Statements
Payments
Inventory
Claims
Support
Reports
```

---

# 97. Agent Portal

- jobs
- pre-alert
- documents
- charges
- settlements
- communication

---

# 98. Vendor Portal

- jobs
- acceptance
- status
- POD
- invoices
- payment status

---

# 99. Employee Portal

- profile
- documents
- attendance
- leave
- salary
- expenses
- tasks
- training

---

# 100. HRMS

For 80 staff:

- workforce planning
- recruitment
- applicant tracking
- onboarding
- employee file
- probation
- attendance
- leave
- appraisal
- training
- discipline
- promotion
- transfer
- resignation
- offboarding

---

# 101. UAE Payroll

- salary
- allowances
- deductions
- overtime
- commissions
- leave
- payslip
- payroll journal
- payment

---

# 102. WPS

Prepare applicable salary files and controls.

---

# 103. EOSB

End-of-service calculation workflow.

---

# 104. Employee Documents

Track:

- passport
- visa
- Emirates ID
- labour permit
- insurance
- licences

Expiry alerts.

---

# 105. Training & Competency

Competency matrix for:

- Ocean
- Air
- Customs
- DG
- Warehouse
- Finance

---

# 106. Knowledge Base

Version-controlled:

- SOPs
- policies
- manuals
- customer SOP
- carrier instructions
- customs guides
- training

---

# 107. Internal Helpdesk

Categories:

- IT
- HR
- finance
- system
- admin

---

# 108. Customer Helpdesk

Tickets linked to:

- customer
- shipment
- invoice

With SLA.

---

# 109. Complaint Management

- complaint
- cause
- severity
- owner
- action
- resolution

---

# 110. Quality Management

- NCR
- CAPA
- internal audits
- SOP compliance
- quality objectives

---

# 111. HSE

For warehouse/transport:

- incident
- accident
- near miss
- PPE
- safety checks
- investigation
- corrective action

---

# 112. Compliance Calendar

Track:

- licences
- registrations
- customs
- VAT
- corporate tax
- visas
- insurance
- vehicle registrations
- contracts

---

# 113. Risk Register

Risks:

- financial
- operational
- customer
- carrier
- compliance
- security
- legal

---

# 114. Audit Module

Internal audit:

- plan
- checklist
- findings
- severity
- remediation
- evidence
- closure

---

# 115. Immutable Audit Trail

Every important transaction records:

```text
User
Date
Device
Old Value
New Value
Reason
Approval
```

---

# 116. Reports

### Freight

- shipment register
- container register
- ETA
- ETD
- BL
- AWB
- customer

### Commercial

- sales
- quote
- conversion
- pipeline

### Operational

- SLA
- delay
- turnaround
- productivity

### Financial

- P&L
- BS
- cash flow
- trial balance
- AR
- AP

---

# 117. Profitability Analytics

Profit by:

- job
- house
- master
- customer
- salesperson
- branch
- department
- lane
- carrier
- agent
- service
- container
- commodity

---

# 118. Staff Productivity

Measure:

- jobs
- SLA
- errors
- turnaround
- complaints
- task completion

---

# 119. Carrier Performance

- on-time
- rollovers
- rate competitiveness
- claims
- transit
- response

---

# 120. Customer Churn / Growth

Detect:

- declining volume
- falling GP
- increased complaints
- rate rejection
- payment deterioration

---

# 121. Report Builder

Custom user-defined reporting.

Choose:

- dataset
- filters
- columns
- grouping
- calculations

Save/share/schedule.

---

# 122. Scheduled Reports

Deliver by:

- dashboard
- email
- WhatsApp
- PDF
- Excel

---

# 123. BI Layer

Historical warehouse for:

- trends
- management
- forecasting
- branch comparison
- departmental analysis

---

# 124. Universal Search

One search box for:

- Job
- Booking
- Customer
- Vendor
- Agent
- MBL
- HBL
- MAWB
- HAWB
- Container
- BOE
- invoice
- payment
- cheque
- PO
- DO
- declaration
- employee
- vehicle
- document

No Fresa-style dropdown selection first.

---

# 125. EDI

Support:

- EDIFACT
- XML
- JSON
- CSV
- SFTP
- APIs

---

# 126. Integration Hub

Provider adapters:

```text
CarrierProvider
TrackingProvider
CustomsProvider
EmailProvider
WhatsAppProvider
PaymentProvider
EInvoiceProvider
BankProvider
StorageProvider
OCRProvider
AIProvider
```

---

# 127. Integration Monitoring

Dashboard:

```text
WhatsApp       Healthy
Email          Healthy
Carrier APIs   Healthy
Customs        Warning
eInvoice       2 Pending
Bank           Healthy
```

---

# 128. API Platform

- OAuth
- API keys
- scopes
- webhooks
- rate limits
- logs
- replay
- retry

---

# 129. AI Operations Copilot

Ask:

> What needs attention today?

> Which shipments will be late?

> Show jobs missing invoices.

> Which containers risk detention?

> Summarize customer XYZ.

---

# 130. AI Pricing Assistant

Can:

- retrieve historical rates
- compare carriers
- analyze margins
- draft costing

Human approves final quote.

---

# 131. AI Documentation QA

Compare:

- HBL
- MBL
- invoice
- packing list
- SOP

Flag inconsistencies.

---

# 132. AI Finance Analyst

Ask:

> Why did margin decline?

> Which customers have poor payment behaviour?

> Forecast collections this month.

---

# 133. AI Management Analyst

Ask:

> Which branch is underperforming?

> Which employees are overloaded?

> Which customers are at risk?

---

# 134. AI Guardrails

AI must not independently:

- post journals
- approve payment
- change banking
- file customs declarations
- issue credit notes
- change tax
- approve low margin

without controlled workflow.

---

# 135. Master Data Governance

Central management for:

- ports
- airports
- carriers
- container types
- Incoterms
- countries
- currencies
- HS codes
- tax codes
- charge codes

---

# 136. Data Quality

Detect:

- duplicates
- impossible dates
- missing mandatory data
- duplicated BL
- invalid container number
- inconsistent customer names
- incomplete invoices

---

# 137. Job Closure

A job should not close until:

```text
✓ Delivered
✓ POD
✓ Revenue billed
✓ Costs booked/accrued
✓ Documents complete
✓ Customs closed
✓ Equipment returned
✓ Final GP calculated
```

---

# 138. Controlled Reopening

Manager approval + reason + audit log.

---

# 139. Production Environments

```text
Development
↓
Staging / UAT
↓
Production
```

No production experimentation.

---

# 140. Backup & Disaster Recovery

- automated backups
- PITR where supported
- offsite copies
- restore tests
- DR procedure
- incident plan

---

# 141. Monitoring

- uptime
- latency
- database
- queues
- API errors
- integration errors
- security events
- automation failures

---

# 142. Release Management

- release versions
- migrations
- feature flags
- rollback
- changelog

---

# 143. Migration from Fresa

Dedicated migration utilities for:

- customers
- contacts
- suppliers
- agents
- open jobs
- historic jobs
- MBL/HBL
- invoices
- AR/AP
- rates
- documents
- employees

---

# 144. UX — do NOT copy Fresa visually

Fresa's functional concepts are good, but the interface in the screenshots is too dense.

Elovora should use:

## Job Header

**DXB10260136**

`FCL Export · In Transit`

Dubai → Johannesburg

Then:

```text
Overview
Route
Cargo
Containers
B/L
Customs
Documents
Charges
Accounting
Messages
History
```

---

# 145. Staff Homepage

An operator sees:

```text
MY WORK

Active Jobs                 28
Need Attention               4
Due Today                    9
Waiting Customer             3
Waiting Carrier              6
```

Then work queue.

They do not see 145 modules.

---

# 146. Management Homepage

Management sees:

```text
Revenue
GP
Cash
AR
AP

Shipments
Exceptions
Sales
Collections

Approvals
Risks
Performance
```

---

# 147. Mobile

PWA/mobile experiences for:

### Employees

- work
- tasks
- shipments
- inbox
- approval

### Driver

- trips
- route
- POD

### Warehouse

- scan
- receive
- pick
- dispatch

### Management

- dashboard
- alerts
- approvals

---

# Final operating lifecycle

Everything ultimately follows one enterprise lifecycle:

```text
LEAD
↓
CUSTOMER / KYC
↓
ENQUIRY
↓
PRICING
↓
QUOTATION
↓
APPROVAL
↓
BOOKING
↓
MASTER / HOUSE JOB
↓
OPERATIONS
↓
DOCUMENTATION
↓
CUSTOMS
↓
TRANSPORT
↓
DELIVERY
↓
POD
↓
JOB COSTING
↓
INVOICE
↓
COLLECTION
↓
FINAL GP
↓
JOB CLOSE
↓
REPORTING / ANALYTICS
```

And supporting all of it:

```text
CRM
FINANCE
HR
COMPLIANCE
DOCUMENTS
APPROVALS
AUTOMATION
WHATSAPP
EMAIL
PORTALS
AI
AUDIT
BI
```

# What I would now call the product

## **ELVORA CONTROL**
### Enterprise Freight & Logistics Operating System

Six primary areas exposed to users:

**SELL**  
CRM · Pricing · Rates · Quotations

**MOVE**  
Bookings · Ocean · Air · Road · Customs · Warehouse

**CONTROL**  
Master Jobs · House Jobs · Containers · Documents · SLA · Exceptions

**MONEY**  
Costing · Accounting · VAT · Credit · Treasury

**CONNECT**  
WhatsApp · Email · Customers · Agents · Vendors

**MANAGE**  
People · Approvals · Reports · Compliance · AI

This is the version I would use as the **single master specification for the recreation**, replacing the earlier piecemeal lists. It is designed to cover both a **small Elovora operation** and a **Vega-style 80-person enterprise**, with modules switched on by role and business need rather than building separate systems.