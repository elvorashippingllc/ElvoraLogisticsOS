import nodemailer from 'nodemailer'
import { q } from './db'
import { getSetting, loadSettings } from './settings'
import { nowIso, safeJson } from './util'
import { inDemo } from './db'
import { http, logIntegration } from './integrations/log'

export interface MailAttachment { filename: string; contentBase64: string; contentType?: string }
export interface MailInput { to: string; cc?: string; subject: string; body: string; link_entity?: string; link_id?: number; userId?: number | null; attachments?: MailAttachment[] }

const resendOn = () => !!getSetting('resend_api_key') && getSetting('mail_provider') !== 'smtp'
const smtpOn = () => !!getSetting('smtp_host') && !!getSetting('smtp_from') && getSetting('mail_provider') !== 'resend'
export const smtpConfigured = () => resendOn() || smtpOn()
export const mailProvider = () => (resendOn() ? 'resend' : smtpOn() ? 'smtp' : 'none')
const fromAddr = () => String(getSetting('resend_from') || getSetting('smtp_from') || '')

export function queueEmail(m: MailInput): number {
  const status = smtpConfigured() ? 'Queued' : 'Not configured'
  const now = nowIso()
  const id = q.insert(`INSERT INTO email_outbox(to_addr, cc_addr, subject, body, status, link_entity, link_id, attachments, version, created_at, updated_at, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)`,
    m.to, m.cc ?? null, m.subject, m.body, status, m.link_entity ?? null, m.link_id ?? null, m.attachments?.length ? JSON.stringify(m.attachments) : null, now, now, m.userId ?? null, m.userId ?? null)
  if (status === 'Queued') setImmediate(() => { void processOutbox() })
  return id
}

const split = (s: string) => s.split(/[;,]/).map(x => x.trim()).filter(Boolean)
const htmlOf = (text: string) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#161d1a;white-space:pre-wrap">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`

async function sendOne(r: any) {
  const atts: MailAttachment[] = safeJson(r.attachments, [])
  if (resendOn()) {
    const res = await http((process.env.RESEND_API_URL || 'https://api.resend.com') + '/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${getSetting('resend_api_key')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr(), to: split(r.to_addr), cc: r.cc_addr ? split(r.cc_addr) : undefined, subject: r.subject, text: r.body, html: htmlOf(r.body), attachments: atts.length ? atts.map(a => ({ filename: a.filename, content: a.contentBase64 })) : undefined }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${res.data?.message ?? res.text.slice(0, 200)}`)
    return
  }
  if (inDemo()) throw new Error('E-mail sending is disabled in the demo workspace')
  const s = loadSettings()
  const transport = nodemailer.createTransport({ host: s.smtp_host, port: Number(s.smtp_port) || 587, secure: !!s.smtp_secure, auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined })
  await transport.sendMail({ from: s.smtp_from, to: r.to_addr, cc: r.cc_addr || undefined, subject: r.subject, text: r.body, attachments: atts.map(a => ({ filename: a.filename, content: Buffer.from(a.contentBase64, 'base64'), contentType: a.contentType })) })
}

let running = false
export async function processOutbox() {
  if (running || !smtpConfigured()) return
  running = true
  try {
    const rows = q.all(`SELECT * FROM email_outbox WHERE status = 'Queued' AND deleted_at IS NULL ORDER BY id LIMIT 20`)
    for (const r of rows) {
      try {
        await sendOne(r)
        q.run(`UPDATE email_outbox SET status='Sent', sent_at=?, updated_at=?, error=NULL WHERE id=?`, nowIso(), nowIso(), r.id)
      } catch (e: any) {
        q.run(`UPDATE email_outbox SET status='Failed', error=?, updated_at=? WHERE id=?`, String(e?.message ?? e).slice(0, 500), nowIso(), r.id)
        logIntegration(mailProvider(), 'send', false, `E-mail to ${r.to_addr} failed`, String(e?.message ?? e))
      }
    }
  } finally { running = false }
  if (q.val(`SELECT 1 FROM email_outbox WHERE status = 'Queued' AND deleted_at IS NULL LIMIT 1`)) setTimeout(() => { void processOutbox() }, 200)
}
export function retryOutbox() {
  q.run(`UPDATE email_outbox SET status = 'Queued', error = NULL WHERE status IN ('Failed','Not configured') AND deleted_at IS NULL`)
  void processOutbox()
}
export async function verifySmtp(): Promise<{ ok: boolean; error?: string; provider?: string }> {
  if (!smtpConfigured()) return { ok: false, error: 'Set a Resend API key (or SMTP host) and a From address' }
  if (resendOn()) {
    if (!fromAddr()) return { ok: false, error: 'Resend needs a verified From address (e.g. Elvora <ops@yourdomain.com>)' }
    const r = await http((process.env.RESEND_API_URL || 'https://api.resend.com') + '/domains', { headers: { Authorization: `Bearer ${getSetting('resend_api_key')}` } })
    return r.ok || (r.status === 401 && r.data?.name === 'restricted_api_key') ? { ok: true, provider: 'resend' } : { ok: false, provider: 'resend', error: `Resend ${r.status}: ${r.data?.message ?? 'key rejected'}` }
  }
  const s = loadSettings()
  try {
    await nodemailer.createTransport({ host: s.smtp_host, port: Number(s.smtp_port) || 587, secure: !!s.smtp_secure, auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined }).verify()
    return { ok: true, provider: 'smtp' }
  } catch (e: any) { return { ok: false, error: String(e?.message ?? e) } }
}
