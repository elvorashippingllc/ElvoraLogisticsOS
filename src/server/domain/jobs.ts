import crypto from 'node:crypto'
import { assertClosureReady } from './job-controls'
import { q, inDemo } from '../db'
import type { Hooks } from '../hooks'
import { bad, r2, toCents, fromCents, nowLocal, todayStr, addDays, daysBetween, nowIso } from '../util'
import { createRecord, getDef, getRecord, insertRow, patchRecord, formatNumber, nextSeq, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { fxRate, BASE } from './accounting'
import { notify } from '../notify'
import { ENTITIES } from '../../shared/entities'
import { getSetting } from '../settings'

const vatPct = (id: number | null | undefined) => (id ? q.val<number>(`SELECT rate FROM vat_codes WHERE id = ?`, id) ?? 0 : 0)

export const modeOf = (dep: string | null | undefined): string => {
  const d = (dep ?? '').toUpperCase()
  if (d.startsWith('FCL') || d.startsWith('LCL')) return 'Sea'
  if (d.startsWith('AIR') || d === 'COURIER') return 'Air'
  if (d.startsWith('ROAD')) return 'Road'
  if (d.startsWith('CUSTOMS')) return 'Customs'
  if (d === 'WAREHOUSING') return 'Warehouse'
  return 'Other'
}

export function addJobEvent(jobId: number, type: string, o: { at?: string; location?: string; description?: string; source?: string; container_no?: string; user_id?: number | null; visible?: boolean } = {}) {
  insertRow(getDef('job_events'), { job_id: jobId, event_at: o.at ?? nowLocal(), event_type: type, location: o.location ?? null, description: o.description ?? null, source: o.source ?? 'System', container_no: o.container_no ?? null, visible_to_customer: o.visible ?? true, user_id: o.user_id ?? null })
  if (o.visible !== false) void import('../integrations/whatsapp').then(m => m.notifyMilestone(jobId, type, o.location)).catch(() => {})
}

function computeCharges(rows: Rec[], jobId: number | undefined) {
  const supplied = jobId ? q.all('SELECT * FROM job_charges WHERE job_id=? AND vendor_service_id IS NOT NULL AND deleted_at IS NULL', jobId) : []
  for (const c of supplied) {
    const incoming = rows.find(r => Number(r.id) === c.id)
    if (!incoming) throw bad('Vendor service charges cannot be removed here. Reset the service to draft first.')
    for (const field of ['kind', 'charge_code_id', 'description', 'party_id', 'basis', 'qty', 'rate', 'currency', 'ex_rate', 'vat_code_id']) {
      const expected = field === 'rate' ? fromCents(c[field]) : c[field]
      if (incoming[field] === undefined) incoming[field] = expected
      if (JSON.stringify(incoming[field]) !== JSON.stringify(expected)) throw bad('Vendor service charges are locked. Reset the service to draft before changing its buying or selling details.')
    }
  }
  const locked = jobId ? q.all(`SELECT id, status, qty, rate, charge_code_id, currency, kind FROM job_charges WHERE job_id = ? AND deleted_at IS NULL AND status <> 'Unbilled'`, jobId) : []
  const incoming = new Set(rows.filter(r => r.id).map(r => Number(r.id)))
  for (const l of locked) if (!incoming.has(l.id)) throw bad('A charge that is already invoiced or billed cannot be removed. Void the invoice / bill first.')
  for (const r of rows) {
    const lockedRow = r.id ? locked.find(l => l.id === Number(r.id)) : undefined
    if (lockedRow) {
      if (Number(r.qty ?? lockedRow.qty) !== lockedRow.qty || toCents(r.rate ?? 0) !== lockedRow.rate || (r.currency ?? lockedRow.currency) !== lockedRow.currency || (r.kind ?? lockedRow.kind) !== lockedRow.kind) {
        throw bad('A charge that is already invoiced or billed cannot be changed. Void the invoice / bill first.')
      }
    }
    const cc = r.charge_code_id ? q.get(`SELECT * FROM charge_codes WHERE id = ?`, r.charge_code_id) : null
    if (cc) {
      if (!r.description) r.description = cc.name
      if (!r.vat_code_id && cc.vat_code_id) r.vat_code_id = cc.vat_code_id
      if ((r.rate === undefined || r.rate === null) && r.kind !== 'Cost' && cc.default_rate) r.rate = cc.default_rate / 100
    }
    r.qty = Number(r.qty ?? 1); r.rate = Number(r.rate ?? 0)
    if (r.qty < 0 || r.rate < 0) throw bad('Quantity and rate cannot be negative')
    r.currency = r.currency || BASE()
    r.ex_rate = fxRate(r.currency, r.ex_rate)
    r.amount = r2(r.qty * r.rate)
    r.vat_pct = vatPct(r.vat_code_id)
    r.vat_amount = r2(r.amount * r.vat_pct / 100)
    r.base_amount = r2(r.amount * r.ex_rate)
    if (!r.id) r.status = 'Unbilled'
  }
}

export function recomputeJobTotals(jobId: number) {
  q.run(`UPDATE jobs SET
    total_revenue = (SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND deleted_at IS NULL),
    total_cost = (SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Cost' AND deleted_at IS NULL),
    containers_summary = (SELECT group_concat(n || ' x ' || t, ', ') FROM (SELECT COUNT(*) n, COALESCE(ct.code, 'CNT') t FROM job_containers c LEFT JOIN container_types ct ON ct.id = c.type_id WHERE c.job_id = ? AND c.deleted_at IS NULL GROUP BY ct.code))
    WHERE id = ?`, jobId, jobId, jobId, jobId)
  q.run(`UPDATE jobs SET profit = total_revenue - total_cost WHERE id = ?`, jobId)
}

export const jobHooks: Hooks = {
  beforeDelete({rec}) { if(rec.job_status==='CLOSED') throw bad('Closed jobs cannot be deleted; use controlled reopening'); if(q.val("SELECT id FROM vendor_services WHERE job_id=? AND status<>'Cancelled' AND deleted_at IS NULL",rec.id)) throw bad('Resolve vendor services before deleting this job') },
  tokens: rec => ({ branch: q.val<string>(`SELECT code FROM branches WHERE id = ?`, rec.branch_id) ?? 'JOB' }),
  numberDate: rec => rec.job_date,
  beforeSave({ rec, old, children, isNew, ctx }) {
    if (isNew && rec.job_status === 'CLOSED' && !ctx.system) throw bad('Create the job first and complete its closure review')
    if (old?.job_status === 'CLOSED' && ctx.jobTransition !== 'reopen') throw bad('Closed jobs are locked. Request independent approval to reopen the job.')
    rec.mode = modeOf(rec.department)
    if (isNew || old?.client_id !== rec.client_id) {
      const c = q.get(`SELECT name, status FROM parties WHERE id = ?`, rec.client_id)
      if (c?.status === 'Blocked') throw bad(`${c.name} is blocked — new jobs cannot be opened`)
    }
    if (rec.department?.includes('IMPORT') && rec.trade === 'Export' && isNew) rec.trade = 'Import'
    if (old) {
      if (old.client_id !== rec.client_id && q.val('SELECT id FROM vendor_services WHERE job_id=? AND charges_created=1 AND deleted_at IS NULL', rec.id)) throw bad('Customer cannot change after vendor services have added job charges')
      if (old.branch_id !== rec.branch_id || old.job_date !== rec.job_date) throw bad('Branch and job date cannot be changed once the job number has been issued')
      if ((old.client_id !== rec.client_id || old.department !== rec.department) && q.val(`SELECT 1 FROM job_charges WHERE job_id = ? AND status <> 'Unbilled' AND deleted_at IS NULL LIMIT 1`, rec.id)) throw bad('Client and department cannot be changed after charges have been invoiced or billed')
    }
    if (children.charges) computeCharges(children.charges, rec.id)
    if (rec.etd && rec.eta && rec.eta < rec.etd) throw bad('ETA cannot be earlier than ETD')
    if (rec.atd && rec.ata && rec.ata < rec.atd) throw bad('ATA cannot be earlier than ATD')
    if (old && old.job_status !== rec.job_status) {
      if (rec.job_status === 'CLOSED') {
        if(old.job_status==='CANCELLED') throw bad('Cancelled jobs cannot be closed')
        if (ctx.jobTransition !== 'close') throw bad('Use the job closure review to close this job')
        assertClosureReady(rec.id, ctx)
        const n = q.val<number>(`SELECT COUNT(*) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND status = 'Unbilled' AND deleted_at IS NULL AND amount <> 0`, rec.id) ?? 0
        if (n) throw bad(`${n} revenue charge${n > 1 ? 's are' : ' is'} not yet invoiced. Invoice or remove ${n > 1 ? 'them' : 'it'} before closing the job.`)
        rec.closed_at = nowLocal()
      }
      if (rec.job_status === 'CANCELLED') {
        if (q.val("SELECT id FROM vendor_services WHERE job_id=? AND deleted_at IS NULL AND status<>'Cancelled' AND ((return_required=1 AND status<>'Returned') OR (return_required=0 AND status<>'Completed'))", rec.id)) throw bad('Complete or cancel vendor services and return hired equipment before cancelling this job')
        const n = q.val<number>(`SELECT COUNT(*) FROM job_charges WHERE job_id = ? AND status <> 'Unbilled' AND deleted_at IS NULL`, rec.id) ?? 0
        if (n) throw bad('Void the invoices / bills linked to this job before cancelling it.')
      }
      if (old.job_status === 'CLOSED' && rec.job_status !== 'CLOSED') rec.closed_at = null
    }
  },
  afterSave({ rec, old, isNew, ctx }) {
    recomputeJobTotals(rec.id)
    const uid = ctx.user?.id ?? null
    if (isNew) addJobEvent(rec.id, 'Note', { description: `Job ${rec.job_no} opened`, user_id: uid })
    const chg = (f: string) => isNew ? !!rec[f] : (old?.[f] ?? null) !== (rec[f] ?? null) && !!rec[f]
    const air = modeOf(rec.department) === 'Air'
    if (chg('atd')) addJobEvent(rec.id, air ? 'Flight departed' : 'Vessel departed', { at: rec.atd, description: 'Actual departure recorded', user_id: uid })
    if (chg('ata')) addJobEvent(rec.id, air ? 'Flight arrived' : 'Vessel arrived', { at: rec.ata, description: 'Actual arrival recorded', user_id: uid })
    if (!isNew && old && old.job_status !== rec.job_status) addJobEvent(rec.id, rec.job_status === 'DELIVERED' ? 'Delivered' : 'Note', { description: `Job status: ${old.job_status} → ${rec.job_status}`, user_id: uid })
    if (!isNew && old && old.bl_status !== rec.bl_status && rec.bl_status === 'ISSUED') addJobEvent(rec.id, 'B/L issued', { description: rec.hbl_no ? `HBL ${rec.hbl_no}` : undefined, user_id: uid })
    if (rec.operator_id && rec.operator_id !== ctx.user?.id && (isNew || old?.operator_id !== rec.operator_id)) notify(rec.operator_id, `Job ${rec.job_no} assigned to you`, rec._title ?? '', `/jobs/${rec.id}`, 'assignment')
  },
}

// ------------------------------------------------------------------ sub-jobs / shipments
export const shipmentHooks: Hooks = {
  beforeSave({ rec, old, isNew }) {
    const job = q.get(`SELECT * FROM jobs WHERE id = ?`, rec.job_id)
    if (!job) throw bad('Master job not found')
    if (isNew) {
      const n = nextSeq(`shipment|${rec.job_id}`)
      rec.shipment_no = `${job.job_no}/${String(n).padStart(2, '0')}`
      if (!rec.shipper_id && job.shipper_id) rec.shipper_id = job.shipper_id
      if (!rec.consignee_id && job.consignee_id) rec.consignee_id = job.consignee_id
      if (!rec.notify_id && job.notify_id) rec.notify_id = job.notify_id
      if (!rec.freight_terms && job.freight_terms) rec.freight_terms = job.freight_terms
      if (!rec.commodity && job.commodity) rec.commodity = job.commodity
    } else if (old && old.job_id !== rec.job_id) throw bad('A sub-job cannot be moved to another master job')
    if (rec.status === 'Delivered' && !rec.delivered_at) rec.delivered_at = nowLocal()
  },
}

export const bookingHooks: Hooks = {
  beforeSave({ rec, old }) {
    if (rec.status === 'Confirmed' && !rec.confirmed_on) rec.confirmed_on = todayStr()
    if (rec.etd && rec.eta && rec.eta < rec.etd) throw bad('ETA cannot be earlier than ETD')
  },
  afterSave({ rec, old, ctx }) {
    if (rec.job_id && rec.status === 'Confirmed' && old?.status !== 'Confirmed') {
      const job = q.get(`SELECT * FROM jobs WHERE id = ?`, rec.job_id)
      if (job) {
        const patch: Rec = {}
        if (!job.booking_no) patch.booking_no = rec.booking_no
        if (!job.carrier_id && rec.carrier_id) patch.carrier_id = rec.carrier_id
        if (!job.vessel_name && rec.vessel_name) patch.vessel_name = rec.vessel_name
        if (!job.voyage_no && rec.voyage_no) patch.voyage_no = rec.voyage_no
        if (!job.etd && rec.etd) patch.etd = rec.etd
        if (!job.eta && rec.eta) patch.eta = rec.eta
        if (job.operational_status === 'BOOKING REQUESTED' || !job.operational_status) patch.operational_status = 'BOOKING CONFIRMED'
        if (Object.keys(patch).length) patchRecord(getDef('jobs'), rec.job_id, patch, ctx)
        addJobEvent(rec.job_id, 'Booking confirmed', { description: `Booking ${rec.booking_no}`, user_id: ctx.user?.id })
      }
    }
  },
}

export const doHooks: Hooks = {
  numberDate: r => r.do_date,
  beforeSave({ rec, old }) {
    const job = q.get(`SELECT freight_terms, job_no FROM jobs WHERE id = ?`, rec.job_id)
    if (!job) throw bad('Master job not found')
    if (rec.status === 'Released' && old?.status !== 'Released' && job.freight_terms === 'Collect' && !rec.freight_cleared) throw bad('Freight is collect on this job — confirm that freight and charges are cleared before releasing the DO.')
  },
  afterSave({ rec, old, ctx }) {
    if (['Issued', 'Released'].includes(rec.status)) {
      q.run(`UPDATE jobs SET do_no = COALESCE(NULLIF(do_no,''), ?), do_date = COALESCE(do_date, ?) WHERE id = ?`, rec.do_no, rec.do_date + 'T00:00', rec.job_id)
      if (old?.status !== rec.status) addJobEvent(rec.job_id, 'DO released', { description: `${rec.do_no} ${rec.status.toLowerCase()}`, user_id: ctx.user?.id })
    }
  },
}

/** "Generate" button next to DO No. on the job screen. */
export function generateDO(jobId: number, ctx: Ctx): Rec {
  const job = getRecord(getDef('jobs'), jobId, SYSTEM_CTX, { children: false })
  const existing = q.get(`SELECT id FROM delivery_orders WHERE job_id = ? AND status <> 'Cancelled' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, jobId)
  if (existing) throw bad('A delivery order already exists for this job — open it from the Delivery Orders list.')
  const doRec = createRecord(getDef('delivery_orders'), { job_id: jobId, issued_to_id: job.consignee_id ?? job.client_id, status: 'Issued', do_date: todayStr(), valid_until: addDays(todayStr(), 7) }, ctx)
  return doRec
}

// ------------------------------------------------------------------ customs
export const customsLineHooks: Hooks = {}
export const customsHooks: Hooks = {
  beforeSave({ rec, old, children }) {
    if (children.lines) {
      for (const l of children.lines) {
        l.value = r2(Number(l.value) || 0)
        if (l.hs_code_id && l.duty_pct === undefined) l.duty_pct = q.val<number>(`SELECT duty_rate FROM hs_codes WHERE id = ?`, l.hs_code_id) ?? 5
        l.duty_pct = Number(l.duty_pct ?? 5); l.vat_pct = Number(l.vat_pct ?? 5)
        l.duty_amount = r2(l.value * l.duty_pct / 100)
        l.vat_amount = r2((l.value + l.duty_amount) * l.vat_pct / 100)
      }
    }
    if (rec.status === 'Cleared' && !rec.released_at) rec.released_at = nowLocal()
    if (rec.status === 'Cleared' && !rec.declaration_no) throw bad('Enter the SB / BOE number before marking the declaration cleared')
  },
  afterSave({ rec, old, ctx }) {
    q.run(`UPDATE customs_declarations SET
      total_value = (SELECT COALESCE(SUM(value),0) FROM customs_lines WHERE declaration_id = ? AND deleted_at IS NULL),
      duty_total = (SELECT COALESCE(SUM(duty_amount),0) FROM customs_lines WHERE declaration_id = ? AND deleted_at IS NULL),
      vat_total = (SELECT COALESCE(SUM(vat_amount),0) FROM customs_lines WHERE declaration_id = ? AND deleted_at IS NULL) WHERE id = ?`, rec.id, rec.id, rec.id, rec.id)
    const map: Record<string, string> = { Draft: 'Documents received', Submitted: 'Declaration filed', 'Under assessment': 'Under assessment', 'Query raised': 'Query', 'Duty payable': 'Under assessment', 'Duty paid': 'Under assessment', Cleared: 'Cleared' }
    const cs = map[rec.status]
    if (cs && rec.job_id) {
      const isExport = String(rec.declaration_type).startsWith('Export')
      const isImport = String(rec.declaration_type).startsWith('Import')
      q.run(`UPDATE jobs SET customs_status = ?, ${isExport ? 'sb_no' : isImport ? 'boe_no' : 'sb_no'} = COALESCE(NULLIF(${isExport ? 'sb_no' : isImport ? 'boe_no' : 'sb_no'}, ''), ?) WHERE id = ?`, cs, rec.declaration_no ?? null, rec.job_id)
      if (rec.status === 'Cleared' && old?.status !== 'Cleared') addJobEvent(rec.job_id, isExport ? 'Export customs cleared' : 'Import customs cleared', { description: `Declaration ${rec.declaration_no}`, user_id: ctx.user?.id })
    }
  },
}

// ------------------------------------------------------------------ transport orders
export const transportHooks: Hooks = {
  beforeSave({ rec }) {
    if (rec.pickup_at && rec.delivery_at && rec.delivery_at < rec.pickup_at) throw bad('Delivery time is before pick-up time')
    if (['Dispatched', 'In transit', 'Delivered', 'POD received'].includes(rec.status) && !rec.vehicle_id && !rec.subcontractor_id) throw bad('Assign a vehicle or a subcontractor before dispatching')
    if (rec.status === 'POD received' && !rec.pod_at) rec.pod_at = nowLocal()
    if (rec.vehicle_id && ['Dispatched', 'In transit'].includes(rec.status)) {
      const busy = q.get(`SELECT order_no FROM transport_orders WHERE vehicle_id = ? AND status IN ('Dispatched','In transit') AND deleted_at IS NULL AND id <> ?`, rec.vehicle_id, rec.id ?? 0)
      if (busy) throw bad(`Vehicle is already on trip ${busy.order_no}`)
    }
  },
  afterSave({ rec, old, ctx }) {
    if (rec.vehicle_id) {
      const onTrip = ['Dispatched', 'In transit'].includes(rec.status)
      q.run(`UPDATE vehicles SET status = ? WHERE id = ? AND status IN ('Available','On trip')`, onTrip ? 'On trip' : 'Available', rec.vehicle_id)
    }
    if (rec.job_id && old?.status !== rec.status) {
      const map: Record<string, string> = { Dispatched: 'Out for delivery', Delivered: 'Delivered', 'POD received': 'POD received' }
      if (map[rec.status]) addJobEvent(rec.job_id, map[rec.status], { description: `Trip ${rec.order_no}${rec.delivery_location ? ' → ' + rec.delivery_location : ''}`, user_id: ctx.user?.id })
    }
    if (rec.shipment_id && rec.status === 'POD received') q.run(`UPDATE shipments SET pod_received = 1, status = 'Delivered', delivered_at = COALESCE(delivered_at, ?) WHERE id = ?`, nowLocal(), rec.shipment_id)
  },
}

// ------------------------------------------------------------------ job services
/**
 * Draft invoice(s) from a job's unbilled revenue. Default: one invoice per bill-to party and charge currency.
 * `billInBase`: one invoice per bill-to party in the company currency, each foreign-priced charge keeping its own currency and rate of exchange on the line
 * (the way freight is usually quoted in USD but billed in AED).
 */
export function generateInvoicesFromJob(jobId: number, opts: { docType?: string; chargeIds?: number[]; billInBase?: boolean }, ctx: Ctx): Rec[] {
  const job = getRecord(getDef('jobs'), jobId, SYSTEM_CTX, { children: false })
  const docType = opts.docType ?? 'Tax Invoice'
  let charges = q.all(`SELECT * FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND status = 'Unbilled' AND deleted_at IS NULL ORDER BY id`, jobId)
  if (opts.chargeIds?.length) charges = charges.filter(c => opts.chargeIds!.includes(c.id))
  if (docType === 'Proforma Invoice') { /* proforma never consumes charges */ }
  if (!charges.length) throw bad('There are no unbilled revenue charges on this job')
  const groups = new Map<string, any[]>()
  const base = getSetting<string>('base_currency') || 'AED'
  for (const c of charges) { const k = `${c.party_id ?? job.client_id}|${opts.billInBase ? base : c.currency}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(c) }
  const out: Rec[] = []
  for (const [k, rows] of groups) {
    const [partyId, currency] = k.split('|')
    const party = q.get(`SELECT * FROM parties WHERE id = ?`, Number(partyId))
    const inv = createRecord(getDef('invoices'), {
      doc_type: docType, party_id: Number(partyId), job_id: jobId, branch_id: job.branch_id, invoice_date: todayStr(), currency, ex_rate: opts.billInBase ? 1 : rows[0].ex_rate, payment_term_id: party?.payment_term_id ?? null,
      reference: job.customer_ref ?? null, notes: `Job ${job.job_no}${job.mbl_no ? ` · MBL/AWB ${job.mbl_no}` : ''}${job.hbl_no ? ` · HBL ${job.hbl_no}` : ''}`,
      terms: getSetting('invoice_terms'),
      children: { lines: rows.map(c => ({ charge_code_id: c.charge_code_id, description: c.description, unit: c.basis, qty: c.qty, rate: fromCents(c.rate), vat_code_id: c.vat_code_id, job_charge_id: c.id, ...(opts.billInBase && c.currency !== base ? { line_ccy: c.currency, line_roe: c.ex_rate } : {}) })) },
    }, ctx)
    out.push(inv)
  }
  return out
}

export function convertProforma(invoiceId: number, ctx: Ctx): Rec {
  const pi = getRecord(getDef('invoices'), invoiceId, SYSTEM_CTX)
  if (pi.doc_type !== 'Proforma Invoice') throw bad('This is not a proforma invoice')
  if (pi.status === 'Void') throw bad('The proforma is void')
  return createRecord(getDef('invoices'), {
    doc_type: 'Tax Invoice', party_id: pi.party_id, job_id: pi.job_id, shipment_id: pi.shipment_id, branch_id: pi.branch_id, invoice_date: todayStr(), currency: pi.currency, ex_rate: pi.ex_rate, payment_term_id: pi.payment_term_id,
    reference: pi.reference, notes: pi.notes, terms: pi.terms, bank_account_id: pi.bank_account_id, trade: pi.trade, round_total: pi.round_total,
    ship_bl_no: pi.ship_bl_no, ship_vessel: pi.ship_vessel, ship_receipt: pi.ship_receipt, ship_pol: pi.ship_pol, ship_pod: pi.ship_pod, ship_destination: pi.ship_destination, ship_containers: pi.ship_containers, ship_weight: pi.ship_weight, ship_cargo: pi.ship_cargo, ship_hs_code: pi.ship_hs_code,
    children: { lines: pi.children.lines.map((l: Rec) => ({ charge_code_id: l.charge_code_id, description: l.description, unit: l.unit, qty: l.qty, rate: l.rate, vat_code_id: l.vat_code_id, line_ccy: l.line_ccy ?? null, line_roe: l.line_roe ?? null, job_charge_id: l.job_charge_id ?? null })) },
  }, ctx)
}

export function createBillFromJobCosts(jobId: number, vendorId: number, vendorInvoiceNo: string, chargeIds: number[], ctx: Ctx): Rec {
  const job = getRecord(getDef('jobs'), jobId, SYSTEM_CTX, { children: false })
  let charges = q.all(`SELECT * FROM job_charges WHERE job_id = ? AND kind = 'Cost' AND status = 'Unbilled' AND deleted_at IS NULL AND party_id = ? ORDER BY id`, jobId, vendorId)
  if (chargeIds?.length) charges = charges.filter(c => chargeIds.includes(c.id))
  if (!charges.length) throw bad('No unbilled cost charges for this vendor on the job')
  const cur = charges[0].currency
  if (charges.some(c => c.currency !== cur)) throw bad('Selected cost charges are in different currencies — bill them separately')
  return createRecord(getDef('bills'), {
    vendor_id: vendorId, vendor_invoice_no: vendorInvoiceNo, job_id: jobId, branch_id: job.branch_id, bill_date: todayStr(), currency: cur, ex_rate: charges[0].ex_rate,
    children: { lines: charges.map(c => ({ charge_code_id: c.charge_code_id, description: c.description, qty: c.qty, rate: fromCents(c.rate), vat_code_id: c.vat_code_id, job_charge_id: c.id, job_id: jobId })) },
  }, ctx)
}

export function duplicateJob(jobId: number, ctx: Ctx): Rec {
  const def = getDef('jobs')
  const j = getRecord(def, jobId, SYSTEM_CTX)
  const copy: Rec = {}
  for (const f of def.fields) {
    if (f.readonly || f.computed || f.secret) continue
    if (['mbl_no', 'hbl_no', 'mbl_date', 'hbl_date', 'etd', 'atd', 'eta', 'ata', 'sb_no', 'boe_no', 'booking_no', 'vessel_name', 'voyage_no', 'vessel_id', 'scn_no', 'job_date', 'job_status', 'bl_status', 'operational_status', 'customs_status'].includes(f.name)) continue
    copy[f.name] = j[f.name]
  }
  copy.children = {
    cargo: j.children.cargo.map((c: Rec) => ({ ...c, id: undefined })),
    charges: j.children.charges.map((c: Rec) => ({ kind: c.kind, charge_code_id: c.charge_code_id, description: c.description, party_id: c.party_id, basis: c.basis, qty: c.qty, rate: c.rate, currency: c.currency, ex_rate: c.ex_rate, vat_code_id: c.vat_code_id })),
    legs: j.children.legs.map((c: Rec) => ({ ...c, id: undefined, etd: null, eta: null, atd: null, ata: null, status: 'Planned' })),
  }
  return createRecord(def, copy, ctx)
}

export function ensureTrackingToken(jobId: number): string {
  const row = q.get(`SELECT token FROM job_tracking_tokens WHERE job_id = ?`, jobId)
  if (row) return row.token
  const token = (inDemo() ? 'demo-' : '') + crypto.randomBytes(16).toString('hex')
  q.run(`INSERT INTO job_tracking_tokens(job_id, token, created_at) VALUES (?,?,?)`, jobId, token, nowIso())
  return token
}

export function jobKpi(jobId: number) {
  const j = getRecord(getDef('jobs'), jobId, SYSTEM_CTX, { children: false })
  const hours = (a?: string | null, b?: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 360000) / 10 : null)
  const days = (a?: string | null, b?: string | null) => (a && b ? daysBetween(a, b) : null)
  const plannedTransit = days(j.etd, j.eta), actualTransit = days(j.atd, j.ata)
  const rev = j.total_revenue, cost = j.total_cost
  const items = [
    { key: 'departure_variance_h', label: 'Departure variance (ATD − ETD)', value: hours(j.etd, j.atd), unit: 'h', good: (v: number) => v <= 24 },
    { key: 'arrival_variance_h', label: 'Arrival variance (ATA − ETA)', value: hours(j.eta, j.ata), unit: 'h', good: (v: number) => v <= 24 },
    { key: 'planned_transit', label: 'Planned transit', value: plannedTransit, unit: 'days', good: null },
    { key: 'actual_transit', label: 'Actual transit', value: actualTransit, unit: 'days', good: (v: number) => plannedTransit === null || v <= plannedTransit + 1 },
    { key: 'cycle_days', label: 'Job cycle (open → closed)', value: j.closed_at ? days(j.job_date, j.closed_at) : days(j.job_date, todayStr()), unit: 'days', good: null },
    { key: 'margin_pct', label: 'Gross margin', value: rev > 0 ? r2((j.profit / rev) * 100) : null, unit: '%', good: (v: number) => v >= Number(getSetting('min_margin_pct') || 0) },
    { key: 'unbilled', label: 'Unbilled revenue charges', value: q.val<number>(`SELECT COUNT(*) FROM job_charges WHERE job_id = ? AND kind='Revenue' AND status='Unbilled' AND deleted_at IS NULL`, jobId) ?? 0, unit: '', good: (v: number) => v === 0 },
    { key: 'events', label: 'Tracking events recorded', value: q.val<number>(`SELECT COUNT(*) FROM job_events WHERE job_id = ? AND deleted_at IS NULL`, jobId) ?? 0, unit: '', good: null },
    { key: 'docs', label: 'Documents attached', value: q.val<number>(`SELECT COUNT(*) FROM attachments WHERE link_entity='jobs' AND link_id = ? AND deleted_at IS NULL`, jobId) ?? 0, unit: '', good: (v: number) => v > 0 },
  ].map(i => ({ key: i.key, label: i.label, value: i.value, unit: i.unit, status: i.value === null || !i.good ? 'n/a' : i.good(i.value as number) ? 'good' : 'bad' }))
  return { job_no: j.job_no, revenue: rev, cost, profit: j.profit, items }
}

// ------------------------------------------------------------------ EDI / data exchange
const e = (s: any) => String(s ?? '').replace(/[?+:'\n\r]/g, ' ').toUpperCase().slice(0, 35)
const dt = (v?: string | null, fmt: '203' | '102' = '203') => (v ? (fmt === '203' ? v.replace(/[-:T]/g, '').slice(0, 12).padEnd(12, '0') : v.slice(0, 10).replace(/-/g, '')) : '')

export function generateEdi(jobId: number, format: string): { filename: string; mime: string; content: string; note: string } {
  const def = getDef('jobs')
  const j = getRecord(def, jobId, SYSTEM_CTX)
  const L = j._labels as Record<string, string>
  const loc = (id: number | null) => (id ? q.get(`SELECT l.code, l.name, c.code AS cc FROM locations l LEFT JOIN countries c ON c.id = l.country_id WHERE l.id = ?`, id) : null)
  const party = (id: number | null) => (id ? q.get(`SELECT * FROM parties WHERE id = ?`, id) : null)
  const pol = loc(j.pol_id), pod = loc(j.pod_id), por = loc(j.por_id), pof = loc(j.pof_id)
  const mode = modeOf(j.department)
  const note = 'Generated from job data. Validate the mapping with your EDI / CCS provider or trading partner before transmission — this system does not transmit EDI.'
  if (format === 'json') return { filename: `${j.job_no}.json`, mime: 'application/json', content: JSON.stringify(j, null, 2), note: 'Full job record as JSON.' }
  if (format === 'fwb' || (format === 'auto' && mode === 'Air')) {
    if (mode !== 'Air') throw bad('FWB (air waybill) data is only available for air jobs')
    const awb = String(j.mbl_no ?? '').replace(/\D/g, '')
    const airline = j.carrier_id ? q.get(`SELECT awb_prefix, code FROM carriers WHERE id = ?`, j.carrier_id) : null
    const prefix = airline?.awb_prefix || awb.slice(0, 3)
    const serial = awb.startsWith(prefix) && awb.length > 8 ? awb.slice(prefix.length) : awb
    const origin = (pol?.code ?? '').slice(2), dest = (pod?.code ?? '').slice(2)
    const shipper = party(j.shipper_id ?? j.client_id), cnee = party(j.consignee_id)
    const lines = [
      'FWB/16',
      `${prefix}-${serial}${origin}${dest}/T${j.packages ?? 1}K${(j.gross_weight ?? 0).toFixed(1)}`,
      `FLT/${airline?.code ?? ''}${j.voyage_no ?? ''}/${(j.etd ?? '').slice(8, 10)}`,
      `RTG/${dest}${airline?.code ?? ''}`,
      'SHP', `/${e(shipper?.name)}`, `/${e(shipper?.address1)}`, `/${e(shipper?.city)}`,
      'CNE', `/${e(cnee?.name)}`, `/${e(cnee?.address1)}`, `/${e(cnee?.city)}`,
      'CVD/AED//PP/NVD/NCV/XXX', `RTD/1/P${j.packages ?? 1}/K${(j.gross_weight ?? 0).toFixed(1)}/C${(j.chargeable_weight ?? j.gross_weight ?? 0).toFixed(1)}`,
      `/NG/${e(j.commodity)}`, `OSI/${e(j.handling_info)}`, `REF/${e(j.job_no)}`,
    ]
    return { filename: `${j.job_no}-FWB.txt`, mime: 'text/plain', content: lines.join('\r\n') + '\r\n', note }
  }
  // UN/EDIFACT IFTMIN D.96A (instruction message)
  const ref = e(j.job_no)
  const segs: string[] = []
  const shipper = party(j.shipper_id ?? j.client_id), cnee = party(j.consignee_id), notify = party(j.notify_id)
  const nad = (q: string, p: any) => (p ? `NAD+${q}+++${e(p.name)}+${e(p.address1)}+${e(p.city)}++${e(p.po_box)}+${e(q === 'CZ' ? '' : '')}` : null)
  segs.push(`UNB+UNOC:3+ELVORA+PARTNER+${dt(nowLocal(), '203').slice(2, 8)}:${dt(nowLocal(), '203').slice(8, 12)}+${ref}`)
  segs.push(`UNH+1+IFTMIN:D:96A:UN`)
  segs.push(`BGM+610+${ref}+9`)
  segs.push(`DTM+137:${dt(j.job_date, '102')}:102`)
  if (j.etd) segs.push(`DTM+133:${dt(j.etd)}:203`)
  if (j.eta) segs.push(`DTM+132:${dt(j.eta)}:203`)
  if (j.freight_terms) segs.push(`TSR+${j.freight_terms === 'Prepaid' ? '2' : '3'}`)
  if (j.inco_terms) segs.push(`TOD+6++${j.inco_terms}`)
  if (por) segs.push(`LOC+88+${por.code}:139:6:${e(por.name)}`)
  if (pol) segs.push(`LOC+9+${pol.code}:139:6:${e(pol.name)}`)
  if (pod) segs.push(`LOC+11+${pod.code}:139:6:${e(pod.name)}`)
  if (pof) segs.push(`LOC+7+${pof.code}:139:6:${e(pof.name)}`)
  for (const [qf, p] of [['CZ', shipper], ['CN', cnee], ['NI', notify]] as const) { const n = nad(qf, p); if (n) segs.push(n) }
  if (j.vessel_name) segs.push(`TDT+20+${e(j.voyage_no)}+1++${e(L.carrier_id)}+++${e(j.vessel_id)}:146:11:${e(j.vessel_name)}`)
  if (j.mbl_no) segs.push(`RFF+BM:${e(j.mbl_no)}`)
  if (j.hbl_no) segs.push(`RFF+BH:${e(j.hbl_no)}`)
  if (j.booking_no) segs.push(`RFF+BN:${e(j.booking_no)}`)
  if (j.customer_ref) segs.push(`RFF+CU:${e(j.customer_ref)}`)
  let g = 0
  segs.push(`GID+${++g}+${j.packages ?? 1}:${e(j.package_type ?? 'PK')}`)
  if (j.commodity) segs.push(`FTX+AAA+++${e(j.commodity)}`)
  if (j.gross_weight) segs.push(`MEA+AAE+G+KGM:${j.gross_weight}`)
  if (j.volume_cbm) segs.push(`MEA+AAE+VOL+MTQ:${j.volume_cbm}`)
  if (j.is_hazardous === 'Yes') segs.push('DGS+IMD')
  for (const c of j.children.containers as Rec[]) {
    segs.push(`EQD+CN+${e(c.container_no)}+${e(c._labels?.type_id?.split(' ')[0])}:102:5++2+5`)
    if (c.seal_no) segs.push(`SEL+${e(c.seal_no)}+CA`)
  }
  segs.push(`UNT+${segs.length - 1}+1`)
  segs.push(`UNZ+1+${ref}`)
  return { filename: `${j.job_no}-IFTMIN.edi`, mime: 'text/plain', content: segs.map(s => s.replace(/\++$/, '') + "'").join('\r\n') + '\r\n', note }
}

export function trackingLinks(jobId: number) {
  const j = getRecord(getDef('jobs'), jobId, SYSTEM_CTX)
  const carrier = j.carrier_id ? q.get(`SELECT * FROM carriers WHERE id = ?`, j.carrier_id) : null
  const nums: { label: string; value: string }[] = []
  for (const c of j.children.containers as Rec[]) if (c.container_no) nums.push({ label: 'Container', value: c.container_no })
  if (j.mbl_no) nums.push({ label: modeOf(j.department) === 'Air' ? 'AWB' : 'MBL', value: j.mbl_no })
  if (j.booking_no) nums.push({ label: 'Booking', value: j.booking_no })
  const links = nums.map(n => ({ ...n, url: carrier?.tracking_url ? String(carrier.tracking_url).replace('{no}', encodeURIComponent(n.value)) : null }))
  return { carrier: carrier?.name ?? null, website: carrier?.website ?? null, links }
}

void ENTITIES

