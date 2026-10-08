import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { can, audit, getDef } from '../engine'
import { q, inDemo, tx } from '../db'
import { bad, forbidden } from '../util'
import { setSettings } from '../settings'
import { COMPANY_SENDERS, mailAccounts, ready, senderAccount, verifyAccount } from '../mail-accounts'
import { queueEmail } from '../mailer'
import { need, idOf } from './helpers'

const accountSchema = z.object({ email: z.string().email().refine(x => COMPANY_SENDERS.includes(x)), provider: z.enum(['smtp', 'resend']), host: z.string().max(255).default(''), port: z.number().int().refine(x => [465, 587].includes(x)), secure: z.boolean(), user: z.string().max(255).default(''), password: z.string().max(4096).default(''), apiKey: z.string().max(4096).default(''), enabled: z.boolean() })
const recipients = z.string().max(2000).refine(s => { const addresses = s.split(/[;,]/).map(x => x.trim()).filter(Boolean); return addresses.length > 0 && addresses.length <= 20 && addresses.every(x => z.string().email().safeParse(x).success) }, 'Enter valid email addresses, separated by commas')
function access(req: any, action: 'view' | 'create') { if (req.user?.party_id) throw forbidden('Email is available to staff only'); if (!can(req.user, 'crm', action) && !can(req.user, 'finance', action) && !can(req.user, 'admin', action)) throw forbidden('You do not have access to email') }
const draftSchema = z.object({ from: z.string().max(255).default(''), to: z.string().max(2000).default(''), cc: z.string().max(2000).default(''), subject: z.string().max(200).default(''), body: z.string().max(50000).default(''), version: z.number().int().positive().optional() })
export default async function routes(app: FastifyInstance) {
  app.get('/api/email/drafts', async req => { access(req, 'view'); return q.all('SELECT * FROM email_drafts WHERE user_id=? ORDER BY updated_at DESC LIMIT 100', req.user!.id) })
  app.post('/api/email/drafts', async req => {
    access(req, 'create'); const b = draftSchema.parse(req.body)
    if (Number(q.val('SELECT COUNT(*) FROM email_drafts WHERE user_id=?', req.user!.id)) >= 100) throw bad('You can keep up to 100 drafts. Remove an old draft first')
    const id = q.insert('INSERT INTO email_drafts(user_id,from_addr,to_addr,cc_addr,subject,body,updated_at) VALUES (?,?,?,?,?,?,?)', req.user!.id, b.from, b.to, b.cc, b.subject, b.body, new Date().toISOString())
    return { id, version: 1 }
  })
  app.put('/api/email/drafts/:id', async req => {
    access(req, 'create'); const b = draftSchema.parse(req.body), id = idOf((req.params as any).id)
    if (!b.version) throw bad('Reload this draft before saving')
    const result = q.run('UPDATE email_drafts SET from_addr=?,to_addr=?,cc_addr=?,subject=?,body=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?', b.from, b.to, b.cc, b.subject, b.body, new Date().toISOString(), id, req.user!.id, b.version)
    if (!result.changes) throw bad('This draft changed or is unavailable. Reload it before saving')
    return { id, version: b.version + 1 }
  })
  app.delete('/api/email/drafts/:id', async req => { access(req, 'create'); q.run('DELETE FROM email_drafts WHERE id=? AND user_id=?', idOf((req.params as any).id), req.user!.id); return { ok: true } })

  app.get('/api/email/senders', async req => {
    // Document senders also need this list, but no connection details or credentials.
    if (!req.user || req.user.party_id) throw forbidden('Email is available to staff only')
    const saved = mailAccounts()
    return COMPANY_SENDERS.map(email => ({ email, ready: ready(saved.find(a => a.email === email)) }))
  })
  app.get('/api/email/settings', async req => { need(req, 'admin', 'view'); return mailAccounts().map(a => ({ ...a, password: '', apiKey: '', hasPassword: !!a.password, hasApiKey: !!a.apiKey })) })
  app.put('/api/email/settings', async req => {
    need(req, 'admin', 'edit')
    if (inDemo()) throw bad('Email connections are disabled in the demo workspace')
    const inputs = z.array(accountSchema).max(5).parse(req.body)
    if (new Set(inputs.map(a => a.email)).size !== inputs.length) throw bad('Each sender may be configured once')
    const old = mailAccounts()
    const accounts = inputs.map(a => {
      if (a.provider === 'smtp' && ((a.port === 465) !== a.secure)) throw bad('Use SSL/TLS on port 465 or STARTTLS on port 587')
      const prev = old.find(o => o.email === a.email && o.provider === a.provider && o.host === a.host && o.user === a.user)
      const next = { ...a, password: a.password || prev?.password || '', apiKey: a.apiKey || prev?.apiKey || '' }
      if (a.enabled && !ready(next)) throw bad(`Add connection details for ${a.email} before enabling it`)
      return next
    })
    setSettings({ mail_accounts: JSON.stringify(accounts) })
    audit(req.ctx, getDef('email_outbox'), 0, 'sender-settings', { credentials: ['***', '***'] }, 'Email sender connections')
    return { ok: true }
  })
  app.post('/api/email/check', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async req => { need(req, 'admin', 'edit'); const { email } = z.object({ email: z.string().email() }).parse(req.body); return verifyAccount(senderAccount(email)) })
  app.get('/api/email/messages', async req => { access(req, 'view'); return q.all(`SELECT id,from_addr,to_addr,cc_addr,subject,body,status,error,sent_at,created_at FROM email_outbox WHERE deleted_at IS NULL AND created_by=? ORDER BY id DESC LIMIT 100`, req.user!.id) })
  app.post('/api/email/send', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async req => {
    access(req, 'create')
    if (inDemo()) throw bad('Sending email is disabled in the demo workspace')
    const b = z.object({ from: z.string().email(), to: recipients, cc: z.union([z.literal(''), recipients]).optional(), subject: z.string().trim().min(1).max(200).refine(x => !/[\r\n]/.test(x)), body: z.string().trim().min(1).max(50000), draft_id: z.number().int().positive().optional(), draft_version: z.number().int().positive().optional() }).parse(req.body)
    senderAccount(b.from)
    const id = tx(() => {
      if (b.draft_id) {
        const result = q.run('DELETE FROM email_drafts WHERE id=? AND user_id=? AND version=?', b.draft_id, req.user!.id, b.draft_version ?? 0)
        if (!result.changes) throw bad('This draft changed or is unavailable. Reload it before sending')
      }
      return queueEmail({ ...b, userId: req.user!.id })
    })
    audit(req.ctx, getDef('email_outbox'), id, 'queued', { from: [null, b.from], to: [null, b.to] }, b.subject)
    return { id, status: 'Queued' }
  })
  app.post('/api/email/messages/:id/retry', async req => {
    access(req, 'create'); if (inDemo()) throw bad('Sending email is disabled in the demo workspace')
    const id = idOf((req.params as any).id), row = q.get(`SELECT * FROM email_outbox WHERE id=? AND created_by=? AND deleted_at IS NULL`, id, req.user!.id)
    if (!row || row.status !== 'Failed') throw bad('Only your failed messages can be retried')
    senderAccount(row.from_addr)
    q.run(`UPDATE email_outbox SET status='Queued',error=NULL WHERE id=?`, id)
    const { processOutbox } = await import('../mailer'); void processOutbox()
    return { ok: true }
  })
}
