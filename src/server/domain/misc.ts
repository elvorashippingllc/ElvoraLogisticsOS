import crypto from 'node:crypto'
import { q } from '../db'
import type { Hooks } from '../hooks'
import { bad, r2, todayStr, nowLocal, addDays, safeJson } from '../util'
import { labelsFor, type Rec } from '../engine'
import { hashPassword, destroyUserSessions, validatePasswordStrength, newApiKey } from '../auth'
import { notify } from '../notify'
import { MODULE_DEFS } from '../../shared/entities'
import { ACTIONS } from '../../shared/types'

// ---------------------------------------------------------------- users & roles
function adminCount(excludeId?: number) {
  const rows = q.all(`SELECT u.id, r.permissions FROM users u JOIN roles r ON r.id = u.role_id WHERE u.deleted_at IS NULL AND u.active = 1 AND u.id <> ?`, excludeId ?? 0)
  return rows.filter(r => safeJson(r.permissions, {}) === '*').length
}
export const userHooks: Hooks = {
  beforeSave({ rec, old, isNew, ctx }) {
    if (rec.password) { validatePasswordStrength(String(rec.password)); rec.password_hash = hashPassword(String(rec.password)); rec.must_change_password = rec.must_change_password ?? false; rec.__pw = true }
    else if (isNew) throw bad('Set an initial password for the new user')
    delete rec.password
    if (rec.party_id) { const role = q.get(`SELECT name FROM roles WHERE id = ?`, rec.role_id); if (role?.name !== 'Customer Portal') throw bad('Portal company can only be set for users with the "Customer Portal" role') }
    if (old && ctx.user && old.id === ctx.user.id && rec.active === false) throw bad('You cannot deactivate your own account')
    if (old) {
      const wasAdmin = safeJson(q.val<string>(`SELECT permissions FROM roles WHERE id = ?`, old.role_id), {}) === '*' && old.active
      const stillAdmin = safeJson(q.val<string>(`SELECT permissions FROM roles WHERE id = ?`, rec.role_id), {}) === '*' && rec.active
      if (wasAdmin && !stillAdmin && adminCount(old.id) < 1) throw bad('At least one active full-access user must remain')
    }
  },
  afterSave({ rec }) { if ((rec as any).__pw) destroyUserSessions(rec.id) },
}
export const roleHooks: Hooks = {
  beforeSave({ rec, old }) {
    if (old?.is_system && rec.name !== old.name) throw bad('System roles cannot be renamed')
    let p = rec.permissions
    if (old?.is_system && JSON.stringify(p) !== JSON.stringify(old.permissions)) throw bad('Permissions of system roles cannot be changed — create a new role instead')
    if (p === null || p === undefined) { rec.permissions = {}; return }
    if (p !== '*') {
      if (typeof p !== 'object' || Array.isArray(p)) throw bad('Invalid permission set')
      const mods = new Set<string>(MODULE_DEFS.map(m => m[0]))
      for (const [m, acts] of Object.entries<any>(p)) {
        if (!mods.has(m)) throw bad(`Unknown module ${m}`)
        if (!Array.isArray(acts) || acts.some(a => !(ACTIONS as readonly string[]).includes(a))) throw bad(`Invalid actions for ${m}`)
      }
    }
    rec.permissions = p
  },
  beforeDelete({ rec }) { if (rec.is_system) throw bad('System roles cannot be deleted') },
}
export const branchHooks: Hooks = {
  beforeSave({ rec }) {
    rec.code = String(rec.code ?? '').toUpperCase().replace(/\s/g, '')
    if (!/^[A-Z0-9]{2,5}$/.test(rec.code)) throw bad('Branch code must be 2–5 letters / digits (it prefixes job numbers)')
  },
}

export const lastIssued: { key?: string } = {}
export const apiKeyHooks: Hooks = {
  beforeSave({ rec, isNew }) {
    if (isNew) { const k = newApiKey(); rec.key_hash = k.hash; rec.prefix = k.prefix; lastIssued.key = k.key }
  },
}
export const attachmentHooks: Hooks = {}

// ---------------------------------------------------------------- tasks, tickets, activities
export const taskHooks: Hooks = {
  beforeSave({ rec, old }) {
    if (rec.status === 'Done' && !rec.completed_at) rec.completed_at = nowLocal()
    if (rec.status !== 'Done') rec.completed_at = null
    if (rec.link_entity && rec.link_id && (!rec.link_label || old?.link_id !== rec.link_id)) {
      try { rec.link_label = labelsFor(rec.link_entity, [rec.link_id]).get(rec.link_id) ?? null } catch { /* unknown entity */ }
    }
  },
  afterSave({ rec, old, ctx }) {
    if (rec.assignee_id && rec.assignee_id !== ctx.user?.id && old?.assignee_id !== rec.assignee_id) notify(rec.assignee_id, `Task assigned: ${rec.title}`, rec.due_date ? `Due ${rec.due_date}` : '', rec.link_entity ? `/e/${rec.link_entity}/${rec.link_id}` : '/e/tasks', 'task')
  },
}
const SLA_HOURS: Record<string, number> = { Urgent: 4, High: 8, Medium: 24, Low: 72 }
export const ticketHooks: Hooks = {
  beforeSave({ rec, old }) {
    if (!rec.due_at) { const d = new Date(Date.now() + (SLA_HOURS[rec.priority] ?? 24) * 3600_000 + 4 * 3600_000); rec.due_at = d.toISOString().slice(0, 16) }
    if (['Resolved', 'Closed'].includes(rec.status)) { if (!rec.resolved_at) rec.resolved_at = nowLocal(); if (!rec.resolution) throw bad('Enter the resolution / root cause before resolving the ticket') }
    else rec.resolved_at = null
    void old
  },
  afterSave({ rec, old, ctx }) {
    if (rec.assigned_to && rec.assigned_to !== ctx.user?.id && old?.assigned_to !== rec.assigned_to) notify(rec.assigned_to, `Ticket ${rec.ticket_no} assigned`, rec.subject, `/e/tickets/${rec.id}`, 'assignment')
  },
}
export const activityHooks: Hooks = {
  beforeSave({ rec }) {
    if (rec.start_at && rec.end_at) { if (rec.end_at < rec.start_at) throw bad('End is before start'); rec.duration_min = Math.round((Date.parse(rec.end_at) - Date.parse(rec.start_at)) / 60000) }
    if (rec.type === 'Video call' && !rec.video_link) rec.video_link = `https://meet.jit.si/Elvora-${crypto.randomBytes(5).toString('hex')}`
  },
}

// ---------------------------------------------------------------- HR
function weekdays(from: string, to: string): number {
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) { const wd = new Date(d + 'T00:00:00Z').getUTCDay(); if (wd !== 0 && wd !== 6) n++ }
  return n
}
export const leaveHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    if (rec.to_date < rec.from_date) throw bad('"To" date is before "From" date')
    if (old && old.status !== 'Pending' && !ctx.system) throw bad(`A ${old.status.toLowerCase()} request cannot be edited`)
    rec.days = weekdays(rec.from_date, rec.to_date)
    if (rec.days <= 0) throw bad('The selected period contains no working days')
    const clash = q.get(`SELECT id FROM leave_requests WHERE employee_id = ? AND status IN ('Pending','Approved') AND deleted_at IS NULL AND id <> ? AND from_date <= ? AND to_date >= ?`, rec.employee_id, rec.id ?? 0, rec.to_date, rec.from_date)
    if (clash) throw bad('This overlaps another leave request for the employee')
    if (rec.type === 'Annual') {
      const emp = q.get(`SELECT annual_leave_days FROM employees WHERE id = ?`, rec.employee_id)
      const used = q.val<number>(`SELECT COALESCE(SUM(days),0) FROM leave_requests WHERE employee_id = ? AND type = 'Annual' AND status IN ('Pending','Approved') AND deleted_at IS NULL AND id <> ? AND substr(from_date,1,4) = ?`, rec.employee_id, rec.id ?? 0, rec.from_date.slice(0, 4)) ?? 0
      if (used + rec.days > (emp?.annual_leave_days ?? 30)) throw bad(`Exceeds annual leave entitlement (${emp?.annual_leave_days ?? 30} days; ${used} already booked)`)
    }
  },
  afterSave({ rec, isNew }) {
    if (isNew) { const e = q.get(`SELECT manager_id FROM employees WHERE id = ?`, rec.employee_id); const m = e?.manager_id ? q.get(`SELECT user_id FROM employees WHERE id = ?`, e.manager_id) : null; notify(m?.user_id, 'Leave request awaiting approval', `${rec.from_date} → ${rec.to_date}`, `/e/leave_requests/${rec.id}`, 'approval') }
  },
}
export const attendanceHooks: Hooks = {
  beforeSave({ rec }) {
    const dup = q.get(`SELECT id FROM attendance WHERE employee_id = ? AND att_date = ? AND deleted_at IS NULL AND id <> ?`, rec.employee_id, rec.att_date, rec.id ?? 0)
    if (dup) throw bad('Attendance already recorded for this employee on that date')
    if (rec.check_in && rec.check_out) { if (rec.check_out < rec.check_in) throw bad('Check-out is before check-in'); rec.hours = r2((Date.parse(rec.check_out) - Date.parse(rec.check_in)) / 3600000) }
    else rec.hours = 0
  },
}
export const payslipHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(rec.period)) throw bad('Period must be YYYY-MM')
    if (old && old.status === 'Paid' && !ctx.system) throw bad('A paid payslip cannot be edited')
    const dup = q.get(`SELECT id FROM payslips WHERE employee_id = ? AND period = ? AND deleted_at IS NULL AND id <> ?`, rec.employee_id, rec.period, rec.id ?? 0)
    if (dup) throw bad('A payslip already exists for this employee and period')
    rec.net_pay = r2((rec.basic ?? 0) + (rec.allowances ?? 0) + (rec.overtime ?? 0) - (rec.deductions ?? 0))
    if (rec.net_pay < 0) throw bad('Net pay cannot be negative')
    if (rec.status === 'Paid' && !rec.paid_on) rec.paid_on = todayStr()
  },
}
export function generatePayroll(period: string, ctx: any): { created: number; skipped: number } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw bad('Period must be YYYY-MM')
  const emps = q.all(`SELECT * FROM employees WHERE deleted_at IS NULL AND status IN ('Active','On leave','Probation')`)
  let created = 0, skipped = 0
  const [y, m] = period.split('-').map(Number)
  const first = `${period}-01`, last = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  for (const e of emps) {
    if (q.get(`SELECT id FROM payslips WHERE employee_id = ? AND period = ? AND deleted_at IS NULL`, e.id, period)) { skipped++; continue }
    const unpaid = q.all(`SELECT from_date, to_date FROM leave_requests WHERE employee_id = ? AND type = 'Unpaid' AND status = 'Approved' AND deleted_at IS NULL AND from_date <= ? AND to_date >= ?`, e.id, last, first)
    let days = 0
    for (const l of unpaid) days += weekdays(l.from_date < first ? first : l.from_date, l.to_date > last ? last : l.to_date)
    const basic = (e.basic_salary ?? 0) / 100, allow = ((e.housing_allowance ?? 0) + (e.transport_allowance ?? 0) + (e.other_allowance ?? 0)) / 100
    const ded = r2(((basic + allow) / 30) * days * (30 / 22))
    const now = new Date().toISOString()
    q.run(`INSERT INTO payslips(employee_id, period, basic, allowances, overtime, deductions, net_pay, unpaid_days, status, version, created_at, updated_at, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,'Draft',1,?,?,?,?)`,
      e.id, period, Math.round(basic * 100), Math.round(allow * 100), 0, Math.round(ded * 100), Math.round((basic + allow - ded) * 100), days, now, now, ctx.user?.id ?? null, ctx.user?.id ?? null)
    created++
  }
  return { created, skipped }
}

// ---------------------------------------------------------------- purchase orders
export const poHooks: Hooks = {
  numberDate: r => r.po_date,
  beforeSave({ rec, old, children, ctx }) {
    if (old && ['Ordered', 'Received', 'Cancelled'].includes(old.status) && !ctx.system && children.lines) throw bad(`A ${old.status.toLowerCase()} purchase order cannot be edited`)
    for (const l of children.lines ?? []) {
      l.qty = Number(l.qty ?? 1); l.rate = Number(l.rate ?? 0); l.vat_pct = Number(l.vat_pct ?? 5)
      l.amount = r2(l.qty * l.rate); l.vat_amount = r2(l.amount * l.vat_pct / 100)
    }
    if (old && old.status !== rec.status && ['Ordered', 'Received'].includes(rec.status) && !['Approved', 'Ordered'].includes(old.status) && !ctx.system) throw bad('Approve the purchase order before placing the order')
  },
  afterSave({ rec }) {
    const l = q.all(`SELECT amount, vat_amount FROM po_lines WHERE po_id = ? AND deleted_at IS NULL`, rec.id)
    const s = l.reduce((a, x) => a + (x.amount ?? 0), 0), v = l.reduce((a, x) => a + (x.vat_amount ?? 0), 0)
    q.run(`UPDATE purchase_orders SET subtotal = ?, vat_total = ?, total = ? WHERE id = ?`, s, v, s + v, rec.id)
  },
}

// ---------------------------------------------------------------- currencies
export const currencyHooks: Hooks = {
  beforeSave({ rec, old }) {
    rec.code = String(rec.code ?? '').toUpperCase()
    if (!/^[A-Z]{3}$/.test(rec.code)) throw bad('Currency code must be 3 letters')
    if (rec.code === 'AED') rec.rate = 1
    if (rec.rate !== null && rec.rate !== undefined && rec.rate <= 0) throw bad('Rate must be positive')
    if (rec.rate && (!old || old.rate !== rec.rate)) rec.rate_date = todayStr()
  },
  afterSave({ rec, old, ctx }) {
    if (rec.rate && (!old || old.rate !== rec.rate) && rec.code !== 'AED') {
      const now = new Date().toISOString()
      q.run(`INSERT INTO exchange_rates(currency, rate_date, rate, source, version, created_at, updated_at, created_by, updated_by) VALUES (?,?,?,?,1,?,?,?,?)`, rec.code, todayStr(), rec.rate, 'Manual update', now, now, ctx.user?.id ?? null, ctx.user?.id ?? null)
    }
  },
}
export type { Rec }
