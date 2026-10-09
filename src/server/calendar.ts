import { HttpError } from './util'
import { ENTITIES } from '../shared/entities'
import type { CalendarCategory, CalendarEvent } from '../shared/calendar'
import { CALENDAR_CATEGORIES } from '../shared/calendar'
import { can, getRecord, listRecords, type Ctx } from './engine'

const categoryFor: Record<string, CalendarCategory> = { jobs: 'shipments', documents: 'shipments', crm: 'activities', projects: 'work', transport: 'transport', finance: 'finance', sales: 'sales', hr: 'people', compliance: 'compliance', assets: 'assets', warehouse: 'warehouse' }
const specialTypes: Record<string, string> = { 'jobs.etd': 'ETD', 'jobs.eta': 'ETA', 'invoices.due_date': 'Invoice due', 'bills.due_date': 'Bill due', 'quotations.valid_until': 'Quote expiry', 'contracts.end_date': 'Contract end', 'tasks.due_date': 'Task', 'transport_orders.pickup_at': 'Trip', 'leave_requests.from_date': 'Leave' }
const spanEnd: Record<string, string> = { activities: 'end_at', leave_requests: 'to_date', projects: 'end_date' }
const finished = new Set(['done', 'completed', 'closed', 'paid', 'cancelled', 'canceled', 'void', 'voided', 'rejected', 'disposed', 'filed', 'renewed', 'delivered', 'empty returned'])

export function calendarEvents(from: string, to: string, ctx: Ctx): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const readableParents = new Map<string, boolean>()
  for (const def of Object.values(ENTITIES)) {
    if (!can(ctx.user, def.module, 'view')) continue
    const parent = def.child ? Object.values(ENTITIES).find(p => p.children?.some(c => c.entity === def.key)) : undefined
    const parentLink = parent?.children?.find(c => c.entity === def.key)
    if (def.child && !parentLink) continue
    // Use the normal record engine: portal, branch and record-specific scoping remain enforced.
    for (const field of def.fields.filter(f => ['date', 'datetime'].includes(f.type) && !f.hidden && !f.secret && !f.virtual)) {
      const spanStart = def.calendar?.field ?? (def.key === 'projects' ? 'start_date' : undefined)
      const endField = spanStart === field.name ? spanEnd[def.key] : undefined
      if (field.name === spanEnd[def.key] && spanStart) continue
      const filters = endField
        ? [{ field: field.name, op: 'lte' as const, value: to + 'T23:59:59' }, { field: endField, op: 'gte' as const, value: from }]
        : [{ field: field.name, op: 'gte' as const, value: from }, { field: field.name, op: 'lte' as const, value: to + 'T23:59:59' }]
      // An activity with no end is still a single event; fetch its start-in-range separately.
      const batches = [listRecords(def, { filters, pageSize: 100000 }, ctx).rows]
      if (endField) batches.push(listRecords(def, { filters: [{ field: field.name, op: 'gte', value: from }, { field: field.name, op: 'lte', value: to + 'T23:59:59' }, { field: endField, op: 'null' }], pageSize: 100000 }, ctx).rows)
      const seen = new Set<number>()
      for (const record of batches.flat()) {
        if (seen.has(record.id)) continue
        seen.add(record.id)
        if (parent && parentLink) {
          const parentId = Number(record[parentLink.fk]), key = `${parent.key}:${parentId}`
          if (!readableParents.has(key)) {
            try { getRecord(parent, parentId, ctx, { children: false }); readableParents.set(key, true) }
            catch (error) { if (error instanceof HttpError && [403, 404].includes(error.status)) readableParents.set(key, false); else throw error }
          }
          if (!readableParents.get(key)) continue
        }
        const status = String(record[def.statusField ?? (def.key === 'jobs' ? 'job_status' : 'status')] ?? '')
        if (['cancelled', 'canceled', 'void', 'voided', 'rejected'].includes(status.toLowerCase())) continue
        const category = def.module === 'crm' && def.key !== 'activities' ? 'sales' : categoryFor[def.module] ?? 'other'
        const type = def.key === 'activities' && field.name === 'start_at' ? String(record.type) : specialTypes[`${def.key}.${field.name}`] ?? `${def.label} · ${field.label}`
        const ownerField = ['assignee_id', 'owner_id', 'operator_id', 'manager_id', 'assigned_to', 'user_id', 'requested_by'].find(name => record[name])
        const date = String(record[field.name])
        const title = def.key === 'leave_requests' ? `${record._labels?.employee_id ?? 'Employee'} · ${record.type} leave` : record._title ?? '#' + record.id
        events.push({ uid: `${def.key}:${record.id}:${field.name}`, id: record.id, entity: def.key, category, type,
          color: CALENDAR_CATEGORIES[category].color, title: `${type}: ${title}`,
          start: date, end: endField && record[endField] ? String(record[endField]) : null,
          link: parent && parentLink ? (parent.key === 'jobs' ? `/jobs/${record[parentLink.fk]}` : `/e/${parent.key}/${record[parentLink.fk]}`) : def.key === 'jobs' ? `/jobs/${record.id}` : `/e/${def.key}/${record.id}`,
          allDay: field.type === 'date', status, completed: finished.has(status.toLowerCase()),
          deadline: /due|deadline|expir|valid_until|end_date|next_service|next_maintenance|next_due|free_time_until|cutoff|cut_off|return_due/.test(field.name) || endField === 'end_date',
          owner: ownerField ? String(record._labels?.[ownerField] ?? '') : '', ownerId: ownerField && def.fields.find(f => f.name === ownerField)?.ref === 'users' ? Number(record[ownerField]) : null,
          location: String(record.location ?? record.pickup_location ?? record.delivery_location ?? ''), priority: String(record.priority ?? '') })
      }
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid))
}
