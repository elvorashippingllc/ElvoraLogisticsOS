import nodemailer from 'nodemailer'
import { q } from './db'
import { getSetting, loadSettings } from './settings'
import { nowIso } from './util'

export interface MailInput { to: string; cc?: string; subject: string; body: string; link_entity?: string; link_id?: number; userId?: number | null }

export function smtpConfigured() { return !!getSetting('smtp_host') && !!getSetting('smtp_from') }

export function queueEmail(m: MailInput): number {
  const status = smtpConfigured() ? 'Queued' : 'Not configured'
  const now = nowIso()
  const r = q.run(`INSERT INTO email_outbox(to_addr, cc_addr, subject, body, status, link_entity, link_id, version, created_at, updated_at, created_by, updated_by) VALUES (?,?,?,?,?,?,?,1,?,?,?,?)`,
    m.to, m.cc ?? null, m.subject, m.body, status, m.link_entity ?? null, m.link_id ?? null, now, now, m.userId ?? null, m.userId ?? null)
  const id = Number(r.lastInsertRowid)
  if (status === 'Queued') setImmediate(() => { void processOutbox() })
  return id
}

let running = false
export async function processOutbox() {
  if (running || !smtpConfigured()) return
  running = true
  try {
    const s = loadSettings()
    const transport = nodemailer.createTransport({ host: s.smtp_host, port: Number(s.smtp_port) || 587, secure: !!s.smtp_secure, auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined })
    const rows = q.all(`SELECT * FROM email_outbox WHERE status = 'Queued' AND deleted_at IS NULL ORDER BY id LIMIT 20`)
    for (const r of rows) {
      try {
        await transport.sendMail({ from: s.smtp_from, to: r.to_addr, cc: r.cc_addr || undefined, subject: r.subject, text: r.body })
        q.run(`UPDATE email_outbox SET status='Sent', sent_at=?, updated_at=?, error=NULL WHERE id=?`, nowIso(), nowIso(), r.id)
      } catch (e: any) {
        q.run(`UPDATE email_outbox SET status='Failed', error=?, updated_at=? WHERE id=?`, String(e?.message ?? e).slice(0, 500), nowIso(), r.id)
      }
    }
  } finally { running = false }
}
export function retryOutbox() {
  q.run(`UPDATE email_outbox SET status = 'Queued', error = NULL WHERE status IN ('Failed','Not configured') AND deleted_at IS NULL`)
  void processOutbox()
}
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!smtpConfigured()) return { ok: false, error: 'SMTP host and From address are not configured' }
  const s = loadSettings()
  try {
    await nodemailer.createTransport({ host: s.smtp_host, port: Number(s.smtp_port) || 587, secure: !!s.smtp_secure, auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined }).verify()
    return { ok: true }
  } catch (e: any) { return { ok: false, error: String(e?.message ?? e) } }
}
