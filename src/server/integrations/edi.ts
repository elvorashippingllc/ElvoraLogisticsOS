import { q, inDemo } from '../db'
import { getSetting } from '../settings'
import { bad, nowLocal } from '../util'
import { generateEdi, addJobEvent } from '../domain/jobs'
import { getDef, getRecord, patchRecord, SYSTEM_CTX } from '../engine'
import { queueEmail } from '../mailer'
import { http, logIntegration } from './log'

export type EdiTransport = 'http' | 'email' | 'sftp'

export async function transmitEdi(jobId: number, format: string, via?: EdiTransport): Promise<{ ok: boolean; message: string }> {
  const transport = (via ?? getSetting('edi_transport')) as string
  if (!transport || transport === 'none') throw bad('Choose an EDI transport under Integrations (HTTP / e-mail / SFTP)')
  const edi = generateEdi(jobId, format)
  const job = q.get(`SELECT job_no FROM jobs WHERE id = ?`, jobId)
  let message = ''
  try {
    if (transport === 'http') {
      const url = String(getSetting('edi_http_url') || ''); if (!url) throw bad('EDI HTTP endpoint is not configured')
      const auth = String(getSetting('edi_http_auth') || '')
      const r = await http(url, { method: 'POST', headers: { 'Content-Type': edi.mime, 'X-Filename': edi.filename, ...(auth ? { Authorization: auth } : {}) }, body: edi.content, timeoutMs: 30000 })
      if (!r.ok) throw bad(`Endpoint answered HTTP ${r.status}: ${r.text.slice(0, 160)}`)
      message = `Sent ${edi.filename} to the HTTP endpoint (HTTP ${r.status})`
    } else if (transport === 'email') {
      const to = String(getSetting('edi_email_to') || ''); if (!to) throw bad('EDI recipient e-mail is not configured')
      queueEmail({ to, subject: `EDI ${job?.job_no} ${edi.filename}`, body: `EDI message for job ${job?.job_no} attached (${edi.filename}).`, link_entity: 'jobs', link_id: jobId, attachments: [{ filename: edi.filename, contentBase64: Buffer.from(edi.content).toString('base64'), contentType: edi.mime }] })
      message = `Queued ${edi.filename} for e-mail to ${to}`
    } else if (transport === 'sftp') {
      const host = String(getSetting('edi_sftp_host') || ''); if (!host) throw bad('SFTP host is not configured')
      if (inDemo()) throw bad('SFTP is disabled in the demo workspace')
      const { default: SFTP } = await import('ssh2-sftp-client')
      const c = new SFTP()
      try {
        await c.connect({ host, port: Number(getSetting('edi_sftp_port')) || 22, username: getSetting('edi_sftp_user'), password: getSetting('edi_sftp_pass'), readyTimeout: 15000 })
        const dir = String(getSetting('edi_sftp_dir') || '/').replace(/\/?$/, '/')
        await c.put(Buffer.from(edi.content), dir + edi.filename)
      } finally { await c.end().catch(() => {}) }
      message = `Uploaded ${edi.filename} to ${host}`
    } else throw bad('Unknown EDI transport')
  } catch (e: any) {
    logIntegration('edi', transport, false, `${edi.filename}: ${e?.message ?? e}`, undefined, { entity: 'jobs', id: jobId })
    throw e
  }
  logIntegration('edi', transport, true, message, undefined, { entity: 'jobs', id: jobId })
  addJobEvent(jobId, 'Documents sent', { description: `EDI ${edi.filename} transmitted (${transport})`, source: 'System', visible: false })
  return { ok: true, message }
}

/** Submit a customs declaration to a configured gateway (a broker/customs-system adapter that accepts JSON). */
export async function submitCustoms(id: number): Promise<{ ok: boolean; message: string }> {
  const url = String(getSetting('customs_gateway_url') || '')
  if (!url) throw bad('Customs gateway URL is not configured. Use "Export JSON" to hand the declaration to your broker or clearing portal.')
  const def = getDef('customs_declarations')
  const d = getRecord(def, id, SYSTEM_CTX)
  const job = q.get(`SELECT job_no, mbl_no, hbl_no FROM jobs WHERE id = ?`, d.job_id)
  const payload = { reference: d.ref_no, type: d.declaration_type, customs_office: d.customs_office, regime: d.regime, job: job, currency: d.currency, declared_value: d.total_value, lines: d.lines?.map((l: any) => ({ hs_code: l._labels?.hs_code_id ?? l.hs_text, description: l.description, origin: l._labels?.origin_country_id, qty: l.qty, uom: l.uom, weight: l.weight, value: l.value, duty_pct: l.duty_pct })) ?? [] }
  const r = await http(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSetting('customs_gateway_key')}` }, body: JSON.stringify(payload), timeoutMs: 30000 })
  logIntegration('customs', 'submit', r.ok, `${d.ref_no}: ${r.ok ? 'submitted' : 'HTTP ' + r.status}`, r.data ?? r.text.slice(0, 800), { entity: 'customs_declarations', id })
  if (!r.ok) throw bad(`Customs gateway answered HTTP ${r.status}: ${r.data?.message ?? r.text.slice(0, 160)}`)
  const decl = r.data?.declaration_no ?? r.data?.reference ?? null
  patchRecord(def, id, { status: 'Submitted', ...(decl && !d.declaration_no ? { declaration_no: String(decl) } : {}), declaration_date: nowLocal().slice(0, 10) }, SYSTEM_CTX)
  return { ok: true, message: decl ? `Submitted – customs reference ${decl}` : 'Submitted' }
}
