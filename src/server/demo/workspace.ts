import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { dirs, config } from '../config'
import { openDatabase, runInDb } from '../db'

let demoDb: Database.Database | null = null
export const getDemoDb = () => demoDb
const tpl = () => path.join(dirs.demo, 'template.db'), live = () => path.join(dirs.demo, 'demo.db')
const rmDb = (f: string) => { for (const x of [f, f + '-wal', f + '-shm']) fs.rmSync(x, { force: true }) }

/** Build a fresh, fully populated template database (dates are relative to today) and install it as the live demo workspace. */
export async function rebuildDemoWorkspace(): Promise<void> {
  if (!config.demo.enabled) return
  fs.mkdirSync(dirs.demo, { recursive: true })
  const nextTpl = tpl() + '.next'; rmDb(nextTpl)
  const t = openDatabase(nextTpl)
  try {
    await runInDb(t, async () => {
      const { syncSchema } = await import('../schema')
      const { seedReference } = await import('../seed')
      const { ensureAgents } = await import('../ai/agents')
      const { seedDemoScenarios } = await import('../seed/demo')
      syncSchema(); seedReference({ users: false, demo: true }); ensureAgents(); await seedDemoScenarios()
    })
    t.pragma('wal_checkpoint(TRUNCATE)')
  } finally { t.close() }
  rmDb(tpl()); fs.renameSync(nextTpl, tpl()); rmDb(nextTpl)
  installTemplate()
}

function installTemplate() {
  if (demoDb) { try { demoDb.close() } catch { /* ignore */ } demoDb = null }
  rmDb(live()); fs.copyFileSync(tpl(), live())
  demoDb = openDatabase(live())
}
/** Discard everything the presenter changed and start again from the pristine template. */
export function resetDemoWorkspace() { if (!fs.existsSync(tpl())) throw new Error('Demo template is not ready'); installTemplate() }
