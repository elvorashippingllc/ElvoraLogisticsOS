import { q } from './db'
import { addDays, nowIso, todayStr } from './util'
import { notify, notifyRole } from './notify'
import { processOutbox } from './mailer'
import { runReport } from './reports'
import { getSetting } from './settings'
import { complianceDaily } from './domain/compliance'
import { nowLocal } from './util'

/** Light-weight in-process scheduler: reminders, expiries and the e-mail outbox. */
export function startScheduler() {
  const tick = () => { try { daily() } catch (e) { console.error('scheduler', e) } }
  setTimeout(tick, 8_000)
  setInterval(tick, 60 * 60 * 1000).unref()
  setInterval(() => { void processOutbox() }, 60 * 1000).unref()
  setInterval(() => { void periodic() }, 5 * 60 * 1000).unref()
  setTimeout(() => { void periodic() }, 20_000)
}

const done = new Map<string, string>()
const once = (key: string, stamp: string) => { if (done.get(key) === stamp) return false; done.set(key, stamp); return true }

/** Every 5 minutes: time-of-day automations, AI employees, replication and nightly backup. */
async function periodic() {
  const now = nowLocal(), hhmm = now.slice(11, 16), day = now.slice(0, 10)
  const safe = async (name: string, fn: () => Promise<unknown>) => { try { await fn() } catch (e) { console.error('periodic', name, e) } }
  if (getSetting('supabase_sync') && once('sb', now.slice(0, 15))) await safe('supabase', async () => (await import('./integrations/supabase')).syncToSupabase())
  if (once('ai', now.slice(0, 13))) await safe('agents', async () => (await import('./ai/agents')).runDueAgents())
  if (hhmm >= '03:00' && hhmm < '05:00' && once('demo-rebuild', day)) await safe('demo', async () => (await import('./demo/workspace')).rebuildDemoWorkspace())
  if (hhmm >= '07:30' && once('wa-report', day)) await safe('wa-report', async () => (await import('./integrations/whatsapp')).ownerDailyReport())
  if (hhmm >= '10:00' && once('wa-overdue', day)) await safe('wa-overdue', async () => (await import('./integrations/whatsapp')).overdueReminders())
  if (hhmm >= '02:00' && hhmm < '05:00' && getSetting('r2_backup_nightly') && once('r2-backup', day)) await safe('r2-backup', async () => {
    const r = await import('./routes/integrations'); const name = await r.backupToR2(); const { logIntegration } = await import('./integrations/log'); logIntegration('backup', 'nightly', true, `Backup ${name} created${getSetting('r2_account_id') ? ' and uploaded to R2' : ''}`)
    const fs = await import('node:fs'), path = await import('node:path'), { dirs, isBackupFile } = await import('./config')
    for (const f of fs.readdirSync(dirs.backups).filter(isBackupFile).sort().slice(0, -14)) fs.rmSync(path.join(dirs.backups, f), { force: true })
  })
}

export function daily() {
  const today = todayStr()
  // quotations past validity
  q.run(`UPDATE quotations SET status = 'Expired' WHERE status = 'Sent' AND valid_until < ? AND deleted_at IS NULL`, today)
  // contracts past end date
  q.run(`UPDATE contracts SET status = 'Expired' WHERE status = 'Active' AND end_date < ? AND deleted_at IS NULL`, today)
  // rate cards past validity
  q.run(`UPDATE rate_cards SET status = 'Expired' WHERE status = 'Active' AND valid_to < ? AND deleted_at IS NULL`, today)
  // task reminders
  for (const t of q.all(`SELECT id, title, assignee_id, due_date FROM tasks WHERE status <> 'Done' AND deleted_at IS NULL AND assignee_id IS NOT NULL AND due_date <= ?`, today))
    notify(t.assignee_id, t.due_date < today ? `Overdue: ${t.title}` : `Due today: ${t.title}`, `Due ${t.due_date}`, `/e/tasks/${t.id}`, 'task', `task-${t.id}-${today}`)
  // payment due reminders to accounts
  const due = q.val<number>(`SELECT COUNT(*) FROM invoices WHERE status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND due_date < ? AND deleted_at IS NULL`, today) ?? 0
  if (due) notifyRole('finance', `${due} invoices are overdue`, 'Review the receivables ageing report', '/reports?r=ar_aging', 'info', `overdue-${today}`)
  // expiring documents (30 days) – once a week
  if (new Date().getDay() === 1) {
    const rows = runReport('document_expiries', { days: 30 }).rows
    if (rows.length) notifyRole('reports', `${rows.length} documents expire within 30 days`, rows.slice(0, 3).map((r: any) => `${r.record}: ${r.document}`).join('; '), '/reports?r=document_expiries', 'info', `docs-${today}`)
  }
  // free-time risk
  const ft = q.all(`SELECT c.container_no, j.id job_id, j.job_no, j.operator_id, c.free_time_until FROM job_containers c JOIN jobs j ON j.id = c.job_id WHERE c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status NOT IN ('CLOSED','CANCELLED') AND c.status <> 'Empty returned' AND c.free_time_until IS NOT NULL AND c.free_time_until <= ?`, addDays(today, 2))
  for (const c of ft) notify(c.operator_id, `Free time ending: ${c.container_no}`, `Job ${c.job_no} – free time until ${c.free_time_until}`, `/jobs/${c.job_id}`, 'alert', `ft-${c.container_no}-${today}`)
  try { complianceDaily() } catch (e) { console.error('compliance', e) }
  // housekeeping
  q.run(`DELETE FROM sessions WHERE expires_at < ?`, nowIso())
  q.run(`DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < ?`, new Date(Date.now() - 90 * 86400000).toISOString())
}
