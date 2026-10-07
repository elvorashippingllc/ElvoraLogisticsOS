import crypto from 'node:crypto'
import { q } from '../db'
import { getSetting } from '../settings'
import { createRecord, getDef, insertRow, SYSTEM_CTX } from '../engine'
import { nowLocal, todayStr, fromCents, addDays, safeJson } from '../util'
import { http, logIntegration } from './log'
import { businessSnapshot } from './snapshot'
import { notifyRole } from '../notify'

const GRAPH = process.env.WA_GRAPH_URL || 'https://graph.facebook.com/v21.0'
export const waConfigured = () => !!getSetting('wa_enabled') && !!getSetting('wa_phone_number_id') && !!getSetting('wa_access_token')

/** Digits only, international format, using the default country code for local numbers. */
export function normalizePhone(raw: string | null | undefined): string {
  let d = String(raw ?? '').replace(/[^\d+]/g, '')
  if (!d) return ''
  if (d.startsWith('+')) return d.slice(1)
  d = d.replace(/^00/, '')
  const cc = String(getSetting('wa_default_country_code') || '971')
  if (d.startsWith('0')) return cc + d.slice(1)
  if (d.length <= 9) return cc + d
  return d
}
const tail = (s: string) => s.replace(/\D/g, '').slice(-9)
export const ownerNumbers = (): string[] => String(getSetting('wa_owner_numbers') || '').split(/[,;\s]+/).map(normalizePhone).filter(Boolean)

interface SendOpts { origin?: string; party_id?: number | null; lead_id?: number | null; name?: string | null; template?: boolean }
const tplSafe = (t: string) => t.replace(/[\r\n\t]+/g, ' | ').replace(/ {4,}/g, '   ').slice(0, 1000)

/** Send a WhatsApp message. Business-initiated messages outside the 24h window need an approved template (configure its name in Integrations). */
export async function sendWhatsApp(toRaw: string, text: string, o: SendOpts & { tpl?: string } = {}): Promise<{ ok: boolean; error?: string }> {
  const to = normalizePhone(toRaw)
  const base = { at: nowLocal(), direction: 'out', wa_id: to, contact_name: o.name ?? null, body: text, origin: o.origin ?? 'manual', party_id: o.party_id ?? null, lead_id: o.lead_id ?? null }
  if (!to) return { ok: false, error: 'No valid phone number' }
  if (!waConfigured()) { insertRow(getDef('whatsapp_messages'), { ...base, status: 'failed', error: 'WhatsApp is not configured' }); return { ok: false, error: 'WhatsApp is not configured' } }
  const tplName = o.tpl ? String(getSetting(o.tpl) || '') : ''
  const payload: any = tplName
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: tplName, language: { code: getSetting('wa_template_lang') || 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: tplSafe(text) }] }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000), preview_url: true } }
  try {
    const r = await http(`${GRAPH}/${getSetting('wa_phone_number_id')}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${getSetting('wa_access_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!r.ok) {
      const err = r.data?.error?.message ?? r.text.slice(0, 200)
      insertRow(getDef('whatsapp_messages'), { ...base, status: 'failed', error: err })
      logIntegration('whatsapp', 'send', false, `Send to ${to} failed: ${err}`, r.data ?? r.text)
      return { ok: false, error: err }
    }
    insertRow(getDef('whatsapp_messages'), { ...base, status: 'sent', wa_message_id: r.data?.messages?.[0]?.id ?? null })
    return { ok: true }
  } catch (e: any) {
    insertRow(getDef('whatsapp_messages'), { ...base, status: 'failed', error: String(e?.message ?? e) })
    return { ok: false, error: String(e?.message ?? e) }
  }
}

export async function messageOwners(text: string, origin = 'automation', tpl = 'wa_tpl_report') {
  for (const n of ownerNumbers()) await sendWhatsApp(n, text, { origin, tpl })
}

// ------------------------------------------------------------------ lookup helpers
export function findPartyByPhone(phone: string): { party_id: number; contact?: string } | null {
  const t = tail(phone)
  if (t.length < 7) return null
  for (const c of q.all(`SELECT party_id, name, mobile, phone FROM contacts WHERE deleted_at IS NULL AND party_id IS NOT NULL`)) if (tail(c.mobile ?? '') === t || tail(c.phone ?? '') === t) return { party_id: c.party_id, contact: c.name }
  for (const p of q.all(`SELECT id, phone FROM parties WHERE deleted_at IS NULL AND phone IS NOT NULL`)) if (tail(p.phone) === t) return { party_id: p.id }
  return null
}
export function phonesForParty(partyId: number): string[] {
  const out = new Set<string>()
  for (const c of q.all(`SELECT mobile, phone FROM contacts WHERE party_id = ? AND deleted_at IS NULL`, partyId)) { if (c.mobile) out.add(normalizePhone(c.mobile)); else if (c.phone) out.add(normalizePhone(c.phone)) }
  return [...out].filter(Boolean)
}

// ------------------------------------------------------------------ summaries for commands
function trackSummary(query: string, partyId?: number): string {
  const key = query.trim()
  if (!key) return 'Send: track <job no / container / MBL>'
  const j = q.get(`SELECT j.* FROM jobs j WHERE j.deleted_at IS NULL AND (j.job_no = ? OR j.mbl_no = ? OR j.hbl_no = ? OR j.id IN (SELECT job_id FROM job_containers WHERE container_no = ? AND deleted_at IS NULL)) ${partyId ? 'AND j.client_id = ' + Number(partyId) : ''} LIMIT 1`, key.toUpperCase(), key, key, key.toUpperCase())
  if (!j) return `No job found for "${key}"${partyId ? ' on your account' : ''}.`
  const ev = q.all(`SELECT event_at, event_type, location FROM job_events WHERE job_id = ? AND deleted_at IS NULL AND visible_to_customer = 1 ORDER BY event_at DESC, id DESC LIMIT 3`, j.id)
  const loc = (id: number | null) => (id ? q.val<string>(`SELECT code FROM locations WHERE id = ?`, id) : '') ?? ''
  return [`Job ${j.job_no} – ${j.job_status}`, `${loc(j.pol_id)} → ${loc(j.pod_id)}  ETA ${j.eta ? String(j.eta).slice(0, 10) : 'TBA'}`, ...ev.map(e => `• ${String(e.event_at).replace('T', ' ')} ${e.event_type}${e.location ? ' – ' + e.location : ''}`)].join('\n')
}
function overdueSummary(partyId?: number): string {
  const rows = q.all(`SELECT i.invoice_no, i.due_date, i.balance, i.currency, pr.name FROM invoices i JOIN parties pr ON pr.id = i.party_id WHERE i.status IN ('Posted','Partially paid') AND i.doc_type IN ('Tax Invoice','Debit Note') AND i.balance > 0 ${partyId ? 'AND i.party_id = ' + Number(partyId) : 'AND i.due_date < ?'} AND i.deleted_at IS NULL ORDER BY i.due_date LIMIT 12`, ...(partyId ? [] : [todayStr()]))
  if (!rows.length) return partyId ? 'You have no open invoices. Thank you!' : 'No overdue invoices.'
  return (partyId ? 'Your open invoices:\n' : 'Overdue invoices:\n') + rows.map(r => `• ${r.invoice_no} ${partyId ? '' : r.name + ' '}${r.currency} ${fromCents(r.balance).toLocaleString('en-US')} due ${r.due_date}`).join('\n')
}
function leadsSummary(): string {
  const rows = q.all(`SELECT lead_no, company, phone, source FROM leads WHERE status = 'New' AND deleted_at IS NULL ORDER BY id DESC LIMIT 8`)
  return rows.length ? 'New leads:\n' + rows.map(r => `• ${r.lead_no} ${r.company}${r.phone ? ' ' + r.phone : ''} (${r.source ?? ''})`).join('\n') : 'No new leads.'
}

// ------------------------------------------------------------------ inbound
export function verifySignature(raw: string, header: string | undefined): boolean {
  const secret = String(getSetting('wa_app_secret') || '')
  if (!secret) return true
  if (!header?.startsWith('sha256=')) return false
  const h = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(header.slice(7)), b = Buffer.from(h)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const lastAck = new Map<string, number>()
export async function handleWebhook(body: any) {
  for (const entry of body?.entry ?? []) for (const ch of entry?.changes ?? []) {
    const v = ch?.value ?? {}
    for (const st of v.statuses ?? []) {
      const map: Record<string, string> = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' }
      if (st.id && map[st.status]) q.run(`UPDATE whatsapp_messages SET status = ?, error = ? WHERE wa_message_id = ?`, map[st.status], st.status === 'failed' ? (st.errors?.[0]?.title ?? 'failed') : null, st.id)
    }
    const names: Record<string, string> = {}
    for (const c of v.contacts ?? []) names[c.wa_id] = c.profile?.name ?? ''
    for (const m of v.messages ?? []) {
      try { await onMessage(m, names[m.from] ?? '') } catch (e: any) { logIntegration('whatsapp', 'inbound', false, `Inbound handler error: ${e?.message ?? e}`) }
    }
  }
}

async function onMessage(m: any, profile: string) {
  const from = String(m.from)
  if (q.get(`SELECT id FROM whatsapp_messages WHERE wa_message_id = ?`, m.id)) return
  const text: string = m.type === 'text' ? m.text?.body ?? '' : m.type === 'button' ? m.button?.text ?? '' : m.type === 'interactive' ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '') : `[${m.type}]`
  const staff = ownerNumbers().includes(from)
  const known = staff ? null : findPartyByPhone(from)
  const rowBase = { at: nowLocal(), direction: 'in', wa_id: from, contact_name: profile || known?.contact || null, body: text, status: 'received', wa_message_id: m.id, party_id: known?.party_id ?? null, origin: staff ? 'staff' : known ? 'customer' : 'unknown' }
  const rowId = insertRow(getDef('whatsapp_messages'), rowBase)
  const cmd = text.trim().toLowerCase()
  const reply = (t: string) => sendWhatsApp(from, t, { origin: staff ? 'staff command' : 'bot', party_id: known?.party_id ?? null, name: profile })

  if (staff && getSetting('wa_staff_bot')) {
    if (/^(help|\?|menu)$/.test(cmd)) return void (await reply('Commands:\n• report – business brief\n• overdue – overdue invoices\n• leads – new leads\n• track <job/container>\n• task <text> – create a task\nOr just ask a question.'))
    if (/^(report|brief|today|status)$/.test(cmd)) return void (await reply(businessSnapshot().text))
    if (/^(overdue|ar|outstanding|receivable)/.test(cmd)) return void (await reply(overdueSummary()))
    if (/^leads?$/.test(cmd)) return void (await reply(leadsSummary()))
    if (/^track\s+/.test(cmd)) return void (await reply(trackSummary(text.replace(/^track\s+/i, ''))))
    if (/^task\s+/.test(cmd)) { const r = createRecord(getDef('tasks'), { title: text.replace(/^task\s+/i, '').slice(0, 200), kind: 'Follow-up', priority: 'Medium', description: 'Created from WhatsApp' }, SYSTEM_CTX); return void (await reply(`Task created: ${r._title}`)) }
    if (getSetting('ai_enabled')) {
      const { chatWithAgent } = await import('../ai/agents')
      const out = await chatWithAgent('Jarvis', text, { channel: 'whatsapp' })
      return void (await reply(out.slice(0, 1500)))
    }
    return void (await reply('AI is not enabled. Type "help" for commands.'))
  }

  if (known && getSetting('wa_customer_bot')) {
    if (/^track\s+/.test(cmd)) return void (await reply(trackSummary(text.replace(/^track\s+/i, ''), known.party_id)))
    if (/^(statement|balance|outstanding|invoices?)$/.test(cmd)) return void (await reply(overdueSummary(known.party_id)))
    notifyRole('crm', `WhatsApp from ${profile || from}`, text.slice(0, 160), '/whatsapp', 'info')
    if (Date.now() - (lastAck.get(from) ?? 0) > 6 * 3600_000) { lastAck.set(from, Date.now()); await reply('Thank you for your message. Our team will reply shortly. You can also send "track <job number>" or "statement".') }
    return
  }

  if (!staff && getSetting('wa_auto_leads')) {
    const existing = q.get(`SELECT id FROM leads WHERE deleted_at IS NULL AND status NOT IN ('Converted','Unqualified') AND replace(replace(phone,'+',''),' ','') LIKE ?`, `%${tail(from)}`)
    let leadId = existing?.id as number | undefined
    if (!leadId) {
      const lead = createRecord(getDef('leads'), { company: profile || `WhatsApp ${from}`, contact_name: profile || null, phone: '+' + from, source: 'WhatsApp', status: 'New', notes: `First message: ${text.slice(0, 500)}` }, SYSTEM_CTX)
      leadId = lead.id
      notifyRole('crm', `New WhatsApp lead: ${profile || from}`, text.slice(0, 160), `/e/leads/${lead.id}`, 'info')
      q.run(`UPDATE whatsapp_messages SET lead_id = ? WHERE id = ?`, leadId, rowId)
      if (Date.now() - (lastAck.get(from) ?? 0) > 6 * 3600_000) { lastAck.set(from, Date.now()); await reply(`Hello${profile ? ' ' + profile : ''}, thank you for contacting Elvora Shipping. We have received your enquiry and a specialist will get back to you shortly.`) }
    } else q.run(`UPDATE whatsapp_messages SET lead_id = ? WHERE id = ?`, leadId, rowId)
  }
}

// ------------------------------------------------------------------ automations (called from scheduler / hooks)
export async function ownerDailyReport() {
  if (!waConfigured() || !getSetting('wa_owner_daily_report')) return
  await messageOwners(businessSnapshot().text, 'daily report', 'wa_tpl_report')
}
export async function overdueReminders() {
  if (!waConfigured() || !getSetting('wa_auto_overdue')) return
  const today = todayStr(), cut = addDays(today, -7)
  const rows = q.all(`SELECT i.id, i.invoice_no, i.due_date, i.balance, i.currency, i.party_id, pr.name FROM invoices i JOIN parties pr ON pr.id = i.party_id WHERE i.status IN ('Posted','Partially paid') AND i.doc_type IN ('Tax Invoice','Debit Note') AND i.balance > 0 AND i.due_date < ? AND i.deleted_at IS NULL LIMIT 40`, today)
  for (const i of rows) {
    const last = q.val<string>(`SELECT MAX(at) FROM whatsapp_messages WHERE origin = ? AND direction = 'out'`, `reminder:${i.id}`)
    if (last && last.slice(0, 10) > cut) continue
    const text = `Dear ${i.name}, a friendly reminder that invoice ${i.invoice_no} for ${i.currency} ${fromCents(i.balance).toLocaleString('en-US')} was due on ${i.due_date}. Please arrange payment or reply if you need a copy. Thank you – Elvora Shipping.`
    for (const ph of phonesForParty(i.party_id).slice(0, 2)) await sendWhatsApp(ph, text, { origin: `reminder:${i.id}`, party_id: i.party_id, tpl: 'wa_tpl_reminder' })
  }
}
export async function notifyMilestone(jobId: number, type: string, location?: string | null) {
  try {
    if (!waConfigured() || !getSetting('wa_auto_milestones')) return
    const j = q.get(`SELECT job_no, client_id FROM jobs WHERE id = ?`, jobId)
    if (!j?.client_id) return
    const text = `Update on job ${j.job_no}: ${type}${location ? ' – ' + location : ''}. Reply "track ${j.job_no}" for the latest status.`
    for (const ph of phonesForParty(j.client_id).slice(0, 2)) await sendWhatsApp(ph, text, { origin: 'milestone', party_id: j.client_id, tpl: 'wa_tpl_notify' })
  } catch { /* never block the job */ }
}
export async function testWhatsApp(): Promise<{ ok: boolean; error?: string }> {
  if (!waConfigured()) return { ok: false, error: 'Enable WhatsApp and enter the phone number ID and access token' }
  const r = await http(`${GRAPH}/${getSetting('wa_phone_number_id')}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${getSetting('wa_access_token')}` } })
  return r.ok ? { ok: true } : { ok: false, error: r.data?.error?.message ?? `HTTP ${r.status}` }
}
void safeJson
