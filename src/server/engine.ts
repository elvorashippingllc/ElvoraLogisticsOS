import { isPg, db, q, qi, tx, currentDb, type Row } from './db'
import { ENTITIES } from '../shared/entities'
import { recordTitle, optValue, type EntityDef, type FieldDef, type Action } from '../shared/types'
import { bad, conflict, forbidden, fromCents, nowIso, nowLocal, notFound, safeJson, todayStr, toCents, HttpError, clamp } from './util'
import { hooksFor, type HookArgs } from './hooks'
import { runAutomations } from './automation'
import { emitWebhooks } from './webhooks'

export type Perms = '*' | Record<string, string[]>
export interface SessionUser {
  id: number; name: string; email: string; role_id: number | null; role_name: string; permissions: Perms
  branch_id: number | null; party_id: number | null; apiKey?: boolean
}
export interface Ctx { user: SessionUser | null; ip?: string; system?: boolean; after?: (() => void)[] }
export const SYSTEM_CTX: Ctx = { user: null, system: true }

export type Rec = Record<string, any>

// ------------------------------------------------------------------ permissions
export function can(user: SessionUser | null, module: string, action: Action): boolean {
  if (!user) return false
  const p = user.permissions
  if (p === '*') return true
  const m = p[module]
  return !!m && (m.includes('*') || m.includes(action))
}
export function assertCan(ctx: Ctx, module: string, action: Action) {
  if (ctx.system) return
  if (!can(ctx.user, module, action)) throw forbidden(`You do not have ${action} access to ${module}`)
}

// Portal users (customers) are restricted to their own company's records.
const SCOPE: Record<string, string> = {
  jobs: 'client_id', invoices: 'party_id', quotations: 'customer_id', receipts: 'party_id', parties: 'id', tickets: 'customer_id', contracts: 'party_id',
}

// ------------------------------------------------------------------ custom fields
const cfCaches = new WeakMap<object, Record<string, FieldDef[]>>()
export function invalidateCustomFields() { cfCaches.delete(currentDb()) }
export function customFieldsFor(entity: string): FieldDef[] {
  let cfCache = cfCaches.get(currentDb())
  if (!cfCache) {
    cfCache = {}
    cfCaches.set(currentDb(), cfCache)
    for (const r of q.all(`SELECT * FROM custom_fields WHERE deleted_at IS NULL ORDER BY sort, id`)) {
      const type = r.type === 'number' ? 'number' : r.type === 'bool' ? 'bool' : r.type === 'date' ? 'date' : r.type === 'select' ? 'select' : r.type === 'textarea' ? 'textarea' : 'text'
      const f: FieldDef = { name: r.name, label: r.label, type, required: !!r.required, section: 'Custom fields' }
      if (type === 'select') f.options = String(r.options ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
      ;(cfCache[r.entity] ??= []).push(f)
    }
  }
  return cfCache[entity] ?? []
}

export function getDef(key: string): EntityDef {
  const d = ENTITIES[key]
  if (!d) throw notFound(`Unknown record type "${key}"`)
  return d
}

// ------------------------------------------------------------------ conversion
const stored = (def: EntityDef) => def.fields.filter(f => !f.virtual)

function toDb(f: FieldDef, v: any): any {
  if (v === undefined || v === null || v === '') return null
  switch (f.type) {
    case 'money': return toCents(v)
    case 'bool': return v ? 1 : 0
    case 'json': return JSON.stringify(v)
    case 'int': case 'ref': return Math.trunc(Number(v))
    case 'number': case 'percent': return Number(v)
    default: return String(v)
  }
}
function fromDb(f: FieldDef, v: any): any {
  if (v === null || v === undefined) return null
  switch (f.type) {
    case 'money': return fromCents(v)
    case 'bool': return !!v
    case 'json': return safeJson(v, null)
    default: return v
  }
}

export function rowToApi(def: EntityDef, row: Row): Rec {
  const out: Rec = { id: row.id }
  for (const f of def.fields) {
    if (f.secret || f.virtual) continue
    out[f.name] = fromDb(f, row[f.name])
  }
  out.version = row.version; out.created_at = row.created_at; out.updated_at = row.updated_at; out.created_by = row.created_by; out.updated_by = row.updated_by
  if (def.customFields) out.custom = safeJson(row.custom, {})
  return out
}

// ------------------------------------------------------------------ validation
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function coerceIn(f: FieldDef, v: any): any {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  switch (f.type) {
    case 'text': case 'textarea': case 'phone': return String(v).trim().slice(0, f.type === 'textarea' ? 20000 : 1000)
    case 'email': { const s = String(v).trim().toLowerCase(); if (!EMAIL.test(s)) throw bad(`${f.label}: invalid e-mail address`); return s }
    case 'url': { const s = String(v).trim(); if (!/^https?:\/\//i.test(s)) throw bad(`${f.label}: must start with http:// or https://`); return s }
    case 'int': { const n = Number(v); if (!Number.isFinite(n) || !Number.isInteger(n)) throw bad(`${f.label}: must be a whole number`); return n }
    case 'number': case 'percent': case 'money': {
      const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
      if (!Number.isFinite(n)) throw bad(`${f.label}: must be a number`)
      if (f.min !== undefined && n < f.min) throw bad(`${f.label}: minimum ${f.min}`)
      if (f.max !== undefined && n > f.max) throw bad(`${f.label}: maximum ${f.max}`)
      return n
    }
    case 'date': { const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) throw bad(`${f.label}: invalid date`); return s }
    case 'datetime': {
      const s = String(v).replace(' ', 'T')
      if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(s) || isNaN(Date.parse(s.slice(0, 10)))) throw bad(`${f.label}: invalid date/time`)
      return s.length === 10 ? s + 'T00:00' : s.slice(0, 16)
    }
    case 'bool': return v === true || v === 1 || v === '1' || v === 'true' || v === 'on' || v === 'yes' || v === 'Yes'
    case 'select': {
      const s = String(v)
      const ok = (f.options ?? []).map(optValue)
      if (!ok.includes(s)) throw bad(`${f.label}: "${s}" is not a valid option`)
      return s
    }
    case 'ref': { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw bad(`${f.label}: invalid reference`); return n }
    case 'json': return v
  }
}

function defaultValue(f: FieldDef, ctx: Ctx): any {
  const d = f.default
  if (d === undefined || d === null) return f.type === 'bool' ? false : undefined
  if (d === 'today') return todayStr()
  if (d === 'now') return nowLocal()
  if (d === 'me') return ctx.user?.id
  return d
}

// ------------------------------------------------------------------ labels
export function titleCols(def: EntityDef): string[] {
  const names = new Set<string>(def.title)
  if (def.titleFmt) for (const m of def.titleFmt.matchAll(/\{(\w+)\}/g)) names.add(m[1])
  return [...names].filter(n => def.fields.some(f => f.name === n))
}

/** Resolve display labels for ids of an entity (one level of nested ref titles). */
export function labelsFor(entityKey: string, ids: number[]): Map<number, string> {
  const out = new Map<number, string>()
  const uniq = [...new Set(ids.filter(n => Number.isInteger(n) && n > 0))]
  if (!uniq.length) return out
  const def = ENTITIES[entityKey]
  if (!def) return out
  const cols = titleCols(def)
  const sel = ['id', ...cols].map(qi).join(',')
  const nestedIds: Record<string, number[]> = {}
  const rows: Row[] = []
  for (let i = 0; i < uniq.length; i += 400) {
    const chunk = uniq.slice(i, i + 400)
    rows.push(...q.all(`SELECT ${sel}, deleted_at FROM ${qi(entityKey)} WHERE id IN (${chunk.map(() => '?').join(',')})`, ...chunk))
  }
  for (const r of rows) for (const c of cols) {
    const f = def.fields.find(x => x.name === c)!
    if (f.type === 'ref' && r[c]) (nestedIds[f.ref!] ??= []).push(r[c])
  }
  const nested: Record<string, Map<number, string>> = {}
  for (const [k, v] of Object.entries(nestedIds)) nested[k] = labelsFor(k, v)
  for (const r of rows) {
    const lab: Record<string, string> = {}
    for (const c of cols) {
      const f = def.fields.find(x => x.name === c)!
      if (f.type === 'ref') lab[c] = nested[f.ref!]?.get(r[c]) ?? ''
    }
    const rec: Rec = {}
    for (const c of cols) rec[c] = fromDb(def.fields.find(x => x.name === c)!, r[c])
    rec.id = r.id
    const t = recordTitle(def, rec, lab)
    out.set(r.id, r.deleted_at ? `${t} (deleted)` : t)
  }
  return out
}

export function attachLabels(def: EntityDef, recs: Rec[]) {
  const refs = def.fields.filter(f => f.type === 'ref' && !f.secret)
  const byEntity: Record<string, number[]> = {}
  for (const r of recs) for (const f of refs) if (r[f.name]) (byEntity[f.ref!] ??= []).push(r[f.name])
  const maps: Record<string, Map<number, string>> = {}
  for (const [k, ids] of Object.entries(byEntity)) maps[k] = labelsFor(k, ids)
  for (const r of recs) {
    const lab: Record<string, string> = {}
    for (const f of refs) if (r[f.name]) lab[f.name] = maps[f.ref!]?.get(r[f.name]) ?? `#${r[f.name]}`
    r._labels = lab
    r._title = recordTitle(def, r, lab)
  }
}

// ------------------------------------------------------------------ numbering
export function nextSeq(key: string): number {
  q.run(`INSERT INTO sequences(key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = sequences.value + 1`, key)
  return q.val<number>(`SELECT value FROM sequences WHERE key = ?`, key)!
}
export function formatNumber(key: string, pattern: string, tokens: Record<string, string>, date: string): string {
  const d = date || todayStr()
  const base: Record<string, string> = { YYYY: d.slice(0, 4), YY: d.slice(2, 4), MM: d.slice(5, 7), DD: d.slice(8, 10), ...tokens }
  let pad = 4
  const withoutSeq = pattern.replace(/\{seq:(\d+)\}/, (_m, n) => { pad = Number(n); return '\u0000' }).replace(/\{(\w+)\}/g, (_m, t) => base[t] ?? '')
  // The sequence key keeps its historical NUL marker on SQLite (changing it would restart numbering); PostgreSQL text cannot hold NUL.
  const seq = nextSeq(`${key}|${isPg ? withoutSeq.replace('\u0000', '{seq}') : withoutSeq}`)
  return withoutSeq.replace('\u0000', String(seq).padStart(pad, '0'))
}

// ------------------------------------------------------------------ filters
export interface Filter { field: string; op: string; value?: any }
export interface ListParams { q?: string; page?: number; pageSize?: number; sort?: string; dir?: string; filters?: Filter[]; ids?: number[]; includeDeleted?: boolean }

const likeEsc = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m)

function refSearchSubquery(f: FieldDef, op: string, value: any): { sql: string; args: any[] } | null {
  const rdef = ENTITIES[f.ref!]
  if (!rdef) return null
  const cols = [...new Set([...titleCols(rdef).filter(c => rdef.fields.find(x => x.name === c)?.type !== 'ref'), ...rdef.fields.filter(x => x.search && x.type !== 'ref').map(x => x.name)])]
  if (!cols.length) return null
  const v = likeEsc(String(value))
  const pat = op === 'starts' ? `${v}%` : op === 'ends' ? `%${v}` : op === 'eq' ? v : `%${v}%`
  return { sql: `${qi(f.name)} IN (SELECT id FROM ${qi(rdef.key)} WHERE ${cols.map(c => `${qi(c)} LIKE ? ESCAPE '\\'`).join(' OR ')})`, args: cols.map(() => pat) }
}

function buildWhere(def: EntityDef, p: ListParams, ctx: Ctx): { where: string; args: any[] } {
  const cl: string[] = []; const args: any[] = []
  if (!p.includeDeleted) cl.push('deleted_at IS NULL')
  if (p.ids?.length) { cl.push(`id IN (${p.ids.map(() => '?').join(',')})`); args.push(...p.ids) }
  const scope = ctx.user?.party_id && !ctx.system ? SCOPE[def.key] : undefined
  if (ctx.user?.party_id && !ctx.system) {
    if (!scope) { cl.push('1=0') } else { cl.push(`${qi(scope)} = ?`); args.push(ctx.user.party_id) }
  }
  if (p.q && p.q.trim()) {
    const cols = [...new Set([...def.fields.filter(f => f.search && f.type !== 'ref').map(f => f.name), ...titleCols(def).filter(c => def.fields.find(x => x.name === c)?.type !== 'ref')])]
    const term = `%${likeEsc(p.q.trim())}%`
    if (cols.length) { cl.push('(' + cols.map(c => `${qi(c)} LIKE ? ESCAPE '\\'`).join(' OR ') + ')'); args.push(...cols.map(() => term)) }
  }
  for (const flt of p.filters ?? []) {
    const f = def.fields.find(x => x.name === flt.field && !x.secret)
    const sys = ['id', 'created_at', 'updated_at'].includes(flt.field)
    if (!f && !sys) continue
    const col = qi(flt.field)
    const type = f?.type ?? 'text'
    const raw = flt.value
    const val = (v: any) => (f ? toDb(f, v) : v)
    switch (flt.op) {
      case 'null': cl.push(`(${col} IS NULL OR ${col} = '')`); break
      case 'notnull': cl.push(`(${col} IS NOT NULL AND ${col} <> '')`); break
      case 'eq': case '=': case undefined as any:
        if (raw === undefined || raw === '') break
        if (type === 'ref' && typeof raw === 'string' && !/^\d+$/.test(raw)) { const s = refSearchSubquery(f!, 'eq', raw); if (s) { cl.push(s.sql); args.push(...s.args) } }
        else { cl.push(`${col} = ?`); args.push(val(raw)) }
        break
      case 'ne': if (raw === undefined || raw === '') break; cl.push(`(${col} IS NULL OR ${col} <> ?)`); args.push(val(raw)); break
      case 'contains': case 'starts': case 'ends': {
        if (raw === undefined || raw === '') break
        if (type === 'ref' && f) { const s = refSearchSubquery(f, flt.op, raw); if (s) { cl.push(s.sql); args.push(...s.args) } break }
        const v = likeEsc(String(raw))
        cl.push(`${col} LIKE ? ESCAPE '\\'`); args.push(flt.op === 'starts' ? `${v}%` : flt.op === 'ends' ? `%${v}` : `%${v}%`)
        break
      }
      case 'gt': case 'gte': case 'lt': case 'lte': {
        if (raw === undefined || raw === '') break
        const opMap: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=' }
        cl.push(`${col} ${opMap[flt.op]} ?`); args.push(val(raw)); break
      }
      case 'in': {
        const arr = (Array.isArray(raw) ? raw : String(raw ?? '').split(',')).map(x => String(x).trim()).filter(Boolean)
        if (!arr.length) break
        cl.push(`${col} IN (${arr.map(() => '?').join(',')})`); args.push(...arr.map(x => val(x)))
        break
      }
      case 'between': {
        const [a, b] = Array.isArray(raw) ? raw : String(raw ?? '').split('..')
        if (a) { cl.push(`${col} >= ?`); args.push(val(a)) }
        if (b) { cl.push(`${col} <= ?`); args.push(val(b)) }
        break
      }
    }
  }
  return { where: cl.length ? 'WHERE ' + cl.join(' AND ') : '', args }
}

// ------------------------------------------------------------------ read
export function listRecords(def: EntityDef, p: ListParams, ctx: Ctx) {
  assertCan(ctx, def.module, 'view')
  const { where, args } = buildWhere(def, p, ctx)
  const page = Math.max(1, Math.trunc(p.page ?? 1))
  const pageSize = clamp(Math.trunc(p.pageSize ?? 25), 1, 100000)
  const sortField = def.fields.find(f => f.name === p.sort && !f.secret && !f.virtual)?.name ?? (['id', 'created_at', 'updated_at'].includes(p.sort ?? '') ? p.sort : undefined) ?? def.defaultSort?.field ?? 'id'
  const dir = (p.dir ?? (p.sort ? 'asc' : def.defaultSort?.dir ?? 'desc')).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const total = q.val<number>(`SELECT COUNT(*) FROM ${qi(def.key)} ${where}`, ...args) ?? 0
  const rows = q.all(`SELECT * FROM ${qi(def.key)} ${where} ORDER BY ${qi(sortField)} ${dir}, id DESC LIMIT ? OFFSET ?`, ...args, pageSize, (page - 1) * pageSize)
  const recs = rows.map(r => rowToApi(def, r))
  attachLabels(def, recs)
  return { rows: recs, total, page, pageSize }
}

export function getRecord(def: EntityDef, id: number, ctx: Ctx, opts: { children?: boolean; includeDeleted?: boolean } = {}): Rec {
  assertCan(ctx, def.module, 'view')
  const row = q.get(`SELECT * FROM ${qi(def.key)} WHERE id = ?`, id)
  if (!row || (row.deleted_at && !opts.includeDeleted)) throw notFound()
  const scope = ctx.user?.party_id && !ctx.system ? SCOPE[def.key] : undefined
  if (ctx.user?.party_id && !ctx.system && (!scope || row[scope] !== ctx.user.party_id)) throw notFound()
  const rec = rowToApi(def, row)
  attachLabels(def, [rec])
  if (opts.children !== false && def.children?.length) rec.children = loadChildren(def, id)
  return rec
}

export function loadChildren(def: EntityDef, id: number): Record<string, Rec[]> {
  const out: Record<string, Rec[]> = {}
  for (const c of def.children ?? []) {
    const cdef = ENTITIES[c.entity]
    const rows = q.all(`SELECT * FROM ${qi(c.entity)} WHERE ${qi(c.fk)} = ? AND deleted_at IS NULL ORDER BY ${cdef.fields.some(f => f.name === 'seq') ? 'seq,' : ''} id`, id)
    const recs = rows.map(r => rowToApi(cdef, r))
    attachLabels(cdef, recs)
    out[c.key] = recs
  }
  return out
}

export function findOne(entity: string, where: string, ...args: any[]): Rec | null {
  const def = getDef(entity)
  const row = q.get(`SELECT * FROM ${qi(entity)} WHERE deleted_at IS NULL AND (${where}) LIMIT 1`, ...args)
  return row ? rowToApi(def, row) : null
}

// ------------------------------------------------------------------ write
function assertRefs(def: EntityDef, rec: Rec) {
  for (const f of def.fields) {
    if (f.type !== 'ref' || !rec[f.name]) continue
    const ok = q.val<number>(`SELECT 1 FROM ${qi(f.ref!)} WHERE id = ? AND deleted_at IS NULL`, rec[f.name])
    if (!ok) throw bad(`${f.label}: referenced record no longer exists`)
  }
}
function assertUnique(def: EntityDef, rec: Rec, id: number | null) {
  for (const f of def.fields) {
    if (!f.unique || rec[f.name] === null || rec[f.name] === undefined || rec[f.name] === '') continue
    const dup = q.val<number>(`SELECT id FROM ${qi(def.key)} WHERE ${qi(f.name)} = ? AND deleted_at IS NULL AND id <> ? LIMIT 1`, toDb(f, rec[f.name]), id ?? 0)
    if (dup) throw conflict(`${f.label} "${rec[f.name]}" already exists`)
  }
}

/** Apply client payload to a record, honouring field flags. */
function applyPayload(def: EntityDef, base: Rec, payload: Rec, isNew: boolean, ctx: Ctx) {
  const out: Rec = { ...base }
  for (const f of def.fields) {
    if (f.secret) continue
    const writable = !f.readonly && !f.computed && !f.virtual
    if (f.virtual) { if (payload[f.name] !== undefined) out[f.name] = payload[f.name]; continue }
    if (!writable && !ctx.system) continue
    if (payload[f.name] !== undefined) out[f.name] = coerceIn(f, payload[f.name])
  }
  if (isNew) for (const f of def.fields) if (out[f.name] === undefined || (out[f.name] === null && !f.computed && f.default !== undefined && payload[f.name] === undefined)) {
    const d = defaultValue(f, ctx)
    if (d !== undefined && !f.virtual) out[f.name] = coerceIn(f, d)
  }
  return out
}

function checkRequired(def: EntityDef, rec: Rec) {
  for (const f of def.fields) {
    if (!f.required || f.virtual || f.computed) continue
    const v = rec[f.name]
    if (v === null || v === undefined || v === '') throw bad(`${f.label} is required`, { field: f.name })
  }
}

function validateCustom(def: EntityDef, incoming: any, previous: Rec = {}): Rec {
  if (!def.customFields) return {}
  const defs = customFieldsFor(def.key)
  const out: Rec = { ...previous }
  if (incoming && typeof incoming === 'object') for (const f of defs) if (incoming[f.name] !== undefined) {
    const v = coerceIn(f, incoming[f.name])
    if (v === null) delete out[f.name]; else out[f.name] = v
  }
  for (const f of defs) if (f.required && (out[f.name] === undefined || out[f.name] === null || out[f.name] === '')) throw bad(`${f.label} is required`)
  return out
}

function writeRow(def: EntityDef, rec: Rec, ctx: Ctx, id: number | null, customJson: string | null, expectedVersion?: number): number {
  const now = nowIso(); const uid = ctx.user?.id ?? null
  const fields = stored(def)
  const wf = fields.filter(f => !(f.secret && rec[f.name] === undefined))
  if (id === null) {
    const cols = [...wf.map(f => f.name), 'custom', 'version', 'created_at', 'updated_at', 'created_by', 'updated_by']
    const vals = [...wf.map(f => toDb(f, rec[f.name])), customJson, 1, now, now, uid, uid]
    return q.insert(`INSERT INTO ${qi(def.key)} (${cols.map(qi).join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...vals)
  }
  const sets = [...wf.map(f => `${qi(f.name)} = ?`), 'custom = ?', 'version = version + 1', 'updated_at = ?', 'updated_by = ?']
  const vals = [...wf.map(f => toDb(f, rec[f.name])), customJson, now, uid]
  const res = db.prepare(`UPDATE ${qi(def.key)} SET ${sets.join(',')} WHERE id = ? ${expectedVersion ? 'AND version = ?' : ''}`).run(...vals, id, ...(expectedVersion ? [expectedVersion] : []))
  if (res.changes === 0) throw conflict('This record was changed by someone else. Reload and try again.')
  return id
}

/** Strip server-owned keys from client supplied child rows. */
function sanitizeChildren(def: EntityDef, incoming: any, ctx: Ctx): Record<string, Rec[]> {
  const out: Record<string, Rec[]> = {}
  if (!incoming || typeof incoming !== 'object') return out
  for (const c of def.children ?? []) {
    const rows = incoming[c.key]
    if (!Array.isArray(rows)) continue
    const cdef = ENTITIES[c.entity]
    out[c.key] = rows.map((raw: Rec) => {
      const row: Rec = {}
      if (raw.id) row.id = Number(raw.id)
      for (const f of cdef.fields) {
        if (f.secret || f.virtual || raw[f.name] === undefined) continue
        if ((f.readonly || f.computed) && !ctx.system) continue
        row[f.name] = raw[f.name]
      }
      return row
    })
  }
  return out
}

function saveChildren(def: EntityDef, parentId: number, incoming: Record<string, Rec[]>, ctx: Ctx, changed: Record<string, [number, number]>) {
  for (const c of def.children ?? []) {
    const rows = incoming[c.key]
    if (!Array.isArray(rows)) continue
    const cdef = ENTITIES[c.entity]
    const existing = q.all(`SELECT id FROM ${qi(c.entity)} WHERE ${qi(c.fk)} = ? AND deleted_at IS NULL`, parentId).map(r => r.id as number)
    const keep = new Set<number>()
    let seq = 0
    let touched = false
    for (const raw of rows) {
      seq++
      const rid = raw.id && existing.includes(Number(raw.id)) ? Number(raw.id) : null
      const base: Rec = rid ? rowToApi(cdef, q.get(`SELECT * FROM ${qi(c.entity)} WHERE id = ?`, rid)!) : {}
      const rec: Rec = { ...base }
      for (const f of cdef.fields) {
        if (f.secret || f.virtual) continue
        if (raw[f.name] !== undefined) rec[f.name] = coerceIn(f, raw[f.name])
      }
      rec[c.fk] = parentId
      if (cdef.fields.some(f => f.name === 'seq') && !rec.seq) rec.seq = seq
      if (!rid) for (const f of cdef.fields) if (rec[f.name] === undefined) { const d = defaultValue(f, ctx); if (d !== undefined) rec[f.name] = coerceIn(f, d) }
      checkRequired(cdef, rec)
      assertRefs(cdef, rec)
      if (rid) {
        const before = JSON.stringify(base)
        const after = JSON.stringify({ ...base, ...rec })
        if (before !== after) touched = true
        writeRow(cdef, rec, ctx, rid, null); keep.add(rid)
      } else { keep.add(writeRow(cdef, rec, ctx, null, null)); touched = true }
    }
    const drop = existing.filter(i => !keep.has(i))
    for (const i of drop) q.run(`DELETE FROM ${qi(c.entity)} WHERE id = ?`, i)
    if (drop.length || touched) changed[c.key] = [existing.length, rows.length]
  }
}

function auditLog(ctx: Ctx, def: EntityDef, id: number, action: string, changes: any, label: string) {
  if (def.key === 'custom_fields') invalidateCustomFields()
  q.run(`INSERT INTO audit_log(at, user_id, user_name, entity, record_id, record_label, action, changes, ip) VALUES (?,?,?,?,?,?,?,?,?)`,
    nowIso(), ctx.user?.id ?? null, ctx.user?.name ?? 'System', def.key, id, label, action, changes ? JSON.stringify(changes) : null, ctx.ip ?? null)
}
export const audit = auditLog

function diffRecords(def: EntityDef, a: Rec, b: Rec): Record<string, [any, any]> {
  const d: Record<string, [any, any]> = {}
  for (const f of def.fields) {
    if (f.secret || f.virtual) continue
    const x = a[f.name] ?? null, y = b[f.name] ?? null
    if (JSON.stringify(x) !== JSON.stringify(y)) d[f.name] = [x, y]
  }
  return d
}

function fireHooks(phase: 'beforeSave' | 'afterSave', args: HookArgs) {
  const h = hooksFor(args.def.key)
  h[phase]?.(args)
}

export function createRecord(def: EntityDef, payload: Rec, ctx: Ctx): Rec {
  assertCan(ctx, def.module, 'create')
  if (def.readonlyApi && !ctx.system) throw forbidden('This record type is read-only')
  if (def.child && !ctx.system) throw forbidden('Edit this through its parent record')
  const after: (() => void)[] = []
  const c2: Ctx = { ...ctx, after }
  const result = tx(() => {
    let rec = applyPayload(def, {}, payload, true, c2)
    const children = sanitizeChildren(def, payload.children, c2)
    const h = hooksFor(def.key)
    h.beforeSave?.({ def, rec, old: null, children, isNew: true, ctx: c2 })
    checkRequired(def, rec)
    assertRefs(def, rec)
    assertUnique(def, rec, null)
    if (def.numbering && !rec[def.numbering.field]) {
      const tokens = h.tokens?.(rec) ?? {}
      rec[def.numbering.field] = formatNumber(def.key, def.numbering.pattern, tokens, h.numberDate?.(rec) ?? todayStr())
    }
    const custom = validateCustom(def, payload.custom)
    const id = writeRow(def, rec, c2, null, Object.keys(custom).length ? JSON.stringify(custom) : null)
    rec.id = id
    const ch: Record<string, [number, number]> = {}
    saveChildren(def, id, children, c2, ch)
    // let hooks recompute from persisted children (totals etc.)
    fireHooks('afterSave', { def, rec, old: null, children, isNew: true, ctx: c2 })
    const fresh = getRecord(def, id, SYSTEM_CTX)
    const label = fresh._title
    auditLog(c2, def, id, 'create', null, label)
    after.push(() => emitWebhooks(def.key + '.created', fresh))
    runAutomations(def.key, 'created', fresh, null)
    return fresh
  })
  after.forEach(fn => { try { fn() } catch { /* post-commit side effects must not fail the request */ } })
  return result
}

export function updateRecord(def: EntityDef, id: number, payload: Rec, ctx: Ctx): Rec {
  assertCan(ctx, def.module, 'edit')
  if (def.readonlyApi && !ctx.system) throw forbidden('This record type is read-only')
  if (def.child && !ctx.system) throw forbidden('Edit this through its parent record')
  const after: (() => void)[] = []
  const c2: Ctx = { ...ctx, after }
  const result = tx(() => {
    const oldFull = getRecord(def, id, ctx.system ? ctx : ctx, { children: true })
    const old = { ...oldFull }
    if (payload.version !== undefined && Number(payload.version) !== old.version && !ctx.system) throw conflict('This record was changed by someone else. Reload and try again.')
    const rec = applyPayload(def, old, payload, false, c2)
    const children = sanitizeChildren(def, payload.children, c2)
    const h = hooksFor(def.key)
    h.beforeSave?.({ def, rec, old, children, isNew: false, ctx: c2 })
    checkRequired(def, rec)
    assertRefs(def, rec)
    assertUnique(def, rec, id)
    const custom = def.customFields ? validateCustom(def, payload.custom, old.custom ?? {}) : {}
    writeRow(def, rec, c2, id, def.customFields && Object.keys(custom).length ? JSON.stringify(custom) : null)
    const ch: Record<string, [number, number]> = {}
    saveChildren(def, id, children, c2, ch)
    fireHooks('afterSave', { def, rec, old, children, isNew: false, ctx: c2 })
    const fresh = getRecord(def, id, SYSTEM_CTX)
    const d = diffRecords(def, old, fresh)
    delete d.updated_at
    const changes: Rec = { ...d }
    if (Object.keys(ch).length) changes._children = ch
    if (Object.keys(changes).length) auditLog(c2, def, id, 'update', changes, fresh._title)
    after.push(() => emitWebhooks(def.key + '.updated', fresh))
    if (Object.keys(changes).length) runAutomations(def.key, 'updated', fresh, old, d)
    return fresh
  })
  after.forEach(fn => { try { fn() } catch { /* ignore */ } })
  return result
}

/** Internal helper for server logic: patch fields without client restrictions (still audited, hooks run). */
export function patchRecord(def: EntityDef, id: number, patch: Rec, ctx: Ctx): Rec {
  return updateRecord(def, id, patch, { ...ctx, system: true, user: ctx.user })
}

function referencedBy(def: EntityDef, id: number): { entity: string; label: string; count: number }[] {
  const out: { entity: string; label: string; count: number }[] = []
  const childKeys = new Set((def.children ?? []).map(c => c.entity))
  for (const other of Object.values(ENTITIES)) {
    if (childKeys.has(other.key)) continue
    for (const f of other.fields) {
      if (f.type === 'ref' && f.ref === def.key) {
        const n = q.val<number>(`SELECT COUNT(*) FROM ${qi(other.key)} WHERE ${qi(f.name)} = ? AND deleted_at IS NULL`, id) ?? 0
        if (n) out.push({ entity: other.key, label: other.plural, count: n })
      }
    }
  }
  return out
}

export function deleteRecord(def: EntityDef, id: number, ctx: Ctx) {
  assertCan(ctx, def.module, 'delete')
  if ((def.noDelete || def.readonlyApi || def.child) && !ctx.system) throw forbidden(`${def.plural} cannot be deleted${def.noDelete ? ' — cancel or void them instead' : ''}`)
  tx(() => {
    const rec = getRecord(def, id, ctx, { children: false })
    const used = referencedBy(def, id)
    if (used.length) throw conflict(`Cannot delete: used by ${used.map(u => `${u.count} ${u.label}`).join(', ')}`)
    hooksFor(def.key).beforeDelete?.({ def, rec, ctx })
    const now = nowIso()
    // free unique values so they can be reused
    q.run(`UPDATE ${qi(def.key)} SET deleted_at = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ?`, now, now, ctx.user?.id ?? null, id)
    auditLog(ctx, def, id, 'delete', null, rec._title)
    q.run(`DELETE FROM record_likes WHERE entity = ? AND record_id = ?`, def.key, id)
  })
  emitWebhooks(def.key + '.deleted', { id })
}

/** Insert a row without running hooks (used by server logic for child tables such as job_events). */
export function insertRow(def: EntityDef, rec: Rec, ctx: Ctx = SYSTEM_CTX): number {
  for (const f of def.fields) if (rec[f.name] === undefined) { const d = defaultValue(f, ctx); if (d !== undefined) rec[f.name] = d }
  return writeRow(def, rec, ctx, null, null)
}

export { HttpError }
