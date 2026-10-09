import { loadUser } from '../auth'
import { demoSickLeaveDates } from './dates'
/** Additional demo scenarios layered on the core demo data: every status, exception and workflow the product supports. */
import fs from 'node:fs'
import path from 'node:path'
import { q } from '../db'
import { dirs } from '../config'
import { createRecord, getDef, insertRow, patchRecord, type Ctx, type Rec } from '../engine'
import { addDays, todayStr, nowLocal } from '../util'
import { setSettings } from '../settings'
import { postInvoice, postBill, postReceipt, postPayment, voidInvoice, expenseAction, approvalAction } from '../domain/finance'
import { postJournal } from '../domain/accounting'
import { addJobEvent, ensureTrackingToken } from '../domain/jobs'
import { generatePayroll } from '../domain/misc'
import { importLines } from '../integrations/bank'
import { buildWps } from '../integrations/wps'
import { closeYear } from '../integrations/yearend'
import { logIntegration } from '../integrations/log'
import { notify } from '../notify'
import { businessSnapshot } from '../integrations/snapshot'

const idBy = (table: string, col: string, v: string) => q.val<number>(`SELECT id FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`, v)
const party = (name: string) => q.val<number>(`SELECT id FROM parties WHERE name LIKE ? AND deleted_at IS NULL`, name + '%')!
const user = (name: string) => q.val<number>(`SELECT id FROM users WHERE name LIKE ? AND deleted_at IS NULL`, name + '%')!

export async function seedExtras(ctx: Ctx) {
  const mk = (e: string, p: Rec): Rec => createRecord(getDef(e), p, ctx)
  const ins = (e: string, p: Rec) => insertRow(getDef(e), p, ctx)
  const today = todayStr(), d = (n: number) => addDays(today, n), ly = Number(today.slice(0, 4)) - 1
  const step = (name: string, fn: () => void) => { try { fn() } catch (e: any) { console.error(`[demo seed] ${name}: ${e?.message ?? e}`) } }
  const cc = (c: string) => idBy('charge_codes', 'code', c)!, loc = (c: string) => idBy('locations', 'code', c)!
  const me = ctx.user!.id, layla = user('Layla'), omar = user('Omar'), priya = user('Priya'), khalid = user('Khalid'), sara = user('Sara')
  const dxb = idBy('branches', 'code', 'DXB')!, bank = q.val<number>(`SELECT id FROM bank_accounts WHERE type = 'Bank'`)!
  const gulf = party('Gulf Textile'), atlas = party('Atlas Auto'), emerald = party('Emerald Foods'), sahara = party('Sahara Pharma'), nordic = party('Nordic'), cape = party('Cape Mining')
  const v1 = party('Gulf Haulage'), v2 = party('Skyline'), v4 = party('Jebel Ali Container')
  const net30 = idBy('payment_terms', 'name', 'Net 30 days')!
  const SR = idBy('vat_codes', 'code', 'SR')!, ZR = idBy('vat_codes', 'code', 'ZR')!

  // company settings so printed documents and e-invoices look complete
  setSettings({ company_name: 'Elvora Shipping LLC (demo workspace)', company_trn: '100000000000003', company_trade_license: 'DEMO-000000', bank_details: 'Demo Bank PJSC · IBAN AE00 0000 0000 0000 0000 000', wps_employer_id: '0000012345678', wps_bank_routing: '123456789', lock_date: '' })

  // hand ownership around so every colleague has work
  step('owners', () => {
    q.run(`UPDATE leads SET owner_id = ? WHERE id % 2 = 0`, layla); q.run(`UPDATE opportunities SET owner_id = ? WHERE id % 2 = 1`, layla)
    q.run(`UPDATE jobs SET operator_id = ?, salesperson_id = ? WHERE id % 2 = 0`, omar, layla); q.run(`UPDATE parties SET salesperson_id = ? WHERE is_customer = 1 AND id % 2 = 0`, layla)
    q.run(`UPDATE tasks SET assignee_id = ? WHERE id % 2 = 1`, omar)
  })

  // ---------------------------------------------------------------- second legal entity + branch (multi-entity accounting)
  let abuBranch = 0
  step('entity', () => {
    const e2 = mk('legal_entities', { code: 'ELV-FZ', name: 'Elvora Logistics FZCO (demo free-zone entity)', trn: '100000000100003', base_currency: 'AED', is_default: false, active: true })
    abuBranch = mk('branches', { code: 'AUH', name: 'Abu Dhabi – Khalifa Port', city: 'Abu Dhabi', country: 'United Arab Emirates', active: true, legal_entity_id: e2.id }).id
  })

  // ---------------------------------------------------------------- receivables: every ageing bucket, FX, partial pay, credit note, proforma, void, e-invoice
  const makeInv = (p: number, daysAgo: number, termDays: number, lines: Rec[], extra: Rec = {}) => {
    const i = mk('invoices', { doc_type: 'Tax Invoice', party_id: p, branch_id: dxb, invoice_date: d(-daysAgo), due_date: d(-daysAgo + termDays), currency: 'AED', payment_term_id: net30, children: { lines }, ...extra })
    return postInvoice(i.id, ctx)
  }
  const L = (code: string, qty: number, rate: number, vat = ZR) => ({ charge_code_id: cc(code), description: undefined, qty, rate, vat_code_id: vat })
  const posted: Rec[] = []
  step('invoices', () => {
    posted.push(makeInv(gulf, 12, 30, [L('FRT-AIR', 400, 6.5), L('DOC', 1, 150, SR)]))                 // current
    posted.push(makeInv(atlas, 52, 30, [L('FRT-OCN', 1, 7200), L('THC-D', 1, 1450, SR)]))              // 1–30 overdue
    posted.push(makeInv(emerald, 80, 30, [L('FRT-OCN', 2, 5400), L('DOC', 1, 150, SR)]))                // 31–60
    posted.push(makeInv(sahara, 125, 30, [L('HNDL', 1, 4200, SR), L('STOR', 30, 45, SR)]))               // 90+
    posted.push(makeInv(cape, 40, 30, [L('FRT-OCN', 1, 3400)], { currency: 'USD', ex_rate: 3.6725 }))     // foreign currency
    posted.push(makeInv(gulf, 20, 30, [L('FRT-OCN', 1, 4800)], { branch_id: abuBranch || dxb }))          // second branch / entity
  })
  step('part-pay', () => {
    const inv = posted[1]; const amt = Math.round(inv.total * 0.4 * 100) / 100
    const r = mk('receipts', { party_id: inv.party_id, bank_account_id: bank, receipt_date: d(-9), method: 'Bank transfer', currency: inv.currency, ex_rate: inv.ex_rate, amount: amt, reference: 'TRF-ATL-4021', children: { allocations: [{ invoice_id: inv.id, amount: amt }] } })
    postReceipt(r.id, ctx)
    const onacct = mk('receipts', { party_id: nordic, bank_account_id: bank, receipt_date: d(-3), method: 'Bank transfer', amount: 5000, reference: 'ADV-NORD-77', children: { allocations: [] } }); postReceipt(onacct.id, ctx)
  })
  step('credit-note', () => {
    const base = posted[0]; const cn = mk('invoices', { doc_type: 'Credit Note', party_id: base.party_id, original_invoice_id: base.id, branch_id: dxb, invoice_date: d(-5), currency: 'AED', credit_reason: 'Weight adjusted after reweigh', notes: 'Credit note against ' + base.invoice_no + ' – weight adjusted after reweigh', children: { lines: [L('FRT-AIR', 40, 6.5)] } }); postInvoice(cn.id, ctx)
  })
  step('proforma-void', () => {
    mk('invoices', { doc_type: 'Proforma Invoice', party_id: nordic, branch_id: dxb, invoice_date: d(-1), currency: 'USD', ex_rate: 3.6725, notes: 'Advance payment for Hamburg consolidation', children: { lines: [L('FRT-AIR', 120, 4.8)] } })
    const bad = makeInv(emerald, 30, 30, [L('DOC', 1, 150, SR)]); voidInvoice(bad.id, 'Issued to wrong consignee – re-issued', ctx)
    mk('invoices', { doc_type: 'Tax Invoice', party_id: atlas, branch_id: dxb, invoice_date: today, children: { lines: [L('CCF', 1, 450, SR)] } })   // a draft
  })
  step('einvoice-status', () => {
    q.run(`UPDATE invoices SET einvoice_status = 'Accepted', einvoice_ref = 'ASP-' || id || '-DEMO', einvoice_at = ? WHERE id = ?`, nowLocal(), posted[0].id)
    q.run(`UPDATE invoices SET einvoice_status = 'Submitted', einvoice_ref = 'ASP-' || id || '-DEMO', einvoice_at = ? WHERE id = ?`, nowLocal(), posted[2].id)
  })

  // ---------------------------------------------------------------- payables: approval pending, due soon, paid, expense claims in every state
  step('bills', () => {
    const b1 = mk('bills', { vendor_id: v4, vendor_invoice_no: 'JACS-77120', bill_date: d(-10), due_date: d(3), currency: 'AED', children: { lines: [{ description: 'Terminal handling', qty: 1, rate: 6800, vat_code_id: SR, account_id: idBy('accounts', 'code', '5100') }] } }); postBill(b1.id, ctx)
    const b2 = mk('bills', { vendor_id: v1, vendor_invoice_no: 'GH-5521', bill_date: d(-40), due_date: d(-10), currency: 'AED', children: { lines: [{ description: 'Trucking – Jebel Ali to Al Quoz', qty: 6, rate: 1100, vat_code_id: SR, account_id: idBy('accounts', 'code', '5100') }] } }); postBill(b2.id, ctx)
    const big = mk('bills', { vendor_id: v2, vendor_invoice_no: 'SKY-0099', bill_date: d(-2), due_date: d(28), currency: 'AED', children: { lines: [{ description: 'Annual customs brokerage retainer', qty: 1, rate: 38000, vat_code_id: SR, account_id: idBy('accounts', 'code', '5200') }] } })
    approvalAction('bills', big.id, 'request', undefined, ctx)
    const pay = mk('payments', { vendor_id: v1, bank_account_id: bank, payment_date: d(-4), method: 'Bank transfer', amount: 4000, reference: 'PAY-GH-1', children: { allocations: [{ bill_id: b2.id, amount: 4000 }] } }); postPayment(pay.id, ctx)
  })
  step('expenses', () => {
    const reviewer:Ctx={system:true,user:loadUser(user('Priya'))}
    const emp = q.val<number>(`SELECT id FROM employees WHERE deleted_at IS NULL ORDER BY id LIMIT 1`)!
    const e = (cat: string, amt: number, daysAgo: number, desc: string) => mk('expenses', { employee_id: emp, category: cat, amount: amt, expense_date: d(-daysAgo), description: desc })
    const a = e('Fuel', 180, 12, 'Fuel for site visit'), b = e('Port / terminal fees', 420, 9, 'Gate pass – Jebel Ali'), c = e('Travel', 950, 5, 'Taxi and parking – Abu Dhabi meetings'); e('Meals & entertainment', 260, 2, 'Customer lunch – draft')
    expenseAction(a.id, 'submit', {}, ctx); expenseAction(a.id, 'approve', {}, reviewer); expenseAction(a.id, 'pay', { bank_account_id: bank }, ctx)
    expenseAction(b.id, 'submit', {}, ctx); expenseAction(b.id, 'approve', {}, reviewer); expenseAction(c.id, 'submit', {}, ctx)
  })

  // ---------------------------------------------------------------- bank reconciliation: matched and unmatched lines
  step('bank', () => {
    const rc = q.all(`SELECT receipt_date date, amount, reference FROM receipts WHERE status = 'Posted' AND bank_account_id = ? AND deleted_at IS NULL LIMIT 3`, bank)
    const lines = rc.map((r: any) => ({ date: r.date, description: 'INWARD TRANSFER ' + (r.reference ?? ''), reference: r.reference ?? '', debit: 0, credit: r.amount / 100 }))
    lines.push({ date: d(-6), description: 'SERVICE CHARGES', reference: 'FEE-OCT', debit: 52.5, credit: 0 }, { date: d(-4), description: 'INWARD TRANSFER – UNIDENTIFIED SENDER', reference: 'FT2602981', debit: 0, credit: 7350 }, { date: d(-2), description: 'DEWA UTILITIES', reference: 'DEWA-OCT', debit: 1480, credit: 0 })
    importLines(bank, lines, 'import')
  })

  // ---------------------------------------------------------------- previous year: activity, year-end close performed, period locked
  step('year-end', () => {
    const rev = idBy('accounts', 'code', '4000')!, opx = idBy('accounts', 'code', '5000')!, bk = idBy('accounts', 'code', '1100')!
    for (const [m, r, c] of [['03', 182000, 131000], ['06', 214000, 160000], ['09', 238000, 171000], ['12', 261000, 188000]] as const) {
      postJournal(ctx, { date: `${ly}-${m}-28`, memo: `Q${Math.ceil(Number(m) / 3)} ${ly} trading result`, source_type: 'Manual', lines: [{ account_id: bk, debit: r - c }, { account_id: opx, debit: c }, { account_id: rev, credit: r }] })
    }
    closeYear(ly, ctx, { lock: true })
  })

  // ---------------------------------------------------------------- operations: delays, customs hold, free-time risk, DG, reefer, cancelled, closed, unbilled
  const job = (p: Rec) => mk('jobs', { branch_id: dxb, operator_id: omar, salesperson_id: layla, job_status: 'OPENED', ...p })
  const ch = (kind: string, code: string, qty: number, rate: number, p: number | null, cur = 'AED') => ({ kind, charge_code_id: cc(code), qty, rate, party_id: p, currency: cur })
  const jobs: Record<string, Rec> = {}
  step('jobs', () => {
    jobs.delayed = job({ client_id: gulf, department: 'FCL EXPORT', trade: 'Export', job_date: d(-22), job_status: 'IN PROGRESS', operational_status: 'IN TRANSIT', mbl_no: 'MAEU266100455', carrier_id: idBy('carriers', 'code', 'MAEU') ?? undefined, pol_id: loc('AEJEA'), pod_id: loc('NGLOS'), inco_terms: 'CIF', etd: `${d(-16)}T22:00`, atd: `${d(-15)}T04:00`, eta: `${d(-1)}T08:00`, commodity: 'Cotton fabric rolls', packages: 320, gross_weight: 19800, vessel_name: 'MSC ALINA', voyage_no: '612W',
      children: { containers: [{ container_no: 'MSKU7712098', type_id: idBy('container_types', 'code', '40HC'), seal_no: 'AE90311', status: 'Loaded', free_time_until: d(2) }], charges: [ch('Revenue', 'FRT-OCN', 1, 2950, gulf, 'USD'), ch('Cost', 'FRT-OCN', 1, 2650, null, 'USD')] } })
    addJobEvent(jobs.delayed.id, 'Vessel departed', { at: `${d(-15)}T04:00`, location: 'Jebel Ali', source: 'Carrier' }); addJobEvent(jobs.delayed.id, 'Delay', { at: `${d(-4)}T10:00`, location: 'Tema', description: 'Port congestion – berthing delayed 5 days', source: 'Carrier' })
    jobs.hold = job({ client_id: emerald, department: 'FCL IMPORT', trade: 'Import', job_date: d(-9), job_status: 'ON HOLD', operational_status: 'DOCUMENTS PENDING', mbl_no: 'COSU6420031', pol_id: loc('INNSA'), pod_id: loc('AEJEA'), inco_terms: 'CFR', eta: `${d(-3)}T09:00`, ata: `${d(-3)}T13:00`, commodity: 'Basmati rice', packages: 1100, gross_weight: 25000, children: { containers: [{ container_no: 'TCLU5528834', type_id: idBy('container_types', 'code', '40GP'), status: 'Gated in', free_time_until: d(2) }], charges: [ch('Revenue', 'THC-D', 1, 1450, emerald), ch('Revenue', 'CCF', 1, 400, emerald), ch('Cost', 'THC-D', 1, 1380, v4)] } })
    mk('customs_declarations', { declaration_type: 'Import – Bill of Entry (BOE)', job_id: jobs.hold.id, status: 'Query raised', customs_office: 'Jebel Ali', broker_id: v2, remarks: 'Customs requests phytosanitary certificate and revised invoice value.', children: { lines: [{ description: 'Basmati rice HS 1006.30', value: 92000, duty_pct: 5, vat_pct: 5, qty: 25000, uom: 'KG' }] } })
    addJobEvent(jobs.hold.id, 'Exception / hold', { at: `${d(-2)}T11:00`, location: 'Jebel Ali customs', description: 'Documents query raised – awaiting phytosanitary certificate', source: 'Manual', user_id: omar })
    jobs.dg = job({ client_id: atlas, department: 'FCL EXPORT', trade: 'Export', job_date: d(-3), operational_status: 'BOOKING CONFIRMED', is_hazardous: 'Yes', commodity: 'Lithium-ion battery packs (UN3481, class 9)', packages: 240, gross_weight: 4800, pol_id: loc('AEJEA'), pod_id: loc('NGLOS'), etd: `${d(7)}T22:00`, eta: `${d(30)}T08:00`, handling_info: 'DG declaration required; segregation per IMDG.', children: { charges: [ch('Revenue', 'FRT-OCN', 1, 4100, atlas, 'USD'), ch('Revenue', 'DOC', 1, 250, atlas)] } })
    jobs.reefer = job({ client_id: sahara, department: 'AIR EXPORT', trade: 'Export', job_date: d(-1), operational_status: 'CARGO RECEIVED', pol_id: loc('AEDXB'), pod_id: loc('ZAJNB'), commodity: 'Temperature-controlled vaccines +2°C to +8°C', packages: 12, gross_weight: 180, etd: `${d(1)}T23:30`, handling_info: 'Keep between +2 and +8 C. Data logger attached.', children: { charges: [ch('Revenue', 'FRT-AIR', 180, 9.4, sahara), ch('Cost', 'FRT-AIR', 180, 7.1, null)] } })
    jobs.cancelled = job({ client_id: cape, department: 'LCL EXPORT', trade: 'Export', job_date: d(-30), job_status: 'CANCELLED', commodity: 'Mining spares', remarks: 'Cancelled by customer before booking.' })
    jobs.unbilled = job({ client_id: nordic, department: 'AIR IMPORT', trade: 'Import', job_date: d(-15), job_status: 'DELIVERED', operational_status: 'DELIVERED', pol_id: loc('DEFRA'), pod_id: loc('AEDXB'), commodity: 'Laboratory equipment', packages: 8, gross_weight: 340, children: { charges: [ch('Revenue', 'FRT-AIR', 340, 5.9, nordic), ch('Revenue', 'CCF', 1, 380, nordic), ch('Cost', 'FRT-AIR', 340, 4.6, null)] } })   // delivered, never invoiced → revenue leakage
    jobs.branch2 = job({ client_id: gulf, branch_id: abuBranch || dxb, department: 'ROAD EXPORT', trade: 'Export', job_date: d(-6), operational_status: 'IN TRANSIT', pol_id: loc('AEAUH') ?? undefined, commodity: 'Textile samples', packages: 30, children: { charges: [ch('Revenue', 'FRT-RD', 1, 2100, gulf)] } })
  })
  step('job-events', () => {
    for (const j of Object.values(jobs)) ensureTrackingToken(j.id)
    const sj = (j: Rec, st: string, extra: Rec = {}) => mk('shipments', { job_id: j.id, status: st, consignee_id: cape, commodity: j.commodity, packages: j.packages, gross_weight: j.gross_weight, ...extra })
    sj(jobs.delayed, 'In transit'); sj(jobs.unbilled, 'Delivered', { delivered_at: `${d(-11)}T15:00`, pod_received: true }); sj(jobs.dg, 'Booked')
    mk('bookings', { booking_no: 'BKG-DG-' + jobs.dg.id, job_id: jobs.dg.id, carrier_id: idBy('carriers', 'code', 'MAEU') ?? undefined, status: 'Confirmed', vessel_name: 'MAERSK SENTOSA', voyage_no: '615E', pol_id: loc('AEJEA'), pod_id: loc('NGLOS'), etd: `${d(7)}T22:00`, doc_cutoff: `${d(4)}T17:00`, vgm_cutoff: `${d(5)}T12:00`, gate_cutoff: `${d(5)}T18:00`, equipment: '2 x 20GP' })
    mk('bookings', { booking_no: 'BKG-RL-' + jobs.delayed.id, job_id: jobs.delayed.id, status: 'Rolled', vessel_name: 'MSC ALINA', remarks: 'Rolled once due to equipment shortage' })
    mk('delivery_orders', { job_id: jobs.unbilled.id, issued_to_id: nordic, status: 'Released', freight_cleared: true, original_bl_received: true, valid_until: d(-8) })
    mk('transport_orders', { customer_id: nordic, job_id: jobs.unbilled.id, type: 'Delivery', status: 'POD received', vehicle_id: q.val<number>(`SELECT id FROM vehicles ORDER BY id LIMIT 1`), driver_id: q.val<number>(`SELECT id FROM drivers ORDER BY id LIMIT 1`), pickup_location: 'DXB Cargo Village', delivery_location: 'Nordic Machinery Lab, DIP', pickup_at: `${d(-12)}T09:00`, distance_km: 34, rate: 420, cost: 260, pod_signed_by: 'Hamdan Al Ketbi', pod_at: `${d(-11)}T15:00` })
  })
  step('claims', () => {
    mk('claims', { job_id: jobs.delayed.id, customer_id: gulf, type: 'Delay', status: 'Under investigation', incident_date: d(-4), claim_amount: 6500, liable_party: 'Carrier', description: 'Customer claims penalty from buyer for late arrival in Lagos.' })
    mk('claims', { job_id: q.val<number>(`SELECT id FROM jobs WHERE department = 'FCL IMPORT' AND deleted_at IS NULL ORDER BY id LIMIT 1`)!, customer_id: emerald, type: 'Damage', status: 'Submitted to insurer', incident_date: d(-18), claim_amount: 14200, settled_amount: 0, insurer: 'Demo Insurance Co.', insurance_ref: 'DEMO-CLM-0331', description: '6 cartons crushed in transit. Survey report attached.' })
    mk('insurance_certs', { job_id: jobs.reefer.id, customer_id: sahara, insurer: 'Demo Insurance Co.', policy_no: 'OPEN-0092', cover_type: 'Air cargo all risks', voyage: 'Dubai → Johannesburg', currency: 'USD', insured_value: 85000, rate_pct: 0.18, premium: 153, cover_from: d(1), cover_to: d(10), commodity: 'Vaccines' })
  })

  // ---------------------------------------------------------------- quotations in every state
  step('quotes', () => {
    const lines = (cost: number) => [{ charge_code_id: cc('FRT-OCN'), qty: 1, rate: 3000, cost_rate: cost }]
    const q1 = mk('quotations', { customer_id: atlas, mode: 'Ocean FCL', trade: 'Export', pol_id: loc('AEJEA'), pod_id: loc('NGLOS'), currency: 'USD', ex_rate: 3.6725, commodity: 'Auto spare parts', children: { lines: lines(2860) } })   // thin margin → approval needed
    approvalAction('quotations', q1.id, 'request', undefined, ctx)
    const q2 = mk('quotations', { customer_id: cape, mode: 'Ocean LCL', pol_id: loc('AEJEA'), pod_id: loc('ZADUR') ?? loc('ZAJNB'), currency: 'USD', ex_rate: 3.6725, children: { lines: lines(2400) } }); patchRecord(getDef('quotations'), q2.id, { status: 'Rejected', rejection_reason: 'Customer found a lower price from a competitor' }, ctx)
    const q3 = mk('quotations', { customer_id: sahara, mode: 'Air', currency: 'AED', quote_date: d(-40), valid_until: d(-26), children: { lines: [{ charge_code_id: cc('FRT-AIR'), qty: 200, rate: 7.4, cost_rate: 5.9 }] } }); patchRecord(getDef('quotations'), q3.id, { status: 'Expired' }, ctx)
  })

  // ---------------------------------------------------------------- warehouse: low stock + near-expiry lot + draft GRN
  step('warehouse', () => {
    const wh = q.val<number>(`SELECT id FROM warehouses LIMIT 1`)!, bin = q.val<number>(`SELECT id FROM wh_locations LIMIT 1`)!
    const it = mk('items', { sku: 'ELC-3300', name: 'Cold-chain gel packs (box of 24)', customer_id: sahara, min_stock: 200, track_lot: true })
    mk('grns', { warehouse_id: wh, customer_id: sahara, delivery_note: 'DN-99010', vehicle_no: 'AUH T 8812', children: { lines: [{ item_id: it.id, qty: 60, location_id: bin, lot_no: 'GP-001', expiry_date: d(20) }] } })    // draft receipt
  })

  // ---------------------------------------------------------------- HR: payroll for last month ready for WPS, leave, attendance, expiring documents
  step('hr', () => {
    const dept = (c: string) => idBy('departments', 'code', c)!
    const emps: [string, string, string, number, number, string][] = [['Layla Hassan', 'Sales Executive', 'SAL', 9000, 3000, '1'], ['Omar Farouk', 'Operations Executive', 'OPS', 8500, 2800, '2'], ['Priya Nair', 'Accountant', 'ACC', 9500, 3200, '3'], ['Khalid Al Mazrouei', 'Warehouse Supervisor', 'WHS', 6500, 2200, '4'], ['Sara Thomas', 'HR & Admin Officer', 'HR', 8000, 2600, '5']]
    emps.forEach(([name, des, dp, basic, allow, n], i) => mk('employees', { name, designation: des, department_id: dept(dp), branch_id: dxb, user_id: user(name.split(' ')[0]), join_date: d(-200 - i * 90), basic_salary: basic, housing_allowance: allow * 0.6, transport_allowance: allow * 0.25, other_allowance: allow * 0.15, status: 'Active', bank_iban: 'AE0703312345678901234' + n + '0', bank_routing_code: '123456789', bank_name: 'Demo Bank', mol_person_id: '1000000000000' + n, labour_card_no: '1000000000000' + n, visa_expiry: d(15 + i * 40), eid_expiry: d(60 + i * 30), passport_expiry: d(300 + i * 50), nationality: ['Egyptian', 'Jordanian', 'Indian', 'Emirati', 'Filipino'][i] }))
    const prev = new Date(); prev.setMonth(prev.getMonth() - 1); const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    q.run(`UPDATE employees SET bank_iban = 'AE070331234567890123490', bank_routing_code = '123456789', bank_name = 'Demo Bank', mol_person_id = '10000000000009', labour_card_no = '10000000000009' WHERE bank_iban IS NULL OR bank_iban = ''`)
    generatePayroll(period, ctx)
    q.run(`UPDATE payslips SET status = 'Approved' WHERE period = ?`, period)
    buildWps(period, { save: true })
    const e = (n: string) => q.val<number>(`SELECT id FROM employees WHERE name LIKE ?`, n + '%')!
    mk('leave_requests', { employee_id: e('Omar'), type: 'Annual', from_date: d(14), to_date: d(21), days: 6, reason: 'Family travel' })
    const lr = mk('leave_requests', { employee_id: e('Priya'), type: 'Sick', ...demoSickLeaveDates(today), reason: 'Medical certificate attached' }); patchRecord(getDef('leave_requests'), lr.id, { status: 'Approved', approver_id: sara }, ctx)
    for (let k = 1; k <= 5; k++) for (const n of ['Layla', 'Omar', 'Priya', 'Khalid']) { try { mk('attendance', { employee_id: e(n), att_date: d(-k), check_in: `${d(-k)}T08:${50 - k}`, check_out: `${d(-k)}T17:${10 + k}`, status: k === 3 && n === 'Omar' ? 'Late' : 'Present' }) } catch { /* weekends or duplicates */ } }
    mk('fixed_assets', { name: 'Isuzu NPR 7-ton truck DXB K 44721', category: 'Vehicles', purchase_date: d(-500), cost: 145000, life_years: 7, salvage_value: 20000, vendor_id: v1, warranty_expiry: d(220), next_maintenance: d(35) })
    const po = mk('purchase_orders', { vendor_id: v4, po_date: d(-4), expected_date: d(6), requested_by: omar, children: { lines: [{ description: 'Pallets (EUR) × 200', qty: 200, rate: 32, vat_pct: 5 }, { description: 'Stretch wrap rolls', qty: 120, rate: 14, vat_pct: 5 }] } })
    approvalAction('purchase_orders', po.id, 'request', undefined, ctx)
  })

  // ---------------------------------------------------------------- support, projects, tasks, CRM extras
  step('support', () => {
    const t = (subject: string, type: string, pr: string, status: string, p: number, extra: Rec = {}) => mk('tickets', { subject, type, priority: pr, status, customer_id: p, assigned_to: omar, description: subject, ...extra })
    t('Invoice amount differs from quotation', 'Billing dispute', 'Medium', 'In progress', gulf); t('Cargo damage on arrival – 6 cartons', 'Cargo damage', 'Urgent', 'Open', emerald); t('Need copy of signed POD', 'Service request', 'Low', 'Resolved', nordic, { resolution: 'POD e-mailed on request.' }); t('Where is my container?', 'Query', 'Medium', 'Waiting on customer', atlas)
    const pr = mk('projects', { name: 'Mombasa project cargo – 4 × 40ft flat racks', customer_id: emerald, manager_id: omar, status: 'Active', start_date: d(-14), end_date: d(40), budget: 180000, description: 'Heavy equipment shipment with lashing survey and port permits.' })
    for (const [title, st, due, who] of [['Obtain port permit', 'Done', -10, omar], ['Lashing and securing plan', 'In progress', 3, omar], ['Book heavy-lift trucks', 'To do', 6, khalid], ['Customs pre-clearance', 'Blocked', 9, omar], ['Insurance certificate', 'To do', 12, priya]] as const) mk('tasks', { title, status: st, due_date: d(due), assignee_id: who, project_id: pr.id, priority: st === 'Blocked' ? 'High' : 'Medium' })
    mk('tasks', { title: 'Renew Jebel Ali gate pass for 3 drivers', due_date: d(-2), assignee_id: omar, priority: 'Urgent', kind: 'Document chase' })
    mk('tasks', { title: 'Collect cheque from Sahara Pharma', due_date: d(0), assignee_id: priya, kind: 'Payment reminder', priority: 'High' })
    mk('campaigns', { name: 'Ramadan service reminder (e-mail)', type: 'E-mail', status: 'Completed', start_date: d(-90), end_date: d(-60), budget: 3500, owner_id: layla })
  })

  // ---------------------------------------------------------------- automation, custom fields, announcements, documents
  step('platform', () => {
    mk('automation_rules', { name: 'Delivered job → task for accounts to invoice', entity: 'jobs', trigger: 'Status / stage changed to', field: 'job_status', value: 'DELIVERED', action: 'Create follow-up task', assignee_id: priya, message: 'Invoice delivered job {job_no}', due_days: 1, active: true })
    mk('automation_rules', { name: 'Quotation sent → follow-up in 3 days', entity: 'quotations', trigger: 'Status / stage changed to', field: 'status', value: 'Sent', action: 'Create follow-up task', assignee_id: layla, message: 'Follow up quotation {quote_no}', due_days: 3, active: true })
    mk('automation_rules', { name: 'New ticket → notify operations manager', entity: 'tickets', trigger: 'Record created', action: 'Notify user', assignee_id: omar, message: 'New ticket {ticket_no}: {subject}', active: true })
    mk('custom_fields', { entity: 'jobs', name: 'customer_po_date', label: 'Customer PO date', type: 'date', sort: 10 })
    mk('announcements', { title: 'Peak season surcharge notice – Far East trade', category: 'Carrier notice', pinned: true, body: 'Several carriers have announced a peak season surcharge. Sales: reflect it in new quotations and inform key accounts.' })
    mk('announcements', { title: 'Public holiday – cut-off times', category: 'Holiday', body: 'Gate and documentation cut-offs move one day earlier around the public holiday. Operations will confirm per booking.' })
    mk('announcements', { title: 'New SOP: verified gross mass (VGM) submission', category: 'Training / SOP', body: 'All FCL export bookings must have the VGM submitted before the carrier cut-off. See the document library for the checklist.' })
    mk('webhooks', { name: 'Customer ERP – shipment updates', url: 'https://erp.example.invalid/hooks/elvora', events: 'jobs.updated,invoices.posted', active: true, last_status: '200', last_delivery_at: nowLocal() })
    fs.mkdirSync(path.join(dirs.uploads, 'demo'), { recursive: true })
    const pdf = (title: string) => `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 20 100 Td (${title} - demo document) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`
    const doc = (name: string, cat: string, expiry: string | null, entity?: string, id?: number, label?: string) => { const stored = 'demo/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf'; fs.writeFileSync(path.join(dirs.uploads, stored), pdf(name)); ins('attachments', { file_name: name + '.pdf', stored_name: stored, size: 400, mime: 'application/pdf', category: cat, expiry_date: expiry, link_entity: entity ?? null, link_id: id ?? null, link_label: label ?? null, doc_version: 1 }) }
    doc('Trade licence (demo)', 'Licence / Permit', d(24)); doc('Cargo insurance open policy (demo)', 'Insurance', d(75)); doc('Bill of lading copy', 'Bill of Lading', null, 'jobs', jobs.delayed.id, jobs.delayed.job_no); doc('Customer KYC pack – Sahara Pharma', 'KYC', d(140), 'parties', sahara, 'Sahara Pharma Distribution'); doc('Phytosanitary certificate request', 'Customs', null, 'jobs', jobs.hold.id, jobs.hold.job_no)
    for (const [t, b] of [['Quotation Q – follow up', 'Comment: customer asked for a revised transit time. Sent updated schedule.'], ['', '']]) if (t) q.run(`INSERT INTO comments(entity, record_id, user_id, body, created_at) VALUES ('jobs', ?, ?, ?, ?)`, jobs.delayed.id, omar, b, new Date().toISOString())
    q.run(`INSERT INTO comments(entity, record_id, user_id, body, created_at) VALUES ('jobs', ?, ?, ?, ?)`, jobs.hold.id, layla, 'Customer confirms the certificate will be e-mailed today. Broker is on standby.', new Date().toISOString())
  })

  // ---------------------------------------------------------------- AI team, WhatsApp, integration log, notifications
  step('ai', () => {
    q.run(`UPDATE ai_agents SET active = 1 WHERE role_key IN ('jarvis','collections','sales','operations','finance')`)
    const agent = (k: string) => q.val<number>(`SELECT id FROM ai_agents WHERE role_key = ?`, k)!
    const run = (k: string, trig: string, hrs: number, input: string, out: string, steps: number) => { const at = new Date(Date.now() - hrs * 3600_000).toLocaleString('sv-SE', { timeZone: 'Asia/Dubai' }).slice(0, 16).replace(' ', 'T'); const id = ins('ai_runs', { agent_id: agent(k), started_at: at, trigger: trig, status: 'ok', input, output: out, steps, tokens: 1400 + steps * 220, model: 'demo-assistant' }); q.run(`UPDATE ai_agents SET last_run_at = ?, last_status = 'ok' WHERE id = ?`, at, agent(k)); return id }
    const sn = businessSnapshot().data, f = (n: number) => Math.round(n).toLocaleString('en-US')
    const brief = run('jarvis', 'schedule', 2, 'Run your standing routine now.', `Good morning. Three things need you today:\n• Cash: AED ${f(sn.cash_aed)} in bank; AED ${f(sn.ar_overdue_aed)} of receivables are overdue across ${sn.overdue_invoices} invoices (Sahara Pharma is the oldest).\n• Shipments: the Lagos vessel is running 5 days late (Gulf Textile) and a rice container is on customs hold with free time ending in 2 days. AED ${f(sn.unbilled_revenue_aed)} of delivered work is not yet invoiced.\n• Sales: ${sn.new_leads} new leads, and the Atlas quotation is waiting for your margin approval.\nNext actions: approve the Atlas quote, call Sahara Pharma, and ask the broker to send the phytosanitary certificate today.`, 6)
    const coll = run('collections', 'schedule', 3, 'Run your standing routine now.', 'Reviewed 4 overdue customers.\n• Atlas Auto Parts – 22 days overdue, friendly reminder drafted (waiting for your approval).\n• Sahara Pharma – 95+ days overdue, escalated: task created for the general manager instead of messaging.\nNo duplicate reminders were sent in the last 7 days.', 5)
    run('operations', 'schedule', 5, 'Run your standing routine now.', 'Found 3 problems: Delayed vessel (Gulf Textile) – task created to chase the carrier; Rice container free time ends in 2 days – alert sent; Nordic Machinery job delivered but not yet invoiced – task created for accounts.', 4)
    ins('ai_actions', { agent_id: agent('collections'), run_id: coll, tool: 'send_email', summary: 'E-mail to ap@atlasauto.example: Friendly reminder – invoice overdue', args: { to: 'ap@atlasauto.example', subject: 'Friendly reminder – invoice overdue', body: 'Dear Atlas team,\n\nA friendly reminder that your invoice is past its due date. A copy is attached. If payment has been made, please send the transfer reference.\n\nKind regards,\nElvora Shipping' }, status: 'Pending', created: nowLocal() })
    ins('ai_actions', { agent_id: agent('collections'), run_id: coll, tool: 'send_whatsapp', summary: 'WhatsApp to Gulf Textile: payment reminder for current invoice', args: { to: 'Gulf Textile', text: 'Dear Gulf Textile, a gentle reminder that your invoice is due soon. Thank you – Elvora Shipping.' }, status: 'Pending', created: nowLocal() })
    ins('ai_actions', { agent_id: agent('operations'), tool: 'create_task', summary: 'Create task: Chase carrier on delayed vessel', args: { title: 'Chase carrier on delayed vessel' }, status: 'Executed', result: '{"created":"Chase carrier on delayed vessel"}', created: nowLocal(), decided_at: nowLocal() })
    void brief
  })
  step('whatsapp', () => {
    const m = (hrsAgo: number, dir: string, wa: string, name: string, body: string, origin: string, extra: Rec = {}) => ins('whatsapp_messages', { at: new Date(Date.now() - hrsAgo * 3600_000).toLocaleString('sv-SE', { timeZone: 'Asia/Dubai' }).slice(0, 16).replace(' ', 'T'), direction: dir, wa_id: wa, contact_name: name, body, status: dir === 'in' ? 'received' : 'read', origin, ...extra })
    const lead = q.val<number>(`SELECT id FROM leads ORDER BY id LIMIT 1`)
    m(26, 'in', '971555010101', 'Desert Rose Cosmetics', 'Hi, we need a quote for 2 x 20ft from Jebel Ali to Mombasa, cargo ready next week', 'unknown', { lead_id: lead })
    m(26, 'out', '971555010101', 'Desert Rose Cosmetics', 'Hello, thank you for contacting Elvora Shipping. We have received your enquiry and a specialist will get back to you shortly.', 'bot', { lead_id: lead })
    m(25, 'out', '971555010101', 'Desert Rose Cosmetics', 'Hi Fatima, this is Layla from Elvora. Could you share the commodity, weight and ready date? I will send the quotation today.', 'manual', { lead_id: lead })
    m(24, 'in', '971555010101', 'Desert Rose Cosmetics', 'Cosmetics, about 18 tons, ready on the 14th', 'unknown', { lead_id: lead })
    m(5, 'in', '971504221950', 'Mariam Al Suwaidi', 'track DXB09260001', 'customer', { party_id: gulf })
    m(5, 'out', '971504221950', 'Mariam Al Suwaidi', 'Job DXB09260001 – IN PROGRESS\nAEJEA → NGLOS  ETA 2026-10-25\n• Vessel departed – Jebel Ali', 'bot', { party_id: gulf })
    m(2, 'in', '971500000001', 'Owner', 'report', 'staff'); m(2, 'out', '971500000001', 'Owner', businessSnapshot().text, 'staff command')
  })
  step('integration-log', () => {
    logIntegration('tracking', 'event', true, 'Carrier event: vessel arrived at Lagos', { demo: true })
    logIntegration('e-invoice', 'submit', true, 'Tax invoice submitted to provider (demo)', { reference: 'ASP-DEMO' })
    logIntegration('edi', 'http', true, 'IFTMIN transmitted to partner endpoint (demo)')
    logIntegration('supabase', 'sync', true, 'Mirrored 1,248 rows across 93 tables (demo)')
    logIntegration('bank', 'feed', true, 'Imported 6 lines (0 duplicates skipped), auto-matched 3')
    logIntegration('whatsapp', 'send', false, 'Send to 971500000009 failed: outside 24-hour window – template required (demo)')
  })
  step('notifications', () => {
    notify(me, 'Quotation awaiting your margin approval', 'Atlas Auto Parts – margin below minimum', '/e/quotations', 'approval')
    notify(me, '2 AI actions need your approval', 'Collections Agent has drafted messages', '/ai?tab=approvals', 'approval')
    notify(me, 'Free time ending in 2 days', 'Container TCLU5528834 – rice import on customs hold', jobs.hold ? `/jobs/${jobs.hold.id}` : '/', 'alert')
    notify(me, 'Visa expiring in 15 days', 'Layla Hassan – residence visa', '/e/employees', 'alert')
  })
}
void todayStr

