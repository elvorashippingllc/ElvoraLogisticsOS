import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Ship, Plane, Truck, MapPin, Package } from 'lucide-react'
import { get } from '../lib/api'
import { fmtDateTime } from '../lib/format'
import { Badge, Loading } from '../ui/kit'

export function PublicTrack() {
  const { token = '' } = useParams()
  const q = useQuery({ queryKey: ['public-track', token], queryFn: () => get<any>(`/api/public/track/${token}`), retry: false, refetchInterval: 120000 })
  const d = q.data
  const Icon = d?.department?.startsWith('AIR') ? Plane : d?.department?.startsWith('ROAD') ? Truck : Ship
  const a = d && Date.parse(d.atd ?? d.etd), b = d && Date.parse(d.ata ?? d.eta)
  const pct = d?.ata ? 100 : a && b && b > a ? Math.max(0, Math.min(100, ((Date.now() - a) / (b - a)) * 100)) : null
  return (
    <div className="min-h-full bg-pearl">
      <header className="bg-white border-b border-line"><div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3"><img src="/brand/logo-primary.png" alt="Elvora Shipping LLC" className="h-10 w-auto" /><div className="flex-1" /><span className="text-sm text-muted font-semibold">Shipment tracking</span></div></header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {q.isLoading ? <Loading /> : q.error ? <div className="card p-8 text-center"><h1 className="text-[22px] m-0">Tracking link not found</h1><p className="text-muted">This link is invalid or has been switched off. Please contact your Elvora Shipping representative.</p></div> : (
          <div className="grid gap-4 fade-in">
            <div className="card p-5"><div className="flex items-center gap-3 flex-wrap"><div className="w-11 h-11 rounded-xl bg-mint text-fold grid place-items-center"><Icon /></div><div className="flex-1 min-w-0"><div className="text-xs text-muted font-semibold">Job reference</div><h1 className="m-0 text-[24px]">{d.job_no}</h1></div><Badge value={d.status} /></div>
              <div className="grid gap-x-6 gap-y-2 mt-4 sm:grid-cols-2 text-sm">{([['Customer', d.client], ['From', d.pol?.split('-').slice(1).join('-').replace('/', ', ')], ['To', d.pod?.split('-').slice(1).join('-').replace('/', ', ')], ['Carrier', d.carrier], ['Vessel / flight', [d.vessel, d.voyage].filter(Boolean).join(' ')], ['Master B/L / AWB', d.mbl_no], ['House B/L / AWB', d.hbl_no], ['Cargo', [d.commodity, d.packages && `${d.packages} pkgs`, d.gross_weight && `${d.gross_weight} kg`].filter(Boolean).join(' · ')]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => <div key={k}><div className="text-[11.5px] font-semibold text-muted">{k}</div><div className="font-semibold text-ink">{v}</div></div>)}</div>
              {pct !== null && <div className="mt-5"><div className="flex justify-between text-xs text-muted mb-1"><span>Departure {fmtDateTime(d.atd ?? d.etd)}{!d.atd && ' (planned)'}</span><span>Arrival {fmtDateTime(d.ata ?? d.eta)}{!d.ata && ' (estimated)'}</span></div><div className="h-2.5 rounded-full bg-soft border border-line overflow-hidden"><div className="h-full bg-emerald transition-all" style={{ width: pct + '%' }} /></div></div>}</div>
            {d.containers.length > 0 && <div className="card p-5"><h2 className="m-0 mb-2 text-[16px] flex items-center gap-2"><Package size={17} /> Equipment</h2><div className="flex gap-2 flex-wrap">{d.containers.map((c: any) => <span key={c.container_no} className="badge grey">{c.container_no} {c.type ? `· ${c.type}` : ''}</span>)}</div></div>}
            <div className="card p-5"><h2 className="m-0 mb-3 text-[16px] flex items-center gap-2"><MapPin size={17} /> Tracking history</h2>
              {d.events.length === 0 ? <p className="text-muted text-sm m-0">No updates have been published yet.</p> : <ol className="list-none m-0 p-0 border-l-2 border-line ml-2">{d.events.map((e: any, i: number) => <li key={i} className="relative pl-6 pb-4"><span className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 border-white ${i === 0 ? 'bg-emerald' : 'bg-[#9fb3a7]'}`} /><div className="font-bold text-ink">{e.type}</div><div className="text-xs text-muted">{fmtDateTime(e.at)}{e.location ? ` · ${e.location}` : ''}</div>{e.description && <div className="text-[13.5px]">{e.description}</div>}</li>)}</ol>}</div>
            <p className="text-xs text-muted text-center">Status shown is the latest information recorded by {d.company}. Dates marked planned / estimated can change. Contact your Elvora representative for details.</p>
          </div>)}
      </main>
    </div>
  )
}
