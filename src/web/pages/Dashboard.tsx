import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bot, Plus, ArrowRight, AlertTriangle, Info, TriangleAlert, Plane, Ship, Wallet, FileText, Truck, CalendarDays, LayoutGrid, ChevronLeft, ChevronRight, Mail } from 'lucide-react'
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
    <div className="fade-in dashboard-page">
      <Welcome name={me?.name} portal />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"><Kpi label="Open shipments" value={k.open_jobs} /><Kpi label="Delivered" value={k.delivered} /><Kpi label={`Outstanding (${base})`} value={fmtMoney(k.outstanding)} /></div>
      <Panel title="Your recent shipments" color={C.teal} bodyClass="table-wrap"><table className="grid"><thead><tr><th>Job No</th><th>From</th><th>To</th><th>Departure</th><th>Arrival</th><th>Status</th></tr></thead><tbody>{d.recent_jobs.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td><Link className="link" to={`/jobs/${j.id}`}>{j.job_no}</Link></td><td>{j.pol}</td><td>{j.pod}</td><td>{fmtDateTime(j.etd)}</td><td>{fmtDateTime(j.eta)}</td><td><Badge value={j.operational_status ?? j.job_status} /></td></tr>)}</tbody></table></Panel>
    </div>
  )

  const tiles: { label: string; value: any; hint?: any; tone?: any; surface?: string; to?: string; show: boolean }[] = [
    { label: 'Open jobs', surface: 'ocean', value: k.open_jobs, hint: `${k.jobs_month ?? 0} opened this month`, to: '/e/jobs?status=OPENED', show: k.open_jobs !== undefined },
    { label: 'In transit', surface: 'transit', value: k.in_transit, to: '/e/jobs?status=IN%20PROGRESS', show: k.in_transit !== undefined },
    { label: `Revenue this month (${base})`, surface: 'revenue', value: fmtMoney(k.revenue_month, 0), hint: `Job profit ${fmtMoney(k.profit_month, 0)}`, show: k.revenue_month !== undefined },
    { label: `Receivables (${base})`, surface: 'collections', value: fmtMoney(k.ar_outstanding, 0), hint: k.ar_overdue > 0 ? `${fmtMoney(k.ar_overdue, 0)} overdue` : 'Nothing overdue', tone: k.ar_overdue > 0 ? 'amber' : undefined, to: '/reports?r=ar_aging', show: k.ar_outstanding !== undefined },
    { label: `Payables (${base})`, value: fmtMoney(k.ap_outstanding, 0), to: '/reports?r=ap_aging', show: k.ap_outstanding !== undefined },
    { label: `Cash & bank (${base})`, value: fmtMoney(k.cash, 0), to: '/e/bank_accounts', show: k.cash !== undefined },
    { label: `Unbilled work (${base})`, surface: 'collections', value: fmtMoney(k.unbilled, 0), tone: k.unbilled > 0 ? 'amber' : undefined, to: '/reports?r=unbilled_charges', show: k.unbilled !== undefined },
    { label: 'Open quotations', value: k.quotes_open, to: '/e/quotations', show: k.quotes_open !== undefined },
    { label: 'New leads', value: k.leads_new, hint: `Pipeline ${fmtMoney(k.pipeline, 0)}`, to: '/e/leads', show: k.leads_new !== undefined },
    { label: 'Open tickets', value: k.tickets_open, to: '/e/tickets', show: k.tickets_open !== undefined },
    { label: 'My open tasks', value: k.my_tasks, to: '/e/tasks', show: k.my_tasks !== undefined },
    { label: 'Low-stock items', value: k.low_stock, tone: k.low_stock > 0 ? 'red' : undefined, to: '/warehouse/stock?low=1', show: k.low_stock !== undefined },
  ].filter(t => t.show)

  const ch = d.charts ?? {}, ls = d.lists ?? {}
  return (
    <div className="fade-in dashboard-page">
      <Welcome name={me?.name} /><OperationsDesk data={d} />
      <section aria-label="Business at a glance"><div className="dashboard-metrics">{tiles.slice(0, 4).map(t => <Kpi key={t.label} className={t.surface ? `metric-${t.surface}` : undefined} label={t.label} value={t.value ?? 0} hint={t.hint} tone={t.tone} onClick={t.to && (!t.to.startsWith('/reports') || (can('reports', 'view') && can('finance', 'view'))) ? () => nav(t.to!) : undefined} />)}</div></section>
      {d.alerts?.length > 0 && <div className="grid gap-2 mb-5 md:grid-cols-2 xl:grid-cols-3">{d.alerts.slice(0, 6).map((a: any, i: number) => (
        <Link key={i} to={a.link} data-level={a.level} className={cls('dashboard-alert flex items-center gap-3 px-4 py-2.5 rounded-xl border text-[13.5px] font-semibold', a.level === 'danger' ? 'bg-blush border-[#f2bcc3] text-[#8f1325]' : a.level === 'warn' ? 'bg-gold border-[#ead49a] text-[#6b4a00]' : 'bg-sky border-[#bcd6f0] text-[#1f4f85]')}>
          {a.level === 'danger' ? <AlertTriangle size={17} /> : a.level === 'warn' ? <TriangleAlert size={17} /> : <Info size={17} />}<span className="flex-1" dir="auto">{a.text}</span><ArrowRight size={15} /></Link>))}</div>}


      <DailyWorkflow data={d} base={base} />
      {can('ai', 'view') && <AiBrief />}
      <h2 className="dashboard-section-title">Shipment activity and business results</h2>
      <DashboardOverview data={d} base={base} />

      <div className="grid gap-4 xl:grid-cols-12">
        {ch.sales_branch && (
          <Panel className="xl:col-span-7 dashboard-sales-panel" title="Sales by branch" color={C.ocean} tools={<span className="text-xs opacity-80 mr-1">invoiced this month · {base}</span>}>
            <div className="p-3" style={{ height: 290 }}>
              {ch.sales_branch.length === 0 ? <Empty title="No sales yet this month" hint="Invoiced revenue and unbilled job work appear here by branch." /> : (
                <ResponsiveContainer><BarChart data={ch.sales_branch} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" vertical={false} /><XAxis dataKey="branch" tick={{ fontSize: 14 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 14 }} width={46} /><Tooltip formatter={money} /><Legend /><Bar dataKey="invoiced" name="Invoiced" fill={C.emerald} radius={[6, 6, 0, 0]} maxBarSize={90} /><Bar dataKey="unbilled" name="All work waiting to invoice" fill={C.champagne} radius={[6, 6, 0, 0]} maxBarSize={90} /></BarChart></ResponsiveContainer>)}
            </div>
          </Panel>)}
        {ls.recent_calls && (
          <Panel className="xl:col-span-5" title="Recent customer calls" color={C.violet} tools={can('crm', 'create') && <button onClick={() => nav('/e/activities?new=1&type=Call')} aria-label="Log a call"><Plus size={17} /></button>} bodyClass="max-h-[290px] overflow-auto">
            {ls.recent_calls.length === 0 ? <Empty title="No calls logged" hint="Log calls from CRM → Calls & Activities." /> : <table className="grid"><thead><tr><th>Contact / company</th><th>When</th><th>Outcome</th></tr></thead><tbody>{ls.recent_calls.map((c: any) => <tr key={c.id} className="clickable" onClick={() => nav(`/e/activities/${c.id}`)}><td><div className="font-semibold">{c.contact_name || c.company || c.subject}</div><div className="text-xs text-muted">{c.company ?? ''} {c.phone ? '· ' + c.phone : ''}</div></td><td className="whitespace-nowrap text-xs">{fmtDateTime(c.start_at)}<div className="text-muted">{c.direction}</div></td><td>{c.outcome ? <Badge value={c.outcome} tone="grey" /> : ''}</td></tr>)}</tbody></table>}
          </Panel>)}
        {ls.recent_jobs && (
          <Panel className="xl:col-span-7" title="Latest jobs" color={C.teal} tools={can('jobs', 'create') && <button onClick={() => nav('/e/jobs?new=1')} aria-label="New job"><Plus size={17} /></button>} bodyClass="table-wrap max-h-[380px]">
            <table className="grid"><thead><tr><th>Client</th><th>Job No</th><th>From</th><th>To</th><th>Departure</th><th>Status</th></tr></thead><tbody>
              {ls.recent_jobs.length === 0 && <tr><td colSpan={6}><Empty title="No jobs yet" hint="Open a Master Job from a customer or an accepted quotation." action={can('jobs', 'create') && <button className="btn green" onClick={() => nav('/e/jobs?new=1')}><Plus /> New job</button>} /></td></tr>}
              {ls.recent_jobs.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td className="max-w-[240px] truncate">{j.client}</td><td><Link className="link" to={`/jobs/${j.id}`} onClick={e => e.stopPropagation()}>{j.job_no}</Link></td><td>{j.pol}</td><td>{j.pod}</td><td className="whitespace-nowrap">{fmtDate(j.etd)}</td><td><Badge value={j.operational_status ?? j.job_status} /></td></tr>)}</tbody></table>
          </Panel>)}
        {ls.recent_shipments && (
          <Panel className="xl:col-span-5" title="Latest house shipments" color={C.teal} bodyClass="max-h-[380px] overflow-auto">
            {ls.recent_shipments.length === 0 ? <Empty title="No shipments yet" hint="Sub-jobs (house shipments) created under a Master Job show here." /> : <table className="grid"><thead><tr><th>Sub-job</th><th>Shipper → Consignee</th><th>Status</th></tr></thead><tbody>{ls.recent_shipments.map((s: any) => <tr key={s.id} className="clickable" onClick={() => nav(`/e/shipments/${s.id}`)}><td><span className="link">{s.shipment_no}</span><div className="text-xs text-muted">{s.hbl_no}</div></td><td className="text-[13px]">{s.shipper ?? '—'}<div className="text-muted text-xs">→ {s.consignee ?? '—'}</div></td><td><Badge value={s.status} /></td></tr>)}</tbody></table>}
          </Panel>)}

        {ch.revenue_trend && (
          <Panel className="xl:col-span-12 dashboard-financial-panel" title="Revenue, cost & profit by job month" color={C.emerald}>
            <div className="p-3" style={{ height: 280 }}>{ch.revenue_trend.length === 0 ? <Empty title="No job financials yet" /> : (
              <ResponsiveContainer><ComposedChart data={ch.revenue_trend}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 14 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 14 }} width={46} /><Tooltip formatter={money} /><Legend /><Bar dataKey="revenue" name="Revenue" fill={C.emerald} radius={[5, 5, 0, 0]} maxBarSize={44} /><Bar dataKey="cost" name="Cost" fill={C.copper} radius={[5, 5, 0, 0]} maxBarSize={44} /><Line type="monotone" dataKey="profit" name="Profit" stroke={C.graphite} strokeWidth={2.5} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer>)}</div>
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
            <div className="p-3" style={{ height: 280 }}><ResponsiveContainer><BarChart data={ch.top_customers} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" horizontal={false} /><XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 14 }} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 14 }} /><Tooltip formatter={money} /><Bar dataKey="value" name="Revenue" fill={C.copper} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
          </Panel>)}
        {ch.ar_aging && (
          <Panel className="xl:col-span-6" title="Receivables ageing" color={C.violet}>
            <div className="p-3" style={{ height: 280 }}><ResponsiveContainer><BarChart data={ch.ar_aging}><CartesianGrid strokeDasharray="3 3" stroke="#dbe3dc" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 14 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 14 }} width={46} /><Tooltip formatter={money} /><Bar dataKey="value" name={`Outstanding ${base}`} radius={[6, 6, 0, 0]}>{ch.ar_aging.map((_: any, i: number) => <Cell key={i} fill={['#007B52', '#0F7F8C', '#d9a21a', '#d9741a', '#C32135'][i]} />)}</Bar></BarChart></ResponsiveContainer></div>
          </Panel>)}
        {ls.my_tasks && ls.my_tasks.length > 0 && (
          <Panel className="xl:col-span-12" title="My tasks & follow-ups" color={C.graphite} tools={<button onClick={() => nav('/e/tasks')} aria-label="All tasks"><ArrowRight size={16} /></button>}>
            <table className="grid"><tbody>{ls.my_tasks.map((t: any) => <tr key={t.id} className="clickable" onClick={() => nav(t.link_entity ? (t.link_entity === 'jobs' ? `/jobs/${t.link_id}` : `/e/${t.link_entity}/${t.link_id}`) : `/e/tasks/${t.id}`)}><td className="font-semibold">{t.title}</td><td className="text-muted text-xs">{t.link_label}</td><td className="whitespace-nowrap">{fmtDate(t.due_date)}</td><td><Badge value={t.priority} /></td></tr>)}</tbody></table>
          </Panel>)}
      </div>
      {tiles.length > 4 && <section className="mt-8" aria-label="More business figures"><h2 className="dashboard-section-title">More business figures</h2><div className="dashboard-metrics">{tiles.slice(4).map(t => <Kpi key={t.label} className={t.surface ? `metric-${t.surface}` : undefined} label={t.label} value={t.value ?? 0} hint={t.hint} tone={t.tone} onClick={t.to && (!t.to.startsWith('/reports') || (can('reports', 'view') && can('finance', 'view'))) ? () => nav(t.to!) : undefined} />)}</div></section>}
    </div>
  )
}

function Welcome({ name, portal }: { name?: string; portal?: boolean }) {
  const { can } = useMeta()
  return <div className={cls('dashboard-welcome flex items-center gap-4 flex-wrap', !portal && 'control-welcome')}>
    <div><h1 className="m-0">{portal ? 'Your shipments' : 'Your logistics control desk'}</h1><div className="text-muted">{name ? `Hello, ${name.split(' ')[0]}. ` : ''}{portal ? 'Your shipments, documents and invoices in one place.' : 'See what needs attention, keep shipments moving and stay on top of payments.'}</div></div>
    {!portal && <nav className="flex gap-2 flex-wrap" aria-label="Dashboard actions">{(can('crm', 'view') || can('finance', 'view') || can('admin', 'view')) && <Link className="btn outline" to="/email"><Mail size={16} />Email</Link>}<Link className="btn outline" to="/calendar"><CalendarDays size={16} />Schedule</Link>{can('jobs', 'create') && <Link className="btn dark" to="/e/jobs?new=1"><Plus size={16} />New job</Link>}</nav>}
  </div>
}

function DashboardOverview({ data: d, base }: { data: any; base: string }) {
  const { can } = useMeta()
  const k = d.kpis ?? {}, ch = d.charts ?? {}
  const modes = ch.jobs_by_mode ?? []
  const total = modes.reduce((n: number, m: any) => n + Number(m.value || 0), 0)
  const shortcuts = [
    { label: 'Jobs', to: '/e/jobs', module: 'jobs', Icon: Ship },
    { label: 'Quotations', to: '/e/quotations', module: 'sales', Icon: FileText },
    { label: 'Warehouse', to: '/warehouse/stock', module: 'warehouse', Icon: Truck },
    { label: 'Calendar', to: '/calendar', module: '', Icon: CalendarDays },
    { label: 'All workspaces', to: '/', module: '', Icon: LayoutGrid, ChevronLeft, ChevronRight, Mail },
  ].filter(a => !a.module || can(a.module, 'view'))
  return <section className="dashboard-top" aria-label="Business overview">
    <section className="card overview-ledger"><h2>{k.revenue_month !== undefined ? 'This month' : 'Shipment activity'}</h2><img src="/brand/icon-primary.png" alt="Elvora" /><dl>
      {k.revenue_month !== undefined && <div className="ledger-main"><dt>Revenue invoiced this month · {base}</dt><dd>{fmtMoney(k.revenue_month, 0)}</dd></div>}
      {k.profit_month !== undefined && <div><dt>Job profit · {base}</dt><dd>{fmtMoney(k.profit_month, 0)}</dd></div>}
      {k.open_jobs !== undefined && <div><dt>Open jobs</dt><dd>{k.open_jobs}</dd></div>}
      {k.in_transit !== undefined && <div><dt>In transit</dt><dd>{k.in_transit}</dd></div>}
    </dl></section>
    <section className="card overview-mix"><header><h2>Open jobs by transport mode</h2><span>{total} open jobs</span></header>
      {modes.length ? <><div style={{ height: 230 }}><ResponsiveContainer><PieChart><Pie data={modes} dataKey="value" nameKey="name" innerRadius={66} outerRadius={96} cornerRadius={7} paddingAngle={5}>{modes.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><ul className="mode-legend">{modes.map((m: any, i: number) => <li key={m.name}><i style={{ background: PIE[i % PIE.length] }} />{m.name}<strong>{m.value}</strong></li>)}</ul></> : <Empty title="No open shipments" hint="Your shipment mix appears as jobs are opened." />}
    </section>
    <aside className="overview-account">
      {k.cash !== undefined && <section className="cash-card"><header><span>Cash &amp; bank</span><Wallet size={20} /></header><strong>{fmtMoney(k.cash, 0)} <span className="text-sm font-normal">{base}</span></strong><footer><span>Elvora Shipping L.L.C.</span><Link to="/e/bank_accounts">Accounts <ArrowRight size={14} /></Link></footer></section>}
      <section className="card quick-work"><h2>Quick actions</h2><div>{shortcuts.map(({ label, to, Icon }) => <Link key={to} to={to} title={label} aria-label={label}><Icon size={18} /><span>{label}</span></Link>)}</div></section>
      {k.ar_outstanding !== undefined && can('reports', 'view') && can('finance', 'view') && <Link className="card quick-work" to="/reports?r=ar_aging"><h2>Receivables · {base}</h2><div className="text-2xl font-bold text-ink">{fmtMoney(k.ar_outstanding, 0)}</div><p className="text-xs text-muted mb-0">{k.ar_overdue > 0 ? `${fmtMoney(k.ar_overdue, 0)} overdue` : 'Nothing overdue'} <ArrowRight size={13} className="inline ml-1" /></p></Link>}
    </aside>
  </section>
}

function AiBrief() {
  const q = useQuery({ queryKey: ['ai-brief'], queryFn: () => get<{ output: string; started_at: string; name: string }>('/api/ai/brief'), retry: false })
  if (!q.data?.output) return null
  return (
    <Link to="/ai" className="dashboard-brief block mb-5 rounded-2xl border border-[#bfe3d0] bg-mint px-4 py-3 no-underline text-ink">
      <div className="flex items-center gap-2 text-[12.5px] font-bold text-fold mb-1"><Bot size={16} /> {q.data.name} · today’s briefing <span className="font-normal text-muted">{String(q.data.started_at).replace('T', ' ').slice(0, 16)}</span><span className="flex-1" /><span className="underline">Open AI Team</span></div>
      <div dir="auto" className="text-[13.5px] whitespace-pre-line leading-relaxed brief-output">{q.data.output}</div>
    </Link>
  )
}



function DailyWorkflow({ data, base }: { data: any; base: string }) {
  const { can } = useMeta(), rail = useRef<HTMLDivElement>(null), [position, setPosition] = useState({ start: true, end: false })
  const k = data.kpis || {}, ls = data.lists || {}
  const steps = [
    { title: 'Enquiry and quotation', surface: 'sales', detail: 'Follow up enquiries, agree the rate and confirm the customer’s acceptance.', value: `${k.quotes_open ?? 0} open quotations`, to: '/e/quotations', module: 'sales', Icon: FileText },
    { title: 'Booking and shipment', surface: 'shipment', detail: 'Open the job, confirm the booking and keep departure and arrival dates current.', value: `${k.open_jobs ?? 0} open jobs`, to: '/e/jobs', module: 'jobs', Icon: Ship },
    { title: 'Documents and clearance', surface: 'documents', detail: 'Check the shipment documents and customs requirements before cargo moves.', value: 'Review shipment documents', to: '/documents', module: 'documents', Icon: FileText },
    { title: 'Delivery and proof', surface: 'delivery', detail: 'Arrange the final delivery, record proof and confirm the shipment is complete.', value: 'Check transport and delivery', to: '/e/transport_orders', module: 'transport', Icon: Truck },
    { title: 'Invoice the customer', surface: 'billing', detail: 'Check job charges and supplier costs, then prepare and send the invoice.', value: k.unbilled === undefined ? 'Review charges waiting to invoice' : `${fmtMoney(k.unbilled, 0)} ${base} waiting to invoice`, to: '/reports?r=unbilled_charges', module: 'finance', Icon: FileText },
    { title: 'Collect payment and close', surface: 'collections', detail: 'Follow up overdue invoices, record the receipt and check the job before closing it.', value: k.ar_overdue === undefined ? 'Review customer balances' : `${fmtMoney(k.ar_overdue, 0)} ${base} overdue`, to: '/reports?r=ar_aging', module: 'finance', Icon: Wallet },
  ].filter(s => can(s.module, 'view') && (!s.to.startsWith('/reports') || can('reports', 'view')))
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * (rail.current.clientWidth * .8), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  return <section className="daily-workflow" aria-label="Daily workflow"><header className="workflow-header"><div><h2>Move each shipment forward</h2><p>Start with anything that needs attention, then follow the job through to payment.</p></div><div className="flex gap-2"><button className="btn outline icon" aria-label="Previous workflow steps" disabled={position.start} onClick={() => move(-1)}><ChevronLeft /></button><button className="btn outline icon" aria-label="Next workflow steps" disabled={position.end || steps.length < 2} onClick={() => move(1)}><ChevronRight /></button></div></header>
    <div className="workflow-carousel" ref={rail} tabIndex={0} aria-label="Shipment workflow steps" onScroll={e => { const r = e.currentTarget; setPosition({ start: r.scrollLeft < 2, end: r.scrollLeft + r.clientWidth >= r.scrollWidth - 2 }) }}>{steps.map((s, i) => <Link key={s.title} to={s.to} className={`workflow-step workflow-${s.surface}`}><div className="workflow-step-head"><span>{i + 1}</span><s.Icon size={22} /></div><h3>{s.title}</h3><p>{s.detail}</p><strong>{s.value}</strong><span className="workflow-open">Open <ArrowRight size={16} /></span></Link>)}</div>
    {(ls.departures || ls.arrivals || ls.my_tasks) && <div className="daily-schedule"><h3>Plan shipments and follow-ups</h3><div>{ls.departures && <Link to="/calendar"><Ship size={18} /><span><b>Upcoming departures</b><small>Confirm bookings and documents</small></span><ArrowRight size={16} /></Link>}{ls.arrivals && <Link to="/calendar"><Plane size={18} /><span><b>Upcoming arrivals</b><small>Prepare clearance and delivery</small></span><ArrowRight size={16} /></Link>}{ls.my_tasks && can('projects', 'view') && <Link to="/e/tasks"><CalendarDays size={18} /><span><b>{k.my_tasks ?? ls.my_tasks.length} open tasks</b><small>Check your follow-ups and due dates</small></span><ArrowRight size={16} /></Link>}</div></div>}
  </section>
}

function OperationsDesk({ data }: { data: any }) {
  const { can } = useMeta()
  const lists = data.lists ?? {}, k = data.kpis ?? {}
  const events = [
    ...(lists.departures ?? []).map((j: any) => ({ ...j, direction: 'Departure', at: j.etd, Icon: Ship })),
    ...(lists.arrivals ?? []).map((j: any) => ({ ...j, direction: 'Arrival', at: j.eta, Icon: Plane })),
  ].sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? ''))).slice(0, 5)
  return <section className="operations-desk" aria-label="Shipment desk">
    <div className="desk-heading"><div><h2>Next on the shipment desk</h2><p>Departures and arrivals planned over the next seven days.</p></div><Link className="btn outline" to="/calendar"><CalendarDays size={17} />Open schedule</Link></div>
    {can('jobs', 'view') && <div className="movement-rail" aria-label="Upcoming shipment movements">{events.length ? events.map((j, i) => <Link className="movement-ticket" key={`${j.direction}-${j.id}-${i}`} to={`/jobs/${j.id}`}><span className="movement-kind"><j.Icon size={19} />{j.direction}<span>{fmtDate(j.at)}</span></span><strong>{j.pol || 'Origin pending'}<ArrowRight size={18} />{j.pod || 'Destination pending'}</strong><span className="movement-client">{j.client || 'Customer'} · {j.job_no}</span><span className="movement-action">Review job <ChevronRight size={16} /></span></Link>) : <div className="movement-empty"><Ship size={28} /><div><strong>Your next movements will appear here</strong><p>Add departure and arrival dates to a job to plan the week ahead.</p></div>{can('jobs', 'create') && <Link className="btn dark" to="/e/jobs?new=1">Open a job <ArrowRight size={16} /></Link>}</div>}</div>}
    <div className="desk-summary">{k.open_jobs !== undefined && <span><Ship size={17} /><b>{k.open_jobs}</b> open jobs</span>}{k.in_transit !== undefined && <span><Truck size={17} /><b>{k.in_transit}</b> in transit</span>}{k.my_tasks !== undefined && <span><CalendarDays size={17} /><b>{k.my_tasks}</b> follow-ups to do</span>}<span className="desk-owner">Elvora Shipping L.L.C.</span></div>
  </section>
}
