import Database from 'better-sqlite3'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { AsyncLocalStorage } from 'node:async_hooks'
import { config, dirs, ensureDirs } from './config'
import { PgConn } from './pgbridge'

ensureDirs()

/** True when DATABASE_URL points the app at PostgreSQL. Otherwise the local SQLite file is used. */
export const isPg = !!config.databaseUrl

// ------------------------------------------------------------------ SQLite
export function openDatabase(file: string): Database.Database {
  const d = new Database(file)
  d.pragma('journal_mode = WAL')
  d.pragma('synchronous = NORMAL')
  d.pragma('foreign_keys = ON')
  d.pragma('busy_timeout = 5000')
  return d
}

// ------------------------------------------------------------------ PostgreSQL
/** Translate the SQLite-flavoured SQL used throughout the app into PostgreSQL: ? → $n, LIKE → ILIKE (SQLite's LIKE ignores case), IS ? → null-safe comparison. */
export function toPg(sql: string): string {
  let n = 0, out = '', i = 0
  const plain = (seg: string) => seg
    .replace(/\bIS\s+NOT\s+\?/gi, 'IS DISTINCT FROM ?').replace(/\bIS\s+\?/gi, 'IS NOT DISTINCT FROM ?')
    .replace(/\bLIKE\b/gi, 'ILIKE').replace(/\bgroup_concat\(/gi, 'string_agg(').replace(/\?/g, () => '$' + ++n)
  let start = 0
  while (i < sql.length) {
    const c = sql[i]
    if (c === "'" || c === '"') {
      out += plain(sql.slice(start, i))
      let j = i + 1
      while (j < sql.length) { if (sql[j] === c) { if (sql[j + 1] === c) j += 2; else break } else j++ }
      out += sql.slice(i, j + 1); i = j + 1; start = i
    } else i++
  }
  return out + plain(sql.slice(start))
}
const cache = new Map<string, string>()
const tr = (sql: string) => { let t = cache.get(sql); if (t === undefined) { t = toPg(sql); if (cache.size < 5000) cache.set(sql, t) } return t }

let sharedConn: PgConn | null = null
const conn = () => (sharedConn ??= new PgConn(config.databaseUrl))
const ident = (s: string) => '"' + s.replace(/"/g, '""') + '"'

/** A workspace (production or demo) is a PostgreSQL schema on one shared connection. Exposes the better-sqlite3 subset the app uses. */
export class PgDatabase {
  readonly kind = 'pg'
  constructor(readonly schema: string) {}
  private enter(c: PgConn) { if (c.activeSchema !== this.schema) { c.call(`SET search_path TO ${ident(this.schema)}, public`, [], true); c.activeSchema = this.schema } }
  query(sql: string, params: any[] = []) { const c = conn(); this.enter(c); return c.call(tr(sql), params.map(p => (typeof p === 'number' && Number.isNaN(p) ? null : p))) }
  exec(sql: string) { const c = conn(); this.enter(c); c.call(sql, [], true) }
  pragma() { return [] }
  get inTransaction() { const c = conn(); return c.depth > 0 && c.txSchema === this.schema }
  prepare(sql: string) {
    const self = this
    const mk = (pluck: boolean): any => ({
      all: (...p: any[]) => self.query(sql, p).rows.map(r => (pluck ? Object.values(r)[0] : r)),
      get: (...p: any[]) => { const r = self.query(sql, p).rows[0]; return r === undefined ? undefined : pluck ? Object.values(r)[0] : r },
      run: (...p: any[]) => ({ changes: self.query(sql, p).rowCount, lastInsertRowid: 0 }),
      pluck: () => mk(true),
    })
    return mk(false)
  }
  transaction<T extends (...a: any[]) => any>(fn: T): T {
    const self = this
    return ((...args: any[]) => {
      const c = conn()
      if (c.depth > 0) return fn(...args)
      self.enter(c); c.call('BEGIN', [], true); c.depth++; c.txSchema = self.schema
      try { const r = fn(...args); c.call('COMMIT', [], true); return r }
      catch (e) { try { c.call('ROLLBACK', [], true) } catch { /* connection already gone */ } throw e }
      finally { c.depth--; c.txSchema = '' }
    }) as T
  }
  /** Logical snapshot (gzip-compressed NDJSON of every table) – there is no database file to copy. */
  async backup(dest: string): Promise<void> {
    const tables = this.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY 1`).rows.map(r => r.table_name as string)
    const lines: string[] = []
    for (const t of tables) {
      for (let off = 0; ; off += 5000) {
        const rows = this.query(`SELECT * FROM ${ident(t)} ORDER BY 1 LIMIT 5000 OFFSET ${off}`).rows
        for (const r of rows) lines.push(JSON.stringify({ t, r }))
        if (rows.length < 5000) break
      }
    }
    fs.writeFileSync(dest, zlib.gzipSync(lines.join('\n') + '\n'))
  }
  close() { /* the shared connection lives for the life of the process */ }
  /** Remove a schema and everything in it (demo rebuild). */
  dropSchema() { this.exec(`DROP SCHEMA IF EXISTS ${ident(this.schema)} CASCADE`); conn().activeSchema = '' }
  createSchema() { this.exec(`CREATE SCHEMA IF NOT EXISTS ${ident(this.schema)}`); conn().activeSchema = '' }
}
export const renameSchema = (from: string, to: string) => { const c = conn(); c.call(`ALTER SCHEMA ${ident(from)} RENAME TO ${ident(to)}`, [], true); c.activeSchema = '' }
export function openPg(schema: string): Database.Database {
  const d = new PgDatabase(schema); d.createSchema(); return d as unknown as Database.Database
}

/** Production workspace database. */
export const mainDb: Database.Database = isPg ? openPg(config.pgSchema) : openDatabase(dirs.db)

/**
 * The isolated demo workspace uses its own database (a separate SQLite file, or a separate PostgreSQL schema). Every request that belongs
 * to a demo session runs inside `runInDb(demoDb, …)`, so all queries (and per-database caches) transparently target the demo data and can never touch production data.
 */
const als = new AsyncLocalStorage<Database.Database>()
export const currentDb = (): Database.Database => als.getStore() ?? mainDb
export const runInDb = <T>(d: Database.Database, fn: () => T): T => als.run(d, fn)
export const inDemo = () => { const s = als.getStore(); return !!s && s !== mainDb }
export const enterDb = (d: Database.Database | undefined, done: () => void) => (d ? als.run(d, done) : done())

export const db: Database.Database = new Proxy({} as Database.Database, {
  get(_t, prop) { const d = currentDb() as any; const v = d[prop]; return typeof v === 'function' ? v.bind(d) : v },
})

export type Row = Record<string, any>
export const q = {
  all: <T = Row>(sql: string, ...p: any[]): T[] => currentDb().prepare(sql).all(...p) as T[],
  get: <T = Row>(sql: string, ...p: any[]): T | undefined => currentDb().prepare(sql).get(...p) as T | undefined,
  run: (sql: string, ...p: any[]) => currentDb().prepare(sql).run(...p),
  val: <T = any>(sql: string, ...p: any[]): T | undefined => {
    const r = currentDb().prepare(sql).pluck().get(...p)
    return r as T | undefined
  },
  /** INSERT … returning the new row id (works on both SQLite ≥ 3.35 and PostgreSQL). */
  insert: (sql: string, ...p: any[]): number => Number(currentDb().prepare(sql + ' RETURNING id').pluck().get(...p)),
}
export const tx = <T>(fn: () => T): T => { const d = currentDb(); return d.inTransaction ? fn() : d.transaction(fn)() }
export const qi = (name: string) => '"' + name.replace(/"/g, '""') + '"'

/** Columns of a table as {name, type} with SQLite-style type names (INTEGER / REAL / TEXT) on both databases. */
export function columnsOf(table: string): { name: string; type: string }[] {
  if (!isPg) return q.all<{ name: string; type: string }>(`PRAGMA table_info(${qi(table)})`)
  return q.all<{ name: string; type: string }>(`SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position`, table)
    .map(c => ({ name: c.name, type: /bigint|integer|smallint/i.test(c.type) ? 'INTEGER' : /double|real|numeric/i.test(c.type) ? 'REAL' : 'TEXT' }))
}
export const tableExists = (table: string): boolean => (isPg
  ? !!q.val(`SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?`, table)
  : !!q.val(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`, table))
void config
