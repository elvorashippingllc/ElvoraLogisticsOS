import { q } from '../db'
import type { Hooks } from '../hooks'
import { bad, nowLocal, fromCents } from '../util'
import { getDef, getRecord, patchRecord, insertRow, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { addJobEvent } from './jobs'

export const itemHooks: Hooks = {
  beforeSave({ rec }) { if (rec.barcode) { const d = q.get(`SELECT sku FROM items WHERE barcode = ? AND deleted_at IS NULL AND id <> ?`, rec.barcode, rec.id ?? 0); if (d) throw bad(`Barcode already used by ${d.sku}`) } },
}

function checkLines(rows: Rec[] | undefined, warehouseId: number, qtyLabel: string) {
  for (const l of rows ?? []) {
    if (!(Number(l.qty) > 0)) throw bad(`${qtyLabel} must be greater than zero`)
    if (l.location_id) { const loc = q.get(`SELECT warehouse_id FROM wh_locations WHERE id = ?`, l.location_id); if (loc && loc.warehouse_id !== warehouseId) throw bad('A bin belongs to a different warehouse') }
  }
}

export const grnHooks: Hooks = {
  numberDate: r => (r.received_at ?? '').slice(0, 10),
  beforeSave({ rec, old, children, ctx }) {
    if (old && old.status !== 'Draft' && !ctx.system) throw bad(`A ${old.status.toLowerCase()} goods receipt cannot be edited`)
    checkLines(children.lines, rec.warehouse_id, 'Received quantity')
  },
}
export const dispatchHooks: Hooks = {
  numberDate: r => (r.dispatch_at ?? '').slice(0, 10),
  beforeSave({ rec, old, children, ctx }) {
    if (old && old.status !== 'Draft' && !ctx.system) throw bad(`A ${old.status.toLowerCase()} dispatch cannot be edited`)
    checkLines(children.lines, rec.warehouse_id, 'Dispatch quantity')
  },
}

export function addMove(m: { item_id: number; warehouse_id: number; location_id?: number | null; lot_no?: string | null; expiry_date?: string | null; qty: number; move_type: string; customer_id?: number | null; job_id?: number | null; ref_no?: string | null; ref_entity?: string; ref_id?: number; note?: string | null }, ctx: Ctx) {
  insertRow(getDef('stock_moves'), { moved_at: nowLocal(), user_id: ctx.user?.id ?? null, ...m }, ctx)
}

export interface StockRow { item_id: number; warehouse_id: number; location_id: number | null; lot_no: string | null; expiry_date: string | null; qty: number }

export function stockOnHand(filter: { item_id?: number; warehouse_id?: number; customer_id?: number; location_id?: number } = {}): StockRow[] {
  const cl: string[] = ['deleted_at IS NULL']; const a: any[] = []
  for (const k of ['item_id', 'warehouse_id', 'location_id'] as const) if (filter[k]) { cl.push(`${k} = ?`); a.push(filter[k]) }
  if (filter.customer_id) { cl.push(`item_id IN (SELECT id FROM items WHERE customer_id = ?)`); a.push(filter.customer_id) }
  return q.all<StockRow>(`SELECT item_id, warehouse_id, location_id, lot_no, expiry_date, ROUND(SUM(qty), 4) AS qty FROM stock_moves WHERE ${cl.join(' AND ')} GROUP BY item_id, warehouse_id, location_id, lot_no, expiry_date HAVING ABS(SUM(qty)) > 0.00001`, ...a)
}

export function available(itemId: number, warehouseId: number, locationId?: number | null, lot?: string | null): number {
  const cl = ['deleted_at IS NULL', 'item_id = ?', 'warehouse_id = ?']; const a: any[] = [itemId, warehouseId]
  if (locationId) { cl.push('location_id = ?'); a.push(locationId) }
  if (lot) { cl.push('lot_no = ?'); a.push(lot) }
  return q.val<number>(`SELECT COALESCE(SUM(qty),0) FROM stock_moves WHERE ${cl.join(' AND ')}`, ...a) ?? 0
}

/** FEFO (earliest expiry first), then oldest lot. Returns allocations that satisfy qty or throws. */
export function allocate(itemId: number, warehouseId: number, qty: number, locationId?: number | null, lot?: string | null) {
  const rows = stockOnHand({ item_id: itemId, warehouse_id: warehouseId }).filter(r => r.qty > 0 && (!locationId || r.location_id === locationId) && (!lot || r.lot_no === lot))
  rows.sort((a, b) => (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999') || String(a.lot_no ?? '').localeCompare(String(b.lot_no ?? '')))
  let need = qty; const out: StockRow[] = []
  for (const r of rows) { if (need <= 0) break; const take = Math.min(need, r.qty); out.push({ ...r, qty: take }); need = Math.round((need - take) * 10000) / 10000 }
  if (need > 0.00001) {
    const it = q.get(`SELECT sku, name FROM items WHERE id = ?`, itemId)
    throw bad(`Insufficient stock for ${it?.sku ?? itemId} ${it?.name ?? ''}: need ${qty}, available ${Math.round((qty - need) * 10000) / 10000}`)
  }
  return out
}

export function postGrn(id: number, ctx: Ctx): Rec {
  const def = getDef('grns')
  const g = getRecord(def, id, SYSTEM_CTX)
  if (g.status !== 'Draft') throw bad('Only draft receipts can be posted')
  const lines: Rec[] = g.children.lines
  if (!lines.length) throw bad('Add at least one item')
  for (const l of lines) {
    const it = q.get(`SELECT customer_id, track_lot, shelf_life_days FROM items WHERE id = ?`, l.item_id)
    if (it?.customer_id && it.customer_id !== g.customer_id) throw bad('An item belongs to a different owner than this receipt')
    if (it?.track_lot && !l.lot_no) throw bad(`Lot / batch is required for ${l._labels.item_id}`)
    addMove({ item_id: l.item_id, warehouse_id: g.warehouse_id, location_id: l.location_id, lot_no: l.lot_no, expiry_date: l.expiry_date, qty: l.qty, move_type: 'GRN', customer_id: g.customer_id, job_id: g.job_id, ref_no: g.grn_no, ref_entity: 'grns', ref_id: id, note: l.condition !== 'Good' ? l.condition : null }, ctx)
  }
  if (g.job_id) addJobEvent(g.job_id, 'Cargo received', { description: `GRN ${g.grn_no} – ${lines.length} line(s) received at ${g._labels.warehouse_id}`, user_id: ctx.user?.id })
  return patchRecord(def, id, { status: 'Posted' }, ctx)
}

export function postDispatch(id: number, ctx: Ctx): Rec {
  const def = getDef('dispatches')
  const d = getRecord(def, id, SYSTEM_CTX)
  if (d.status !== 'Draft') throw bad('Only draft dispatches can be posted')
  const lines: Rec[] = d.children.lines
  if (!lines.length) throw bad('Add at least one item')
  const need = new Map<string, number>()
  for (const l of lines) {
    const it = q.get(`SELECT customer_id FROM items WHERE id = ?`, l.item_id)
    if (it?.customer_id && it.customer_id !== d.customer_id) throw bad('An item belongs to a different owner than this dispatch')
    // allocate sequentially so two lines of the same item cannot double-spend stock
    const allocs = allocate(l.item_id, d.warehouse_id, l.qty, l.location_id, l.lot_no)
    for (const a of allocs) addMove({ item_id: l.item_id, warehouse_id: d.warehouse_id, location_id: a.location_id, lot_no: a.lot_no, expiry_date: a.expiry_date, qty: -a.qty, move_type: 'Dispatch', customer_id: d.customer_id, job_id: d.job_id, ref_no: d.dispatch_no, ref_entity: 'dispatches', ref_id: id }, ctx)
    need.set(String(l.item_id), (need.get(String(l.item_id)) ?? 0) + l.qty)
  }
  if (d.job_id) addJobEvent(d.job_id, 'Out for delivery', { description: `Dispatch ${d.dispatch_no} from ${d._labels.warehouse_id}`, user_id: ctx.user?.id })
  return patchRecord(def, id, { status: 'Posted' }, ctx)
}

export function cancelPosted(entity: 'grns' | 'dispatches', id: number, ctx: Ctx): Rec {
  const def = getDef(entity)
  const r = getRecord(def, id, SYSTEM_CTX)
  if (r.status === 'Cancelled') throw bad('Already cancelled')
  if (r.status === 'Posted') {
    const moves = q.all(`SELECT * FROM stock_moves WHERE ref_entity = ? AND ref_id = ? AND deleted_at IS NULL AND move_type IN ('GRN','Dispatch')`, entity, id)
    for (const m of moves) {
      const qty = -m.qty
      if (qty < 0 && available(m.item_id, m.warehouse_id, m.location_id, m.lot_no) + qty < -0.00001) throw bad('Cannot cancel: the received stock has already been moved or dispatched')
      addMove({ item_id: m.item_id, warehouse_id: m.warehouse_id, location_id: m.location_id, lot_no: m.lot_no, expiry_date: m.expiry_date, qty, move_type: 'Adjustment', customer_id: m.customer_id, job_id: m.job_id, ref_no: r.grn_no ?? r.dispatch_no, ref_entity: entity, ref_id: id, note: 'Cancelled' }, ctx)
    }
  }
  return patchRecord(def, id, { status: 'Cancelled' }, ctx)
}

export function adjustStock(b: { item_id: number; warehouse_id: number; location_id?: number | null; lot_no?: string | null; expiry_date?: string | null; qty: number; reason: string }, ctx: Ctx) {
  if (!b.reason?.trim()) throw bad('A reason is required for stock adjustments')
  if (!b.qty) throw bad('Quantity cannot be zero')
  if (b.qty < 0 && available(b.item_id, b.warehouse_id, b.location_id, b.lot_no) + b.qty < -0.00001) throw bad('Adjustment would make stock negative')
  const it = q.get(`SELECT customer_id FROM items WHERE id = ?`, b.item_id)
  addMove({ ...b, move_type: 'Adjustment', customer_id: it?.customer_id, note: b.reason }, ctx)
}

export function transferStock(b: { item_id: number; from_warehouse_id: number; from_location_id?: number | null; to_warehouse_id: number; to_location_id?: number | null; lot_no?: string | null; qty: number }, ctx: Ctx) {
  if (!(b.qty > 0)) throw bad('Quantity must be greater than zero')
  const it = q.get(`SELECT customer_id FROM items WHERE id = ?`, b.item_id)
  const allocs = allocate(b.item_id, b.from_warehouse_id, b.qty, b.from_location_id, b.lot_no)
  const ref = `TRF-${Date.now().toString(36).toUpperCase()}`
  for (const a of allocs) {
    addMove({ item_id: b.item_id, warehouse_id: b.from_warehouse_id, location_id: a.location_id, lot_no: a.lot_no, expiry_date: a.expiry_date, qty: -a.qty, move_type: 'Transfer out', customer_id: it?.customer_id, ref_no: ref }, ctx)
    addMove({ item_id: b.item_id, warehouse_id: b.to_warehouse_id, location_id: b.to_location_id ?? null, lot_no: a.lot_no, expiry_date: a.expiry_date, qty: a.qty, move_type: 'Transfer in', customer_id: it?.customer_id, ref_no: ref }, ctx)
  }
  return ref
}
void fromCents
