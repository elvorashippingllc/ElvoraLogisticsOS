/** Optional sample data (fictional companies). Built through the real engine so every hook, total and ledger posting runs. */
import { q } from '../db'
import { createRecord, getDef, patchRecord, type Ctx, type Rec } from '../engine'
import { loadUser } from '../auth'
import { config } from '../config'
import { seedExtras } from './demo-extra'
import { addDays, todayStr } from '../util'
import { postInvoice, postBill, postReceipt } from '../domain/finance'
import { generateInvoicesFromJob, createBillFromJobCosts, addJobEvent, ensureTrackingToken } from '../domain/jobs'
import { postGrn, postDispatch } from '../domain/warehouse'
import { convertQuoteToJob } from '../domain/sales'

const idBy = (table: string, col: string, v: string) => q.val<number>(`SELECT id FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`, v)!

const STAFF: [string, string, string, string][] = [
  ['Layla Hassan', 'layla.hassan@demo.elvora', 'Sales', 'SAL'], ['Omar Farouk', 'omar.farouk@demo.elvora', 'Operations', 'OPS'], ['Priya Nair', 'priya.nair@demo.elvora', 'Accounts', 'ACC'],
  ['Khalid Al Mazrouei', 'khalid.almazrouei@demo.elvora', 'Warehouse', 'WHS'], ['Sara Thomas', 'sara.thomas@demo.elvora', 'HR', 'HR'],
]
/** The demo presenter has full (Admin) access; the other staff are fictional colleagues so owners, assignees and approvers look real. */
function createDemoUsers(): number {
  const sys: Ctx = { user: null, system: true }
  const role = (n: string) => q.val<number>(`SELECT id FROM roles WHERE name = ?`, n)!, dept = (c: string) => idBy('departments', 'code', c), dxb = idBy('branches', 'code', 'DXB')
  const presenter = createRecord(getDef('users'), { name: 'Demo Presenter', email: config.demo.email, password: config.demo.password, role_id: role('Admin'), branch_id: dxb, department_id: dept('MGT'), designation: 'General Manager (demo)', active: true, must_change_password: false }, sys)
  for (const [name, email, r, d] of STAFF) createRecord(getDef('users'), { name, email, password: 'Demo-' + Math.random().toString(36).slice(2) + 'Aa1!x', role_id: role(r), branch_id: dxb, department_id: dept(d), active: true, must_change_password: false }, sys)
  return presenter.id
}

export async function seedDemoScenarios(): Promise<void> {
  const presenter = createDemoUsers()
  const admin = loadUser(presenter)
  const ctx: Ctx = { user: admin, system: true }
  const mk = (e: string, p: Rec): Rec => createRecord(getDef(e), p, ctx)
  const today = todayStr(), d = (n: number) => addDays(today, n)
  const loc = (c: string) => idBy('locations', 'code', c), carrier = (n: string) => q.val<number>(`SELECT id FROM carriers WHERE name LIKE ? AND deleted_at IS NULL`, `${n}%`)!
  const cc = (c: string) => idBy('charge_codes', 'code', c), ct = (c: string) => idBy('container_types', 'code', c)
  const dxb = idBy('branches', 'code', 'DXB'), net30 = idBy('payment_terms', 'name', 'Net 30 days'), net15 = idBy('payment_terms', 'name', 'Net 15 days')
  const bank = q.val<number>(`SELECT id FROM bank_accounts WHERE type = 'Bank'`)!, uae = idBy('countries', 'code', 'AE')
  const owner = admin!.id

  // ---- parties
  const cust = (name: string, extra: Rec = {}) => mk('parties', { name, is_customer: true, status: 'Active', payment_term_id: net30, credit_days: 30, credit_limit: 150000, salesperson_id: owner, country_id: uae, city: 'Dubai', kyc_status: 'Verified', ...extra })
  const c1 = cust('Gulf Textile Trading LLC', { trn: '100234567800003', email: 'ops@gulftextile.example', phone: '+971 4 555 0101', industry: 'Textiles', address1: 'Al Quoz Industrial 3' })
  const c2 = cust('Atlas Auto Parts FZE', { trn: '100345678900003', email: 'logistics@atlasauto.example', phone: '+971 6 555 0142', industry: 'Automotive', city: 'Sharjah', address1: 'SAIF Zone, Sharjah' })
  const c3 = cust('Emerald Foods DMCC', { trn: '100456789000003', email: 'import@emeraldfoods.example', phone: '+971 4 555 0177', industry: 'Agriculture / food', address1: 'JLT Cluster D' })
  const c4 = cust('Sahara Pharma Distribution', { trn: '100567890100003', email: 'supply@saharapharma.example', industry: 'Pharma / healthcare', payment_term_id: net15, credit_limit: 80000 })
  const c5 = cust('Nordic Machinery GmbH', { country_id: idBy('countries', 'code', 'DE'), city: 'Hamburg', is_shipper: true, is_consignee: false, trn: null, currency: 'USD', email: 'export@nordicmach.example' })
  const c6 = cust('Cape Mining Supplies (Pty) Ltd', { country_id: idBy('countries', 'code', 'ZA'), city: 'Johannesburg', is_consignee: true, currency: 'USD', status: 'Active' })
  const v1 = mk('parties', { name: 'Gulf Haulage LLC', is_vendor: true, is_transporter: true, status: 'Active', payment_term_id: net30, country_id: uae, email: 'dispatch@gulfhaulage.example' })
  const v2 = mk('parties', { name: 'Skyline Customs Brokerage', is_vendor: true, is_broker: true, status: 'Active', country_id: uae, trn: '100678901200003' })
  const v3 = mk('parties', { name: 'Oceanic Agency Johannesburg', is_vendor: true, is_agent: true, status: 'Active', country_id: idBy('countries', 'code', 'ZA') })
  const v4 = mk('parties', { name: 'Jebel Ali Container Services', is_vendor: true, status: 'Active', country_id: uae, trn: '100789012300003' })
  for (const [p, n, e, t] of [[c1, 'Mariam Al Suwaidi', 'mariam@gulftextile.example', 'Logistics Manager'], [c2, 'Rahul Menon', 'rahul@atlasauto.example', 'Import Coordinator'], [c3, 'Layla Haddad', 'layla@emeraldfoods.example', 'Supply Chain Lead'], [c4, 'Dr. Omar Rashid', 'omar@saharapharma.example', 'Procurement'], [v1, 'Imran Qureshi', 'imran@gulfhaulage.example', 'Dispatcher']] as const)
    mk('contacts', { name: n, party_id: p.id, email: e, designation: t, is_primary: true, receives_invoices: true, receives_tracking: true, phone: '+971 50 555 01' + String(p.id).padStart(2, '0') })

  // ---- CRM
  const camp = mk('campaigns', { name: 'GITEX logistics outreach', type: 'Exhibition', status: 'Running', start_date: d(-20), end_date: d(25), budget: 12000, owner_id: owner })
  for (const [co, nm, src, st, val] of [['Desert Rose Cosmetics', 'Fatima Noor', 'Exhibition / event', 'New', 45000], ['Bluewave Electronics', 'Ken Park', 'Website', 'Contacted', 120000], ['Al Waha Building Materials', 'Saeed Ali', 'Referral', 'Qualified', 90000], ['Harbor Fresh Seafood', 'Tomas Rivera', 'LinkedIn', 'New', 30000]] as const)
    mk('leads', { company: co, contact_name: nm, source: src, status: st, est_value: val, owner_id: owner, interest: 'Ocean FCL', campaign_id: src === 'Exhibition / event' ? camp.id : null, email: nm.split(' ')[0].toLowerCase() + '@' + co.split(' ')[0].toLowerCase() + '.example', phone: '+971 55 123 45' + String(val).slice(0, 2) })
  mk('opportunities', { title: 'Annual FCL programme – Nigeria', party_id: c1.id, value: 360000, probability: 60, stage: 'Negotiation', expected_close: d(20), owner_id: owner, mode: 'Ocean FCL', origin: 'Jebel Ali', destination: 'Lagos', frequency: 'Monthly' })
  mk('opportunities', { title: 'Spare parts air programme', party_id: c2.id, value: 95000, probability: 40, stage: 'Quotation', expected_close: d(12), owner_id: owner, mode: 'Air' })
  mk('opportunities', { title: 'Cold-chain warehousing', party_id: c4.id, value: 210000, probability: 25, stage: 'Qualification', expected_close: d(45), owner_id: owner, mode: 'Warehousing' })
  mk('opportunities', { title: 'Dubai–Mombasa project cargo', party_id: c3.id, value: 150000, probability: 100, stage: 'Won', expected_close: d(-3), owner_id: owner, mode: 'Project cargo' })
  for (const [i, [co, who, subj, out]] of ([[c1, 'Mariam Al Suwaidi', 'Discuss Q4 volumes', 'Connected'], [c2, 'Rahul Menon', 'Chase AWB signature', 'Follow-up needed'], [c3, 'Layla Haddad', 'Rate enquiry – Mombasa', 'Quote requested'], [c4, 'Dr. Omar Rashid', 'Warehouse visit scheduling', 'Callback requested'], [c6, 'Cape Mining', 'Delivery confirmation', 'Connected'], [c1, 'Mariam Al Suwaidi', 'Payment reminder call', 'No answer']] as const).entries())
    mk('activities', { type: 'Call', subject: subj, party_id: co.id, contact_name: who, direction: i % 2 ? 'Inbound' : 'Outbound', outcome: out, start_at: `${d(-i)}T1${i}:15`, duration_min: 4 + i, owner_id: owner, status: 'Done', phone: '+971 4 555 0' + (100 + i) })

  // ---- rate cards
  const sell = mk('rate_cards', { name: 'FCL Jebel Ali → West Africa – sell', kind: 'Sell (price list)', mode: 'Ocean FCL', currency: 'USD', valid_from: d(-30), valid_to: d(60), status: 'Active', children: { lines: [{ origin_id: loc('AEJEA'), destination_id: loc('NGLOS'), charge_code_id: cc('FRT-OCN'), basis: '40HC', rate: 3150, transit_days: 28, free_days: 14 }, { origin_id: loc('AEJEA'), destination_id: loc('NGLOS'), charge_code_id: cc('THC-O'), basis: '40HC', rate: 220 }] } })
  mk('rate_cards', { name: 'Maersk spot – Jebel Ali → Lagos (buy)', kind: 'Buy (cost)', mode: 'Ocean FCL', currency: 'USD', vendor_id: v4.id, valid_from: d(-10), valid_to: d(20), status: 'Active', children: { lines: [{ origin_id: loc('AEJEA'), destination_id: loc('NGLOS'), charge_code_id: cc('FRT-OCN'), basis: '40HC', rate: 2850, transit_days: 28 }] } })
  void sell

  // ---- jobs
  const job = (p: Rec) => mk('jobs', { branch_id: dxb, operator_id: owner, salesperson_id: owner, job_status: 'OPENED', ...p })
  const ch = (kind: string, code: string, qty: number, rate: number, party: number | null, cur = 'AED', extra: Rec = {}) => ({ kind, charge_code_id: cc(code), qty, rate, party_id: party, currency: cur, ...extra })

  // the example from the Job Info screen: air export Dubai → Johannesburg, Etihad, EXW, 3 originals
  const j1 = job({ client_id: c5.id, department: 'AIR EXPORT', trade: 'Export', job_date: d(5), mbl_no: '60754163572', hbl_no: '60754163572', mbl_date: d(-5), hbl_date: d(-5), carrier_id: carrier('Etihad'), place_of_receipt: 'DUBAI', por_id: loc('AEDXB'), pol_id: loc('AEDXB'), pod_id: loc('ZAJNB'), pof_id: loc('ZAJNB'), inco_terms: 'EXW', freight_terms: 'Prepaid', payable_at: 'DUBAI, UNITED ARAB EMIRATES', dispatch_at: 'DUBAI, UNITED ARAB EMIRATES', no_originals: 3, no_copies: 1, etd: `${d(-5)}T14:27`, bl_status: 'CREATED', marks_no: '14 KG', commodity: 'Machine spare parts', packages: 1, package_type: 'Carton', gross_weight: 14, volume_cbm: 0.08, consignee_id: c6.id, agent_id: v3.id, operational_status: 'DEPARTED', atd: `${d(-5)}T16:05`, eta: `${d(-3)}T09:40`, ata: `${d(-3)}T10:20`, job_status: 'IN PROGRESS',
    children: { charges: [ch('Revenue', 'FRT-AIR', 14, 14.5, c5.id, 'USD'), ch('Revenue', 'AWBF', 1, 35, c5.id, 'USD'), ch('Revenue', 'XRAY', 14, 0.45, c5.id, 'USD'), ch('Cost', 'FRT-AIR', 14, 11.2, null, 'USD'), ch('Cost', 'AHC', 14, 0.3, v4.id, 'AED')] } })
  addJobEvent(j1.id, 'Cargo received', { at: `${d(-6)}T11:00`, location: 'Dubai warehouse', source: 'Manual', user_id: owner })
  addJobEvent(j1.id, 'Export customs cleared', { at: `${d(-5)}T09:30`, location: 'Dubai Airport', source: 'Manual', user_id: owner })
  addJobEvent(j1.id, 'Flight arrived', { at: `${d(-3)}T10:20`, location: 'JNB', source: 'Carrier', user_id: owner })
  const sj = mk('shipments', { job_id: j1.id, status: 'In transit', consignee_id: c6.id, commodity: 'Machine spare parts', packages: 1, gross_weight: 14 })
  void sj

  const j2 = job({ client_id: c1.id, department: 'FCL EXPORT', trade: 'Export', job_date: d(-12), mbl_no: 'MAEU257103344', hbl_no: 'ELV-HB-1001', carrier_id: carrier('Maersk'), booking_no: '257103344', vessel_name: 'MAERSK ESSEN', voyage_no: '341E', por_id: loc('AEJEA'), pol_id: loc('AEJEA'), pod_id: loc('NGLOS'), pof_id: loc('NGLOS'), inco_terms: 'CIF', freight_terms: 'Prepaid', etd: `${d(-8)}T22:00`, atd: `${d(-8)}T23:30`, eta: `${d(18)}T06:00`, operational_status: 'IN TRANSIT', job_status: 'IN PROGRESS', bl_status: 'ISSUED', commodity: 'Cotton fabrics', packages: 420, package_type: 'Carton', gross_weight: 21800, volume_cbm: 58, shipper_id: c1.id, customer_ref: 'PO-7741',
    children: { containers: [{ container_no: 'MSKU4471209', type_id: ct('40HC'), seal_no: 'AE55120', gross_weight: 21800, status: 'Loaded', free_time_until: d(40) }], charges: [ch('Revenue', 'FRT-OCN', 1, 3150, c1.id, 'USD'), ch('Revenue', 'THC-O', 1, 220, c1.id, 'USD'), ch('Revenue', 'DOC', 1, 150, c1.id), ch('Revenue', 'BLF', 1, 120, c1.id), ch('Cost', 'FRT-OCN', 1, 2850, null, 'USD'), ch('Cost', 'THC-O', 1, 185, v4.id, 'USD')] } })
  addJobEvent(j2.id, 'Gate-in at port', { at: `${d(-9)}T14:10`, location: 'Jebel Ali', source: 'Manual', user_id: owner }); addJobEvent(j2.id, 'Vessel departed', { at: `${d(-8)}T23:30`, location: 'Jebel Ali', source: 'Carrier', user_id: owner })
  ensureTrackingToken(j2.id)
  mk('customs_declarations', { declaration_type: 'Export – Shipping Bill (SB)', declaration_no: 'EX-4471209-26', job_id: j2.id, status: 'Cleared', customs_office: 'Jebel Ali', broker_id: v2.id, children: { lines: [{ description: 'Cotton fabrics HS 5208', value: 168000, duty_pct: 0, vat_pct: 0 }] } })

  const j3 = job({ client_id: c2.id, department: 'AIR IMPORT', trade: 'Import', job_date: d(-20), mbl_no: '17612345678', hbl_no: 'ELV-HA-2044', carrier_id: carrier('Emirates'), por_id: loc('DEFRA'), pol_id: loc('DEFRA'), pod_id: loc('AEDXB'), pof_id: loc('AEDXB'), inco_terms: 'FCA', freight_terms: 'Collect', etd: `${d(-18)}T13:00`, atd: `${d(-18)}T13:40`, eta: `${d(-17)}T22:00`, ata: `${d(-17)}T22:20`, operational_status: 'DELIVERED', job_status: 'DELIVERED', bl_status: 'RELEASED', commodity: 'Brake components', packages: 12, package_type: 'Carton', gross_weight: 480, chargeable_weight: 520,
    children: { charges: [ch('Revenue', 'FRT-AIR', 520, 6.2, c2.id), ch('Revenue', 'CCF', 1, 350, c2.id), ch('Revenue', 'DUTY', 1, 2190, c2.id), ch('Revenue', 'DELIV', 1, 280, c2.id), ch('Cost', 'FRT-AIR', 520, 4.9, null), ch('Cost', 'CCF', 1, 220, v2.id), ch('Cost', 'DUTY', 1, 2190, v2.id), ch('Cost', 'DELIV', 1, 180, v1.id)] } })
  const j4 = job({ client_id: c3.id, department: 'FCL IMPORT', trade: 'Import', job_date: d(-35), mbl_no: 'COSU6380019', carrier_id: carrier('COSCO'), por_id: loc('INNSA'), pol_id: loc('INNSA'), pod_id: loc('AEJEA'), pof_id: loc('AEJEA'), inco_terms: 'CFR', freight_terms: 'Prepaid', etd: `${d(-30)}T05:00`, atd: `${d(-30)}T07:00`, eta: `${d(-22)}T08:00`, ata: `${d(-22)}T11:00`, operational_status: 'DELIVERED', job_status: 'DELIVERED', commodity: 'Basmati rice', packages: 1600, package_type: 'Bag', gross_weight: 26000,
    children: { containers: [{ container_no: 'CSNU6021345', type_id: ct('40GP'), seal_no: 'IN778812', gross_weight: 26000, status: 'Delivered', free_time_until: d(-8) }], charges: [ch('Revenue', 'THC-D', 1, 1450, c3.id), ch('Revenue', 'DOF', 1, 300, c3.id), ch('Revenue', 'CCF', 1, 400, c3.id), ch('Revenue', 'TRK', 1, 650, c3.id), ch('Cost', 'THC-D', 1, 1380, v4.id), ch('Cost', 'TRK', 1, 520, v1.id)] } })
  const j5 = job({ client_id: c4.id, department: 'WAREHOUSING', trade: 'Domestic', job_date: d(-8), operational_status: 'CARGO RECEIVED', commodity: 'Pharmaceutical consumables', packages: 80, package_type: 'Carton', gross_weight: 900, children: { charges: [ch('Revenue', 'STOR', 30, 45, c4.id), ch('Revenue', 'HNDL', 1, 600, c4.id), ch('Cost', 'HNDL', 1, 380, v1.id)] } })
  job({ client_id: c1.id, department: 'LCL EXPORT', trade: 'Export', job_date: d(-1), pol_id: loc('AEJEA'), pod_id: loc('KEMBA'), inco_terms: 'FOB', commodity: 'Garments', packages: 60, gross_weight: 1800, volume_cbm: 9.4, operational_status: 'BOOKING CONFIRMED', etd: `${d(6)}T12:00`, eta: `${d(24)}T12:00`, children: { charges: [ch('Revenue', 'FRT-OCN', 9.4, 85, c1.id, 'USD'), ch('Revenue', 'DOC', 1, 150, c1.id), ch('Cost', 'FRT-OCN', 9.4, 62, null, 'USD')] } })
  job({ client_id: c2.id, department: 'ROAD EXPORT', trade: 'Export', job_date: today, pol_id: loc('AEDXB'), pod_id: loc('SARUH'), commodity: 'Tyres', packages: 200, gross_weight: 7600, etd: `${d(2)}T08:00`, eta: `${d(4)}T18:00`, operational_status: 'BOOKING REQUESTED', children: { charges: [ch('Revenue', 'FRT-RD', 1, 4200, c2.id), ch('Cost', 'FRT-RD', 1, 3300, v1.id)] } })

  // ---- quotations
  const sellRows = (cur: string) => [{ charge_code_id: cc('FRT-OCN'), qty: 1, rate: 3150, cost_rate: 2850 }, { charge_code_id: cc('THC-O'), qty: 1, rate: 220, cost_rate: 185 }, { charge_code_id: cc('DOC'), qty: 1, rate: 150, cost_rate: 0 }].map(r => ({ ...r, _cur: cur }))
  const qa = mk('quotations', { customer_id: c1.id, mode: 'Ocean FCL', trade: 'Export', pol_id: loc('AEJEA'), pod_id: loc('NGLOS'), inco_terms: 'CIF', currency: 'USD', ex_rate: 3.6725, equipment: '1 x 40HC', commodity: 'Cotton fabrics', status: 'Draft', children: { lines: sellRows('USD').map(({ _cur, ...r }) => r) } })
  void qa
  const qb = mk('quotations', { customer_id: c2.id, mode: 'Air', trade: 'Import', pol_id: loc('DEFRA'), pod_id: loc('AEDXB'), currency: 'AED', status: 'Sent', commodity: 'Auto parts', children: { lines: [{ charge_code_id: cc('FRT-AIR'), qty: 300, rate: 7.2, cost_rate: 6.1 }, { charge_code_id: cc('CCF'), qty: 1, rate: 350, cost_rate: 220 }] } })
  void qb
  mk('quotations', { customer_id: c4.id, mode: 'Warehousing', currency: 'AED', status: 'Draft', children: { lines: [{ charge_code_id: cc('STOR'), qty: 90, rate: 40, cost_rate: 38 }] } })
  const qc = mk('quotations', { customer_id: c3.id, mode: 'Project cargo', trade: 'Export', pol_id: loc('AEJEA'), pod_id: loc('KEMBA'), currency: 'AED', status: 'Accepted', children: { lines: [{ charge_code_id: cc('FRT-OCN'), qty: 4, rate: 9800, cost_rate: 8200 }, { charge_code_id: cc('TRK'), qty: 4, rate: 900, cost_rate: 700 }] } })
  convertQuoteToJob(qc.id, ctx)

  // ---- finance: invoice, post, receive; bills
  const invoiceAndPost = (jobId: number, partyBill: boolean, pay: number) => {
    const invs = generateInvoicesFromJob(jobId, {}, ctx)
    const posted = invs.map(i => postInvoice(i.id, ctx))
    if (partyBill) { try { for (const v of [v1, v2, v4]) { try { const b = createBillFromJobCosts(jobId, v.id, `${v.code}-${jobId}${v.id}`, [], ctx); postBill(b.id, ctx) } catch { /* vendor has no costs on this job */ } } } catch { /* ignore */ } }
    if (pay > 0 && posted[0]) { const p = posted[0]; const r = mk('receipts', { party_id: p.party_id, bank_account_id: bank, receipt_date: d(-2), method: 'Bank transfer', currency: p.currency, ex_rate: p.ex_rate, amount: Math.round(p.total * pay * 100) / 100, reference: 'TRF' + p.id + '88', children: { allocations: [{ invoice_id: p.id, amount: Math.round(p.total * pay * 100) / 100 }] } }); postReceipt(r.id, ctx) }
    return posted
  }
  invoiceAndPost(j3.id, true, 1)
  invoiceAndPost(j4.id, true, 0.6)
  invoiceAndPost(j2.id, false, 0)
  void j5
  patchRecord(getDef('jobs'), j3.id, { job_status: 'CLOSED' }, ctx)
  mk('expenses', { employee_id: mk('employees', { name: 'Operations Manager', designation: 'Operations Manager', department_id: idBy('departments', 'code', 'OPS'), branch_id: dxb, join_date: d(-400), basic_salary: 14000, housing_allowance: 4000, transport_allowance: 1000, status: 'Active', passport_expiry: d(75), visa_expiry: d(25), eid_expiry: d(140) }).id, expense_date: d(-4), category: 'Port / terminal fees', description: 'Terminal gate fee – Jebel Ali', amount: 315, vat_amount: 15, status: 'Draft' })

  // ---- warehouse
  const wh = mk('warehouses', { code: 'DXB-WH1', name: 'Dubai Logistics City Warehouse', type: 'Bonded', branch_id: dxb, area_sqm: 3200 })
  const bins = ['A-01-01', 'A-01-02', 'B-02-01'].map(c => mk('wh_locations', { warehouse_id: wh.id, code: c, type: 'Rack' }))
  const it1 = mk('items', { sku: 'PHM-1001', name: 'Saline infusion 500 ml', customer_id: c4.id, min_stock: 100, track_lot: true, shelf_life_days: 730 })
  const it2 = mk('items', { sku: 'PHM-2040', name: 'Surgical gloves – box of 100', customer_id: c4.id, min_stock: 50, track_lot: true })
  const g = mk('grns', { warehouse_id: wh.id, customer_id: c4.id, job_id: j5.id, delivery_note: 'DN-88121', vehicle_no: 'DXB K 44721', children: { lines: [{ item_id: it1.id, qty: 400, location_id: bins[0].id, lot_no: 'L2601', expiry_date: d(300) }, { item_id: it1.id, qty: 250, location_id: bins[1].id, lot_no: 'L2512', expiry_date: d(55) }, { item_id: it2.id, qty: 40, location_id: bins[2].id, lot_no: 'G77' }] } })
  postGrn(g.id, ctx)
  const ds = mk('dispatches', { warehouse_id: wh.id, customer_id: c4.id, job_id: j5.id, consignee: 'Al Noor Hospital – Pharmacy', children: { lines: [{ item_id: it1.id, qty: 300 }] } })
  postDispatch(ds.id, ctx)

  // ---- transport & others
  const dr = mk('drivers', { name: 'Faisal Ahmed', phone: '+971 50 111 2233', licence_no: 'DXB-889120', licence_expiry: d(40), visa_expiry: d(200) })
  const veh = mk('vehicles', { plate_no: 'DXB K 44721', type: '7-ton truck', make: 'Isuzu', model: 'NPR', year: 2022, capacity_kg: 7000, driver_id: dr.id, registration_expiry: d(18), insurance_expiry: d(120), odometer: 88120 })
  mk('vehicles', { plate_no: 'DXB B 20931', type: 'Trailer – 40ft', make: 'Volvo', model: 'FH', year: 2020, capacity_kg: 28000, registration_expiry: d(210), insurance_expiry: d(210) })
  mk('transport_orders', { customer_id: c4.id, job_id: j5.id, type: 'Delivery', status: 'Dispatched', vehicle_id: veh.id, driver_id: dr.id, pickup_location: 'DLC Warehouse', delivery_location: 'Al Noor Hospital, Dubai', pickup_at: `${today}T09:00`, distance_km: 28, rate: 280, cost: 180 })
  mk('tickets', { subject: 'Delay in container release at Jebel Ali', customer_id: c3.id, job_id: j4.id, priority: 'High', type: 'Delay', description: 'Customer reports 2-day delay on gate pass.', assigned_to: owner, link_entity: 'jobs', link_id: j4.id })
  mk('tasks', { title: 'Chase signed AWB from consignee', due_date: d(1), assignee_id: owner, link_entity: 'jobs', link_id: j1.id, kind: 'Follow-up' })
  mk('tasks', { title: 'Send Q4 rate review to Gulf Textile', due_date: d(-1), assignee_id: owner, priority: 'High' })
  mk('contracts', { title: 'Annual freight services agreement', party_id: c1.id, type: 'Rate contract', status: 'Active', start_date: d(-300), end_date: d(40), credit_days: 30, owner_id: owner, value: 600000 })
  mk('announcements', { title: 'Peak season surcharge notice – Far East trade', category: 'Carrier notice', body: 'Several lines have announced a peak season surcharge from the 15th. Sales: please reflect in new quotations and inform key accounts.' })
  await seedExtras(ctx)
}
