import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, Play, Printer, Gauge, Sigma, Check, X } from 'lucide-react'
import { get, downloadUrl } from '../lib/api'
import { RefSelect } from '../components/RefSelect'
import { Empty, ErrorBox, Kpi, Loading, PageHeader, Spinner } from '../ui/kit'
import { cls, fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../lib/format'
import { Badge } from '../ui/kit'

function fmtCell(c: any, v: any) {
  if (v === null || v === undefined || v === '') return ''
  switch (c.type) { case 'money': return fmtMoney(v); case 'number': return fmtNum(v); case 'percent': return fmtNum(v) + '%'; case 'date': return fmtDate(v); case 'datetime': return fmtDateTime(v); default: return String(v) }
}

export function ReportResultView({ res }: { res: any }) {
  if (res.layout === 'statement') return (
    <div className="print-sheet !w-auto !min-h-0 !shadow-none max-w-3xl" style={{ boxShadow: 'none' }}>
      <table><tbody>{res.rows.map((r: any, i: number) => r.kind === 'header' ? <tr key={i}><td colSpan={3} className="!bg-[#eef3ef] font-bold uppercase text-[11px] tracking-wider !pt-3">{r.name}</td></tr>
        : <tr key={i} className={cls(r.kind === 'total' && 'font-bold', r.kind === 'grand' && 'font-extrabold text-[13px] !bg-[#dcf1e6]', r.kind === 'check' && 'text-muted italic')}><td style={{ width: 70 }} className="text-muted">{r.code}</td><td style={{ paddingLeft: r.kind === 'line' ? 18 : 8 }}>{r.name}</td><td className="num" style={{ textAlign: 'right', width: 140 }}>{r.kind === 'check' && Math.abs(r.amount) < 0.005 ? <Check size={14} className="inline text-emerald" /> : fmtMoney(r.amount)}</td></tr>)}</tbody></table>
      {res.note && <p className="text-xs text-muted mt-3">{res.note}</p>}
    </div>)
  return (
    <div>
      <div className="table-wrap border border-line rounded-xl"><table className="grid">
        <thead><tr>{res.columns.map((c: any) => <th key={c.key} className={['money', 'number', 'percent'].includes(c.type) ? 'num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>{res.rows.length === 0 && <tr><td colSpan={res.columns.length}><Empty title="No data for these filters" /></td></tr>}
          {res.rows.map((r: any, i: number) => <tr key={i}>{res.columns.map((c: any) => <td key={c.key} className={['money', 'number', 'percent'].includes(c.type) ? 'num' : ''}>{c.key === 'link' ? null : c.key === 'job_status' || c.key === 'status' || c.key === 'sla' ? <Badge value={r[c.key]} /> : fmtCell(c, r[c.key])}</td>)}</tr>)}</tbody>
        {res.totals && res.rows.length > 0 && <tfoot><tr>{res.columns.map((c: any, i: number) => <td key={c.key} className={['money', 'number', 'percent'].includes(c.type) ? 'num' : ''}>{i === 0 ? 'Total' : res.totals[c.key] !== undefined && res.totals[c.key] !== null ? fmtCell(c, res.totals[c.key]) : ''}</td>)}</tr></tfoot>}
      </table></div>
      {res.note && <p className="text-xs text-muted mt-2">{res.note}</p>}
    </div>
  )
}

export function ReportsPage({ fixed }: { fixed?: string[] }) {
  const [sp, setSp] = useSearchParams()
  const cat = useQuery({ queryKey: ['report-catalog'], queryFn: () => get<any[]>('/api/reports') })
  const key = sp.get('r') ?? ''
  const def = cat.data?.find(r => r.key === key)
  const [params, setParams] = useState<Record<string, string>>({})
  const [run, setRun] = useState<Record<string, string> | null>(null)
  const groups = useMemo(() => { const g = new Map<string, any[]>(); for (const r of (cat.data ?? []).filter(r => !fixed || fixed.includes(r.key))) { if (!g.has(r.group)) g.set(r.group, []); g.get(r.group)!.push(r) } return [...g.entries()] }, [cat.data, fixed])
  useEffect(() => {
    if (!def) { setRun(null); return }
    const p: Record<string, string> = {}
    const today = new Date().toLocaleDateString('sv-SE')
    for (const pd of def.params) p[pd.name] = sp.get(pd.name) ?? (pd.default === 'today' ? today : pd.default === 'monthStart' ? today.slice(0, 8) + '01' : pd.default === 'yearStart' ? today.slice(0, 5) + '01-01' : pd.default ?? '')
    setParams(p)
    if (def.params.every((pd: any) => pd.type === 'ref' ? !!p[pd.name] : true)) setRun(p); else setRun(null)
  }, [key, def?.key])
  const res = useQuery({ queryKey: ['report', key, run], enabled: !!def && !!run, queryFn: () => get<any>(`/api/reports/${key}`, run ?? {}), retry: false })
  const choose = (k: string) => { const n = new URLSearchParams(); n.set('r', k); setSp(n) }
  return (
    <div className="fade-in">
      <PageHeader icon={<BarChart3 size={20} />} title={fixed ? 'Financial Statements' : 'Reports'} subtitle="Operational, sales, finance and compliance reports — export to CSV or print / save as PDF" />
      <div className="grid gap-4 lg:grid-cols-[270px_1fr] items-start">
        <nav className="card py-2 no-print lg:sticky lg:top-0 max-h-[78vh] overflow-auto" aria-label="Reports">
          {!cat.data ? <Loading /> : groups.map(([g, list]) => <div key={g}><div className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{g}</div>{list.map(r => <button key={r.key} onClick={() => choose(r.key)} className={cls('w-full text-left px-4 py-1.5 text-[13.5px] border-0 cursor-pointer', r.key === key ? 'bg-mint text-fold font-bold' : 'bg-transparent text-body hover:bg-hover')}>{r.label}</button>)}</div>)}
        </nav>
        <div className="min-w-0">
          {!def ? <div className="card"><Empty icon={<BarChart3 size={34} />} title="Choose a report" hint="Pick a report from the list to set its filters and run it." /></div> : (
            <div className="card p-4 md:p-5">
              <div className="flex items-start gap-3 flex-wrap mb-3"><div className="flex-1 min-w-0"><h2 className="m-0 text-[19px]">{def.label}</h2><p className="text-sm text-muted m-0">{def.description}</p></div>
                <div className="flex gap-2 no-print"><a className={cls('btn outline', !run && 'opacity-50 pointer-events-none')} href={downloadUrl(`/api/reports/${key}`, { ...(run ?? {}), format: 'csv' })}><Download /> CSV</a><button className="btn outline" onClick={() => window.print()} disabled={!res.data}><Printer /> Print</button></div></div>
              {def.params.length > 0 && <form className="flex gap-3 items-end flex-wrap pb-4 mb-4 border-b border-line no-print" onSubmit={e => { e.preventDefault(); setRun({ ...params }) }}>
                {def.params.map((pd: any) => <div key={pd.name} style={{ minWidth: pd.type === 'ref' ? 260 : 150 }}><label className="label">{pd.label}</label>
                  {pd.type === 'date' ? <input className="input" type="date" value={params[pd.name] ?? ''} onChange={e => setParams(p => ({ ...p, [pd.name]: e.target.value }))} />
                    : pd.type === 'ref' ? <RefSelect entity={pd.ref} value={params[pd.name] ? Number(params[pd.name]) : null} onChange={id => setParams(p => ({ ...p, [pd.name]: id ? String(id) : '' }))} />
                    : pd.type === 'select' ? <select className="select" value={params[pd.name] ?? ''} onChange={e => setParams(p => ({ ...p, [pd.name]: e.target.value }))}><option value="">All</option>{pd.options.map((o: string) => <option key={o}>{o}</option>)}</select>
                    : <input className="input" type={pd.type === 'number' ? 'number' : 'text'} value={params[pd.name] ?? ''} onChange={e => setParams(p => ({ ...p, [pd.name]: e.target.value }))} />}</div>)}
                <button className="btn green"><Play /> Run</button></form>}
              {res.isFetching ? <Loading label="Running report…" /> : res.error ? <ErrorBox error={res.error} /> : res.data ? <><h3 className="mt-0 mb-3 text-[15px]">{res.data.title}</h3><ReportResultView res={res.data} /></> : <p className="text-sm text-muted">Choose the filters and press Run.</p>}
            </div>)}
        </div>
      </div>
    </div>
  )
}
void Link; void Spinner

export function KpiPage() {
  const q = useQuery({ queryKey: ['kpi'], queryFn: () => get<any>('/api/kpi') })
  if (q.error) return <ErrorBox error={q.error} />
  if (!q.data) return <Loading />
  const fmt = (k: any) => k.value === null ? '—' : (k.unit === 'AED' ? fmtMoney(k.value, 0) : fmtNum(k.value)) + (k.unit && k.unit !== 'AED' ? (k.unit === '%' ? '%' : ' ' + k.unit) : '')
  return (
    <div className="fade-in">
      <PageHeader icon={<Gauge size={20} />} title="KPI Dashboard" subtitle={q.data.period} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {q.data.kpis.map((k: any) => <Kpi key={k.key} label={k.label} value={<span className="flex items-center gap-2">{fmt(k)}{k.status === 'good' ? <Check size={18} className="text-emerald" /> : k.status === 'bad' ? <X size={18} className="text-signal" /> : null}</span>} tone={k.status === 'good' ? 'green' : k.status === 'bad' ? 'red' : undefined} hint={<>{k.hint}{k.target !== null && <span className="block">Target {k.target}{k.unit === '%' ? '%' : k.unit ? ' ' + k.unit : ''}</span>}</>} />)}
      </div>
      <p className="text-xs text-muted mt-4">Targets are management defaults for freight forwarders — adjust expectations to your own service levels. The minimum-margin target follows Company Settings.</p>
    </div>
  )
}
void Sigma
