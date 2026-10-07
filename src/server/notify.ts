import { q } from './db'
import { nowIso } from './util'

export function notify(userId: number | null | undefined, title: string, body = '', link = '', kind = 'info', dedupe?: string) {
  if (!userId) return
  try {
    q.run(`INSERT INTO notifications(user_id, kind, title, body, link, created_at, dedupe_key) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`, userId, kind, title, body, link, nowIso(), dedupe ?? null)
  } catch { /* never fail business logic for a notification */ }
}
export function notifyRole(permModule: string, title: string, body = '', link = '', kind = 'approval', dedupe?: string) {
  const users = q.all<{ id: number; permissions: string | null }>(`SELECT u.id, r.permissions FROM users u JOIN roles r ON r.id = u.role_id WHERE u.deleted_at IS NULL AND u.active = 1`)
  for (const u of users) {
    let ok = false
    try { const p = JSON.parse(u.permissions ?? '{}'); ok = p === '*' || (p[permModule] ?? []).some((a: string) => a === 'approve' || a === '*') } catch { /* ignore */ }
    if (ok) notify(u.id, title, body, link, kind, dedupe ? `${dedupe}:${u.id}` : undefined)
  }
}
