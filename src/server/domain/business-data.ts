/**
 * Business-data reset and the Elvora starter data set.
 *
 * "Business data" = everything customers, jobs and money create: CRM, quotations, jobs and their documents, customs, transport orders,
 * warehouse stock, invoices, bills, receipts, payments, bank statement lines, the ledger postings they made, support cases and the
 * tasks, comments and files attached to them. Configuration is never touched: users, roles, branches, chart of accounts, VAT codes,
 * currencies, ports, carriers, charge codes, employees, vehicles, licences, templates, integrations and settings.
 */
import fs from 'node:fs'
import path from 'node:path'
import { db, q, tx, inDemo, qi, tableExists } from '../db'
import { dirs, BACKUP_EXT } from '../config'
import { ENTITIES } from '../../shared/entities'
import { audit, createRecord, getDef, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { getSetting, setSettings, SETTING_DEFAULTS } from '../settings'
import { bad, nowIso } from '../util'
import { postInvoice, setNextInvoiceNumber } from './finance'

/** Top-level record types removed by a reset. Their child (line) tables are added automatically. */
export const BUSINESS_ENTITIES: { group: string; keys: string[] }[] = [
  { group: 'Customers, CRM and sales', keys: ['parties', 'contacts', 'campaigns', 'leads', 'opportunities', 'activities', 'whatsapp_messages', 'rate_cards', 'quotations', 'contracts', 'carrier_rfqs', 'rfq_offers'] },
  { group: 'Jobs and shipments', keys: ['jobs', 'shipments', 'bookings', 'delivery_orders', 'vendor_services', 'customs_declarations', 'transport_orders', 'freight_documents', 'freight_document_versions', 'document_originals', 'document_custody_events', 'document_extractions'] },
  { group: 'Invoices, bills and banking', keys: ['invoices', 'bills', 'receipts', 'payments', 'bank_transactions', 'expenses', 'container_deposits', 'container_deposit_events', 'purchase_orders'] },
  { group: 'Warehouse stock', keys: ['items', 'stock_moves', 'grns', 'dispatches'] },
  { group: 'Support, work and AI activity', keys: ['tickets', 'claims', 'insurance_certs', 'tasks', 'work_items', 'shift_handovers', 'ai_runs', 'ai_actions', 'workflow_runs', 'email_outbox'] },
]

const SYSTEM_TABLES_BY_RECORD = ['comments', 'record_refs', 'record_tags', 'record_links', 'record_likes', 'video_calls']
/** Ledger entries created by these sources are manual company entries, not customer or job postings: they stay. */
const KEPT_JOURNAL_SOURCES = ['Manual', 'Year-end close']

export function businessTables(): string[] {
  const seen = new Set<string>()
  const add = (key: string) => {
    const def = ENTITIES[key]
    if (!def || seen.has(key)) return
    seen.add(key)
    for (const c of def.children ?? []) add(c.entity)
  }
  for (const g of BUSINESS_ENTITIES) for (const k of g.keys) add(k)
  return [...seen].filter(tableExists)
}

export interface ResetSummary { group: string; table: string; label: string; count: number }
export function businessDataSummary(): { rows: ResetSummary[]; journals: number; total: number } {
  const rows: ResetSummary[] = []
  const wanted = new Set(businessTables())
  for (const g of BUSINESS_ENTITIES) {
    const keys = new Set<string>()
    const walk = (k: string) => { if (!ENTITIES[k] || keys.has(k)) return; keys.add(k); for (const c of ENTITIES[k].children ?? []) walk(c.entity) }
    g.keys.forEach(walk)
    for (const k of keys) if (wanted.has(k) && !ENTITIES[k].child) rows.push({ group: g.group, table: k, label: ENTITIES[k].plural, count: q.val<number>(`SELECT COUNT(*) FROM ${qi(k)} WHERE deleted_at IS NULL`) ?? 0 })
  }
  const linkedDocs = q.val<number>(`SELECT COUNT(*) FROM studio_documents WHERE deleted_at IS NULL AND (party_id IS NOT NULL OR job_id IS NOT NULL)`) ?? 0
  rows.push({ group: 'Customers, CRM and sales', table: 'studio_documents', label: 'Studio documents written for a customer or job', count: linkedDocs })
  const journals = q.val<number>(`SELECT COUNT(*) FROM journal_entries WHERE deleted_at IS NULL AND ${journalCondition()}`, ...KEPT_JOURNAL_SOURCES, ...KEPT_JOURNAL_SOURCES) ?? 0
  return { rows, journals, total: rows.reduce((s, r) => s + r.count, 0) + journals }
}

const journalCondition = () => `source_type NOT IN (${KEPT_JOURNAL_SOURCES.map(() => '?').join(',')}) AND NOT (source_type = 'Reversal' AND source_id IN (SELECT id FROM journal_entries WHERE source_type IN (${KEPT_JOURNAL_SOURCES.map(() => '?').join(',')})))`

/** Snapshot of the current database before anything is removed. Returns the file name inside the backups folder. */
export async function backupBeforeReset(label = 'before-reset'): Promise<string> {
  const name = `elvora-${label}-${nowIso().replace(/[:.]/g, '-').slice(0, 19)}${BACKUP_EXT}`
  fs.mkdirSync(dirs.backups, { recursive: true })
  await db.backup(path.join(dirs.backups, name))
  return name
}

export interface ResetResult { backup: string; deleted: Record<string, number>; files_removed: number; total: number }

/** Removes all business data (see file header) in one transaction. Uploaded files linked to removed records are deleted from local storage. */
export async function resetBusinessData(ctx: Ctx, opts: { backup?: boolean } = {}): Promise<ResetResult> {
  if (inDemo()) throw bad('The demo workspace cannot be reset here. Use “Reset demo now”.')
  const backup = opts.backup === false ? '' : await backupBeforeReset()
  const tables = businessTables()
  const top = [...new Set(BUSINESS_ENTITIES.flatMap(g => g.keys))].filter(k => ENTITIES[k])
  const deleted: Record<string, number> = {}
  let files = 0
  const stored: string[] = []
  tx(() => {
    // polymorphic rows pointing at removed records
    if (tableExists('attachments')) {
      for (const f of q.all<{ stored_name: string }>(`SELECT stored_name FROM attachments WHERE link_entity IN (${top.map(() => '?').join(',')})`, ...top)) stored.push(f.stored_name)
      deleted.attachments = q.run(`DELETE FROM attachments WHERE link_entity IN (${top.map(() => '?').join(',')})`, ...top).changes
    }
    for (const t of SYSTEM_TABLES_BY_RECORD) deleted[t] = q.run(`DELETE FROM ${qi(t)} WHERE entity IN (${top.map(() => '?').join(',')})`, ...top).changes
    deleted.compliance_exceptions = q.run(`DELETE FROM compliance_exceptions WHERE link_entity IN (${top.map(() => '?').join(',')})`, ...top).changes
    deleted.notifications = q.run(`DELETE FROM notifications`).changes
    for (const t of ['job_tracking_tokens', 'job_closure_evidence', 'job_reopen_requests', 'approval_requests']) deleted[t] = q.run(`DELETE FROM ${qi(t)}`).changes
    // the ledger: postings made by documents go; manual and year-end entries stay but lose their links to removed parties and jobs
    const cond = journalCondition(), args = [...KEPT_JOURNAL_SOURCES, ...KEPT_JOURNAL_SOURCES]
    q.run(`DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE ${cond})`, ...args)
    deleted.journal_entries = q.run(`DELETE FROM journal_entries WHERE ${cond}`, ...args).changes
    q.run(`UPDATE journal_lines SET party_id = NULL, job_id = NULL WHERE party_id IS NOT NULL OR job_id IS NOT NULL`)
    // the records themselves, children first
    for (const t of tables) {
      if (ENTITIES[t].child) deleted[t] = q.run(`DELETE FROM ${qi(t)}`).changes
    }
    for (const t of tables) {
      if (!ENTITIES[t].child) deleted[t] = q.run(`DELETE FROM ${qi(t)}`).changes
    }
    // documents written in the Document Studio for a customer or a job go too; company-level documents and templates stay
    deleted.studio_documents = q.run(`DELETE FROM studio_documents WHERE party_id IS NOT NULL OR job_id IS NOT NULL`).changes
    for (const t of SYSTEM_TABLES_BY_RECORD) q.run(`DELETE FROM ${qi(t)} WHERE entity = 'studio_documents' AND record_id NOT IN (SELECT id FROM studio_documents)`)
    for (const f of q.all<{ stored_name: string }>(`SELECT stored_name FROM attachments WHERE link_entity = 'studio_documents' AND link_id NOT IN (SELECT id FROM studio_documents)`)) stored.push(f.stored_name)
    q.run(`DELETE FROM attachments WHERE link_entity = 'studio_documents' AND link_id NOT IN (SELECT id FROM studio_documents)`)
    // numbering starts again from 1 for removed record types
    for (const t of tables) q.run(`DELETE FROM sequences WHERE key LIKE ?`, `${t}|%`)
    q.run(`DELETE FROM sequences WHERE key LIKE 'invoices:series|%'`)
    setSettings({ lock_date: '' })
    q.run(`DELETE FROM settings WHERE key = ?`, MARK)
    audit(ctx, getDef('branches'), 0, 'business-reset', { removed: [null, Object.values(deleted).reduce((s, n) => s + n, 0)], backup: [null, backup || 'none'] }, 'Business data reset')
  })
  for (const s of stored) {
    if (!s || s.includes('..') || path.isAbsolute(s) || /^[a-z]+:/i.test(s)) continue
    try { fs.rmSync(path.join(dirs.uploads, s), { force: true }); files++ } catch { /* object storage or already gone */ }
  }
  return { backup, deleted, files_removed: files, total: Object.values(deleted).reduce((s, n) => s + n, 0) }
}

// =====================================================================================================================
// Elvora starter data – the customer, shipments and four invoices supplied by the company (ES101, ES101A, ES102, ES102A).
// =====================================================================================================================
export const STARTER_MARK = 'seed:elvora-starter-2026'
/** Set when business data was cleared on purpose without reloading the starter set, so a restart does not bring it back. */
export const STARTER_DECLINED = 'seed:elvora-starter-declined'
const MARK = STARTER_MARK
const hasKey = (k: string) => !!q.val(`SELECT 1 FROM settings WHERE key = ?`, k)
export const starterLoaded = () => hasKey(MARK)
export const starterDeclined = () => hasKey(STARTER_DECLINED)
export const declineStarter = () => q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO NOTHING`, STARTER_DECLINED, nowIso())
export const clearStarterDeclined = () => q.run(`DELETE FROM settings WHERE key = ?`, STARTER_DECLINED)

interface StarterLine { desc: string; code: string; ccy: 'USD'; rate: number; qty: number }
interface StarterInvoice { no: string; date: string; job: 0 | 1; lines: StarterLine[]; round: boolean; ship: Record<string, string> }

const ROE = 3.685
const JOB1_SHIP = { ship_bl_no: 'BLJEA260800136', ship_vessel: 'ESL BUSAN', ship_receipt: 'Lat Krabang', ship_destination: 'Jebel Ali', ship_weight: '31,629.75 KGS', ship_containers: "CAAU4171016 / 40' | BMOU9822371 / 40'" }
const JOB2_SHIP = { ship_bl_no: 'CSSLCHJEA20262535', ship_receipt: 'Lat Krabang, Thailand', ship_pol: 'Laem Chabang, Thailand', ship_pod: 'Khorfakkan, UAE', ship_destination: 'Jebel Ali, UAE', ship_cargo: "2 x 40' HQ | 2,520 cartons assorted candy", ship_hs_code: '1704.90.30', ship_containers: 'DFSU6712958 | DFSU6496545' }
const ORIGIN_CHARGES: StarterLine[] = [
  { desc: 'Empty container transport charge', code: 'EMPTY-TR', ccy: 'USD', rate: 260, qty: 2 }, { desc: 'Laden export transport charge', code: 'LADEN-TR', ccy: 'USD', rate: 345, qty: 2 },
  { desc: 'BL charge', code: 'BLF', ccy: 'USD', rate: 392, qty: 1 }, { desc: 'BL surrender charge', code: 'BL-SURR', ccy: 'USD', rate: 48, qty: 1 },
]
export const STARTER_INVOICES: StarterInvoice[] = [
  { no: 'DXB/IMP/ES101', date: '2026-09-04', job: 0, round: true, ship: JOB1_SHIP, lines: [
    { desc: 'Ocean freight', code: 'FRT-OCN', ccy: 'USD', rate: 10454, qty: 2 }, { desc: 'Drop-off charges', code: 'DROP-OFF', ccy: 'USD', rate: 1200, qty: 2 }, { desc: 'PSS charges', code: 'PSS', ccy: 'USD', rate: 50, qty: 2 }] },
  { no: 'DXB/IMP/ES101A', date: '2026-09-07', job: 0, round: true, ship: JOB1_SHIP, lines: ORIGIN_CHARGES },
  { no: 'DXB/IMP/ES102', date: '2026-10-15', job: 1, round: false, ship: JOB2_SHIP, lines: [
    { desc: 'Ocean freight - includes drop-off', code: 'FRT-OCN', ccy: 'USD', rate: 8600, qty: 2 }, { desc: 'PS charge', code: 'PSS', ccy: 'USD', rate: 50, qty: 2 }, { desc: 'Khorfakkan port congestion charge', code: 'PORT-CONG', ccy: 'USD', rate: 450, qty: 2 }] },
  { no: 'DXB/IMP/ES102A', date: '2026-10-15', job: 1, round: false, ship: JOB2_SHIP, lines: ORIGIN_CHARGES },
]

const ref = (table: string, col: string, val: string) => q.val<number>(`SELECT id FROM ${qi(table)} WHERE ${qi(col)} = ? AND deleted_at IS NULL`, val)

function ensureCharge(code: string, name: string, group: string, uom: string, inc: string, cost: string) {
  if (ref('charge_codes', 'code', code)) return
  createRecord(getDef('charge_codes'), { code, name, applies_to: 'Revenue & cost', group, uom_id: ref('uoms', 'code', uom), vat_code_id: ref('vat_codes', 'code', 'ZR'), income_account_id: ref('accounts', 'code', inc), cost_account_id: ref('accounts', 'code', cost), active: true }, SYSTEM_CTX)
}

/**
 * Loads the company profile defaults, the customer MAM Trading Group LLC, its two import jobs and the four issued invoices.
 * Idempotent: does nothing when already loaded. Existing company settings that were changed by the company are never overwritten.
 */
export function loadElvoraStarterData(ctx: Ctx = SYSTEM_CTX): { loaded: boolean; customer?: number; jobs?: number[]; invoices?: number[]; reason?: string } {
  if (inDemo()) return { loaded: false, reason: 'demo workspace' }
  if (starterLoaded()) return { loaded: false, reason: 'already loaded' }
  const existing = q.val<number>(`SELECT id FROM parties WHERE deleted_at IS NULL AND (trn = '101268312400003' OR lower(name) LIKE 'mam trading group%') LIMIT 1`)
  if (existing) { q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO NOTHING`, MARK, nowIso()); return { loaded: false, reason: 'customer already exists' } }
  return tx(() => {
    const sys: Ctx = { ...SYSTEM_CTX, user: ctx.user, ip: ctx.ip }
    const mk = (e: string, p: Rec): Rec => createRecord(getDef(e), p, sys)

    // ---- company profile (only fills what is still at the factory default)
    const patch: Record<string, any> = {}
    if (!getSetting('company_phone')) patch.company_phone = '+971 50 422 1950'
    if (!getSetting('company_email')) patch.company_email = 'sales@elvorashipping.com'
    if (!getSetting('company_website')) patch.company_website = 'https://www.elvorashipping.com'
    if (getSetting('invoice_no_pattern') === '{prefix}{YY}{seq:5}') patch.invoice_no_pattern = '{branch}/{dir}/ES{seq:3}'
    if (getSetting('invoice_terms') === SETTING_DEFAULTS.invoice_terms) patch.invoice_terms = 'Please notify us of any discrepancies within 5 days of receipt. E&OE.'
    setSettings(patch)

    // ---- master data the invoices rely on (added only when missing)
    ensureCharge('DROP-OFF', 'Drop-off charges', 'Destination charges', 'CNT', '4100', '5100')
    ensureCharge('EMPTY-TR', 'Empty container transport charge', 'Origin charges', 'CNT', '4100', '5100')
    ensureCharge('LADEN-TR', 'Laden export transport charge', 'Origin charges', 'CNT', '4100', '5100')
    ensureCharge('BL-SURR', 'BL surrender charge', 'Documentation', 'BL', '4200', '5200')
    ensureCharge('PORT-CONG', 'Port congestion charge', 'Surcharges', 'CNT', '4000', '5000')
    if (!ref('hs_codes', 'code', '1704.90.30')) mk('hs_codes', { code: '1704.90.30', description: 'Sugar confectionery (candy) not containing cocoa', duty_rate: 5 })
    const uae = ref('countries', 'code', 'AE')!, dxb = ref('branches', 'code', 'DXB')!

    // ---- customer
    const cust = mk('parties', {
      name: 'MAM Trading Group LLC', legal_name: 'MAM TRADING GROUP LLC.', is_customer: true, is_consignee: true, is_notify: true, status: 'Active', trn: '101268312400003', po_box: '5014', city: 'Dubai', country_id: uae,
      phone: '+971 4 2250433', email: 'mamuae@eim.ae', currency: 'AED', kyc_status: 'Pending', industry: 'Trading', source: 'Existing customer',
      notes: "Invoices ES101 and ES101A were issued to “MAM TRADING GROUP”, phone 97142267369. Invoices ES102 and ES102A were issued to “MAM TRADING GROUP LLC.” with the P.O. Box, telephone and e-mail above. Same TRN on all four.",
    })
    mk('contacts', { name: 'MAM Trading Group – main office', party_id: cust.id, email: 'mamuae@eim.ae', phone: '+971 4 2250433', mobile: '+971 4 2267369', is_primary: true, receives_invoices: true, receives_tracking: true, notes: 'Second number 97142267369 appears on invoice ES101. Add the contact person’s name when known.' })

    // ---- jobs
    const common = { client_id: cust.id, branch_id: dxb, department: 'FCL IMPORT', trade: 'Import', consignee_id: cust.id, notify_id: cust.id, service_type: 'Port to Port', operational_status: 'BOOKING CONFIRMED' }
    const zr = ref('vat_codes', 'code', 'ZR')!
    // Revenue charges mirror the invoice lines so the job's income and the invoices stay linked; the supplied documents carry no supplier costs.
    const chargesFor = (jobIdx: number) => STARTER_INVOICES.filter(i => i.job === jobIdx).flatMap(i => i.lines).map(l => ({ kind: 'Revenue', charge_code_id: ref('charge_codes', 'code', l.code), description: l.desc, party_id: cust.id, qty: l.qty, rate: l.rate, currency: l.ccy, ex_rate: ROE, vat_code_id: zr }))
    const ct40 = ref('container_types', 'code', '40GP')!, ct40hc = ref('container_types', 'code', '40HC')!
    const klf = ref('locations', 'code', 'AEKLF'), jea = ref('locations', 'code', 'AEJEA'), lch = ref('locations', 'code', 'THLCH')
    const j1 = mk('jobs', { ...common, job_date: '2026-09-04', job_status: 'IN PROGRESS', mbl_no: 'BLJEA260800136', vessel_name: 'ESL BUSAN', place_of_receipt: 'Lat Krabang', pod_id: jea, commodity: 'As per bill of lading', packages: null, gross_weight: 31629.75, remarks: 'Created from invoices DXB/IMP/ES101 and DXB/IMP/ES101A. Route Lat Krabang – Jebel Ali. Port of loading and cargo description were not on the invoices – complete them from the bill of lading.',
      children: { containers: [{ container_no: 'CAAU4171016', type_id: ct40, status: 'Planned', remarks: "40'" }, { container_no: 'BMOU9822371', type_id: ct40, status: 'Planned', remarks: "40'" }], charges: chargesFor(0) } })
    const j2 = mk('jobs', { ...common, job_date: '2026-10-15', job_status: 'IN PROGRESS', mbl_no: 'CSSLCHJEA20262535', place_of_receipt: 'Lat Krabang, Thailand', pol_id: lch, pod_id: klf, pof_id: jea, place_of_delivery: 'Jebel Ali, UAE', commodity: 'Assorted candy', packages: 2520, package_type: 'Carton',
      remarks: 'Created from invoices DXB/IMP/ES102 and DXB/IMP/ES102A. Receipt Lat Krabang, loading Laem Chabang, discharge Khorfakkan, final destination Jebel Ali.',
      children: { containers: [{ container_no: 'DFSU6712958', type_id: ct40hc, status: 'Planned' }, { container_no: 'DFSU6496545', type_id: ct40hc, status: 'Planned' }], cargo: [{ description: 'Assorted candy', hs_code_id: ref('hs_codes', 'code', '1704.90.30'), packages: 2520, package_type: 'Carton' }], charges: chargesFor(1) } })
    const jobs = [j1, j2]
    for (const [i, j] of jobs.entries()) {
      const boxes = q.all<{ container_no: string }>(`SELECT container_no FROM job_containers WHERE job_id = ? AND deleted_at IS NULL ORDER BY id`, j.id).map(b => b.container_no)
      mk('shipments', { job_id: j.id, consignee_id: cust.id, notify_id: cust.id, hbl_no: null, commodity: i === 0 ? 'As per bill of lading' : 'Assorted candy', packages: i === 0 ? null : 2520, gross_weight: i === 0 ? 31629.75 : null, container_no: boxes.join(', '), status: 'Booked' })
    }

    // ---- invoices (billed in AED; each line keeps its USD price and the rate of exchange 3.685)
    const invoices: number[] = []
    const prevMode = getSetting('compliance_mode')
    const cursor = [0, 0]
    for (const spec of STARTER_INVOICES) {
      const job = jobs[spec.job]
      const chargeIds = q.all<{ id: number }>(`SELECT id FROM job_charges WHERE job_id = ? AND deleted_at IS NULL ORDER BY id`, job.id).map(c => c.id)
      const lines = spec.lines.map((l, i) => ({ charge_code_id: ref('charge_codes', 'code', l.code), description: l.desc, qty: l.qty, rate: l.rate, line_ccy: l.ccy, line_roe: ROE, vat_code_id: zr, job_charge_id: chargeIds[cursor[spec.job] + i] }))
      cursor[spec.job] += spec.lines.length
      const inv = mk('invoices', {
        doc_type: 'Tax Invoice', party_id: cust.id, job_id: job.id, shipment_id: q.val<number>(`SELECT id FROM shipments WHERE job_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1`, job.id), branch_id: dxb, invoice_date: spec.date, currency: 'AED', ex_rate: 1, custom_no: spec.no, trade: 'Import',
        round_total: spec.round ? 'Round total to whole amount' : 'No rounding', notes: 'Please notify us of any discrepancies within 5 days of receipt.\nE&OE.', terms: null, ...spec.ship,
        children: { lines },
      })
      invoices.push(inv.id)
    }
    // Issue them. The company TRN is not on the supplied invoices, so posting runs in advisory mode and the missing-TRN finding stays open as a warning in the Compliance Centre.
    setSettings({ compliance_mode: 'advisory' })
    try {
      for (const id of invoices) postInvoice(id, sys)
    } finally { setSettings({ compliance_mode: prevMode ?? 'enforce' }) }
    setNextInvoiceNumber(103, '2026-10-15')
    q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, MARK, nowIso())
    audit(sys, getDef('parties'), cust.id, 'starter-data', { invoices: [null, STARTER_INVOICES.map(i => i.no).join(', ')] }, cust.name ?? 'MAM Trading Group LLC')
    return { loaded: true, customer: cust.id, jobs: jobs.map(j => j.id), invoices }
  })
}
