import { q } from '../db'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { getSetting, setSettings } from '../settings'
import { addDays, todayStr } from '../util'

type Item = { type: string; name: string; reference_no?: string; authority?: string; status: string; issue_date?: string; expiry_date?: string; notes?: string; portal_url?: string }
const ACTIVITIES: [string, string, string, string][] = [
  ['Customs Broker', 'المخلص الجمركي', 'CUSTOMS', 'Customs clearance work also needs Dubai Customs broker registration.'],
  ['Sea Shipping Lines Agents', 'وكيل خطوط ملاحية بحرية', 'SEA_AGENCY', 'The licence lists the Dubai Maritime Authority as follow-up authority.'],
  ['Cargo Loading & Unloading Services', 'خدمات تحميل وتفريغ البضائع', 'CARGO_HANDLING', 'Handling only – storage needs a warehousing activity and permit.'],
  ['Sea Cargo Services', 'خدمات الشحن البحري للبضائع', 'SEA_FREIGHT', ''],
]
const TO_CHECK = 'Status not evidenced by the documents supplied – confirm and update this record.'

function put(items: Item[]) {
  for (const it of items) {
    if (q.val(`SELECT 1 FROM compliance_items WHERE type = ? AND name = ? AND deleted_at IS NULL`, it.type, it.name)) continue
    createRecord(getDef('compliance_items'), { renewal_lead_days: 60, ...it }, SYSTEM_CTX)
  }
}
const common = (verify = TO_CHECK): Item[] => [
  { type: 'Customs broker registration (Dubai Customs)', name: 'Dubai Customs broker registration', authority: 'Dubai Customs', status: 'To verify', notes: `The licence lists the Customs Broker activity. Confirm broker registration, bank guarantee and Mirsal 2 / Dubai Trade access. ${verify}` },
  { type: 'Maritime / shipping agent approval (DMA)', name: 'Dubai Maritime Authority approval', authority: 'Dubai Maritime Authority', status: 'To verify', notes: `The licence names the Dubai Maritime Authority as follow-up authority for the shipping-agent activity. ${verify}` },
  { type: 'VAT registration (FTA)', name: 'VAT registration', authority: 'Federal Tax Authority', status: 'To verify', notes: 'Register when taxable supplies (including zero-rated) exceed AED 375,000 in 12 months; voluntary above AED 187,500. Enter the TRN in Company Settings once issued.', portal_url: 'https://eservices.tax.gov.ae' },
  { type: 'Corporate tax registration (FTA)', name: 'Corporate tax registration', authority: 'Federal Tax Authority', status: 'To verify', notes: 'Required for every juridical person, even if the income is below the AED 375,000 threshold or Small Business Relief is claimed.', portal_url: 'https://eservices.tax.gov.ae' },
  { type: 'E-invoicing service provider (ASP)', name: 'Accredited e-invoicing service provider', authority: 'Ministry of Finance / FTA', status: 'To obtain', notes: 'Appoint an accredited Peppol service provider and connect it under Administration → Integrations.' },
  { type: 'MOHRE establishment card / WPS', name: 'MOHRE establishment card and WPS enrolment', authority: 'MOHRE', status: 'To verify', notes: `Needed to hire staff and to run the WPS salary file. ${verify}` },
  { type: 'ICP establishment card', name: 'ICP establishment card', authority: 'Federal Authority for Identity, Citizenship, Customs & Port Security', status: 'To verify', notes: `Needed for residence visas. ${verify}` },
  { type: 'Tenancy contract (Ejari)', name: 'Office tenancy contract (Ejari)', authority: 'Dubai Land Department', status: 'To verify', notes: `The licence address must match the tenancy. ${verify}` },
  { type: 'Insurance policy', name: 'Freight forwarder liability / cargo insurance', authority: 'Insurer', status: 'To verify', notes: 'Cover for legal liability as forwarder / broker and for employees’ compulsory health insurance.' },
  { type: 'UBO register', name: 'Ultimate beneficial owner register', authority: 'Dubai Economy and Tourism', status: 'To verify', notes: 'Keep the UBO register and shareholder register filed and updated after any change of ownership or management (check the filing period with DET).' },
  { type: 'Data protection / privacy', name: 'Privacy notice and consent wording', authority: 'Internal (UAE PDPL)', status: 'To obtain', notes: 'Publish a privacy notice on the website and quote form; record marketing consent on customers and leads.' },
]

/** Production: the company’s own licence data from its DET trade licence, DCCI certificate and commercial register. Demo: fictional equivalents. */
export function seedCompliance(opts: { demo?: boolean } = {}) {
  const today = todayStr()
  if (opts.demo) {
    setSettings({ company_name_ar: 'ديمو للشحن ش.ذ.م.م', licence_name_en: 'Elvora Shipping LLC (demo workspace)', company_trn: '100000000000003', company_trade_license: 'DEMO-000000', licence_authority: 'Dubai Economy and Tourism (DET)', licence_issue_date: addDays(today, -165), licence_expiry_date: addDays(today, 200), vat_registered: true, compliance_mode: 'enforce', activity_scope_mode: 'warn', ct_registered: true, ct_trn: '100000000000003' })
    for (const [en, ar, covers] of [...ACTIVITIES.map(a => [a[0], a[1], a[2]] as const), ['Air cargo services', 'خدمات الشحن الجوي', 'AIR_FREIGHT'] as const, ['Goods transport by road', 'نقل البضائع بالطرق البرية', 'ROAD_TRANSPORT'] as const, ['General warehousing', 'التخزين العام', 'WAREHOUSING'] as const])
      if (!q.val(`SELECT 1 FROM licence_activities WHERE activity_en = ?`, en)) createRecord(getDef('licence_activities'), { activity_en: en, activity_ar: ar, covers, status: 'Active', source: 'Trade licence (demo)' }, SYSTEM_CTX)
    put([
      { type: 'Trade licence', name: 'Trade licence (DET)', reference_no: 'DEMO-000000', authority: 'Dubai Economy and Tourism', status: 'Active', issue_date: addDays(today, -165), expiry_date: addDays(today, 200) },
      { type: 'Chamber of Commerce membership', name: 'Dubai Chamber membership', reference_no: 'DEMO-CH-5544', authority: 'Dubai Chamber of Commerce & Industry', status: 'Active', issue_date: addDays(today, -165), expiry_date: addDays(today, 200) },
      { type: 'Customs broker registration (Dubai Customs)', name: 'Dubai Customs broker registration', reference_no: 'DEMO-CB-77', authority: 'Dubai Customs', status: 'Active', expiry_date: addDays(today, 24) },
      { type: 'Insurance policy', name: 'Freight forwarder liability insurance', reference_no: 'DEMO-POL-9001', authority: 'Demo Insurance', status: 'Active', expiry_date: addDays(today, 41) },
      { type: 'Tenancy contract (Ejari)', name: 'Office tenancy contract (Ejari)', reference_no: 'DEMO-EJ-123', authority: 'Dubai Land Department', status: 'Active', expiry_date: addDays(today, 130) },
    ])
    return
  }
  const cur = (k: string) => String(getSetting(k) ?? '')
  setSettings({
    company_name: cur('company_name') === 'Elvora Shipping L.L.C.' ? 'ELVORA SHIPPING L.L.C' : cur('company_name'),
    company_name_ar: cur('company_name_ar') || 'إلفورا للشحن ش.ذ.م.م', licence_name_en: cur('licence_name_en') || 'ELVORA SHIPPING L.L.C',
    company_legal_form: cur('company_legal_form') || 'Limited Liability Company – Single Owner (LLC – SO)',
    company_trade_license: cur('company_trade_license') || '1645802', licence_authority: cur('licence_authority') || 'Dubai Economy and Tourism (DET)',
    licence_issue_date: cur('licence_issue_date') || '2026-08-17', licence_expiry_date: cur('licence_expiry_date') || '2027-08-16',
    dcci_no: cur('dcci_no') || '697774', commercial_register_no: cur('commercial_register_no') || '2911510',
    company_address: cur('company_address') === 'Dubai, United Arab Emirates' ? 'Naif, Dubai, United Arab Emirates (Parcel ID 118-157)' : cur('company_address'),
    company_phone: cur('company_phone') || '+971 50 422 1950',
  })
  for (const [en, ar, covers, notes] of ACTIVITIES)
    if (!q.val(`SELECT 1 FROM licence_activities WHERE activity_en = ? AND deleted_at IS NULL`, en)) createRecord(getDef('licence_activities'), { activity_en: en, activity_ar: ar, covers, notes, status: 'Active', source: 'Trade licence 1645802' }, SYSTEM_CTX)
  put([
    { type: 'Trade licence', name: 'Commercial licence (DET)', reference_no: '1645802', authority: 'Dubai Economy and Tourism (DET)', status: 'Active', issue_date: '2026-08-17', expiry_date: '2027-08-16', portal_url: 'https://www.dubaided.gov.ae', notes: 'LLC – Single Owner. Capital AED 200,000 (200 shares). Licence address: Naif, Parcel ID 118-157 – the office number is printed in Arabic on the licence; copy it exactly onto documents. Activities: Customs Broker; Sea Shipping Lines Agents; Cargo Loading & Unloading Services; Sea Cargo Services. Licence conditions: no change of location or licence details without DET approval; separate permits for warehouses and extra offices; signboard in Arabic and English; invoices must show amounts and VAT.' },
    { type: 'Commercial register', name: 'Commercial register certificate', reference_no: '2911510', authority: 'Dubai Economy and Tourism (DET)', status: 'Active', issue_date: '2026-08-17', expiry_date: '2027-08-16' },
    { type: 'Chamber of Commerce membership', name: 'Dubai Chamber of Commerce & Industry membership', reference_no: '697774', authority: 'Dubai Chamber of Commerce & Industry', status: 'Active', issue_date: '2026-08-17', expiry_date: '2027-08-16', portal_url: 'http://www.dubaichamber.ae/verify' },
    ...common(),
  ])
}
