import { q } from '../db'
import type { Hooks } from '../hooks'
import { bad, r2, toCents, todayStr, addDays, fromCents } from '../util'
import { createRecord, getDef, getRecord, patchRecord, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { notify, notifyRole } from '../notify'
import { getSetting } from '../settings'
import { queueEmail } from '../mailer'
import { addJobEvent } from './jobs'

const vatPct = (id: number | null | undefined) => (id ? q.val<number>(`SELECT rate FROM vat_codes WHERE id = ?`, id) ?? 0 : 0)

// ---------------------------------------------------------------- parties
export const partyHooks: Hooks = {
  beforeSave({ rec, old, isNew }) {
    if (!rec.is_customer && !rec.is_vendor && !rec.is_shipper && !rec.is_consignee && !rec.is_notify && !rec.is_agent && !rec.is_transporter && !rec.is_broker) throw bad('Tick at least one role (customer, vendor, agent …)')
    const dup = q.get(`SELECT code FROM parties WHERE lower(name) = lower(?) AND deleted_at IS NULL AND id <> ? LIMIT 1`, rec.name, rec.id ?? 0)
    if (dup) throw bad(`A party with this name already exists (${dup.code})`)
    if (rec.trn && !/^\d{15}$/.test(String(rec.trn).replace(/\s/g, ''))) throw bad('UAE TRN must be 15 digits (leave blank for non-UAE parties)')
    if (rec.trn) rec.trn = String(rec.trn).replace(/\s/g, '')
    if ((rec.credit_limit ?? 0) < 0) throw bad('Credit limit cannot be negative')
    void old; void isNew
  },
}

// ---------------------------------------------------------------- leads / opportunities / contracts
export const leadHooks: Hooks = {
  numberDate: () => todayStr(),
  beforeSave({ rec, old }) { if (old?.status === 'Converted' && rec.status !== 'Converted') throw bad('A converted lead cannot be reopened') },
}
export const opportunityHooks: Hooks = {
  beforeSave({ rec, old }) {
    if (rec.stage === 'Won') rec.probability = 100
    if (rec.stage === 'Lost') { rec.probability = 0 }
    if (rec.stage === 'Lost' && !rec.lost_reason) throw bad('Enter the reason the opportunity was lost')
    void old
  },
  afterSave({ rec, old, ctx }) {
    if (old && old.stage !== rec.stage && rec.stage === 'Won') notifyRole('crm', `Opportunity won: ${rec.title}`, `${rec.value}`, `/e/opportunities/${rec.id}`, 'info', `won-${rec.id}`)
    void ctx
  },
}
export const contractHooks: Hooks = {
  beforeSave({ rec }) { if (rec.start_date && rec.end_date && rec.end_date < rec.start_date) throw bad('End date is before start date') },
}

export function convertLead(leadId: number, ctx: Ctx): { party: Rec; opportunity: Rec } {
  const lead = getRecord(getDef('leads'), leadId, SYSTEM_CTX)
  if (lead.status === 'Converted') throw bad('Lead is already converted')
  let party = q.get(`SELECT id FROM parties WHERE lower(name) = lower(?) AND deleted_at IS NULL`, lead.company)
  let partyRec: Rec
  if (party) partyRec = getRecord(getDef('parties'), party.id, SYSTEM_CTX, { children: false })
  else partyRec = createRecord(getDef('parties'), { name: lead.company, is_customer: true, phone: lead.phone, email: lead.email, status: 'Active', salesperson_id: lead.owner_id ?? ctx.user?.id, source: lead.source, contact_person: lead.contact_name }, ctx)
  if (lead.contact_name) createRecord(getDef('contacts'), { name: lead.contact_name, party_id: partyRec.id, email: lead.email, phone: lead.phone, is_primary: true }, ctx)
  const opp = createRecord(getDef('opportunities'), { title: `${lead.company} – ${lead.interest ?? 'freight'}`, party_id: partyRec.id, value: lead.est_value ?? 0, owner_id: lead.owner_id ?? ctx.user?.id, origin: lead.origin, destination: lead.destination, mode: lead.interest, stage: 'Qualification', notes: lead.notes }, ctx)
  patchRecord(getDef('leads'), leadId, { status: 'Converted', converted_party_id: partyRec.id }, ctx)
  return { party: partyRec, opportunity: opp }
}

// ---------------------------------------------------------------- quotations
function recomputeQuote(id: number) {
  const lines = q.all(`SELECT amount, vat_amount, cost_amount FROM quotation_lines WHERE quote_id = ? AND deleted_at IS NULL`, id)
  const sub = lines.reduce((s, l) => s + (l.amount ?? 0), 0), vat = lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0), cost = lines.reduce((s, l) => s + (l.cost_amount ?? 0), 0)
  const margin = sub - cost
  q.run(`UPDATE quotations SET subtotal = ?, vat_total = ?, total = ?, total_cost = ?, margin = ?, margin_pct = ? WHERE id = ?`, sub, vat, sub + vat, cost, margin, sub > 0 ? Math.round((margin / sub) * 10000) / 100 : 0, id)
}

export const quoteHooks: Hooks = {
  numberDate: r => r.quote_date,
  beforeSave({ rec, old, children, isNew, ctx }) {
    if (!rec.valid_until && rec.quote_date) rec.valid_until = addDays(rec.quote_date, Number(getSetting('quote_validity_days')) || 14)
    if (rec.valid_until && rec.valid_until < rec.quote_date) throw bad('"Valid until" is before the quote date')
    if (!rec.terms) rec.terms = getSetting('quote_terms')
    if (rec.currency !== 'AED' && (!rec.ex_rate || rec.ex_rate <= 0)) throw bad('Enter the exchange rate for the quote currency')
    if (children.lines) {
      for (const l of children.lines) {
        const cc = l.charge_code_id ? q.get(`SELECT * FROM charge_codes WHERE id = ?`, l.charge_code_id) : null
        if (cc) { if (!l.description) l.description = cc.name; if (!l.vat_code_id && cc.vat_code_id) l.vat_code_id = cc.vat_code_id }
        l.qty = Number(l.qty ?? 1); l.rate = Number(l.rate ?? 0); l.cost_rate = Number(l.cost_rate ?? 0)
        if (l.qty < 0 || l.rate < 0 || l.cost_rate < 0) throw bad('Quantity and rates cannot be negative')
        l.amount = r2(l.qty * l.rate); l.cost_amount = r2(l.qty * l.cost_rate)
        l.vat_pct = vatPct(l.vat_code_id); l.vat_amount = r2(l.amount * l.vat_pct / 100)
      }
    }
    if (old && old.status !== rec.status) {
      const needsApproval = old.approval_status === 'Pending' || old.approval_status === 'Rejected'
      if (['Sent', 'Accepted', 'Converted to job'].includes(rec.status) && needsApproval && !ctx.system) throw bad('This quotation is below the minimum margin and needs approval before it can be sent.')
      if (rec.status === 'Accepted' && !['Sent', 'Approved', 'Accepted'].includes(old.status) && !ctx.system) throw bad('Send the quotation to the customer before marking it accepted')
    }
    if (old && ['Accepted', 'Converted to job'].includes(old.status) && children.lines && !ctx.system) throw bad('An accepted quotation cannot be edited. Create a revision instead.')
    void isNew
  },
  afterSave({ rec, old, children, isNew, ctx }) {
    recomputeQuote(rec.id)
    const row = q.get(`SELECT subtotal, total_cost, margin_pct, approval_status FROM quotations WHERE id = ?`, rec.id)!
    const minPct = Number(getSetting('min_margin_pct')) || 0
    const required = row.total_cost > 0 && row.subtotal > 0 && row.margin_pct < minPct
    if (!required && row.approval_status !== 'Not required') q.run(`UPDATE quotations SET approval_status = 'Not required' WHERE id = ?`, rec.id)
    else if (required && (row.approval_status === 'Not required' || (row.approval_status === 'Approved' && children.lines))) {
      q.run(`UPDATE quotations SET approval_status = 'Pending' WHERE id = ?`, rec.id)
      notifyRole('sales', `Quotation ${rec.quote_no} is below minimum margin`, `Margin ${row.margin_pct}% < ${minPct}%`, `/e/quotations/${rec.id}`, 'approval', `qm-${rec.id}`)
    }
    void old; void isNew; void ctx
  },
}

const DEPT: Record<string, [string, string]> = {
  'Ocean FCL': ['FCL EXPORT', 'FCL IMPORT'], 'Ocean LCL': ['LCL EXPORT', 'LCL IMPORT'], Air: ['AIR EXPORT', 'AIR IMPORT'], Road: ['ROAD EXPORT', 'ROAD IMPORT'],
  'Customs clearance': ['CUSTOMS CLEARANCE', 'CUSTOMS CLEARANCE'], Warehousing: ['WAREHOUSING', 'WAREHOUSING'], 'Project cargo': ['PROJECT CARGO', 'PROJECT CARGO'], Multimodal: ['CROSS TRADE', 'CROSS TRADE'],
}

export function convertQuoteToJob(quoteId: number, ctx: Ctx): Rec {
  const quote = getRecord(getDef('quotations'), quoteId, SYSTEM_CTX)
  if (quote.job_id) throw bad('This quotation has already been converted')
  if (!['Accepted', 'Approved', 'Sent'].includes(quote.status)) throw bad('Only sent, approved or accepted quotations can be converted to a job')
  if (['Pending', 'Rejected'].includes(quote.approval_status)) throw bad('The quotation needs margin approval before conversion')
  const branchId = ctx.user?.branch_id ?? q.val<number>(`SELECT id FROM branches WHERE is_head_office = 1 AND deleted_at IS NULL LIMIT 1`) ?? q.val<number>(`SELECT id FROM branches WHERE deleted_at IS NULL ORDER BY id LIMIT 1`)
  if (!branchId) throw bad('Create a branch first')
  const imp = quote.trade === 'Import'
  const dept = (DEPT[quote.mode] ?? ['FCL EXPORT', 'FCL IMPORT'])[imp ? 1 : 0]
  const lines = quote.children.lines as Rec[]
  const charges: Rec[] = []
  for (const l of lines) {
    charges.push({ kind: 'Revenue', charge_code_id: l.charge_code_id, description: l.description, party_id: quote.customer_id, basis: l.basis, qty: l.qty, rate: l.rate, currency: quote.currency, ex_rate: quote.ex_rate, vat_code_id: l.vat_code_id })
    if (l.cost_rate > 0) charges.push({ kind: 'Cost', charge_code_id: l.charge_code_id, description: l.description, basis: l.basis, qty: l.qty, rate: l.cost_rate, currency: quote.currency, ex_rate: quote.ex_rate, vat_code_id: l.vat_code_id })
  }
  const job = createRecord(getDef('jobs'), {
    client_id: quote.customer_id, branch_id: branchId, department: dept, trade: quote.trade === 'Import' ? 'Import' : quote.trade === 'Cross trade' ? 'Cross trade' : 'Export', job_date: todayStr(), pol_id: quote.pol_id, pod_id: quote.pod_id, por_id: quote.pol_id, pof_id: quote.pod_id,
    place_of_receipt: quote.place_of_receipt, place_of_delivery: quote.place_of_delivery, inco_terms: quote.inco_terms, service_type: quote.service_type, commodity: quote.commodity, packages: quote.packages, gross_weight: quote.gross_weight, volume_cbm: quote.volume_cbm,
    is_hazardous: quote.is_hazardous ? 'Yes' : 'No', salesperson_id: quote.salesperson_id, quote_id: quoteId, operator_id: ctx.user?.id, remarks: `Created from quotation ${quote.quote_no}`, children: { charges },
  }, ctx)
  patchRecord(getDef('quotations'), quoteId, { status: 'Converted to job', job_id: job.id }, ctx)
  addJobEvent(job.id, 'Note', { description: `Created from quotation ${quote.quote_no}`, user_id: ctx.user?.id })
  if (quote.opportunity_id) q.run(`UPDATE opportunities SET stage = 'Won', probability = 100 WHERE id = ? AND stage <> 'Won'`, quote.opportunity_id)
  return job
}

export function reviseQuote(quoteId: number, ctx: Ctx): Rec {
  const def = getDef('quotations')
  const qt = getRecord(def, quoteId, SYSTEM_CTX)
  const copy: Rec = {}
  for (const f of def.fields) { if (f.readonly || f.computed) continue; copy[f.name] = qt[f.name] }
  copy.quote_date = todayStr(); copy.valid_until = null; copy.status = 'Draft'; copy.revision = (qt.revision ?? 1) + 1; copy.notes = `Revision ${copy.revision} of ${qt.quote_no}. ${qt.notes ?? ''}`.trim()
  copy.children = { lines: qt.children.lines.map((l: Rec) => ({ charge_code_id: l.charge_code_id, description: l.description, basis: l.basis, qty: l.qty, rate: l.rate, cost_rate: l.cost_rate, vat_code_id: l.vat_code_id })) }
  return createRecord(def, copy, ctx)
}

export function sendQuote(quoteId: number, to: string | undefined, message: string | undefined, ctx: Ctx): { queued: number; status: string } {
  const qt = getRecord(getDef('quotations'), quoteId, SYSTEM_CTX)
  if (['Pending', 'Rejected'].includes(qt.approval_status)) throw bad('The quotation needs margin approval before it can be sent')
  let addr = to
  if (!addr) {
    const c = qt.contact_id ? q.get(`SELECT email FROM contacts WHERE id = ?`, qt.contact_id) : q.get(`SELECT email FROM contacts WHERE party_id = ? AND email <> '' AND deleted_at IS NULL ORDER BY is_primary DESC LIMIT 1`, qt.customer_id)
    addr = c?.email ?? q.val<string>(`SELECT email FROM parties WHERE id = ?`, qt.customer_id) ?? undefined
  }
  if (!addr) throw bad('No e-mail address found for the customer — enter one to send to')
  const co = getSetting<string>('company_name')
  const lines = (qt.children.lines as Rec[]).map(l => `  • ${l.description ?? ''} — ${l.qty} × ${l.rate.toFixed(2)} ${qt.currency} = ${l.amount.toFixed(2)}`).join('\n')
  const body = `${message ? message + '\n\n' : ''}Dear Sir / Madam,\n\nPlease find our quotation ${qt.quote_no} for ${qt._labels.pol_id ?? ''} → ${qt._labels.pod_id ?? ''} (${qt.mode}).\n\n${lines}\n\nTotal: ${qt.total.toFixed(2)} ${qt.currency} (VAT ${qt.vat_total.toFixed(2)} included)\nValid until: ${qt.valid_until}\n\n${qt.terms ?? ''}\n\nBest regards,\n${ctx.user?.name ?? ''}\n${co}`
  const id = queueEmail({ to: addr, subject: `Quotation ${qt.quote_no} – ${co}`, body, link_entity: 'quotations', link_id: quoteId, userId: ctx.user?.id })
  if (['Draft', 'Approved'].includes(qt.status)) patchRecord(getDef('quotations'), quoteId, { status: 'Sent' }, ctx)
  notify(qt.salesperson_id, `Quotation ${qt.quote_no} sent`, addr, `/e/quotations/${quoteId}`)
  return { queued: id, status: 'Sent' }
}

void toCents; void fromCents
