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
  ;(await import('./ai/agents')).ensureAgents()
  await (await import('./startup-data')).runStartupDataTasks()
  if (cfg.demo.enabled) { try { const t0 = Date.now(); await (await import('./demo/workspace')).rebuildDemoWorkspace(); console.log(`Demo workspace ready (${Date.now() - t0} ms)`) } catch (e) { console.error('Demo workspace could not be built – continuing without it', e) } }
  const app = await buildApp()
  await app.listen({ port: config.port, host: config.host })
  startScheduler()
  const shutdown = async (sig: string) => { app.log.info(`${sig} received, shutting down`); await app.close(); db.close(); process.exit(0) }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  console.log(`Elvora Logistics OS listening on http://${config.host}:${config.port} (${config.env})`)
}
main().catch(e => { console.error(e); process.exit(1) })
