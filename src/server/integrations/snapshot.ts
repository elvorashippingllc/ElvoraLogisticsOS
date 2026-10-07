import { q } from '../db'
import { addDays, todayStr, r2 } from '../util'

const n = (sql: string, ...a: any[]) => Number(q.val<number>(sql, ...a) ?? 0)
const aed = (c: number) => r2(c / 100)
const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 })

export interface Snapshot { text: string; data: Record<string, any> }

/** One compact, factual picture of the business, used by the owner brief, WhatsApp bot and AI agents. */
export function businessSnapshot(): Snapshot {
  const today = todayStr(), mStart = today.slice(0, 8) + '01'
  const SALES = `i.status IN ('Posted','Partially paid','Paid') AND i.doc_type IN ('Tax Invoice','Debit Note','Credit Note') AND i.deleted_at IS NULL`
  const SIGN = `CASE WHEN i.doc_type='Credit Note' THEN -1 ELSE 1 END`
  const d: Record<string, any> = {
    open_jobs: n(`SELECT COUNT(*) FROM jobs WHERE job_status IN ('OPENED','IN PROGRESS','ON HOLD') AND deleted_at IS NULL`),
    jobs_opened_month: n(`SELECT COUNT(*) FROM jobs WHERE job_date >= ? AND deleted_at IS NULL AND job_status <> 'CANCELLED'`, mStart),
    revenue_month_aed: aed(n(`SELECT COALESCE(SUM(${SIGN} * i.subtotal * i.ex_rate),0) FROM invoices i WHERE ${SALES} AND i.invoice_date >= ?`, mStart)),
    ar_outstanding_aed: aed(n(`SELECT COALESCE(SUM(balance * ex_rate),0) FROM invoices WHERE status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND deleted_at IS NULL`)),
    ar_overdue_aed: aed(n(`SELECT COALESCE(SUM(balance * ex_rate),0) FROM invoices WHERE status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND due_date < ? AND deleted_at IS NULL`, today)),
    overdue_invoices: n(`SELECT COUNT(*) FROM invoices WHERE status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND due_date < ? AND deleted_at IS NULL`, today),
    ap_outstanding_aed: aed(n(`SELECT COALESCE(SUM(balance * ex_rate),0) FROM bills WHERE status IN ('Posted','Partially paid') AND balance > 0 AND deleted_at IS NULL`)),
    bills_due_7d: n(`SELECT COUNT(*) FROM bills WHERE status IN ('Posted','Partially paid') AND balance > 0 AND due_date <= ? AND deleted_at IS NULL`, addDays(today, 7)),
    cash_aed: aed(n(`SELECT COALESCE(SUM(l.debit - l.credit),0) FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id WHERE l.deleted_at IS NULL AND e.deleted_at IS NULL AND l.account_id IN (SELECT gl_account_id FROM bank_accounts WHERE deleted_at IS NULL AND active = 1)`)),
    new_leads: n(`SELECT COUNT(*) FROM leads WHERE status = 'New' AND deleted_at IS NULL`),
    quotes_open: n(`SELECT COUNT(*) FROM quotations WHERE status IN ('Draft','Sent','Pending approval','Approved') AND deleted_at IS NULL`),
    open_tickets: n(`SELECT COUNT(*) FROM tickets WHERE status NOT IN ('Resolved','Closed') AND deleted_at IS NULL`),
    overdue_tasks: n(`SELECT COUNT(*) FROM tasks WHERE status <> 'Done' AND due_date < ? AND deleted_at IS NULL`, today),
    unbilled_revenue_aed: aed(n(`SELECT COALESCE(SUM(c.base_amount),0) FROM job_charges c JOIN jobs j ON j.id = c.job_id WHERE c.kind='Revenue' AND c.status='Unbilled' AND c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status <> 'CANCELLED'`)),
    docs_expiring_30d: n(`SELECT COUNT(*) FROM attachments WHERE expiry_date IS NOT NULL AND expiry_date <= ? AND deleted_at IS NULL`, addDays(today, 30)),
  }
  const text = [
    `Elvora brief – ${today}`,
    `Jobs: ${d.open_jobs} open, ${d.jobs_opened_month} opened this month`,
    `Revenue this month: AED ${fmt(d.revenue_month_aed)} | Unbilled work: AED ${fmt(d.unbilled_revenue_aed)}`,
    `Receivable: AED ${fmt(d.ar_outstanding_aed)} (overdue AED ${fmt(d.ar_overdue_aed)} on ${d.overdue_invoices} invoices)`,
    `Payable: AED ${fmt(d.ap_outstanding_aed)} (${d.bills_due_7d} bills due in 7 days) | Cash & bank: AED ${fmt(d.cash_aed)}`,
    `Sales: ${d.new_leads} new leads, ${d.quotes_open} open quotes`,
    `Service: ${d.open_tickets} open tickets, ${d.overdue_tasks} overdue tasks, ${d.docs_expiring_30d} documents expiring in 30 days`,
  ].join('\n')
  return { text, data: d }
}
