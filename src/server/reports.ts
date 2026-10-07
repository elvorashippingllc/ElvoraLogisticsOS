import { q } from './db'
import { fromCents, r2, todayStr, addDays, yearStart, monthStart, daysBetween, bad } from './util'
import { getSetting } from './settings'

export type ColType = 'text' | 'money' | 'number' | 'date' | 'percent' | 'datetime'
export interface Col { key: string; label: string; type?: ColType; align?: 'left' | 'right' }
export interface ParamDef { name: string; label: string; type: 'date' | 'ref' | 'select' | 'text' | 'number'; ref?: string; options?: string[]; default?: string }
export interface ReportResult { title: string; columns: Col[]; rows: Record<string, any>[]; totals?: Record<string, any>; note?: string; layout?: 'table' | 'statement' }
export interface ReportDef { key: string; label: string; group: string; module: string; description: string; params: ParamDef[]; run: (p: Record<string, any>) => ReportResult }

const D = (name: string, label: string, def?: string): ParamDef => ({ name, label, type: 'date', default: def })
const FROM_TO = [D('from', 'From', 'monthStart'), D('to', 'To', 'today')]
const m = fromCents
const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v))
const sumKeys = (rows: any[], keys: string[]) => Object.fromEntries(keys.map(k => [k, r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0))]))
const range = (p: Record<string, any>) => ({ from: String(p.from || yearStart()), to: String(p.to || todayStr()) })

function filterSql(p: Record<string, any>, map: Record<string, string>): { sql: string; args: any[] } {
  const cl: string[] = [], args: any[] = []
  for (const [k, col] of Object.entries(map)) if (p[k] !== undefined && p[k] !== '' && p[k] !== null) { cl.push(`${col} = ?`); args.push(/_id$/.test(k) ? Number(p[k]) : p[k]) }
  return { sql: cl.length ? ' AND ' + cl.join(' AND ') : '', args }
}

const SALES_STATUS = `i.status IN ('Posted','Partially paid','Paid') AND i.doc_type IN ('Tax Invoice','Debit Note','Credit Note') AND i.deleted_at IS NULL`
const SIGN = `CASE WHEN i.doc_type = 'Credit Note' THEN -1 ELSE 1 END`

export const REPORTS: ReportDef[] = [
  // ---------------------------------------------------------------- operations
  {
    key: 'job_register', label: 'Job register', group: 'Operations', module: 'jobs', description: 'All master jobs with route, dates and result.',
    params: [...FROM_TO, { name: 'branch_id', label: 'Branch', type: 'ref', ref: 'branches' }, { name: 'client_id', label: 'Client', type: 'ref', ref: 'parties' }, { name: 'job_status', label: 'Status', type: 'select', options: ['OPENED', 'IN PROGRESS', 'ON HOLD', 'DELIVERED', 'CLOSED', 'CANCELLED'] }, { name: 'department', label: 'Department', type: 'text' }],
    run: p => {
      const { from, to } = range(p); const f = filterSql(p, { branch_id: 'j.branch_id', client_id: 'j.client_id', job_status: 'j.job_status', department: 'j.department' })
      const rows = q.all(`SELECT j.job_no, j.job_date, pr.name AS client, j.department, b.code AS branch, j.job_status, j.mbl_no, j.hbl_no, pol.code AS pol, pod.code AS pod, j.etd, j.eta, j.total_revenue, j.total_cost, j.profit
        FROM jobs j LEFT JOIN parties pr ON pr.id = j.client_id LEFT JOIN branches b ON b.id = j.branch_id LEFT JOIN locations pol ON pol.id = j.pol_id LEFT JOIN locations pod ON pod.id = j.pod_id
        WHERE j.deleted_at IS NULL AND j.job_date BETWEEN ? AND ? ${f.sql} ORDER BY j.job_date DESC, j.id DESC`, from, to, ...f.args).map(r => ({ ...r, total_revenue: m(r.total_revenue), total_cost: m(r.total_cost), profit: m(r.profit) }))
      return { title: 'Job register', columns: [{ key: 'job_no', label: 'Job No' }, { key: 'job_date', label: 'Date', type: 'date' }, { key: 'client', label: 'Client' }, { key: 'department', label: 'Department' }, { key: 'branch', label: 'Br.' }, { key: 'job_status', label: 'Status' }, { key: 'mbl_no', label: 'MBL / AWB' }, { key: 'hbl_no', label: 'HBL' }, { key: 'pol', label: 'POL' }, { key: 'pod', label: 'POD' }, { key: 'etd', label: 'ETD', type: 'datetime' }, { key: 'eta', label: 'ETA', type: 'datetime' }, { key: 'total_revenue', label: 'Revenue', type: 'money' }, { key: 'total_cost', label: 'Cost', type: 'money' }, { key: 'profit', label: 'Profit', type: 'money' }], rows, totals: sumKeys(rows, ['total_revenue', 'total_cost', 'profit']) }
    },
  },
  {
    key: 'job_profitability', label: 'Job profitability', group: 'Operations', module: 'reports', description: 'Revenue, cost and margin per job, most profitable first.',
    params: [...FROM_TO, { name: 'branch_id', label: 'Branch', type: 'ref', ref: 'branches' }],
    run: p => {
      const { from, to } = range(p); const f = filterSql(p, { branch_id: 'j.branch_id' })
      const rows = q.all(`SELECT j.job_no, j.job_date, pr.name AS client, j.department, j.job_status, j.total_revenue, j.total_cost, j.profit FROM jobs j LEFT JOIN parties pr ON pr.id = j.client_id WHERE j.deleted_at IS NULL AND j.job_status <> 'CANCELLED' AND j.job_date BETWEEN ? AND ? ${f.sql} ORDER BY j.profit DESC`, from, to, ...f.args)
        .map(r => ({ ...r, total_revenue: m(r.total_revenue), total_cost: m(r.total_cost), profit: m(r.profit), margin: r.total_revenue > 0 ? r2((r.profit / r.total_revenue) * 100) : null }))
      const t = sumKeys(rows, ['total_revenue', 'total_cost', 'profit']); (t as any).margin = t.total_revenue > 0 ? r2((t.profit / t.total_revenue) * 100) : null
      return { title: 'Job profitability', columns: [{ key: 'job_no', label: 'Job No' }, { key: 'job_date', label: 'Date', type: 'date' }, { key: 'client', label: 'Client' }, { key: 'department', label: 'Department' }, { key: 'job_status', label: 'Status' }, { key: 'total_revenue', label: 'Revenue', type: 'money' }, { key: 'total_cost', label: 'Cost', type: 'money' }, { key: 'profit', label: 'Profit', type: 'money' }, { key: 'margin', label: 'Margin %', type: 'percent' }], rows, totals: t }
    },
  },
  {
    key: 'customer_profitability', label: 'Customer profitability', group: 'Operations', module: 'reports', description: 'Jobs, revenue and profit by client.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT pr.name AS client, COUNT(*) AS jobs, SUM(j.total_revenue) rev, SUM(j.total_cost) cost, SUM(j.profit) profit FROM jobs j LEFT JOIN parties pr ON pr.id = j.client_id WHERE j.deleted_at IS NULL AND j.job_status <> 'CANCELLED' AND j.job_date BETWEEN ? AND ? GROUP BY j.client_id, pr.name ORDER BY profit DESC`, from, to)
        .map(r => ({ client: r.client, jobs: r.jobs, revenue: m(r.rev), cost: m(r.cost), profit: m(r.profit), margin: r.rev > 0 ? r2((r.profit / r.rev) * 100) : null }))
      return { title: 'Customer profitability', columns: [{ key: 'client', label: 'Client' }, { key: 'jobs', label: 'Jobs', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'money' }, { key: 'cost', label: 'Cost', type: 'money' }, { key: 'profit', label: 'Profit', type: 'money' }, { key: 'margin', label: 'Margin %', type: 'percent' }], rows, totals: sumKeys(rows, ['jobs', 'revenue', 'cost', 'profit']) }
    },
  },
  {
    key: 'lane_profitability', label: 'Lane profitability', group: 'Operations', module: 'reports', description: 'Volume and margin by trade lane (POL → POD).', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT pol.code || ' → ' || pod.code AS lane, j.department, COUNT(*) jobs, SUM(j.total_revenue) rev, SUM(j.total_cost) cost, SUM(j.profit) profit FROM jobs j JOIN locations pol ON pol.id = j.pol_id JOIN locations pod ON pod.id = j.pod_id WHERE j.deleted_at IS NULL AND j.job_status <> 'CANCELLED' AND j.job_date BETWEEN ? AND ? GROUP BY j.pol_id, j.pod_id, j.department, pol.code, pod.code ORDER BY jobs DESC`, from, to)
        .map(r => ({ lane: r.lane, department: r.department, jobs: r.jobs, revenue: m(r.rev), cost: m(r.cost), profit: m(r.profit), margin: r.rev > 0 ? r2((r.profit / r.rev) * 100) : null }))
      return { title: 'Lane profitability', columns: [{ key: 'lane', label: 'Lane' }, { key: 'department', label: 'Department' }, { key: 'jobs', label: 'Jobs', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'money' }, { key: 'cost', label: 'Cost', type: 'money' }, { key: 'profit', label: 'Profit', type: 'money' }, { key: 'margin', label: 'Margin %', type: 'percent' }], rows, totals: sumKeys(rows, ['jobs', 'revenue', 'cost', 'profit']) }
    },
  },
  {
    key: 'open_jobs_aging', label: 'Open jobs ageing', group: 'Operations', module: 'jobs', description: 'Jobs not yet closed, by age — find work stuck in the pipeline.', params: [],
    run: () => {
      const today = todayStr()
      const rows = q.all(`SELECT j.job_no, j.job_date, pr.name AS client, j.department, j.job_status, j.operational_status, j.total_revenue, (SELECT COUNT(*) FROM job_charges c WHERE c.job_id = j.id AND c.kind='Revenue' AND c.status='Unbilled' AND c.deleted_at IS NULL) unbilled FROM jobs j LEFT JOIN parties pr ON pr.id = j.client_id WHERE j.deleted_at IS NULL AND j.job_status NOT IN ('CLOSED','CANCELLED') ORDER BY j.job_date`).map(r => ({ ...r, age: daysBetween(r.job_date, today), total_revenue: m(r.total_revenue) }))
      return { title: 'Open jobs ageing', columns: [{ key: 'job_no', label: 'Job No' }, { key: 'job_date', label: 'Opened', type: 'date' }, { key: 'age', label: 'Age (days)', type: 'number' }, { key: 'client', label: 'Client' }, { key: 'department', label: 'Department' }, { key: 'job_status', label: 'Status' }, { key: 'operational_status', label: 'Operational status' }, { key: 'unbilled', label: 'Unbilled charges', type: 'number' }, { key: 'total_revenue', label: 'Revenue', type: 'money' }], rows }
    },
  },
  {
    key: 'unbilled_charges', label: 'Unbilled revenue charges', group: 'Operations', module: 'finance', description: 'Revenue charges on jobs that have not been invoiced yet.', params: [],
    run: () => {
      const rows = q.all(`SELECT j.job_no, j.job_date, j.job_status, pr.name AS bill_to, cc.name AS charge, c.description, c.qty, c.rate, c.currency, c.amount, c.base_amount FROM job_charges c JOIN jobs j ON j.id = c.job_id LEFT JOIN parties pr ON pr.id = COALESCE(c.party_id, j.client_id) LEFT JOIN charge_codes cc ON cc.id = c.charge_code_id WHERE c.deleted_at IS NULL AND j.deleted_at IS NULL AND c.kind = 'Revenue' AND c.status = 'Unbilled' AND j.job_status <> 'CANCELLED' ORDER BY j.job_date, j.job_no`).map(r => ({ ...r, rate: m(r.rate), amount: m(r.amount), base_amount: m(r.base_amount) }))
      return { title: 'Unbilled revenue charges', columns: [{ key: 'job_no', label: 'Job No' }, { key: 'job_date', label: 'Date', type: 'date' }, { key: 'job_status', label: 'Job status' }, { key: 'bill_to', label: 'Bill to' }, { key: 'charge', label: 'Charge' }, { key: 'qty', label: 'Qty', type: 'number' }, { key: 'rate', label: 'Rate', type: 'money' }, { key: 'currency', label: 'Cur' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'base_amount', label: 'Amount (AED)', type: 'money' }], rows, totals: sumKeys(rows, ['base_amount']) }
    },
  },
  {
    key: 'shipment_register', label: 'Shipment (sub-job) register', group: 'Operations', module: 'jobs', description: 'House shipments with shipper, consignee and status.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT s.shipment_no, j.job_no, j.job_date, s.status, s.hbl_no, sh.name AS shipper, cn.name AS consignee, s.commodity, s.packages, s.gross_weight, s.volume_cbm, s.delivered_at FROM shipments s JOIN jobs j ON j.id = s.job_id LEFT JOIN parties sh ON sh.id = s.shipper_id LEFT JOIN parties cn ON cn.id = s.consignee_id WHERE s.deleted_at IS NULL AND j.job_date BETWEEN ? AND ? ORDER BY s.id DESC`, from, to)
      return { title: 'Shipment register', columns: [{ key: 'shipment_no', label: 'Sub-job' }, { key: 'job_no', label: 'Master job' }, { key: 'status', label: 'Status' }, { key: 'hbl_no', label: 'HBL / HAWB' }, { key: 'shipper', label: 'Shipper' }, { key: 'consignee', label: 'Consignee' }, { key: 'commodity', label: 'Commodity' }, { key: 'packages', label: 'Pkgs', type: 'number' }, { key: 'gross_weight', label: 'Weight kg', type: 'number' }, { key: 'volume_cbm', label: 'CBM', type: 'number' }, { key: 'delivered_at', label: 'Delivered', type: 'datetime' }], rows, totals: sumKeys(rows, ['packages', 'gross_weight', 'volume_cbm']) }
    },
  },
  {
    key: 'container_status', label: 'Container status & free time', group: 'Operations', module: 'jobs', description: 'Containers on open jobs with free-time countdown (demurrage / detention watch).', params: [],
    run: () => {
      const today = todayStr()
      const rows = q.all(`SELECT c.container_no, ct.code AS type, c.seal_no, c.status, j.job_no, pr.name AS client, c.gate_in_at, c.gate_out_at, c.free_time_until FROM job_containers c JOIN jobs j ON j.id = c.job_id LEFT JOIN container_types ct ON ct.id = c.type_id LEFT JOIN parties pr ON pr.id = j.client_id WHERE c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status NOT IN ('CLOSED','CANCELLED') AND c.status NOT IN ('Empty returned') ORDER BY c.free_time_until IS NULL, c.free_time_until`).map(r => ({ ...r, days_left: r.free_time_until ? daysBetween(today, r.free_time_until) : null }))
      return { title: 'Container status & free time', columns: [{ key: 'container_no', label: 'Container' }, { key: 'type', label: 'Type' }, { key: 'seal_no', label: 'Seal' }, { key: 'status', label: 'Status' }, { key: 'job_no', label: 'Job' }, { key: 'client', label: 'Client' }, { key: 'free_time_until', label: 'Free time until', type: 'date' }, { key: 'days_left', label: 'Days left', type: 'number' }], rows }
    },
  },
  {
    key: 'on_time', label: 'On-time performance', group: 'Operations', module: 'reports', description: 'Share of jobs departing / arriving within 24 hours of plan, by month.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const jobs = q.all(`SELECT substr(job_date,1,7) mth, etd, atd, eta, ata FROM jobs WHERE deleted_at IS NULL AND job_status <> 'CANCELLED' AND job_date BETWEEN ? AND ?`, from, to)
      const by = new Map<string, { dep: number; depOk: number; arr: number; arrOk: number }>()
      for (const j of jobs) {
        const x = by.get(j.mth) ?? { dep: 0, depOk: 0, arr: 0, arrOk: 0 }
        if (j.etd && j.atd) { x.dep++; if (Date.parse(j.atd) - Date.parse(j.etd) <= 86400000) x.depOk++ }
        if (j.eta && j.ata) { x.arr++; if (Date.parse(j.ata) - Date.parse(j.eta) <= 86400000) x.arrOk++ }
        by.set(j.mth, x)
      }
      const rows = [...by.entries()].sort().map(([month, x]) => ({ month, departures: x.dep, dep_on_time: x.depOk, dep_pct: x.dep ? r2((x.depOk / x.dep) * 100) : null, arrivals: x.arr, arr_on_time: x.arrOk, arr_pct: x.arr ? r2((x.arrOk / x.arr) * 100) : null }))
      return { title: 'On-time performance', columns: [{ key: 'month', label: 'Month' }, { key: 'departures', label: 'Departures tracked', type: 'number' }, { key: 'dep_on_time', label: 'On time', type: 'number' }, { key: 'dep_pct', label: 'On-time %', type: 'percent' }, { key: 'arrivals', label: 'Arrivals tracked', type: 'number' }, { key: 'arr_on_time', label: 'On time', type: 'number' }, { key: 'arr_pct', label: 'On-time %', type: 'percent' }], rows, note: 'On time = actual within 24 hours of the planned date. Only jobs with both planned and actual dates are counted.' }
    },
  },
  // ---------------------------------------------------------------- sales
  {
    key: 'sales_by_branch', label: 'Sales by branch', group: 'Sales', module: 'reports', description: 'Posted invoices (net of credit notes) by branch, in base currency.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT COALESCE(b.name, 'Unassigned') AS branch, COUNT(*) AS docs, SUM(${SIGN} * i.subtotal * i.ex_rate) AS net, SUM(${SIGN} * i.base_total) AS gross FROM invoices i LEFT JOIN branches b ON b.id = i.branch_id WHERE ${SALES_STATUS} AND i.invoice_date BETWEEN ? AND ? GROUP BY i.branch_id, b.name ORDER BY gross DESC`, from, to).map(r => ({ branch: r.branch, docs: r.docs, net: m(Math.round(r.net)), gross: m(r.gross) }))
      return { title: 'Sales by branch', columns: [{ key: 'branch', label: 'Branch' }, { key: 'docs', label: 'Documents', type: 'number' }, { key: 'net', label: 'Sales ex-VAT (AED)', type: 'money' }, { key: 'gross', label: 'Sales incl. VAT (AED)', type: 'money' }], rows, totals: sumKeys(rows, ['docs', 'net', 'gross']) }
    },
  },
  {
    key: 'sales_by_customer', label: 'Sales by customer', group: 'Sales', module: 'reports', description: 'Posted invoices by customer.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT pr.name AS customer, COUNT(*) docs, SUM(${SIGN} * i.subtotal * i.ex_rate) net, SUM(${SIGN} * i.base_total) gross FROM invoices i JOIN parties pr ON pr.id = i.party_id WHERE ${SALES_STATUS} AND i.invoice_date BETWEEN ? AND ? GROUP BY i.party_id, pr.name ORDER BY gross DESC`, from, to).map(r => ({ customer: r.customer, docs: r.docs, net: m(Math.round(r.net)), gross: m(r.gross) }))
      return { title: 'Sales by customer', columns: [{ key: 'customer', label: 'Customer' }, { key: 'docs', label: 'Documents', type: 'number' }, { key: 'net', label: 'Sales ex-VAT (AED)', type: 'money' }, { key: 'gross', label: 'Sales incl. VAT (AED)', type: 'money' }], rows, totals: sumKeys(rows, ['docs', 'net', 'gross']) }
    },
  },
  {
    key: 'sales_by_salesperson', label: 'Sales by salesperson', group: 'Sales', module: 'reports', description: 'Posted invoices attributed to the customer\'s salesperson.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT COALESCE(u.name, 'Unassigned') AS salesperson, COUNT(*) docs, SUM(${SIGN} * i.subtotal * i.ex_rate) net FROM invoices i JOIN parties pr ON pr.id = i.party_id LEFT JOIN users u ON u.id = pr.salesperson_id WHERE ${SALES_STATUS} AND i.invoice_date BETWEEN ? AND ? GROUP BY pr.salesperson_id, u.name ORDER BY net DESC`, from, to).map(r => ({ ...r, net: m(Math.round(r.net)) }))
      return { title: 'Sales by salesperson', columns: [{ key: 'salesperson', label: 'Salesperson' }, { key: 'docs', label: 'Documents', type: 'number' }, { key: 'net', label: 'Sales ex-VAT (AED)', type: 'money' }], rows, totals: sumKeys(rows, ['docs', 'net']) }
    },
  },
  {
    key: 'sales_by_month', label: 'Monthly sales trend', group: 'Sales', module: 'reports', description: 'Sales, purchases and gross profit per month.', params: [D('from', 'From', 'yearStart'), D('to', 'To', 'today')],
    run: p => {
      const { from, to } = range(p)
      const s = q.all(`SELECT substr(i.invoice_date,1,7) mth, SUM(${SIGN} * i.subtotal * i.ex_rate) net FROM invoices i WHERE ${SALES_STATUS} AND i.invoice_date BETWEEN ? AND ? GROUP BY mth`, from, to)
      const c = q.all(`SELECT substr(b.bill_date,1,7) mth, SUM(b.subtotal * b.ex_rate) net FROM bills b WHERE b.status IN ('Posted','Partially paid','Paid') AND b.deleted_at IS NULL AND b.bill_date BETWEEN ? AND ? GROUP BY mth`, from, to)
      const months = [...new Set([...s.map(x => x.mth), ...c.map(x => x.mth)])].sort()
      const rows = months.map(mm => { const sales = m(Math.round(s.find(x => x.mth === mm)?.net ?? 0)), cost = m(Math.round(c.find(x => x.mth === mm)?.net ?? 0)); return { month: mm, sales, purchases: cost, gross: r2(sales - cost) } })
      return { title: 'Monthly sales trend', columns: [{ key: 'month', label: 'Month' }, { key: 'sales', label: 'Sales (AED)', type: 'money' }, { key: 'purchases', label: 'Vendor bills (AED)', type: 'money' }, { key: 'gross', label: 'Difference (AED)', type: 'money' }], rows, totals: sumKeys(rows, ['sales', 'purchases', 'gross']) }
    },
  },
  {
    key: 'quotation_funnel', label: 'Quotation conversion', group: 'Sales', module: 'sales', description: 'Quotations by status and salesperson.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT COALESCE(u.name,'Unassigned') AS salesperson, COUNT(*) AS total, SUM(CASE WHEN qt.status IN ('Accepted','Converted to job') THEN 1 ELSE 0 END) won, SUM(CASE WHEN qt.status = 'Rejected' THEN 1 ELSE 0 END) lost, SUM(CASE WHEN qt.status IN ('Draft','Pending approval','Approved','Sent') THEN 1 ELSE 0 END) open, SUM(qt.total * qt.ex_rate) value, SUM(CASE WHEN qt.status IN ('Accepted','Converted to job') THEN qt.total * qt.ex_rate ELSE 0 END) won_value FROM quotations qt LEFT JOIN users u ON u.id = qt.salesperson_id WHERE qt.deleted_at IS NULL AND qt.quote_date BETWEEN ? AND ? GROUP BY qt.salesperson_id, u.name`, from, to)
        .map(r => ({ ...r, value: m(Math.round(r.value)), won_value: m(Math.round(r.won_value)), conversion: r.total ? r2((r.won / r.total) * 100) : null }))
      return { title: 'Quotation conversion', columns: [{ key: 'salesperson', label: 'Salesperson' }, { key: 'total', label: 'Quotes', type: 'number' }, { key: 'open', label: 'Open', type: 'number' }, { key: 'won', label: 'Won', type: 'number' }, { key: 'lost', label: 'Lost', type: 'number' }, { key: 'conversion', label: 'Conversion %', type: 'percent' }, { key: 'value', label: 'Quoted value (AED)', type: 'money' }, { key: 'won_value', label: 'Won value (AED)', type: 'money' }], rows, totals: sumKeys(rows, ['total', 'open', 'won', 'lost', 'value', 'won_value']) }
    },
  },
  {
    key: 'pipeline', label: 'CRM pipeline', group: 'Sales', module: 'crm', description: 'Open opportunities by stage with weighted value.', params: [],
    run: () => {
      const stages = ['Prospecting', 'Qualification', 'Quotation', 'Negotiation', 'Won', 'Lost']
      const rows = stages.map(st => { const r = q.get(`SELECT COUNT(*) n, COALESCE(SUM(value),0) v, COALESCE(SUM(value * probability / 100.0),0) w FROM opportunities WHERE stage = ? AND deleted_at IS NULL`, st)!; return { stage: st, count: r.n, value: m(r.v), weighted: m(Math.round(r.w)) } })
      return { title: 'CRM pipeline', columns: [{ key: 'stage', label: 'Stage' }, { key: 'count', label: 'Opportunities', type: 'number' }, { key: 'value', label: 'Value', type: 'money' }, { key: 'weighted', label: 'Weighted value', type: 'money' }], rows, totals: sumKeys(rows.filter(r => !['Won', 'Lost'].includes(r.stage)), ['count', 'value', 'weighted']), note: 'Totals exclude Won and Lost.' }
    },
  },
  {
    key: 'lead_funnel', label: 'Lead sources & funnel', group: 'Sales', module: 'crm', description: 'Leads by source and status.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT COALESCE(source,'Unknown') AS source, COUNT(*) total, SUM(CASE WHEN status='Qualified' THEN 1 ELSE 0 END) qualified, SUM(CASE WHEN status='Converted' THEN 1 ELSE 0 END) converted, SUM(CASE WHEN status='Unqualified' THEN 1 ELSE 0 END) unqualified FROM leads WHERE deleted_at IS NULL AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY source ORDER BY total DESC`, from, to).map(r => ({ ...r, rate: r.total ? r2((r.converted / r.total) * 100) : null }))
      return { title: 'Lead sources & funnel', columns: [{ key: 'source', label: 'Source' }, { key: 'total', label: 'Leads', type: 'number' }, { key: 'qualified', label: 'Qualified', type: 'number' }, { key: 'converted', label: 'Converted', type: 'number' }, { key: 'unqualified', label: 'Unqualified', type: 'number' }, { key: 'rate', label: 'Conversion %', type: 'percent' }], rows, totals: sumKeys(rows, ['total', 'qualified', 'converted', 'unqualified']) }
    },
  },
  // ---------------------------------------------------------------- finance
  {
    key: 'ar_aging', label: 'Receivables ageing', group: 'Finance', module: 'finance', description: 'Open customer invoices by days overdue (base currency).', params: [D('as_of', 'As of', 'today')],
    run: p => {
      const asOf = String(p.as_of || todayStr())
      const inv = q.all(`SELECT i.party_id, pr.name AS customer, i.invoice_no, i.due_date, i.invoice_date, (CASE WHEN i.doc_type='Credit Note' THEN -(i.total - i.paid_amount) ELSE i.balance END) * i.ex_rate AS open FROM invoices i JOIN parties pr ON pr.id = i.party_id WHERE i.status IN ('Posted','Partially paid','Paid') AND i.doc_type IN ('Tax Invoice','Debit Note','Credit Note') AND i.deleted_at IS NULL AND i.invoice_date <= ? AND ((i.doc_type <> 'Credit Note' AND i.balance > 0) OR (i.doc_type = 'Credit Note' AND i.total > i.paid_amount))`, asOf)
      const onAcc = q.all(`SELECT r.party_id, pr.name AS customer, SUM(r.unallocated * r.ex_rate) AS amt FROM receipts r JOIN parties pr ON pr.id = r.party_id WHERE r.status = 'Posted' AND r.unallocated > 0 AND r.receipt_date <= ? AND r.deleted_at IS NULL GROUP BY r.party_id, pr.name`, asOf)
      const by = new Map<number, any>()
      const get = (id: number, name: string) => { if (!by.has(id)) by.set(id, { customer: name, current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, on_account: 0, total: 0 }); return by.get(id) }
      for (const r of inv) { const x = get(r.party_id, r.customer); const od = daysBetween(r.due_date ?? r.invoice_date, asOf); const k = od <= 0 ? 'current' : od <= 30 ? 'd30' : od <= 60 ? 'd60' : od <= 90 ? 'd90' : 'd90p'; x[k] += r.open }
      for (const r of onAcc) get(r.party_id, r.customer).on_account -= r.amt
      const rows = [...by.values()].map(x => { const t = x.current + x.d30 + x.d60 + x.d90 + x.d90p + x.on_account; return { customer: x.customer, current: m(Math.round(x.current)), d30: m(Math.round(x.d30)), d60: m(Math.round(x.d60)), d90: m(Math.round(x.d90)), d90p: m(Math.round(x.d90p)), on_account: m(Math.round(x.on_account)), total: m(Math.round(t)) } }).sort((a, b) => b.total - a.total)
      return { title: `Receivables ageing as of ${asOf}`, columns: [{ key: 'customer', label: 'Customer' }, { key: 'current', label: 'Not due', type: 'money' }, { key: 'd30', label: '1–30', type: 'money' }, { key: 'd60', label: '31–60', type: 'money' }, { key: 'd90', label: '61–90', type: 'money' }, { key: 'd90p', label: '90+', type: 'money' }, { key: 'on_account', label: 'On account', type: 'money' }, { key: 'total', label: 'Total', type: 'money' }], rows, totals: sumKeys(rows, ['current', 'd30', 'd60', 'd90', 'd90p', 'on_account', 'total']) }
    },
  },
  {
    key: 'ap_aging', label: 'Payables ageing', group: 'Finance', module: 'finance', description: 'Open vendor bills by days overdue (base currency).', params: [D('as_of', 'As of', 'today')],
    run: p => {
      const asOf = String(p.as_of || todayStr())
      const bills = q.all(`SELECT b.vendor_id, pr.name AS vendor, b.due_date, b.bill_date, b.balance * b.ex_rate AS open FROM bills b JOIN parties pr ON pr.id = b.vendor_id WHERE b.status IN ('Posted','Partially paid') AND b.balance > 0 AND b.deleted_at IS NULL AND b.bill_date <= ?`, asOf)
      const adv = q.all(`SELECT p.vendor_id, pr.name AS vendor, SUM(p.unallocated * p.ex_rate) amt FROM payments p JOIN parties pr ON pr.id = p.vendor_id WHERE p.status='Posted' AND p.unallocated > 0 AND p.payment_date <= ? AND p.deleted_at IS NULL GROUP BY p.vendor_id, pr.name`, asOf)
      const by = new Map<number, any>()
      const get = (id: number, name: string) => { if (!by.has(id)) by.set(id, { vendor: name, current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, advance: 0 }); return by.get(id) }
      for (const r of bills) { const x = get(r.vendor_id, r.vendor); const od = daysBetween(r.due_date ?? r.bill_date, asOf); x[od <= 0 ? 'current' : od <= 30 ? 'd30' : od <= 60 ? 'd60' : od <= 90 ? 'd90' : 'd90p'] += r.open }
      for (const r of adv) get(r.vendor_id, r.vendor).advance -= r.amt
      const rows = [...by.values()].map(x => { const t = x.current + x.d30 + x.d60 + x.d90 + x.d90p + x.advance; return { vendor: x.vendor, current: m(Math.round(x.current)), d30: m(Math.round(x.d30)), d60: m(Math.round(x.d60)), d90: m(Math.round(x.d90)), d90p: m(Math.round(x.d90p)), advance: m(Math.round(x.advance)), total: m(Math.round(t)) } }).sort((a, b) => b.total - a.total)
      return { title: `Payables ageing as of ${asOf}`, columns: [{ key: 'vendor', label: 'Vendor' }, { key: 'current', label: 'Not due', type: 'money' }, { key: 'd30', label: '1–30', type: 'money' }, { key: 'd60', label: '31–60', type: 'money' }, { key: 'd90', label: '61–90', type: 'money' }, { key: 'd90p', label: '90+', type: 'money' }, { key: 'advance', label: 'Advances', type: 'money' }, { key: 'total', label: 'Total', type: 'money' }], rows, totals: sumKeys(rows, ['current', 'd30', 'd60', 'd90', 'd90p', 'advance', 'total']) }
    },
  },
  {
    key: 'trial_balance', label: 'Trial balance', group: 'Finance', module: 'finance', description: 'Account balances as of a date (base currency).', params: [D('as_of', 'As of', 'today'), { name: 'legal_entity_id', label: 'Legal entity', type: 'ref', ref: 'legal_entities' }],
    run: p => {
      const asOf = String(p.as_of || todayStr())
      const rows = q.all(`SELECT a.code, a.name, a.type, COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM accounts a LEFT JOIN journal_lines l ON l.account_id = a.id AND l.deleted_at IS NULL AND l.entry_id IN (SELECT id FROM journal_entries WHERE entry_date <= ? AND deleted_at IS NULL ${p.legal_entity_id ? 'AND legal_entity_id = ' + Number(p.legal_entity_id) : ''}) WHERE a.deleted_at IS NULL GROUP BY a.id HAVING COALESCE(SUM(l.debit),0) <> 0 OR COALESCE(SUM(l.credit),0) <> 0 ORDER BY a.code`, asOf)
        .map(r => { const bal = r.d - r.c; return { code: r.code, name: r.name, type: r.type, debit: m(bal > 0 ? bal : 0), credit: m(bal < 0 ? -bal : 0) } })
      return { title: `Trial balance as of ${asOf}`, columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'type', label: 'Type' }, { key: 'debit', label: 'Debit', type: 'money' }, { key: 'credit', label: 'Credit', type: 'money' }], rows, totals: sumKeys(rows, ['debit', 'credit']) }
    },
  },
  {
    key: 'profit_loss', label: 'Profit & loss', group: 'Finance', module: 'finance', description: 'Income statement for a period (base currency). Year-end closing entries are excluded.', params: [D('from', 'From', 'yearStart'), D('to', 'To', 'today'), { name: 'legal_entity_id', label: 'Legal entity', type: 'ref', ref: 'legal_entities' }],
    run: p => {
      const { from, to } = range(p)
      const acc = q.all(`SELECT a.code, a.name, a.type, a.subtype, COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM accounts a JOIN journal_lines l ON l.account_id = a.id AND l.deleted_at IS NULL JOIN journal_entries e ON e.id = l.entry_id AND e.deleted_at IS NULL WHERE a.deleted_at IS NULL AND a.type IN ('Income','Expense') AND e.entry_date BETWEEN ? AND ? AND e.source_type <> 'Year-end close' ${p.legal_entity_id ? 'AND e.legal_entity_id = ' + Number(p.legal_entity_id) : ''} GROUP BY a.id ORDER BY a.code`, from, to)
      const rows: any[] = []
      const section = (title: string, list: any[], sign: 1 | -1) => {
        rows.push({ kind: 'header', name: title }); let tot = 0
        for (const a of list) { const v = m((a.c - a.d) * sign * (sign === 1 ? 1 : 1)); const val = sign === 1 ? m(a.c - a.d) : m(a.d - a.c); tot += val; rows.push({ kind: 'line', code: a.code, name: a.name, amount: val }); void v }
        rows.push({ kind: 'total', name: `Total ${title.toLowerCase()}`, amount: r2(tot) }); return r2(tot)
      }
      const income = section('Revenue', acc.filter(a => a.type === 'Income'), 1)
      const direct = section('Direct costs', acc.filter(a => a.type === 'Expense' && a.subtype === 'Direct cost'), -1)
      rows.push({ kind: 'grand', name: 'Gross profit', amount: r2(income - direct) })
      const opex = section('Operating expenses', acc.filter(a => a.type === 'Expense' && a.subtype !== 'Direct cost'), -1)
      rows.push({ kind: 'grand', name: 'Net profit / (loss)', amount: r2(income - direct - opex) })
      return { title: `Profit & loss ${from} → ${to}`, layout: 'statement', columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount (AED)', type: 'money' }], rows }
    },
  },
  {
    key: 'balance_sheet', label: 'Balance sheet', group: 'Finance', module: 'finance', description: 'Financial position as of a date (base currency).', params: [D('as_of', 'As of', 'today'), { name: 'legal_entity_id', label: 'Legal entity', type: 'ref', ref: 'legal_entities' }],
    run: p => {
      const asOf = String(p.as_of || todayStr())
      const acc = q.all(`SELECT a.code, a.name, a.type, COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM accounts a JOIN journal_lines l ON l.account_id = a.id AND l.deleted_at IS NULL JOIN journal_entries e ON e.id = l.entry_id AND e.deleted_at IS NULL WHERE a.deleted_at IS NULL AND e.entry_date <= ? ${p.legal_entity_id ? 'AND e.legal_entity_id = ' + Number(p.legal_entity_id) : ''} GROUP BY a.id ORDER BY a.code`, asOf)
      const rows: any[] = []
      const sec = (title: string, type: string, sign: 1 | -1, extra: any[] = []) => {
        rows.push({ kind: 'header', name: title }); let tot = 0
        for (const a of acc.filter(x => x.type === type)) { const v = sign === 1 ? m(a.d - a.c) : m(a.c - a.d); tot += v; rows.push({ kind: 'line', code: a.code, name: a.name, amount: v }) }
        for (const e of extra) { tot += e.amount; rows.push({ kind: 'line', ...e }) }
        rows.push({ kind: 'total', name: `Total ${title.toLowerCase()}`, amount: r2(tot) }); return r2(tot)
      }
      const pl = r2(acc.filter(a => a.type === 'Income').reduce((s, a) => s + m(a.c - a.d), 0) - acc.filter(a => a.type === 'Expense').reduce((s, a) => s + m(a.d - a.c), 0))
      const assets = sec('Assets', 'Asset', 1)
      const liab = sec('Liabilities', 'Liability', -1)
      const eq = sec('Equity', 'Equity', -1, [{ code: '', name: 'Accumulated profit / (loss) to date', amount: pl }])
      rows.push({ kind: 'grand', name: 'Total liabilities & equity', amount: r2(liab + eq) })
      rows.push({ kind: 'check', name: 'Difference (assets − liabilities − equity)', amount: r2(assets - liab - eq) })
      return { title: `Balance sheet as of ${asOf}`, layout: 'statement', columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount (AED)', type: 'money' }], rows, note: 'Closed years are carried in retained earnings; the current-year result is shown as accumulated profit.' }
    },
  },
  {
    key: 'general_ledger', label: 'General ledger', group: 'Finance', module: 'finance', description: 'Transactions of one account with running balance.', params: [{ name: 'account_id', label: 'Account', type: 'ref', ref: 'accounts' }, ...[D('from', 'From', 'monthStart'), D('to', 'To', 'today')]],
    run: p => {
      if (!p.account_id) throw bad('Choose an account')
      const { from, to } = range(p)
      const acc = q.get(`SELECT code, name FROM accounts WHERE id = ?`, Number(p.account_id))
      const opening = q.val<number>(`SELECT COALESCE(SUM(l.debit - l.credit),0) FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id WHERE l.account_id = ? AND l.deleted_at IS NULL AND e.deleted_at IS NULL AND e.entry_date < ?`, Number(p.account_id), from) ?? 0
      let bal = opening
      const rows: any[] = [{ date: null, entry_no: '', description: 'Opening balance', debit: null, credit: null, balance: m(opening) }]
      for (const l of q.all(`SELECT e.entry_date date, e.entry_no, e.source_type, e.source_no, COALESCE(l.description, e.memo) description, l.debit, l.credit FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id WHERE l.account_id = ? AND l.deleted_at IS NULL AND e.deleted_at IS NULL AND e.entry_date BETWEEN ? AND ? ORDER BY e.entry_date, e.id, l.id`, Number(p.account_id), from, to)) {
        bal += (l.debit ?? 0) - (l.credit ?? 0); rows.push({ date: l.date, entry_no: l.entry_no, source: `${l.source_type ?? ''} ${l.source_no ?? ''}`.trim(), description: l.description, debit: m(l.debit ?? 0), credit: m(l.credit ?? 0), balance: m(bal) })
      }
      return { title: `General ledger – ${acc?.code} ${acc?.name}`, columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'entry_no', label: 'Entry' }, { key: 'source', label: 'Source' }, { key: 'description', label: 'Description' }, { key: 'debit', label: 'Debit', type: 'money' }, { key: 'credit', label: 'Credit', type: 'money' }, { key: 'balance', label: 'Balance', type: 'money' }], rows }
    },
  },
  {
    key: 'vat_return', label: 'VAT return (indicative)', group: 'Finance', module: 'finance', description: 'Output and input VAT summary for a period, modelled on the UAE VAT 201 boxes.', params: [D('from', 'From', 'monthStart'), D('to', 'To', 'today')],
    run: p => {
      const { from, to } = range(p)
      const out = q.all(`SELECT COALESCE(v.category,'Standard rated') cat, SUM(${SIGN} * l.amount * i.ex_rate) amt, SUM(${SIGN} * l.vat_amount * i.ex_rate) vat FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id LEFT JOIN vat_codes v ON v.id = l.vat_code_id WHERE ${SALES_STATUS} AND l.deleted_at IS NULL AND i.invoice_date BETWEEN ? AND ? GROUP BY cat`, from, to)
      const inp = q.all(`SELECT COALESCE(v.category,'Standard rated') cat, SUM(l.amount * b.ex_rate) amt, SUM(l.vat_amount * b.ex_rate) vat FROM bill_lines l JOIN bills b ON b.id = l.bill_id LEFT JOIN vat_codes v ON v.id = l.vat_code_id WHERE b.status IN ('Posted','Partially paid','Paid') AND b.deleted_at IS NULL AND l.deleted_at IS NULL AND b.bill_date BETWEEN ? AND ? GROUP BY cat`, from, to)
      const exp = q.get(`SELECT COALESCE(SUM(vat_amount),0) vat, COALESCE(SUM(amount - vat_amount),0) amt FROM expenses WHERE status IN ('Approved','Paid') AND deleted_at IS NULL AND expense_date BETWEEN ? AND ? AND vat_amount > 0`, from, to)!
      const g = (a: any[], c: string, k: 'amt' | 'vat') => m(Math.round(a.find(x => x.cat === c)?.[k] ?? 0))
      const rows = [
        { box: '1', label: 'Standard-rated supplies (Dubai)', amount: g(out, 'Standard rated', 'amt'), vat: g(out, 'Standard rated', 'vat') },
        { box: '3', label: 'Supplies subject to reverse charge', amount: g(out, 'Reverse charge', 'amt'), vat: g(out, 'Reverse charge', 'vat') },
        { box: '4', label: 'Zero-rated supplies', amount: g(out, 'Zero rated', 'amt'), vat: 0 },
        { box: '5', label: 'Exempt supplies', amount: g(out, 'Exempt', 'amt'), vat: 0 },
        { box: '8', label: 'Total output', amount: r2(out.reduce((s, x) => s + m(Math.round(x.amt)), 0)), vat: r2(out.reduce((s, x) => s + m(Math.round(x.vat)), 0)), strong: true },
        { box: '9', label: 'Standard-rated expenses (incl. staff claims)', amount: r2(g(inp, 'Standard rated', 'amt') + m(Math.round(exp.amt))), vat: r2(g(inp, 'Standard rated', 'vat') + m(Math.round(exp.vat))) },
        { box: '10', label: 'Supplies subject to reverse charge (input)', amount: g(inp, 'Reverse charge', 'amt'), vat: g(inp, 'Reverse charge', 'vat') },
        { box: '11', label: 'Total input', amount: null, vat: r2(inp.reduce((s, x) => s + m(Math.round(x.vat)), 0) + m(Math.round(exp.vat))), strong: true },
      ]
      const outVat = rows.find(r => r.box === '8')!.vat as number, inVat = rows.find(r => r.box === '11')!.vat as number
      rows.push({ box: '12', label: 'Total due tax for the period', amount: null, vat: outVat, strong: true }, { box: '13', label: 'Recoverable tax for the period', amount: null, vat: inVat, strong: true }, { box: '14', label: 'Payable / (refundable) tax', amount: null, vat: r2(outVat - inVat), strong: true })
      return { title: `VAT return ${from} → ${to}`, columns: [{ key: 'box', label: 'Box' }, { key: 'label', label: 'Description' }, { key: 'amount', label: 'Amount (AED)', type: 'money' }, { key: 'vat', label: 'VAT (AED)', type: 'money' }], rows, note: 'Indicative summary built from posted invoices, vendor bills and approved expense claims. Credit notes are netted. Review tax treatment and reconcile to the ledger before filing on the FTA portal.' }
    },
  },
  {
    key: 'tax_invoice_register', label: 'Tax invoice register', group: 'Finance', module: 'finance', description: 'All posted tax documents with VAT, for audit and FTA requests.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT i.invoice_no, i.doc_type, i.invoice_date, pr.name AS customer, pr.trn, i.currency, i.ex_rate, i.subtotal, i.vat_total, i.total, i.base_total, i.status FROM invoices i JOIN parties pr ON pr.id = i.party_id WHERE ${SALES_STATUS} AND i.invoice_date BETWEEN ? AND ? ORDER BY i.invoice_no`, from, to).map(r => ({ ...r, subtotal: m(r.subtotal), vat_total: m(r.vat_total), total: m(r.total), base_total: m(r.base_total) }))
      return { title: 'Tax invoice register', columns: [{ key: 'invoice_no', label: 'Document' }, { key: 'doc_type', label: 'Type' }, { key: 'invoice_date', label: 'Date', type: 'date' }, { key: 'customer', label: 'Customer' }, { key: 'trn', label: 'TRN' }, { key: 'currency', label: 'Cur' }, { key: 'ex_rate', label: 'Rate', type: 'number' }, { key: 'subtotal', label: 'Net', type: 'money' }, { key: 'vat_total', label: 'VAT', type: 'money' }, { key: 'total', label: 'Total', type: 'money' }, { key: 'base_total', label: 'Total (AED)', type: 'money' }, { key: 'status', label: 'Status' }], rows }
    },
  },
  // ---------------------------------------------------------------- transport / people / support
  {
    key: 'transport_utilisation', label: 'Fleet utilisation', group: 'Transport', module: 'transport', description: 'Trips, distance, revenue and cost per vehicle.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT COALESCE(v.plate_no, 'Subcontracted') AS vehicle, COUNT(*) trips, COALESCE(SUM(t.distance_km),0) km, COALESCE(SUM(t.rate),0) rev, COALESCE(SUM(t.cost),0) cost FROM transport_orders t LEFT JOIN vehicles v ON v.id = t.vehicle_id WHERE t.deleted_at IS NULL AND t.status <> 'Cancelled' AND substr(COALESCE(t.pickup_at, t.created_at),1,10) BETWEEN ? AND ? GROUP BY t.vehicle_id, v.plate_no ORDER BY trips DESC`, from, to).map(r => ({ vehicle: r.vehicle, trips: r.trips, km: r.km, revenue: m(r.rev), cost: m(r.cost), margin: m(r.rev - r.cost) }))
      return { title: 'Fleet utilisation', columns: [{ key: 'vehicle', label: 'Vehicle' }, { key: 'trips', label: 'Trips', type: 'number' }, { key: 'km', label: 'Distance (km)', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'money' }, { key: 'cost', label: 'Cost', type: 'money' }, { key: 'margin', label: 'Margin', type: 'money' }], rows, totals: sumKeys(rows, ['trips', 'km', 'revenue', 'cost', 'margin']) }
    },
  },
  {
    key: 'document_expiries', label: 'Expiring documents', group: 'Compliance', module: 'reports', description: 'Licences, visas, registrations, contracts and uploaded documents expiring soon.', params: [{ name: 'days', label: 'Within (days)', type: 'number', default: '60' }],
    run: p => {
      const days = Math.min(Number(p.days) || 60, 730); const today = todayStr(), limit = addDays(today, days)
      const rows: any[] = []
      const push = (type: string, record: string, document: string, date: string | null, link: string) => { if (date && date <= limit) rows.push({ type, record, document, expiry: date, days_left: daysBetween(today, date), link }) }
      for (const v of q.all(`SELECT id, plate_no, registration_expiry, insurance_expiry FROM vehicles WHERE deleted_at IS NULL AND status <> 'Inactive'`)) { push('Vehicle', v.plate_no, 'Registration (Mulkiya)', v.registration_expiry, `/e/vehicles/${v.id}`); push('Vehicle', v.plate_no, 'Insurance', v.insurance_expiry, `/e/vehicles/${v.id}`) }
      for (const d of q.all(`SELECT id, name, licence_expiry, visa_expiry FROM drivers WHERE deleted_at IS NULL AND active = 1`)) { push('Driver', d.name, 'Driving licence', d.licence_expiry, `/e/drivers/${d.id}`); push('Driver', d.name, 'Visa', d.visa_expiry, `/e/drivers/${d.id}`) }
      for (const c of q.all(`SELECT id, name, type, expiry_date FROM compliance_items WHERE deleted_at IS NULL AND status IN ('Active','Expired') AND expiry_date IS NOT NULL`)) push('Company licence', c.name, c.type, c.expiry_date, `/e/compliance_items/${c.id}`)
      for (const e of q.all(`SELECT id, name, work_permit_expiry FROM employees WHERE deleted_at IS NULL AND status IN ('Active','On leave','Probation') AND work_permit_expiry IS NOT NULL`)) push('Employee', e.name, 'Work permit / labour contract', e.work_permit_expiry, `/e/employees/${e.id}`)
      for (const e of q.all(`SELECT id, name, passport_expiry, eid_expiry, visa_expiry, health_card_expiry FROM employees WHERE deleted_at IS NULL AND status IN ('Active','On leave','Probation')`)) { push('Employee', e.name, 'Passport', e.passport_expiry, `/e/employees/${e.id}`); push('Employee', e.name, 'Emirates ID', e.eid_expiry, `/e/employees/${e.id}`); push('Employee', e.name, 'Visa / residence', e.visa_expiry, `/e/employees/${e.id}`); push('Employee', e.name, 'Health insurance', e.health_card_expiry, `/e/employees/${e.id}`) }
      for (const c of q.all(`SELECT id, contract_no, title, end_date FROM contracts WHERE deleted_at IS NULL AND status = 'Active'`)) push('Contract', `${c.contract_no} ${c.title}`, 'Contract end', c.end_date, `/e/contracts/${c.id}`)
      for (const c of q.all(`SELECT id, name, kyc_expiry FROM parties WHERE deleted_at IS NULL AND status = 'Active'`)) push('Customer / party', c.name, 'KYC / licence', c.kyc_expiry, `/e/parties/${c.id}`)
      for (const a of q.all(`SELECT id, file_name, category, link_label, link_entity, link_id, expiry_date FROM attachments WHERE deleted_at IS NULL AND expiry_date IS NOT NULL`)) push('Document', a.link_label ?? a.file_name, `${a.category}: ${a.file_name}`, a.expiry_date, a.link_entity ? `/e/${a.link_entity}/${a.link_id}` : '/documents')
      rows.sort((a, b) => a.expiry.localeCompare(b.expiry))
      return { title: `Documents expiring within ${days} days`, columns: [{ key: 'type', label: 'Type' }, { key: 'record', label: 'Record' }, { key: 'document', label: 'Document' }, { key: 'expiry', label: 'Expiry', type: 'date' }, { key: 'days_left', label: 'Days left', type: 'number' }], rows }
    },
  },
  {
    key: 'end_of_service', label: 'End-of-service gratuity (accrued)', group: 'Compliance', module: 'hr', description: 'Gratuity accrued per employee under Federal Decree-Law 33 of 2021: 21 days of basic pay per year for the first 5 years and 30 days per year after, pro-rated, capped at two years of total pay. Requires 1 year of service.', params: [D('as_at', 'As at', 'today')],
    run: p => {
      const at = String(p.as_at || todayStr())
      const rows = q.all(`SELECT emp_no, name, join_date, basic_salary, housing_allowance, transport_allowance, other_allowance, contract_type FROM employees WHERE deleted_at IS NULL AND status IN ('Active','On leave','Probation') ORDER BY emp_no`).map(e => {
        const years = e.join_date ? Math.max(0, daysBetween(e.join_date, at) / 365) : 0
        const basic = m(e.basic_salary ?? 0), total = basic + m((e.housing_allowance ?? 0) + (e.transport_allowance ?? 0) + (e.other_allowance ?? 0)), daily = basic / 30
        const raw = years < 1 ? 0 : daily * (21 * Math.min(years, 5) + 30 * Math.max(0, years - 5))
        const cap = total * 24
        return { emp_no: e.emp_no, name: e.name, join_date: e.join_date, years: Math.round(years * 100) / 100, basic, gratuity: r2(Math.min(raw, cap)), capped: raw > cap ? 'Yes' : '' }
      })
      return { title: `End-of-service gratuity accrued at ${at}`, columns: [{ key: 'emp_no', label: 'Emp. no.' }, { key: 'name', label: 'Employee' }, { key: 'join_date', label: 'Joined', type: 'date' }, { key: 'years', label: 'Years', type: 'number' }, { key: 'basic', label: 'Basic (monthly)', type: 'money' }, { key: 'gratuity', label: 'Gratuity (AED)', type: 'money' }, { key: 'capped', label: 'Capped' }], rows, totals: sumKeys(rows, ['gratuity']), note: 'Indicative. Based on last basic salary and calendar-day service; confirm unpaid leave and contract type before settlement.' }
    },
  },
  {
    key: 'related_party', label: 'Related-party transactions', group: 'Compliance', module: 'finance', description: 'Sales, purchases and payments with parties flagged as related / connected persons – to be disclosed in the corporate tax return.', params: FROM_TO,
    run: p => {
      const { from, to } = range(p)
      const rows = q.all(`SELECT pr.name, 'Sales invoiced' kind, COALESCE(SUM(${SIGN} * i.base_total),0) amt FROM invoices i JOIN parties pr ON pr.id = i.party_id WHERE pr.is_related_party = 1 AND ${SALES_STATUS} AND i.invoice_date BETWEEN ? AND ? GROUP BY pr.id
        UNION ALL SELECT pr.name, 'Purchases billed', COALESCE(SUM(b.base_total),0) FROM bills b JOIN parties pr ON pr.id = b.vendor_id WHERE pr.is_related_party = 1 AND b.status IN ('Posted','Partially paid','Paid') AND b.deleted_at IS NULL AND b.bill_date BETWEEN ? AND ? GROUP BY pr.id`, from, to, from, to).map(r => ({ name: r.name, kind: r.kind, amt: m(Math.round(r.amt)) }))
      return { title: `Related-party transactions ${from} → ${to}`, columns: [{ key: 'name', label: 'Related party' }, { key: 'kind', label: 'Nature' }, { key: 'amt', label: 'Amount (AED)', type: 'money' }], rows, note: 'Transactions with related parties must be at arm’s length and disclosed. Flag parties under Customers & Parties → Related party.' }
    },
  },
  {
    key: 'leave_balance', label: 'Leave balances', group: 'People', module: 'hr', description: 'Annual leave entitlement, taken and remaining this year.', params: [],
    run: () => {
      const y = todayStr().slice(0, 4)
      const rows = q.all(`SELECT e.emp_no, e.name, e.annual_leave_days AS entitlement, COALESCE((SELECT SUM(days) FROM leave_requests l WHERE l.employee_id = e.id AND l.type = 'Annual' AND l.status = 'Approved' AND l.deleted_at IS NULL AND substr(l.from_date,1,4) = ?),0) taken, COALESCE((SELECT SUM(days) FROM leave_requests l WHERE l.employee_id = e.id AND l.type = 'Annual' AND l.status = 'Pending' AND l.deleted_at IS NULL AND substr(l.from_date,1,4) = ?),0) pending FROM employees e WHERE e.deleted_at IS NULL AND e.status IN ('Active','On leave','Probation') ORDER BY e.name`, y, y).map(r => ({ ...r, remaining: (r.entitlement ?? 30) - r.taken }))
      return { title: `Annual leave balances ${y}`, columns: [{ key: 'emp_no', label: 'Emp. no.' }, { key: 'name', label: 'Employee' }, { key: 'entitlement', label: 'Entitlement', type: 'number' }, { key: 'taken', label: 'Taken', type: 'number' }, { key: 'pending', label: 'Pending', type: 'number' }, { key: 'remaining', label: 'Remaining', type: 'number' }], rows }
    },
  },
  {
    key: 'ticket_sla', label: 'Ticket SLA status', group: 'Support', module: 'support', description: 'Open complaints and tickets against their due time.', params: [],
    run: () => {
      const now = new Date().toISOString().slice(0, 16)
      const rows = q.all(`SELECT t.ticket_no, t.subject, t.type, t.priority, t.status, pr.name AS customer, u.name AS assignee, t.due_at FROM tickets t LEFT JOIN parties pr ON pr.id = t.customer_id LEFT JOIN users u ON u.id = t.assigned_to WHERE t.deleted_at IS NULL AND t.status NOT IN ('Resolved','Closed') ORDER BY t.due_at`).map(r => ({ ...r, sla: r.due_at && r.due_at < now ? 'Overdue' : 'Within SLA' }))
      return { title: 'Ticket SLA status', columns: [{ key: 'ticket_no', label: 'Ticket' }, { key: 'subject', label: 'Subject' }, { key: 'type', label: 'Type' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }, { key: 'customer', label: 'Customer' }, { key: 'assignee', label: 'Assigned to' }, { key: 'due_at', label: 'Due', type: 'datetime' }, { key: 'sla', label: 'SLA' }], rows }
    },
  },
]

export function reportCatalog(canSee: (module: string) => boolean) {
  return REPORTS.filter(r => canSee(r.module)).map(r => ({ key: r.key, label: r.label, group: r.group, description: r.description, params: r.params }))
}
export function runReport(key: string, params: Record<string, any>): ReportResult {
  const r = REPORTS.find(x => x.key === key)
  if (!r) throw bad('Unknown report')
  const p = { ...params }
  for (const pd of r.params) {
    if (p[pd.name] === undefined || p[pd.name] === '') {
      if (pd.default === 'today') p[pd.name] = todayStr(); else if (pd.default === 'monthStart') p[pd.name] = monthStart(); else if (pd.default === 'yearStart') p[pd.name] = yearStart(); else if (pd.default) p[pd.name] = pd.default
    }
  }
  return r.run(p)
}
void num; void getSetting
