import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { q } from '../db'
import { ENTITIES } from '../../shared/entities'
import { getDef, getRecord, labelsFor, assertCan, can } from '../engine'
import { bad, forbidden, nowIso, safeJson } from '../util'
import { body, idOf } from './helpers'
import { notify } from '../notify'
import { z } from 'zod'

export default async function (app: FastifyInstance) {
  const rec = (req: any) => {
    const p = req.params as any
    const def = getDef(p.entity)
    if (!def.panel) throw bad('This record type has no collaboration panel')
    const id = idOf(p.id)
    const r = getRecord(def, id, req.ctx, { children: false })
    return { def, id, r }
  }

  app.get('/api/panel/:entity/:id', async (req) => {
    const { def, id, r } = rec(req)
    const e = def.key
    const n = (sql: string, ...a: any[]) => q.val<number>(sql, ...a) ?? 0
    return {
      title: r._title,
      comments: n(`SELECT COUNT(*) FROM comments WHERE entity = ? AND record_id = ? AND deleted_at IS NULL`, e, id),
      followups: n(`SELECT COUNT(*) FROM tasks WHERE link_entity = ? AND link_id = ? AND status <> 'Done' AND deleted_at IS NULL`, e, id),
      attachments: n(`SELECT COUNT(*) FROM attachments WHERE link_entity = ? AND link_id = ? AND deleted_at IS NULL`, e, id),
      references: n(`SELECT COUNT(*) FROM record_refs WHERE entity = ? AND record_id = ?`, e, id),
      tags: n(`SELECT COUNT(*) FROM record_tags WHERE entity = ? AND record_id = ?`, e, id),
      links: n(`SELECT COUNT(*) FROM record_links WHERE entity = ? AND record_id = ?`, e, id),
      likes: n(`SELECT COUNT(*) FROM record_likes WHERE entity = ? AND record_id = ?`, e, id),
      liked: n(`SELECT COUNT(*) FROM record_likes WHERE entity = ? AND record_id = ? AND user_id = ?`, e, id, req.user!.id) > 0,
      complaints: n(`SELECT COUNT(*) FROM tickets WHERE link_entity = ? AND link_id = ? AND deleted_at IS NULL`, e, id),
      videocalls: n(`SELECT COUNT(*) FROM video_calls WHERE entity = ? AND record_id = ?`, e, id),
      history: n(`SELECT COUNT(*) FROM audit_log WHERE entity = ? AND record_id = ?`, e, id),
    }
  })

  // comments
  app.get('/api/panel/:entity/:id/comments', async (req) => {
    const { def, id } = rec(req)
    return q.all(`SELECT c.id, c.body, c.created_at, c.user_id, u.name AS user_name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.entity = ? AND c.record_id = ? AND c.deleted_at IS NULL ORDER BY c.id DESC`, def.key, id)
  })
  app.post('/api/panel/:entity/:id/comments', async (req) => {
    const { def, id, r } = rec(req)
    const b = z.object({ body: z.string().min(1).max(4000) }).parse(req.body)
    assertCan(req.ctx, def.module, 'view')
    q.run(`INSERT INTO comments(entity, record_id, user_id, body, created_at) VALUES (?,?,?,?,?)`, def.key, id, req.user!.id, b.body.trim(), nowIso())
    // @mentions: "@Full Name" notifies that user
    for (const u of q.all(`SELECT id, name FROM users WHERE deleted_at IS NULL AND active = 1`)) if (u.id !== req.user!.id && b.body.toLowerCase().includes('@' + u.name.toLowerCase())) notify(u.id, `${req.user!.name} mentioned you on ${r._title}`, b.body.slice(0, 140), `/e/${def.key}/${id}`, 'mention')
    if (r.created_by && r.created_by !== req.user!.id) notify(r.created_by, `New comment on ${r._title}`, b.body.slice(0, 140), `/e/${def.key}/${id}`, 'comment')
    return { ok: true }
  })
  app.delete('/api/panel/:entity/:id/comments/:cid', async (req) => {
    const { def, id } = rec(req)
    const cid = idOf((req.params as any).cid)
    const c = q.get(`SELECT user_id FROM comments WHERE id = ? AND entity = ? AND record_id = ?`, cid, def.key, id)
    if (!c) throw bad('Comment not found')
    if (c.user_id !== req.user!.id && !can(req.user, 'admin', 'delete')) throw forbidden('You can only delete your own comments')
    q.run(`UPDATE comments SET deleted_at = ? WHERE id = ?`, nowIso(), cid)
    return { ok: true }
  })

  // references
  app.get('/api/panel/:entity/:id/refs', async (req) => { const { def, id } = rec(req); return q.all(`SELECT id, ref_type, ref_value, note, created_at FROM record_refs WHERE entity = ? AND record_id = ? ORDER BY id DESC`, def.key, id) })
  app.post('/api/panel/:entity/:id/refs', async (req) => {
    const { def, id } = rec(req); assertCan(req.ctx, def.module, 'edit')
    const b = z.object({ ref_type: z.string().min(1).max(60), ref_value: z.string().min(1).max(120), note: z.string().max(300).optional() }).parse(req.body)
    q.run(`INSERT INTO record_refs(entity, record_id, ref_type, ref_value, note, created_by, created_at) VALUES (?,?,?,?,?,?,?)`, def.key, id, b.ref_type, b.ref_value.trim(), b.note ?? null, req.user!.id, nowIso())
    return { ok: true }
  })
  app.delete('/api/panel/:entity/:id/refs/:rid', async (req) => { const { def, id } = rec(req); assertCan(req.ctx, def.module, 'edit'); q.run(`DELETE FROM record_refs WHERE id = ? AND entity = ? AND record_id = ?`, idOf((req.params as any).rid), def.key, id); return { ok: true } })

  // tags
  app.get('/api/panel/:entity/:id/tags', async (req) => { const { def, id } = rec(req); return q.all(`SELECT tag FROM record_tags WHERE entity = ? AND record_id = ? ORDER BY tag`, def.key, id).map(r => r.tag) })
  app.post('/api/panel/:entity/:id/tags', async (req) => {
    const { def, id } = rec(req); assertCan(req.ctx, def.module, 'edit')
    const { tag } = z.object({ tag: z.string().min(1).max(40) }).parse(req.body)
    q.run(`INSERT INTO record_tags(entity, record_id, tag, created_by, created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING`, def.key, id, tag.trim().toLowerCase(), req.user!.id, nowIso())
    return { ok: true }
  })
  app.delete('/api/panel/:entity/:id/tags/:tag', async (req) => { const { def, id } = rec(req); assertCan(req.ctx, def.module, 'edit'); q.run(`DELETE FROM record_tags WHERE entity = ? AND record_id = ? AND tag = ?`, def.key, id, String((req.params as any).tag)); return { ok: true } })
  app.get('/api/tags', async () => q.all(`SELECT tag, COUNT(*) n FROM record_tags GROUP BY tag ORDER BY n DESC LIMIT 100`))

  // links to other records
  app.get('/api/panel/:entity/:id/links', async (req) => {
    const { def, id } = rec(req)
    const rows = q.all(`SELECT id, to_entity, to_id, note, created_at FROM record_links WHERE entity = ? AND record_id = ? ORDER BY id DESC`, def.key, id)
    return rows.map(r => ({ ...r, label: ENTITIES[r.to_entity] ? (labelsFor(r.to_entity, [r.to_id]).get(r.to_id) ?? `#${r.to_id}`) : `#${r.to_id}`, type_label: ENTITIES[r.to_entity]?.label ?? r.to_entity }))
  })
  app.post('/api/panel/:entity/:id/links', async (req) => {
    const { def, id } = rec(req); assertCan(req.ctx, def.module, 'edit')
    const b = z.object({ to_entity: z.string(), to_id: z.number().int().positive(), note: z.string().max(300).optional() }).parse(req.body)
    const tdef = getDef(b.to_entity)
    getRecord(tdef, b.to_id, req.ctx, { children: false })
    if (tdef.key === def.key && b.to_id === id) throw bad('Cannot link a record to itself')
    q.run(`INSERT INTO record_links(entity, record_id, to_entity, to_id, note, created_by, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`, def.key, id, b.to_entity, b.to_id, b.note ?? null, req.user!.id, nowIso())
    return { ok: true }
  })
  app.delete('/api/panel/:entity/:id/links/:lid', async (req) => { const { def, id } = rec(req); assertCan(req.ctx, def.module, 'edit'); q.run(`DELETE FROM record_links WHERE id = ? AND entity = ? AND record_id = ?`, idOf((req.params as any).lid), def.key, id); return { ok: true } })

  // likes
  app.post('/api/panel/:entity/:id/like', async (req) => {
    const { def, id } = rec(req)
    const has = q.val(`SELECT 1 FROM record_likes WHERE entity = ? AND record_id = ? AND user_id = ?`, def.key, id, req.user!.id)
    if (has) q.run(`DELETE FROM record_likes WHERE entity = ? AND record_id = ? AND user_id = ?`, def.key, id, req.user!.id)
    else q.run(`INSERT INTO record_likes(entity, record_id, user_id, created_at) VALUES (?,?,?,?)`, def.key, id, req.user!.id, nowIso())
    return { liked: !has, count: q.val<number>(`SELECT COUNT(*) FROM record_likes WHERE entity = ? AND record_id = ?`, def.key, id) }
  })
  app.get('/api/panel/:entity/:id/likes', async (req) => { const { def, id } = rec(req); return q.all(`SELECT u.name, l.created_at FROM record_likes l JOIN users u ON u.id = l.user_id WHERE l.entity = ? AND l.record_id = ?`, def.key, id) })

  // video calls (Jitsi Meet rooms — no account or API key needed)
  app.get('/api/panel/:entity/:id/video', async (req) => { const { def, id } = rec(req); return q.all(`SELECT v.id, v.url, v.created_at, u.name AS user_name FROM video_calls v LEFT JOIN users u ON u.id = v.created_by WHERE v.entity = ? AND v.record_id = ? ORDER BY v.id DESC`, def.key, id) })
  app.post('/api/panel/:entity/:id/video', async (req) => {
    const { def, id, r } = rec(req)
    const room = `Elvora-${def.key}-${id}-${crypto.randomBytes(4).toString('hex')}`
    const url = `https://meet.jit.si/${room}`
    q.run(`INSERT INTO video_calls(entity, record_id, room, url, created_by, created_at) VALUES (?,?,?,?,?,?)`, def.key, id, room, url, req.user!.id, nowIso())
    q.run(`INSERT INTO comments(entity, record_id, user_id, body, created_at) VALUES (?,?,?,?,?)`, def.key, id, req.user!.id, `Started a video call about ${r._title}: ${url}`, nowIso())
    return { url }
  })

  // history
  app.get('/api/panel/:entity/:id/history', async (req) => {
    const { def, id } = rec(req)
    const rows = q.all(`SELECT id, at, user_name, action, changes FROM audit_log WHERE entity = ? AND record_id = ? ORDER BY id DESC LIMIT 300`, def.key, id)
    return rows.map(r => ({ ...r, changes: safeJson(r.changes, null) }))
  })
}
