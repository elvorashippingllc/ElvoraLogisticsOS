import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { assertCan, createRecord, deleteRecord, getDef, getRecord, listRecords, patchRecord, SYSTEM_CTX, updateRecord, audit } from '../engine'
import { bad, notFound, nowLocal, todayStr } from '../util'
import { body, idOf, need } from './helpers'
import { addJobEvent, convertProforma, createBillFromJobCosts, duplicateJob, ensureTrackingToken, generateDO, generateEdi, generateInvoicesFromJob, jobKpi, trackingLinks, recomputeJobTotals } from '../domain/jobs'
import { queueEmail } from '../mailer'
import { getSetting } from '../settings'
import { postInvoice } from '../domain/finance'

export default async function (app: FastifyInstance) {
  const jobDef = () => getDef('jobs')
  const loadJob = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'jobs', 'edit')
    return { id, job: getRecord(jobDef(), id, req.ctx, { children: false }) }
  }

  app.post('/api/jobs/:id/events', async (req) => {
    const { id, job } = loadJob(req, true)
    const b = z.object({ event_type: z.string().min(1), event_at: z.string().optional(), location: z.string().max(200).optional().nullable(), description: z.string().max(1000).optional().nullable(), container_no: z.string().max(40).optional().nullable(), visible_to_customer: z.boolean().optional(), source: z.string().optional() }).parse(req.body)
    addJobEvent(id, b.event_type, { at: b.event_at || nowLocal(), location: b.location ?? undefined, description: b.description ?? undefined, container_no: b.container_no ?? undefined, visible: b.visible_to_customer ?? true, source: b.source ?? 'Manual', user_id: req.user!.id })
    // keep headline fields in sync with common milestones
    const sync: Record<string, string> = { 'Booking confirmed': 'BOOKING CONFIRMED', 'Cargo received': 'CARGO RECEIVED', 'Export customs cleared': 'CUSTOMS CLEARED', 'Loaded on vessel': 'STUFFED / LOADED', 'Gate-in at port': 'GATE-IN', 'Vessel departed': 'DEPARTED', 'Flight departed': 'DEPARTED', 'Vessel arrived': 'ARRIVED', 'Flight arrived': 'ARRIVED', Discharged: 'DISCHARGED', 'Out for delivery': 'OUT FOR DELIVERY', Delivered: 'DELIVERED', 'Empty returned': 'EMPTY RETURNED' }
    if (sync[b.event_type]) {
      const patch: any = { operational_status: sync[b.event_type] }
      if (/departed/.test(b.event_type) && !job.atd) patch.atd = (b.event_at || nowLocal()).slice(0, 16)
      if (/arrived/.test(b.event_type) && !job.ata) patch.ata = (b.event_at || nowLocal()).slice(0, 16)
      if (b.event_type === 'Delivered' && ['OPENED', 'IN PROGRESS'].includes(job.job_status)) patch.job_status = 'DELIVERED'
      else if (job.job_status === 'OPENED' && b.event_type !== 'Note') patch.job_status = 'IN PROGRESS'
      patchRecord(jobDef(), id, patch, req.ctx)
    }
    return { ok: true }
  })
  app.delete('/api/jobs/:id/events/:eid', async (req) => {
    const { id } = loadJob(req, true)
    q.run(`DELETE FROM job_events WHERE id = ? AND job_id = ? AND source <> 'System'`, idOf((req.params as any).eid), id)
    return { ok: true }
  })
  app.get('/api/jobs/:id/events', async (req) => {
    const { id } = loadJob(req)
    const rows = q.all(`SELECT e.*, u.name AS user_name FROM job_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.job_id = ? AND e.deleted_at IS NULL ORDER BY e.event_at DESC, e.id DESC`, id)
    return rows
  })

  app.post('/api/jobs/:id/generate-do', async (req) => {
    const { id } = loadJob(req, true)
    return tx(() => generateDO(id, req.ctx))
  })
  app.post('/api/jobs/:id/generate-invoices', async (req) => {
    const { id } = loadJob(req)
    need(req, 'finance', 'create')
    const b = z.object({ doc_type: z.enum(['Tax Invoice', 'Proforma Invoice']).optional(), charge_ids: z.array(z.number()).optional(), post: z.boolean().optional() }).parse(req.body ?? {})
    return tx(() => {
      const invs = generateInvoicesFromJob(id, { docType: b.doc_type, chargeIds: b.charge_ids }, req.ctx)
      if (b.post) { need(req, 'finance', 'edit'); return invs.map(i => postInvoice(i.id, req.ctx)) }
      return invs
    })
  })
  app.post('/api/jobs/:id/bill-from-costs', async (req) => {
    const { id } = loadJob(req)
    need(req, 'finance', 'create')
    const b = z.object({ vendor_id: z.number().int().positive(), vendor_invoice_no: z.string().min(1).max(60), charge_ids: z.array(z.number()).optional() }).parse(req.body)
    return tx(() => createBillFromJobCosts(id, b.vendor_id, b.vendor_invoice_no, b.charge_ids ?? [], req.ctx))
  })
  app.post('/api/invoices/:id/convert-proforma', async (req) => { need(req, 'finance', 'create'); return tx(() => convertProforma(idOf((req.params as any).id), req.ctx)) })

  // "Generate Bulk PI": one proforma per selected job / bill-to party / currency
  app.post('/api/jobs/bulk-proforma', async (req) => {
    need(req, 'finance', 'create')
    const b = z.object({ job_ids: z.array(z.number().int()).min(1).max(100) }).parse(req.body)
    const created: any[] = [], skipped: { job_id: number; reason: string }[] = []
    for (const jid of b.job_ids) {
      try { getRecord(jobDef(), jid, req.ctx, { children: false }); tx(() => created.push(...generateInvoicesFromJob(jid, { docType: 'Proforma Invoice' }, req.ctx))) }
      catch (e: any) { skipped.push({ job_id: jid, reason: e?.message ?? 'failed' }) }
    }
    return { created: created.map(c => ({ id: c.id, invoice_no: c.invoice_no, job_id: c.job_id, total: c.total, currency: c.currency })), skipped }
  })

  app.post('/api/jobs/:id/duplicate', async (req) => { need(req, 'jobs', 'create'); const { id } = loadJob(req); return tx(() => duplicateJob(id, req.ctx)) })
  app.get('/api/jobs/:id/kpi', async (req) => { const { id } = loadJob(req); return jobKpi(id) })
  app.get('/api/jobs/:id/tracking-links', async (req) => { const { id } = loadJob(req); return trackingLinks(id) })
  app.post('/api/jobs/:id/tracking-token', async (req) => { const { id } = loadJob(req, true); return { token: ensureTrackingToken(id) } })
  app.get('/api/jobs/:id/tracking-token', async (req) => { const { id } = loadJob(req); const r = q.get(`SELECT token FROM job_tracking_tokens WHERE job_id = ?`, id); return { token: r?.token ?? null } })

  app.get('/api/jobs/:id/edi', async (req, reply) => {
    const { id } = loadJob(req)
    need(req, 'jobs', 'export')
    const fmt = String((req.query as any).format ?? 'auto')
    const out = generateEdi(id, fmt)
    audit(req.ctx, jobDef(), id, 'edi-generated', { format: [null, fmt] }, out.filename)
    reply.header('content-type', out.mime + '; charset=utf-8').header('content-disposition', `attachment; filename="${out.filename}"`).header('x-edi-note', encodeURIComponent(out.note))
    return out.content
  })
  app.get('/api/jobs/:id/edi-preview', async (req) => { const { id } = loadJob(req); need(req, 'jobs', 'export'); return generateEdi(id, String((req.query as any).format ?? 'auto')) })

  // Bulk mail: status updates / arrival notices to customers' contacts
  app.post('/api/jobs/bulk-mail', async (req) => {
    need(req, 'jobs', 'edit')
    const b = z.object({ job_ids: z.array(z.number().int()).min(1).max(100), template: z.enum(['status', 'arrival', 'documents', 'custom']), subject: z.string().max(200).optional(), message: z.string().max(5000).optional(), to: z.string().max(300).optional(), preview: z.boolean().optional() }).parse(req.body)
    const co = getSetting<string>('company_name')
    const out: any[] = []
    for (const jid of b.job_ids) {
      const j = getRecord(jobDef(), jid, req.ctx, { children: true })
      const contacts = q.all(`SELECT email FROM contacts WHERE party_id = ? AND deleted_at IS NULL AND email <> '' AND (receives_tracking = 1 OR is_primary = 1)`, j.client_id).map(r => r.email)
      const fallback = q.val<string>(`SELECT email FROM parties WHERE id = ?`, j.client_id)
      const to = b.to || [...new Set(contacts.length ? contacts : fallback ? [fallback] : [])].join(', ')
      const L = j._labels
      const last = (j.children.events as any[]).filter(e => e.visible_to_customer).sort((a, c) => String(c.event_at).localeCompare(String(a.event_at)))[0]
      const head = `Job ${j.job_no}${j.hbl_no ? ` · HBL/HAWB ${j.hbl_no}` : ''}${j.mbl_no ? ` · MBL/AWB ${j.mbl_no}` : ''}`
      const route = `${L.pol_id ?? ''} → ${L.pod_id ?? ''}`
      const common = `${head}\nRoute: ${route}\nCarrier: ${L.carrier_id ?? '-'}${j.vessel_name ? ` / ${j.vessel_name} ${j.voyage_no ?? ''}` : ''}\nETD: ${j.etd ?? '-'}   ETA: ${j.eta ?? '-'}`
      let subject = b.subject, text = ''
      if (b.template === 'status') { subject ||= `Shipment update – ${j.job_no}`; text = `Dear Customer,\n\nPlease find the latest status of your shipment.\n\n${common}\nStatus: ${j.operational_status ?? j.job_status}${last ? `\nLatest event: ${last.event_type} (${String(last.event_at).replace('T', ' ')})${last.location ? ' – ' + last.location : ''}` : ''}` }
      else if (b.template === 'arrival') { subject ||= `Arrival notice – ${j.job_no}`; text = `Dear Customer,\n\nThis is to advise that your shipment is arriving as follows.\n\n${common}\nATA: ${j.ata ?? 'pending'}\n\nKindly arrange the original documents / payment of charges so that the delivery order can be released.` }
      else if (b.template === 'documents') { subject ||= `Documents – ${j.job_no}`; text = `Dear Customer,\n\nPlease find the document status for ${head}.\nB/L status: ${j.bl_status}\nOriginals sent to: ${j.first_original_sent_to ?? '-'}` }
      else { subject ||= `${j.job_no}`; text = '' }
      const bodyText = `${b.message ? b.message + '\n\n' : ''}${text}\n\nBest regards,\n${req.user!.name}\n${co}`
      if (b.preview) out.push({ job_id: jid, job_no: j.job_no, to, subject, body: bodyText })
      else {
        if (!to) { out.push({ job_id: jid, job_no: j.job_no, error: 'No e-mail address for this customer' }); continue }
        const id = queueEmail({ to, subject: subject!, body: bodyText, link_entity: 'jobs', link_id: jid, userId: req.user!.id })
        addJobEvent(jid, 'Documents sent', { description: `E-mail "${subject}" queued to ${to}`, user_id: req.user!.id, source: 'System', visible: false })
        out.push({ job_id: jid, job_no: j.job_no, queued: id, to })
      }
    }
    return out
  })

  // Job number search used by the Search screen
  app.get('/api/search/jobs', async (req) => {
    need(req, 'jobs', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'job_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string; via?: string }> = {
      job_no: { entity: 'jobs', field: 'job_no' }, mbl_no: { entity: 'jobs', field: 'mbl_no' }, hbl_no: { entity: 'jobs', field: 'hbl_no' }, client: { entity: 'jobs', field: 'client_id' },
      booking_no: { entity: 'jobs', field: 'booking_no' }, customer_ref: { entity: 'jobs', field: 'customer_ref' }, sb_no: { entity: 'jobs', field: 'sb_no' }, boe_no: { entity: 'jobs', field: 'boe_no' }, do_no: { entity: 'jobs', field: 'do_no' },
      vessel: { entity: 'jobs', field: 'vessel_name' }, container: { entity: 'jobs', field: 'id', via: 'container' }, shipment: { entity: 'jobs', field: 'id', via: 'shipment' }, invoice: { entity: 'jobs', field: 'id', via: 'invoice' },
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    let filters: any[] = []
    if (m.via) {
      const pat = `%${value.replace(/[\\%_]/g, c => '\\' + c)}%`
      const ids = m.via === 'container' ? q.all(`SELECT DISTINCT job_id id FROM job_containers WHERE container_no LIKE ? ESCAPE '\\' AND deleted_at IS NULL`, pat)
        : m.via === 'shipment' ? q.all(`SELECT DISTINCT job_id id FROM shipments WHERE (shipment_no LIKE ? ESCAPE '\\' OR hbl_no LIKE ? ESCAPE '\\') AND deleted_at IS NULL`, pat, pat)
        : q.all(`SELECT DISTINCT job_id id FROM invoices WHERE invoice_no LIKE ? ESCAPE '\\' AND job_id IS NOT NULL AND deleted_at IS NULL`, pat)
      if (!ids.length) return { rows: [], total: 0 }
      filters = [{ field: 'id', op: 'in', value: ids.map(r => r.id) }]
    } else filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(jobDef(), { filters, pageSize: 200, sort: 'job_no', dir: 'asc' }, req.ctx)
    const counts = new Map<number, number>()
    for (const r of q.all<{ job_id: number; n: number }>(`SELECT job_id, COUNT(*) n FROM shipments WHERE deleted_at IS NULL AND job_id IN (${res.rows.map(() => '?').join(',') || 'NULL'}) GROUP BY job_id`, ...res.rows.map(r => r.id))) counts.set(r.job_id, r.n)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, job_no: r.job_no, job_date: r.job_date, job_status: r.job_status, mbl_no: r.mbl_no, hbl_no: r.hbl_no, sub_jobs: counts.get(r.id) ?? 0, por: r._labels.por_id ?? '', pol: r._labels.pol_id ?? '', pod: r._labels.pod_id ?? '', client: r._labels.client_id ?? '', department: r.department, etd: r.etd, eta: r.eta, carrier: r._labels.carrier_id ?? '', operational_status: r.operational_status })) }
  })

  // ------------------------------------------------------------ public tracking by unguessable token
  app.get('/api/public/track/:token', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req) => {
    if (!getSetting('tracking_public_enabled')) throw notFound('Tracking is not available')
    const t = q.get(`SELECT job_id FROM job_tracking_tokens WHERE token = ?`, String((req.params as any).token))
    if (!t) throw notFound('Tracking link not found')
    const j = getRecord(jobDef(), t.job_id, SYSTEM_CTX, { children: true })
    const L = j._labels
    return {
      company: getSetting('company_name'), job_no: j.job_no, client: L.client_id, status: j.operational_status ?? j.job_status, job_status: j.job_status, department: j.department,
      pol: L.pol_id, pod: L.pod_id, carrier: L.carrier_id, vessel: j.vessel_name, voyage: j.voyage_no, mbl_no: j.mbl_no, hbl_no: j.hbl_no, etd: j.etd, atd: j.atd, eta: j.eta, ata: j.ata, commodity: j.commodity, packages: j.packages, gross_weight: j.gross_weight,
      containers: (j.children.containers as any[]).map(c => ({ container_no: c.container_no, type: c._labels?.type_id, status: c.status })),
      events: (j.children.events as any[]).filter(e => e.visible_to_customer).sort((a, b) => String(b.event_at).localeCompare(String(a.event_at))).map(e => ({ at: e.event_at, type: e.event_type, location: e.location, description: e.description })),
      legs: (j.children.legs as any[]).map(l => ({ mode: l.mode, from: l._labels?.from_id, to: l._labels?.to_id, etd: l.etd, eta: l.eta, status: l.status })),
    }
  })
  void updateRecord; void createRecord; void deleteRecord; void todayStr; void recomputeJobTotals
}
