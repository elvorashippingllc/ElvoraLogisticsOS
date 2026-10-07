import { useEffect, useRef, useState } from 'react'
import { get, post, put } from '../lib/api'
import { Modal, Loading } from '../ui/kit'
import { RefSelect } from './RefSelect'
import { useToast } from '../lib/toast'
import { fmtMoney, todayIso } from '../lib/format'

/** One-step settlement of a single invoice (receipt) or bill (payment): creates the voucher, allocates and posts it. */
export function QuickPayDialog({ kind, doc, onClose, onDone }: { kind: 'receipt' | 'payment'; doc: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [bank, setBank] = useState<number | null>(null); const [method, setMethod] = useState('Bank transfer'); const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState<number>(doc.balance); const [ref, setRef] = useState(''); const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      const isR = kind === 'receipt'
      const created = await post<any>(isR ? '/api/e/receipts' : '/api/e/payments', { [isR ? 'party_id' : 'vendor_id']: isR ? doc.party_id : doc.vendor_id, [isR ? 'receipt_date' : 'payment_date']: date, method, bank_account_id: bank, currency: doc.currency, ex_rate: doc.ex_rate, amount, reference: ref || null, children: { allocations: [{ [isR ? 'invoice_id' : 'bill_id']: doc.id, amount }] } })
      await post(`/api/finance/${isR ? 'receipts' : 'payments'}/${created.id}/post`)
      toast.ok(`${isR ? 'Receipt' : 'Payment'} ${created.receipt_no ?? created.payment_no} posted`); onDone()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={kind === 'receipt' ? `Record receipt – ${doc.invoice_no}` : `Pay bill – ${doc.bill_no}`} width={520} footer={<><div className="flex-1" /><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn green" disabled={busy || !bank || !(amount > 0)} onClick={() => void go()}>{busy ? 'Posting…' : `Post ${kind}`}</button></>}>
      <div className="grid gap-3 grid-cols-2">
        <div className="col-span-2 text-sm text-muted">Open balance: <b className="text-ink">{doc.currency} {fmtMoney(doc.balance)}</b></div>
        <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="label">Method</label><select className="select" value={method} onChange={e => setMethod(e.target.value)}>{['Bank transfer', 'Cheque', 'Cash', 'Card', 'Online / gateway', 'Set-off'].map(m => <option key={m}>{m}</option>)}</select></div>
        <div className="col-span-2"><label className="label">{kind === 'receipt' ? 'Deposit to' : 'Paid from'}<span className="req">*</span></label><RefSelect entity="bank_accounts" value={bank} onChange={setBank} /></div>
        <div><label className="label">Amount ({doc.currency})</label><input className="input text-right" type="number" step="0.01" max={doc.balance} value={amount} onChange={e => setAmount(Number(e.target.value))} /></div>
        <div><label className="label">Reference / cheque no.</label><input className="input" value={ref} onChange={e => setRef(e.target.value)} /></div>
      </div>
    </Modal>
  )
}

/** Allocate an already-posted on-account receipt / advance payment to open documents. */
export function AllocateDialog({ kind, rec, onClose, onDone }: { kind: 'receipt' | 'payment'; rec: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [docs, setDocs] = useState<any[] | null>(null); const [amt, setAmt] = useState<Record<number, number>>({})
  const free = Math.round((rec.amount - (rec.allocated ?? 0)) * 100) / 100
  useEffect(() => { get<any[]>(kind === 'receipt' ? '/api/finance/open-invoices' : '/api/finance/open-bills', { [kind === 'receipt' ? 'party_id' : 'vendor_id']: rec.party_id ?? rec.vendor_id, currency: rec.currency }).then(setDocs).catch(() => setDocs([])) }, [])
  const total = Object.values(amt).reduce((s, x) => s + (x || 0), 0)
  return (
    <Modal open onClose={onClose} title={`Allocate ${rec.receipt_no ?? rec.payment_no}`} width={700} footer={<><span className="text-sm">Allocating <b>{fmtMoney(total)}</b> of {fmtMoney(free)}</span><div className="flex-1" /><button className="btn outline" onClick={onClose}>Cancel</button>
      <button className="btn green" disabled={!(total > 0) || total > free + 0.001} onClick={async () => { try { await post(`/api/finance/${kind === 'receipt' ? 'receipts' : 'payments'}/${rec.id}/allocate`, { rows: Object.entries(amt).filter(([, v]) => v > 0).map(([k, v]) => ({ doc_id: Number(k), amount: v })) }); toast.ok('Allocated'); onDone() } catch (e: any) { toast.error(e.message) } }}>Allocate</button></>}>
      {!docs ? <Loading /> : docs.length === 0 ? <p className="text-muted text-center py-6">No open {kind === 'receipt' ? 'invoices' : 'bills'} in {rec.currency}.</p> :
        <table className="grid"><thead><tr><th>Document</th><th>Due</th><th className="num">Balance</th><th className="num" style={{ width: 130 }}>Allocate</th></tr></thead><tbody>{docs.map(d => <tr key={d.id}><td className="font-bold">{d.invoice_no ?? d.bill_no}</td><td>{d.due_date}</td><td className="num">{fmtMoney(d.balance)}</td><td><input className="input text-right" type="number" step="0.01" max={d.balance} value={amt[d.id] ?? ''} onChange={e => setAmt(a => ({ ...a, [d.id]: Number(e.target.value) }))} /></td></tr>)}</tbody></table>}
    </Modal>
  )
}

export function ReconcileDialog({ txn, onClose, onDone }: { txn: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [cands, setCands] = useState<any[] | null>(null); const [manual, setManual] = useState('')
  useEffect(() => { get<any[]>(`/api/finance/bank/suggest/${txn.id}`).then(setCands).catch(() => setCands([])) }, [])
  const match = async (m: string) => { try { await post('/api/finance/bank/reconcile', { txn_id: txn.id, matched_to: m }); toast.ok('Reconciled'); onDone() } catch (e: any) { toast.error(e.message) } }
  return (
    <Modal open onClose={onClose} title="Reconcile statement line" width={620}>
      <div className="text-sm mb-3"><b>{txn.description}</b> · {txn.txn_date} · {txn.debit ? `Withdrawal ${fmtMoney(txn.debit)}` : `Deposit ${fmtMoney(txn.credit)}`}</div>
      <div className="font-display font-bold text-ink mb-1">Suggested matches</div>
      {!cands ? <Loading /> : cands.length === 0 ? <p className="text-sm text-muted">No posted receipt / payment with exactly this amount on this account.</p> : cands.map(c => <div key={c.no} className="flex items-center gap-3 py-2 border-b border-line"><div className="flex-1"><b>{c.no}</b> <span className="text-muted text-sm">{c.kind} · {c.date} {c.reference ? '· ' + c.reference : ''}</span></div><div className="font-bold">{fmtMoney(c.amount)}</div><button className="btn green sm" onClick={() => void match(c.no)}>Match</button></div>)}
      <div className="mt-4"><label className="label">Or reconcile against another reference</label><div className="flex gap-2"><input className="input" placeholder="e.g. bank charge, journal JV26000012" value={manual} onChange={e => setManual(e.target.value)} /><button className="btn outline" disabled={!manual.trim()} onClick={() => void match(manual.trim())}>Reconcile</button></div></div>
    </Modal>
  )
}

export function PodDialog({ order, onClose, onDone }: { order: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const cv = useRef<HTMLCanvasElement>(null); const [name, setName] = useState(order.pod_signed_by ?? ''); const [drawn, setDrawn] = useState(false)
  useEffect(() => { const c = cv.current!; const x = c.getContext('2d')!; x.lineWidth = 2.2; x.lineCap = 'round'; x.strokeStyle = '#161d1a'; let down = false
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)] }
    const d = (e: PointerEvent) => { down = true; const [px, py] = pos(e); x.beginPath(); x.moveTo(px, py); c.setPointerCapture(e.pointerId) }
    const m = (e: PointerEvent) => { if (!down) return; const [px, py] = pos(e); x.lineTo(px, py); x.stroke(); setDrawn(true) }
    const u = () => { down = false }
    c.addEventListener('pointerdown', d); c.addEventListener('pointermove', m); c.addEventListener('pointerup', u); return () => { c.removeEventListener('pointerdown', d); c.removeEventListener('pointermove', m); c.removeEventListener('pointerup', u) } }, [])
  const save = async () => { try { await put(`/api/e/transport_orders/${order.id}`, { pod_signed_by: name, pod_signature: cv.current!.toDataURL('image/png'), status: 'POD received', version: order.version }); toast.ok('Proof of delivery captured'); onDone() } catch (e: any) { toast.error(e.message) } }
  return (
    <Modal open onClose={onClose} title={`Proof of delivery – ${order.order_no}`} width={560} footer={<><button className="btn outline" onClick={() => { const c = cv.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setDrawn(false) }}>Clear</button><div className="flex-1" /><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn green" disabled={!name.trim() || !drawn} onClick={() => void save()}>Save POD</button></>}>
      <label className="label">Received by (name)<span className="req">*</span></label><input className="input mb-3" value={name} onChange={e => setName(e.target.value)} />
      <label className="label">Signature<span className="req">*</span></label><canvas ref={cv} width={900} height={300} className="w-full border border-line-strong rounded-lg bg-white touch-none" style={{ touchAction: 'none', height: 160 }} aria-label="Signature pad" />
    </Modal>
  )
}
