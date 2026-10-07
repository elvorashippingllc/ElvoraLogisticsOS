import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { db, q } from '../db'
import { dirs, config } from '../config'
import { getSetting, publicSettings, setSettings } from '../settings'
import { audit, getDef, getRecord, assertCan, can } from '../engine'
import { bad, notFound, nowIso, safeJson, todayStr } from '../util'
import { idOf, need } from './helpers'
import { COOKIE } from '../app'
import { CATALOG } from '../integrations/catalog'
import { verifySmtp, mailProvider, queueEmail } from '../mailer'
import { r2Test, r2Put, r2Configured, useR2 } from '../integrations/storage'
import { schemaSql, syncToSupabase, testSupabase, resetSupabaseCursors } from '../integrations/supabase'
import { testWhatsApp, sendWhatsApp, waConfigured, verifySignature, handleWebhook, normalizePhone } from '../integrations/whatsapp'
import { testLlm, PRESETS, aiConfigured } from '../ai/llm'
import { runAgent, chatWithAgent, decideAction, ensureAgents, latestBrief } from '../ai/agents'
import { AGENT_TEMPLATES } from '../ai/templates'
import { TOOLS } from '../ai/tools'
import { ingestTrackingEvent, requestLiveTracking } from '../integrations/tracking'
import { buildEinvoiceXml, submitEinvoice } from '../integrations/einvoice'
import { transmitEdi, submitCustoms } from '../integrations/edi'
import { buildWps } from '../integrations/wps'
import { closeYear, reopenYear, yearEndPreview } from '../integrations/yearend'
import { importLines, parseStatement, autoMatch } from '../integrations/bank'
import { renderPrintPdf, pdfAvailable } from '../integrations/pdf'
import { logIntegration } from '../integrations/log'
import { ENTITIES } from '../../shared/entities'
import { createRecord } from '../engine'

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y) }
const origin = (req: any) => String(config.baseUrl || `${req.protocol}://${req.headers.host}`).replace(/\/+$/, '')

export async function backupToR2(): Promise<string> {
  const name = `elvora-${nowIso().replace(/[:.]/g, '-').slice(0, 19)}.db`
  const p = path.join(dirs.backups, name)
  await db.backup(p)
  if (r2Configured()) await r2Put(`backups/${name}`, fs.readFileSync(p), 'application/octet-stream')
  return name
}

export default async function (app: FastifyInstance) {
  // =================================================================== integrations catalogue
  app.get('/api/integrations', async (req) => {
    need(req, 'admin', 'view')
    const s = publicSettings()
    const base = origin(req)
    return {
      sections: CATALOG.map(sec => ({ ...sec, values: Object.fromEntries(sec.fields.map(f => [f.key, s[f.key] ?? (f.type === 'bool' ? false : '')])), webhooks: sec.webhooks?.map(w => ({ ...w, url: w.secret ? (getSetting(w.key) ? base + w.path + '••••••••' : null) : base + w.path })) })),
      status: { mail: mailProvider(), r2: r2Configured(), storage_in_r2: useR2(), whatsapp: waConfigured(), ai: aiConfigured(), pdf: pdfAvailable(), supabase: !!getSetting('supabase_url') && !!getSetting('supabase_service_key') },
      presets: PRESETS,
    }
  })
  app.post('/api/integrations/:key/test', async (req) => {
    need(req, 'admin', 'edit')
    const k = (req.params as any).key
    const r = k === 'mail' ? await verifySmtp() : k === 'storage' ? await r2Test() : k === 'supabase' ? await testSupabase() : k === 'whatsapp' ? await testWhatsApp() : k === 'ai' ? await testLlm() : null
    if (!r) throw bad('No test available for this integration')
    logIntegration(k, 'test', !!(r as any).ok, `Connection test: ${(r as any).ok ? 'OK' : (r as any).error}`)
    return r
  })
  app.post('/api/integrations/webhook-secret/:which', async (req) => {
    need(req, 'admin', 'edit')
    const which = (req.params as any).which
    const key = which === 'tracking' ? 'tracking_webhook_secret' : which === 'bank' ? 'bank_webhook_secret' : null
    if (!key) throw bad('Unknown webhook')
    const secret = crypto.randomBytes(20).toString('hex')
    setSettings({ [key]: secret })
    audit(req.ctx, getDef('branches'), 0, 'settings', { [key]: ['***', '***'] }, 'Webhook secret regenerated')
    return { url: `${origin(req)}/api/public/${which}/${secret}`, note: 'Copy this URL now – it is not shown again.' }
  })
  app.get('/api/integrations/supabase/schema.sql', async (req, reply) => { need(req, 'admin', 'view'); reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', 'attachment; filename="elvora-supabase-schema.sql"'); return schemaSql() })
  app.post('/api/integrations/supabase/sync', async (req) => { need(req, 'admin', 'edit'); const b = (req.body ?? {}) as any; if (b.full) resetSupabaseCursors(); return syncToSupabase() })
  app.post('/api/integrations/backup-r2', async (req) => { need(req, 'admin', 'edit'); const name = await backupToR2(); audit(req.ctx, getDef('branches'), 0, 'backup', { file: [null, name] }, name); return { name, r2: r2Configured() } })

  // =================================================================== public webhooks
  const limit = { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }
  app.get('/api/public/whatsapp', limit, async (req, reply) => {
    const s = req.query as any
    if (s['hub.mode'] === 'subscribe' && getSetting('wa_verify_token') && same(String(s['hub.verify_token'] ?? ''), String(getSetting('wa_verify_token')))) return reply.type('text/plain').send(String(s['hub.challenge'] ?? ''))
    return reply.status(403).send('forbidden')
  })
  app.post('/api/public/whatsapp', limit, async (req, reply) => {
    const raw = (req as any).rawBody as string | undefined
    if (!verifySignature(raw ?? JSON.stringify(req.body), req.headers['x-hub-signature-256'] as string | undefined)) return reply.status(401).send({ error: 'bad signature' })
    reply.send({ ok: true })
    void handleWebhook(req.body).catch(e => logIntegration('whatsapp', 'webhook', false, String(e?.message ?? e)))
  })
  app.post('/api/public/tracking/:secret', limit, async (req, reply) => {
    const secret = String(getSetting('tracking_webhook_secret') || '')
    if (!secret || !same(secret, String((req.params as any).secret))) return reply.status(404).send({ error: 'Not found' })
    const items = Array.isArray(req.body) ? req.body : [req.body]
    return { processed: items.map(i => ingestTrackingEvent(i)).filter(Boolean).length }
  })
  app.post('/api/public/bank/:secret', limit, async (req, reply) => {
    const secret = String(getSetting('bank_webhook_secret') || '')
    if (!secret || !same(secret, String((req.params as any).secret))) return reply.status(404).send({ error: 'Not found' })
    const b = z.object({ iban: z.string().optional(), bank_account_id: z.number().optional(), transactions: z.array(z.object({ date: z.string(), description: z.string().optional(), reference: z.string().optional(), amount: z.number().optional(), debit: z.number().optional(), credit: z.number().optional() })).max(2000) }).parse(req.body)
    const acct = b.bank_account_id ?? q.val<number>(`SELECT id FROM bank_accounts WHERE replace(iban,' ','') = ? AND deleted_at IS NULL`, (b.iban ?? '').replace(/\s/g, ''))
    if (!acct) return reply.status(422).send({ error: 'Bank account not found for that IBAN' })
    return importLines(acct, b.transactions.map(t => ({ date: t.date.slice(0, 10), description: t.description ?? '(bank feed)', reference: t.reference ?? '', debit: t.debit ?? (t.amount && t.amount < 0 ? -t.amount : 0), credit: t.credit ?? (t.amount && t.amount > 0 ? t.amount : 0) })), 'feed')
  })

  // =================================================================== finance
  app.get('/api/finance/year-end/:year', async (req) => { need(req, 'finance', 'view'); return yearEndPreview(Number((req.params as any).year), (req.query as any).entity ? Number((req.query as any).entity) : null) })
  app.post('/api/finance/year-end/close', async (req) => { need(req, 'finance', 'approve'); const b = z.object({ year: z.number().int(), entity: z.number().int().nullable().optional(), lock: z.boolean().optional() }).parse(req.body); return closeYear(b.year, req.ctx, { entityId: b.entity ?? null, lock: b.lock }) })
  app.post('/api/finance/year-end/:id/reopen', async (req) => { need(req, 'finance', 'approve'); return reopenYear(idOf((req.params as any).id), req.ctx) })

  app.post('/api/finance/bank/auto-match', async (req) => { need(req, 'finance', 'edit'); return { matched: autoMatch((req.body as any)?.bank_account_id) } })

  app.get('/api/invoices/:id/einvoice.xml', async (req, reply) => {
    const id = idOf((req.params as any).id); getRecord(getDef('invoices'), id, req.ctx, { children: false }); need(req, 'finance', 'export')
    const { xml, filename } = buildEinvoiceXml(id)
    reply.header('content-type', 'application/xml; charset=utf-8').header('content-disposition', `attachment; filename="${filename}"`); return xml
  })
  app.post('/api/invoices/:id/einvoice/submit', async (req) => { need(req, 'finance', 'edit'); const id = idOf((req.params as any).id); getRecord(getDef('invoices'), id, req.ctx, { children: false }); return submitEinvoice(id) })

  // =================================================================== HR – WPS
  app.get('/api/hr/wps/:period', async (req) => { need(req, 'hr', 'view'); const r = buildWps((req.params as any).period, { includeDrafts: (req.query as any).drafts === '1' }); return { ...r, content: undefined } })
  app.post('/api/hr/wps/:period/generate', async (req) => {
    need(req, 'hr', 'approve')
    const r = buildWps((req.params as any).period, { save: true, entityId: (req.body as any)?.entity ?? null })
    if (!r.ok) throw bad('Fix the listed problems first', r)
    audit(req.ctx, getDef('wps_batches'), r.batch_id!, 'wps-generated', { file: [null, r.file_name] }, r.file_name)
    return { ...r, content: undefined }
  })
  app.get('/api/hr/wps/batches/:id/download', async (req, reply) => {
    need(req, 'hr', 'export')
    const b = q.get(`SELECT file_name, content FROM wps_batches WHERE id = ? AND deleted_at IS NULL`, idOf((req.params as any).id))
    if (!b) throw notFound('File not found')
    reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="${b.file_name}"`); return safeJson<string>(b.content, '')
  })

  // =================================================================== operations
  app.post('/api/jobs/:id/edi/transmit', async (req) => { need(req, 'jobs', 'edit'); const id = idOf((req.params as any).id); getRecord(getDef('jobs'), id, req.ctx, { children: false }); const b = z.object({ format: z.string().default('auto'), via: z.enum(['http', 'email', 'sftp']).optional() }).parse(req.body ?? {}); return transmitEdi(id, b.format, b.via) })
  app.post('/api/jobs/:id/live-tracking', async (req) => { need(req, 'jobs', 'edit'); const id = idOf((req.params as any).id); getRecord(getDef('jobs'), id, req.ctx, { children: false }); return requestLiveTracking(id) })
  app.post('/api/customs/:id/submit', async (req) => { need(req, 'customs', 'edit'); const id = idOf((req.params as any).id); getRecord(getDef('customs_declarations'), id, req.ctx, { children: false }); return submitCustoms(id) })

  // =================================================================== server-side PDF
  app.get('/api/pdf/status', async () => ({ available: pdfAvailable() }))
  const printPath = (entity: string, id: number, query: any) => {
    const def = ENTITIES[entity]; if (!def?.print && !['jobs', 'parties'].includes(entity)) throw bad('This record type has no printable layout')
    const qs = Object.entries(query ?? {}).filter(([k]) => ['doc', 'from', 'to', 'currency'].includes(k)).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    return `/print/${entity}/${id}${qs ? '?' + qs : ''}`
  }
  const pdfFor = async (req: any, entity: string, id: number) => {
    const def = ENTITIES[entity]; if (!def) throw notFound('Unknown record type')
    assertCan(req.ctx, def.module, 'view'); getRecord(def, id, req.ctx, { children: false })
    const sid = req.cookies?.[COOKIE]; if (!sid) throw bad('PDF export is available from the signed-in web app')
    return renderPrintPdf(printPath(entity, id, req.query), { name: COOKIE, value: sid })
  }
  app.get('/api/pdf/:entity/:id', async (req, reply) => {
    const p = req.params as any; const buf = await pdfFor(req, p.entity, idOf(p.id))
    const label = getRecord(ENTITIES[p.entity], idOf(p.id), req.ctx, { children: false })._title ?? `${p.entity}-${p.id}`
    reply.header('content-type', 'application/pdf').header('content-disposition', `${(req.query as any).download === '1' ? 'attachment' : 'inline'}; filename="${String(label).replace(/[^\w.-]+/g, '_')}.pdf"`)
    return reply.send(buf)
  })
  app.post('/api/pdf/:entity/:id/email', async (req) => {
    const p = req.params as any, id = idOf(p.id)
    assertCan(req.ctx, ENTITIES[p.entity]?.module ?? 'admin', 'edit')
    const b = z.object({ to: z.string().email(), cc: z.string().optional(), subject: z.string().min(1), body: z.string().min(1) }).parse(req.body)
    const buf = await pdfFor(req, p.entity, id)
    const rec = getRecord(ENTITIES[p.entity], id, req.ctx, { children: false })
    const mid = queueEmail({ to: b.to, cc: b.cc, subject: b.subject, body: b.body, link_entity: p.entity, link_id: id, userId: req.user!.id, attachments: [{ filename: `${String(rec._title).replace(/[^\w.-]+/g, '_')}.pdf`, contentBase64: buf.toString('base64'), contentType: 'application/pdf' }] })
    audit(req.ctx, ENTITIES[p.entity], id, 'emailed', { to: [null, b.to] }, rec._title)
    return { queued: mid }
  })

  // =================================================================== AI team
  app.get('/api/ai/status', async (req) => {
    need(req, 'ai', 'view')
    return { configured: aiConfigured(), pending: q.val<number>(`SELECT COUNT(*) FROM ai_actions WHERE status = 'Pending'`) ?? 0, agents: q.all(`SELECT id, name, title, avatar, active, schedule, run_hour, autonomy, deliver_to, last_run_at, last_status, role_key, instructions, tools FROM ai_agents WHERE deleted_at IS NULL ORDER BY id`), templates: AGENT_TEMPLATES.map(t => ({ key: t.key, name: t.name, title: t.title, avatar: t.avatar, blurb: t.blurb })), tools: TOOLS.map(t => ({ name: t.name, risk: t.risk, description: t.description })) }
  })
  app.get('/api/ai/brief', async (req) => { need(req, 'ai', 'view'); return latestBrief() })
  app.post('/api/ai/chat', async (req) => {
    need(req, 'ai', 'create')
    const b = z.object({ agent_id: z.number().int(), message: z.string().min(1).max(4000), history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).max(30).optional() }).parse(req.body)
    return { reply: await chatWithAgent(b.agent_id, b.message, { history: b.history }) }
  })
  app.post('/api/ai/agents/:id/run', async (req) => { need(req, 'ai', 'create'); return runAgent(idOf((req.params as any).id), (req.body as any)?.task, 'manual') })
  app.post('/api/ai/agents/hire', async (req) => {
    need(req, 'ai', 'create')
    const t = AGENT_TEMPLATES.find(x => x.key === (req.body as any)?.template)
    if (!t) throw bad('Unknown template')
    return createRecord(getDef('ai_agents'), { name: t.name + (q.get(`SELECT id FROM ai_agents WHERE name = ? AND deleted_at IS NULL`, t.name) ? ' 2' : ''), title: t.title, avatar: t.avatar, instructions: t.instructions, autonomy: t.autonomy, schedule: t.schedule, run_hour: t.run_hour, deliver_to: t.deliver_to, tools: t.tools, active: false, role_key: t.key }, req.ctx)
  })
  app.post('/api/ai/actions/:id/:decision', async (req) => {
    need(req, 'ai', 'approve')
    const p = req.params as any
    if (!['approve', 'reject'].includes(p.decision)) throw bad('Unknown decision')
    return decideAction(idOf(p.id), p.decision === 'approve', req.user!.id)
  })

  // =================================================================== WhatsApp inbox
  app.get('/api/whatsapp/threads', async (req) => {
    need(req, 'crm', 'view')
    return { configured: waConfigured(), webhook: `${origin(req)}/api/public/whatsapp`, threads: q.all(`SELECT m.wa_id, MAX(m.id) last_id, COUNT(*) n, SUM(CASE WHEN m.direction = 'in' AND m.status = 'received' THEN 1 ELSE 0 END) inbound FROM whatsapp_messages m WHERE m.deleted_at IS NULL GROUP BY m.wa_id ORDER BY last_id DESC LIMIT 60`).map(t => { const last = q.get(`SELECT m.body, m.at, m.direction, m.contact_name, p.name party FROM whatsapp_messages m LEFT JOIN parties p ON p.id = m.party_id WHERE m.id = ?`, t.last_id); const nm = q.val<string>(`SELECT contact_name FROM whatsapp_messages WHERE wa_id = ? AND contact_name IS NOT NULL ORDER BY id DESC LIMIT 1`, t.wa_id); return { wa_id: t.wa_id, count: t.n, name: nm ?? last?.party ?? null, party: last?.party ?? null, last: last?.body, at: last?.at, direction: last?.direction } }) }
  })
  app.get('/api/whatsapp/thread/:waId', async (req) => { need(req, 'crm', 'view'); return q.all(`SELECT id, at, direction, body, status, origin, error FROM whatsapp_messages WHERE wa_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 100`, String((req.params as any).waId)).reverse() })
  app.post('/api/whatsapp/send', async (req) => {
    need(req, 'crm', 'create')
    const b = z.object({ to: z.string().min(5), text: z.string().min(1).max(4000) }).parse(req.body)
    const r = await sendWhatsApp(b.to, b.text, { origin: 'manual' })
    if (!r.ok) throw bad(r.error ?? 'Send failed. If the customer has not written in the last 24 hours, WhatsApp only allows approved templates.')
    return r
  })
  void can; void ensureAgents; void normalizePhone; void todayStr
}
