import type { FastifyInstance } from 'fastify'
import { q, qi, tx } from '../db'
import { ENTITIES } from '../../shared/entities'
import { optValue, recordTitle, type EntityDef, type FieldDef } from '../../shared/types'
import { attachLabels, createRecord, deleteRecord, getDef, getRecord, labelsFor, listRecords, rowToApi, updateRecord, can, assertCan, titleCols, customFieldsFor, invalidateCustomFields, type Ctx } from '../engine'
import { bad, forbidden, notFound, parseCsv, safeJson, toCsv, nowLocal, todayStr } from '../util'
import { body, idOf, parseListParams } from './helpers'

function guard(def: EntityDef) {
  if (def.child) throw notFound('Unknown record type')
  return def
}

function cell(f: FieldDef, rec: any): string {
  const v = rec[f.name]
  if (v === null || v === undefined) return ''
  if (f.type === 'ref') return rec._labels?.[f.name] ?? ''
  if (f.type === 'bool') return v ? 'Yes' : 'No'
  if (f.type === 'json') return JSON.stringify(v)
  return String(v)
}

/** Resolve a CSV cell to a ref id by id, or by exact title / code / name match. */
function resolveRef(f: FieldDef, value: string): number | null {
  if (!value) return null
  if (/^\d+$/.test(value)) { const ok = q.val<number>(`SELECT id FROM ${qi(f.ref!)} WHERE id = ? AND deleted_at IS NULL`, Number(value)); if (ok) return ok }
  const rdef = ENTITIES[f.ref!]
  const cols = [...new Set([...rdef.fields.filter(x => x.search && x.type !== 'ref').map(x => x.name), ...titleCols(rdef).filter(c => rdef.fields.find(x => x.name === c)?.type !== 'ref')])]
  for (const c of cols) { const id = q.val<number>(`SELECT id FROM ${qi(rdef.key)} WHERE lower(${qi(c)}) = lower(?) AND deleted_at IS NULL LIMIT 1`, value); if (id) return id }
  // label match ("CODE – Name")
  const all = q.all<{ id: number }>(`SELECT id FROM ${qi(rdef.key)} WHERE deleted_at IS NULL LIMIT 5000`)
  const labels = labelsFor(rdef.key, all.map(a => a.id))
  for (const [id, l] of labels) if (l.toLowerCase() === value.toLowerCase()) return id
  return null
}

export default async function (app: FastifyInstance) {
  // ------------------------------------------------------------ lookup (reference pickers)
  app.get('/api/e/:entity/lookup', async (req) => {
    const def = guard(getDef((req.params as any).entity))
    const qs = req.query as any
    const user = req.user!
    if (user.party_id && def.module !== 'masters') throw forbidden()
    let filters: any[] = []
    if (qs.filter) { try { const o = JSON.parse(String(qs.filter)); filters = Object.entries(o).map(([field, value]) => ({ field, op: 'eq', value })) } catch { throw bad('Invalid filter') } }
    const ids = qs.ids ? String(qs.ids).split(',').map(Number).filter(Boolean) : undefined
    const res = listRecords(def, { q: qs.q, pageSize: Math.min(Number(qs.limit) || 20, 100), filters, ids, sort: def.defaultSort?.field ?? undefined, dir: def.defaultSort?.dir }, { ...req.ctx, system: true })
    return res.rows.map(r => ({ id: r.id, label: r._title, sub: def.fields.find(f => f.name === 'status')?.type === 'select' ? r.status : undefined }))
  })

  // ------------------------------------------------------------ list
  app.get('/api/e/:entity', async (req) => {
    const def = guard(getDef((req.params as any).entity))
    return listRecords(def, parseListParams(req.query as any), req.ctx)
  })

  // ------------------------------------------------------------ export / template / import
  app.get('/api/e/:entity/export.csv', async (req, reply) => {
    const def = guard(getDef((req.params as any).entity))
    assertCan(req.ctx, def.module, 'export')
    const p = parseListParams(req.query as any)
    const res = listRecords(def, { ...p, page: 1, pageSize: 100000 }, req.ctx)
    const fields = def.fields.filter(f => !f.secret && !f.virtual && f.type !== 'json' && !f.hidden || f.list)
    const csv = toCsv(['ID', ...fields.map(f => f.label)], res.rows.map(r => [r.id, ...fields.map(f => cell(f, r))]))
    reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="${def.key}-${todayStr()}.csv"`)
    return csv
  })
  app.get('/api/e/:entity/template.csv', async (req, reply) => {
    const def = guard(getDef((req.params as any).entity))
    assertCan(req.ctx, def.module, 'create')
    const fields = def.fields.filter(f => !f.secret && !f.virtual && !f.readonly && !f.computed && f.type !== 'json' && !f.hidden)
    reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="${def.key}-import-template.csv"`)
    return toCsv(fields.map(f => f.label), [fields.map(f => (f.type === 'select' ? optValue(f.options![0]) : f.type === 'date' ? '2026-01-31' : f.type === 'bool' ? 'Yes' : f.type === 'ref' ? 'code or name' : ''))])
  })
  app.post('/api/e/:entity/import', async (req) => {
    const def = guard(getDef((req.params as any).entity))
    assertCan(req.ctx, def.module, 'create')
    if (def.readonlyApi || def.children?.length) throw bad('This record type cannot be imported from CSV')
    const b = body<{ csv: string; dryRun?: boolean }>(req)
    const rows = parseCsv(String(b.csv ?? ''))
    if (rows.length < 2) throw bad('The file has no data rows')
    if (rows.length > 5001) throw bad('Import is limited to 5,000 rows at a time')
    const head = rows[0].map(h => h.trim().toLowerCase())
    const fields = def.fields.filter(f => !f.secret && !f.virtual && !f.readonly && !f.computed && f.type !== 'json')
    const map = head.map(h => fields.find(f => f.label.toLowerCase() === h || f.name.toLowerCase() === h))
    if (!map.some(Boolean)) throw bad('No columns matched. Download the template to see the expected column names.')
    const errors: { row: number; error: string }[] = []
    let created = 0
    for (let i = 1; i < rows.length; i++) {
      try {
        const payload: Record<string, any> = {}
        map.forEach((f, ci) => {
          if (!f) return
          const raw = (rows[i][ci] ?? '').trim()
          if (raw === '') return
          if (f.type === 'ref') { const id = resolveRef(f, raw); if (!id) throw bad(`${f.label}: "${raw}" not found`); payload[f.name] = id }
          else if (f.type === 'bool') payload[f.name] = /^(1|true|yes|y)$/i.test(raw)
          else if (f.type === 'select') { const o = (f.options ?? []).map(optValue).find(x => x.toLowerCase() === raw.toLowerCase()); if (!o) throw bad(`${f.label}: "${raw}" is not one of ${(f.options ?? []).map(optValue).join(', ')}`); payload[f.name] = o }
          else payload[f.name] = raw
        })
        if (b.dryRun) { tx(() => { const r = createRecord(def, payload, req.ctx); throw Object.assign(new Error('rollback'), { rolled: r }) }) }
        else { createRecord(def, payload, req.ctx); created++ }
      } catch (e: any) {
        if (e?.message === 'rollback') { created++; continue }
        errors.push({ row: i + 1, error: e?.message ?? String(e) })
      }
    }
    return { created, errors: errors.slice(0, 200), failed: errors.length, dryRun: !!b.dryRun }
  })

  // ------------------------------------------------------------ bulk
  app.post('/api/e/:entity/bulk', async (req) => {
    const def = guard(getDef((req.params as any).entity))
    const b = body<{ ids: number[]; action: 'delete' | 'set'; field?: string; value?: any }>(req)
    if (!Array.isArray(b.ids) || !b.ids.length) throw bad('Select at least one record')
    if (b.ids.length > 500) throw bad('Bulk actions are limited to 500 records')
    const ok: number[] = [], failed: { id: number; error: string }[] = []
    for (const id of b.ids) {
      try {
        if (b.action === 'delete') deleteRecord(def, Number(id), req.ctx)
        else if (b.action === 'set' && b.field) updateRecord(def, Number(id), { [b.field]: b.value }, req.ctx)
        else throw bad('Unknown bulk action')
        ok.push(id)
      } catch (e: any) { failed.push({ id, error: e?.message ?? String(e) }) }
    }
    return { ok: ok.length, failed }
  })

  // ------------------------------------------------------------ single record
  app.get('/api/e/:entity/:id', async (req) => {
    const p = req.params as any
    const def = guard(getDef(p.entity))
    return getRecord(def, idOf(p.id), req.ctx)
  })
  app.post('/api/e/:entity', async (req, reply) => {
    const def = guard(getDef((req.params as any).entity))
    const rec = createRecord(def, body(req), req.ctx)
    reply.status(201)
    return rec
  })
  app.put('/api/e/:entity/:id', async (req) => {
    const p = req.params as any
    const def = guard(getDef(p.entity))
    return updateRecord(def, idOf(p.id), body(req), req.ctx)
  })
  app.delete('/api/e/:entity/:id', async (req) => {
    const p = req.params as any
    const def = guard(getDef(p.entity))
    deleteRecord(def, idOf(p.id), req.ctx)
    return { ok: true }
  })
  void can; void recordTitle; void rowToApi; void attachLabels; void safeJson; void nowLocal; void customFieldsFor; void invalidateCustomFields
}
export type { Ctx }
