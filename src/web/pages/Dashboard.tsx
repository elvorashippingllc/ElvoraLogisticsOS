import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bot, Plus, ArrowRight, AlertTriangle, Info, TriangleAlert, Plane, Ship } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { get } from '../lib/api'
import { useMeta } from '../lib/meta'
import { Badge, ErrorBox, Kpi, Loading, Panel, Empty } from '../ui/kit'
import { fmtCompact, fmtDate, fmtDateTime, fmtMoney, cls } from '../lib/format'

const C = { emerald: '#007B52', ocean: '#15526B', teal: '#0F7F8C', aviation: '#344D77', copper: '#8C4329', violet: '#493D72', champagne: '#E5D1A4', red: '#C32135', graphite: '#161D1A' }
const PIE = [C.emerald, C.ocean, C.copper, C.violet, C.teal, C.aviation, C.champagne]
const money = (v: any) => fmtMoney(Number(v), 0)

export function Dashboard() {
  const { me, can, meta } = useMeta()
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<any>('/api/dashboard'), refetchInterval: 120000 })
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <Loading />
  const d = q.data, k = d.kpis ?? {}
  const base = meta?.settings.base_currency ?? 'AED'

  if (d.portal) return (
    <div className="fade-in">
      <Welcome name={me?.name} portal />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"><Kpi label="Open shipments" value={k.open_jobs} /><Kpi label="Delivered" value={k.delivered} /><Kpi label={`Outstanding (${base})`} value={fmtMoney(k.outstanding)} /></div>
      <Panel title="Your recent shipments" color={C.teal} bodyClass="table-wrap"><table className="grid"><thead><tr><th>Job No</th><th>POL</th><th>POD</th><th>ETD</th><th>ETA</th><th>Status</th></tr></thead><tbody>{d.recent_jobs.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td><Link className="link" to={`/jobs/${j.id}`}>{j.job_no}</Link></td><td>{j.pol}</td><td>{j.pod}</td><td>{fmtDateTime(j.etd)}</td><td>{fmtDateTime(j.eta)}</td><td><Badge value={j.operational_status ?? j.job_status} /></td></tr>)}</tbody></table></Panel>
    </div>
  )

  const tiles: { label: string; value: any; hint?: any; tone?: any; to?: string; show: boolean }[] = [
    { label: 'Open jobs', value: k.open_jobs, hint: `${k.jobs_month ?? 0} opened this month`, to: '/e/jobs?status=OPENED', show: k.open_jobs !== undefined },
    { label: 'In transit', value: k.in_transit, to: '/e/jobs?status=IN%20PROGRESS', show: k.in_transit !== undefined },
    { label: `Revenue this month (${base})`, value: fmtMoney(k.revenue_month, 0), hint: `Job profit ${fmtMoney(k.profit_month, 0)}`, show: k.revenue_month !== undefined },
    { label: `Receivables (${base})`, value: fmtMoney(k.ar_outstanding, 0), hint: k.ar_overdue > 0 ? `${fmtMoney(k.ar_overdue, 0)} overdue` : 'Nothing overdue', tone: k.ar_overdue > 0 ? 'amber' : undefined, to: '/reports?r=ar_aging', show: k.ar_outstanding !== undefined },
    { label: `Payables (${base})`, value: fmtMoney(k.ap_outstanding, 0), to: '/reports?r=ap_aging', show: k.ap_outstanding !== undefined },
    { label: `Cash & bank (${base})`, value: fmtMoney(k.cash, 0), to: '/e/bank_accounts', show: k.cash !== undefined },
    { label: `Unbilled work (${base})`, value: fmtMoney(k.unbilled, 0), tone: k.unbilled > 0 ? 'amber' : undefined, to: '/reports?r=unbilled_charges', show: k.unbilled !== undefined },
    { label: 'Open quotations', value: k.quotes_open, to: '/e/quotations', show: k.quotes_open !== undefined },
    { label: 'New leads', value: k.leads_new, hint: `Pipeline ${fmtMoney(k.pipeline, 0)}`, to: '/e/leads', show: k.leads_new !== undefined },
    { label: 'Open tickets', value: k.tickets_open, to: '/e/tickets', show: k.tickets_open !== undefined },
    { label: 'My open tasks', value: k.my_tasks, to: '/e/tasks', show: k.my_tasks !== undefined },
    { label: 'Low-stock items', value: k.low_stock, tone: k.low_stock > 0 ? 'red' : undefined, to: '/warehouse/stock?low=1', show: k.low_stock !== undefined },
  ].filter(t => t.show)

  const ch = d.charts ?? {}, ls = d.lists ?? {}
  return (
    <div className="fade-in">
      <Welcome name={me?.name} />
      {can('ai', 'view') && <AiBrief />}
      {d.alerts?.length > 0 && <div className="grid gap-2 mb-5 md:grid-cols-2 xl:grid-cols-3">{d.alerts.slice(0, 6).map((a: any, i: number) => (
        <Link key={i} to={a.link} className={cls('flex items-center gap-3 px-4 py-2.5 rounded-xl border text-[13.5px] font-semibold', a.level === 'danger' ? 'bg-blush border-[#f2bcc3] text-[#8f1325]' : a.level === 'warn' ? 'bg-gold border-[#ead49a] text-[#6b4a00]' : 'bg-sky border-[#bcd6f0] text-[#1f4f85]')}>
          {a.level === 'danger' ? <AlertTriangle size={17} /> : a.level === 'warn' ? <TriangleAlert size={17} /> : <Info size={17} />}<span className="flex-1" dir="auto">{a.text}</span><ArrowRight size={15} /></Link>))}</div>}
      <div className="grid gap-3 mb-5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{tiles.map(t => <Kpi key={t.label} label={t.label} value={t.value ?? 0} hint={t.hint} tone={t.tone} onClick={t.to ? () => nav(t.to!) : undefined} />)}</div>

      <div className="grid gap-4 xl:grid-cols-12">
        {ch.sales_branch && (
          <Panel className="xl:col-span-7" title="Sales (Branch)" color={C.ocean} tools={<span className="text-xs opacity-80 mr-1">this month · {base}</span>}>
            <div className="p-3" style={{ height: 290 }}>
              {ch.sales_branch.length === 0 ? <Empty title="No sales yet this month" hint="Invoiced revenue and unbilled job work appear here by branch." /> : (
                <ResponsiveContainer><BarChart data={ch.sales_branch} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" vertical={false} /><XAxis dataKey="branch" tick={{ fontSize: 12 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 12 }} width={46} /><Tooltip formatter={money} /><Legend /><Bar dataKey="invoiced" name="Invoiced" fill={C.emerald} radius={[6, 6, 0, 0]} maxBarSize={90} /><Bar dataKey="unbilled" name="Unbilled work" fill={C.champagne} radius={[6, 6, 0, 0]} maxBarSize={90} /></BarChart></ResponsiveContainer>)}
            </div>
          </Panel>)}
        {ls.recent_calls && (
          <Panel className="xl:col-span-5" title="Recent Call List" color={C.violet} tools={can('crm', 'create') && <button onClick={() => nav('/e/activities?new=1&type=Call')} aria-label="Log a call"><Plus size={17} /></button>} bodyClass="max-h-[290px] overflow-auto">
            {ls.recent_calls.length === 0 ? <Empty title="No calls logged" hint="Log calls from CRM → Calls & Activities." /> : <table className="grid"><thead><tr><th>Contact / company</th><th>When</th><th>Outcome</th></tr></thead><tbody>{ls.recent_calls.map((c: any) => <tr key={c.id} className="clickable" onClick={() => nav(`/e/activities/${c.id}`)}><td><div className="font-semibold">{c.contact_name || c.company || c.subject}</div><div className="text-xs text-muted">{c.company ?? ''} {c.phone ? '· ' + c.phone : ''}</div></td><td className="whitespace-nowrap text-xs">{fmtDateTime(c.start_at)}<div className="text-muted">{c.direction}</div></td><td>{c.outcome ? <Badge value={c.outcome} tone="grey" /> : ''}</td></tr>)}</tbody></table>}
          </Panel>)}
        {ls.recent_jobs && (
          <Panel className="xl:col-span-7" title="Recent Jobs" color={C.teal} tools={can('jobs', 'create') && <button onClick={() => nav('/e/jobs?new=1')} aria-label="New job"><Plus size={17} /></button>} bodyClass="table-wrap max-h-[380px]">
            <table className="grid"><thead><tr><th>Client</th><th>Job No</th><th>POL</th><th>POD</th><th>ETD</th><th>Status</th></tr></thead><tbody>
              {ls.recent_jobs.length === 0 && <tr><td colSpan={6}><Empty title="No jobs yet" hint="Open a Master Job from a customer or an accepted quotation." action={can('jobs', 'create') && <button className="btn green" onClick={() => nav('/e/jobs?new=1')}><Plus /> New job</button>} /></td></tr>}
              {ls.recent_jobs.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td className="max-w-[240px] truncate">{j.client}</td><td><Link className="link" to={`/jobs/${j.id}`} onClick={e => e.stopPropagation()}>{j.job_no}</Link></td><td>{j.pol}</td><td>{j.pod}</td><td className="whitespace-nowrap">{fmtDate(j.etd)}</td><td><Badge value={j.operational_status ?? j.job_status} /></td></tr>)}</tbody></table>
          </Panel>)}
        {ls.recent_shipments && (
          <Panel className="xl:col-span-5" title="Recent Shipments" color={C.teal} bodyClass="max-h-[380px] overflow-auto">
            {ls.recent_shipments.length === 0 ? <Empty title="No shipments yet" hint="Sub-jobs (house shipments) created under a Master Job show here." /> : <table className="grid"><thead><tr><th>Sub-job</th><th>Shipper → Consignee</th><th>Status</th></tr></thead><tbody>{ls.recent_shipments.map((s: any) => <tr key={s.id} className="clickable" onClick={() => nav(`/e/shipments/${s.id}`)}><td><span className="link">{s.shipment_no}</span><div className="text-xs text-muted">{s.hbl_no}</div></td><td className="text-[13px]">{s.shipper ?? '—'}<div className="text-muted text-xs">→ {s.consignee ?? '—'}</div></td><td><Badge value={s.status} /></td></tr>)}</tbody></table>}
          </Panel>)}

        {ch.revenue_trend && (
          <Panel className="xl:col-span-7" title="Revenue, cost & profit by job month" color={C.emerald}>
            <div className="p-3" style={{ height: 280 }}>{ch.revenue_trend.length === 0 ? <Empty title="No job financials yet" /> : (
              <ResponsiveContainer><ComposedChart data={ch.revenue_trend}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 12 }} width={46} /><Tooltip formatter={money} /><Legend /><Bar dataKey="revenue" name="Revenue" fill={C.emerald} radius={[5, 5, 0, 0]} maxBarSize={44} /><Bar dataKey="cost" name="Cost" fill={C.copper} radius={[5, 5, 0, 0]} maxBarSize={44} /><Line type="monotone" dataKey="profit" name="Profit" stroke={C.graphite} strokeWidth={2.5} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer>)}</div>
          </Panel>)}
        {ch.jobs_by_mode && (
          <Panel className="xl:col-span-5" title="Open jobs by mode" color={C.aviation}>
            <div className="p-3 flex items-center" style={{ height: 280 }}>{ch.jobs_by_mode.length === 0 ? <Empty title="No open jobs" /> : (<><ResponsiveContainer width="55%" height="100%"><PieChart><Pie data={ch.jobs_by_mode} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>{ch.jobs_by_mode.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
              <ul className="list-none m-0 p-0 text-sm flex-1">{ch.jobs_by_mode.map((m: any, i: number) => <li key={m.name} className="flex items-center gap-2 py-1"><span className="w-3 h-3 rounded-sm" style={{ background: PIE[i % PIE.length] }} />{m.name}<b className="ml-auto text-ink">{m.value}</b></li>)}</ul></>)}</div>
          </Panel>)}
        {ls.departures && (
          <Panel className="xl:col-span-6" title={<span className="flex items-center gap-2"><Ship size={16} /> Departures – next 7 days</span>} color={C.ocean} bodyClass="max-h-[300px] overflow-auto">
            {ls.departures.length === 0 ? <Empty title="No departures planned" /> : <table className="grid"><tbody>{ls.departures.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td><span className="link">{j.job_no}</span><div className="text-xs text-muted">{j.client}</div></td><td>{j.pol} → {j.pod}</td><td className="whitespace-nowrap text-xs">{fmtDateTime(j.etd)}</td></tr>)}</tbody></table>}
          </Panel>)}
        {ls.arrivals && (
          <Panel className="xl:col-span-6" title={<span className="flex items-center gap-2"><Plane size={16} /> Arrivals – next 7 days</span>} color={C.aviation} bodyClass="max-h-[300px] overflow-auto">
            {ls.arrivals.length === 0 ? <Empty title="No arrivals expected" /> : <table className="grid"><tbody>{ls.arrivals.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td><span className="link">{j.job_no}</span><div className="text-xs text-muted">{j.client}</div></td><td>{j.pol} → {j.pod}</td><td className="whitespace-nowrap text-xs">{fmtDateTime(j.eta)}</td></tr>)}</tbody></table>}
          </Panel>)}
        {ch.top_customers && ch.top_customers.length > 0 && (
          <Panel className="xl:col-span-6" title="Top customers – revenue, last 90 days" color={C.copper}>
            <div className="p-3" style={{ height: 280 }}><ResponsiveContainer><BarChart data={ch.top_customers} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" horizontal={false} /><XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} /><Tooltip formatter={money} /><Bar dataKey="value" name="Revenue" fill={C.copper} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
          </Panel>)}
        {ch.ar_aging && (
          <Panel className="xl:col-span-6" title="Receivables ageing" color={C.violet}>
            <div className="p-3" style={{ height: 280 }}><ResponsiveContainer><BarChart data={ch.ar_aging}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 12 }} width={46} /><Tooltip formatter={money} /><Bar dataKey="value" name={`Outstanding ${base}`} radius={[6, 6, 0, 0]}>{ch.ar_aging.map((_: any, i: number) => <Cell key={i} fill={['#007B52', '#0F7F8C', '#d9a21a', '#d9741a', '#C32135'][i]} />)}</Bar></BarChart></ResponsiveContainer></div>
          </Panel>)}
        {ls.my_tasks && ls.my_tasks.length > 0 && (
          <Panel className="xl:col-span-12" title="My tasks & follow-ups" color={C.graphite} tools={<button onClick={() => nav('/e/tasks')} aria-label="All tasks"><ArrowRight size={16} /></button>}>
            <table className="grid"><tbody>{ls.my_tasks.map((t: any) => <tr key={t.id} className="clickable" onClick={() => nav(t.link_entity ? (t.link_entity === 'jobs' ? `/jobs/${t.link_id}` : `/e/${t.link_entity}/${t.link_id}`) : `/e/tasks/${t.id}`)}><td className="font-semibold">{t.title}</td><td className="text-muted text-xs">{t.link_label}</td><td className="whitespace-nowrap">{fmtDate(t.due_date)}</td><td><Badge value={t.priority} /></td></tr>)}</tbody></table>
          </Panel>)}
      </div>
    </div>
  )
}

function Welcome({ name, portal }: { name?: string; portal?: boolean }) {
  return (
    <div className="flex items-center gap-4 mb-5 flex-wrap">
      <img src="/brand/icon-primary.png" alt="" width="54" height="46" className="h-[46px] w-auto" />
      <div><h1 className="text-[24px] sm:text-[28px] font-extrabold m-0">Welcome to Elvora Logistics OS</h1>
        <div className="text-muted text-[14.5px]">{portal ? 'Track your shipments, documents and invoices.' : 'Track and Manage Sales, Shipments, Jobs, Accounts and Warehouse'}</div></div>
    </div>
  )
}

function AiBrief() {
  const q = useQuery({ queryKey: ['ai-brief'], queryFn: () => get<{ output: string; started_at: string; name: string }>('/api/ai/brief'), retry: false })
  if (!q.data?.output) return null
  return (
    <Link to="/ai" className="block mb-5 rounded-2xl border border-[#bfe3d0] bg-mint px-4 py-3 no-underline text-ink">
      <div className="flex items-center gap-2 text-[12.5px] font-bold text-fold mb-1"><Bot size={16} /> {q.data.name} · today’s briefing <span className="font-normal text-muted">{String(q.data.started_at).replace('T', ' ').slice(0, 16)}</span><span className="flex-1" /><span className="underline">Open AI Team</span></div>
      <div dir="auto" className="text-[13.5px] whitespace-pre-line leading-relaxed max-h-[9.5em] overflow-hidden">{q.data.output}</div>
    </Link>
  )
}
