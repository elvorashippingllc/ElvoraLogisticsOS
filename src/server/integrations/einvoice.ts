import { q } from '../db'
import { getSetting } from '../settings'
import { bad, fromCents, nowIso } from '../util'
import { http, logIntegration } from './log'

const x = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const amt = (c: number) => fromCents(c).toFixed(2)
const TAXCAT: Record<string, string> = { 'Standard rated': 'S', 'Zero rated': 'Z', Exempt: 'E', 'Out of scope': 'O', 'Reverse charge': 'AE' }

/** UBL 2.1 invoice following the UAE e-invoicing (PINT AE / Peppol BIS Billing 3) structure. Validate with your accredited service provider before go-live. */
export function buildEinvoiceXml(invoiceId: number): { xml: string; filename: string } {
  const inv = q.get(`SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL`, invoiceId)
  if (!inv) throw bad('Invoice not found')
  if (inv.status === 'Draft' || inv.doc_type === 'Proforma Invoice') throw bad('Only posted tax invoices, debit notes and credit notes can be e-invoiced')
  const lines = q.all(`SELECT l.*, v.category, v.code vat_code FROM invoice_lines l LEFT JOIN vat_codes v ON v.id = l.vat_code_id WHERE l.invoice_id = ? AND l.deleted_at IS NULL ORDER BY l.id`, invoiceId)
  const buyer = q.get(`SELECT p.*, c.code cc FROM parties p LEFT JOIN countries c ON c.id = p.country_id WHERE p.id = ?`, inv.party_id)
  const ent = inv.branch_id ? q.get(`SELECT e.* FROM branches b JOIN legal_entities e ON e.id = b.legal_entity_id WHERE b.id = ?`, inv.branch_id) : null
  const name = ent?.name ?? getSetting('company_name'), trn = ent?.trn ?? getSetting('company_trn')
  if (!trn) throw bad('Set the company TRN under Company Settings (or on the legal entity) before issuing e-invoices')
  const cur = inv.currency
  const credit = inv.doc_type === 'Credit Note'
  const tin = (v?: string | null) => String(v ?? '').replace(/\D/g, '').slice(0, 10)
  // PINT AE endpoint = scheme 0235 + the 10-digit TIN (first 10 digits of the TRN). Reserved values: 9900000098 buyer outside e-invoicing, 9900000099 export to a buyer not on Peppol.
  const sellerEp = getSetting('einv_endpoint_id') || tin(trn), scheme = getSetting('einv_scheme_id') || '0235'
  const cats = new Map<string, { cat: string; pct: number; taxable: number; tax: number }>()
  for (const l of lines) {
    const cat = TAXCAT[l.category ?? 'Standard rated'] ?? 'S'
    const k = `${cat}:${l.vat_pct ?? 0}`
    const e = cats.get(k) ?? { cat, pct: l.vat_pct ?? 0, taxable: 0, tax: 0 }
    e.taxable += l.amount ?? 0; e.tax += l.vat_amount ?? 0; cats.set(k, e)
  }
  const party = (tag: string, p: { name: string; trn?: string; addr?: string; city?: string; cc?: string; ep?: string; email?: string }) => `
  <cac:${tag}><cac:Party>
    <cbc:EndpointID schemeID="${scheme}">${x(p.ep ?? p.trn)}</cbc:EndpointID>
    <cac:PartyName><cbc:Name>${x(p.name)}</cbc:Name></cac:PartyName>
    <cac:PostalAddress><cbc:StreetName>${x(p.addr)}</cbc:StreetName><cbc:CityName>${x(p.city)}</cbc:CityName><cac:Country><cbc:IdentificationCode>${x(p.cc || 'AE')}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    <cac:PartyTaxScheme><cbc:CompanyID>${x(p.trn)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>${x(p.name)}</cbc:RegistrationName></cac:PartyLegalEntity>
    ${p.email ? `<cac:Contact><cbc:ElectronicMail>${x(p.email)}</cbc:ElectronicMail></cac:Contact>` : ''}
  </cac:Party></cac:${tag}>`
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${credit ? 'CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"' : 'Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'} xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:peppol:pint:billing-1@ae-1</cbc:CustomizationID>
  <cbc:ProfileID>urn:peppol:bis:billing</cbc:ProfileID>
  <cbc:ID>${x(inv.invoice_no)}</cbc:ID>
  <cbc:IssueDate>${x(inv.invoice_date)}</cbc:IssueDate>
  ${inv.due_date && !credit ? `<cbc:DueDate>${x(inv.due_date)}</cbc:DueDate>` : ''}
  <cbc:${credit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>${credit ? '381' : inv.doc_type === 'Debit Note' ? '383' : '380'}</cbc:${credit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>
  ${inv.notes ? `<cbc:Note>${x(inv.notes)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>${x(cur)}</cbc:DocumentCurrencyCode>
  ${inv.reference ? `<cbc:BuyerReference>${x(inv.reference)}</cbc:BuyerReference>` : ''}
  ${party('AccountingSupplierParty', { name, trn, addr: ent?.address ?? getSetting('company_address'), city: 'Dubai', cc: 'AE', ep: sellerEp, email: getSetting('company_email') })}
  ${party('AccountingCustomerParty', { name: buyer?.legal_name || buyer?.name, trn: buyer?.trn, addr: [buyer?.address1, buyer?.address2].filter(Boolean).join(', '), city: buyer?.city, cc: buyer?.cc, email: buyer?.email, ep: buyer?.trn ? tin(buyer.trn) : buyer?.cc && buyer.cc !== 'AE' ? '9900000099' : '9900000098' })}
  <cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode></cac:PaymentMeans>
  <cac:TaxTotal><cbc:TaxAmount currencyID="${x(cur)}">${amt(inv.vat_total ?? 0)}</cbc:TaxAmount>
${[...cats.values()].map(c => `    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="${x(cur)}">${amt(c.taxable)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${x(cur)}">${amt(c.tax)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${c.cat}</cbc:ID><cbc:Percent>${c.pct}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`).join('\n')}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${x(cur)}">${amt(inv.subtotal ?? 0)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${x(cur)}">${amt(inv.subtotal ?? 0)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${x(cur)}">${amt(inv.total ?? 0)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${x(cur)}">${amt(inv.total ?? 0)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines.map((l, i) => `  <cac:${credit ? 'CreditNoteLine' : 'InvoiceLine'}>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:${credit ? 'CreditedQuantity' : 'InvoicedQuantity'} unitCode="C62">${l.qty ?? 1}</cbc:${credit ? 'CreditedQuantity' : 'InvoicedQuantity'}>
    <cbc:LineExtensionAmount currencyID="${x(cur)}">${amt(l.amount ?? 0)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${x(l.description || 'Freight service')}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${TAXCAT[l.category ?? 'Standard rated'] ?? 'S'}</cbc:ID><cbc:Percent>${l.vat_pct ?? 0}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${x(cur)}">${amt(l.rate ?? 0)}</cbc:PriceAmount></cac:Price>
  </cac:${credit ? 'CreditNoteLine' : 'InvoiceLine'}>`).join('\n')}
</${credit ? 'CreditNote' : 'Invoice'}>
`
  return { xml, filename: `${inv.invoice_no}.xml` }
}

export async function submitEinvoice(invoiceId: number): Promise<{ ok: boolean; reference?: string; message: string }> {
  const { xml, filename } = buildEinvoiceXml(invoiceId)
  const url = String(getSetting('einv_endpoint') || '')
  if (!getSetting('einv_enabled') || !url) throw bad('E-invoicing submission is not enabled. Enter your accredited service provider endpoint under Integrations (you can still download the XML).')
  const r = await http(url, { method: 'POST', headers: { 'Content-Type': 'application/xml', Authorization: `Bearer ${getSetting('einv_api_key')}`, 'X-Document-Id': filename }, body: xml, timeoutMs: 30000 })
  const ref = r.data?.reference ?? r.data?.id ?? r.data?.documentId ?? null
  q.run(`UPDATE invoices SET einvoice_status = ?, einvoice_ref = ?, einvoice_at = ? WHERE id = ?`, r.ok ? 'Submitted' : 'Rejected', ref, nowIso(), invoiceId)
  logIntegration('e-invoice', 'submit', r.ok, `${filename}: ${r.ok ? 'submitted' : 'HTTP ' + r.status}`, r.data ?? r.text.slice(0, 1000), { entity: 'invoices', id: invoiceId })
  if (!r.ok) throw bad(`Provider rejected the document (HTTP ${r.status}): ${r.data?.message ?? r.text.slice(0, 160)}`)
  return { ok: true, reference: ref ?? undefined, message: 'E-invoice submitted' }
}
