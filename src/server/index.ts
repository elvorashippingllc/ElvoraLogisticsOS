import { config } from './config'
import { syncSchema } from './schema'
import { validateMeta } from '../shared/entities'
import { seedReference } from './seed'
import { buildApp } from './app'
import { startScheduler } from './scheduler'
import { db } from './db'
import { config as cfg } from './config'

async function main() {
  const errs = validateMeta()
  if (errs.length) { console.error('Entity metadata errors:\n' + errs.join('\n')); process.exit(1) }
  syncSchema()
  seedReference()
  if (cfg.seedDemo) { const { seedDemo } = await import('./seed/demo'); const n = db.prepare(`SELECT COUNT(*) c FROM parties WHERE deleted_at IS NULL`).get() as any; if (!n.c) seedDemo({ user: null, system: true }) }
  const app = await buildApp()
  await app.listen({ port: config.port, host: config.host })
  startScheduler()
  const shutdown = async (sig: string) => { app.log.info(`${sig} received, shutting down`); await app.close(); db.close(); process.exit(0) }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  console.log(`Elvora Logistics OS listening on http://${config.host}:${config.port} (${config.env})`)
}
main().catch(e => { console.error(e); process.exit(1) })
