import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { dirs, config } from '../config'
import { openDatabase, runInDb, isPg, PgDatabase, renameSchema } from '../db'

let demoDb: Database.Database | null = null
export const getDemoDb = () => demoDb
const tpl = () => path.join(dirs.demo, 'template.db'), live = () => path.join(dirs.demo, 'demo.db')
const rmDb = (f: string) => { for (const x of [f, f + '-wal', f + '-shm']) fs.rmSync(x, { force: true }) }

async function populate(t: Database.Database) {
  await runInDb(t, async () => {
    const { syncSchema } = await import('../schema')
    const { seedReference } = await import('../seed')
    const { ensureAgents } = await import('../ai/agents')
    const { seedDemoScenarios } = await import('../seed/demo')
    syncSchema(); seedReference({ users: false, demo: true }); ensureAgents(); await seedDemoScenarios()
  })
}

/** Build a fresh, fully populated demo workspace (dates are relative to today) and install it as the live demo. */
export async function rebuildDemoWorkspace(): Promise<void> {
  if (!config.demo.enabled) return
  if (isPg) return rebuildDemoPg()
  fs.mkdirSync(dirs.demo, { recursive: true })
  const nextTpl = tpl() + '.next'; rmDb(nextTpl)
  const t = openDatabase(nextTpl)
  try {
    await populate(t)
    t.pragma('wal_checkpoint(TRUNCATE)')
  } finally { t.close() }
  rmDb(tpl()); fs.renameSync(nextTpl, tpl()); rmDb(nextTpl)
  installTemplate()
}

/** PostgreSQL: the demo is a separate schema. It is built next to the live one and swapped in, so the old demo keeps serving meanwhile. */
async function rebuildDemoPg() {
  const liveName = `${config.pgSchema}_demo`
  const next = new PgDatabase(`${liveName}_next`)
  next.dropSchema(); next.createSchema()
  await populate(next as unknown as Database.Database)
  const cur = new PgDatabase(liveName)
  cur.dropSchema()
  renameSchema(next.schema, liveName)
  demoDb = cur as unknown as Database.Database
}

function installTemplate() {
  if (demoDb) { try { demoDb.close() } catch { /* ignore */ } demoDb = null }
  rmDb(live()); fs.copyFileSync(tpl(), live())
  demoDb = openDatabase(live())
}
/** Discard everything the presenter changed and start again from the pristine template (PostgreSQL: rebuild). */
export function resetDemoWorkspace(): void | Promise<void> {
  if (isPg) return rebuildDemoPg()
  if (!fs.existsSync(tpl())) throw new Error('Demo template is not ready')
  installTemplate()
}
