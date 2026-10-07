import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { get } from '../lib/api'
import { PageHeader } from '../ui/kit'
import { cls } from '../lib/format'

const iso = (d: Date) => d.toLocaleDateString('sv-SE')
export function CalendarPage() {
  const nav = useNavigate()
  const [cur, setCur] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const days = useMemo(() => { const first = new Date(cur); const off = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - off); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d }) }, [cur])
  const from = iso(days[0]), to = iso(days[41])
  const q = useQuery({ queryKey: ['calendar', from, to], queryFn: () => get<any[]>('/api/calendar', { from, to }) })
  const byDay = useMemo(() => { const m = new Map<string, any[]>(); for (const e of q.data ?? []) { const k = String(e.start).slice(0, 10); (m.get(k) ?? m.set(k, []).get(k)!).push(e) } return m }, [q.data])
  const types = [...new Map((q.data ?? []).map(e => [e.type, e.color])).entries()]
  const today = iso(new Date())
  return (
    <div className="fade-in">
      <PageHeader icon={<CalendarDays size={20} />} title={cur.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} subtitle="ETD / ETA, calls & meetings, tasks, trips, leave, invoice and bill due dates, contract and quotation expiries" actions={<><button className="btn outline icon" onClick={() => setCur(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft /></button><button className="btn outline" onClick={() => { const d = new Date(); d.setDate(1); setCur(d) }}>Today</button><button className="btn outline icon" onClick={() => setCur(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight /></button></>} />
      <div className="flex gap-3 flex-wrap mb-3 text-xs">{types.map(([t, c]) => <span key={t} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{t}</span>)}</div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 text-center text-xs font-bold text-muted bg-soft border-b border-line">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="py-2">{d}</div>)}</div>
        <div className="grid grid-cols-7">{days.map(d => { const k = iso(d), evs = byDay.get(k) ?? [], other = d.getMonth() !== cur.getMonth()
          return <div key={k} className={cls('min-h-[104px] border-b border-r border-line p-1.5', other && 'bg-soft/60', k === today && 'bg-mint/60')}><div className={cls('text-xs font-bold mb-1', other ? 'text-muted' : 'text-ink', k === today && 'text-fold')}>{d.getDate()}</div>
            <div className="grid gap-0.5">{evs.slice(0, 4).map((e, i) => <button key={i} className="text-start text-[11px] leading-tight px-1.5 py-1 rounded border-0 cursor-pointer text-white truncate font-semibold" style={{ background: e.color, color: e.color === '#E5D1A4' ? '#161d1a' : '#fff' }} title={e.title} onClick={() => nav(e.link)}>{e.title}</button>)}{evs.length > 4 && <div className="text-[11px] text-muted px-1">+{evs.length - 4} more</div>}</div></div> })}</div>
      </div>
    </div>
  )
}
