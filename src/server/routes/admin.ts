import { validateDocumentSeal } from '../document-seal'
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { db, q, tx } from '../db'
import { dirs, config, BACKUP_EXT, isBackupFile } from '../config'
import { loadSettings, publicSettings, setSettings, SETTING_DEFAULTS, SECRET_SETTINGS } from '../settings'
import { audit, getDef, getRecord, SYSTEM_CTX, createRecord } from '../engine'
import { bad, nowIso, safeJson, todayStr, notFound } from '../util'
import { idOf, need } from './helpers'
import { retryOutbox, verifySmtp, smtpConfigured } from '../mailer'
import { generatePayroll, lastIssued } from '../domain/misc'
import { destroyUserSessions } from '../auth'
import { ENTITY_LIST } from '../../shared/entities'

export default async function (app: FastifyInstance) {
  app.post('/api/workflow-runs/:id/retry',async req=>{
    need(req,'admin','edit')
    const b=z.object({reason:z.string().trim().min(10).max(1000)}).parse(req.body)
    return tx(()=>{
      const id=idOf((req.params as any).id),r=getRecord(getDef('workflow_runs'),id,req.ctx,{children:false})
      if(r.status!=='Failed')throw bad('Only failed internal actions can be retried')
      const payload:any=typeof r.payload==='string'?safeJson(r.payload,{}):r.payload??{}
      const action=payload.rule?.action??''
      if(!['Create follow-up task','Notify user','Queue e-mail to customer contact','Queue e-mail to address','Set field value'].includes(action))throw bad('External outcomes require review and cannot be replayed automatically')
      q.run(`UPDATE workflow_runs SET status='Queued',max_attempts=attempts+3,next_at=?,error=NULL WHERE id=? AND status='Failed'`,nowIso(),id)
      audit(req.ctx,getDef('workflow_runs'),id,'retry_workflow',{reason:b.reason},r._title)
      return {ok:true}
    })
  })
  app.post('/api/workflow-runs/:id/resolve',async req=>{
    need(req,'admin','edit')
    const b=z.object({outcome:z.enum(['Succeeded','Cancelled']),reason:z.string().trim().min(10).max(1000)}).parse(req.body)
    return tx(()=>{
      const id=idOf((req.params as any).id),r=getRecord(getDef('workflow_runs'),id,req.ctx,{children:false})
      if(r.status!=='Needs review')throw bad('Only uncertain runs can be resolved manually')
      q.run(`UPDATE workflow_runs SET status=?,finished_at=? WHERE id=? AND status='Needs review'`,b.outcome,nowIso(),id)
      audit(req.ctx,getDef('workflow_runs'),id,'resolve_workflow',{outcome:b.outcome,reason:b.reason},r._title)
      return {ok:true}
    })
  })

  app.get('/api/admin/settings', async (req) => { need(req, 'admin', 'view'); return publicSettings() })
  app.put('/api/admin/settings', async (req) => {
    need(req, 'admin', 'edit')
    const patch = { ...(req.body as Record<string, any>) }
    for (const k of SECRET_SETTINGS) if (patch[k] === '********') delete patch[k]
    delete patch.mail_accounts; delete patch.supabase_cursors; delete patch.seeded
    const num = ['quote_validity_days', 'min_margin_pct', 'bill_approval_limit', 'payment_approval_limit', 'weight_divisor_air', 'weight_divisor_courier', 'sanctions_review_days', 'free_days_default', 'smtp_port', 'edi_sftp_port']
    for (const k of num) if (k in patch && patch[k] !== '') { const v = Number(patch[k]); if (!Number.isFinite(v) || v < 0) throw bad(`${k} must be a non-negative number`); patch[k] = v }
    if ('company_trn' in patch && patch.company_trn && !/^\d{15}$/.test(String(patch.company_trn).replace(/\s/g, ''))) throw bad('A UAE TRN has 15 digits')
    if ('company_trn' in patch) patch.company_trn = String(patch.company_trn ?? '').replace(/\s/g, '')
    for (const [k, opts] of [['compliance_mode', ['enforce', 'advisory']], ['activity_scope_mode', ['off', 'warn', 'block']], ['vat_filing_frequency', ['Quarterly', 'Monthly']]] as const) if (k in patch && !(opts as readonly string[]).includes(patch[k])) throw bad(`${k} must be one of ${opts.join(', ')}`)
    if ('financial_year_end' in patch && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(patch.financial_year_end)) throw bad('Financial year end must be MM-DD, e.g. 12-31')
    if ('lock_date' in patch && patch.lock_date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.lock_date)) throw bad('Lock date must be YYYY-MM-DD')
    if ('document_seal' in patch) patch.document_seal = validateDocumentSeal(patch.document_seal)
    if ('document_seal_default' in patch && typeof patch.document_seal_default !== 'boolean') throw bad('Document seal default must be true or false')
    const before = publicSettings()
    setSettings(patch)
    const after = publicSettings()
    const changes: Record<string, [any, any]> = {}
    for (const k of Object.keys(patch)) if (k in SETTING_DEFAULTS && JSON.stringify(before[k]) !== JSON.stringify(after[k])) changes[k] = SECRET_SETTINGS.has(k) ? ['***', '***'] : k === 'document_seal' ? [before[k] ? 'Image configured' : 'No image', after[k] ? 'Image configured' : 'No image'] : [before[k], after[k]]
    if (Object.keys(changes).length) audit(req.ctx, getDef('branches'), 0, 'settings', changes, 'Company settings')
    return publicSettings()
  })
  app.post('/api/admin/smtp-test', async (req) => { need(req, 'admin', 'edit'); return verifySmtp() })
  app.post('/api/admin/outbox/retry', async (req) => { need(req, 'admin', 'edit'); retryOutbox(); return { ok: true, smtp: smtpConfigured() } })

  // ---- audit viewer
  app.get('/api/admin/audit', async (req) => {
    need(req, 'admin', 'view')
    const s = req.query as any
    const cl: string[] = []; const a: any[] = []
    if (s.entity) { cl.push('entity = ?'); a.push(String(s.entity)) }
    if (s.user) { cl.push('user_name LIKE ?'); a.push(`%${s.user}%`) }
    if (s.action) { cl.push('action = ?'); a.push(String(s.action)) }
    if (s.q) { cl.push('(record_label LIKE ? OR changes LIKE ?)'); a.push(`%${s.q}%`, `%${s.q}%`) }
    if (s.from) { cl.push('at >= ?'); a.push(String(s.from)) }
    if (s.to) { cl.push('at <= ?'); a.push(String(s.to) + 'T23:59:59') }
    const where = cl.length ? 'WHERE ' + cl.join(' AND ') : ''
    const page = Math.max(1, Number(s.page) || 1), size = Math.min(Number(s.pageSize) || 50, 200)
    const total = q.val<number>(`SELECT COUNT(*) FROM audit_log ${where}`, ...a) ?? 0
    const rows = q.all(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, ...a, size, (page - 1) * size).map(r => ({ ...r, changes: safeJson(r.changes, null) }))
    return { total, page, pageSize: size, rows }
  })
  app.get('/api/admin/login-events', async (req) => { need(req, 'admin', 'view'); return q.all(`SELECT * FROM login_events ORDER BY id DESC LIMIT 200`) })

  // ---- user administration
  app.post('/api/admin/users/:id/unlock', async (req) => { need(req, 'admin', 'edit'); const id = idOf((req.params as any).id); q.run(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?`, id); audit(req.ctx, getDef('users'), id, 'unlock', null, ''); return { ok: true } })
  app.post('/api/admin/users/:id/reset-2fa', async (req) => { need(req, 'admin', 'edit'); const id = idOf((req.params as any).id); q.run(`UPDATE users SET totp_secret = NULL WHERE id = ?`, id); audit(req.ctx, getDef('users'), id, 'reset-2fa', null, ''); return { ok: true } })
  app.post('/api/admin/users/:id/sign-out', async (req) => { need(req, 'admin', 'edit'); const id = idOf((req.params as any).id); destroyUserSessions(id); audit(req.ctx, getDef('users'), id, 'force-signout', null, ''); return { ok: true } })

  // ---- API keys: show the key once at creation
  app.post('/api/admin/api-keys', async (req) => {
    need(req, 'admin', 'create')
    lastIssued.key = undefined
    const rec = createRecord(getDef('api_keys'), req.body as any, req.ctx)
    const key = lastIssued.key; lastIssued.key = undefined
    return { record: rec, key }
  })

  // ---- roles (permission matrix is edited through the generic API; this lists modules)
  app.get('/api/admin/roles', async (req) => {
    need(req, 'admin', 'view')
    return q.all(`SELECT r.id, r.name, r.description, r.is_system, r.permissions, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL) AS users FROM roles r WHERE r.deleted_at IS NULL ORDER BY r.id`).map(r => ({ ...r, permissions: safeJson(r.permissions, {}) }))
  })

  // ---- HR payroll generation
  app.post('/api/hr/payroll/generate', async (req) => {
    need(req, 'hr', 'create')
    const { period } = z.object({ period: z.string() }).parse(req.body)
    return generatePayroll(period, req.ctx)
  })
  app.post('/api/hr/leave/:id/:action', async (req) => {
    need(req, 'hr', 'approve')
    const p = req.params as any
    if (!['approve', 'reject', 'cancel'].includes(p.action)) throw bad('Unknown action')
    const def = getDef('leave_requests')
    const status = p.action === 'approve' ? 'Approved' : p.action === 'reject' ? 'Rejected' : 'Cancelled'
    const r = getRecord(def, idOf(p.id), req.ctx, { children: false })
    if (r.status !== 'Pending' && !(p.action === 'cancel' && r.status === 'Approved')) throw bad(`A ${r.status.toLowerCase()} request cannot be ${status.toLowerCase()}`)
    return (await import('../engine')).patchRecord(def, r.id, { status, approver_id: req.user!.id }, req.ctx)
  })
  app.post('/api/hr/attendance/clock', async (req) => {
    need(req, 'hr', 'view')
    const emp = q.get(`SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL`, req.user!.id)
    if (!emp) throw bad('Your user account is not linked to an employee record')
    const today = todayStr(), now = new Date().toLocaleString('sv-SE', { timeZone: config.timezone }).slice(0, 16).replace(' ', 'T')
    const row = q.get(`SELECT id, check_in, check_out FROM attendance WHERE employee_id = ? AND att_date = ? AND deleted_at IS NULL`, emp.id, today)
    const eng = await import('../engine')
    if (!row) { eng.createRecord(getDef('attendance'), { employee_id: emp.id, att_date: today, check_in: now, status: 'Present' }, SYSTEM_CTX); return { action: 'in', at: now } }
    if (row.check_out) throw bad('Already clocked out today')
    eng.patchRecord(getDef('attendance'), row.id, { check_out: now }, SYSTEM_CTX); return { action: 'out', at: now }
  })

  // ---- system info, stats and backups
  app.get('/api/admin/system', async (req) => {
    need(req, 'admin', 'view')
    const counts: Record<string, number> = {}
    for (const e of ENTITY_LIST) if (!e.child) counts[e.key] = q.val<number>(`SELECT COUNT(*) FROM "${e.key}" WHERE deleted_at IS NULL`) ?? 0
    const size = fs.existsSync(dirs.db) ? fs.statSync(dirs.db).size : 0
    let upl = 0; const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else upl += fs.statSync(p).size } }
    if (fs.existsSync(dirs.uploads)) walk(dirs.uploads)
    return { version: '1.0.0', node: process.version, env: config.env, timezone: config.timezone, db_bytes: size, upload_bytes: upl, smtp: smtpConfigured(), counts, uptime_s: Math.round(process.uptime()) }
  })
  app.get('/api/admin/backups', async (req) => {
    need(req, 'admin', 'view')
    return fs.readdirSync(dirs.backups).filter(isBackupFile).sort().reverse().map(f => ({ name: f, bytes: fs.statSync(path.join(dirs.backups, f)).size, at: fs.statSync(path.join(dirs.backups, f)).mtime.toISOString() }))
  })
  app.post('/api/admin/backups', async (req) => {
    need(req, 'admin', 'edit')
    const name = `elvora-${nowIso().replace(/[:.]/g, '-').slice(0, 19)}${BACKUP_EXT}`
    await db.backup(path.join(dirs.backups, name))
    audit(req.ctx, getDef('branches'), 0, 'backup', { file: [null, name] }, name)
    return { name }
  })
  app.get('/api/admin/backups/:name', async (req, reply) => {
    need(req, 'admin', 'export')
    const name = path.basename(String((req.params as any).name))
    const p = path.join(dirs.backups, name)
    if (!isBackupFile(name) || !fs.existsSync(p)) throw notFound('Backup not found')
    reply.header('content-type', 'application/octet-stream').header('content-disposition', `attachment; filename="${name}"`)
    return reply.send(fs.createReadStream(p))
  })

  void loadSettings
}

