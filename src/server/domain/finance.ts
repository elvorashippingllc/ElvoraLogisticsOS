import crypto from 'node:crypto'
import { q, qi } from '../db'
import type { Hooks } from '../hooks'
import { bad, r2, toCents, todayStr, addDays, fromCents } from '../util'
import { getDef, getRecord, patchRecord, formatNumber, can, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { accountByRole, accountByCode, assertNotLocked, BASE, fxRate, postJournal, reverseJournal, type JLine } from './accounting'
import { getSetting } from '../settings'
import { notify, notifyRole } from '../notify'
import { checkInvoicePosting, checkBillPosting } from './compliance'
import { ENTITIES } from '../../shared/entities'

const vatPct = (id: number | null | undefined) => (id ? q.val<number>(`SELECT rate FROM vat_codes WHERE id = ?`, id) ?? 0 : 0)
const chargeCode = (id: number | null | undefined) => (id ? q.get(`SELECT * FROM charge_codes WHERE id = ?`, id) : undefined)

function computeLines(rows: Rec[], side: 'income' | 'cost') {
  for (const l of rows) {
    const cc = chargeCode(l.charge_code_id)
    if (cc) {
      if (!l.description) l.description = cc.name
      if (!l.vat_code_id && cc.vat_code_id) l.vat_code_id = cc.vat_code_id
      if (!l.account_id) l.account_id = side === 'income' ? cc.income_account_id : cc.cost_account_id
      if ((l.rate === undefined || l.rate === null) && side === 'income' && cc.default_rate) l.rate = cc.default_rate / 100
    }
    if (!l.account_id) l.account_id = accountByRole(side === 'income' ? 'default_revenue' : 'default_cost')
    const qty = Number(l.qty ?? 1); const rate = Number(l.rate ?? 0)
    if (qty < 0 || rate < 0) throw bad('Quantity and rate cannot be negative')
    l.qty = qty; l.rate = rate
    l.amount = r2(qty * rate)
    l.vat_pct = vatPct(l.vat_code_id)
    l.vat_amount = r2(l.amount * l.vat_pct / 100)
    l.line_total = r2(l.amount + l.vat_amount)
  }
}

function resolveDue(rec: Rec, dateField: string, partyId: number | null) {
  if (rec.due_date) return
  let days: number | null = null
  if (rec.payment_term_id) days = q.val<number>(`SELECT days FROM payment_terms WHERE id = ?`, rec.payment_term_id) ?? null
  if (days === null && partyId) days = q.val<number>(`SELECT credit_days FROM parties WHERE id = ?`, partyId) ?? null
  rec.due_date = addDays(rec[dateField], days ?? 0)
}

function lockCheck(args: { rec: Rec; old: Rec | null; children: Record<string, Rec[]>; def: any; ctx: Ctx }, editable: string[], what: string) {
  const { rec, old, children, def, ctx } = args
  if (!old || old.status === 'Draft' || ctx.system) return false
  if (Object.keys(children).length) throw bad(`Posted ${what} cannot be changed. Void it or issue a credit note.`)
  for (const f of def.fields) {
    if (editable.includes(f.name) || f.computed || f.readonly || f.virtual || f.secret) continue
    if (JSON.stringify(rec[f.name] ?? null) !== JSON.stringify(old[f.name] ?? null)) throw bad(`Posted ${what} cannot be changed (${f.label}). Void it or issue a credit note.`)
  }
  return true
}

// ============================================================ INVOICES
export function recomputeInvoiceTotals(id: number) {
  const inv = q.get(`SELECT ex_rate FROM invoices WHERE id = ?`, id)
  if (!inv) return
  const ex = inv.ex_rate || 1
  const lines = q.all(`SELECT amount, vat_amount FROM invoice_lines WHERE invoice_id = ? AND deleted_at IS NULL`, id)
  const sub = lines.reduce((s, l) => s + (l.amount ?? 0), 0), vat = lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0)
  const base = lines.reduce((s, l) => s + toCents(r2(((l.amount ?? 0) / 100) * ex)) + toCents(r2(((l.vat_amount ?? 0) / 100) * ex)), 0)
  q.run(`UPDATE invoices SET subtotal = ?, vat_total = ?, total = ?, base_total = ?, balance = ? - COALESCE(paid_amount, 0) WHERE id = ?`, sub, vat, sub + vat, base, sub + vat, id)
}

export const invoiceHooks: Hooks = {
  tokens: rec => ({ prefix: ({ 'Tax Invoice': 'INV', 'Proforma Invoice': 'PI', 'Debit Note': 'DN', 'Credit Note': 'CN' } as Record<string, string>)[rec.doc_type] ?? 'INV' }),
  numberDate: rec => rec.invoice_date,
  beforeSave(a) {
    const { rec, old, children, isNew } = a
    if (lockCheck(a, ['notes', 'terms', 'reference', 'bank_account_id'], 'invoices')) return
    rec.ex_rate = fxRate(rec.currency, rec.ex_rate)
    if (['Credit Note', 'Debit Note'].includes(rec.doc_type) && !rec.original_invoice_id && rec.doc_type === 'Credit Note') {
      // a credit note may stand alone (e.g. goodwill) – allowed
    }
    if (rec.original_invoice_id) {
      const o = q.get(`SELECT party_id, currency FROM invoices WHERE id = ?`, rec.original_invoice_id)
      if (o && o.party_id !== rec.party_id) throw bad('The original invoice belongs to a different customer')
      if (o && o.currency !== rec.currency) throw bad('A credit/debit note must use the currency of the original invoice')
    }
    const party = q.get(`SELECT status, name FROM parties WHERE id = ?`, rec.party_id)
    if (isNew && party?.status === 'Blocked') throw bad(`${party.name} is blocked — documents cannot be raised`)
    resolveDue(rec, 'invoice_date', rec.party_id)
    if (isNew) { rec.status = 'Draft'; rec.paid_amount = 0; rec.invoice_no = 'DRAFT-' + crypto.randomBytes(4).toString('hex') }
    if (children.lines) computeLines(children.lines, 'income')
  },
  afterSave({ rec, isNew }) {
    if (isNew) q.run(`UPDATE invoices SET invoice_no = 'DRAFT-' || id WHERE id = ?`, rec.id)
    recomputeInvoiceTotals(rec.id)
  },
}

export function refreshInvoiceBalance(id: number) {
  const inv = q.get(`SELECT * FROM invoices WHERE id = ?`, id)
  if (!inv || ['Draft', 'Void'].includes(inv.status)) return
  const alloc = q.val<number>(`SELECT COALESCE(SUM(ra.amount),0) FROM receipt_allocations ra JOIN receipts r ON r.id = ra.receipt_id WHERE ra.invoice_id = ? AND r.status = 'Posted' AND ra.deleted_at IS NULL`, id) ?? 0
  const cn = inv.doc_type === 'Credit Note' ? 0 : (q.val<number>(`SELECT COALESCE(SUM(paid_amount),0) FROM invoices WHERE original_invoice_id = ? AND doc_type = 'Credit Note' AND status IN ('Posted','Paid') AND deleted_at IS NULL`, id) ?? 0)
  const paid = inv.doc_type === 'Credit Note' ? inv.paid_amount : alloc + cn
  const bal = inv.total - paid
  const status = bal <= 0 ? 'Paid' : paid > 0 ? 'Partially paid' : 'Posted'
  q.run(`UPDATE invoices SET paid_amount = ?, balance = ?, status = ?, version = version + 1 WHERE id = ?`, paid, bal, status, id)
}

export function partyOutstanding(partyId: number): number {
  const ar = q.val<number>(`SELECT COALESCE(SUM(CASE WHEN doc_type = 'Credit Note' THEN -(total - paid_amount) ELSE balance END * ex_rate), 0) FROM invoices WHERE party_id = ? AND status IN ('Posted','Partially paid','Paid') AND deleted_at IS NULL AND doc_type <> 'Proforma Invoice' AND (balance > 0 OR doc_type = 'Credit Note')`, partyId) ?? 0
  return fromCents(ar)
}

export function postInvoice(id: number, ctx: Ctx): Rec {
  const def = getDef('invoices')
  const inv = getRecord(def, id, SYSTEM_CTX)
  if (inv.status !== 'Draft') throw bad('Only draft documents can be posted')
  const lines: Rec[] = inv.children.lines
  if (!lines.length) throw bad('Add at least one line before posting')
  if (inv.total <= 0) throw bad('Document total must be greater than zero')
  assertNotLocked(inv.invoice_date)
  checkInvoicePosting(inv, lines)
  const ex = inv.ex_rate || 1
  const isCN = inv.doc_type === 'Credit Note'
  const proforma = inv.doc_type === 'Proforma Invoice'

  if (!proforma && !isCN) {
    const party = q.get(`SELECT credit_limit, name FROM parties WHERE id = ?`, inv.party_id)!
    const limit = fromCents(party?.credit_limit ?? 0)
    if (limit > 0 && !can(ctx.user, 'finance', 'approve') && !ctx.system) {
      const after = partyOutstanding(inv.party_id) + inv.base_total
      if (after > limit) throw bad(`Credit limit exceeded for ${party.name}: exposure would be ${r2(after).toLocaleString()} against a limit of ${limit.toLocaleString()}. A finance approver must post this document.`)
    }
  }

  const prefix = ({ 'Tax Invoice': 'INV', 'Proforma Invoice': 'PI', 'Debit Note': 'DN', 'Credit Note': 'CN' } as Record<string, string>)[inv.doc_type] ?? 'INV'
  const number = formatNumber('invoices', def.numbering!.pattern, { prefix }, inv.invoice_date)

  if (!proforma) for (const l of lines) if (l.job_charge_id) {
    const st = q.get(`SELECT status, invoice_id, description FROM job_charges WHERE id = ?`, l.job_charge_id)
    if (st && st.status !== 'Unbilled' && st.invoice_id !== id) throw bad(`Charge "${st.description}" has already been invoiced on another document`)
  }
  let journalId: number | null = null
  let totalBase = 0
  const jl: JLine[] = []
  if (!proforma) {
    const byAcc = new Map<number, number>()
    let vatBase = 0
    for (const l of lines) {
      const b = r2(l.amount * ex); const v = r2(l.vat_amount * ex)
      byAcc.set(l.account_id, r2((byAcc.get(l.account_id) ?? 0) + b)); vatBase = r2(vatBase + v)
    }
    const revTotal = r2([...byAcc.values()].reduce((s, x) => s + x, 0))
    totalBase = r2(revTotal + vatBase)
    const ar = accountByRole('ar_control')
    const desc = `${inv.doc_type} ${number}${inv.currency !== BASE() ? ` (${inv.currency} ${inv.total})` : ''}`
    if (!isCN) jl.push({ account_id: ar, party_id: inv.party_id, job_id: inv.job_id, description: desc, debit: totalBase })
    else jl.push({ account_id: ar, party_id: inv.party_id, job_id: inv.job_id, description: desc, credit: totalBase })
    for (const [acc, amt] of byAcc) jl.push({ account_id: acc, job_id: inv.job_id, description: desc, ...(isCN ? { debit: amt } : { credit: amt }) })
    if (vatBase) jl.push({ account_id: accountByRole('vat_output'), job_id: inv.job_id, description: `VAT – ${number}`, ...(isCN ? { debit: vatBase } : { credit: vatBase }) })
    journalId = postJournal(ctx, { date: inv.invoice_date, memo: desc, source_type: inv.doc_type, source_id: id, source_no: number, branch_id: inv.branch_id, lines: jl })
  } else totalBase = inv.base_total

  let applied = 0
  if (isCN && inv.original_invoice_id) {
    const o = q.get(`SELECT balance, status FROM invoices WHERE id = ?`, inv.original_invoice_id)
    if (o && ['Posted', 'Partially paid'].includes(o.status)) applied = Math.min(toCents(inv.total), o.balance) / 100
  }
  patchRecord(def, id, { invoice_no: number, status: 'Posted', journal_id: journalId, base_total: totalBase, paid_amount: isCN ? applied : 0 }, ctx)
  q.run(`UPDATE invoices SET invoice_no = ?, status = 'Posted', journal_id = ? WHERE id = ?`, number, journalId, id)
  q.run(`UPDATE compliance_exceptions SET link_label = ? WHERE link_entity = 'invoices' AND link_id = ? AND status <> 'Resolved'`, number, id)
  if (isCN) { const p = toCents(applied); q.run(`UPDATE invoices SET paid_amount = ?, balance = total - ?, status = CASE WHEN total - ? <= 0 THEN 'Paid' ELSE 'Posted' END WHERE id = ?`, p, p, p, id) }
  else q.run(`UPDATE invoices SET balance = total WHERE id = ?`, id)
  if (isCN && inv.original_invoice_id) refreshInvoiceBalance(inv.original_invoice_id)

  if (!proforma) for (const l of lines) if (l.job_charge_id) q.run(`UPDATE job_charges SET status = 'Invoiced', invoice_id = ? WHERE id = ?`, id, l.job_charge_id)
  return getRecord(def, id, SYSTEM_CTX)
}

export function voidInvoice(id: number, reason: string, ctx: Ctx): Rec {
  const def = getDef('invoices')
  const inv = getRecord(def, id, SYSTEM_CTX)
  if (inv.status === 'Void') throw bad('Already void')
  if (!reason?.trim()) throw bad('A reason is required')
  if (inv.status !== 'Draft') {
    if (inv.paid_amount > 0 && inv.doc_type !== 'Credit Note') throw bad('This invoice has payments or credit notes applied. Void the receipts / credit notes first.')
    assertNotLocked(todayStr())
    if (inv.journal_id) reverseJournal(ctx, inv.journal_id, `Void ${inv.invoice_no}: ${reason}`)
  }
  patchRecord(def, id, { status: 'Void', void_reason: reason.trim() }, ctx)
  q.run(`UPDATE job_charges SET status = 'Unbilled', invoice_id = NULL WHERE invoice_id = ?`, id)
  if (inv.doc_type === 'Credit Note' && inv.original_invoice_id) refreshInvoiceBalance(inv.original_invoice_id)
  return getRecord(def, id, SYSTEM_CTX)
}

// ============================================================ BILLS
export function recomputeBillTotals(id: number) {
  const b = q.get(`SELECT ex_rate FROM bills WHERE id = ?`, id)
  if (!b) return
  const ex = b.ex_rate || 1
  const lines = q.all(`SELECT amount, vat_amount FROM bill_lines WHERE bill_id = ? AND deleted_at IS NULL`, id)
  const sub = lines.reduce((s, l) => s + (l.amount ?? 0), 0), vat = lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0)
  const base = lines.reduce((s, l) => s + toCents(r2(((l.amount ?? 0) / 100) * ex)) + toCents(r2(((l.vat_amount ?? 0) / 100) * ex)), 0)
  q.run(`UPDATE bills SET subtotal = ?, vat_total = ?, total = ?, base_total = ?, balance = ? - COALESCE(paid_amount, 0) WHERE id = ?`, sub, vat, sub + vat, base, sub + vat, id)
}

export const billHooks: Hooks = {
  numberDate: rec => rec.bill_date,
  beforeSave(a) {
    const { rec, isNew, children } = a
    if (lockCheck(a, ['notes'], 'bills')) return
    rec.ex_rate = fxRate(rec.currency, rec.ex_rate)
    resolveDue(rec, 'bill_date', rec.vendor_id)
    const dup = q.val<number>(`SELECT id FROM bills WHERE vendor_id = ? AND lower(vendor_invoice_no) = lower(?) AND deleted_at IS NULL AND status <> 'Void' AND id <> ? LIMIT 1`, rec.vendor_id, rec.vendor_invoice_no, rec.id ?? 0)
    if (dup) throw bad(`Vendor invoice ${rec.vendor_invoice_no} has already been entered for this vendor`)
    if (isNew) { rec.status = 'Draft'; rec.paid_amount = 0 }
    if (children.lines) computeLines(children.lines, 'cost')
  },
  afterSave({ rec }) { recomputeBillTotals(rec.id) },
}

export function refreshBillBalance(id: number) {
  const b = q.get(`SELECT * FROM bills WHERE id = ?`, id)
  if (!b || ['Draft', 'Void'].includes(b.status)) return
  const paid = q.val<number>(`SELECT COALESCE(SUM(pa.amount),0) FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.bill_id = ? AND p.status = 'Posted' AND pa.deleted_at IS NULL`, id) ?? 0
  const bal = b.total - paid
  q.run(`UPDATE bills SET paid_amount = ?, balance = ?, status = ?, version = version + 1 WHERE id = ?`, paid, bal, bal <= 0 ? 'Paid' : paid > 0 ? 'Partially paid' : 'Posted', id)
}

export function postBill(id: number, ctx: Ctx): Rec {
  const def = getDef('bills')
  const b = getRecord(def, id, SYSTEM_CTX)
  if (b.status !== 'Draft') throw bad('Only draft bills can be posted')
  const lines: Rec[] = b.children.lines
  if (!lines.length) throw bad('Add at least one line before posting')
  if (b.total <= 0) throw bad('Bill total must be greater than zero')
  assertNotLocked(b.bill_date)
  checkBillPosting(b, lines)
  const limit = Number(getSetting('bill_approval_limit')) || 0
  if (limit > 0 && b.base_total >= limit && b.approval_status !== 'Approved' && !can(ctx.user, 'finance', 'approve') && !ctx.system) {
    throw bad(`Bills of ${limit.toLocaleString()} ${BASE()} or more need approval. Request approval first.`)
  }
  const ex = b.ex_rate || 1
  const byAcc = new Map<number, number>(); let vatBase = 0
  for (const l of lines) { byAcc.set(l.account_id, r2((byAcc.get(l.account_id) ?? 0) + r2(l.amount * ex))); vatBase = r2(vatBase + r2(l.vat_amount * ex)) }
  const costTotal = r2([...byAcc.values()].reduce((s, x) => s + x, 0))
  const totalBase = r2(costTotal + vatBase)
  const desc = `Bill ${b.bill_no} – ${b.vendor_invoice_no}${b.currency !== BASE() ? ` (${b.currency} ${b.total})` : ''}`
  const jl: JLine[] = [{ account_id: accountByRole('ap_control'), party_id: b.vendor_id, job_id: b.job_id, description: desc, credit: totalBase }]
  for (const [acc, amt] of byAcc) jl.push({ account_id: acc, job_id: b.job_id, description: desc, debit: amt })
  if (vatBase) jl.push({ account_id: accountByRole('vat_input'), job_id: b.job_id, description: `Input VAT – ${b.bill_no}`, debit: vatBase })
  const journalId = postJournal(ctx, { date: b.bill_date, memo: desc, source_type: 'Vendor bill', source_id: id, source_no: b.bill_no, branch_id: b.branch_id, lines: jl })
  patchRecord(def, id, { status: 'Posted', journal_id: journalId }, ctx)
  q.run(`UPDATE bills SET status = 'Posted', journal_id = ?, balance = total WHERE id = ?`, journalId, id)
  for (const l of lines) if (l.job_charge_id) q.run(`UPDATE job_charges SET status = 'Billed', bill_id = ? WHERE id = ?`, id, l.job_charge_id)
  return getRecord(def, id, SYSTEM_CTX)
}

export function voidBill(id: number, reason: string, ctx: Ctx): Rec {
  const def = getDef('bills')
  const b = getRecord(def, id, SYSTEM_CTX)
  if (b.status === 'Void') throw bad('Already void')
  if (!reason?.trim()) throw bad('A reason is required')
  if (b.status !== 'Draft') {
    if (b.paid_amount > 0) throw bad('Payments are applied to this bill. Void the payments first.')
    assertNotLocked(todayStr())
    if (b.journal_id) reverseJournal(ctx, b.journal_id, `Void ${b.bill_no}: ${reason}`)
  }
  patchRecord(def, id, { status: 'Void', void_reason: reason.trim() }, ctx)
  q.run(`UPDATE job_charges SET status = 'Unbilled', bill_id = NULL WHERE bill_id = ?`, id)
  return getRecord(def, id, SYSTEM_CTX)
}

// ============================================================ RECEIPTS & PAYMENTS
function settleHook(kind: 'receipt' | 'payment'): Hooks['beforeSave'] {
  return (a) => {
    const { rec, old, isNew, children } = a
    if (lockCheck(a, ['notes', 'reference'], kind === 'receipt' ? 'receipts' : 'payments')) return
    rec.ex_rate = fxRate(rec.currency, rec.ex_rate)
    if (isNew) rec.status = 'Draft'
    if (!(rec.amount > 0)) throw bad('Amount must be greater than zero')
    const rows = children.allocations
    if (rows) {
      let sum = 0
      const seen = new Set<number>()
      for (const al of rows) {
        const docKey = kind === 'receipt' ? 'invoice_id' : 'bill_id'
        const id = al[docKey]
        if (seen.has(id)) throw bad('A document appears twice in the allocation list')
        seen.add(id)
        const doc = q.get(`SELECT * FROM ${kind === 'receipt' ? 'invoices' : 'bills'} WHERE id = ?`, id)
        if (!doc) throw bad('Allocated document not found')
        const partyId = kind === 'receipt' ? rec.party_id : rec.vendor_id
        if ((kind === 'receipt' ? doc.party_id : doc.vendor_id) !== partyId) throw bad('Allocated document belongs to a different party')
        if (doc.currency !== rec.currency) throw bad(`Allocate only ${doc.currency} documents to this ${rec.currency} ${kind}`)
        if (!['Posted', 'Partially paid'].includes(doc.status)) throw bad(`${doc.invoice_no ?? doc.bill_no} is ${doc.status} and cannot be settled`)
        if (kind === 'receipt' && doc.doc_type === 'Credit Note') throw bad('Credit notes cannot be settled with a receipt')
        if (kind === 'receipt' && doc.doc_type === 'Proforma Invoice') throw bad('Proforma invoices cannot be settled')
        const a2 = Number(al.amount) || 0
        if (a2 <= 0) throw bad('Allocation amounts must be positive')
        const openCents = doc.balance + (old && old.status === 'Draft' ? 0 : 0)
        if (toCents(a2) > openCents) throw bad(`Allocation to ${doc.invoice_no ?? doc.bill_no} exceeds its open balance of ${fromCents(openCents)}`)
        sum = r2(sum + a2)
      }
      if (sum > r2(rec.amount) + 0.001) throw bad('Allocations exceed the amount')
    }
  }
}

export function syncAllocationTotals(table: 'receipts' | 'payments', id: number) {
  const child = table === 'receipts' ? 'receipt_allocations' : 'payment_allocations'
  const fk = table === 'receipts' ? 'receipt_id' : 'payment_id'
  const alloc = q.val<number>(`SELECT COALESCE(SUM(amount),0) FROM ${child} WHERE ${fk} = ? AND deleted_at IS NULL`, id) ?? 0
  q.run(`UPDATE ${table} SET allocated = ?, unallocated = amount - ? WHERE id = ?`, alloc, alloc, id)
}

export const receiptHooks: Hooks = { numberDate: r => r.receipt_date, beforeSave: settleHook('receipt'), afterSave: ({ rec }) => syncAllocationTotals('receipts', rec.id) }
export const paymentHooks: Hooks = { numberDate: r => r.payment_date, beforeSave: settleHook('payment'), afterSave: ({ rec }) => syncAllocationTotals('payments', rec.id) }

function bankGl(bankAccountId: number): number {
  const gl = q.val<number>(`SELECT gl_account_id FROM bank_accounts WHERE id = ? AND deleted_at IS NULL`, bankAccountId)
  if (!gl) throw bad('The bank account has no GL account configured')
  return gl
}

export function postReceipt(id: number, ctx: Ctx): Rec {
  const def = getDef('receipts')
  const r = getRecord(def, id, SYSTEM_CTX)
  if (r.status !== 'Draft') throw bad('Only draft receipts can be posted')
  assertNotLocked(r.receipt_date)
  const allocs: Rec[] = r.children.allocations
  const ar = accountByRole('ar_control')
  const baseAmt = r2(r.amount * r.ex_rate)
  const memo = `Receipt ${r.receipt_no}${r.reference ? ' – ' + r.reference : ''}`
  const jl: JLine[] = [{ account_id: bankGl(r.bank_account_id), party_id: r.party_id, description: memo, debit: baseAmt }]
  let creditedBase = 0; let allocated = 0
  const fxId = (() => { try { return accountByRole('fx_gain_loss') } catch { return null } })()
  for (const al of allocs) {
    const inv = q.get(`SELECT * FROM invoices WHERE id = ?`, al.invoice_id)!
    const amt = al.amount
    const arBase = r2(amt * inv.ex_rate)
    const recvBase = r2(amt * r.ex_rate)
    jl.push({ account_id: ar, party_id: r.party_id, job_id: inv.job_id, description: `${memo} → ${inv.invoice_no}`, credit: arBase })
    creditedBase = r2(creditedBase + arBase); allocated = r2(allocated + amt)
    const diff = r2(recvBase - arBase)
    if (diff !== 0) {
      if (!fxId) throw bad('Configure an FX gain/loss account to settle foreign-currency invoices')
      jl.push({ account_id: fxId, description: `FX difference ${inv.invoice_no}`, ...(diff > 0 ? { credit: diff } : { debit: -diff }) })
      creditedBase = r2(creditedBase + diff)
    }
  }
  const rest = r2(r.amount - allocated)
  if (rest > 0) { const b = r2(rest * r.ex_rate); jl.push({ account_id: ar, party_id: r.party_id, description: `${memo} – on account`, credit: b }); creditedBase = r2(creditedBase + b) }
  if (r2(creditedBase) !== baseAmt) { // rounding residue goes to the AR line to keep the entry balanced
    const d = r2(baseAmt - creditedBase); const last = jl.find(l => l.credit && l.account_id === ar)
    if (last) last.credit = r2((last.credit ?? 0) + d)
  }
  const journalId = postJournal(ctx, { date: r.receipt_date, memo, source_type: 'Receipt', source_id: id, source_no: r.receipt_no, lines: jl })
  patchRecord(def, id, { status: 'Posted', journal_id: journalId }, ctx)
  q.run(`UPDATE receipts SET status = 'Posted', journal_id = ? WHERE id = ?`, journalId, id)
  for (const al of allocs) refreshInvoiceBalance(al.invoice_id)
  return getRecord(def, id, SYSTEM_CTX)
}

export function voidReceipt(id: number, reason: string, ctx: Ctx): Rec {
  const def = getDef('receipts')
  const r = getRecord(def, id, SYSTEM_CTX)
  if (r.status === 'Void') throw bad('Already void')
  if (!reason?.trim()) throw bad('A reason is required')
  if (r.status === 'Posted') { assertNotLocked(todayStr()); if (r.journal_id) reverseJournal(ctx, r.journal_id, `Void ${r.receipt_no}: ${reason}`) }
  const invs = (r.children.allocations as Rec[]).map(a => a.invoice_id)
  q.run(`UPDATE receipts SET status = 'Void' WHERE id = ?`, id)
  patchRecord(def, id, { status: 'Void' }, ctx)
  for (const i of invs) refreshInvoiceBalance(i)
  return getRecord(def, id, SYSTEM_CTX)
}

export function postPayment(id: number, ctx: Ctx): Rec {
  const def = getDef('payments')
  const p = getRecord(def, id, SYSTEM_CTX)
  if (p.status !== 'Draft') throw bad('Only draft payments can be posted')
  assertNotLocked(p.payment_date)
  const limit = Number(getSetting('payment_approval_limit')) || 0
  if (limit > 0 && r2(p.amount * p.ex_rate) >= limit && p.approval_status !== 'Approved' && !can(ctx.user, 'finance', 'approve') && !ctx.system) throw bad(`Payments of ${limit.toLocaleString()} ${BASE()} or more need approval. Request approval first.`)
  const allocs: Rec[] = p.children.allocations
  const ap = accountByRole('ap_control')
  const baseAmt = r2(p.amount * p.ex_rate)
  const memo = `Payment ${p.payment_no}${p.reference ? ' – ' + p.reference : ''}`
  const jl: JLine[] = [{ account_id: bankGl(p.bank_account_id), party_id: p.vendor_id, description: memo, credit: baseAmt }]
  let debited = 0; let allocated = 0
  const fxId = (() => { try { return accountByRole('fx_gain_loss') } catch { return null } })()
  for (const al of allocs) {
    const bill = q.get(`SELECT * FROM bills WHERE id = ?`, al.bill_id)!
    const apBase = r2(al.amount * bill.ex_rate); const paidBase = r2(al.amount * p.ex_rate)
    jl.push({ account_id: ap, party_id: p.vendor_id, job_id: bill.job_id, description: `${memo} → ${bill.bill_no}`, debit: apBase })
    debited = r2(debited + apBase); allocated = r2(allocated + al.amount)
    const diff = r2(paidBase - apBase)
    if (diff !== 0) {
      if (!fxId) throw bad('Configure an FX gain/loss account to settle foreign-currency bills')
      jl.push({ account_id: fxId, description: `FX difference ${bill.bill_no}`, ...(diff > 0 ? { debit: diff } : { credit: -diff }) })
      debited = r2(debited + diff)
    }
  }
  const rest = r2(p.amount - allocated)
  if (rest > 0) { const b = r2(rest * p.ex_rate); jl.push({ account_id: ap, party_id: p.vendor_id, description: `${memo} – advance`, debit: b }); debited = r2(debited + b) }
  if (r2(debited) !== baseAmt) { const d = r2(baseAmt - debited); const last = jl.find(l => l.debit && l.account_id === ap); if (last) last.debit = r2((last.debit ?? 0) + d) }
  const journalId = postJournal(ctx, { date: p.payment_date, memo, source_type: 'Payment', source_id: id, source_no: p.payment_no, lines: jl })
  patchRecord(def, id, { status: 'Posted', journal_id: journalId }, ctx)
  q.run(`UPDATE payments SET status = 'Posted', journal_id = ? WHERE id = ?`, journalId, id)
  for (const al of allocs) refreshBillBalance(al.bill_id)
  return getRecord(def, id, SYSTEM_CTX)
}

export function voidPayment(id: number, reason: string, ctx: Ctx): Rec {
  const def = getDef('payments')
  const p = getRecord(def, id, SYSTEM_CTX)
  if (p.status === 'Void') throw bad('Already void')
  if (!reason?.trim()) throw bad('A reason is required')
  if (p.status === 'Posted') { assertNotLocked(todayStr()); if (p.journal_id) reverseJournal(ctx, p.journal_id, `Void ${p.payment_no}: ${reason}`) }
  const bills = (p.children.allocations as Rec[]).map(a => a.bill_id)
  q.run(`UPDATE payments SET status = 'Void' WHERE id = ?`, id)
  patchRecord(def, id, { status: 'Void' }, ctx)
  for (const b of bills) refreshBillBalance(b)
  return getRecord(def, id, SYSTEM_CTX)
}

// ============================================================ JOURNALS
export const journalHooks: Hooks = {
  numberDate: r => r.entry_date,
  beforeSave({ rec, old, children, ctx }) {
    if (old && !ctx.system) throw bad('Posted journal entries cannot be edited. Reverse the entry and post a correct one.')
    const lines = children.lines ?? []
    if (!rec.source_type) rec.source_type = 'Manual'
    if (lines.length < 2) throw bad('A journal needs at least two lines')
    let d = 0, c = 0
    for (const l of lines) {
      const dd = Number(l.debit) || 0, cc = Number(l.credit) || 0
      if (dd < 0 || cc < 0) throw bad('Debit and credit cannot be negative')
      if (dd > 0 && cc > 0) throw bad('A line cannot have both debit and credit')
      if (!l.account_id) throw bad('Every line needs an account')
      d = r2(d + dd); c = r2(c + cc)
    }
    if (toCents(d) !== toCents(c)) throw bad(`Journal is out of balance: debits ${d} vs credits ${c}`)
    if (toCents(d) === 0) throw bad('Journal has no amounts')
    rec.total_debit = d; rec.total_credit = c
    assertNotLocked(rec.entry_date)
  },
}

export function reverseEntry(id: number, ctx: Ctx) {
  const e = q.get(`SELECT * FROM journal_entries WHERE id = ?`, id)
  if (!e) throw bad('Entry not found')
  if (e.status === 'Reversed' || e.source_type === 'Reversal') throw bad('This entry is already reversed or is itself a reversal')
  assertNotLocked(todayStr())
  return reverseJournal(ctx, id, `Reversal of ${e.entry_no}`)
}

// ============================================================ EXPENSES
export const expenseHooks: Hooks = {
  numberDate: r => r.expense_date,
  beforeSave({ rec, old, ctx }) {
    if (old && !['Draft', 'Rejected'].includes(old.status) && !ctx.system) throw bad(`A ${old.status.toLowerCase()} claim cannot be edited`)
    if (!(rec.amount > 0)) throw bad('Amount must be greater than zero')
    if ((rec.vat_amount ?? 0) > rec.amount) throw bad('VAT cannot exceed the amount')
  },
}

export function expenseAction(id: number, action: 'submit' | 'approve' | 'reject' | 'pay', body: { bank_account_id?: number }, ctx: Ctx): Rec {
  const def = getDef('expenses')
  const e = getRecord(def, id, SYSTEM_CTX)
  switch (action) {
    case 'submit':
      if (!['Draft', 'Rejected'].includes(e.status)) throw bad('Only draft claims can be submitted')
      patchRecord(def, id, { status: 'Submitted' }, ctx)
      notifyRole('finance', `Expense claim ${e.expense_no} submitted`, `${e._labels.employee_id} – ${e.amount}`, `/e/expenses/${id}`, 'approval', `exp-${id}`)
      break
    case 'reject':
      if (e.status !== 'Submitted') throw bad('Only submitted claims can be rejected')
      patchRecord(def, id, { status: 'Rejected', approver_id: ctx.user?.id }, ctx)
      break
    case 'approve': {
      if (e.status !== 'Submitted') throw bad('Only submitted claims can be approved')
      if (!can(ctx.user, 'finance', 'approve') && !ctx.system) throw bad('You cannot approve expense claims')
      assertNotLocked(e.expense_date)
      const acc = e.account_id ?? accountByCode('6900') ?? accountByRole('default_cost')
      const net = r2(e.amount - (e.vat_amount ?? 0))
      const lines: JLine[] = [{ account_id: acc, job_id: e.job_id, description: `${e.expense_no} ${e.category}`, debit: net }]
      if (e.vat_amount > 0) lines.push({ account_id: accountByRole('vat_input'), description: `Input VAT ${e.expense_no}`, debit: e.vat_amount })
      lines.push({ account_id: accountByRole('employee_payable'), description: `${e.expense_no} payable to ${e._labels.employee_id}`, credit: e.amount })
      const jid = postJournal(ctx, { date: e.expense_date, memo: `Expense ${e.expense_no}`, source_type: 'Expense', source_id: id, source_no: e.expense_no, lines })
      patchRecord(def, id, { status: 'Approved', approver_id: ctx.user?.id, journal_id: jid }, ctx)
      const emp = q.get(`SELECT user_id FROM employees WHERE id = ?`, e.employee_id)
      notify(emp?.user_id, `Expense ${e.expense_no} approved`, '', `/e/expenses/${id}`)
      break
    }
    case 'pay': {
      if (e.status !== 'Approved') throw bad('Only approved claims can be paid')
      if (!body.bank_account_id) throw bad('Choose the bank / cash account the payment is made from')
      assertNotLocked(todayStr())
      postJournal(ctx, { date: todayStr(), memo: `Pay expense ${e.expense_no}`, source_type: 'Expense payment', source_id: id, source_no: e.expense_no, lines: [
        { account_id: accountByRole('employee_payable'), description: e.expense_no, debit: e.amount }, { account_id: bankGl(body.bank_account_id), description: e.expense_no, credit: e.amount },
      ] })
      patchRecord(def, id, { status: 'Paid', paid_from_id: body.bank_account_id, paid_on: todayStr() }, ctx)
      break
    }
  }
  return getRecord(def, id, SYSTEM_CTX)
}

export const bankTxnHooks: Hooks = {
  beforeSave({ rec }) {
    if ((rec.debit ?? 0) > 0 && (rec.credit ?? 0) > 0) throw bad('A statement line is either a withdrawal or a deposit')
    if (rec.status === 'Reconciled' && !rec.reconciled_on) rec.reconciled_on = todayStr()
    if (rec.status === 'Unreconciled') rec.reconciled_on = null
  },
}

// ------------------------------------------------------------ approvals (generic)
export function approvalAction(entity: 'bills' | 'payments' | 'quotations' | 'purchase_orders', id: number, action: 'request' | 'approve' | 'reject', reason: string | undefined, ctx: Ctx): Rec {
  const def = getDef(entity)
  const r = getRecord(def, id, SYSTEM_CTX)
  const mod = def.module
  if (action === 'request') {
    if (entity === 'purchase_orders') patchRecord(def, id, { status: 'Pending approval' }, ctx)
    else patchRecord(def, id, { approval_status: 'Pending', ...(entity === 'quotations' ? { status: 'Pending approval' } : {}) }, ctx)
    notifyRole(mod, `Approval requested: ${r._title}`, '', `/e/${entity}/${id}`, 'approval', `appr-${entity}-${id}`)
  } else {
    if (!can(ctx.user, mod, 'approve') && !ctx.system) throw bad('You do not have approval rights for this record type')
    const approved = action === 'approve'
    if (entity === 'purchase_orders') patchRecord(def, id, { status: approved ? 'Approved' : 'Draft', approved_by: ctx.user?.id }, ctx)
    else patchRecord(def, id, { approval_status: approved ? 'Approved' : 'Rejected', ...(entity === 'quotations' ? { status: approved ? 'Approved' : 'Draft', rejection_reason: approved ? null : reason ?? null } : {}) }, ctx)
    notify(r.created_by, `${approved ? 'Approved' : 'Rejected'}: ${r._title}`, reason ?? '', `/e/${entity}/${id}`, 'approval')
  }
  return getRecord(def, id, SYSTEM_CTX)
}

export function allocationTable(entity: string) { return ENTITIES[entity] ? qi(entity) : '' }

/** Apply an on-account receipt / advance payment to documents after posting. Same-rate settlement only (no FX journal needed). */
export function allocateOnAccount(kind: 'receipt' | 'payment', id: number, rows: { doc_id: number; amount: number }[], ctx: Ctx): Rec {
  const def = getDef(kind === 'receipt' ? 'receipts' : 'payments')
  const r = getRecord(def, id, SYSTEM_CTX)
  if (r.status !== 'Posted') throw bad('Only posted documents can be allocated afterwards')
  const free = r2(r.amount - (r.allocated ?? 0))
  const total = r2(rows.reduce((s, x) => s + x.amount, 0))
  if (!rows.length || total <= 0) throw bad('Enter at least one allocation')
  if (total > free + 0.001) throw bad(`Only ${free} is unallocated`)
  const child = kind === 'receipt' ? 'receipt_allocations' : 'payment_allocations'
  const fk = kind === 'receipt' ? 'receipt_id' : 'payment_id'
  const dkey = kind === 'receipt' ? 'invoice_id' : 'bill_id'
  for (const x of rows) {
    const doc = q.get(`SELECT * FROM ${kind === 'receipt' ? 'invoices' : 'bills'} WHERE id = ?`, x.doc_id)
    if (!doc) throw bad('Document not found')
    if ((kind === 'receipt' ? doc.party_id : doc.vendor_id) !== (kind === 'receipt' ? r.party_id : r.vendor_id)) throw bad('Document belongs to a different party')
    if (doc.currency !== r.currency) throw bad('Currency mismatch')
    if (!['Posted', 'Partially paid'].includes(doc.status)) throw bad('Document is not open')
    if (Math.abs(doc.ex_rate - r.ex_rate) > 1e-9) throw bad('Documents booked at a different exchange rate cannot be settled afterwards — contact accounts to post an FX adjustment')
    if (toCents(x.amount) > doc.balance) throw bad('Allocation exceeds the open balance')
    q.run(`INSERT INTO ${child}(${fk}, ${dkey}, amount, version, created_at, updated_at, created_by, updated_by) VALUES (?,?,?,1,?,?,?,?)`, id, x.doc_id, toCents(x.amount), new Date().toISOString(), new Date().toISOString(), ctx.user?.id ?? null, ctx.user?.id ?? null)
    if (kind === 'receipt') refreshInvoiceBalance(x.doc_id); else refreshBillBalance(x.doc_id)
  }
  syncAllocationTotals(kind === 'receipt' ? 'receipts' : 'payments', id)
  return getRecord(def, id, SYSTEM_CTX)
}
