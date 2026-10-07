import Database from 'better-sqlite3'
import { config, dirs, ensureDirs } from './config'

ensureDirs()
export const db = new Database(dirs.db)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

export type Row = Record<string, any>
export const q = {
  all: <T = Row>(sql: string, ...p: any[]): T[] => db.prepare(sql).all(...p) as T[],
  get: <T = Row>(sql: string, ...p: any[]): T | undefined => db.prepare(sql).get(...p) as T | undefined,
  run: (sql: string, ...p: any[]) => db.prepare(sql).run(...p),
  val: <T = any>(sql: string, ...p: any[]): T | undefined => {
    const r = db.prepare(sql).pluck().get(...p)
    return r as T | undefined
  },
}
export const tx = <T>(fn: () => T): T => (db.inTransaction ? fn() : db.transaction(fn)())
export const qi = (name: string) => '"' + name.replace(/"/g, '""') + '"'
void config
