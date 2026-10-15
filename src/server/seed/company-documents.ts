import { q } from '../db'
import { getSetting, setSettings } from '../settings'
import { createRecord, patchRecord, getDef, SYSTEM_CTX } from '../engine'

/** Verified company documents supplied 15 Oct 2026. Do not copy third-party DEWA details. */
export function seedCompanyDocuments() {
  const address = String(getSetting('company_address') ?? '')
  const patch: Record<string, unknown> = {}
  if (!address || ['Dubai, United Arab Emirates', 'Naif, Dubai, United Arab Emirates (Parcel ID 118-157)'].includes(address))
    patch.company_address = 'Office F101-3, Ibrahim Mohammed Sharif Balsalah building, Naif, Dubai, United Arab Emirates'
  const facts = {
    company_name_ar: 'إلفورا للشحن ش.ذ.م.م',
    company_address_ar: 'مكتب رقم F101-3، ملك ابراهيم محمد شريف بالسلح، نايف، دبي، الإمارات العربية المتحدة',
    company_trade_license: '1645802', dcci_no: '697774', commercial_register_no: '2911510',
    licence_issue_date: '2026-08-17', licence_expiry_date: '2027-08-16',
    company_legal_form: 'Limited Liability Company - Single Owner (LLC - SO)',
    establishment_card_no: '2/1/1336642', establishment_card_expiry: '2027-08-16',
    ct_application_reference: '101002831255', ct_application_date: '2026-10-13',
    ct_application_status: 'Submitted - awaiting FTA decision',
  }
  for (const [key, value] of Object.entries(facts)) if (!getSetting(key)) patch[key] = value
  if (getSetting('company_name') === 'Elvora Shipping L.L.C.') patch.company_name = 'ELVORA SHIPPING L.L.C'
  setSettings(patch)
  const items = [
    { type: 'ICP establishment card', name: 'ICP establishment card', reference_no: '2/1/1336642', status: 'Active', expiry_date: '2027-08-16', notes: 'Electronic establishment card supplied by Elvora. Not evidence of MOHRE/WPS enrolment.' },
    { type: 'Corporate tax registration (FTA)', name: 'Corporate tax registration', reference_no: '101002831255', status: 'To verify', issue_date: '2026-10-13', notes: 'Application submitted 13 October 2026, 19:20 GST. Approval and TRN not supplied. This reference is not a VAT or corporate tax TRN.' },
    { type: 'Tenancy contract (Ejari)', name: 'Tenancy evidence review - supplied DEWA bill', status: 'To verify', notes: 'The file labelled EJARI Bill is a residential DEWA utility invoice in another account holder’s name, not an Ejari certificate. Do not use its address, account number or DEWA VAT number as Elvora company details. Obtain the actual tenancy certificate.' },
  ]
  for (const item of items) {
    const existing = q.get<{ id: number; reference_no: string; status: string }>('SELECT id, reference_no, status FROM compliance_items WHERE name = ? AND deleted_at IS NULL', item.name)
    if (!existing) createRecord(getDef('compliance_items'), { renewal_lead_days: 60, ...item }, SYSTEM_CTX)
    else if (!existing.reference_no && existing.status === 'To verify') patchRecord(getDef('compliance_items'), existing.id, item, SYSTEM_CTX)
  }
}
