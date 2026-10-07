import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { createRecord, getDef, getRecord, patchRecord, SYSTEM_CTX, assertCan } from '../engine'
import { bad, todayStr } from '../util'
import { body, idOf, need } from './helpers'
import { convertLead, convertQuoteToJob, reviseQuote, sendQuote } from '../domain/sales'
import { approvalAction } from '../domain/finance'

export default async function (app: FastifyInstance) {
  const qid = (req: any) => idOf(req.params.id)

  app.post('/api/quotes/:id/send', async (req) => { need(req, 'sales', 'edit'); const b = z.object({ to: z.string().email().optional(), message: z.string().max(3000).optional() }).parse(req.body ?? {}); return tx(() => sendQuote(qid(req), b.to, b.message, req.ctx)) })
  app.post('/api/quotes/:id/convert', async (req) => { need(req, 'sales', 'edit'); need(req, 'jobs', 'create'); return tx(() => convertQuoteToJob(qid(req), req.ctx)) })
  app.post('/api/quotes/:id/revise', async (req) => { need(req, 'sales', 'create'); return tx(() => reviseQuote(qid(req), req.ctx)) })
  app.post('/api/quotes/:id/accept', async (req) => {
    need(req, 'sales', 'edit')
    const id = qid(req); const qt = getRecord(getDef('quotations'), id, req.ctx, { children: false })
    if (['Pending', 'Rejected'].includes(qt.approval_status)) throw bad('Margin approval is required first')
    if (!['Sent', 'Approved'].includes(qt.status)) throw bad('Only sent quotations can be accepted')
    return patchRecord(getDef('quotations'), id, { status: 'Accepted' }, req.ctx)
  })
  app.post('/api/quotes/:id/reject', async (req) => {
    need(req, 'sales', 'edit')
    const b = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {})
    return patchRecord(getDef('quotations'), qid(req), { status: 'Rejected', rejection_reason: b.reason ?? null }, req.ctx)
  })
  app.post('/api/leads/:id/convert', async (req) => { need(req, 'crm', 'create'); return tx(() => convertLead(idOf((req.params as any).id), req.ctx)) })
  app.post('/api/opportunities/:id/quote', async (req) => {
    need(req, 'sales', 'create')
    const o = getRecord(getDef('opportunities'), idOf((req.params as any).id), req.ctx, { children: false })
    const quote = createRecord(getDef('quotations'), { customer_id: o.party_id, contact_id: o.contact_id, salesperson_id: o.owner_id ?? req.user!.id, mode: o.mode ?? 'Ocean FCL', opportunity_id: o.id, quote_date: todayStr(), notes: `Opportunity ${o.opp_no}: ${o.title}. ${o.origin ?? ''} → ${o.destination ?? ''}` }, req.ctx)
    if (o.stage === 'Prospecting' || o.stage === 'Qualification') patchRecord(getDef('opportunities'), o.id, { stage: 'Quotation' }, req.ctx)
    return quote
  })

  app.get('/api/rates/search', async (req) => {
    need(req, 'sales', 'view')
    const s = req.query as any
    const cl = [`c.deleted_at IS NULL`, `l.deleted_at IS NULL`, `c.status = 'Active'`, `(c.valid_to IS NULL OR c.valid_to >= ?)`]; const a: any[] = [todayStr()]
    if (s.kind) { cl.push('c.kind LIKE ?'); a.push(String(s.kind) + '%') }
    if (s.mode) { cl.push('c.mode = ?'); a.push(String(s.mode)) }
    if (s.origin_id) { cl.push('l.origin_id = ?'); a.push(Number(s.origin_id)) }
    if (s.destination_id) { cl.push('l.destination_id = ?'); a.push(Number(s.destination_id)) }
    if (s.customer_id) { cl.push('(c.customer_id IS NULL OR c.customer_id = ?)'); a.push(Number(s.customer_id)) }
    const rows = q.all(`SELECT l.id, l.charge_code_id, cc.name AS charge, l.basis, l.rate, l.min_charge, l.transit_days, l.free_days, c.id AS card_id, c.name AS card, c.currency, c.kind, c.valid_to, p.name AS vendor, o.code AS origin, d.code AS destination
      FROM rate_card_lines l JOIN rate_cards c ON c.id = l.rate_card_id LEFT JOIN charge_codes cc ON cc.id = l.charge_code_id LEFT JOIN parties p ON p.id = c.vendor_id LEFT JOIN locations o ON o.id = l.origin_id LEFT JOIN locations d ON d.id = l.destination_id
      WHERE ${cl.join(' AND ')} ORDER BY l.rate LIMIT 100`, ...a)
    return rows.map(r => ({ ...r, rate: (r.rate ?? 0) / 100, min_charge: (r.min_charge ?? 0) / 100 }))
  })

  // generic approvals (bills, payments, quotations, purchase orders)
  app.post('/api/approvals/:entity/:id/:action', async (req) => {
    const p = req.params as any
    if (!['bills', 'payments', 'quotations', 'purchase_orders'].includes(p.entity)) throw bad('Approvals are not used for this record type')
    if (!['request', 'approve', 'reject'].includes(p.action)) throw bad('Unknown action')
    const def = getDef(p.entity)
    assertCan(req.ctx, def.module, p.action === 'request' ? 'edit' : 'view')
    const b = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {})
    return tx(() => approvalAction(p.entity, idOf(p.id), p.action, b.reason, req.ctx))
  })
  void body; void SYSTEM_CTX
}
