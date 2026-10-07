import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { assertCan, createRecord, getDef, getRecord, patchRecord, SYSTEM_CTX } from '../engine'
import { bad, fromCents, parseCsv, r2, toCents, todayStr } from '../util'
import { body, idOf, need } from './helpers'
import { allocateOnAccount, expenseAction, postBill, postInvoice, postPayment, postReceipt, reverseEntry, voidBill, voidInvoice, voidPayment, voidReceipt } from '../domain/finance'

export default async function (app: FastifyInstance) {
  const id = (req: any) => idOf(req.params.id)
  const reason = (req: any) => z.object({ reason: z.string().min(1).max(300) }).parse(req.body ?? {}).reason

  app.post('/api/finance/invoices/:id/post', async (req) => { need(req, 'finance', 'edit'); return tx(() => postInvoice(id(req), req.ctx)) })
  app.post('/api/finance/invoices/:id/void', async (req) => { need(req, 'finance', 'edit'); return tx(() => voidInvoice(id(req), reason(req), req.ctx)) })
  app.post('/api/finance/bills/:id/post', async (req) => { need(req, 'finance', 'edit'); return tx(() => postBill(id(req), req.ctx)) })
  app.post('/api/finance/bills/:id/void', async (req) => { need(req, 'finance', 'edit'); return tx(() => voidBill(id(req), reason(req), req.ctx)) })
  app.post('/api/finance/receipts/:id/post', async (req) => { need(req, 'finance', 'edit'); return tx(() => postReceipt(id(req), req.ctx)) })
  app.post('/api/finance/receipts/:id/void', async (req) => { need(req, 'finance', 'edit'); return tx(() => voidReceipt(id(req), reason(req), req.ctx)) })
  app.post('/api/finance/receipts/:id/allocate', async (req) => { need(req, 'finance', 'edit'); const b = z.object({ rows: z.array(z.object({ doc_id: z.number().int(), amount: z.number().positive() })) }).parse(req.body); return tx(() => allocateOnAccount('receipt', id(req), b.rows, req.ctx)) })
  app.post('/api/finance/payments/:id/post', async (req) => { need(req, 'finance', 'edit'); return tx(() => postPayment(id(req), req.ctx)) })
  app.post('/api/finance/payments/:id/void', async (req) => { need(req, 'finance', 'edit'); return tx(() => voidPayment(id(req), reason(req), req.ctx)) })
  app.post('/api/finance/payments/:id/allocate', async (req) => { need(req, 'finance', 'edit'); const b = z.object({ rows: z.array(z.object({ doc_id: z.number().int(), amount: z.number().positive() })) }).parse(req.body); return tx(() => allocateOnAccount('payment', id(req), b.rows, req.ctx)) })
  app.post('/api/finance/journals/:id/reverse', async (req) => { need(req, 'finance', 'edit'); return tx(() => ({ reversal_id: reverseEntry(id(req), req.ctx) })) })
  app.post('/api/finance/expenses/:id/:action', async (req) => {
    const action = (req.params as any).action
    if (!['submit', 'approve', 'reject', 'pay'].includes(action)) throw bad('Unknown action')
    need(req, 'finance', action === 'submit' ? 'create' : 'edit')
    const b = z.object({ bank_account_id: z.number().int().optional() }).parse(req.body ?? {})
    return tx(() => expenseAction(id(req), action, b, req.ctx))
  })

  // open documents for allocation pickers
  app.get('/api/finance/open-invoices', async (req) => {
    need(req, 'finance', 'view')
    const s = req.query as any
    const rows = q.all(`SELECT id, invoice_no, invoice_date, due_date, currency, total, balance, doc_type FROM invoices WHERE party_id = ? AND status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND deleted_at IS NULL ${s.currency ? 'AND currency = ?' : ''} ORDER BY invoice_date, id`, ...[Number(s.party_id), ...(s.currency ? [String(s.currency)] : [])])
    return rows.map(r => ({ ...r, total: fromCents(r.total), balance: fromCents(r.balance) }))
  })
  app.get('/api/finance/open-bills', async (req) => {
    need(req, 'finance', 'view')
    const s = req.query as any
    const rows = q.all(`SELECT id, bill_no, vendor_invoice_no, bill_date, due_date, currency, total, balance FROM bills WHERE vendor_id = ? AND status IN ('Posted','Partially paid') AND balance > 0 AND deleted_at IS NULL ${s.currency ? 'AND currency = ?' : ''} ORDER BY bill_date, id`, ...[Number(s.vendor_id), ...(s.currency ? [String(s.currency)] : [])])
    return rows.map(r => ({ ...r, total: fromCents(r.total), balance: fromCents(r.balance) }))
  })

  // ---------------------------------------------------------------- customer / vendor statement (base currency)
  app.get('/api/finance/statement/:partyId', async (req) => {
    need(req, 'finance', 'view')
    const pid = idOf((req.params as any).partyId)
    const s = req.query as any
    const from = String(s.from ?? '2000-01-01'), to = String(s.to ?? todayStr())
    const party = q.get(`SELECT id, code, name, trn, address1, city FROM parties WHERE id = ?`, pid)
    if (!party) throw bad('Party not found')
    const lines = q.all(`
      SELECT l.id, e.entry_date AS date, e.entry_no, e.source_type AS type, e.source_no AS doc_no, l.description, l.debit, l.credit, e.id AS entry_id
      FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id JOIN accounts a ON a.id = l.account_id
      WHERE l.party_id = ? AND a.role IN ('ar_control','ap_control') AND l.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY e.entry_date, e.id, l.id`, pid)
    let bal = 0
    const opening = lines.filter(l => l.date < from).reduce((x, l) => x + (l.debit ?? 0) - (l.credit ?? 0), 0)
    bal = opening
    const rows = lines.filter(l => l.date >= from && l.date <= to).map(l => { bal += (l.debit ?? 0) - (l.credit ?? 0); return { date: l.date, type: l.type, doc_no: l.doc_no, description: l.description, debit: fromCents(l.debit), credit: fromCents(l.credit), balance: fromCents(bal) } })
    return { party, from, to, opening: fromCents(opening), rows, closing: fromCents(bal) }
  })

  // ---------------------------------------------------------------- bank statement import & reconciliation
  app.post('/api/finance/bank/import', async (req) => {
    need(req, 'finance', 'create')
    const b = z.object({ bank_account_id: z.number().int(), csv: z.string().min(10).max(5_000_000).optional(), text: z.string().min(10).max(5_000_000).optional(), format: z.string().optional() }).parse(req.body)
    const { importLines, parseStatement } = await import('../integrations/bank')
    const r = importLines(b.bank_account_id, parseStatement(b.text ?? b.csv ?? '', b.format))
    return { created: r.imported, duplicates: r.duplicates, matched: r.matched }
  })
  app.get('/api/finance/bank/suggest/:txnId', async (req) => {
    need(req, 'finance', 'view')
    const t = q.get(`SELECT * FROM bank_transactions WHERE id = ? AND deleted_at IS NULL`, idOf((req.params as any).txnId))
    if (!t) throw bad('Statement line not found')
    const amt = t.credit > 0 ? t.credit : t.debit
    const out: any[] = []
    if (t.credit > 0) for (const r of q.all(`SELECT id, receipt_no AS no, receipt_date AS date, amount, reference FROM receipts WHERE bank_account_id = ? AND status = 'Posted' AND amount = ? AND deleted_at IS NULL`, t.bank_account_id, amt)) out.push({ kind: 'Receipt', ...r, amount: fromCents(r.amount) })
    if (t.debit > 0) for (const r of q.all(`SELECT id, payment_no AS no, payment_date AS date, amount, reference FROM payments WHERE bank_account_id = ? AND status = 'Posted' AND amount = ? AND deleted_at IS NULL`, t.bank_account_id, amt)) out.push({ kind: 'Payment', ...r, amount: fromCents(r.amount) })
    return out.filter(o => !q.val(`SELECT 1 FROM bank_transactions WHERE matched_to = ? AND status = 'Reconciled' AND deleted_at IS NULL`, o.no)).sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(t.txn_date)) - Math.abs(Date.parse(b.date) - Date.parse(t.txn_date)))
  })
  app.post('/api/finance/bank/reconcile', async (req) => {
    need(req, 'finance', 'edit')
    const b = z.object({ txn_id: z.number().int(), matched_to: z.string().max(60).optional(), undo: z.boolean().optional() }).parse(req.body)
    return patchRecord(getDef('bank_transactions'), b.txn_id, b.undo ? { status: 'Unreconciled', matched_to: null } : { status: 'Reconciled', matched_to: b.matched_to ?? 'Manual' }, req.ctx)
  })
  app.get('/api/finance/bank/summary', async (req) => {
    need(req, 'finance', 'view')
    const rows = q.all(`SELECT b.id, b.name, b.currency, b.type, b.opening_balance,
      (SELECT COALESCE(SUM(l.debit - l.credit),0) FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id WHERE l.account_id = b.gl_account_id AND l.deleted_at IS NULL AND e.deleted_at IS NULL) AS gl_balance,
      (SELECT COALESCE(SUM(credit - debit),0) FROM bank_transactions WHERE bank_account_id = b.id AND status = 'Unreconciled' AND deleted_at IS NULL) AS unreconciled,
      (SELECT COUNT(*) FROM bank_transactions WHERE bank_account_id = b.id AND status = 'Unreconciled' AND deleted_at IS NULL) AS unreconciled_count
      FROM bank_accounts b WHERE b.deleted_at IS NULL AND b.active = 1`)
    return rows.map(r => ({ ...r, opening_balance: fromCents(r.opening_balance), gl_balance: fromCents(r.gl_balance), unreconciled: fromCents(r.unreconciled) }))
  })
  void body; void assertCan; void getRecord; void SYSTEM_CTX; void r2
}
