import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { labelsFor } from '../engine'
import { addDays, bad, todayStr } from '../util'
import { idOf, need } from './helpers'
import { adjustStock, cancelPosted, postDispatch, postGrn, stockOnHand, transferStock } from '../domain/warehouse'

export default async function (app: FastifyInstance) {
  app.get('/api/warehouse/stock', async (req) => {
    need(req, 'warehouse', 'view')
    const s = req.query as any
    const rows = stockOnHand({ warehouse_id: s.warehouse_id ? Number(s.warehouse_id) : undefined, customer_id: s.customer_id ? Number(s.customer_id) : undefined, item_id: s.item_id ? Number(s.item_id) : undefined })
    const items = q.all(`SELECT id, sku, name, customer_id, min_stock, barcode, uom_id FROM items WHERE deleted_at IS NULL`)
    const byId = new Map(items.map(i => [i.id, i]))
    const lab = {
      item: labelsFor('items', [...new Set(rows.map(r => r.item_id))]), wh: labelsFor('warehouses', [...new Set(rows.map(r => r.warehouse_id))]),
      loc: labelsFor('wh_locations', [...new Set(rows.map(r => r.location_id).filter(Boolean) as number[])]), cust: labelsFor('parties', [...new Set(items.map(i => i.customer_id).filter(Boolean))]),
    }
    const today = todayStr(), soon = addDays(today, 60)
    let detail = rows.map(r => { const it = byId.get(r.item_id); return { ...r, sku: it?.sku, item: it?.name, owner: it?.customer_id ? lab.cust.get(it.customer_id) : '', warehouse: lab.wh.get(r.warehouse_id), location: r.location_id ? lab.loc.get(r.location_id) : '', expiry_status: r.expiry_date ? (r.expiry_date < today ? 'Expired' : r.expiry_date <= soon ? 'Expiring' : 'OK') : '' } })
    if (s.q) { const t = String(s.q).toLowerCase(); detail = detail.filter(d => `${d.sku} ${d.item} ${d.owner} ${d.location} ${d.warehouse}`.toLowerCase().includes(t)) }
    const summary = new Map<number, { item_id: number; sku: string; item: string; owner: string; qty: number; min_stock: number; low: boolean }>()
    for (const d of detail) {
      const it = byId.get(d.item_id)!
      const cur = summary.get(d.item_id) ?? { item_id: d.item_id, sku: it.sku, item: it.name, owner: d.owner ?? '', qty: 0, min_stock: it.min_stock ?? 0, low: false }
      cur.qty = Math.round((cur.qty + d.qty) * 10000) / 10000; summary.set(d.item_id, cur)
    }
    for (const v of summary.values()) v.low = v.min_stock > 0 && v.qty < v.min_stock
    // items with a minimum stock but no stock at all
    if (s.low_only) for (const it of items) if ((it.min_stock ?? 0) > 0 && !summary.has(it.id)) summary.set(it.id, { item_id: it.id, sku: it.sku, item: it.name, owner: it.customer_id ? lab.cust.get(it.customer_id) ?? '' : '', qty: 0, min_stock: it.min_stock, low: true })
    let sum = [...summary.values()]
    if (s.low_only) sum = sum.filter(x => x.low)
    return { detail, summary: sum.sort((a, b) => a.sku.localeCompare(b.sku)) }
  })

  app.get('/api/warehouse/barcode/:code', async (req) => {
    need(req, 'warehouse', 'view')
    const code = String((req.params as any).code).trim()
    const it = q.get(`SELECT id, sku, name, barcode, customer_id FROM items WHERE (barcode = ? OR sku = ?) AND deleted_at IS NULL`, code, code)
    if (!it) throw bad(`No item with barcode / SKU ${code}`)
    return { item: it, stock: stockOnHand({ item_id: it.id }) }
  })

  app.post('/api/warehouse/grns/:id/post', async (req) => { need(req, 'warehouse', 'edit'); return tx(() => postGrn(idOf((req.params as any).id), req.ctx)) })
  app.post('/api/warehouse/grns/:id/cancel', async (req) => { need(req, 'warehouse', 'edit'); return tx(() => cancelPosted('grns', idOf((req.params as any).id), req.ctx)) })
  app.post('/api/warehouse/dispatches/:id/post', async (req) => { need(req, 'warehouse', 'edit'); return tx(() => postDispatch(idOf((req.params as any).id), req.ctx)) })
  app.post('/api/warehouse/dispatches/:id/cancel', async (req) => { need(req, 'warehouse', 'edit'); return tx(() => cancelPosted('dispatches', idOf((req.params as any).id), req.ctx)) })

  app.post('/api/warehouse/adjust', async (req) => {
    need(req, 'warehouse', 'edit')
    const b = z.object({ item_id: z.number().int(), warehouse_id: z.number().int(), location_id: z.number().int().nullable().optional(), lot_no: z.string().max(60).nullable().optional(), expiry_date: z.string().nullable().optional(), qty: z.number(), reason: z.string().min(2).max(300) }).parse(req.body)
    tx(() => adjustStock(b, req.ctx)); return { ok: true }
  })
  app.post('/api/warehouse/transfer', async (req) => {
    need(req, 'warehouse', 'edit')
    const b = z.object({ item_id: z.number().int(), from_warehouse_id: z.number().int(), from_location_id: z.number().int().nullable().optional(), to_warehouse_id: z.number().int(), to_location_id: z.number().int().nullable().optional(), lot_no: z.string().nullable().optional(), qty: z.number().positive() }).parse(req.body)
    return { ref: tx(() => transferStock(b, req.ctx)) }
  })
}
