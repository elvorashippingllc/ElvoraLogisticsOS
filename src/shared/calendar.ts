export const CALENDAR_CATEGORIES = {
  shipments: { label: 'Shipments', color: '#15526b', tint: '#dfecfa' },
  activities: { label: 'Calls & meetings', color: '#025e3d', tint: '#dcf1e6' },
  work: { label: 'Tasks & projects', color: '#493d72', tint: '#e8e3f7' },
  transport: { label: 'Transport', color: '#096673', tint: '#d4eeea' },
  finance: { label: 'Accounts & payments', color: '#8c4329', tint: '#f7ead8' },
  sales: { label: 'Sales & quotations', color: '#65441b', tint: '#f6e9c3' },
  people: { label: 'People & leave', color: '#493d72', tint: '#e8e3f7' },
  compliance: { label: 'Compliance', color: '#9b1424', tint: '#fbe1e4' },
  assets: { label: 'Assets & maintenance', color: '#344d77', tint: '#dfecfa' },
  warehouse: { label: 'Warehouse', color: '#096673', tint: '#d4eeea' },
  other: { label: 'Other records', color: '#3f4f47', tint: '#edf2ee' },
} as const
export type CalendarCategory = keyof typeof CALENDAR_CATEGORIES
export interface CalendarEvent {
  uid: string; id: number; entity: string; type: string; category: CalendarCategory
  color: string; title: string; start: string; end: string | null; link: string
  allDay: boolean; status: string; completed: boolean; deadline: boolean
  owner: string; ownerId: number | null; location: string; priority: string
}
// Calendar dates are company-local civil dates. UTC arithmetic avoids host timezone/DST shifts.
export const calendarDate = (date: Date) => date.toISOString().slice(0, 10)
export const dateAt = (date: string) => new Date(date + 'T00:00:00Z')
export function shiftDate(date: string, days: number) { const d = dateAt(date); d.setUTCDate(d.getUTCDate() + days); return calendarDate(d) }
export function companyToday(timezone = 'Asia/Dubai') {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = (type: string) => p.find(x => x.type === type)!.value
  return `${value('year')}-${value('month')}-${value('day')}`
}
export function calendarRange(anchor: string, view: 'month' | 'week' | 'day' | 'agenda') {
  if (view === 'day') return { from: anchor, to: anchor }
  if (view === 'agenda') return { from: anchor, to: shiftDate(anchor, 29) }
  const d = dateAt(view === 'month' ? anchor.slice(0, 8) + '01' : anchor)
  const from = shiftDate(calendarDate(d), -((d.getUTCDay() + 6) % 7))
  return { from, to: shiftDate(from, view === 'month' ? 41 : 6) }
}
export function eventOnDay(event: CalendarEvent, date: string) { return event.start.slice(0, 10) <= date && (event.end ?? event.start).slice(0, 10) >= date }
export function eventAlert(event: CalendarEvent, today: string): 'overdue' | 'today' | 'soon' | null {
  if (event.completed || !event.deadline) return null
  const due = (event.end ?? event.start).slice(0, 10)
  return due < today ? 'overdue' : due === today ? 'today' : due <= shiftDate(today, 3) ? 'soon' : null
}
