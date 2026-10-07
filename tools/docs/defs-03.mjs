import { P, H, L, N, NOTE, F, T, TOT, SIG, SP, CO } from './lib.mjs'
const cat = '03 Finance and Procurement'
const seller = [['Supplier', CO.name], ['Supplier address', '[Full registered address]'], ['Supplier TRN', '[15-digit VAT TRN]'], ['Trade licence no.', '[Number]']]
const buyer = [['Customer', '[Legal name]'], ['Customer address', '[Full address]'], ['Customer TRN', '[TRN, if VAT-registered]'], ['Customer ref. / PO', '[Reference]']]
const lines = T([['#', 0.05], ['Description', 0.33], ['Qty', 0.07, 'r'], ['Unit price', 0.12, 'r'], ['Discount', 0.09, 'r'], ['VAT %', 0.08, 'r'], ['VAT amt', 0.12, 'r'], ['Total', 0.14, 'r']], [['1', '', '', '', '', '', '', ''], ['2', '', '', '', '', '', '', ''], ['3', '', '', '', '', '', '', ''], ['4', '', '', '', '', '', '', '']])
const bank = H('Payment details')
const bankF = F([['Beneficiary', '[Account name as on bank record]'], ['Bank / branch', '[Bank, branch]'], ['Account no.', '[Number]'], ['IBAN', '[AE… 23 characters]'], ['SWIFT / BIC', '[Code]'], ['Payment reference', '[Invoice number]']], 1)
const fta = NOTE('Finance check before issue: confirm VAT registration, place and time of supply, VAT rate per line (international transport may qualify for zero-rating; local services usually do not), exchange rate source for foreign currency, and any e-invoicing requirement. Totals are not calculated by this template; verify them by hand or issue from the accounting system.')
export default [
  { id: 'ELV-023', cat, title: 'Tax Invoice', blocks: [
    F([['Document', 'TAX INVOICE'], ['Invoice no.', '[Sequential number]'], ['Issue date', '[DD MMM YYYY]'], ['Date of supply', '[DD MMM YYYY or period]'], ['Due date', '[DD MMM YYYY]'], ['Currency', '[AED / other]'], ['Exchange rate to AED', '[Rate and source, if not AED]'], ['Job / shipment ref.', '[Reference]']]),
    F(seller, 1), F(buyer, 1), H('Items'), lines,
    TOT([['Subtotal (excl. VAT)', '[0.00]'], ['Total VAT', '[0.00]'], ['Invoice total', '[0.00]'], ['Total VAT in AED', '[0.00]']]),
    bank, bankF, fta,
  ] },
  { id: 'ELV-024', cat, title: 'Service Invoice', subtitle: 'For customers or services outside VAT registration or where a tax invoice is not required. If the supplier is VAT-registered and the supply is taxable, issue a Tax Invoice instead.', blocks: [
    F([['Invoice no.', '[Number]'], ['Issue date', '[DD MMM YYYY]'], ['Due date', '[DD MMM YYYY]'], ['Currency', '[Currency]']]),
    F([...seller.slice(0, 2), ...buyer.slice(0, 1), ['Reference', '[Job / PO]']], 1),
    H('Services'), T([['#', 0.05], ['Description', 0.5], ['Qty', 0.1, 'r'], ['Unit price', 0.17, 'r'], ['Amount', 0.18, 'r']], 5),
    TOT([['Total', '[0.00]']]), bank, bankF,
  ] },
  { id: 'ELV-025', cat, title: 'Pro Forma Invoice', subtitle: 'An estimate or request for advance payment. It is not a tax invoice and does not create a VAT liability.', blocks: [
    F([['Pro forma no.', '[Number]'], ['Date', '[DD MMM YYYY]'], ['Valid until', '[DD MMM YYYY]'], ['Currency', '[Currency]'], ['Customer', '[Company]'], ['Reference', '[Quotation / booking]']]),
    H('Estimated charges'), T([['#', 0.05], ['Description', 0.5], ['Basis', 0.15], ['Estimate', 0.15, 'r'], ['VAT (indicative)', 0.15, 'r']], 5),
    TOT([['Estimated total', '[0.00]']]),
    P('Amounts are estimates based on information supplied and current carrier rates. Actual charges will be invoiced after the service is performed. [If a deposit is required: Please pay [amount] before booking is released.]'), bankF,
  ] },
  { id: 'ELV-026', cat, title: 'Commercial Invoice for Goods', subtitle: 'For the seller (shipper) of the goods to complete and issue. Elvora Shipping does not issue this document on the seller’s behalf unless authorised in writing.', blocks: [
    F([['Invoice no.', '[Seller’s number]'], ['Date', '[DD MMM YYYY]'], ['Seller / exporter', '[Name, address, licence no.]'], ['Buyer / consignee', '[Name, address]'], ['Notify party', '[If different]'], ['Country of origin', '[Country]'], ['Port of loading', '[Port]'], ['Port of discharge', '[Port]'], ['Incoterm and place', '[e.g. FOB Jebel Ali]'], ['Payment terms', '[Terms]'], ['Currency', '[Currency]'], ['Vessel / flight', '[Name]']]),
    H('Goods'), T([['#', 0.04], ['Description of goods', 0.3], ['HS code', 0.11], ['Origin', 0.09], ['Qty', 0.08, 'r'], ['Unit', 0.07], ['Unit price', 0.14, 'r'], ['Amount', 0.17, 'r']], 5),
    TOT([['Goods value', '[0.00]'], ['Freight', '[0.00]'], ['Insurance', '[0.00]'], ['Invoice total', '[0.00]']]),
    F([['Packages', '[Number and type]'], ['Gross weight (kg)', '[kg]'], ['Net weight (kg)', '[kg]'], ['Marks and numbers', '[As on cartons]']]),
    P('I declare that the particulars above are true and correct.'), SIG(['Seller – authorised signatory']),
  ] },
  { id: 'ELV-027', cat, title: 'Tax Credit Note', blocks: [
    F([['Document', 'TAX CREDIT NOTE'], ['Credit note no.', '[Sequential number]'], ['Issue date', '[DD MMM YYYY]'], ['Original invoice no.', '[Invoice number]'], ['Original invoice date', '[DD MMM YYYY]'], ['Currency', '[Currency]'], ['Reason', '[Pricing error / service not performed / discount / cancellation]'], ['Approved by', '[Name]']]),
    F(seller, 1), F(buyer.slice(0, 3), 1),
    H('Items credited'), lines,
    TOT([['Subtotal credited', '[0.00]'], ['VAT credited', '[0.00]'], ['Total credit', '[0.00]']]),
    P('This credit will be [applied against open invoices / refunded to the bank account on file].'), fta,
  ] },
  { id: 'ELV-028', cat, title: 'Debit Adjustment Note', blocks: [
    F([['Debit note no.', '[Sequential number]'], ['Issue date', '[DD MMM YYYY]'], ['Original invoice no.', '[Number]'], ['Currency', '[Currency]'], ['Reason', '[Additional charge, e.g. detention, storage, rate difference]'], ['Supporting document', '[Carrier invoice / authority receipt no.]']]),
    F([...seller.slice(0, 3), ...buyer.slice(0, 3)], 1),
    H('Items'), lines, TOT([['Subtotal', '[0.00]'], ['VAT', '[0.00]'], ['Total debit', '[0.00]']]), bankF, fta,
  ] },
  { id: 'ELV-029', cat, title: 'Payment Receipt', blocks: [
    F([['Receipt no.', '[Number]'], ['Date received', '[DD MMM YYYY]'], ['Received from', '[Payer name]'], ['Amount', '[Currency and amount]'], ['Amount in words', '[Words]'], ['Method', '[Bank transfer / cheque / card / cash]'], ['Bank / cheque ref.', '[Reference]'], ['Received by', '[Name]']]),
    H('Applied to'), T([['Invoice no.', 0.25], ['Invoice date', 0.2], ['Invoice total', 0.185, 'r'], ['Amount applied', 0.185, 'r'], ['Balance', 0.18, 'r']], 4),
    P('This receipt confirms payment received and is subject to clearance of funds for cheques. It is not a tax invoice.'), SIG([CO.name + ' – Accounts']),
  ] },
  { id: 'ELV-030', cat, title: 'Payment Approval Voucher', blocks: [
    F([['Voucher no.', '[Number]'], ['Date', '[DD MMM YYYY]'], ['Payee', '[Supplier / employee]'], ['Payment method', '[Bank transfer / cheque]'], ['Payee bank / IBAN', '[Details verified against supplier file]'], ['Currency and amount', '[Amount]'], ['Cost centre / job', '[Reference]'], ['Due date', '[DD MMM YYYY]']]),
    H('Invoices being paid'), T([['Supplier invoice no.', 0.25], ['Invoice date', 0.18], ['Description', 0.3], ['Amount', 0.13, 'r'], ['Our ref.', 0.14]], 4),
    H('Checks'), T([['Check', 0.6], ['Done', 0.15], ['Initials', 0.25]], [['Invoice matches order / carrier or authority document', '[ ]', ''], ['Amount and VAT verified', '[ ]', ''], ['Bank details unchanged since last payment (call-back if changed)', '[ ]', ''], ['Within budget / approval limit', '[ ]', '']]),
    SIG(['Prepared by', 'Approved by', 'Authorised signatory']),
  ] },
  { id: 'ELV-031', cat, title: 'Customer Statement of Account', blocks: [
    F([['Customer', '[Company]'], ['Account no.', '[Number]'], ['Statement date', '[DD MMM YYYY]'], ['Period', '[From – To]'], ['Currency', '[Currency]'], ['Credit terms', '[Days]']]),
    H('Transactions'), T([['Date', 0.12], ['Document', 0.14], ['Reference', 0.22], ['Debit', 0.14, 'r'], ['Credit', 0.14, 'r'], ['Balance', 0.14, 'r'], ['Due', 0.1]], 8),
    H('Ageing'), T([['Current', 0.2, 'r'], ['1–30 days', 0.2, 'r'], ['31–60 days', 0.2, 'r'], ['61–90 days', 0.2, 'r'], ['Over 90 days', 0.2, 'r']], [['', '', '', '', '']]),
    F([['Total due', '[Amount]'], ['Contact for queries', '[Name, ' + CO.tel + ']']]),
    P('Please let us know within 7 days of any item you dispute. Remit to the bank details on our invoices quoting your account number.'),
  ] },
  { id: 'ELV-032', cat, title: 'Employee Expense Claim', blocks: [
    F([['Claim no.', '[Number]'], ['Employee', '[Name]'], ['Department', '[Department]'], ['Period', '[From – To]'], ['Purpose', '[Business reason]'], ['Related job / customer', '[Reference]']]),
    H('Expenses'), T([['Date', 0.1], ['Category', 0.16], ['Description', 0.28], ['Receipt no.', 0.12], ['Amount', 0.12, 'r'], ['VAT', 0.1, 'r'], ['Total', 0.12, 'r']], 8),
    TOT([['Total claimed', '[0.00]'], ['Advance received', '[0.00]'], ['Net payable / (refundable)', '[0.00]']]),
    P('Attach original receipts or tax invoices. Mileage and per-diem claims follow company policy. I confirm these expenses were incurred for company business.'),
    SIG(['Employee', 'Line manager', 'Accounts']),
  ] },
  { id: 'ELV-033', cat, title: 'Purchase Order', blocks: [
    F([['PO no.', '[ELV-PO-YYYY-NNN]'], ['Date', '[DD MMM YYYY]'], ['Supplier', '[Name]'], ['Supplier TRN', '[TRN]'], ['Delivery / service date', '[DD MMM YYYY]'], ['Delivery location', '[Address]'], ['Payment terms', '[Days]'], ['Requested by', '[Name]']]),
    H('Order lines'), T([['#', 0.05], ['Description', 0.37], ['Qty', 0.08, 'r'], ['Unit', 0.08], ['Unit price', 0.14, 'r'], ['VAT', 0.1, 'r'], ['Total', 0.18, 'r']], 5),
    TOT([['Subtotal', '[0.00]'], ['VAT', '[0.00]'], ['Order total', '[0.00]']]),
    P('Quote the PO number on the supplier’s invoice. We pay invoices that match this order and the delivered goods or services. Changes require a written amendment signed by Elvora Shipping.'),
    SIG(['Requested by', 'Approved by']),
  ] },
  { id: 'ELV-034', cat, title: 'Supplier Account Opening Form', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['Supplier type', '[Carrier / agent / transporter / terminal / other]'], ['Legal name', '[Name]'], ['Trade licence no.', '[Number]'], ['VAT TRN', '[If registered]'], ['Address', '[Address]'], ['Country', '[Country]'], ['Website', '[URL]']]),
    H('Contacts'), T([['Role', 0.2], ['Name', 0.25], ['Telephone', 0.2], ['E-mail', 0.35]], [['Sales / account', '', '', ''], ['Operations', '', '', ''], ['Accounts', '', '', '']]),
    H('Bank details'), F([['Beneficiary', '[Name as on account]'], ['Bank', '[Name]'], ['IBAN / account', '[Number]'], ['SWIFT', '[Code]'], ['Currency', '[Currency]'], ['Payment terms', '[Days]']]),
    H('Verification'), T([['Check', 0.5], ['Done', 0.15], ['By / date', 0.35]], [['Licence copy obtained', '', ''], ['Bank letter or cancelled cheque obtained', '', ''], ['Call-back to a known number to confirm bank details', '', ''], ['Insurance / IATA / carrier accreditation (if relevant)', '', '']]),
    SIG(['Supplier', 'Procurement']),
  ] },
  { id: 'ELV-035', cat, title: 'Remittance Advice', blocks: [
    F([['Remittance no.', '[Number]'], ['Payment date', '[DD MMM YYYY]'], ['Payee', '[Supplier]'], ['Payment method', '[Transfer / cheque]'], ['Bank reference', '[Reference]'], ['Currency and amount', '[Amount]']]),
    T([['Your invoice no.', 0.22], ['Invoice date', 0.16], ['Our ref.', 0.2], ['Invoice amount', 0.14, 'r'], ['Deducted', 0.14, 'r'], ['Paid', 0.14, 'r']], 5),
    P('Please contact accounts at ' + CO.mail + ' if the amount differs from your records.'),
  ] },
  { id: 'ELV-036', cat, title: 'Account Reconciliation', blocks: [
    F([['Account', '[Bank / customer / supplier account]'], ['As at', '[DD MMM YYYY]'], ['Prepared by', '[Name]'], ['Reviewed by', '[Name]']]),
    H('Balances'), T([['Item', 0.6], ['Amount', 0.4, 'r']], [['Balance per our ledger', ''], ['Balance per statement', ''], ['Difference', '']]),
    H('Reconciling items'), T([['Date', 0.12], ['Reference', 0.2], ['Description', 0.36], ['Amount', 0.16, 'r'], ['Action', 0.16]], 8),
    F([['Unexplained difference', '[Must be zero before sign-off]'], ['Sign-off date', '[DD MMM YYYY]']]),
    SIG(['Prepared by', 'Reviewed by']),
  ] },
]
