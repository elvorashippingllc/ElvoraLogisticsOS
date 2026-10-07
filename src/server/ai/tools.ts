import { q } from '../db'
import { addDays, todayStr, fromCents, r2, nowLocal } from '../util'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { businessSnapshot } from '../integrations/snapshot'
import { queueEmail } from '../mailer'
import { sendWhatsApp, messageOwners, phonesForParty } from '../integrations/whatsapp'
import { notifyRole } from '../notify'
import { addJobEvent } from '../domain/jobs'

export type Risk = 'read' | 'internal' | 'external'
export interface Tool { name: string; description: string; risk: Risk; parameters: any; run: (a: any, ctx: { agent: string }) => Promise<any> | any; summarize?: (a: any) => string }

const S = (description: string) => ({ type: 'string', description })
const Nn = (description: string) => ({ type: 'number', description })
const obj = (properties: Record<string, any>, required: string[] = []) => ({ type: 'object', properties, required })
const money = (c: number | null | undefined) => r2(fromCents(c))
const lim = (a: any, d = 15) => Math.min(Math.max(Number(a?.limit) || d, 1), 40)
const adminId = () => q.val<number>(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'Admin' AND u.deleted_at IS NULL ORDER BY u.id LIMIT 1`) ?? 1
const jobByNo = (no: string) => q.get(`SELECT * FROM jobs WHERE deleted_at IS NULL AND (job_no = ? OR mbl_no = ?) LIMIT 1`, String(no).trim().toUpperCase(), String(no).trim())
const partyByName = (s: string) => q.get(`SELECT * FROM parties WHERE deleted_at IS NULL AND (code = ? OR name LIKE ?) ORDER BY (name = ?) DESC, id LIMIT 1`, s, `%${s}%`, s)

export const TOOLS: Tool[] = [
  { name: 'business_snapshot', risk: 'read', description: 'Key numbers: open jobs, revenue this month, receivables, overdue, payables, cash, leads, tickets, tasks, expiring documents.', parameters: obj({}), run: () => businessSnapshot().data },
  { name: 'search_jobs', risk: 'read', description: 'Find master jobs by job number, MBL/HBL, customer name, status or container number.', parameters: obj({ query: S('text to search'), status: S('OPENED | IN PROGRESS | ON HOLD | DELIVERED | CLOSED | CANCELLED'), limit: Nn('max rows') }),
    run: a => q.all(`SELECT j.job_no, p.name client, j.department, j.job_status, j.mbl_no, j.job_date, j.etd, j.eta, (SELECT code FROM locations WHERE id = j.pol_id) pol, (SELECT code FROM locations WHERE id = j.pod_id) pod FROM jobs j LEFT JOIN parties p ON p.id = j.client_id WHERE j.deleted_at IS NULL ${a.status ? 'AND j.job_status = ?' : ''} ${a.query ? `AND (j.job_no LIKE ? OR j.mbl_no LIKE ? OR j.hbl_no LIKE ? OR p.name LIKE ? OR j.id IN (SELECT job_id FROM job_containers WHERE container_no LIKE ?))` : ''} ORDER BY j.id DESC LIMIT ${lim(a)}`, ...(a.status ? [a.status] : []), ...(a.query ? Array(5).fill(`%${a.query}%`) : [])) },
  { name: 'get_job', risk: 'read', description: 'Full picture of one job: parties, route, dates, containers, charges (revenue/cost), invoices, last tracking events.', parameters: obj({ job_no: S('job number, MBL or HBL') }, ['job_no']),
    run: a => {
      const j = jobByNo(a.job_no); if (!j) return { error: 'Job not found' }
      const lab = (id: number | null) => (id ? q.val<string>(`SELECT name FROM parties WHERE id = ?`, id) : null)
      return {
        job_no: j.job_no, status: j.job_status, department: j.department, client: lab(j.client_id), shipper: lab(j.shipper_id), consignee: lab(j.consignee_id), mbl: j.mbl_no, hbl: j.hbl_no, etd: j.etd, eta: j.eta, atd: j.atd, ata: j.ata, incoterm: j.inco_terms,
        revenue_aed: money(j.total_revenue), cost_aed: money(j.total_cost), profit_aed: money((j.total_revenue ?? 0) - (j.total_cost ?? 0)),
        containers: q.all(`SELECT c.container_no, t.code container_type, c.status, c.free_time_until FROM job_containers c LEFT JOIN container_types t ON t.id = c.type_id WHERE c.job_id = ? AND c.deleted_at IS NULL`, j.id),
        invoices: q.all(`SELECT invoice_no, doc_type, status, due_date, total, balance, currency FROM invoices WHERE job_id = ? AND deleted_at IS NULL`, j.id).map(i => ({ ...i, total: money(i.total), balance: money(i.balance) })),
        events: q.all(`SELECT event_at, event_type, location, description FROM job_events WHERE job_id = ? AND deleted_at IS NULL ORDER BY event_at DESC, id DESC LIMIT 6`, j.id),
      }
    } },
  { name: 'search_customers', risk: 'read', description: 'Find customers/vendors by name or code with credit limit and outstanding balance.', parameters: obj({ query: S('name or code'), limit: Nn('max rows') }, ['query']),
    run: a => q.all(`SELECT p.code, p.name, p.status, p.phone, p.email, p.credit_limit, p.credit_days, (SELECT COALESCE(SUM(balance * ex_rate),0) FROM invoices i WHERE i.party_id = p.id AND i.status IN ('Posted','Partially paid') AND i.doc_type IN ('Tax Invoice','Debit Note') AND i.deleted_at IS NULL) outstanding FROM parties p WHERE p.deleted_at IS NULL AND (p.name LIKE ? OR p.code LIKE ?) LIMIT ${lim(a, 10)}`, `%${a.query}%`, `%${a.query}%`).map(r => ({ ...r, credit_limit: money(r.credit_limit), outstanding_aed: money(r.outstanding), outstanding: undefined })) },
  { name: 'overdue_invoices', risk: 'read', description: 'Overdue receivables sorted by days overdue, with customer contact details.', parameters: obj({ min_days_overdue: Nn('minimum days past due'), limit: Nn('max rows') }),
    run: a => q.all(`SELECT i.invoice_no, i.invoice_date, i.due_date, i.currency, i.balance, i.job_id, p.id party_id, p.name customer, p.email, p.phone, CAST(julianday(?) - julianday(i.due_date) AS INTEGER) days_overdue FROM invoices i JOIN parties p ON p.id = i.party_id WHERE i.status IN ('Posted','Partially paid') AND i.doc_type IN ('Tax Invoice','Debit Note') AND i.balance > 0 AND i.due_date < ? AND i.deleted_at IS NULL AND CAST(julianday(?) - julianday(i.due_date) AS INTEGER) >= ? ORDER BY days_overdue DESC LIMIT ${lim(a, 20)}`, todayStr(), todayStr(), todayStr(), Number(a.min_days_overdue) || 1).map(r => ({ ...r, balance: money(r.balance) })) },
  { name: 'customer_statement', risk: 'read', description: 'Open invoices and total outstanding for one customer.', parameters: obj({ customer: S('customer name or code') }, ['customer']),
    run: a => { const p = partyByName(a.customer); if (!p) return { error: 'Customer not found' }; const rows = q.all(`SELECT invoice_no, invoice_date, due_date, currency, total, balance FROM invoices WHERE party_id = ? AND status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND deleted_at IS NULL ORDER BY due_date`, p.id).map(r => ({ ...r, total: money(r.total), balance: money(r.balance) })); return { customer: p.name, open_invoices: rows } } },
  { name: 'bills_due', risk: 'read', description: 'Vendor bills unpaid and due within N days.', parameters: obj({ days: Nn('days ahead (default 7)') }),
    run: a => q.all(`SELECT b.bill_no, b.vendor_invoice_no, p.name vendor, b.due_date, b.currency, b.balance FROM bills b JOIN parties p ON p.id = b.vendor_id WHERE b.status IN ('Posted','Partially paid') AND b.balance > 0 AND b.due_date <= ? AND b.deleted_at IS NULL ORDER BY b.due_date LIMIT 30`, addDays(todayStr(), Number(a.days) || 7)).map(r => ({ ...r, balance: money(r.balance) })) },
  { name: 'stalled_jobs', risk: 'read', description: 'Open jobs needing attention: ETA passed, no tracking update for 5+ days, missing MBL, or container free time ending.', parameters: obj({}),
    run: () => {
      const t = todayStr()
      return {
        eta_passed: q.all(`SELECT job_no, eta, job_status FROM jobs WHERE deleted_at IS NULL AND job_status IN ('OPENED','IN PROGRESS') AND eta IS NOT NULL AND substr(eta,1,10) < ? AND ata IS NULL LIMIT 15`, t),
        no_update_5d: q.all(`SELECT j.job_no, j.job_status, (SELECT MAX(event_at) FROM job_events WHERE job_id = j.id AND deleted_at IS NULL) last_event FROM jobs j WHERE j.deleted_at IS NULL AND j.job_status = 'IN PROGRESS' AND COALESCE((SELECT MAX(substr(event_at,1,10)) FROM job_events WHERE job_id = j.id AND deleted_at IS NULL), j.job_date) < ? LIMIT 15`, addDays(t, -5)),
        missing_mbl: q.all(`SELECT job_no, job_status, etd FROM jobs WHERE deleted_at IS NULL AND job_status IN ('IN PROGRESS') AND (mbl_no IS NULL OR mbl_no = '') AND etd IS NOT NULL AND substr(etd,1,10) <= ? LIMIT 15`, addDays(t, 3)),
        free_time_ending: q.all(`SELECT j.job_no, c.container_no, c.free_time_until FROM job_containers c JOIN jobs j ON j.id = c.job_id WHERE c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status NOT IN ('CLOSED','CANCELLED') AND c.status <> 'Empty returned' AND c.free_time_until IS NOT NULL AND c.free_time_until <= ? LIMIT 15`, addDays(t, 2)),
      }
    } },
  { name: 'unbilled_work', risk: 'read', description: 'Jobs with revenue charges not yet invoiced (revenue leakage), biggest first.', parameters: obj({ limit: Nn('max rows') }),
    run: a => q.all(`SELECT j.job_no, j.job_status, p.name client, SUM(c.base_amount) unbilled FROM job_charges c JOIN jobs j ON j.id = c.job_id LEFT JOIN parties p ON p.id = j.client_id WHERE c.kind = 'Revenue' AND c.status = 'Unbilled' AND c.deleted_at IS NULL AND j.deleted_at IS NULL AND j.job_status <> 'CANCELLED' GROUP BY j.id ORDER BY unbilled DESC LIMIT ${lim(a)}`).map(r => ({ ...r, unbilled_aed: money(r.unbilled), unbilled: undefined })) },
  { name: 'list_leads', risk: 'read', description: 'Leads, newest first, optionally by status (New, Contacted, Qualified…).', parameters: obj({ status: S('lead status'), limit: Nn('max rows') }),
    run: a => q.all(`SELECT id, lead_no, company, contact_name, phone, email, source, status, interest, origin, destination, created_at FROM leads WHERE deleted_at IS NULL ${a.status ? 'AND status = ?' : ''} ORDER BY id DESC LIMIT ${lim(a)}`, ...(a.status ? [a.status] : [])) },
  { name: 'stale_opportunities', risk: 'read', description: 'Open sales opportunities with no update for 7+ days, and quotations sent but not answered for 5+ days.', parameters: obj({}),
    run: () => ({ opportunities: q.all(`SELECT opp_no, title, stage, value, updated_at FROM opportunities WHERE deleted_at IS NULL AND stage NOT IN ('Won','Lost') AND substr(updated_at,1,10) < ? LIMIT 15`, addDays(todayStr(), -7)).map(r => ({ ...r, value: money(r.value) })), quotes: q.all(`SELECT q.quote_no, p.name customer, q.status, q.valid_until, q.updated_at FROM quotations q LEFT JOIN parties p ON p.id = q.customer_id WHERE q.deleted_at IS NULL AND q.status = 'Sent' AND substr(q.updated_at,1,10) < ? LIMIT 15`, addDays(todayStr(), -5)) }) },
  { name: 'list_tasks', risk: 'read', description: 'Open tasks, overdue first.', parameters: obj({ limit: Nn('max rows') }), run: a => q.all(`SELECT id, title, status, priority, due_date, link_label FROM tasks WHERE deleted_at IS NULL AND status <> 'Done' ORDER BY (due_date IS NULL), due_date LIMIT ${lim(a, 20)}`) },
  { name: 'open_tickets', risk: 'read', description: 'Open complaints/tickets with age and customer.', parameters: obj({}), run: () => q.all(`SELECT t.id, t.ticket_no, t.subject, t.type, t.priority, t.status, t.created_at, p.name customer FROM tickets t LEFT JOIN parties p ON p.id = t.customer_id WHERE t.deleted_at IS NULL AND t.status NOT IN ('Resolved','Closed') ORDER BY t.id DESC LIMIT 20`) },
  { name: 'expiring_documents', risk: 'read', description: 'Documents, licences, visas and IDs expiring within N days (company files and employee documents).', parameters: obj({ days: Nn('days ahead (default 30)') }),
    run: a => { const to = addDays(todayStr(), Number(a.days) || 30); return { files: q.all(`SELECT file_name, category, link_label, expiry_date FROM attachments WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND expiry_date <= ? ORDER BY expiry_date LIMIT 20`, to), employees: q.all(`SELECT name, visa_expiry, passport_expiry, eid_expiry, health_card_expiry FROM employees WHERE deleted_at IS NULL AND status IN ('Active','On leave','Probation') AND (visa_expiry <= ? OR passport_expiry <= ? OR eid_expiry <= ? OR health_card_expiry <= ?) LIMIT 20`, to, to, to, to) } } },
  { name: 'low_stock', risk: 'read', description: 'Warehouse items at or below their minimum stock.', parameters: obj({}), run: () => q.all(`SELECT i.sku, i.name, i.min_stock, COALESCE((SELECT SUM(qty) FROM stock_moves m WHERE m.item_id = i.id AND m.deleted_at IS NULL),0) on_hand FROM items i WHERE i.deleted_at IS NULL AND i.min_stock > 0 AND COALESCE((SELECT SUM(qty) FROM stock_moves m WHERE m.item_id = i.id AND m.deleted_at IS NULL),0) <= i.min_stock LIMIT 20`) },
  // ---------------- internal writes
  { name: 'create_task', risk: 'internal', description: 'Create a follow-up task for the team.', parameters: obj({ title: S('what must be done'), details: S('context'), due_in_days: Nn('days from today'), priority: S('Low | Medium | High | Urgent'), job_no: S('optional related job number') }, ['title']),
    summarize: a => `Create task: ${a.title}`, run: a => { const j = a.job_no ? jobByNo(a.job_no) : null; const r = createRecord(getDef('tasks'), { title: String(a.title).slice(0, 200), description: a.details ?? null, due_date: addDays(todayStr(), Number(a.due_in_days ?? 1)), priority: ['Low', 'Medium', 'High', 'Urgent'].includes(a.priority) ? a.priority : 'Medium', kind: 'Follow-up', link_entity: j ? 'jobs' : null, link_id: j?.id ?? null, link_label: j?.job_no ?? null, assignee_id: adminId() }, SYSTEM_CTX); return { created: r._title, id: r.id } } },
  { name: 'add_note', risk: 'internal', description: 'Add an internal comment on a record (jobs, parties, invoices, leads, tickets, quotations).', parameters: obj({ entity: S('jobs | parties | invoices | leads | tickets | quotations'), key: S('job_no, invoice_no, lead_no, ticket_no, quote_no or customer name'), text: S('comment text') }, ['entity', 'key', 'text']),
    summarize: a => `Note on ${a.entity} ${a.key}: ${String(a.text).slice(0, 80)}`,
    run: (a, c) => {
      const map: Record<string, [string, string]> = { jobs: ['jobs', 'job_no'], invoices: ['invoices', 'invoice_no'], leads: ['leads', 'lead_no'], tickets: ['tickets', 'ticket_no'], quotations: ['quotations', 'quote_no'], parties: ['parties', 'name'] }
      const m = map[a.entity]; if (!m) return { error: 'Unsupported entity' }
      const row = q.get(`SELECT id FROM ${m[0]} WHERE deleted_at IS NULL AND ${m[1]} ${m[1] === 'name' ? 'LIKE' : '='} ? LIMIT 1`, m[1] === 'name' ? `%${a.key}%` : a.key)
      if (!row) return { error: 'Record not found' }
      q.run(`INSERT INTO comments(entity, record_id, user_id, body, created_at) VALUES (?,?,?,?,?)`, m[0], row.id, adminId(), `[AI · ${c.agent}] ${String(a.text).slice(0, 2000)}`, new Date().toISOString())
      return { ok: true }
    } },
  { name: 'create_lead', risk: 'internal', description: 'Register a new sales lead.', parameters: obj({ company: S('company name'), contact_name: S('person'), phone: S('phone / WhatsApp'), email: S('e-mail'), notes: S('what they need') }, ['company']),
    summarize: a => `Create lead: ${a.company}`, run: a => { const r = createRecord(getDef('leads'), { company: a.company, contact_name: a.contact_name ?? null, phone: a.phone ?? null, email: a.email ?? null, notes: a.notes ?? null, source: 'Other', status: 'New' }, SYSTEM_CTX); return { created: r._title, id: r.id } } },
  { name: 'add_job_event', risk: 'internal', description: 'Record an internal (not customer-visible) note in a job timeline.', parameters: obj({ job_no: S('job number'), description: S('note') }, ['job_no', 'description']),
    summarize: a => `Timeline note on ${a.job_no}`, run: a => { const j = jobByNo(a.job_no); if (!j) return { error: 'Job not found' }; addJobEvent(j.id, 'Note', { description: String(a.description).slice(0, 500), source: 'System', visible: false }); return { ok: true } } },
  { name: 'alert_team', risk: 'internal', description: 'Send an in-app alert to managers (and the owner on WhatsApp if configured). Use sparingly for urgent matters.', parameters: obj({ title: S('short headline'), message: S('details') }, ['title']),
    summarize: a => `Alert: ${a.title}`, run: async a => { notifyRole('ai', `AI alert: ${a.title}`, a.message ?? '', '/ai', 'alert'); await messageOwners(`⚠ ${a.title}${a.message ? '\n' + a.message : ''}`, 'agent', 'wa_tpl_notify'); return { ok: true } } },
  // ---------------- external (leaves the company)
  { name: 'send_email', risk: 'external', description: 'E-mail a customer, vendor or colleague (plain text). Always professional and concise; sign as the Elvora Shipping team.', parameters: obj({ to: S('recipient e-mail'), subject: S('subject'), body: S('message') }, ['to', 'subject', 'body']),
    summarize: a => `E-mail to ${a.to}: ${a.subject}`, run: a => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.to)) return { error: 'Invalid e-mail' }; return { queued_email_id: queueEmail({ to: a.to, subject: a.subject, body: a.body }) } } },
  { name: 'send_whatsapp', risk: 'external', description: 'Send a WhatsApp message to a phone number or to all contacts of a customer.', parameters: obj({ to: S('phone number in international format, or customer name'), text: S('message') }, ['to', 'text']),
    summarize: a => `WhatsApp to ${a.to}: ${String(a.text).slice(0, 80)}`,
    run: async a => { const nums = /^[\d+\s-]{7,}$/.test(String(a.to)) ? [a.to] : (() => { const p = partyByName(String(a.to)); return p ? phonesForParty(p.id).slice(0, 2) : [] })(); if (!nums.length) return { error: 'No phone found' }; const out = []; for (const n of nums) out.push(await sendWhatsApp(n, a.text, { origin: 'agent', tpl: 'wa_tpl_notify' })); return out } },
]
export const toolByName = (n: string) => TOOLS.find(t => t.name === n)
export const toolNow = nowLocal
