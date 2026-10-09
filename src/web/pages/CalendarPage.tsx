import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Search, Bell, Clock, ArrowUpRight, MapPin, User, AlertTriangle } from 'lucide-react'
import { get, post } from '../lib/api'
import { useMeta } from '../lib/meta'
import { PageHeader, Modal, Empty, ErrorBox, Loading } from '../ui/kit'
import { cls, fmtDate, fmtDateTime } from '../lib/format'
import { CALENDAR_CATEGORIES, calendarRange, companyToday, dateAt, calendarDate, shiftDate, eventAlert, type CalendarEvent, type CalendarCategory } from '@shared/calendar'

type View = 'month' | 'week' | 'day' | 'agenda'
type Notice = { id: number; title: string; body: string; link: string | null; read_at: string | null }
const labelDate = (date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) => dateAt(date).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
const palette = (event: CalendarEvent) => ({ '--event-color': CALENDAR_CATEGORIES[event.category].color, '--event-tint': CALENDAR_CATEGORIES[event.category].tint } as CSSProperties)

export function CalendarPage() {
  const { can, me } = useMeta(), client = useQueryClient()
  const context = useQuery({ queryKey: ['calendar-context'], queryFn: () => get<{ today: string; timezone: string }>('/api/calendar/context'), refetchInterval: 60000 })
  const today = context.data?.today ?? companyToday(), timezone = context.data?.timezone ?? 'Asia/Dubai'
  const [anchor, setAnchor] = useState(companyToday), [selected, setSelected] = useState(companyToday)
  const [view, setView] = useState<View>('month'), [query, setQuery] = useState(''), [category, setCategory] = useState<CalendarCategory | 'all'>('all')
  const [noticeError, setNoticeError] = useState<Error | null>(null)
  const [mine, setMine] = useState(false), [completed, setCompleted] = useState(false), [alertsOnly, setAlertsOnly] = useState(false), [scheduling, setScheduling] = useState(false)
  const range = calendarRange(anchor, view)
  const q = useQuery({ queryKey: ['calendar', range.from, range.to], queryFn: () => get<CalendarEvent[]>('/api/calendar', range), refetchInterval: 60000 })
  const notices = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ unread: number; rows: Notice[] }>('/api/notifications'), refetchInterval: 60000 })
  const events = useMemo(() => (q.data ?? []).filter(e => (completed || !e.completed) && (category === 'all' || e.category === category) && (!mine || e.ownerId === me?.id) && (!alertsOnly || eventAlert(e, today)) && `${e.title} ${e.owner} ${e.status} ${e.location}`.toLowerCase().includes(query.trim().toLowerCase())), [q.data, completed, category, mine, alertsOnly, me?.id, query, today])
  const dates = Array.from({ length: Math.round((+dateAt(range.to) - +dateAt(range.from)) / 86400000) + 1 }, (_, i) => shiftDate(range.from, i))
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const start = event.start.slice(0, 10) < range.from ? range.from : event.start.slice(0, 10)
      const end = (event.end ?? event.start).slice(0, 10) > range.to ? range.to : (event.end ?? event.start).slice(0, 10)
      for (let date = start; date <= end; date = shiftDate(date, 1)) map.set(date, [...(map.get(date) ?? []), event])
    }
    return map
  }, [events, range.from, range.to])
  const selectedDate = selected >= range.from && selected <= range.to ? selected : anchor
  const selectedEvents = byDay.get(selectedDate) ?? []
  const deadlines = events.filter(e => eventAlert(e, today))
  const unread = (notices.data?.rows ?? []).filter(n => !n.read_at)
  const chooseDate = (date: string) => { setAnchor(date); setSelected(date) }
  const move = (dir: number) => {
    if (view === 'month') { const d = dateAt(anchor); chooseDate(calendarDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1)))) }
    else chooseDate(shiftDate(anchor, dir * (view === 'week' ? 7 : view === 'agenda' ? 30 : 1)))
  }
  const resetFilters = () => { setQuery(''); setCategory('all'); setMine(false); setCompleted(false); setAlertsOnly(false) }
  const period = view === 'month' ? labelDate(anchor, { month: 'long', year: 'numeric' }) : view === 'day' ? labelDate(anchor) : `${labelDate(range.from, { day: 'numeric', month: 'short' })} – ${labelDate(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}`
  return <div className="calendar-page fade-in">
    <PageHeader icon={<CalendarDays size={22} />} title="Company calendar" subtitle={`Schedules, shipment movements and business deadlines · ${timezone}`} actions={(can('crm', 'create') || can('projects', 'create')) && <button className="btn green" onClick={() => setScheduling(true)}><Plus />Schedule activity</button>} />
    <div className="calendar-summary" aria-label="Calendar summary"><span><CalendarDays size={18} /><strong>{events.length}</strong> events in view</span><button className={cls(alertsOnly && 'active')} onClick={() => setAlertsOnly(v => !v)} aria-pressed={alertsOnly}><AlertTriangle size={18} /><strong>{deadlines.filter(e => eventAlert(e, today) === 'overdue').length}</strong> overdue · <strong>{deadlines.filter(e => eventAlert(e, today) !== 'overdue').length}</strong> due within 3 days</button><span><Bell size={18} /><strong>{notices.data?.unread ?? 0}</strong> unread alerts</span></div>
    <section className="calendar-controls" aria-label="Calendar controls">
      <div className="calendar-period"><div className="calendar-period-buttons"><button className="btn outline icon" onClick={() => move(-1)} aria-label={`Previous ${view === 'agenda' ? '30 days' : view}`}><ChevronLeft /></button><button className="btn outline" onClick={() => chooseDate(today)}>Today</button><button className="btn outline icon" onClick={() => move(1)} aria-label={`Next ${view === 'agenda' ? '30 days' : view}`}><ChevronRight /></button></div><h2 aria-live="polite">{period}</h2><label className="calendar-date-jump">Go to date<input aria-label="Go to date" className="input" type="date" value={anchor} onChange={e => e.target.value && chooseDate(e.target.value)} /></label></div>
      <div className="calendar-filter-row"><div className="calendar-views" role="group" aria-label="Calendar view">{(['month', 'week', 'day', 'agenda'] as View[]).map(v => <button key={v} className={cls(view === v && 'active')} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div><label className="calendar-search"><Search size={18} /><input className="input" aria-label="Search calendar" placeholder="Search events, owners or locations" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="calendar-category-label">Activity group<select className="select" aria-label="Activity group" value={category} onChange={e => setCategory(e.target.value as CalendarCategory | 'all')}><option value="all">All activities</option>{Object.entries(CALENDAR_CATEGORIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label></div>
      <div className="calendar-options"><label><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />Assigned to me</label><label><input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />Include completed</label><label><input type="checkbox" checked={alertsOnly} onChange={e => setAlertsOnly(e.target.checked)} />Deadline alerts only</label><button className="btn ghost sm" onClick={resetFilters}>Clear filters</button>{q.isFetching && !q.isPending && <span className="text-muted">Updating…</span>}</div>
    </section>
    <div className="calendar-legend" aria-label="Activity colors">{Object.entries(CALENDAR_CATEGORIES).filter(([key]) => (q.data ?? []).some(e => e.category === key)).map(([key, value]) => <button key={key} style={{ '--event-color': value.color, '--event-tint': value.tint } as CSSProperties} onClick={() => setCategory(category === key ? 'all' : key as CalendarCategory)} aria-pressed={category === key}><span className="calendar-dot" />{value.label}</button>)}</div>
    {q.isError ? <ErrorBox error={q.error} onRetry={() => void q.refetch()} /> : q.isPending ? <Loading label="Loading calendar…" /> : <div className="calendar-layout">
      <section className="calendar-main" aria-label={`${view} schedule`}>
        {(view === 'month' || view === 'week') ? <div className={cls('calendar-board', view === 'week' && 'calendar-week')}>
          <div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}</div>
          <div className="calendar-grid">{dates.map(date => { const list = byDay.get(date) ?? []; return <div key={date} className={cls('calendar-cell', date.slice(0, 7) !== anchor.slice(0, 7) && view === 'month' && 'other-month', selectedDate === date && 'selected', today === date && 'is-today')}><button className="calendar-day-number" aria-label={`${labelDate(date)}, ${list.length} events`} aria-pressed={selectedDate === date} onClick={() => setSelected(date)}><span>{Number(date.slice(-2))}</span>{date === today && <small>Today</small>}</button><div className="calendar-cell-events">{list.slice(0, view === 'week' ? 12 : 3).map(e => <button className="calendar-event-chip" style={palette(e)} key={e.uid} onClick={() => setSelected(date)} title={`${e.title} · ${e.status}`}><span className="calendar-dot" />{!e.allDay && <time>{e.start.slice(11, 16)}</time>}<span>{e.title}</span>{eventAlert(e, today) === 'overdue' && <AlertTriangle size={12} />}</button>)}</div>{list.length > (view === 'week' ? 12 : 3) && <button className="calendar-more" onClick={() => setSelected(date)}>+{list.length - (view === 'week' ? 12 : 3)} more</button>}<button className="calendar-mobile-count" onClick={() => setSelected(date)} aria-label={`View ${list.length} events on ${labelDate(date)}`}>{list.length > 0 ? <><span>{list.length} events</span><span className="calendar-mobile-dots" aria-hidden="true">{[...new Set(list.map(e => e.category))].slice(0, 4).map(c => <span key={c} className="calendar-dot" style={{ '--event-color': CALENDAR_CATEGORIES[c].color, '--event-tint': CALENDAR_CATEGORIES[c].tint } as CSSProperties} />)}</span></> : '—'}</button></div> })}</div>
        </div> : <div className="calendar-agenda">{events.length === 0 ? <Empty title="No matching events" hint="Try another date or clear your filters." action={<button className="btn outline" onClick={resetFilters}>Clear filters</button>} /> : dates.filter(date => byDay.has(date)).map(date => <section key={date}><h3>{labelDate(date)}{date === today && <span>Today</span>}</h3>{(byDay.get(date) ?? []).map(e => <EventRow key={e.uid} event={e} today={today} />)}</section>)}</div>}
      </section>
      <aside className="calendar-side" aria-label="Schedule details and alerts">
        {(view === 'month' || view === 'week') && <section className="calendar-day-detail"><header><CalendarDays size={20} /><div><h2>{labelDate(selectedDate)}</h2><p>{selectedEvents.length} events · {timezone}</p></div></header>{selectedEvents.length ? selectedEvents.map(e => <EventRow key={e.uid} event={e} today={today} />) : <Empty title="No matching events this day" hint="Select another day or schedule an activity." />}</section>}
        <section className="calendar-alert-panel"><header><Bell size={20} /><h2>Your alerts</h2></header><p className="calendar-panel-hint">Unread notifications for your account, across all dates.</p>{noticeError && <ErrorBox error={noticeError} />}{notices.isError ? <ErrorBox error={notices.error} onRetry={() => void notices.refetch()} /> : notices.isPending ? <Loading /> : unread.length ? unread.slice(0, 8).map(n => <article key={n.id}><strong>{n.title}</strong>{n.body && <p>{n.body}</p>}<div>{n.link && <Link className="link" to={n.link}>Open record <ArrowUpRight size={14} /></Link>}<button className="btn ghost sm" onClick={async () => { setNoticeError(null); try { await post('/api/notifications/read', { ids: [n.id] }); void client.invalidateQueries({ queryKey: ['notifications'] }) } catch (err) { setNoticeError(err as Error) } }}>Mark read</button></div></article>) : <p className="calendar-panel-hint">You're all caught up.</p>}{(notices.data?.unread ?? 0) > 8 && <p className="calendar-panel-hint">More alerts are available in the notification bell above.</p>}</section>
      </aside>
    </div>}
    <p className="calendar-footnote">Includes dated records you can access. Colors identify activity groups; labels show status and deadline urgency. Alerts refresh every minute while this page is open.</p>
    <ScheduleModal open={scheduling} date={selectedDate} timezone={timezone} onClose={() => setScheduling(false)} onSaved={(date) => { chooseDate(date); setScheduling(false); void client.invalidateQueries({ queryKey: ['calendar'] }); void client.invalidateQueries({ queryKey: ['dashboard'] }) }} />
  </div>
}

function EventRow({ event: e, today }: { event: CalendarEvent; today: string }) {
  const alert = eventAlert(e, today)
  return <article className="calendar-event-row" style={palette(e)}><div className="calendar-event-meta"><span className="calendar-type"><span className="calendar-dot" />{e.type}</span>{alert && <span className={cls('calendar-urgency', alert === 'overdue' && 'overdue')}>{alert === 'overdue' ? 'Overdue' : alert === 'today' ? 'Due today' : 'Due soon'}</span>}</div><Link to={e.link} className="calendar-event-title">{e.title}<ArrowUpRight size={16} /></Link><div className="calendar-event-facts"><span><Clock size={14} />{e.allDay ? 'All day · ' + fmtDate(e.start) : fmtDateTime(e.start)}{e.end && e.end !== e.start && <> – {e.allDay ? fmtDate(e.end) : fmtDateTime(e.end)}</>}</span>{e.owner && <span><User size={14} />{e.owner}</span>}{e.location && <span><MapPin size={14} />{e.location}</span>}</div><div className="calendar-event-status">{e.status || 'Scheduled'}{e.priority && <> · {e.priority} priority</>}{e.completed && ' · Completed'}</div></article>
}

function ScheduleModal({ open, date, timezone, onClose, onSaved }: { open: boolean; date: string; timezone: string; onClose: () => void; onSaved: (date: string) => void }) {
  return <Modal open={open} onClose={onClose} title="Schedule activity" width={620}>{open && <ScheduleForm key={date} date={date} timezone={timezone} onSaved={onSaved} />}</Modal>
}
function ScheduleForm({ date, timezone, onSaved }: { date: string; timezone: string; onSaved: (date: string) => void }) {
  const { can, me } = useMeta()
  const [kind, setKind] = useState(can('crm', 'create') ? 'Meeting' : 'Task'), [title, setTitle] = useState(''), [start, setStart] = useState(date + 'T09:00'), [end, setEnd] = useState(''), [notes, setNotes] = useState(''), [location, setLocation] = useState(''), [priority, setPriority] = useState('Medium')
  const [busy, setBusy] = useState(false), [error, setError] = useState<Error | null>(null)
  const task = kind === 'Task'
  const save = async (e: FormEvent) => { e.preventDefault(); setError(null); if (!title.trim()) { setError(new Error('Enter a title.')); return } if (!task && end && end <= start) { setError(new Error('End time must be after the start time.')); return } setBusy(true); try { await post('/api/e/' + (task ? 'tasks' : 'activities'), task ? { title: title.trim(), due_date: start.slice(0, 10), assignee_id: me?.id, priority, status: 'To do', description: notes } : { subject: title.trim(), type: kind, start_at: start, end_at: end || null, owner_id: me?.id, status: 'Planned', location, notes }); onSaved(start.slice(0, 10)) } catch (err) { setError(err as Error) } finally { setBusy(false) } }
  return <form className="calendar-schedule-form" onSubmit={e => void save(e)}><p className="text-muted">Saved to the OS and assigned to you. Dates and times use {timezone}.</p>{error && <ErrorBox error={error} />}<fieldset disabled={busy}><label>Activity type<select className="select" value={kind} onChange={e => setKind(e.target.value)}>{can('crm', 'create') && ['Meeting', 'Call', 'Video call', 'Visit'].map(k => <option key={k}>{k}</option>)}{can('projects', 'create') && <option>Task</option>}</select></label><label>Title<input className="input" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label><div className="calendar-form-dates"><label>{task ? 'Due date' : 'Start'}<input className="input" type={task ? 'date' : 'datetime-local'} required value={task ? start.slice(0, 10) : start} onChange={e => setStart(task ? e.target.value + 'T09:00' : e.target.value)} /></label>{!task && <label>End (optional)<input className="input" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} min={start} /></label>}</div>{task ? <label>Priority<select className="select" value={priority} onChange={e => setPriority(e.target.value)}>{['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}</select></label> : <label>Location / meeting link<input className="input" value={location} onChange={e => setLocation(e.target.value)} /></label>}<label>Details<textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label><button className="btn green" type="submit">{busy ? 'Saving…' : 'Save activity'}</button></fieldset></form>
}
