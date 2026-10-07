import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q } from '../db'
import { audit, getDef } from '../engine'
import { bad, notFound, nowIso, todayStr } from '../util'
import { idOf, need } from './helpers'
import { generateCalendar, overview, syncFindings } from '../domain/compliance'

export default async function (app: FastifyInstance) {
  app.get('/api/compliance/overview', async (req) => { need(req, 'compliance', 'view'); return overview() })

  app.post('/api/compliance/generate-calendar', async (req) => {
    need(req, 'compliance', 'edit')
    const r = generateCalendar()
    audit(req.ctx, getDef('compliance_filings'), 0, 'generate-calendar', { created: [null, r.created], updated: [null, r.updated] }, 'Compliance calendar')
    return r
  })

  app.post('/api/compliance/exceptions/:id/acknowledge', async (req) => {
    need(req, 'compliance', 'edit')
    const id = idOf((req.params as any).id)
    const { note } = z.object({ note: z.string().trim().min(3, 'Enter a short review note') }).parse(req.body ?? {})
    const ex = q.get(`SELECT id, status, rule FROM compliance_exceptions WHERE id = ? AND deleted_at IS NULL`, id)
    if (!ex) throw notFound()
    if (ex.status === 'Resolved') throw bad('This finding is already resolved')
    q.run(`UPDATE compliance_exceptions SET status = 'Acknowledged', note = ?, acknowledged_by = ?, acknowledged_at = ?, updated_at = ? WHERE id = ?`, note, req.user!.id, nowIso(), nowIso(), id)
    audit(req.ctx, getDef('compliance_exceptions'), id, 'acknowledge', { status: [ex.status, 'Acknowledged'] }, `${ex.rule}: ${note}`)
    return { ok: true }
  })

  // Record the outcome of a sanctions screening (UAE Local Terrorist List / UN Consolidated List) for a customer or vendor.
  app.post('/api/compliance/parties/:id/screen', async (req) => {
    need(req, 'compliance', 'edit')
    const id = idOf((req.params as any).id)
    const b = z.object({ result: z.enum(['Clear', 'Potential match', 'Confirmed match']), note: z.string().optional() }).parse(req.body ?? {})
    const p = q.get(`SELECT id, name, sanctions_status FROM parties WHERE id = ? AND deleted_at IS NULL`, id)
    if (!p) throw notFound('Party not found')
    q.run(`UPDATE parties SET sanctions_status = ?, sanctions_screened_on = ?, updated_at = ?, version = version + 1 WHERE id = ?`, b.result, todayStr(), nowIso(), id)
    if (b.result === 'Confirmed match') q.run(`UPDATE parties SET status = 'Blocked' WHERE id = ?`, id)
    syncFindings('parties', id, p.name, ['SANCTIONS'], b.result === 'Clear' ? [] : [{ rule: 'SANCTIONS', severity: b.result === 'Confirmed match' ? 'Blocker' : 'Warning', message: `${p.name} is a ${b.result.toLowerCase()} on sanctions screening${b.note ? ` (${b.note})` : ''}. ${b.result === 'Confirmed match' ? 'Do not deal; freeze and report as required.' : 'Hold transactions until compliance clears or confirms it.'}` }])
    audit(req.ctx, getDef('parties'), id, 'sanctions-screening', { sanctions_status: [p.sanctions_status, b.result] }, `${p.name}${b.note ? ': ' + b.note : ''}`)
    return { ok: true, status: b.result }
  })
}
