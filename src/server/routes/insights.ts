import { calendarEvents } from '../calendar'
import { config } from '../config'
import type { FastifyInstance } from 'fastify'
import { q } from '../db'
import { ENTITIES } from '../../shared/entities'
import { can, getDef, listRecords, labelsFor } from '../engine'
import { addDays, bad, daysBetween, fromCents, monthStart, r2, todayStr, toCsv, nowIso } from '../util'
import { idOf, need } from './helpers'
import { reportCatalog, runReport, REPORTS } from '../reports'
import { getSetting } from '../settings'
import { z } from 'zod'

const SIGN = `CASE WHEN i.doc_type = 'Credit Note' THEN -1 ELSE 1 END`
const SALES = `i.status IN ('Posted','Partially paid','Paid') AND i.doc_type IN ('Tax Invoice','Debit Note','Credit Note') AND i.deleted_at IS NULL`
const m = fromCents

export default async function (app: FastifyInstance) {
  // ------------------------------------------------------------------ dashboard
  app.get('/api/dashboard', async (req) => {
    const user = req.user!
    const today = todayStr(), mStart = monthStart(), n = (sql: string, ...a: any[]) => q.val<number>(sql, ...a) ?? 0

    if (user.party_id) {
      const pid = user.party_id
      return {
        portal: true,
        kpis: { open_jobs: n(`SELECT COUNT(*) FROM jobs WHERE client_id = ? AND job_status IN ('OPENED','IN PROGRESS','ON HOLD') AND deleted_at IS NULL`, pid), delivered: n(`SELECT COUNT(*) FROM jobs WHERE client_id = ? AND job_status IN ('DELIVERED','CLOSED') AND deleted_at IS NULL`, pid), outstanding: m(n(`SELECT COALESCE(SUM(balance * ex_rate),0) FROM invoices WHERE party_id = ? AND status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND deleted_at IS NULL`, pid)) },
        recent_jobs: q.all(`SELECT j.id, j.job_no, j.job_status, j.operational_status, pol.code pol, pod.code pod, j.etd, j.eta FROM jobs j LEFT JOIN locations pol ON pol.id = j.pol_id LEFT JOIN locations pod ON pod.id = j.pod_id WHERE j.client_id = ? AND j.deleted_at IS NULL ORDER BY j.id DESC LIMIT 10`, pid),
      }
    }

    const can_ = (mod: string) => can(user, mod, 'view')
    const data: any = { portal: false, kpis: {}, charts: {}, lists: {}, alerts: [] }
    const k = data.kpis

    if (can_('jobs')) {
      k.open_jobs = n(`SELECT COUNT(*) FROM jobs WHERE job_status IN ('OPENED','IN PROGRESS','ON HOLD') AND deleted_at IS NULL`)
      k.in_transit = n(`SELECT COUNT(*) FROM jobs WHERE operational_status IN ('DEPARTED','IN TRANSIT') AND job_status NOT IN ('CLOSED','CANCELLED') AND deleted_at IS NULL`)
      k.jobs_month = n(`SELECT COUNT(*) FROM jobs WHERE job_date BETWEEN ? AND ? AND deleted_at IS NULL AND job_status <> 'CANCELLED'`, mStart, today)
      if (can_('finance')) {
        k.profit_month = m(n(`SELECT COALESCE(SUM(profit),0) FROM jobs WHERE job_date BETWEEN ? AND ? AND deleted_at IS NULL AND job_status <> 'CANCELLED'`, mStart, today))
        k.unbilled = m(n(`SELECT COALESCE(SUM(c.base_amount),0) FROM job_charges c JOIN jobs j ON j.id = c.job_id WHERE c.kind='Revenue' AND c.status='Unbilled' AND c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status <> 'CANCELLED'`))
      }
      data.lists.recent_jobs = q.all(`SELECT j.id, j.job_no, j.job_status, j.operational_status, pr.name client, pol.code pol, pod.code pod, j.etd, j.job_date FROM jobs j LEFT JOIN parties pr ON pr.id = j.client_id LEFT JOIN locations pol ON pol.id = j.pol_id LEFT JOIN locations pod ON pod.id = j.pod_id WHERE j.deleted_at IS NULL ORDER BY j.id DESC LIMIT 12`)
      data.lists.recent_shipments = q.all(`SELECT s.id, s.shipment_no, s.status, s.hbl_no, sh.name shipper, cn.name consignee, j.job_no, s.commodity FROM shipments s JOIN jobs j ON j.id = s.job_id LEFT JOIN parties sh ON sh.id = s.shipper_id LEFT JOIN parties cn ON cn.id = s.consignee_id WHERE s.deleted_at IS NULL ORDER BY s.id DESC LIMIT 12`)
      data.lists.departures = q.all(`SELECT j.id, j.job_no, pr.name client, pol.code pol, pod.code pod, j.etd, j.department FROM jobs j LEFT JOIN parties pr ON pr.id = j.client_id LEFT JOIN locations pol ON pol.id = j.pol_id LEFT JOIN locations pod ON pod.id = j.pod_id WHERE j.deleted_at IS NULL AND j.atd IS NULL AND j.job_status NOT IN ('CLOSED','CANCELLED') AND substr(j.etd,1,10) BETWEEN ? AND ? ORDER BY j.etd LIMIT 10`, today, addDays(today, 7))
      data.lists.arrivals = q.all(`SELECT j.id, j.job_no, pr.name client, pol.code pol, pod.code pod, j.eta, j.department FROM jobs j LEFT JOIN parties pr ON pr.id = j.client_id LEFT JOIN locations pol ON pol.id = j.pol_id LEFT JOIN locations pod ON pod.id = j.pod_id WHERE j.deleted_at IS NULL AND j.ata IS NULL AND j.job_status NOT IN ('CLOSED','CANCELLED') AND substr(j.eta,1,10) BETWEEN ? AND ? ORDER BY j.eta LIMIT 10`, today, addDays(today, 7))
      data.charts.jobs_by_mode = q.all(`SELECT COALESCE(mode,'Other') name, COUNT(*) value FROM jobs WHERE deleted_at IS NULL AND job_status IN ('OPENED','IN PROGRESS','ON HOLD') GROUP BY mode`)
      data.charts.jobs_by_status = q.all(`SELECT job_status name, COUNT(*) value FROM jobs WHERE deleted_at IS NULL GROUP BY job_status`)
      if (can_('finance')) {
        data.charts.top_customers = q.all(`SELECT pr.name, SUM(j.total_revenue) v FROM jobs j JOIN parties pr ON pr.id = j.client_id WHERE j.deleted_at IS NULL AND j.job_status <> 'CANCELLED' AND j.job_date BETWEEN ? AND ? GROUP BY j.client_id, pr.name ORDER BY v DESC LIMIT 6`, addDays(today, -90), today).map(r => ({ name: r.name, value: m(r.v) }))
        data.charts.revenue_trend = (() => {
          const rows = q.all(`SELECT substr(job_date,1,7) AS month, SUM(total_revenue) rev, SUM(total_cost) cost, SUM(profit) profit FROM jobs WHERE deleted_at IS NULL AND job_status <> 'CANCELLED' AND job_date BETWEEN ? AND ? GROUP BY month ORDER BY month`, addDays(monthStart(), -150), today)
          return rows.map(r => ({ month: r.month, revenue: m(r.rev), cost: m(r.cost), profit: m(r.profit) }))
        })()
        // "Sales (Branch)": invoiced vs unbilled work per branch for the current month
        const inv = q.all(`SELECT COALESCE(b.name,'Unassigned') branch, SUM(${SIGN} * i.subtotal * i.ex_rate) v FROM invoices i LEFT JOIN branches b ON b.id = i.branch_id WHERE ${SALES} AND i.invoice_date BETWEEN ? AND ? GROUP BY i.branch_id, b.name`, mStart, today)
        const unb = q.all(`SELECT COALESCE(b.name,'Unassigned') branch, SUM(c.base_amount) v FROM job_charges c JOIN jobs j ON j.id = c.job_id LEFT JOIN branches b ON b.id = j.branch_id WHERE c.kind='Revenue' AND c.status='Unbilled' AND c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status <> 'CANCELLED' GROUP BY j.branch_id, b.name`)
        const names = [...new Set([...inv.map(x => x.branch), ...unb.map(x => x.branch)])]
        data.charts.sales_branch = names.map(name => ({ branch: name, invoiced: m(Math.round(inv.find(x => x.branch === name)?.v ?? 0)), unbilled: m(Math.round(unb.find(x => x.branch === name)?.v ?? 0)) }))
      }
    }
    if (can_('finance')) {
      k.revenue_month = m(Math.round(n(`SELECT COALESCE(SUM(${SIGN} * i.subtotal * i.ex_rate),0) FROM invoices i WHERE ${SALES} AND i.invoice_date BETWEEN ? AND ?`, mStart, today)))
      k.ar_outstanding = m(Math.round(n(`SELECT COALESCE(SUM(CASE WHEN doc_type='Credit Note' THEN -(total - paid_amount) ELSE balance END * ex_rate),0) FROM invoices WHERE status IN ('Posted','Partially paid','Paid') AND doc_type IN ('Tax Invoice','Debit Note','Credit Note') AND deleted_at IS NULL AND ((doc_type <> 'Credit Note' AND balance > 0) OR (doc_type = 'Credit Note' AND total > paid_amount))`)))
      k.ar_overdue = m(Math.round(n(`SELECT COALESCE(SUM(balance * ex_rate),0) FROM invoices WHERE status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND due_date < ? AND deleted_at IS NULL`, today)))
      k.ap_outstanding = m(Math.round(n(`SELECT COALESCE(SUM(balance * ex_rate),0) FROM bills WHERE status IN ('Posted','Partially paid') AND balance > 0 AND deleted_at IS NULL`)))
      k.cash = m(n(`SELECT COALESCE(SUM(l.debit - l.credit),0) FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id WHERE l.deleted_at IS NULL AND e.deleted_at IS NULL AND l.account_id IN (SELECT gl_account_id FROM bank_accounts WHERE deleted_at IS NULL AND active = 1)`))
      const ar = runReport('ar_aging', {})
      data.charts.ar_aging = [{ name: 'Not due', value: ar.totals?.current ?? 0 }, { name: '1–30', value: ar.totals?.d30 ?? 0 }, { name: '31–60', value: ar.totals?.d60 ?? 0 }, { name: '61–90', value: ar.totals?.d90 ?? 0 }, { name: '90+', value: ar.totals?.d90p ?? 0 }]
    }
    if (can_('crm')) {
      k.leads_new = n(`SELECT COUNT(*) FROM leads WHERE status = 'New' AND deleted_at IS NULL`)
      k.pipeline = m(n(`SELECT COALESCE(SUM(value),0) FROM opportunities WHERE stage NOT IN ('Won','Lost') AND deleted_at IS NULL`))
      data.lists.recent_calls = q.all(`SELECT a.id, a.subject, a.start_at, a.direction, a.outcome, a.contact_name, a.phone, pr.name company, u.name owner FROM activities a LEFT JOIN parties pr ON pr.id = a.party_id LEFT JOIN users u ON u.id = a.owner_id WHERE a.type = 'Call' AND a.deleted_at IS NULL ORDER BY a.start_at DESC LIMIT 12`)
    }
    if (can_('sales')) k.quotes_open = n(`SELECT COUNT(*) FROM quotations WHERE status IN ('Draft','Pending approval','Approved','Sent') AND deleted_at IS NULL`)
    if (can_('support')) k.tickets_open = n(`SELECT COUNT(*) FROM tickets WHERE status NOT IN ('Resolved','Closed') AND deleted_at IS NULL`)
    if (can_('projects')) {
      k.my_tasks = n(`SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND status <> 'Done' AND deleted_at IS NULL`, user.id)
      data.lists.my_tasks = q.all(`SELECT id, title, due_date, priority, status, link_label, link_entity, link_id FROM tasks WHERE assignee_id = ? AND status <> 'Done' AND deleted_at IS NULL ORDER BY due_date IS NULL, due_date LIMIT 8`, user.id)
    }
    if (can_('warehouse')) {
      k.low_stock = n(`SELECT COUNT(*) FROM (SELECT i.id FROM items i LEFT JOIN stock_moves s ON s.item_id = i.id AND s.deleted_at IS NULL WHERE i.deleted_at IS NULL AND i.min_stock > 0 GROUP BY i.id HAVING COALESCE(SUM(s.qty),0) < i.min_stock)`)
    }

    // alerts
    const a = data.alerts as { level: 'danger' | 'warn' | 'info'; text: string; link: string }[]
    if (can_('projects')) { const o = n(`SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND status <> 'Done' AND due_date < ? AND deleted_at IS NULL`, user.id, today); if (o) a.push({ level: 'danger', text: `${o} of your tasks are overdue`, link: '/e/tasks' }) }
    if (can_('finance') && can_('reports') && k.ar_overdue > 0) a.push({ level: 'warn', text: `Overdue receivables: AED ${k.ar_overdue.toLocaleString()}`, link: '/reports?r=ar_aging' })
    if (can_('finance')) { const bills = n(`SELECT COUNT(*) FROM bills WHERE status IN ('Posted','Partially paid') AND balance > 0 AND due_date <= ? AND deleted_at IS NULL`, addDays(today, 7)); if (bills) a.push({ level: 'warn', text: `${bills} vendor bills due within 7 days`, link: '/e/bills' }) }
    if (can_('jobs')) {
      const u = n(`SELECT COUNT(DISTINCT c.job_id) FROM job_charges c JOIN jobs j ON j.id = c.job_id WHERE c.kind='Revenue' AND c.status='Unbilled' AND j.job_status IN ('DELIVERED','CLOSED') AND c.deleted_at IS NULL AND j.deleted_at IS NULL`); if (u && can_('finance') && can_('reports')) a.push({ level: 'warn', text: `${u} delivered jobs still have unbilled revenue`, link: '/reports?r=unbilled_charges' })
      const f = n(`SELECT COUNT(*) FROM job_containers c JOIN jobs j ON j.id = c.job_id WHERE c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status NOT IN ('CLOSED','CANCELLED') AND c.status <> 'Empty returned' AND c.free_time_until IS NOT NULL AND c.free_time_until <= ?`, addDays(today, 3)); if (f && can_('reports')) a.push({ level: 'danger', text: `${f} containers reach end of free time within 3 days`, link: '/reports?r=container_status' })
    }
    if (can_('sales')) { const x = n(`SELECT COUNT(*) FROM quotations WHERE status = 'Sent' AND valid_until BETWEEN ? AND ? AND deleted_at IS NULL`, today, addDays(today, 3)); if (x) a.push({ level: 'info', text: `${x} sent quotations expire within 3 days`, link: '/e/quotations' }); const pa = n(`SELECT COUNT(*) FROM quotations WHERE approval_status = 'Pending' AND deleted_at IS NULL`); if (pa) a.push({ level: 'warn', text: `${pa} quotations awaiting margin approval`, link: '/e/quotations' }) }
    if (can_('reports')) { const dx = runReport('document_expiries', { days: 30 }).rows.length; if (dx) a.push({ level: 'warn', text: `${dx} documents expire within 30 days`, link: '/reports?r=document_expiries' }) }
    if (can_('support')) { const t = n(`SELECT COUNT(*) FROM tickets WHERE status NOT IN ('Resolved','Closed') AND due_at < ? AND deleted_at IS NULL`, nowIso().slice(0, 16)); if (t) a.push({ level: 'danger', text: `${t} tickets are past their SLA`, link: '/e/tickets' }) }
    if (can_('warehouse') && k.low_stock) a.push({ level: 'warn', text: `${k.low_stock} items below minimum stock`, link: '/warehouse/stock?low=1' })
    return data
  })

  // ------------------------------------------------------------------ global search
  app.get('/api/search/global', async (req) => {
    const term = String((req.query as any).q ?? '').trim()
    if (term.length < 2) return []
    const user = req.user!
    if (user.party_id) return []
    const pat = `%${term.replace(/[\\%_]/g, c => '\\' + c)}%`
    const specs: { entity: string; cols: string[]; module: string; group: string }[] = [
      { entity: 'jobs', cols: ['job_no', 'mbl_no', 'hbl_no', 'booking_no', 'customer_ref', 'sb_no', 'boe_no', 'do_no'], module: 'jobs', group: 'Jobs' },
      { entity: 'shipments', cols: ['shipment_no', 'hbl_no'], module: 'jobs', group: 'Shipments' },
      { entity: 'parties', cols: ['name', 'code', 'trn', 'email'], module: 'crm', group: 'Customers & parties' },
      { entity: 'contacts', cols: ['name', 'email', 'phone', 'mobile'], module: 'crm', group: 'Contacts' },
      { entity: 'leads', cols: ['company', 'lead_no', 'contact_name', 'email'], module: 'crm', group: 'Leads' },
      { entity: 'opportunities', cols: ['title', 'opp_no'], module: 'crm', group: 'Opportunities' },
      { entity: 'quotations', cols: ['quote_no'], module: 'sales', group: 'Quotations' },
      { entity: 'invoices', cols: ['invoice_no', 'reference'], module: 'finance', group: 'Invoices' },
      { entity: 'bills', cols: ['bill_no', 'vendor_invoice_no'], module: 'finance', group: 'Vendor bills' },
      { entity: 'bookings', cols: ['booking_no'], module: 'jobs', group: 'Bookings' },
      { entity: 'customs_declarations', cols: ['declaration_no', 'ref_no'], module: 'customs', group: 'Customs' },
      { entity: 'items', cols: ['sku', 'name', 'barcode'], module: 'warehouse', group: 'Items' },
      { entity: 'tickets', cols: ['ticket_no', 'subject'], module: 'support', group: 'Tickets' },
      { entity: 'employees', cols: ['name', 'emp_no'], module: 'hr', group: 'Employees' },
      { entity: 'vehicles', cols: ['plate_no'], module: 'transport', group: 'Vehicles' },
      { entity: 'announcements', cols: ['title'], module: 'documents', group: 'Blog' },
    ]
    const out: any[] = []
    for (const s of specs) {
      if (!can(user, s.module, 'view')) continue
      const def = ENTITIES[s.entity]
      const rows = q.all(`SELECT id FROM "${s.entity}" WHERE deleted_at IS NULL AND (${s.cols.map(c => `"${c}" LIKE ? ESCAPE '\\'`).join(' OR ')}) ORDER BY id DESC LIMIT 5`, ...s.cols.map(() => pat))
      if (!rows.length) continue
      const labels = labelsFor(s.entity, rows.map(r => r.id))
      for (const r of rows) out.push({ group: s.group, id: r.id, entity: s.entity, label: labels.get(r.id) ?? `#${r.id}`, link: s.entity === 'jobs' ? `/jobs/${r.id}` : `/e/${s.entity}/${r.id}`, icon: def.icon })
    }
    if (can(user, 'jobs', 'view')) {
      for (const c of q.all(`SELECT c.container_no, c.job_id, j.job_no FROM job_containers c JOIN jobs j ON j.id = c.job_id WHERE c.deleted_at IS NULL AND j.deleted_at IS NULL AND c.container_no LIKE ? ESCAPE '\\' LIMIT 5`, pat)) out.push({ group: 'Containers', id: c.job_id, entity: 'jobs', label: `${c.container_no} · job ${c.job_no}`, link: `/jobs/${c.job_id}`, icon: 'Container' })
    }
    return out
  })

  // ------------------------------------------------------------------ calendar
  app.get('/api/calendar/context', async (req) => {
    need(req, 'dashboard', 'view')
    return { today: todayStr(), timezone: config.timezone }
  })
  app.get('/api/calendar', async (req) => {
    need(req, 'dashboard', 'view')
    const range = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).parse(req.query)
    const from = range.from ?? monthStart(), to = range.to ?? addDays(from, 41)
    if (to < from || daysBetween(from, to) > 93) throw bad('Choose a calendar range of up to 94 days.')
    return calendarEvents(from, to, req.ctx)
  })

  // ------------------------------------------------------------------ notifications
  app.get('/api/notifications', async (req) => {
    const rows = q.all(`SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60`, req.user!.id)
    return { unread: q.val<number>(`SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL`, req.user!.id) ?? 0, rows }
  })
  app.post('/api/notifications/read', async (req) => {
    const b = z.object({ ids: z.array(z.number().int()).optional(), all: z.boolean().optional() }).parse(req.body ?? {})
    if (b.all) q.run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, nowIso(), req.user!.id)
    else if (b.ids?.length) q.run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${b.ids.map(() => '?').join(',')})`, nowIso(), req.user!.id, ...b.ids)
    return { ok: true }
  })

  // ------------------------------------------------------------------ reports
  app.get('/api/reports', async (req) => {
    need(req, 'dashboard', 'view')
    return reportCatalog(mod => can(req.user, mod, 'view') && !req.user!.party_id)
  })
  app.get('/api/reports/:key', async (req, reply) => {
    const key = String((req.params as any).key)
    const def = REPORTS.find(r => r.key === key)
    if (!def) throw bad('Unknown report')
    if (req.user!.party_id) throw bad('Reports are not available for portal users')
    need(req, def.module, 'view')
    const { format, ...params } = req.query as Record<string, any>
    const res = runReport(key, params)
    if (format === 'csv') {
      need(req, def.module, 'export')
      reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="${key}-${todayStr()}.csv"`)
      return toCsv(res.columns.map(c => c.label), res.rows.map(r => res.columns.map(c => r[c.key])).concat(res.totals ? [res.columns.map((c, i) => (i === 0 ? 'Total' : res.totals![c.key] ?? ''))] : []))
    }
    return res
  })

  // ------------------------------------------------------------------ KPI board
  app.get('/api/kpi', async (req) => {
    need(req, 'reports', 'view')
    const today = todayStr(), d90 = addDays(today, -90), mStart = monthStart()
    const n = (sql: string, ...a: any[]) => q.val<number>(sql, ...a) ?? 0
    const pct = (a: number, b: number) => (b ? r2((a / b) * 100) : null)
    const sales90 = m(Math.round(n(`SELECT COALESCE(SUM(${SIGN} * i.subtotal * i.ex_rate),0) FROM invoices i WHERE ${SALES} AND i.invoice_date BETWEEN ? AND ?`, d90, today)))
    const ar = m(Math.round(n(`SELECT COALESCE(SUM(balance * ex_rate),0) FROM invoices WHERE status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND deleted_at IS NULL`)))
    const jobs = q.all(`SELECT etd, atd, eta, ata, job_date, closed_at, total_revenue, profit FROM jobs WHERE deleted_at IS NULL AND job_status <> 'CANCELLED' AND job_date >= ?`, d90)
    const dep = jobs.filter(j => j.etd && j.atd), arr = jobs.filter(j => j.eta && j.ata)
    const depOk = dep.filter(j => Date.parse(j.atd) - Date.parse(j.etd) <= 86400000).length, arrOk = arr.filter(j => Date.parse(j.ata) - Date.parse(j.eta) <= 86400000).length
    const transit = jobs.filter(j => j.atd && j.ata).map(j => daysBetween(j.atd, j.ata))
    const cycle = jobs.filter(j => j.closed_at).map(j => daysBetween(j.job_date, j.closed_at))
    const rev = jobs.reduce((s, j) => s + j.total_revenue, 0), prof = jobs.reduce((s, j) => s + j.profit, 0)
    const quotes = n(`SELECT COUNT(*) FROM quotations WHERE deleted_at IS NULL AND quote_date >= ? AND status <> 'Draft'`, d90), won = n(`SELECT COUNT(*) FROM quotations WHERE deleted_at IS NULL AND quote_date >= ? AND status IN ('Accepted','Converted to job')`, d90)
    const leads = n(`SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND substr(created_at,1,10) >= ?`, d90), conv = n(`SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND status = 'Converted' AND substr(created_at,1,10) >= ?`, d90)
    const tix = n(`SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL AND status IN ('Resolved','Closed') AND substr(created_at,1,10) >= ?`, d90), tixOk = n(`SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL AND status IN ('Resolved','Closed') AND resolved_at <= due_at AND substr(created_at,1,10) >= ?`, d90)
    const avg = (a: number[]) => (a.length ? r2(a.reduce((s, x) => s + x, 0) / a.length) : null)
    const minMargin = Number(getSetting('min_margin_pct')) || 0
    const mk = (key: string, label: string, value: number | null, unit: string, target: number | null, higherBetter = true, hint = '') => ({ key, label, value, unit, target, hint, status: value === null || target === null ? 'n/a' : (higherBetter ? value >= target : value <= target) ? 'good' : 'bad' })
    return {
      period: `Last 90 days (to ${today})`,
      kpis: [
        mk('ontime_dep', 'On-time departure', pct(depOk, dep.length), '%', 90, true, `${dep.length} jobs tracked`),
        mk('ontime_arr', 'On-time arrival', pct(arrOk, arr.length), '%', 85, true, `${arr.length} jobs tracked`),
        mk('transit', 'Average transit time', avg(transit), 'days', null, false),
        mk('cycle', 'Average job cycle (open → closed)', avg(cycle), 'days', 30, false),
        mk('margin', 'Gross margin on jobs', pct(prof, rev), '%', minMargin || null, true),
        mk('dso', 'Days sales outstanding', sales90 > 0 ? r2(ar / (sales90 / 90)) : null, 'days', 45, false, `AR ${ar.toLocaleString()} / daily sales`),
        mk('unbilled', 'Unbilled revenue charges', m(Math.round(n(`SELECT COALESCE(SUM(c.base_amount),0) FROM job_charges c JOIN jobs j ON j.id = c.job_id WHERE c.kind='Revenue' AND c.status='Unbilled' AND c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status <> 'CANCELLED'`))), 'AED', 0, false),
        mk('quote_conv', 'Quotation conversion', pct(won, quotes), '%', 30, true, `${won} of ${quotes} quotes`),
        mk('lead_conv', 'Lead conversion', pct(conv, leads), '%', 15, true, `${conv} of ${leads} leads`),
        mk('ticket_sla', 'Tickets resolved within SLA', pct(tixOk, tix), '%', 90, true, `${tix} resolved`),
        mk('revenue_mtd', 'Revenue this month (ex-VAT)', m(Math.round(n(`SELECT COALESCE(SUM(${SIGN} * i.subtotal * i.ex_rate),0) FROM invoices i WHERE ${SALES} AND i.invoice_date BETWEEN ? AND ?`, mStart, today))), 'AED', null, true),
        mk('collections_mtd', 'Collections this month', m(Math.round(n(`SELECT COALESCE(SUM(amount * ex_rate),0) FROM receipts WHERE status = 'Posted' AND receipt_date BETWEEN ? AND ? AND deleted_at IS NULL`, mStart, today))), 'AED', null, true),
      ],
    }
  })
  void idOf; void getDef; void listRecords
}
