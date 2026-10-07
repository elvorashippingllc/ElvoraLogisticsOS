import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator } from 'lucide-react'
import { get } from '../lib/api'
import { PageHeader, Tabs } from '../ui/kit'
import { useMeta } from '../lib/meta'
import { fmtMoney, fmtNum, cls } from '../lib/format'

const num = (v: any) => Number(v) || 0
const Field = ({ label, children }: { label: string; children: any }) => <div><label className="label">{label}</label>{children}</div>
const Out = ({ label, value, strong }: { label: string; value: any; strong?: boolean }) => <div className={cls('rounded-xl border px-3 py-2.5', strong ? 'bg-mint border-[#b7e0cb]' : 'bg-soft border-line')}><div className="text-[11.5px] font-semibold text-muted">{label}</div><div className={cls('font-display font-extrabold text-ink', strong ? 'text-[22px]' : 'text-[17px]')}>{value}</div></div>

const CONT: [string, number, number][] = [['20GP', 33, 28200], ['40GP', 67, 28750], ['40HC', 76, 28600], ['45HC', 86, 27700]]

function CbmTool() {
  const { meta } = useMeta()
  const [rows, setRows] = useState([{ l: 120, w: 100, h: 100, n: 1, kg: 250 }]); const [unit, setUnit] = useState<'cm' | 'in'>('cm'); const [div, setDiv] = useState(Number(meta?.settings.weight_divisor_air) || 6000)
  const k = unit === 'in' ? 2.54 : 1
  const tot = useMemo(() => { let cbm = 0, kg = 0, pcs = 0; for (const r of rows) { cbm += (num(r.l) * k * num(r.w) * k * num(r.h) * k * num(r.n)) / 1e6; kg += num(r.kg) * num(r.n); pcs += num(r.n) } return { cbm, kg, pcs } }, [rows, k])
  const vol = tot.cbm * 1e6 / div, chargeable = Math.max(vol, tot.kg)
  const upd = (i: number, p: any) => setRows(r => r.map((x, j) => j === i ? { ...x, ...p } : x))
  return (
    <div className="grid gap-5">
      <div className="flex gap-3 items-end flex-wrap"><Field label="Dimensions in"><select className="select" value={unit} onChange={e => setUnit(e.target.value as any)}><option value="cm">Centimetres</option><option value="in">Inches</option></select></Field><Field label="Air volumetric divisor (cm³/kg)"><select className="select" value={div} onChange={e => setDiv(Number(e.target.value))}><option value={6000}>6000 (IATA)</option><option value={5000}>5000 (courier)</option><option value={4000}>4000</option></select></Field></div>
      <div className="table-wrap border border-line rounded-xl"><table className="grid"><thead><tr><th>Length</th><th>Width</th><th>Height</th><th>Pieces</th><th>Weight / piece (kg)</th><th className="num">CBM</th><th /></tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{(['l', 'w', 'h', 'n', 'kg'] as const).map(f => <td key={f} style={{ padding: 6 }}><input className="input" type="number" min="0" value={r[f]} onChange={e => upd(i, { [f]: e.target.value })} /></td>)}<td className="num">{fmtNum((num(r.l) * k * num(r.w) * k * num(r.h) * k * num(r.n)) / 1e6, 3)}</td><td><button className="btn ghost sm" onClick={() => setRows(x => x.filter((_, j) => j !== i))} disabled={rows.length === 1}>✕</button></td></tr>)}</tbody></table></div>
      <button className="btn outline sm w-fit" onClick={() => setRows([...rows, { l: 0, w: 0, h: 0, n: 1, kg: 0 }])}>+ Add line</button>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4"><Out label="Total pieces" value={tot.pcs} /><Out label="Total volume (CBM)" value={fmtNum(tot.cbm, 3)} strong /><Out label="Actual weight (kg)" value={fmtNum(tot.kg)} /><Out label="Air chargeable weight (kg)" value={fmtNum(chargeable)} strong /><Out label="Volumetric weight (kg)" value={fmtNum(vol)} /><Out label="Density (kg / CBM)" value={tot.cbm ? fmtNum(tot.kg / tot.cbm, 0) : '—'} /><Out label="Sea W/M (revenue ton)" value={fmtNum(Math.max(tot.cbm, tot.kg / 1000), 3)} /></div>
      <div><h3 className="text-[14px] mb-2 mt-0">Indicative container fit</h3><div className="grid gap-3 grid-cols-2 md:grid-cols-4">{CONT.map(([t, cbm, kg]) => <div key={t} className="rounded-xl border border-line p-3"><div className="font-display font-extrabold">{t}</div><div className="text-xs text-muted">{cbm} CBM · {fmtNum(kg)} kg payload</div><div className="h-2 rounded-full bg-soft border border-line overflow-hidden my-2"><div className={cls('h-full', tot.cbm / cbm > 1 || tot.kg / kg > 1 ? 'bg-signal' : 'bg-emerald')} style={{ width: Math.min(100, (tot.cbm / cbm) * 100) + '%' }} /></div><div className="text-sm">{fmtNum((tot.cbm / cbm) * 100, 0)}% volume · {fmtNum((tot.kg / kg) * 100, 0)}% weight</div></div>)}</div><p className="text-xs text-muted mt-2">Planning aid only — usable space depends on packaging, stowage and lessor specifications.</p></div>
    </div>
  )
}

function DemurrageTool() {
  const { meta } = useMeta()
  const [from, setFrom] = useState(new Date().toLocaleDateString('sv-SE')); const [to, setTo] = useState(new Date(Date.now() + 12 * 864e5).toLocaleDateString('sv-SE')); const [free, setFree] = useState(Number(meta?.settings.free_days_default) || 7)
  const [tiers, setTiers] = useState([{ days: 5, rate: 0 }, { days: 5, rate: 0 }, { days: 999, rate: 0 }]); const [n, setN] = useState(1)
  const total = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1)
  const over = Math.max(0, total - free)
  let left = over, cost = 0; const lines = tiers.map((t, i) => { const d = Math.min(left, t.days); left -= d; cost += d * num(t.rate) * n; return { i, d, t } })
  return (
    <div className="grid gap-5 max-w-3xl">
      <p className="text-sm text-muted m-0">Estimate demurrage / detention from the discharge (or gate-out) date. Enter the free days and your carrier's tiered daily rates from the tariff — rates are not pre-filled because they differ per line, port and container type.</p>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4"><Field label="Start (discharge / gate-out)"><input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="End (gate-in / return)"><input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></Field><Field label="Free days"><input className="input" type="number" min="0" value={free} onChange={e => setFree(num(e.target.value))} /></Field><Field label="Containers"><input className="input" type="number" min="1" value={n} onChange={e => setN(num(e.target.value))} /></Field></div>
      <div className="table-wrap border border-line rounded-xl"><table className="grid"><thead><tr><th>Tier</th><th>Max days in tier</th><th className="num">Rate / day / container</th><th className="num">Days charged</th><th className="num">Amount</th></tr></thead><tbody>{lines.map(({ i, d, t }) => <tr key={i}><td>Tier {i + 1}</td><td style={{ padding: 6 }}><input className="input" type="number" min="1" value={t.days} onChange={e => setTiers(x => x.map((y, j) => j === i ? { ...y, days: num(e.target.value) } : y))} /></td><td style={{ padding: 6 }}><input className="input text-right" type="number" min="0" step="0.01" value={t.rate} onChange={e => setTiers(x => x.map((y, j) => j === i ? { ...y, rate: num(e.target.value) } : y))} /></td><td className="num">{d}</td><td className="num">{fmtMoney(d * num(t.rate) * n)}</td></tr>)}</tbody></table></div>
      <div className="grid gap-3 grid-cols-3"><Out label="Days elapsed" value={total} /><Out label="Days beyond free time" value={over} /><Out label="Estimated charge" value={fmtMoney(cost)} strong /></div>
    </div>
  )
}

function CurrencyTool() {
  const q = useQuery({ queryKey: ['currencies'], queryFn: () => get<{ rows: any[] }>('/api/e/currencies', { pageSize: 100 }) })
  const [amt, setAmt] = useState(1000); const [from, setFrom] = useState('USD'); const [to, setTo] = useState('AED')
  const rate = (c: string) => q.data?.rows.find(r => r.code === c)?.rate as number | undefined
  const rf = rate(from), rt = rate(to)
  return (
    <div className="grid gap-4 max-w-2xl">
      <p className="text-sm text-muted m-0">Uses the rates maintained under Master Data → Currencies (AED per unit). Update them regularly — the converter shows “—” where no rate is maintained.</p>
      <div className="grid gap-3 grid-cols-3"><Field label="Amount"><input className="input text-right" type="number" value={amt} onChange={e => setAmt(num(e.target.value))} /></Field><Field label="From"><select className="select" value={from} onChange={e => setFrom(e.target.value)}>{q.data?.rows.map(r => <option key={r.code}>{r.code}</option>)}</select></Field><Field label="To"><select className="select" value={to} onChange={e => setTo(e.target.value)}>{q.data?.rows.map(r => <option key={r.code}>{r.code}</option>)}</select></Field></div>
      <Out label={`${fmtMoney(amt)} ${from} =`} value={rf && rt ? `${fmtMoney((amt * rf) / rt)} ${to}` : '— (rate missing)'} strong />
      <div className="table-wrap border border-line rounded-xl"><table className="grid"><thead><tr><th>Currency</th><th className="num">AED per unit</th><th>Rate date</th></tr></thead><tbody>{q.data?.rows.map(r => <tr key={r.code}><td><b>{r.code}</b> <span className="text-muted">{r.name}</span></td><td className="num">{r.rate ?? '—'}</td><td>{r.rate_date ?? ''}</td></tr>)}</tbody></table></div>
    </div>
  )
}

const INCO: [string, string, string, string][] = [
  ['EXW', 'Ex Works', 'Any', 'Buyer collects at seller premises; buyer bears everything from there incl. export clearance.'], ['FCA', 'Free Carrier', 'Any', 'Seller delivers to buyer\'s carrier at a named place, export-cleared.'], ['FAS', 'Free Alongside Ship', 'Sea', 'Seller delivers alongside the vessel at the named port of shipment.'],
  ['FOB', 'Free On Board', 'Sea', 'Seller loads on board; risk passes once cargo is on the vessel.'], ['CFR', 'Cost and Freight', 'Sea', 'Seller pays freight to destination port; risk passes on loading.'], ['CIF', 'Cost, Insurance & Freight', 'Sea', 'As CFR plus seller insures (minimum cover) for the buyer.'],
  ['CPT', 'Carriage Paid To', 'Any', 'Seller pays carriage to named destination; risk passes at first carrier.'], ['CIP', 'Carriage & Insurance Paid To', 'Any', 'As CPT plus seller insures (ICC A) for the buyer.'], ['DAP', 'Delivered at Place', 'Any', 'Seller delivers to named place ready for unloading; buyer clears import.'],
  ['DPU', 'Delivered at Place Unloaded', 'Any', 'Seller delivers and unloads at named place; buyer clears import.'], ['DDP', 'Delivered Duty Paid', 'Any', 'Seller bears all costs and risks incl. import duties and taxes.'],
]
function IncotermsTool() {
  return <div><p className="text-sm text-muted mt-0">Incoterms® 2020 summary — a memory aid, not a legal text. The contract of sale governs.</p><div className="table-wrap border border-line rounded-xl"><table className="grid"><thead><tr><th>Rule</th><th>Name</th><th>Mode</th><th>In short</th></tr></thead><tbody>{INCO.map(([c, n, m, d]) => <tr key={c}><td><b className="text-fold">{c}</b></td><td>{n}</td><td>{m}</td><td>{d}</td></tr>)}</tbody></table></div></div>
}

function UnitTool() {
  const [v, setV] = useState(100)
  const rows: [string, string, number][] = [['kg → lb', 'lb', 2.20462], ['lb → kg', 'kg', 0.453592], ['cm → inch', 'in', 0.393701], ['inch → cm', 'cm', 2.54], ['CBM → cubic feet', 'cft', 35.3147], ['cubic feet → CBM', 'CBM', 0.0283168], ['tonne → kg', 'kg', 1000], ['m → ft', 'ft', 3.28084]]
  return <div className="max-w-xl grid gap-4"><Field label="Value"><input className="input text-right" type="number" value={v} onChange={e => setV(num(e.target.value))} /></Field><div className="grid grid-cols-2 gap-3">{rows.map(([l, u, f]) => <Out key={l} label={l} value={`${fmtNum(v * f, 3)} ${u}`} />)}</div></div>
}

export function ToolsPage() {
  const [tab, setTab] = useState('cbm')
  return (
    <div className="fade-in">
      <PageHeader icon={<Calculator size={20} />} title="Freight tools" subtitle="CBM and chargeable weight, container fit, demurrage estimator, currency and unit conversion, Incoterms" />
      <div className="card overflow-hidden"><Tabs variant="sub" tabs={[{ key: 'cbm', label: 'CBM & chargeable weight' }, { key: 'dem', label: 'Demurrage / detention' }, { key: 'fx', label: 'Currency converter' }, { key: 'inco', label: 'Incoterms 2020' }, { key: 'units', label: 'Unit converter' }]} value={tab} onChange={setTab} />
        <div className="p-4 md:p-5">{tab === 'cbm' && <CbmTool />}{tab === 'dem' && <DemurrageTool />}{tab === 'fx' && <CurrencyTool />}{tab === 'inco' && <IncotermsTool />}{tab === 'units' && <UnitTool />}</div></div>
    </div>
  )
}
