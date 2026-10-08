import nodemailer from 'nodemailer'
import { getSetting } from './settings'
import { inDemo } from './db'
import { bad, safeJson } from './util'
import { http } from './integrations/log'

export const COMPANY_SENDERS = ['sales', 'accounts', 'info', 'contact', 'support'].map(x => `${x}@elvorashipping.com`)
export interface MailAccount { email: string; provider: 'smtp' | 'resend'; host: string; port: number; secure: boolean; user: string; password: string; apiKey: string; enabled: boolean }
export const mailAccounts = (): MailAccount[] => safeJson(String(getSetting('mail_accounts') || '[]'), [])
export function ready(a?: MailAccount): boolean { return !!a?.enabled && (a.provider === 'resend' ? !!a.apiKey : !!a.host && !!a.user && !!a.password) }
export function senderAccount(email: string): MailAccount {
  const a = mailAccounts().find(a => a.email === email)
  if (!a || !ready(a)) throw bad('This sender is not connected. Open Email → Sender settings to connect it.')
  return a
}
export function smtpTransport(a: MailAccount) {
  return nodemailer.createTransport({ host: a.host, port: a.port, secure: a.secure, requireTLS: !a.secure, auth: { user: a.user, pass: a.password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 })
}
export async function verifyAccount(a: MailAccount) {
  if (inDemo()) throw bad('Email connections are disabled in the demo workspace')
  if (!ready(a)) throw bad('Add the connection details and enable this sender first')
  if (a.provider === 'resend') {
    const r = await http((process.env.RESEND_API_URL || 'https://api.resend.com') + '/domains', { headers: { Authorization: `Bearer ${a.apiKey}` } })
    if (r.status === 401 && r.data?.name === 'restricted_api_key') return { ok: true, note: 'Sending-only key detected. Send a message to your own address to confirm domain authorisation.' }
    if (!r.ok) throw bad('Resend rejected the connection. Check your API key and permissions.')
    const domain = a.email.split('@')[1]
    if (!r.data?.data?.some((d: any) => d.name === domain && d.status === 'verified')) throw bad('Verify elvorashipping.com in Resend before sending from this address.')
    return { ok: true, note: 'API connection and verified sender domain checked. Send a message to your own address to confirm delivery.' }
  }
  await smtpTransport(a).verify()
  return { ok: true, note: 'Login and TLS connection checked. Send a message to your own address to confirm sender authorisation.' }
}
