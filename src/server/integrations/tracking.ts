import crypto from 'node:crypto'
import { q } from '../db'
import { getSetting } from '../settings'
import { addJobEvent } from '../domain/jobs'
import { EVENT_TYPES } from '../../shared/entities'
import { http, logIntegration } from './log'
import { bad } from '../util'

export const trackingConfigured = () => getSetting('tracking_provider') !== 'none' && !!getSetting('tracking_api_key')
export const trackingWebhookSecret = () => {
  let s = String(getSetting('tracking_webhook_secret') || '')
  if (!s) s = crypto.randomBytes(18).toString('hex')
  return s
}

/** Terminal49 container / bill-of-lading tracking request. Events arrive on the webhook below. */
export async function requestLiveTracking(jobId: number): Promise<{ ok: boolean; message: string }> {
  if (getSetting('tracking_provider') !== 'terminal49') throw bad('Live tracking provider is not set to Terminal49 in Integrations')
  if (!getSetting('tracking_api_key')) throw bad('Terminal49 API key is missing')
  const j = q.get(`SELECT j.id, j.job_no, j.mbl_no, j.carrier_id, c.code scac FROM jobs j LEFT JOIN carriers c ON c.id = j.carrier_id WHERE j.id = ?`, jobId)
  if (!j) throw bad('Job not found')
  const cont = q.get(`SELECT container_no FROM job_containers WHERE job_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1`, jobId)
  const number = j.mbl_no || cont?.container_no
  if (!number) throw bad('The job needs an MBL number or a container number first')
  if (!j.scac) throw bad('Set the carrier (with its SCAC code in Master Data → Carriers) on the job first')
  const r = await http('https://api.terminal49.com/v2/tracking_requests', {
    method: 'POST', headers: { Authorization: `Token ${getSetting('tracking_api_key')}`, 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify({ data: { type: 'tracking_request', attributes: { request_type: j.mbl_no ? 'bill_of_lading' : 'container', request_number: number, scac: j.scac, ref_numbers: [j.job_no] } } }),
  })
  logIntegration('terminal49', 'track', r.ok, r.ok ? `Tracking requested for ${j.job_no}` : `Tracking request failed (${r.status})`, r.data ?? r.text, { entity: 'jobs', id: jobId })
  if (!r.ok) throw bad(`Terminal49: ${r.data?.errors?.[0]?.detail ?? r.text.slice(0, 160)}`)
  addJobEvent(jobId, 'Note', { description: `Live tracking requested from Terminal49 (${number})`, source: 'System', visible: false })
  return { ok: true, message: `Tracking requested for ${number}. Events will appear automatically.` }
}

const MAP: [RegExp, string][] = [
  [/gate_out.*empty|empty_out|pickup_empty/i, 'Container released / picked up'], [/loaded/i, 'Loaded on vessel'], [/transship.*arriv/i, 'Transhipment arrival'], [/transship.*depart/i, 'Transhipment departure'],
  [/depart/i, 'Vessel departed'], [/arriv/i, 'Vessel arrived'], [/discharg/i, 'Discharged'], [/gate_in|full_in/i, 'Gate-in at port'], [/full_out|picked|gate_out/i, 'Container gate-out'],
  [/empty_return|empty_in/i, 'Empty returned'], [/deliver/i, 'Delivered'],
]
function mapEvent(raw: string): string {
  const known = new Set<string>(EVENT_TYPES as readonly string[])
  if (known.has(raw)) return raw
  for (const [re, t] of MAP) if (re.test(raw) && known.has(t)) return t
  return 'Note'
}

/** Provider-agnostic: { job_no | mbl_no | container_no, event, location?, at?, description? } or Terminal49 payloads. */
export function ingestTrackingEvent(p: any): { job_id: number } | null {
  let key: any = p, event = p.event, location = p.location, at = p.at, desc = p.description
  const ref = p?.data?.attributes?.event ?? p?.data?.attributes
  if (p?.data?.attributes?.event && p?.data?.type === 'webhook_notification') { event = p.data.attributes.event; key = p.included?.find((x: any) => x.type === 'tracking_request')?.attributes ?? {}; key = { mbl_no: key.request_number, ...key }; at = p.included?.find((x: any) => x.attributes?.timestamp)?.attributes?.timestamp; desc = `Carrier event: ${event}` }
  void ref
  const num = String(key.job_no ?? key.mbl_no ?? key.request_number ?? key.container_no ?? '').trim()
  if (!num || !event) return null
  const j = q.get(`SELECT id FROM jobs WHERE deleted_at IS NULL AND (job_no = ? OR mbl_no = ? OR id IN (SELECT job_id FROM job_containers WHERE container_no = ? AND deleted_at IS NULL)) LIMIT 1`, num, num, num.toUpperCase())
  if (!j) return null
  const type = mapEvent(String(event))
  addJobEvent(j.id, type, { at: at ? String(at).slice(0, 16) : undefined, location, description: desc ?? `Carrier event: ${event}`, source: 'Carrier', container_no: p.container_no })
  logIntegration('tracking', 'event', true, `${num}: ${event}`, p, { entity: 'jobs', id: j.id })
  return { job_id: j.id }
}
