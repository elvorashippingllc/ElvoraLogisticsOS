import { q } from '../db'
import { ENTITY_LIST } from '../../shared/entities'
import { getSetting, setSettings } from '../settings'
import { http, logIntegration } from './log'

export const supabaseConfigured = () => !!getSetting('supabase_url') && !!getSetting('supabase_service_key')
const base = () => String(getSetting('supabase_url')).replace(/\/+$/, '')
const hdr = () => ({ apikey: getSetting('supabase_service_key'), Authorization: `Bearer ${getSetting('supabase_service_key')}`, 'Content-Type': 'application/json' })

const SYSTEM_TABLES: { name: string; cols: string[]; pk: string; ts?: string }[] = [
  { name: 'audit_log', pk: 'id', cols: ['id', 'at', 'user_id', 'user_name', 'entity', 'record_id', 'record_label', 'action', 'changes', 'ip'] },
  { name: 'comments', pk: 'id', cols: ['id', 'entity', 'record_id', 'user_id', 'body', 'created_at', 'deleted_at'] },
]
const pgType = (sqlite: string) => (/INT/i.test(sqlite) ? 'bigint' : /REAL/i.test(sqlite) ? 'double precision' : 'text')

/** Tables and columns to mirror. Secret columns never leave the server. */
function plan() {
  const out: { table: string; cols: string[]; types: Record<string, string> }[] = []
  for (const def of ENTITY_LIST) {
    const secret = new Set(def.fields.filter(f => f.secret).map(f => f.name))
    const info = q.all<{ name: string; type: string }>(`PRAGMA table_info("${def.key}")`).filter(c => !secret.has(c.name))
    if (!info.length) continue
    out.push({ table: def.key, cols: info.map(c => c.name), types: Object.fromEntries(info.map(c => [c.name, pgType(c.type)])) })
  }
  return out
}

export function schemaSql(): string {
  const lines: string[] = ['-- Elvora Logistics OS → Supabase mirror schema (generated)', '-- Run once in the Supabase SQL editor. RLS is enabled with no policies: only the service key can read/write.', '']
  for (const t of plan()) {
    lines.push(`create table if not exists public."${t.table}" (`)
    lines.push(t.cols.map(c => `  "${c}" ${c === 'id' ? 'bigint primary key' : t.types[c]}`).join(',\n'))
    lines.push(');', `alter table public."${t.table}" enable row level security;`, '')
  }
  for (const s of SYSTEM_TABLES) {
    lines.push(`create table if not exists public."${s.name}" (`, s.cols.map(c => `  "${c}" ${c === 'id' ? 'bigint primary key' : /(_id|^id)$/.test(c) ? 'bigint' : 'text'}`).join(',\n'), ');', `alter table public."${s.name}" enable row level security;`, '')
  }
  return lines.join('\n')
}

export async function testSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured()) return { ok: false, error: 'Project URL and service-role key are required' }
  const r = await http(`${base()}/rest/v1/`, { headers: hdr() })
  return r.ok ? { ok: true } : { ok: false, error: `HTTP ${r.status} ${r.data?.message ?? r.text.slice(0, 120)}` }
}

let syncing = false
export async function syncToSupabase(): Promise<{ ok: boolean; rows: number; tables: number; errors: string[] }> {
  if (!supabaseConfigured()) return { ok: false, rows: 0, tables: 0, errors: ['Supabase is not configured'] }
  if (syncing) return { ok: false, rows: 0, tables: 0, errors: ['A sync is already running'] }
  syncing = true
  const errors: string[] = []
  let rows = 0, tables = 0
  const cursors: Record<string, string | number> = { ...(getSetting('supabase_cursors') ?? {}) }
  try {
    const jobs = [...plan().map(p => ({ table: p.table, cols: p.cols, ts: 'updated_at', pk: 'id' })), ...SYSTEM_TABLES.map(s => ({ table: s.name, cols: s.cols, ts: s.name === 'audit_log' ? 'id' : 'id', pk: 'id' }))]
    for (const j of jobs) {
      for (let guard = 0; guard < 200; guard++) {
        const cur = cursors[j.table]
        const list = j.ts === 'updated_at'
          ? q.all(`SELECT ${j.cols.map(c => `"${c}"`).join(',')} FROM "${j.table}" WHERE updated_at > ? ORDER BY updated_at, id LIMIT 400`, cur ?? '')
          : q.all(`SELECT ${j.cols.map(c => `"${c}"`).join(',')} FROM "${j.table}" WHERE id > ? ORDER BY id LIMIT 400`, cur ?? 0)
        if (!list.length) break
        const r = await http(`${base()}/rest/v1/${j.table}?on_conflict=id`, { method: 'POST', headers: { ...hdr(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(list), timeoutMs: 60000 })
        if (!r.ok) { errors.push(`${j.table}: HTTP ${r.status} ${r.data?.message ?? r.text.slice(0, 120)}`); break }
        const last = list[list.length - 1]
        cursors[j.table] = j.ts === 'updated_at' ? last.updated_at : last.id
        rows += list.length
        if (list.length < 400) break
      }
      tables++
    }
  } catch (e: any) { errors.push(String(e?.message ?? e)) } finally { syncing = false }
  setSettings({ supabase_cursors: cursors })
  logIntegration('supabase', 'sync', !errors.length, `Mirrored ${rows} rows across ${tables} tables${errors.length ? ` with ${errors.length} error(s)` : ''}`, errors.length ? errors.join('\n') : undefined)
  return { ok: !errors.length, rows, tables, errors }
}
export function resetSupabaseCursors() { setSettings({ supabase_cursors: {} }) }
