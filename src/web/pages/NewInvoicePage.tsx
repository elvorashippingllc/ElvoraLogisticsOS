import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, ReceiptText, Save, Send, Trash2 } from 'lucide-react'
import { get, post } from '../lib/api'
import { useMeta } from '../lib/meta'
import { useToast } from '../lib/toast'
import { ErrorBox, Loading, PageHeader, useDialogs } from '../ui/kit'
import { RefSelect } from '../components/RefSelect'
import { fmtMoney, fmtRoe, todayIso } from '../lib/format'
import { amountInWords } from '@shared/words'

interface Line { key: number; charge_code_id: number | null; charge_label?: string; description: string; qty: string; rate: string; line_ccy: string; line_roe: string; vat_code_id: number | null }
const CUR = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR', 'CNY', 'ZAR']
const r2 = (n: number) => Math.round((n + (n < 0 ? -1e-9 : 1e-9)) * 100) / 100
let seq = 1
const blank = (vat: number | null): Line => ({ key: seq++, charge_code_id: null, description: '', qty: '1', rate: '', line_ccy: '', line_roe: '', vat_code_id: vat })

/** Create an invoice straight away: no job, no quotation. A job and shipment details are optional. */
export function NewInvoicePage() {
  const { meta, can, me } = useMeta(); const nav = useNavigate(); const toast = useToast(); const dlg = useDialogs(); const [sp] = useSearchParams()
  const vats = useQuery({ queryKey: ['vat-codes'], queryFn: () => get<{ rows: any[] }>('/api/e/vat_codes', { pageSize: 100 }) })
  const rates = useQuery({ queryKey: ['currency-rates'], queryFn: () => get<{ rows: any[] }>('/api/e/currencies', { pageSize: 100 }) })
  const banks = useQuery({ queryKey: ['bank-accounts-new-invoice'], queryFn: () => get<{ rows: any[] }>('/api/e/bank_accounts', { pageSize: 50 }), enabled: can('finance', 'view') })
  const copy = useQuery({ queryKey: ['invoice-copy', sp.get('copy')], enabled: !!sp.get('copy'), queryFn: () => get<any>(`/api/e/invoices/${sp.get('copy')}`) })
  const settings = meta?.settings ?? {}
  const zr = vats.data?.rows.find(v => v.code === 'ZR')?.id ?? null, sr = vats.data?.rows.find(v => v.code === 'SR')?.id ?? null
  const [h, setH] = useState<any>({ doc_type: 'Tax Invoice', invoice_date: todayIso(), supply_date: '', due_date: '', currency: 'AED', ex_rate: '1', party_id: sp.get('party') ? Number(sp.get('party')) : null, job_id: sp.get('job') ? Number(sp.get('job')) : null, reference: '', custom_no: '', trade: '', round_total: 'No rounding', bank_account_id: null, notes: '', terms: settings.invoice_terms ?? '', ship_bl_no: '', ship_vessel: '', ship_receipt: '', ship_pol: '', ship_pod: '', ship_destination: '', ship_containers: '', ship_weight: '', ship_cargo: '', ship_hs_code: '' })
  const [lines, setLines] = useState<Line[]>([]), [busy, setBusy] = useState(false), [showShip, setShowShip] = useState(false), [loaded, setLoaded] = useState(false)
  const setHead = (patch: any) => setH((x: any) => ({ ...x, ...patch }))
  useEffect(() => { if (vats.data && !loaded && !sp.get('copy')) { setLines([blank(zr ?? sr), blank(zr ?? sr)]); setLoaded(true) } }, [vats.data, loaded, zr, sr, sp])
  // supplementary / repeat invoice: start from an existing one
  useEffect(() => {
    const c = copy.data; if (!c || loaded) return
    setH((x: any) => ({ ...x, doc_type: c.doc_type === 'Credit Note' ? 'Tax Invoice' : c.doc_type, party_id: c.party_id, job_id: c.job_id, currency: c.currency, ex_rate: String(c.ex_rate ?? 1), trade: c.trade ?? '', round_total: c.round_total ?? 'No rounding', reference: c.reference ?? '', bank_account_id: c.bank_account_id, notes: c.notes ?? '', terms: c.terms ?? x.terms,
      ship_bl_no: c.ship_bl_no ?? '', ship_vessel: c.ship_vessel ?? '', ship_receipt: c.ship_receipt ?? '', ship_pol: c.ship_pol ?? '', ship_pod: c.ship_pod ?? '', ship_destination: c.ship_destination ?? '', ship_containers: c.ship_containers ?? '', ship_weight: c.ship_weight ?? '', ship_cargo: c.ship_cargo ?? '', ship_hs_code: c.ship_hs_code ?? '', _labels: c._labels }))
    setShowShip(true)
    setLines((c.children?.lines ?? []).map((l: any) => ({ key: seq++, charge_code_id: l.charge_code_id, charge_label: l._labels?.charge_code_id, description: l.description ?? '', qty: String(l.qty ?? 1), rate: String(l.rate ?? ''), line_ccy: l.line_ccy ?? '', line_roe: l.line_roe ? String(l.line_roe) : '', vat_code_id: l.vat_code_id })))
    setLoaded(true)
  }, [copy.data, loaded])

  const vatPct = (id: number | null) => vats.data?.rows.find(v => v.id === id)?.rate ?? 0
  const foreignDoc = h.currency !== (settings.base_currency ?? 'AED')
  const calc = useMemo(() => {
    const rows = lines.map(l => {
      const qty = Number(l.qty) || 0, rate = Number(l.rate) || 0, roe = l.line_ccy && l.line_ccy !== h.currency ? Number(l.line_roe) || 0 : 1
      const own = r2(qty * rate), net = r2(qty * rate * roe), vat = r2(net * vatPct(l.vat_code_id) / 100)
      return { own, net, vat, total: r2(net + vat), roe }
    })
    const sub = r2(rows.reduce((s, r) => s + r.net, 0)), vat = r2(rows.reduce((s, r) => s + r.vat, 0)), raw = r2(sub + vat)
    const rounding = h.round_total === 'No rounding' ? 0 : r2(Math.round(raw) - raw)
    return { rows, sub, vat, rounding, total: r2(raw + rounding) }
  }, [lines, h.round_total, h.currency, vats.data])  // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (key: number, patch: Partial<Line>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  const pickCharge = async (key: number, id: number | null, label?: string) => {
    if (!id) { setLine(key, { charge_code_id: null, charge_label: undefined }); return }
    setLine(key, { charge_code_id: id, charge_label: label })
    try { const c = await get<any>(`/api/e/charge_codes/${id}`); setLines(ls => ls.map(l => (l.key === key ? { ...l, description: l.description || c.name, vat_code_id: c.vat_code_id ?? l.vat_code_id, rate: l.rate || (c.default_rate ? String(c.default_rate) : '') } : l))) } catch { /* optional convenience */ }
  }
  const setCcy = (key: number, ccy: string) => {
    const roe = rates.data?.rows.find(c => c.code === ccy)?.rate
    setLine(key, { line_ccy: ccy, line_roe: ccy && ccy !== h.currency ? (roe ? String(roe) : '') : '' })
  }

  const invalid = (): string | null => {
    if (!h.party_id) return 'Choose the customer'
    const real = lines.filter(l => l.description.trim() || Number(l.rate))
    if (!real.length) return 'Add at least one charge'
    for (const [i, l] of real.entries()) {
      if (!l.description.trim()) return `Line ${i + 1}: add a description`
      if (!(Number(l.qty) > 0)) return `Line ${i + 1}: quantity must be more than zero`
      if (!(Number(l.rate) >= 0) || l.rate === '') return `Line ${i + 1}: enter the rate`
      if (l.line_ccy && l.line_ccy !== h.currency && !(Number(l.line_roe) > 0)) return `Line ${i + 1}: enter the rate of exchange for ${l.line_ccy}`
      if (!l.vat_code_id) return `Line ${i + 1}: choose the VAT treatment`
    }
    return null
  }
  const save = async (after: 'draft' | 'post' | 'preview') => {
    const err = invalid(); if (err) { toast.error(err); return }
    if (after === 'post' && !(await dlg.confirm({ title: 'Post this invoice?', message: 'It gets its final number and is recorded in the accounts. A posted invoice can only be voided or credited.', ok: 'Post invoice' }))) return
    setBusy(true)
    try {
      const body: any = { ...h, ex_rate: Number(h.ex_rate) || 1, supply_date: h.supply_date || null, due_date: h.due_date || null, custom_no: h.custom_no.trim() || null, trade: h.trade || null, notes: h.notes || null, terms: h.terms || null, reference: h.reference || null }
      for (const k of Object.keys(body)) if (k.startsWith('ship_') && !body[k]) body[k] = null
      delete body._labels
      body.children = { lines: lines.filter(l => l.description.trim() || Number(l.rate)).map(l => ({ charge_code_id: l.charge_code_id, description: l.description.trim(), qty: Number(l.qty), rate: Number(l.rate), line_ccy: l.line_ccy && l.line_ccy !== h.currency ? l.line_ccy : null, line_roe: l.line_ccy && l.line_ccy !== h.currency ? Number(l.line_roe) : null, vat_code_id: l.vat_code_id })) }
      const inv = await post<any>('/api/e/invoices', body)
      if (after === 'post') { const p = await post<any>(`/api/finance/invoices/${inv.id}/post`); toast.ok(`Posted as ${p.invoice_no}`); nav(`/e/invoices/${inv.id}`); return }
      toast.ok('Draft saved'); nav(after === 'preview' ? `/print/invoices/${inv.id}` : `/e/invoices/${inv.id}`)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (me?.party_id) return <ErrorBox error={new Error('Invoices are raised by company staff.')} />
  if (!vats.data || (sp.get('copy') && !copy.data && !copy.error)) return <Loading />
  if (copy.error) return <ErrorBox error={copy.error} />
  const canPost = can('finance', 'edit')
  const F = ({ k, label, type = 'text', ph, span }: { k: string; label: string; type?: string; ph?: string; span?: boolean }) => <div className={span ? 'md:col-span-2' : ''}><label className="label" htmlFor={`ni-${k}`}>{label}</label><input id={`ni-${k}`} className="input" type={type} value={h[k] ?? ''} placeholder={ph} onChange={e => setHead({ [k]: e.target.value })} /></div>
  return (
    <div className="fade-in">
      <PageHeader back={<Link className="btn grey" to="/e/invoices"><ArrowLeft /> Invoices</Link>} icon={<ReceiptText size={20} />} title={sp.get('copy') ? 'New invoice from an existing one' : 'New invoice'} subtitle="No job is needed. Choose the customer, add the charges, and save as a draft or post it. Shipment details are optional and print on the invoice." />
      <div className="grid gap-4">
        <section className="card p-4 md:p-5">
          <h2 className="m-0 mb-3 text-[16px] font-bold">Customer and invoice details</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2"><label className="label">Customer<span className="req">*</span></label><RefSelect entity="parties" filter={{ is_customer: 1 }} value={h.party_id} label={h._labels?.party_id} onChange={(v, l) => setHead({ party_id: v, _labels: { ...h._labels, party_id: l } })} placeholder="Search customers…" />
              {can('crm', 'create') && <div className="help"><Link to="/e/parties?new=1">Add a new customer</Link></div>}</div>
            <div><label className="label" htmlFor="ni-type">Document</label><select id="ni-type" className="select" value={h.doc_type} onChange={e => setHead({ doc_type: e.target.value })}><option>Tax Invoice</option><option>Proforma Invoice</option><option>Debit Note</option></select></div>
            <F k="invoice_date" label="Invoice date" type="date" /><F k="supply_date" label="Date of supply (if different)" type="date" /><F k="due_date" label="Due date (blank = from payment terms)" type="date" />
            <div><label className="label" htmlFor="ni-cur">Invoice currency</label><select id="ni-cur" className="select" value={h.currency} onChange={e => setHead({ currency: e.target.value })}>{CUR.map(c => <option key={c}>{c}</option>)}</select>{foreignDoc && <div className="help">Pay-in currency. Lines are priced in the same currency.</div>}</div>
            {foreignDoc && <F k="ex_rate" label={`Exchange rate: 1 ${h.currency} = … ${settings.base_currency ?? 'AED'}`} type="number" />}
            <F k="reference" label="Customer reference / PO" />
            <div><label className="label" htmlFor="ni-no">Own invoice number (optional)</label><input id="ni-no" className="input" value={h.custom_no} maxLength={40} onChange={e => setHead({ custom_no: e.target.value })} placeholder="e.g. DXB/IMP/ES103" /><div className="help">Blank = next number in your series when posted.</div></div>
            <div><label className="label" htmlFor="ni-trade">Trade</label><select id="ni-trade" className="select" value={h.trade} onChange={e => setHead({ trade: e.target.value })}><option value="">Not specified</option><option>Import</option><option>Export</option><option>Cross trade</option><option>Domestic</option></select></div>
            <div><label className="label">Job (optional)</label><RefSelect entity="jobs" value={h.job_id} label={h._labels?.job_id} onChange={(v, l) => setHead({ job_id: v, _labels: { ...h._labels, job_id: l } })} placeholder="No job" />{h.job_id && <div className="help">Blank shipment details are filled from the job when you save.</div>}</div>
          </div>
        </section>
        <section className="card p-4 md:p-5">
          <button type="button" className="btn ghost sm mb-2" aria-expanded={showShip} onClick={() => setShowShip(!showShip)}>{showShip ? 'Hide' : 'Add'} shipment / B/L details (printed on the invoice)</button>
          {showShip && <div className="grid gap-3 md:grid-cols-3"><F k="ship_bl_no" label="Bill of lading / AWB" /><F k="ship_vessel" label="Vessel / flight" /><F k="ship_weight" label="Gross weight" ph="31,629.75 KGS" /><F k="ship_receipt" label="Place of receipt" /><F k="ship_pol" label="Port of loading" /><F k="ship_pod" label="Port of discharge" /><F k="ship_destination" label="Final destination" /><F k="ship_hs_code" label="HS code" /><F k="ship_containers" label="Containers" span ph="CAAU4171016 / 40' | BMOU9822371 / 40'" /><F k="ship_cargo" label="Cargo" span ph="2 x 40' HQ | 2,520 cartons assorted candy" /></div>}
        </section>
        <section className="card p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap"><h2 className="m-0 text-[16px] flex-1 font-bold">Charges</h2><button className="btn outline sm" onClick={() => setLines(ls => [...ls, blank(zr ?? sr)])}><Plus /> Add charge</button></div>
          <div className="table-wrap"><table className="grid" aria-label="Invoice charges"><thead><tr><th style={{ minWidth: 170 }}>Charge</th><th style={{ minWidth: 220 }}>Description</th><th style={{ width: 80 }}>Qty</th><th style={{ width: 110 }}>Rate</th><th style={{ width: 90 }}>Priced in</th><th style={{ width: 90 }}>ROE</th><th style={{ minWidth: 140 }}>VAT</th><th style={{ textAlign: 'right', width: 120 }}>Amount ({h.currency})</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>{lines.map((l, i) => { const other = !!l.line_ccy && l.line_ccy !== h.currency; return <tr key={l.key}>
              <td><RefSelect entity="charge_codes" value={l.charge_code_id} label={l.charge_label} onChange={(v, lab) => void pickCharge(l.key, v, lab)} placeholder="Charge code" /></td>
              <td><input className="input" aria-label={`Line ${i + 1} description`} value={l.description} onChange={e => setLine(l.key, { description: e.target.value })} /></td>
              <td><input className="input" type="number" min="0" step="any" aria-label={`Line ${i + 1} quantity`} value={l.qty} onChange={e => setLine(l.key, { qty: e.target.value })} /></td>
              <td><input className="input" type="number" min="0" step="any" aria-label={`Line ${i + 1} rate`} value={l.rate} onChange={e => setLine(l.key, { rate: e.target.value })} /></td>
              <td><select className="select" aria-label={`Line ${i + 1} currency`} value={l.line_ccy} onChange={e => setCcy(l.key, e.target.value)}><option value="">{h.currency}</option>{CUR.filter(c => c !== h.currency).map(c => <option key={c}>{c}</option>)}</select></td>
              <td><input className="input" type="number" min="0" step="any" aria-label={`Line ${i + 1} rate of exchange`} disabled={!other} value={other ? l.line_roe : ''} placeholder={other ? '3.685' : ''} onChange={e => setLine(l.key, { line_roe: e.target.value })} /></td>
              <td><select className="select" aria-label={`Line ${i + 1} VAT`} value={l.vat_code_id ?? ''} onChange={e => setLine(l.key, { vat_code_id: e.target.value ? Number(e.target.value) : null })}><option value="">Choose…</option>{vats.data!.rows.map(v => <option key={v.id} value={v.id}>{v.code} · {v.rate}%</option>)}</select></td>
              <td style={{ textAlign: 'right' }}>{fmtMoney(calc.rows[i]?.net)}{other && Number(l.rate) > 0 && <div className="text-xs text-muted">{l.line_ccy} {fmtMoney(calc.rows[i]?.own)} × {fmtRoe(Number(l.line_roe) || 0)}</div>}</td>
              <td><button className="btn ghost icon sm" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(ls => (ls.length > 1 ? ls.filter(x => x.key !== l.key) : ls))}><Trash2 /></button></td></tr> })}</tbody></table></div>
          <div className="grid gap-4 md:grid-cols-[1fr_340px] mt-4 items-start">
            <div className="grid gap-3"><div><label className="label" htmlFor="ni-notes">Notes to customer</label><textarea id="ni-notes" className="textarea" rows={3} value={h.notes} onChange={e => setHead({ notes: e.target.value })} /></div>
              <div><label className="label" htmlFor="ni-terms">Terms</label><textarea id="ni-terms" className="textarea" rows={3} value={h.terms} onChange={e => setHead({ terms: e.target.value })} /></div>
              <div><label className="label" htmlFor="ni-bank">Remit to bank account</label><select id="ni-bank" className="select" value={h.bank_account_id ?? ''} onChange={e => setHead({ bank_account_id: e.target.value ? Number(e.target.value) : null })}><option value="">Use the bank details in Company settings</option>{(banks.data?.rows ?? []).map(b => <option key={b.id} value={b.id}>{b.name}{b.iban ? ` · ${b.iban}` : ''}</option>)}</select></div></div>
            <div className="card p-4" style={{ background: 'var(--hover)' }}>
              <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" className="accent-emerald" checked={h.round_total !== 'No rounding'} onChange={e => setHead({ round_total: e.target.checked ? 'Round total to whole amount' : 'No rounding' })} /> Round the total to a whole {h.currency}</label>
              <dl className="kv !grid-cols-[1fr_auto]"><dt>Total charges</dt><dd>{fmtMoney(calc.sub)}</dd><dt>VAT</dt><dd>{fmtMoney(calc.vat)}</dd>{calc.rounding !== 0 && <><dt>Rounding adjustment</dt><dd>{fmtMoney(calc.rounding)}</dd></>}<dt className="font-bold">Total due {h.currency}</dt><dd className="font-bold text-[17px]">{fmtMoney(calc.total)}</dd></dl>
              {calc.total > 0 && <p className="text-xs text-muted mb-0 mt-2">{amountInWords(calc.total, h.currency)}</p>}
            </div>
          </div>
        </section>
        <div className="flex gap-2 flex-wrap justify-end">
          <button className="btn outline" disabled={busy} onClick={() => void save('draft')}><Save /> Save draft</button>
          <button className="btn outline" disabled={busy} onClick={() => void save('preview')}>Save &amp; preview</button>
          {canPost && <button className="btn green" disabled={busy} onClick={() => void save('post')}><Send /> {busy ? 'Saving…' : 'Save & post'}</button>}
        </div>
      </div>
    </div>
  )
}
