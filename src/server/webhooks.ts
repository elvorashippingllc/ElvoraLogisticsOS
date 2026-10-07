import crypto from 'node:crypto'
import { q } from './db'
import { nowIso } from './util'

function matches(spec: string, event: string): boolean {
  return spec.split(',').map(s => s.trim()).filter(Boolean).some(s => s === '*' || s === event || (s.endsWith('.*') && event.startsWith(s.slice(0, -1))) || (s.endsWith('*') && event.startsWith(s.slice(0, -1))))
}

export function emitWebhooks(event: string, payload: any) {
  let hooks: any[] = []
  try { hooks = q.all(`SELECT * FROM webhooks WHERE active = 1 AND deleted_at IS NULL`) } catch { return }
  for (const h of hooks) {
    if (!matches(h.events ?? '*', event)) continue
    setImmediate(() => { void deliver(h, event, payload) })
  }
}

async function deliver(h: any, event: string, payload: any) {
  const body = JSON.stringify({ event, at: nowIso(), data: payload })
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-elvora-event': event }
  if (h.secret) headers['x-elvora-signature'] = 'sha256=' + crypto.createHmac('sha256', h.secret).update(body).digest('hex')
  let status = 0, ok = 0, response = ''
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000)
    const res = await fetch(h.url, { method: 'POST', headers, body, signal: ctl.signal })
    clearTimeout(t)
    status = res.status; ok = res.ok ? 1 : 0; response = (await res.text()).slice(0, 300)
  } catch (e: any) { response = String(e?.message ?? e).slice(0, 300) }
  try {
    q.run(`INSERT INTO webhook_deliveries(webhook_id, event, status, ok, response, at) VALUES (?,?,?,?,?,?)`, h.id, event, status, ok, response, nowIso())
    q.run(`UPDATE webhooks SET last_delivery_at = ?, last_status = ? WHERE id = ?`, nowIso().slice(0, 16), ok ? `OK ${status}` : `Failed ${status || response.slice(0, 40)}`, h.id)
  } catch { /* ignore */ }
}
