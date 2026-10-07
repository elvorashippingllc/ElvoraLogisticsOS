import Database from 'better-sqlite3'
import { AsyncLocalStorage } from 'node:async_hooks'
import { config, dirs, ensureDirs } from './config'

ensureDirs()
export function openDatabase(file: string): Database.Database {
  const d = new Database(file)
  d.pragma('journal_mode = WAL')
  d.pragma('synchronous = NORMAL')
  d.pragma('foreign_keys = ON')
  d.pragma('busy_timeout = 5000')
  return d
}
/** Production workspace database. */
export const mainDb = openDatabase(dirs.db)

/**
 * The isolated demo workspace uses its own database file. Every request that belongs to a demo session runs inside
 * `runInDb(demoDb, …)`, so all queries (and per-database caches) transparently target the demo data and can never touch production data.
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
}
export const tx = <T>(fn: () => T): T => { const d = currentDb(); return d.inTransaction ? fn() : d.transaction(fn)() }
export const qi = (name: string) => '"' + name.replace(/"/g, '""') + '"'
void config
