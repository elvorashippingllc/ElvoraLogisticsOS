import assert from 'node:assert/strict'
import { signInReady } from './login-ready'
import { calendarRange, eventOnDay, eventAlert, type CalendarEvent } from '../src/shared/calendar'
const base = process.env.BASE_URL ?? 'http://127.0.0.1:8080'
let checks = 0
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++ }
class Client {
  cookie = ''
  async login(email: string, password: string) { const r = await signInReady(base, { email, password }); check(r.ok, 'sign-in succeeds'); this.cookie = r.headers.get('set-cookie')!.split(';')[0] }
  async api(path: string, body?: unknown) { const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-elvora-client': 'web', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() as any } }
  async create(entity: string, body: unknown) { const r = await this.api('/api/e/' + entity, body); assert.equal(r.status, 201, JSON.stringify(r.data)); checks++; return r.data }
}
const admin = new Client(); await admin.login('admin@elvorashipping.com', 'Elvora@Admin2026')
const me = (await admin.api('/api/auth/me')).data
const branch = (await admin.api('/api/e/branches')).data.rows[0]
const customer = await admin.create('parties', { name: 'Calendar customer', is_customer: true })
const other = await admin.create('parties', { name: 'Other calendar customer', is_customer: true })
const job = await admin.create('jobs', { client_id: customer.id, branch_id: branch.id, department: 'AIR EXPORT', etd: '2026-02-01T10:00', eta: '2026-02-02T12:00', children: { containers: [{ container_no: 'MSCU1234566', free_time_until: '2026-02-01' }] } })
const otherJob = await admin.create('jobs', { client_id: other.id, branch_id: branch.id, department: 'AIR EXPORT', etd: '2026-02-01T14:00' })
const container = (await admin.api(`/api/e/jobs/${job.id}`)).data.children.containers[0]
const employee = await admin.create('employees', { name: 'Calendar employee', join_date: '2025-01-01' })
const leave = await admin.create('leave_requests', { employee_id: employee.id, type: 'Annual', from_date: '2026-01-30', to_date: '2026-02-03', reason: 'Calendar overlap check' })
const meeting = await admin.create('activities', { subject: 'Spanning month boundary', type: 'Meeting', start_at: '2026-01-31T10:00', end_at: '2026-02-02T11:00', status: 'Planned', owner_id: me.id })
await admin.create('activities', { subject: 'Single call without end', type: 'Call', start_at: '2026-02-01T09:00', status: 'Planned' })
await admin.create('activities', { subject: 'Cancelled calendar meeting', type: 'Meeting', start_at: '2026-02-01T11:00', status: 'Cancelled' })
const task = await admin.create('tasks', { title: 'Calendar payment chase', due_date: '2026-02-01', priority: 'Urgent', assignee_id: me.id })
await admin.create('tasks', { title: 'Completed calendar task', due_date: '2026-02-01', status: 'Done' })
const project = await admin.create('projects', { name: 'Spanning project', start_date: '2026-01-25', end_date: '2026-02-05' })
const events = (await admin.api('/api/calendar?from=2026-02-01&to=2026-02-01')).data as CalendarEvent[]
check(Array.isArray(events), 'calendar response remains an array')
check(events.some(e => e.entity === 'job_containers' && e.id === container.id && e.deadline && e.link === `/jobs/${job.id}`), 'container deadline links to parent job')
check(events.some(e => e.entity === 'leave_requests' && e.id === leave.id && e.title.includes('Calendar employee')), 'overlapping leave shows employee name')
check(events.some(e => e.type === 'ETD' && e.id === job.id), 'shipment departure retained')
check(events.some(e => e.entity === 'activities' && e.id === meeting.id), 'overlapping meeting included even when it starts outside range')
check(events.some(e => e.entity === 'projects' && e.id === project.id), 'project duration overlaps range')
check(events.some(e => e.title.includes('Single call without end')), 'activity without end included')
check(!events.some(e => e.title.includes('Cancelled calendar meeting')), 'cancelled activity excluded')
check(events.some(e => e.title.includes('Completed calendar task') && e.completed), 'completed events labelled for optional history')
const taskEvent = events.find(e => e.entity === 'tasks' && e.id === task.id)!
check(taskEvent.ownerId === me.id && taskEvent.priority === 'Urgent' && taskEvent.deadline, 'assignment, priority and deadline preserved')
check(new Set(events.map(e => e.uid)).size === events.length, 'stable event identities without duplicates')
const role = await admin.create('roles', { name: 'Calendar limited', permissions: { dashboard: ['view'], projects: ['view'] } })
await admin.create('users', { name: 'Calendar limited', email: 'calendar-limited@example.test', password: 'Calendar@Test2026', role_id: role.id, active: true })
const limited = new Client(); await limited.login('calendar-limited@example.test', 'Calendar@Test2026')
const limitedEvents = (await limited.api('/api/calendar?from=2026-02-01&to=2026-02-01')).data as CalendarEvent[]
check(limitedEvents.some(e => e.entity === 'tasks'), 'authorized tasks visible')
check(!limitedEvents.some(e => ['jobs', 'activities', 'invoices', 'employees'].includes(e.entity)), 'unauthorized modules excluded')
check((await limited.api('/api/e/activities', { subject: 'Forbidden', type: 'Meeting' })).status === 403, 'scheduling requires create permission')
const portalRole = (await admin.api('/api/e/roles')).data.rows.find((r: any) => r.name === 'Customer Portal')
await admin.create('users', { name: 'Calendar portal', email: 'calendar-portal@example.test', password: 'Calendar@Test2026', role_id: portalRole.id, party_id: customer.id, active: true })
const portal = new Client(); await portal.login('calendar-portal@example.test', 'Calendar@Test2026')
const portalEvents = (await portal.api('/api/calendar?from=2026-02-01&to=2026-02-01')).data as CalendarEvent[]
check(portalEvents.some(e => e.entity === 'jobs' && e.id === job.id), 'portal sees its own shipment')
check(!portalEvents.some(e => e.entity === 'jobs' && e.id === otherJob.id), 'portal cannot see another customer shipment')
check(!portalEvents.some(e => ['activities', 'tasks', 'projects'].includes(e.entity)), 'portal cannot see internal schedules')
check((await admin.api('/api/calendar?from=2026-02-30&to=2026-03-01')).status === 400, 'invalid dates rejected')
check((await admin.api('/api/calendar?from=2026-03-02&to=2026-03-01')).status === 400, 'reversed range rejected')
check((await admin.api('/api/calendar?from=2026-01-01&to=2027-01-01')).status === 400, 'oversized range rejected')
assert.deepEqual(calendarRange('2026-02-01', 'week'), { from: '2026-01-26', to: '2026-02-01' }); checks++
assert.deepEqual(calendarRange('2026-03-31', 'agenda'), { from: '2026-03-31', to: '2026-04-29' }); checks++
check(eventOnDay(events.find(e => e.id === meeting.id && e.entity === 'activities')!, '2026-02-01'), 'multi-day event visible on middle day')
check(eventAlert(taskEvent, '2026-02-02') === 'overdue', 'unfinished due task flagged overdue')
check(eventAlert({ ...taskEvent, completed: true }, '2026-02-02') === null, 'completed task has no deadline alert')
console.log(`Calendar: ${checks} checks passed (overlap, schedules, date ranges, permissions, customer isolation, assignment and urgency).`)
