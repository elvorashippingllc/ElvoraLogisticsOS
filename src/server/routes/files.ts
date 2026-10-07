import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { q } from '../db'
import { dirs, config } from '../config'
import { ENTITIES } from '../../shared/entities'
import { assertCan, getDef, getRecord, insertRow, labelsFor, can } from '../engine'
import { bad, forbidden, notFound, nowIso, todayStr } from '../util'
import { audit } from '../engine'
import { idOf } from './helpers'
import { openStored, persistUpload } from '../integrations/storage'

const BLOCKED = new Set(['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'js', 'mjs', 'vbs', 'sh', 'ps1', 'jar', 'dll', 'html', 'htm', 'svg', 'php', 'apk', 'app', 'iso', 'lnk'])
const INLINE: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain; charset=utf-8' }

export default async function (app: FastifyInstance) {
  app.post('/api/files', async (req) => {
    if (!req.isMultipart()) throw bad('Expected a multipart upload')
    const out: any[] = []
    const fields: Record<string, string> = {}
    const saved: { name: string; stored: string; size: number; mime: string }[] = []
    const dayDir = path.join(dirs.uploads, todayStr().slice(0, 7))
    fs.mkdirSync(dayDir, { recursive: true })
    for await (const part of req.parts()) {
      if (part.type === 'field') { fields[part.fieldname] = String(part.value); continue }
      const orig = path.basename(part.filename || 'file').replace(/[^\w.\- ()]+/g, '_').slice(0, 150)
      const ext = path.extname(orig).slice(1).toLowerCase()
      if (BLOCKED.has(ext)) { part.file.resume(); throw bad(`Files of type .${ext} are not allowed`) }
      const stored = path.join(todayStr().slice(0, 7), crypto.randomBytes(16).toString('hex') + (ext ? '.' + ext : ''))
      const full = path.join(dirs.uploads, stored)
      await pipeline(part.file, fs.createWriteStream(full))
      if ((part.file as any).truncated) { fs.unlinkSync(full); throw bad(`File exceeds the ${config.maxUploadMb} MB limit`) }
      const size = fs.statSync(full).size
      saved.push({ name: orig, stored: await persistUpload(stored, part.mimetype), size, mime: part.mimetype })
    }
    if (!saved.length) throw bad('No file received')
    const entity = fields.link_entity, linkId = Number(fields.link_id)
    let label: string | null = null
    if (entity) {
      const def = getDef(entity)
      assertCan(req.ctx, def.module, 'edit')
      const r = getRecord(def, idOf(linkId), req.ctx, { children: false })
      label = r._title
    } else assertCan(req.ctx, 'documents', 'create')
    for (const f of saved) {
      const prev = q.get(`SELECT MAX(doc_version) v FROM attachments WHERE file_name = ? AND link_entity IS ? AND link_id IS ? AND deleted_at IS NULL`, f.name, entity ?? null, entity ? linkId : null)
      const id = insertRow(getDef('attachments'), { file_name: f.name, stored_name: f.stored, size: f.size, mime: f.mime, category: fields.category || 'General', link_entity: entity ?? null, link_id: entity ? linkId : null, link_label: label, expiry_date: fields.expiry_date || null, note: fields.note || null, doc_version: (prev?.v ?? 0) + 1 }, req.ctx)
      audit(req.ctx, getDef('attachments'), id, 'upload', { file: [null, f.name] }, f.name)
      if (entity) audit(req.ctx, getDef(entity), linkId, 'attachment', { file: [null, f.name] }, label ?? '')
      out.push({ id, file_name: f.name, size: f.size })
    }
    return out
  })

  app.get('/api/files/:id/download', async (req, reply) => {
    const id = idOf((req.params as any).id)
    const f = q.get(`SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL`, id)
    if (!f) throw notFound('File not found')
    if (f.link_entity && ENTITIES[f.link_entity]) getRecord(getDef(f.link_entity), f.link_id, req.ctx, { children: false })
    else assertCan(req.ctx, 'documents', 'view')
    const stream = await openStored(f.stored_name)
    if (!stream) throw notFound('The stored file is missing')
    const ext = path.extname(f.file_name).slice(1).toLowerCase()
    const inline = INLINE[ext] && (req.query as any).inline !== '0'
    reply.header('content-type', INLINE[ext] ?? 'application/octet-stream').header('x-content-type-options', 'nosniff').header('content-security-policy', "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'")
    reply.header('content-disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.file_name)}`)
    return reply.send(stream)
  })

  app.delete('/api/files/:id', async (req) => {
    const id = idOf((req.params as any).id)
    const f = q.get(`SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL`, id)
    if (!f) throw notFound('File not found')
    if (f.link_entity && ENTITIES[f.link_entity]) assertCan(req.ctx, ENTITIES[f.link_entity].module, 'edit'); else assertCan(req.ctx, 'documents', 'delete')
    q.run(`UPDATE attachments SET deleted_at = ? WHERE id = ?`, nowIso(), id)
    audit(req.ctx, getDef('attachments'), id, 'delete', { file: [f.file_name, null] }, f.file_name)
    if (f.link_entity) audit(req.ctx, getDef(f.link_entity), f.link_id, 'attachment-removed', { file: [f.file_name, null] }, f.link_label ?? '')
    return { ok: true }
  })
  void forbidden; void labelsFor; void can;
}
