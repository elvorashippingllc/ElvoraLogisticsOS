import { Worker, MessageChannel, receiveMessageOnPort, type MessagePort } from 'node:worker_threads'
import { createRequire } from 'node:module'

/**
 * Synchronous PostgreSQL access for the synchronous data layer.
 *
 * The whole application (engine, hooks, domain logic, reports) is written against a synchronous query API. Instead of
 * rewriting ~430 call sites as async, a single `pg` client lives in a worker thread and the calling thread blocks on
 * Atomics.wait until the worker has answered. Semantics are identical to the previous single-connection SQLite setup:
 * one connection, one statement at a time, transactions can never interleave. Host the app in the same region as the
 * database – every query is one network round trip during which the process is busy.
 */
const WORKER_SOURCE = `
const { workerData } = require('node:worker_threads')
const { Client, types } = require(workerData.pgPath)
types.setTypeParser(20, v => parseInt(v, 10))   // bigint
types.setTypeParser(1700, v => parseFloat(v))   // numeric
const { port, options } = workerData
const sig = new Int32Array(workerData.sig)
let client = null
async function ensure() {
  if (client) return client
  const c = new Client({ ...options, application_name: 'elvora-os', connectionTimeoutMillis: 15000 })
  c.on('error', () => { client = null })
  await c.connect()
  client = c
  return c
}
port.on('message', async (m) => {
  let out
  try {
    const c = await ensure()
    let r = await c.query(m.simple ? m.sql : { text: m.sql, values: m.params || [] })
    if (Array.isArray(r)) r = r[r.length - 1]
    out = { ok: true, rows: r.rows || [], rowCount: r.rowCount ?? 0 }
  } catch (e) {
    if (e && (e.code === 'ECONNRESET' || e.code === 'EPIPE' || /terminat|closed|timeout/i.test(String(e.message)))) client = null
    out = { ok: false, message: String(e && e.message || e), code: e && e.code, detail: e && e.detail, constraint: e && e.constraint, table: e && e.table }
  }
  port.postMessage(out)
  Atomics.store(sig, 0, 1)
  Atomics.notify(sig, 0)
})
`

export interface PgResult { rows: any[]; rowCount: number }

export function pgConnectionOptions(url: string, ca = process.env.PG_CA_CERT) {
  const parsed = new URL(url)
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname)
  const tls = !local || (parsed.searchParams.has('sslmode') && parsed.searchParams.get('sslmode') !== 'disable')
  // pg's URL SSL parameters can replace the explicit SSL options. Keep a single
  // verified policy; private provider CAs can be supplied as PEM via PG_CA_CERT.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key)
  return { connectionString: parsed.toString(), ssl: tls ? { rejectUnauthorized: true, ...(ca ? { ca: ca.replace(/\\n/g, '\n') } : {}) } : false as const }
}

export class PgConn {
  private worker: Worker
  private port: MessagePort
  private sig: Int32Array
  activeSchema = ''
  depth = 0
  txSchema = ''
  constructor(url: string, private timeoutMs = 120_000) {
    const sab = new SharedArrayBuffer(4)
    this.sig = new Int32Array(sab)
    const { port1, port2 } = new MessageChannel()
    this.port = port1
    const options = pgConnectionOptions(url)
    const pgPath = createRequire(import.meta.url).resolve('pg')
    this.worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { port: port2, sig: sab, options, pgPath }, transferList: [port2] })
    this.worker.unref()
    this.worker.on('error', e => console.error('[pg worker]', e))
  }
  /** Run one statement and wait for the answer. Throws an Error carrying the Postgres error code. */
  call(sql: string, params: any[] = [], simple = false): PgResult {
    Atomics.store(this.sig, 0, 0)
    this.port.postMessage({ sql, params, simple })
    const w = Atomics.wait(this.sig, 0, 0, this.timeoutMs)
    if (w === 'timed-out') throw new Error(`Database did not answer within ${this.timeoutMs / 1000}s`)
    const got = receiveMessageOnPort(this.port)
    if (!got) throw new Error('Database bridge returned no result')
    const r = got.message
    if (!r.ok) { const e: any = new Error(r.message); e.code = r.code; e.detail = r.detail; e.constraint = r.constraint; throw e }
    return r
  }
  close() { void this.worker.terminate() }
}
