import { P, H, L, N, NOTE, F, T, TOT, SIG, SP, CO } from './lib.mjs'
const cat = '06 Control and Guidance'
export default [
  { id: 'ELV-075', cat, title: 'Operational Risk Register', blocks: [
    F([['Register owner', '[Name]'], ['Last reviewed', '[DD MMM YYYY]'], ['Next review', '[DD MMM YYYY]'], ['Scale', 'Likelihood 1–5 × Impact 1–5 = Score']]),
    T([['ID', 0.08], ['Risk', 0.19], ['Cause / effect', 0.19], ['L', 0.05, 'r'], ['I', 0.05, 'r'], ['Score', 0.07, 'r'], ['Controls', 0.17], ['Owner', 0.1], ['Status', 0.1]], [['R-01', 'Carrier rolls booking', 'Space shortage; late delivery', '', '', '', 'Early booking; alternate carriers', '', ''], ['R-02', 'Customs hold / inspection', 'Wrong HS code or missing permit', '', '', '', 'Checklist before filing', '', ''], ['R-03', 'Customer credit default', 'Overdue invoices', '', '', '', 'Credit limits; ageing review', '', ''], ['R-04', 'Cargo damage or loss', 'Handling, packing, transit', '', '', '', 'Inspection; insurance', '', ''], ['R-05', 'Payment fraud', 'Changed bank details', '', '', '', 'Call-back verification', '', ''], ['R-06', 'Key-person dependency', 'Absence of coordinator', '', '', '', 'Cross-training; handover notes', '', ''], ['', '', '', '', '', '', '', '', '']]),
    P('Score 15 or more: escalate to the general manager this week. 8–14: action plan with owner and date. Below 8: monitor.'),
  ] },
  { id: 'ELV-076', cat, title: 'Corrective Action Record', blocks: [
    F([['CAR no.', '[Number]'], ['Date raised', '[DD MMM YYYY]'], ['Raised by', '[Name]'], ['Source', '[Complaint / audit / incident / near miss]'], ['Related ref.', '[Job / ticket]'], ['Owner', '[Name]'], ['Target close date', '[DD MMM YYYY]'], ['Severity', '[Low / medium / high]']]),
    H('Problem'), P('[Facts only: what, where, when.]'), H('Immediate containment'), P('[What was done at once.]'),
    H('Root cause'), P('[Use “five whys”. Stop at the process failure, not at a person.]'),
    H('Corrective and preventive actions'), T([['Action', 0.5], ['Owner', 0.18], ['Due', 0.16], ['Done', 0.16]], 4),
    H('Effectiveness check'), F([['Check date', '[DD MMM YYYY]'], ['Result', '[Effective / repeat issue]'], ['Closed by', '[Name]']]),
  ] },
  { id: 'ELV-077', cat, title: 'Supplier Performance Review', blocks: [
    F([['Supplier', '[Name]'], ['Type', '[Carrier / agent / transporter / terminal]'], ['Review period', '[From – To]'], ['Reviewer', '[Name]']]),
    T([['Criterion (score 1–5)', 0.4], ['Score', 0.1, 'r'], ['Weight', 0.1, 'r'], ['Evidence', 0.4]], [['On-time performance', '', '', ''], ['Documentation accuracy', '', '', ''], ['Cargo condition / claims', '', '', ''], ['Responsiveness', '', '', ''], ['Pricing and invoice accuracy', '', '', ''], ['Compliance and licences', '', '', '']]),
    F([['Weighted score', '[0.0]'], ['Rating', '[Preferred / approved / on watch / suspended]'], ['Next review', '[DD MMM YYYY]']]),
    H('Actions'), T([['Action', 0.55], ['Owner', 0.25], ['Date', 0.2]], 3),
  ] },
  { id: 'ELV-078', cat, title: 'Information Security Incident Record', blocks: [
    F([['Incident no.', '[Number]'], ['Date and time detected', '[DD MMM YYYY, HH:MM]'], ['Reported by', '[Name]'], ['Type', '[Phishing / lost device / wrong recipient / unauthorised access / malware / other]'], ['Systems or data involved', '[E-mail, accounting, shipment data, personal data]'], ['Severity', '[Low / medium / high]']]),
    H('What happened'), P('[Timeline of events.]'),
    H('Containment'), T([['Step', 0.5], ['By', 0.2], ['Time', 0.15], ['Done', 0.15]], [['Disconnect or disable account / device', '', '', ''], ['Change passwords; revoke sessions', '', '', ''], ['Notify bank if payment details involved', '', '', ''], ['Notify customers or authorities if required', '', '', '']]),
    F([['Personal data involved?', '[Yes / No – whose]'], ['Notification decision', '[By whom and when – seek legal advice]']]),
    H('Lessons and follow-up'), P('[Preventive actions and owners.]'),
  ] },
  { id: 'ELV-079', cat, title: 'Weekly Operations Dashboard', blocks: [
    F([['Week', '[Week no., DD MMM – DD MMM YYYY]'], ['Prepared by', '[Name]']]),
    T([['Measure', 0.4], ['This week', 0.15, 'r'], ['Last week', 0.15, 'r'], ['Target', 0.15, 'r'], ['Status', 0.15]], [['Shipments opened', '', '', '', ''], ['Shipments delivered', '', '', '', ''], ['Open shipments', '', '', '', ''], ['Delayed shipments', '', '', '', ''], ['Containers with free time ending in 3 days', '', '', '', ''], ['Customs holds', '', '', '', ''], ['Claims / complaints opened', '', '', '', ''], ['Invoices issued (count / AED)', '', '', '', ''], ['Collections received (AED)', '', '', '', '']]),
    H('Exceptions needing action'), T([['Job', 0.15], ['Issue', 0.4], ['Owner', 0.15], ['Due', 0.15], ['Status', 0.15]], 6),
    H('Notes for next week'), P('[Vessel schedule changes, holidays, staff absences.]'),
  ] },
  { id: 'ELV-080', cat, title: 'Monthly Business Review', blocks: [
    F([['Month', '[Month YYYY]'], ['Prepared by', '[Name]'], ['Meeting date', '[DD MMM YYYY]']]),
    H('Financial summary'), T([['Item', 0.34], ['Actual', 0.17, 'r'], ['Budget', 0.17, 'r'], ['Last year', 0.16, 'r'], ['Variance %', 0.16, 'r']], [['Revenue (AED)', '', '', '', ''], ['Direct costs (AED)', '', '', '', ''], ['Gross profit (AED)', '', '', '', ''], ['Overheads (AED)', '', '', '', ''], ['Net result (AED)', '', '', '', '']]),
    H('Customers and sales'), T([['Top customers by gross profit', 0.5], ['Revenue', 0.25, 'r'], ['Gross profit', 0.25, 'r']], 5),
    H('Operations'), P('[Volumes by mode and lane, service issues, supplier performance.]'),
    H('Receivables and cash'), P('[Ageing, overdue accounts, cash position, upcoming payments.]'),
    H('Decisions and actions'), T([['Decision / action', 0.5], ['Owner', 0.2], ['Due', 0.15], ['Status', 0.15]], 4),
  ] },
  { id: 'ELV-081', cat, title: 'Shipment Register', blocks: [
    P('One row per shipment. Use consistent job numbers and keep the register current.'),
    T([['Job no.', 0.1], ['Customer', 0.14], ['Mode', 0.06], ['Origin → destination', 0.15], ['B/L / AWB', 0.11], ['ETD', 0.08], ['ETA', 0.08], ['Status', 0.09], ['Invoiced', 0.08], ['Remarks', 0.11]], 14),
  ] },
  { id: 'ELV-082', cat, title: 'Template Use and Company Setup Guide', blocks: [
    H('1. Set up once'), N(['Open ELV-001 and ELV-008 and enter the registered address, trade licence number, issuing authority and VAT TRN (if registered).', 'Enter bank beneficiary name, bank and IBAN on the invoice templates (ELV-023 to ELV-029) after Finance has verified them.', 'List authorised signatories and approval limits in ELV-006 (Company Resolution).', 'Agree the standard terms with your legal adviser and insert them in ELV-014, ELV-021 and ELV-022.']),
    H('2. Using a template'), N(['Open the DOTX in Word to create a new document, or copy the DOCX.', 'Replace every bracketed field. Delete unused rows and guidance notes.', 'Save with the reference number in the file name, e.g. ELV-023-INV-2026-0001.docx.', 'Export to PDF for customers; keep the editable copy internally.'], { ref: 1 }),
    H('3. Numbering'), T([['Document', 0.35], ['Suggested format', 0.4], ['Owner', 0.25]], [['Quotation', 'ELV-Q-YYYY-NNN', 'Sales'], ['Booking', 'ELV-BK-YYYY-NNN', 'Operations'], ['Invoice', 'Sequential, no gaps (as required for tax invoices)', 'Accounts'], ['Purchase order', 'ELV-PO-YYYY-NNN', 'Procurement'], ['Claim', 'ELV-CLM-YYYY-NNN', 'Operations']]),
    H('4. Review before issue'), L(['Customer, company and shipment details are correct.', 'Units, currency, dates (DD MMM YYYY) and time zone (GST) are stated.', 'Totals and VAT are checked – these templates do not calculate.', 'Approvals and signatures are obtained.', 'The document is archived under its reference.']),
    H('5. What these templates are not'), L(['They are not carrier, customs or authority forms. Use the current official documents where required.', 'A company letter is not a carrier release order.', 'Contracts are starting points; have your legal adviser approve them.', 'Employment summaries support HR administration and do not replace official employment contracts.', 'Tax fields follow FTA invoice guidance; Finance decides registration, place of supply, VAT rate and e-invoicing obligations.']),
    H('6. Reference sources'), L(['FTA Tax Invoices clarification VATP006: https://tax.gov.ae/DataFolder/Files/Pdf/06-Tax-Invoices.pdf', 'IMO verification of gross mass: https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx', 'IATA dangerous goods declaration: https://www.iata.org/en/programs/cargo/dangerous-goods/shippers-declaration/', 'MOHRE contract documentation guidance: https://taqyeem.mohre.gov.ae/en/media-center/Awareness-and-Guidance/workers-rights.aspx']),
    H('7. Contact'), P(CO.name + ' · ' + CO.addr + ' · ' + CO.tel + ' · ' + CO.mail + ' · ' + CO.web + '\nHours: ' + CO.hours),
  ] },
]
