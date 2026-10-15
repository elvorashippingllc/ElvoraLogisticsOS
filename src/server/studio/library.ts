import crypto from 'node:crypto'
import { q, tx } from '../db'
import { createRecord, getDef, patchRecord, SYSTEM_CTX } from '../engine'
import { markPlaceholders } from '../../shared/studio-html'
import { nowIso } from '../util'
import library from './library.json'

interface LibraryTemplate { code: string; title: string; category: string; kind: string; orientation: string; letterhead: boolean; description?: string; tags?: string; html: string }
const TEMPLATES = library as LibraryTemplate[]
const KEY = 'seed:studio-library'
export const STUDIO_LIBRARY_VERSION = crypto.createHash('sha256').update(JSON.stringify(TEMPLATES)).digest('hex').slice(0, 16)

/** Installs the built-in templates, and refreshes them when the shipped library changes. Templates the company created itself are never touched. */
export function syncStudioLibrary() {
  if (JSON.parse(q.val<string>(`SELECT value FROM settings WHERE key = ?`, KEY) ?? 'null') === STUDIO_LIBRARY_VERSION) return
  tx(() => {
    const def = getDef('doc_templates')
    const codes = new Set<string>()
    for (const t of TEMPLATES) {
      codes.add(t.code)
      const payload = { code: t.code, title: t.title, category: t.category, kind: t.kind, orientation: t.orientation, letterhead: t.letterhead, description: t.description ?? null, tags: t.tags ?? null, content: markPlaceholders(t.html) }
      const existing = q.get<{ id: number; is_system: number }>(`SELECT id, is_system FROM doc_templates WHERE code = ? AND deleted_at IS NULL`, t.code)
      if (!existing) createRecord(def, { ...payload, is_system: true, active: true }, SYSTEM_CTX)
      else if (existing.is_system) patchRecord(def, existing.id, payload, SYSTEM_CTX)
    }
    // built-in templates removed from the library are switched off, not deleted, so saved documents keep their link
    for (const r of q.all<{ id: number; code: string }>(`SELECT id, code FROM doc_templates WHERE is_system = 1 AND deleted_at IS NULL`)) if (!codes.has(r.code)) q.run(`UPDATE doc_templates SET active = 0 WHERE id = ?`, r.id)
    q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, KEY, JSON.stringify(STUDIO_LIBRARY_VERSION), nowIso())
  })
}
