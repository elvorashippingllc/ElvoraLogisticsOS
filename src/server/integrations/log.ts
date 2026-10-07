import { getDef, insertRow, SYSTEM_CTX } from '../engine'
import { nowLocal } from '../util'
import { inDemo } from '../db'

export function logIntegration(provider: string, action: string, ok: boolean, summary: string, detail?: unknown, link?: { entity: string; id: number }) {
  try {
    insertRow(getDef('integration_logs'), {
      at: nowLocal(), provider, action, ok, summary: summary.slice(0, 300), detail: detail === undefined ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)).slice(0, 8000),
      link_entity: link?.entity ?? null, link_id: link?.id ?? null,
    }, SYSTEM_CTX)
  } catch { /* logging must never break the caller */ }
}

/** fetch with a timeout and JSON/text handling. */
export async function http(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  if (inDemo()) throw new Error('External connections are disabled in the demo workspace')
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), init.timeoutMs ?? 20000)
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal })
    const text = await r.text()
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    return { ok: r.ok, status: r.status, data, text }
  } finally { clearTimeout(t) }
}
