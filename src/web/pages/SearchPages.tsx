import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowUp, ArrowDown, Ship, Plane, Truck } from 'lucide-react'
import { get } from '../lib/api'
import { Badge, Empty, ErrorBox, Loading, PageHeader, Panel } from '../ui/kit'
import { fmtDate, fmtDateTime, cls } from '../lib/format'

const TYPES: [string, string][] = [['job_no', 'Job No'], ['mbl_no', 'MBL / MAWB No'], ['hbl_no', 'HBL / HAWB No'], ['client', 'Client'], ['container', 'Container No'], ['booking_no', 'Booking No'], ['customer_ref', 'Customer Reference'], ['sb_no', 'SB No'], ['boe_no', 'BOE No'], ['do_no', 'DO No'], ['vessel', 'Vessel / Flight'], ['shipment', 'Sub-job / Shipment'], ['invoice', 'Invoice No']]
const OPS = ['contains', 'equals', 'starts with', 'ends with']
const porName = (l?: string) => (l ? l.split('-').slice(1).join('-').replace('/', ', ') : '')

export function JobSearch() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [type, setType] = useState(sp.get('type') ?? 'job_no'); const [op, setOp] = useState(sp.get('op') ?? 'contains'); const [value, setValue] = useState(sp.get('value') ?? '')
  const active = { type: sp.get('type') ?? '', op: sp.get('op') ?? '', value: sp.get('value') ?? '' }
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'job_no', dir: 1 })
  const q = useQuery({ queryKey: ['jobsearch', active], enabled: !!active.value, queryFn: () => get<{ rows: any[]; total: number }>('/api/search/jobs', active), retry: false })
  const rows = useMemo(() => [...(q.data?.rows ?? [])].sort((a, b) => String(a[sort.k] ?? '').localeCompare(String(b[sort.k] ?? ''), undefined, { numeric: true }) * sort.dir), [q.data, sort])
  const label = TYPES.find(t => t[0] === type)?.[1]
  const cols: [string, string][] = [['job_no', 'Job No'], ['job_date', 'Job Date'], ['job_status', 'Status'], ['mbl_no', 'Mbl/Mawb'], ['sub_jobs', 'No Of S.Jobs'], ['por', 'Por Name'], ['client', 'Client'], ['department', 'Department'], ['pol', 'POL'], ['pod', 'POD'], ['etd', 'ETD'], ['eta', 'ETA']]
  const go = (e: React.FormEvent) => { e.preventDefault(); if (value.trim()) setSp({ type, op, value: value.trim() }) }
  return (
    <div className="fade-in">
      <PageHeader icon={<Search size={20} />} title="Job Search" subtitle="Find any master job by number, container, booking, customer reference or party" />
      <form onSubmit={go} className="card p-4 md:p-5 mb-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] max-w-4xl">
          <div><label className="label" htmlFor="st">Type<span className="req">*</span></label><select id="st" className="select" value={type} onChange={e => setType(e.target.value)}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="label" htmlFor="so">Filters</label><select id="so" className="select" value={op} onChange={e => setOp(e.target.value)}>{OPS.map(o => <option key={o}>{o}</option>)}</select></div>
          <div className="md:col-span-2"><label className="label" htmlFor="sv">Value<span className="req">*</span></label><input id="sv" className="input" value={value} onChange={e => setValue(e.target.value)} autoFocus placeholder={`e.g. ${type === 'job_no' ? 'DXB10260136' : type === 'container' ? 'MSCU1234567' : type === 'mbl_no' ? '60754163572' : ''}`} /></div>
        </div>
        <div className="mt-4"><button className="btn green" style={{ minHeight: 40, paddingInline: 22, background: '#0b6e4c' }}><Search /> Search</button></div>
        <div className="text-[13.5px] font-semibold mt-3" style={{ color: '#2b3fb3' }}>Search output will be based on {label}</div>
      </form>
      <Panel title="Results" color="#0F7F8C" collapsible={false}>
        {!active.value ? <Empty title="Enter a value and press Search" hint="Results list the matching master jobs with their sub-job count and port of receipt." /> : q.error ? <ErrorBox error={q.error} /> : q.isLoading ? <Loading label="Searching…" /> : rows.length === 0 ? <Empty title="No jobs found" hint={`Nothing matched “${active.value}” (${active.op}) in ${TYPES.find(t => t[0] === active.type)?.[1]}.`} /> : (
          <><div className="table-wrap"><table className="grid"><thead><tr>{cols.map(([k, l]) => <th key={k} className="sortable" onClick={() => setSort(s => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))}>{l}{sort.k === k && (sort.dir === 1 ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />)}</th>)}</tr></thead><tbody>
            {rows.map(r => <tr key={r.id} className="clickable" onClick={() => nav(`/jobs/${r.id}`)}><td><Link className="link" to={`/jobs/${r.id}`} onClick={e => e.stopPropagation()}>{r.job_no}</Link></td><td>{fmtDate(r.job_date)}</td><td><Badge value={r.job_status} /></td><td>{r.mbl_no}</td><td className="text-center">{r.sub_jobs}</td><td>{porName(r.por)}</td><td>{r.client}</td><td>{r.department}</td><td>{r.pol?.split('-')[0]}</td><td>{r.pod?.split('-')[0]}</td><td className="whitespace-nowrap">{fmtDateTime(r.etd)}</td><td className="whitespace-nowrap">{fmtDateTime(r.eta)}</td></tr>)}</tbody></table></div>
            <div className="px-4 py-2.5 text-[13px] text-muted border-t border-line">1 - {rows.length}{q.data!.total > rows.length ? ` of ${q.data!.total}` : ''}</div></>)}
      </Panel>
    </div>
  )
}

export function TrackingPage() {
  const nav = useNavigate()
  const [v, setV] = useState(''); const [results, setResults] = useState<any[] | null>(null); const [busy, setBusy] = useState(false)
  const active = useQuery({ queryKey: ['active-jobs'], queryFn: () => get<{ rows: any[] }>('/api/e/jobs', { pageSize: 100, sort: 'etd', dir: 'asc', filters: JSON.stringify([{ field: 'job_status', op: 'in', value: ['OPENED', 'IN PROGRESS', 'ON HOLD'] }, { field: 'operational_status', op: 'in', value: ['DEPARTED', 'IN TRANSIT', 'GATE-IN', 'STUFFED / LOADED', 'ARRIVED', 'DISCHARGED', 'OUT FOR DELIVERY'] }]) }) })
  const search = async (e: React.FormEvent) => {
    e.preventDefault(); if (!v.trim()) return; setBusy(true)
    const types = ['job_no', 'mbl_no', 'hbl_no', 'container', 'booking_no', 'customer_ref', 'shipment']
    const all = await Promise.all(types.map(t => get<{ rows: any[] }>('/api/search/jobs', { type: t, op: 'contains', value: v.trim() }).catch(() => ({ rows: [] }))))
    const m = new Map<number, any>(); for (const r of all.flatMap(x => x.rows)) m.set(r.id, r)
    setResults([...m.values()]); setBusy(false)
    if (m.size === 1) nav(`/jobs/${[...m.keys()][0]}?tab=track`)
  }
  const pct = (j: any) => { const a = Date.parse(j.atd ?? j.etd), b = Date.parse(j.ata ?? j.eta); return a && b && b > a ? Math.max(0, Math.min(100, ((Date.now() - a) / (b - a)) * 100)) : null }
  return (
    <div className="fade-in">
      <PageHeader icon={<Ship size={20} />} title="Track & Trace" subtitle="Find a shipment by job, MBL / AWB, HBL, container, booking or customer reference" />
      <form onSubmit={search} className="card p-4 mb-5 flex gap-3 flex-wrap"><input className="input flex-1 min-w-[240px]" style={{ minHeight: 42 }} placeholder="Job no, container, MBL / AWB, HBL, booking…" value={v} onChange={e => setV(e.target.value)} autoFocus /><button className="btn green" style={{ minHeight: 42 }} disabled={busy}><Search /> Track</button></form>
      {results && <div className="card mb-5">{results.length === 0 ? <Empty title="No shipment matches" hint="Check the number, or search by a different reference." /> : <table className="grid"><thead><tr><th>Job</th><th>Client</th><th>Route</th><th>Status</th><th>ETA</th></tr></thead><tbody>{results.map(r => <tr key={r.id} className="clickable" onClick={() => nav(`/jobs/${r.id}?tab=track`)}><td><span className="link">{r.job_no}</span><div className="text-xs text-muted">{r.mbl_no} {r.hbl_no}</div></td><td>{r.client}</td><td>{r.pol?.split('-')[0]} → {r.pod?.split('-')[0]}</td><td><Badge value={r.operational_status ?? r.job_status} /></td><td>{fmtDateTime(r.eta)}</td></tr>)}</tbody></table>}</div>}
      <Panel title="Shipments on the move" color="#15526B" collapsible={false}>
        {!active.data ? <Loading /> : active.data.rows.length === 0 ? <Empty title="Nothing in transit" hint="Jobs whose operational status is gate-in, departed, in transit or arrived appear here." /> : <div className="grid gap-px bg-line md:grid-cols-2">{active.data.rows.map(j => { const p = pct(j); const Icon = j.mode === 'Air' ? Plane : j.mode === 'Road' ? Truck : Ship; return (
          <Link key={j.id} to={`/jobs/${j.id}?tab=track`} className="bg-card p-4 hover:bg-hover block"><div className="flex items-center gap-2"><Icon size={16} className="text-muted" /><b className="text-ink">{j.job_no}</b><span className="text-sm text-muted truncate">{j._labels.client_id}</span><span className="flex-1" /><Badge value={j.operational_status} /></div>
            <div className="text-sm mt-1">{j._labels.pol_id?.split('-')[0]} → {j._labels.pod_id?.split('-')[0]} <span className="text-muted">· ETA {fmtDate(j.eta)}</span></div>{p !== null && <div className="h-1.5 rounded-full bg-soft border border-line mt-2 overflow-hidden"><div className={cls('h-full', j.ata ? 'bg-fold' : 'bg-emerald')} style={{ width: (j.ata ? 100 : p) + '%' }} /></div>}</Link>) })}</div>}
      </Panel>
    </div>
  )
}
