import { q } from './db'
import { addDays, nowIso, todayStr } from './util'
import { notify, notifyRole } from './notify'
import { processOutbox } from './mailer'
import { runReport } from './reports'

/** Light-weight in-process scheduler: reminders, expiries and the e-mail outbox. */
export function startScheduler() {
  const tick = () => { try { daily() } catch (e) { console.error('scheduler', e) } }
  setTimeout(tick, 8_000)
  setInterval(tick, 60 * 60 * 1000).unref()
  setInterval(() => { void processOutbox() }, 60 * 1000).unref()
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
  // housekeeping
  q.run(`DELETE FROM sessions WHERE expires_at < ?`, nowIso())
  q.run(`DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < ?`, new Date(Date.now() - 90 * 86400000).toISOString())
}
