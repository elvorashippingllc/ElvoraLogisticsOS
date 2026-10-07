import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, ScanBarcode, SlidersHorizontal, ArrowLeftRight, PackagePlus, PackageMinus } from 'lucide-react'
import { get, post } from '../lib/api'
import { RefSelect } from '../components/RefSelect'
import { Badge, Empty, ErrorBox, Loading, Modal, PageHeader, Tabs } from '../ui/kit'
import { useToast } from '../lib/toast'
import { fmtDate, fmtNum, cls } from '../lib/format'
import { useMeta } from '../lib/meta'

export function StockPage() {
  const { can } = useMeta(); const toast = useToast(); const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const [wh, setWh] = useState<number | null>(null); const [cust, setCust] = useState<number | null>(null); const [text, setText] = useState('')
  const [tab, setTab] = useState('summary'); const [dlg, setDlg] = useState<null | 'adjust' | 'transfer'>(null); const [preset, setPreset] = useState<any>(null); const [scan, setScan] = useState('')
  const low = sp.get('low') === '1'
  const q = useQuery({ queryKey: ['stock', wh, cust, text, low], queryFn: () => get<{ summary: any[]; detail: any[] }>('/api/warehouse/stock', { warehouse_id: wh ?? undefined, customer_id: cust ?? undefined, q: text || undefined, low_only: low ? 1 : undefined }) })
  const refresh = () => void qc.invalidateQueries({ queryKey: ['stock'] })
  const doScan = async (e: React.FormEvent) => { e.preventDefault(); if (!scan.trim()) return; try { const r = await get<any>(`/api/warehouse/barcode/${encodeURIComponent(scan.trim())}`); setText(r.item.sku); setTab('detail'); toast.ok(`${r.item.sku} – ${r.item.name}`) } catch (er: any) { toast.error(er.message) } setScan('') }
  if (q.error) return <ErrorBox error={q.error} />
  const d = q.data
  return (
    <div className="fade-in">
      <PageHeader icon={<Boxes size={20} />} title="Stock on Hand" subtitle="Live balances by owner, bin and lot — expiry-aware" actions={<>
        {can('warehouse', 'create') && <><Link className="btn outline" to="/e/grns?new=1"><PackagePlus /> Receive goods</Link><Link className="btn outline" to="/e/dispatches?new=1"><PackageMinus /> Dispatch</Link></>}
        {can('warehouse', 'edit') && <><button className="btn violet" onClick={() => { setPreset(null); setDlg('adjust') }}><SlidersHorizontal /> Adjust</button><button className="btn violet" onClick={() => { setPreset(null); setDlg('transfer') }}><ArrowLeftRight /> Transfer</button></>}</>} />
      <div className="card p-3 mb-4 flex gap-3 flex-wrap items-end">
        <div style={{ width: 220 }}><label className="label">Warehouse</label><RefSelect entity="warehouses" value={wh} onChange={setWh} placeholder="All warehouses" /></div>
        <div style={{ width: 260 }}><label className="label">Owner (customer)</label><RefSelect entity="parties" value={cust} onChange={setCust} filter={{ is_customer: 1 }} placeholder="All owners" /></div>
        <div style={{ width: 240 }}><label className="label">Search SKU / item / bin</label><input className="input" value={text} onChange={e => setText(e.target.value)} /></div>
        <form onSubmit={doScan} className="flex gap-2 items-end"><div><label className="label">Scan barcode / SKU</label><input className="input" style={{ width: 200 }} value={scan} onChange={e => setScan(e.target.value)} placeholder="Scan then Enter" /></div><button className="btn outline icon" aria-label="Look up"><ScanBarcode /></button></form>
        <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" className="accent-emerald" checked={low} onChange={e => setSp(e.target.checked ? { low: '1' } : {}, { replace: true })} /> Low stock only</label>
      </div>
      <div className="card overflow-hidden">
        <Tabs variant="sub" tabs={[{ key: 'summary', label: 'By item', count: d?.summary.length }, { key: 'detail', label: 'By bin & lot', count: d?.detail.length }]} value={tab} onChange={setTab} />
        {!d ? <Loading /> : tab === 'summary' ? (d.summary.length === 0 ? <Empty title="No stock" hint="Post a goods receipt to bring stock into a warehouse." /> : <div className="table-wrap"><table className="grid"><thead><tr><th>SKU</th><th>Item</th><th>Owner</th><th className="num">On hand</th><th className="num">Minimum</th><th>Status</th></tr></thead><tbody>{d.summary.map(s => <tr key={s.item_id}><td><Link className="link" to={`/e/items/${s.item_id}`}>{s.sku}</Link></td><td>{s.item}</td><td>{s.owner}</td><td className="num font-bold">{fmtNum(s.qty, 4)}</td><td className="num">{s.min_stock || ''}</td><td>{s.low ? <Badge value="Low stock" tone="amber" /> : <Badge value="OK" tone="green" />}</td></tr>)}</tbody></table></div>)
          : (d.detail.length === 0 ? <Empty title="No stock lines" /> : <div className="table-wrap"><table className="grid"><thead><tr><th>SKU</th><th>Item</th><th>Warehouse</th><th>Bin</th><th>Lot</th><th>Expiry</th><th className="num">Qty</th><th /></tr></thead><tbody>{d.detail.map((r, i) => <tr key={i}><td>{r.sku}</td><td>{r.item}</td><td>{r.warehouse}</td><td>{r.location}</td><td>{r.lot_no}</td><td className={cls(r.expiry_status === 'Expired' && 'text-signal font-bold')}>{fmtDate(r.expiry_date)} {r.expiry_status === 'Expired' ? <Badge value="Expired" /> : r.expiry_status === 'Expiring' ? <Badge value="Expiring" tone="amber" /> : null}</td><td className="num font-bold">{fmtNum(r.qty, 4)}</td><td>{can('warehouse', 'edit') && <div className="flex gap-1"><button className="btn outline sm" onClick={() => { setPreset(r); setDlg('adjust') }}>Adjust</button><button className="btn outline sm" onClick={() => { setPreset(r); setDlg('transfer') }}>Move</button></div>}</td></tr>)}</tbody></table></div>)}
      </div>
      {dlg === 'adjust' && <AdjustDialog preset={preset} onClose={() => setDlg(null)} onDone={() => { setDlg(null); refresh() }} />}
      {dlg === 'transfer' && <TransferDialog preset={preset} onClose={() => setDlg(null)} onDone={() => { setDlg(null); refresh() }} />}
    </div>
  )
}

function AdjustDialog({ preset, onClose, onDone }: { preset: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<any>({ item_id: preset?.item_id ?? null, warehouse_id: preset?.warehouse_id ?? null, location_id: preset?.location_id ?? null, lot_no: preset?.lot_no ?? '', qty: 0, reason: '' })
  return (
    <Modal open onClose={onClose} title="Stock adjustment" width={560} footer={<><div className="flex-1" /><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn green" disabled={!f.item_id || !f.warehouse_id || !f.qty || !f.reason.trim()} onClick={async () => { try { await post('/api/warehouse/adjust', { ...f, lot_no: f.lot_no || null, expiry_date: preset?.expiry_date ?? null }); toast.ok('Stock adjusted'); onDone() } catch (e: any) { toast.error(e.message) } }}>Post adjustment</button></>}>
      <div className="grid gap-3"><div><label className="label">Item<span className="req">*</span></label><RefSelect entity="items" value={f.item_id} onChange={v => setF({ ...f, item_id: v })} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Warehouse<span className="req">*</span></label><RefSelect entity="warehouses" value={f.warehouse_id} onChange={v => setF({ ...f, warehouse_id: v })} /></div><div><label className="label">Bin</label><RefSelect entity="wh_locations" value={f.location_id} onChange={v => setF({ ...f, location_id: v })} /></div>
          <div><label className="label">Lot</label><input className="input" value={f.lot_no} onChange={e => setF({ ...f, lot_no: e.target.value })} /></div><div><label className="label">Quantity (+ add / − remove)<span className="req">*</span></label><input className="input text-right" type="number" step="any" value={f.qty || ''} onChange={e => setF({ ...f, qty: Number(e.target.value) })} /></div></div>
        <div><label className="label">Reason<span className="req">*</span></label><input className="input" placeholder="Cycle count variance, damage write-off, found stock…" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></div></div>
    </Modal>
  )
}
function TransferDialog({ preset, onClose, onDone }: { preset: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<any>({ item_id: preset?.item_id ?? null, from_warehouse_id: preset?.warehouse_id ?? null, from_location_id: preset?.location_id ?? null, to_warehouse_id: preset?.warehouse_id ?? null, to_location_id: null, lot_no: preset?.lot_no ?? '', qty: 0 })
  return (
    <Modal open onClose={onClose} title="Stock transfer / bin move" width={600} footer={<><div className="flex-1" /><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn green" disabled={!f.item_id || !f.from_warehouse_id || !f.to_warehouse_id || !(f.qty > 0)} onClick={async () => { try { await post('/api/warehouse/transfer', { ...f, lot_no: f.lot_no || null }); toast.ok('Stock moved'); onDone() } catch (e: any) { toast.error(e.message) } }}>Transfer</button></>}>
      <div className="grid gap-3"><div><label className="label">Item<span className="req">*</span></label><RefSelect entity="items" value={f.item_id} onChange={v => setF({ ...f, item_id: v })} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">From warehouse<span className="req">*</span></label><RefSelect entity="warehouses" value={f.from_warehouse_id} onChange={v => setF({ ...f, from_warehouse_id: v })} /></div><div><label className="label">From bin</label><RefSelect entity="wh_locations" value={f.from_location_id} onChange={v => setF({ ...f, from_location_id: v })} /></div>
          <div><label className="label">To warehouse<span className="req">*</span></label><RefSelect entity="warehouses" value={f.to_warehouse_id} onChange={v => setF({ ...f, to_warehouse_id: v })} /></div><div><label className="label">To bin</label><RefSelect entity="wh_locations" value={f.to_location_id} onChange={v => setF({ ...f, to_location_id: v })} /></div>
          <div><label className="label">Lot (blank = FEFO)</label><input className="input" value={f.lot_no} onChange={e => setF({ ...f, lot_no: e.target.value })} /></div><div><label className="label">Quantity<span className="req">*</span></label><input className="input text-right" type="number" step="any" min="0" value={f.qty || ''} onChange={e => setF({ ...f, qty: Number(e.target.value) })} /></div></div></div>
    </Modal>
  )
}
