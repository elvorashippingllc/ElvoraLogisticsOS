import { q } from '../db'
import { getSetting } from '../settings'
import { addDays, bad, daysBetween, nowIso, todayStr } from '../util'
import { notifyRole } from '../notify'
import type { Hooks, HookArgs } from '../hooks'

// ---------------------------------------------------------------- service ↔ licensed activity map
export interface ServiceInfo { code: string; label: string; requires: string[]; note: string }
/** Services the OS can run. `requires` = service codes that must be covered by an active licensed activity. */
export const SERVICES: ServiceInfo[] = [
  { code: 'SEA_FREIGHT', label: 'Sea freight (FCL / LCL, cross-trade, project cargo by sea)', requires: ['SEA_FREIGHT'], note: 'Covered by “Sea Cargo Services”.' },
  { code: 'CUSTOMS', label: 'Customs clearance', requires: ['CUSTOMS'], note: 'Covered by “Customs Broker”. Dubai Customs registration and guarantee must also be in place.' },
  { code: 'SEA_AGENCY', label: 'Shipping-line agency', requires: ['SEA_AGENCY'], note: 'Covered by “Sea Shipping Lines Agents”; the Dubai Maritime Authority is the follow-up authority on the licence.' },
  { code: 'CARGO_HANDLING', label: 'Cargo loading and unloading', requires: ['CARGO_HANDLING'], note: 'Covered by “Cargo Loading & Unloading Services”. This is handling, not storage.' },
  { code: 'AIR_FREIGHT', label: 'Air freight', requires: ['AIR_FREIGHT'], note: 'Not on the trade licence. Needs an air-cargo / freight-forwarding activity added by DET; carriers may also require IATA cargo-agency terms.' },
  { code: 'ROAD_TRANSPORT', label: 'Road transport / trucking', requires: ['ROAD_TRANSPORT'], note: 'Not on the trade licence. Goods transport normally needs a transport activity and RTA permits for the vehicles – or use a licensed haulier as a subcontractor.' },
  { code: 'WAREHOUSING', label: 'Warehousing / storage', requires: ['WAREHOUSING'], note: 'Not on the trade licence. Needs a warehousing activity and a DET permit for the premises (licence condition 13).' },
  { code: 'COURIER', label: 'Courier / express', requires: ['COURIER'], note: 'Not on the trade licence. Courier activity needs separate approval.' },
  { code: 'MULTIMODAL', label: 'Multimodal (sea + road / air)', requires: ['SEA_FREIGHT', 'ROAD_TRANSPORT'], note: 'Needs sea freight plus the road or air leg to be licensed (or subcontracted to a licensed carrier).' },
]
const SERVICE = Object.fromEntries(SERVICES.map(s => [s.code, s]))
const DEPT: Record<string, string> = {
  'FCL EXPORT': 'SEA_FREIGHT', 'FCL IMPORT': 'SEA_FREIGHT', 'LCL EXPORT': 'SEA_FREIGHT', 'LCL IMPORT': 'SEA_FREIGHT', 'CROSS TRADE': 'SEA_FREIGHT', 'PROJECT CARGO': 'SEA_FREIGHT',
  'AIR EXPORT': 'AIR_FREIGHT', 'AIR IMPORT': 'AIR_FREIGHT', 'ROAD EXPORT': 'ROAD_TRANSPORT', 'ROAD IMPORT': 'ROAD_TRANSPORT', 'CUSTOMS CLEARANCE': 'CUSTOMS', WAREHOUSING: 'WAREHOUSING', COURIER: 'COURIER',
}
const MODE: Record<string, string> = { 'Ocean FCL': 'SEA_FREIGHT', 'Ocean LCL': 'SEA_FREIGHT', Air: 'AIR_FREIGHT', Road: 'ROAD_TRANSPORT', Multimodal: 'MULTIMODAL', 'Customs clearance': 'CUSTOMS', Warehousing: 'WAREHOUSING', 'Project cargo': 'SEA_FREIGHT' }

export function licensedCodes(): Set<string> {
  const out = new Set<string>()
  for (const r of q.all<{ covers: string | null }>(`SELECT covers FROM licence_activities WHERE status = 'Active' AND deleted_at IS NULL`)) for (const c of String(r.covers ?? '').split(',')) if (c.trim()) out.add(c.trim().toUpperCase())
  return out
}
export function missingFor(service: string): string[] {
  const s = SERVICE[service]; if (!s) return []
  const have = licensedCodes()
  return s.requires.filter(c => !have.has(c))
}

// ---------------------------------------------------------------- findings
export interface Finding { rule: string; severity: 'Warning' | 'Blocker'; message: string }
const advisory = () => getSetting('compliance_mode') === 'advisory'
/** In advisory mode nothing blocks – blockers are downgraded to warnings. */
const level = (f: Finding): Finding => (advisory() && f.severity === 'Blocker' ? { ...f, severity: 'Warning' } : f)

/** Insert / refresh open findings for a record and resolve those that no longer apply. Blockers are raised as errors by the caller. */
export function syncFindings(entity: string, id: number, label: string, rules: string[], found: Finding[]) {
  const now = nowIso()
  const keep = new Set(found.map(f => f.rule))
  for (const f of found) {
    const ex = q.get(`SELECT id, status FROM compliance_exceptions WHERE link_entity = ? AND link_id = ? AND rule = ? AND status <> 'Resolved' AND deleted_at IS NULL`, entity, id, f.rule)
    if (ex) q.run(`UPDATE compliance_exceptions SET message = ?, severity = ?, link_label = ?, updated_at = ? WHERE id = ?`, f.message, f.severity, label, now, ex.id)
    else q.run(`INSERT INTO compliance_exceptions(rule, severity, message, link_entity, link_id, link_label, status, detected_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, f.rule, f.severity, f.message, entity, id, label, 'Open', now, now, now)
  }
  for (const r of rules) if (!keep.has(r)) q.run(`UPDATE compliance_exceptions SET status = 'Resolved', updated_at = ? WHERE link_entity = ? AND link_id = ? AND rule = ? AND status <> 'Resolved' AND deleted_at IS NULL`, now, entity, id, r)
}
const blockers = (fs: Finding[]) => fs.filter(f => f.severity === 'Blocker')
export function assertNoBlockers(fs: Finding[]) {
  const b = blockers(fs)
  if (b.length) throw bad(`Compliance: ${b.map(x => x.message).join(' ')}`)
}

// ---------------------------------------------------------------- shared checks
export function tradeLicenceItem() { return q.get(`SELECT * FROM compliance_items WHERE type = 'Trade licence' AND deleted_at IS NULL ORDER BY expiry_date DESC LIMIT 1`) }
function licenceFinding(): Finding | null {
  const it = tradeLicenceItem(), exp = it?.expiry_date || getSetting('licence_expiry_date')
  if (exp && exp < todayStr() && it?.status !== 'Not applicable') return { rule: 'LICENCE_EXPIRED', severity: 'Blocker', message: `The trade licence expired on ${exp}. Renew it with DET before trading.` }
  return null
}
function sanctionsFinding(partyId: number | null | undefined, newParty: boolean): Finding | null {
  if (!partyId) return null
  const p = q.get(`SELECT name, sanctions_status s, sanctions_screened_on d FROM parties WHERE id = ?`, partyId)
  if (!p) return null
  if (p.s === 'Confirmed match') return { rule: 'SANCTIONS', severity: 'Blocker', message: `${p.name} is a confirmed sanctions match. Do not deal – freeze and report as required under the UAE targeted financial sanctions regime.` }
  if (p.s === 'Potential match') return { rule: 'SANCTIONS', severity: 'Warning', message: `${p.name} is a potential sanctions match – hold the transaction until compliance clears or confirms it.` }
  if (newParty && (!p.s || p.s === 'Not screened')) return { rule: 'SANCTIONS', severity: 'Warning', message: `${p.name} has not been screened against the UAE / UN sanctions lists.` }
  const days = Number(getSetting('sanctions_review_days')) || 365
  if (newParty && p.d && daysBetween(p.d, todayStr()) > days) return { rule: 'SANCTIONS', severity: 'Warning', message: `${p.name} was last screened on ${p.d} – re-screen (review cycle ${days} days).` }
  return null
}
function scopeFinding(service: string | undefined): Finding | null {
  const mode = getSetting('activity_scope_mode')
  if (!service || mode === 'off') return null
  const miss = missingFor(service)
  if (!miss.length) return null
  const s = SERVICE[service]
  return { rule: 'SCOPE', severity: mode === 'block' ? 'Blocker' : 'Warning', message: `${s.label} is outside the licensed activities (${miss.map(c => SERVICE[c]?.label ?? c).join(', ')} not covered). ${s.note}` }
}

// ---------------------------------------------------------------- hook wrapper (jobs, quotations, transport, warehouse receipts, invoices)
interface KeyCfg { party?: string; service?: (r: any) => string | undefined; watch?: string[]; label: (r: any) => string }
const CFG: Record<string, KeyCfg> = {
  jobs: { party: 'client_id', service: r => DEPT[r.department], watch: ['department'], label: r => r.job_no },
  quotations: { party: 'customer_id', service: r => MODE[r.mode], watch: ['mode'], label: r => r.quote_no },
  transport_orders: { service: () => 'ROAD_TRANSPORT', label: r => r.order_no ?? `Transport order ${r.id}` },
  grns: { service: () => 'WAREHOUSING', label: r => r.grn_no ?? `GRN ${r.id}` },
  invoices: { party: 'party_id', label: r => r.invoice_no },
}
export const COMPLIANCE_KEYS = new Set(Object.keys(CFG))

function evaluate(key: string, rec: any, old: any, isNew: boolean): { found: Finding[]; rules: string[] } {
  const c = CFG[key], out: Finding[] = [], rules: string[] = []
  const changed = (f: string) => isNew || !old || old[f] !== rec[f]
  if (isNew && key !== 'invoices') { rules.push('LICENCE_EXPIRED'); const l = licenceFinding(); if (l) out.push(l) }
  if (c.service && (isNew || (c.watch ?? []).some(changed))) { rules.push('SCOPE'); const s = scopeFinding(c.service(rec)); if (s) out.push(s) }
  if (c.party && changed(c.party)) { rules.push('SANCTIONS'); const s = sanctionsFinding(rec[c.party], isNew); if (s) out.push(s) }
  return { found: out.map(level), rules }
}

export function withCompliance(key: string, h: Hooks): Hooks {
  const c = CFG[key]
  const pending = new WeakMap<object, { found: Finding[]; rules: string[] }>()
  return {
    ...h,
    beforeSave(a: HookArgs) {
      h.beforeSave?.(a)
      const r = evaluate(key, a.rec, a.old, a.isNew)
      assertNoBlockers(r.found)
      pending.set(a.rec, r)
    },
    afterSave(a: HookArgs) {
      h.afterSave?.(a)
      const r = pending.get(a.rec)
      if (!r) return
      pending.delete(a.rec)
      // Sanctions warnings belong to the party (one finding per party), everything else to this record.
      const sanc = r.found.find(f => f.rule === 'SANCTIONS' && c.party)
      if (sanc && c.party && a.rec[c.party]) {
        const p = q.get(`SELECT name FROM parties WHERE id = ?`, a.rec[c.party])
        syncFindings('parties', a.rec[c.party], p?.name ?? `Party ${a.rec[c.party]}`, [], [sanc])
      }
      syncFindings(key, a.rec.id, c.label(a.rec) || `${key} ${a.rec.id}`, r.rules.filter(x => x !== 'SANCTIONS'), r.found.filter(f => f.rule !== 'SANCTIONS'))
    },
  }
}

// ---------------------------------------------------------------- invoice / bill posting
const TRN = /^\d{15}$/
export function companyTrnFor(branchId: number | null | undefined): string {
  const ent = branchId ? q.get(`SELECT e.trn FROM branches b JOIN legal_entities e ON e.id = b.legal_entity_id WHERE b.id = ?`, branchId) : null
  return String(ent?.trn || getSetting('company_trn') || '').replace(/\s/g, '')
}
const INVOICE_RULES = ['VAT_NOT_REGISTERED', 'SUPPLIER_TRN', 'CUSTOMER_TRN', 'CUSTOMER_ADDRESS', 'CREDIT_REASON', 'CREDIT_REF', 'LATE_ISSUE', 'ZERO_RATE_EVIDENCE', 'SANCTIONS', 'LICENCE_EXPIRED']
/** UAE tax-invoice rules (Federal Decree-Law 8/2017 and Cabinet Decision 52/2017). Throws on blockers, records warnings. */
export function checkInvoicePosting(inv: any, lines: any[]) {
  const out: Finding[] = []
  const tax = inv.doc_type !== 'Proforma Invoice'
  if (tax) {
    const registered = !!getSetting('vat_registered')
    if (!registered && (inv.vat_total ?? 0) > 0) out.push({ rule: 'VAT_NOT_REGISTERED', severity: 'Blocker', message: 'The company is recorded as not VAT-registered, so VAT cannot be charged. Remove VAT from the lines or update the VAT registration status in Company Settings.' })
    if (registered && !TRN.test(companyTrnFor(inv.branch_id))) out.push({ rule: 'SUPPLIER_TRN', severity: 'Blocker', message: 'A tax invoice must show the supplier’s 15-digit TRN. Enter it under Company Settings (or on the legal entity).' })
    const p = q.get(`SELECT trn, address1, city, country_id FROM parties WHERE id = ?`, inv.party_id)
    if (registered && p && !p.trn && (inv.base_total ?? 0) >= 10_000) out.push({ rule: 'CUSTOMER_TRN', severity: 'Warning', message: 'Customer TRN is missing. Invoices of AED 10,000 or more are full tax invoices and must show the customer’s name, address and TRN if it is VAT-registered.' })
    if (registered && p && !p.address1 && !p.city && (inv.base_total ?? 0) >= 10_000) out.push({ rule: 'CUSTOMER_ADDRESS', severity: 'Warning', message: 'Customer address is missing on a full tax invoice.' })
    if (inv.doc_type === 'Credit Note' && !String(inv.credit_reason ?? '').trim()) out.push({ rule: 'CREDIT_REASON', severity: 'Blocker', message: 'A tax credit note must state the reason it is issued.' })
    if (['Credit Note', 'Debit Note'].includes(inv.doc_type) && !inv.original_invoice_id) out.push({ rule: 'CREDIT_REF', severity: 'Warning', message: 'Link the original tax invoice so the note can be traced.' })
    if (inv.supply_date && daysBetween(inv.supply_date, inv.invoice_date) > 14) out.push({ rule: 'LATE_ISSUE', severity: 'Warning', message: `The invoice is dated ${daysBetween(inv.supply_date, inv.invoice_date)} days after the date of supply; a tax invoice must be issued within 14 days.` })
    const zr = lines.some(l => q.val(`SELECT 1 FROM vat_codes WHERE id = ? AND category = 'Zero rated'`, l.vat_code_id))
    if (zr) {
      const j = inv.job_id ? q.get(`SELECT trade, (SELECT c.code FROM locations l JOIN countries c ON c.id = l.country_id WHERE l.id = jobs.pol_id) pol, (SELECT c.code FROM locations l JOIN countries c ON c.id = l.country_id WHERE l.id = jobs.pod_id) pod FROM jobs WHERE id = ?`, inv.job_id) : null
      if (!j) out.push({ rule: 'ZERO_RATE_EVIDENCE', severity: 'Warning', message: 'Zero-rated lines are not linked to a job. Keep the bill of lading / air waybill and export or import declaration as evidence of international transport.' })
      else if (j.trade === 'Domestic' || (j.pol === 'AE' && j.pod === 'AE')) out.push({ rule: 'ZERO_RATE_EVIDENCE', severity: 'Warning', message: 'Zero-rating applies to international transport. The linked job is a domestic (UAE to UAE) movement – check the VAT code.' })
    }
    const l = licenceFinding(); if (l) out.push(l)
  }
  const s = sanctionsFinding(inv.party_id, false); if (s && s.severity === 'Blocker') out.push(s)
  const lv = out.map(level)
  assertNoBlockers(lv)
  syncFindings('invoices', inv.id, inv.invoice_no, INVOICE_RULES, lv)
}
export function checkBillPosting(b: any, lines: any[]) {
  const out: Finding[] = []
  const v = q.get(`SELECT name, trn FROM parties WHERE id = ?`, b.vendor_id)
  if ((b.vat_total ?? 0) > 0 && v && !v.trn && getSetting('vat_registered')) out.push({ rule: 'INPUT_VAT_TRN', severity: 'Warning', message: `${v.name} has no TRN on file. Input VAT is recoverable only against a valid tax invoice showing the supplier’s TRN.` })
  const s = sanctionsFinding(b.vendor_id, false); if (s && s.severity === 'Blocker') out.push(s)
  const lv = out.map(level)
  assertNoBlockers(lv)
  syncFindings('bills', b.id, b.bill_no, ['INPUT_VAT_TRN', 'SANCTIONS'], lv)
  void lines
}

// ---------------------------------------------------------------- calendar
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
function addMonthsClamp(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number); const t = m - 1 + n; const ny = y + Math.floor(t / 12), nm = ((t % 12) + 12) % 12 + 1
  return ymd(ny, nm, Math.min(d, lastDay(ny, nm)))
}
interface Planned { type: string; period: string; due: string; basis: string; amount?: number }
export function plannedDeadlines(today = todayStr()): Planned[] {
  const out: Planned[] = []
  const horizon = addMonthsClamp(today, 15), from = addDays(today, -60)
  const issue = (getSetting('licence_issue_date') as string) || tradeLicenceItem()?.issue_date || ''
  if (getSetting('vat_registered')) {
    const monthly = getSetting('vat_filing_frequency') === 'Monthly'
    for (let y = Number(today.slice(0, 4)) - 1; y <= Number(horizon.slice(0, 4)); y++) for (let m = 1; m <= 12; m++) {
      if (!monthly && m % 3) continue
      const end = ymd(y, m, lastDay(y, m)), due = addDays(end, 28)
      if (due < from || due > horizon) continue
      out.push({ type: 'VAT return', period: monthly ? `${y}-${String(m).padStart(2, '0')}` : `Q${m / 3} ${y}`, due, basis: 'Return and payment are due 28 days after the end of the tax period. Indicative – confirm the tax periods the FTA assigned to you in EmaraTax.' })
    }
  }
  if (!getSetting('ct_registered') && issue) out.push({ type: 'Corporate tax registration', period: 'Initial registration', due: addMonthsClamp(issue, 3), basis: 'Juridical persons must register for corporate tax within 3 months of the licence issue date (FTA Decision 3 of 2024). Verify the exact deadline in EmaraTax.' })
  const [fm, fd] = String(getSetting('financial_year_end') || '12-31').split('-').map(Number)
  const seed = issue || today
  for (let y = Number(seed.slice(0, 4)); y <= Number(horizon.slice(0, 4)); y++) {
    const fyEnd = ymd(y, fm, Math.min(fd, lastDay(y, fm)))
    if (fyEnd < seed) continue
    const due = addMonthsClamp(fyEnd, 9)
    if (due < from || due > horizon) continue
    out.push({ type: 'Corporate tax return', period: `FY ending ${fyEnd}`, due, basis: 'The corporate tax return and payment are due within 9 months of the end of the tax period.' })
  }
  const big = !!getSetting('einv_revenue_over_50m')
  out.push({ type: 'E-invoicing ASP appointment', period: 'Mandatory e-invoicing', due: big ? '2026-07-31' : '2027-03-31', basis: `Ministerial Decision 243 of 2025: businesses with revenue ${big ? 'of AED 50m or more' : 'below AED 50m'} must appoint an accredited service provider by this date.` })
  out.push({ type: 'E-invoicing go-live', period: 'Mandatory e-invoicing', due: big ? '2027-01-01' : '2027-07-01', basis: 'Mandatory issuing and receiving of structured e-invoices (PINT AE over Peppol) for B2B and B2G supplies.' })
  for (const it of q.all(`SELECT name, expiry_date FROM compliance_items WHERE deleted_at IS NULL AND status = 'Active' AND expiry_date IS NOT NULL AND expiry_date BETWEEN ? AND ?`, from, horizon)) out.push({ type: 'Licence renewal', period: it.name, due: it.expiry_date, basis: 'Expiry date from the licences & registrations register.' })
  return out
}
export function generateCalendar(): { created: number; updated: number } {
  let created = 0, updated = 0; const now = nowIso()
  for (const p of plannedDeadlines()) {
    const ex = q.get(`SELECT id, status, due_date FROM compliance_filings WHERE type = ? AND period = ? AND deleted_at IS NULL`, p.type, p.period)
    if (ex) { if (ex.status !== 'Filed' && ex.due_date !== p.due) { q.run(`UPDATE compliance_filings SET due_date = ?, basis = ?, updated_at = ? WHERE id = ? AND auto = 1`, p.due, p.basis, now, ex.id); updated++ } continue }
    q.run(`INSERT INTO compliance_filings(type, period, due_date, status, auto, basis, created_at, updated_at) VALUES (?,?,?,?,1,?,?,?)`, p.type, p.period, p.due, p.due < todayStr() ? 'Overdue' : 'Upcoming', p.basis, now, now)
    created++
  }
  return { created, updated }
}

/** Daily housekeeping: item statuses, overdue deadlines and reminders. */
export function complianceDaily() {
  const today = todayStr()
  q.run(`UPDATE compliance_items SET status = 'Expired', updated_at = ? WHERE status = 'Active' AND expiry_date < ? AND deleted_at IS NULL`, nowIso(), today)
  q.run(`UPDATE compliance_filings SET status = 'Overdue', updated_at = ? WHERE status = 'Upcoming' AND due_date < ? AND deleted_at IS NULL`, nowIso(), today)
  generateCalendar()
  for (const it of q.all(`SELECT id, name, expiry_date, renewal_lead_days FROM compliance_items WHERE deleted_at IS NULL AND status IN ('Active','Expired') AND expiry_date IS NOT NULL`)) {
    const left = daysBetween(today, it.expiry_date)
    if ((left <= (it.renewal_lead_days ?? 60) && [60, 30, 14, 7, 3, 2, 1, 0].includes(left)) || (left < 0 && left % 7 === 0))
      notifyRole('compliance', left < 0 ? `${it.name} EXPIRED ${-left} days ago` : `${it.name} expires in ${left} days`, `Expiry ${it.expiry_date}`, `/e/compliance_items/${it.id}`, 'alert', `lic-${it.id}-${today}`)
  }
  for (const f of q.all(`SELECT id, type, period, due_date FROM compliance_filings WHERE deleted_at IS NULL AND status IN ('Upcoming','Overdue')`)) {
    const left = daysBetween(today, f.due_date)
    if ([30, 14, 7, 3, 1, 0].includes(left) || (left < 0 && left % 7 === 0)) notifyRole('compliance', left < 0 ? `OVERDUE: ${f.type} ${f.period}` : `${f.type} ${f.period} due in ${left} days`, `Due ${f.due_date}`, `/e/compliance_filings/${f.id}`, 'alert', `fil-${f.id}-${today}`)
  }
}

// ---------------------------------------------------------------- overview for the Compliance Centre
type Check = { key: string; label: string; status: 'ok' | 'warn' | 'fail' | 'info'; detail: string; link?: string }
export function overview() {
  const today = todayStr(), checks: Check[] = []
  const lic = tradeLicenceItem(), exp: string | undefined = lic?.expiry_date || getSetting('licence_expiry_date') || undefined
  const left = exp ? daysBetween(today, exp) : null
  checks.push({ key: 'licence', label: 'Trade licence valid', status: left === null ? 'fail' : left < 0 ? 'fail' : left <= 60 ? 'warn' : 'ok', detail: left === null ? 'No trade licence expiry recorded' : left < 0 ? `Expired ${-left} days ago (${exp})` : `Valid until ${exp} (${left} days)`, link: lic ? `/e/compliance_items/${lic.id}` : '/e/compliance_items' })
  const trn = String(getSetting('company_trn') ?? '').replace(/\s/g, ''), reg = !!getSetting('vat_registered')
  checks.push({ key: 'vat', label: 'VAT status and TRN', status: !reg ? 'info' : TRN.test(trn) ? 'ok' : 'fail', detail: !reg ? 'Recorded as not VAT-registered – VAT cannot be charged. Register once taxable supplies exceed AED 375,000 in 12 months.' : TRN.test(trn) ? `TRN ${trn}` : 'VAT-registered but no valid 15-digit TRN entered – tax invoices cannot be posted', link: '/admin/settings' })
  const ctDue = q.get(`SELECT due_date FROM compliance_filings WHERE type = 'Corporate tax registration' AND status IN ('Upcoming','Overdue') AND deleted_at IS NULL ORDER BY due_date LIMIT 1`)
  checks.push({ key: 'ct', label: 'Corporate tax registration', status: getSetting('ct_registered') ? 'ok' : ctDue ? (daysBetween(today, ctDue.due_date) < 0 ? 'fail' : 'warn') : 'warn', detail: getSetting('ct_registered') ? `Registered${getSetting('ct_trn') ? ` – TRN ${getSetting('ct_trn')}` : ''}` : ctDue ? `Not registered – deadline ${ctDue.due_date} (${daysBetween(today, ctDue.due_date)} days)` : 'Not marked as registered', link: '/e/compliance_filings' })
  const einv = !!getSetting('einv_enabled') && !!getSetting('einv_endpoint'), asp = getSetting('einv_revenue_over_50m') ? '2026-07-31' : '2027-03-31'
  checks.push({ key: 'einv', label: 'E-invoicing service provider', status: einv ? 'ok' : today > asp ? 'fail' : daysBetween(today, asp) < 120 ? 'warn' : 'info', detail: einv ? 'Accredited service provider connected' : `No provider connected – appointment deadline ${asp}`, link: '/admin/integrations' })
  const scopeOpen = q.val<number>(`SELECT COUNT(*) FROM compliance_exceptions WHERE rule = 'SCOPE' AND status = 'Open' AND deleted_at IS NULL`) ?? 0
  const gaps = SERVICES.filter(s => missingFor(s.code).length)
  checks.push({ key: 'scope', label: 'Operations within licensed activities', status: scopeOpen ? 'fail' : 'ok', detail: scopeOpen ? `${scopeOpen} open record(s) outside the licensed activities` : gaps.length ? `No records outside the licence yet; ${gaps.length} service${gaps.length === 1 ? '' : 's'} in the OS ${gaps.length === 1 ? 'is' : 'are'} not licensed` : 'All services are licensed', link: '/e/compliance_exceptions' })
  for (const [type, label] of [['Customs broker registration (Dubai Customs)', 'Dubai Customs broker registration'], ['Maritime / shipping agent approval (DMA)', 'Dubai Maritime Authority approval']] as const) {
    const it = q.get(`SELECT id, status, expiry_date FROM compliance_items WHERE type = ? AND deleted_at IS NULL ORDER BY id LIMIT 1`, type)
    checks.push({ key: type, label, status: it?.status === 'Active' ? 'ok' : it?.status === 'Not applicable' ? 'info' : 'warn', detail: it ? `Status: ${it.status}${it.expiry_date ? `, expires ${it.expiry_date}` : ''}` : 'Not recorded', link: it ? `/e/compliance_items/${it.id}` : '/e/compliance_items' })
  }
  checks.push({ key: 'wps', label: 'MOHRE / WPS employer set-up', status: String(getSetting('wps_employer_id')).replace(/\D/g, '').length >= 8 && String(getSetting('wps_bank_routing')).replace(/\D/g, '').length === 9 ? 'ok' : 'warn', detail: 'Employer establishment ID and bank routing code for the WPS file', link: '/admin/integrations' })
  const cust = q.get(`SELECT COUNT(*) n, SUM(CASE WHEN sanctions_status IN ('Clear') AND sanctions_screened_on IS NOT NULL THEN 1 ELSE 0 END) ok FROM parties WHERE deleted_at IS NULL AND status = 'Active'`)
  checks.push({ key: 'sanctions', label: 'Sanctions screening coverage', status: !cust?.n ? 'info' : cust.ok === cust.n ? 'ok' : 'warn', detail: cust?.n ? `${cust.ok ?? 0} of ${cust.n} active parties screened clear` : 'No parties yet', link: '/e/parties' })
  const nm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const ln = String(getSetting('licence_name_en') ?? '')
  checks.push({ key: 'name', label: 'Company name matches the licence', status: !ln ? 'info' : nm(ln) === nm(String(getSetting('company_name'))) ? 'ok' : 'warn', detail: !ln ? 'Licence name not recorded' : nm(ln) === nm(String(getSetting('company_name'))) ? ln : `Documents print “${getSetting('company_name')}” but the licence says “${ln}”`, link: '/admin/settings' })
  const open = q.all(`SELECT severity, COUNT(*) n FROM compliance_exceptions WHERE status = 'Open' AND deleted_at IS NULL GROUP BY severity`)
  const nOpen = open.reduce((s, r) => s + r.n, 0)
  checks.push({ key: 'exceptions', label: 'Open compliance exceptions', status: nOpen ? 'warn' : 'ok', detail: nOpen ? `${nOpen} open` : 'None', link: '/e/compliance_exceptions' })
  const scored = checks.filter(c => c.status !== 'info')
  const score = scored.length ? Math.round(100 * scored.reduce((s, c) => s + (c.status === 'ok' ? 1 : c.status === 'warn' ? 0.5 : 0), 0) / scored.length) : 100
  const used = Object.fromEntries(q.all(`SELECT department d, COUNT(*) n FROM jobs WHERE deleted_at IS NULL GROUP BY department`).map(r => [r.d, r.n]))
  const usage: Record<string, number> = {}
  for (const [d, n] of Object.entries(used)) { const s = DEPT[d as string]; if (s) usage[s] = (usage[s] ?? 0) + (n as number) }
  return {
    score, checks, mode: { compliance: getSetting('compliance_mode'), scope: getSetting('activity_scope_mode') },
    identity: { name: getSetting('company_name'), name_ar: getSetting('company_name_ar'), licence_no: getSetting('company_trade_license'), authority: getSetting('licence_authority'), trn: getSetting('company_trn'), licence_expiry: exp ?? null },
    scope: SERVICES.map(s => {
      const covered = missingFor(s.code).length === 0, core = s.note.startsWith('Covered')
      return { code: s.code, label: s.label, covered, jobs: usage[s.code] ?? 0, note: covered ? (core ? s.note : 'Covered by an active licensed activity.') : (core ? 'The licensed activity for this service is missing or suspended – check Licensed activities.' : s.note) }
    }),
    deadlines: q.all(`SELECT id, type, period, due_date, status FROM compliance_filings WHERE deleted_at IS NULL AND status IN ('Upcoming','Overdue') ORDER BY due_date LIMIT 12`).map(r => ({ ...r, days: daysBetween(today, r.due_date) })),
    expiring: q.all(`SELECT id, name, type, expiry_date, status FROM compliance_items WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND status NOT IN ('Not applicable') AND expiry_date <= ? ORDER BY expiry_date LIMIT 12`, addDays(today, 90)).map(r => ({ ...r, days: daysBetween(today, r.expiry_date) })),
    exceptions: { open, },
  }
}
