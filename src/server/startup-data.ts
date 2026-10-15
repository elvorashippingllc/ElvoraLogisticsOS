import fs from 'node:fs'
import path from 'node:path'
import { config, dirs } from './config'
import { isPg, PgDatabase, q } from './db'
import { SYSTEM_CTX } from './engine'
import { nowIso } from './util'
import { businessDataSummary, clearStarterDeclined, loadElvoraStarterData, resetBusinessData, starterDeclined, starterLoaded } from './domain/business-data'

/** Fictional demo databases left from an earlier start are deleted when the demo workspace is switched off. */
function removeDisabledDemo() {
  if (config.demo.enabled) return
  try {
    if (isPg) { for (const s of [`${config.pgSchema}_demo`, `${config.pgSchema}_demo_next`]) new PgDatabase(s).dropSchema() }
    else if (fs.existsSync(dirs.demo)) for (const f of fs.readdirSync(dirs.demo)) if (/^(demo|template)\.db(\.next)?(-wal|-shm)?$/.test(f)) fs.rmSync(path.join(dirs.demo, f), { force: true })
  } catch (e) { console.error('Could not remove the old demo workspace:', e) }
}

/**
 * Start-up data tasks for the production workspace:
 *  1. RESET_BUSINESS_DATA_ON_START=<token> clears all business data once per token, after taking a backup.
 *  2. An empty production database receives the Elvora starter data (STARTER_DATA=false switches this off).
 */
export async function runStartupDataTasks() {
  removeDisabledDemo()
  const key = `reset:${config.resetToken}`
  if (config.resetToken && !q.val(`SELECT 1 FROM settings WHERE key = ?`, key)) {
    const r = await resetBusinessData({ user: null, system: true })
    q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, key, nowIso())
    // a start-up reset is a deliberate fresh start: the starter data may be loaded again afterwards (set STARTER_DATA=false to keep it empty)
    clearStarterDeclined()
    console.log(`Business data cleared (${r.total} rows). Backup: ${r.backup}`)
  }
  if (config.starterData && !starterLoaded() && !starterDeclined() && businessDataSummary().total === 0) {
    const r = loadElvoraStarterData(SYSTEM_CTX)
    if (r.loaded) console.log(`Elvora starter data loaded (${r.invoices?.length} invoices, ${r.jobs?.length} jobs).`)
  }
}
