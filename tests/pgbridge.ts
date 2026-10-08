import assert from 'node:assert/strict'
import { Worker, MessageChannel } from 'node:worker_threads'
import { PgConn, waitForPgReply } from '../src/server/pgbridge.js'

const sab = new SharedArrayBuffer(4)
const sig = new Int32Array(sab)
const { port1, port2 } = new MessageChannel()
const worker = new Worker(`
  const { workerData } = require('node:worker_threads')
  const { port, sab } = workerData
  const sig = new Int32Array(sab)
  port.on('message', m => {
    // Deliberately wake the caller before the response reaches its port.
    Atomics.store(sig, 0, 1)
    Atomics.notify(sig, 0)
    if (!m.silent) setTimeout(() => port.postMessage({ requestId: m.replyId ?? m.requestId, ok: true, rows: [{ value: m.requestId }] }), m.delay)
  })
`, { eval: true, workerData: { port: port2, sab }, transferList: [port2] })
try {
  for (let id = 1; id <= 200; id++) {
    Atomics.store(sig, 0, 0)
    port1.postMessage({ requestId: id, delay: id === 1 ? 25 : 0 })
    assert.equal(waitForPgReply(port1, sig, id, 5000).rows[0].value, id)
  }
  Atomics.store(sig, 0, 0)
  port1.postMessage({ requestId: 201, replyId: 200, delay: 0 })
  assert.throws(() => waitForPgReply(port1, sig, 201, 5000), /does not match/)
  Atomics.store(sig, 0, 0)
  port1.postMessage({ requestId: 202, silent: true })
  assert.throws(() => waitForPgReply(port1, sig, 202, 30), /did not answer/)

  // An uncertain query must close its connection rather than accept a late result.
  const conn = new PgConn('postgresql://postgres@127.0.0.1:1/postgres', 1)
  assert.throws(() => conn.call('SELECT 1'), /did not answer/)
  assert.throws(() => conn.call('SELECT 2'), /connection is closed/)
  conn.close()
  console.log('PostgreSQL bridge: 200 delayed replies, stale reply, timeout and closed-connection checks passed')
} finally {
  port1.close()
  await worker.terminate()
}
