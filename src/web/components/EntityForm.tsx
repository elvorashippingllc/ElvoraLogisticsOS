import { useEffect, useMemo, useState } from 'react'
import { Save, X, Tags as TagsIcon, ListPlus } from 'lucide-react'
import type { FieldDef } from '@shared/types'
import { useMeta, type MetaEntity } from '../lib/meta'
import { get, post, put } from '../lib/api'
import { FieldInput, CellValue } from './Fields'
import { ChildEditor, previewRow, type Row } from './ChildEditor'
import { Modal, Loading, Badge } from '../ui/kit'
import { useToast } from '../lib/toast'
import { cls, fmtMoney, nowIsoLocal, todayIso } from '../lib/format'
import { useVatRates } from '../lib/lookups'

import { VENDOR_SERVICE_COMMERCIAL } from '@shared/entities/vendor-services'

function initial(def: MetaEntity, record: Row | null, presets: Row | undefined, meId: number | undefined): Row {
  const v: Row = {}
  for (const f of def.fields) {
    if (record && f.name in record) { v[f.name] = record[f.name]; continue }
    let d: any = f.default
    if (d === 'today') d = todayIso(); else if (d === 'now') d = nowIsoLocal(); else if (d === 'me') d = meId ?? null
    v[f.name] = d ?? (f.type === 'bool' ? false : null)
  }
  return { ...v, ...(presets ?? {}) }
}

export function sectionsOf(fields: FieldDef[]): { name: string; fields: FieldDef[] }[] {
  const out: { name: string; fields: FieldDef[] }[] = []
  let cur = ''
  for (const f of fields) {
    if (f.section) cur = f.section
    let s = out.find(x => x.name === (cur || 'Details'))
    if (!s) { s = { name: cur || 'Details', fields: [] }; out.push(s) }
    s.fields.push(f)
  }
  return out
}

export function EntityForm({ def, record, presets, onSaved, onCancel, lockedOnEdit = [], childKeys, title }: { def: MetaEntity; record: Row | null; presets?: Row; onSaved: (rec: Row) => void; onCancel: () => void; lockedOnEdit?: string[]; childKeys?: string[]; title?: string }) {
  const { me, def: getDef } = useMeta()
  const toast = useToast()
  const vat = useVatRates()
  const edit = !!record?.id
  const [vals, setVals] = useState<Row>(() => initial(def, record, presets, me?.id))
  const [labels, setLabels] = useState<Record<string, string>>(record?._labels ?? {})
  const [custom, setCustom] = useState<Row>(record?.custom ?? {})
  const [kids, setKids] = useState<Record<string, Row[]>>(() => {
    const o: Record<string, Row[]> = {}
    for (const c of def.children ?? []) if (!childKeys || childKeys.includes(c.key)) o[c.key] = (record?.children?.[c.key] ?? []).map((r: Row) => ({ ...r }))
    return o
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [banner, setBanner] = useState('')
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState<null | 'rates' | 'docs'>(null)

  const fields = useMemo(() => def.fields.filter(f => {
    if (f.hidden || f.secret) return false
    if (!edit && (f.readonly || f.computed)) return false
    return true
  }), [def, edit])
  const sections = useMemo(() => sectionsOf(fields), [fields])
  const kidDefs = (def.children ?? []).filter(c => !childKeys || childKeys.includes(c.key))
  const set = (name: string, v: any, label?: string) => { setVals(x => ({ ...x, [name]: v })); setErrors(e => (e[name] ? { ...e, [name]: false } : e)); if (label !== undefined) setLabels(l => ({ ...l, [name]: label })) }
  const parentView = { ...vals, __currency: vals.currency }

  const submit = async () => {
    const miss: Record<string, boolean> = {}
    for (const f of fields) if (f.required && !f.readonly && !f.computed && (vals[f.name] === null || vals[f.name] === undefined || vals[f.name] === '')) miss[f.name] = true
    for (const f of customDefs) if (f.required && (custom[f.name] === null || custom[f.name] === undefined || custom[f.name] === '')) miss['cf:' + f.name] = true
    if (Object.keys(miss).length) { setErrors(miss); setBanner('Please complete the highlighted required fields.'); return }
    setSaving(true); setBanner('')
    try {
      const body: Row = {}
      for (const f of def.fields) {
        if (f.secret || f.hidden) continue
        if (f.readonly || f.computed) continue
        const v = vals[f.name]
        if (f.virtual && (v === null || v === undefined || v === '')) continue
        body[f.name] = v === '' ? null : v
      }
      if (customDefs.length) body.custom = custom
      if (kidDefs.length) body.children = Object.fromEntries(kidDefs.map(c => [c.key, kids[c.key].map(r => { const { _labels, ...rest } = r; return Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('__'))) })]))
      if (edit) body.version = record!.version
      const saved = edit ? await put<Row>(`/api/e/${def.key}/${record!.id}`, body) : await post<Row>(`/api/e/${def.key}`, body)
      toast.ok(`${def.label} ${edit ? 'saved' : 'created'}`)
      onSaved(saved)
    } catch (e: any) { setBanner(e.message ?? 'Could not save'); if (e.details?.field) setErrors({ [e.details.field]: true }) }
    finally { setSaving(false) }
  }

  const customDefs = def.customFieldDefs ?? []
  const locked = (f: FieldDef) => edit && (lockedOnEdit.includes(f.name) || (def.key === 'vendor_services' && record?.charges_created && VENDOR_SERVICE_COMMERCIAL.includes(f.name)))

  return (
    <form className="entity-form" onSubmit={e => { e.preventDefault(); void submit() }}>
      <div className="entity-form-content">
      {banner && <div role="alert" className="mb-4 px-3 py-2.5 rounded-lg bg-blush border border-[#f2bcc3] text-[#8f1325] text-sm font-medium">{banner}</div>}
      {def.description && !edit && <p className="text-sm text-muted mb-4 mt-0">{def.description}</p>}
      {sections.map((s, si) => (
        <fieldset key={s.name} className={cls('border-0 p-0 m-0', si > 0 && 'mt-5')}>
          {(sections.length > 1 || s.name !== 'Details') && <legend className="font-display font-extrabold text-[13px] uppercase tracking-wider text-fold mb-2 pb-1 border-b border-line w-full">{s.name}</legend>}
          <div className="grid gap-x-5 gap-y-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {s.fields.map(f => {
              const ro = f.computed || f.readonly
              return (
                <div key={f.name} className={cls(f.span === 3 && 'md:col-span-2 xl:col-span-3', f.span === 2 && 'md:col-span-2')}>
                  <label className="label" htmlFor={`f-${f.name}`}>{f.label}{f.required && !ro && <span className="req">*</span>}</label>
                  {ro || locked(f) ? <div className="min-h-[36px] flex items-center font-bold text-ink text-[14px] px-0.5"><CellValue f={f} rec={{ ...vals, _labels: labels }} /></div>
                    : <FieldInput f={f} value={vals[f.name]} label={labels[f.name]} invalid={errors[f.name]} onChange={(v, l) => set(f.name, v, l)} />}
                  {f.help && <div className="help">{f.help}</div>}
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
      {customDefs.length > 0 && (
        <fieldset className="border-0 p-0 m-0 mt-5">
          <legend className="font-display font-extrabold text-[13px] uppercase tracking-wider text-fold mb-2 pb-1 border-b border-line w-full">Custom fields</legend>
          <div className="grid gap-x-5 gap-y-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {customDefs.map(f => <div key={f.name}><label className="label">{f.label}{f.required && <span className="req">*</span>}</label><FieldInput f={f} value={custom[f.name]} invalid={errors['cf:' + f.name]} onChange={v => setCustom(c => ({ ...c, [f.name]: v }))} /></div>)}
          </div>
        </fieldset>
      )}
      {kidDefs.map(c => (
        <div key={c.key} className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display font-extrabold text-[13px] uppercase tracking-wider text-fold">{c.label}</div>
            <div className="flex gap-2">
              {def.key === 'quotations' && c.key === 'lines' && <button type="button" className="btn outline sm" onClick={() => setPicker('rates')}><TagsIcon /> Add from rate cards</button>}
              {(def.key === 'receipts' || def.key === 'payments') && <button type="button" className="btn outline sm" disabled={!(vals.party_id || vals.vendor_id)} onClick={() => setPicker('docs')}><ListPlus /> Pick open {def.key === 'receipts' ? 'invoices' : 'bills'}</button>}
            </div>
          </div>
          <ChildEditor child={c} rows={kids[c.key] ?? []} onChange={r => setKids(k => ({ ...k, [c.key]: r }))} parent={parentView} />
        </div>
      ))}
      </div>
      <div className="entity-form-actions flex items-center gap-3 border-t border-line bg-card">
        <button type="submit" className="btn green" disabled={saving}><Save /> {saving ? 'Saving…' : edit ? 'Save Changes' : `Create ${def.label}`}</button>
        <button type="button" className="btn red" onClick={onCancel}><X /> Cancel</button>
        <span className="text-xs text-muted ml-auto hidden md:block">Fields marked <span className="text-signal font-bold">*</span> are required</span>
      </div>
      {picker === 'rates' && <RatePicker vals={vals} onClose={() => setPicker(null)} onPick={rows => { setKids(k => ({ ...k, lines: [...(k.lines ?? []), ...rows.map(r => previewRow('quotation_lines', r, vat, vals))] })); setPicker(null) }} />}
      {picker === 'docs' && <OpenDocsPicker kind={def.key === 'receipts' ? 'receipt' : 'payment'} partyId={vals.party_id ?? vals.vendor_id} currency={vals.currency} existing={kids.allocations ?? []} onClose={() => setPicker(null)} onPick={rows => { setKids(k => ({ ...k, allocations: rows })); const sum = rows.reduce((s, r) => s + Number(r.amount || 0), 0); if (!vals.amount || vals.amount < sum) set('amount', Math.round(sum * 100) / 100); setPicker(null) }} />}
    </form>
  )
}

function RatePicker({ vals, onClose, onPick }: { vals: Row; onClose: () => void; onPick: (rows: Row[]) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [kind, setKind] = useState('Sell')
  useEffect(() => { setRows(null); get<Row[]>('/api/rates/search', { kind, mode: vals.mode, origin_id: vals.pol_id, destination_id: vals.pod_id, customer_id: vals.customer_id }).then(setRows).catch(() => setRows([])) }, [kind])
  return (
    <Modal open onClose={onClose} title="Add from rate cards" width={900} footer={<><span className="text-sm text-muted">{sel.size} selected</span><div className="flex-1" /><button className="btn outline" onClick={onClose}>Close</button>
      <button className="btn green" disabled={!sel.size} onClick={() => onPick((rows ?? []).filter(r => sel.has(r.id)).map(r => ({ charge_code_id: r.charge_code_id, description: [r.charge, r.basis].filter(Boolean).join(' – '), basis: r.basis, qty: 1, rate: kind === 'Sell' ? r.rate : 0, cost_rate: kind === 'Buy' ? r.rate : 0, _labels: { charge_code_id: r.charge } })))}>Add to quotation</button></>}>
      <div className="flex gap-2 mb-3">{['Sell', 'Buy'].map(k => <button key={k} className={cls('btn sm', kind === k ? 'green' : 'outline')} onClick={() => setKind(k)}>{k === 'Sell' ? 'Sell rates (price lists)' : 'Buy rates (cost)'}</button>)}<span className="text-xs text-muted self-center">Filtered by service, origin and destination of this quotation. Rates are not converted between currencies.</span></div>
      {!rows ? <Loading /> : rows.length === 0 ? <div className="text-center text-muted py-8">No active rate-card lines match this lane. Maintain them under CRM &amp; Sales → Rate Cards.</div> : (
        <div className="table-wrap border border-line rounded-xl max-h-[50vh]"><table className="grid"><thead><tr><th /><th>Rate card</th><th>Charge</th><th>Lane</th><th>Basis</th><th className="num">Rate</th><th>Cur</th><th>Valid to</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td><input type="checkbox" checked={sel.has(r.id)} onChange={e => setSel(s => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n })} /></td><td>{r.card}<div className="text-xs text-muted">{r.vendor}</div></td><td>{r.charge}</td><td>{r.origin} → {r.destination}</td><td>{r.basis}</td><td className="num">{fmtMoney(r.rate)}</td><td>{r.currency}</td><td>{r.valid_to}</td></tr>)}
        </tbody></table></div>)}
    </Modal>
  )
}

function OpenDocsPicker({ kind, partyId, currency, existing, onClose, onPick }: { kind: 'receipt' | 'payment'; partyId: number; currency?: string; existing: Row[]; onClose: () => void; onPick: (rows: Row[]) => void }) {
  const [docs, setDocs] = useState<Row[] | null>(null)
  const [amt, setAmt] = useState<Record<number, number>>({})
  useEffect(() => { get<Row[]>(kind === 'receipt' ? '/api/finance/open-invoices' : '/api/finance/open-bills', { [kind === 'receipt' ? 'party_id' : 'vendor_id']: partyId, currency }).then(d => { setDocs(d); const m: Record<number, number> = {}; for (const x of existing) m[x[kind === 'receipt' ? 'invoice_id' : 'bill_id']] = x.amount; setAmt(m) }).catch(() => setDocs([])) }, [])
  const key = kind === 'receipt' ? 'invoice_id' : 'bill_id'
  return (
    <Modal open onClose={onClose} title={kind === 'receipt' ? 'Open invoices' : 'Open bills'} width={760} footer={<><div className="flex-1" /><button className="btn outline" onClick={onClose}>Close</button><button className="btn green" onClick={() => onPick((docs ?? []).filter(d => amt[d.id] > 0).map(d => ({ [key]: d.id, amount: amt[d.id], _labels: { [key]: d.invoice_no ?? d.bill_no } })))}>Apply allocation</button></>}>
      {!docs ? <Loading /> : docs.length === 0 ? <div className="text-center text-muted py-8">No open documents{currency ? ` in ${currency}` : ''} for this party.</div> : (
        <table className="grid"><thead><tr><th>Document</th><th>Date</th><th>Due</th><th>Cur</th><th className="num">Balance</th><th className="num" style={{ width: 150 }}>Allocate</th></tr></thead><tbody>
          {docs.map(d => <tr key={d.id}><td className="font-bold">{d.invoice_no ?? d.bill_no}{d.vendor_invoice_no && <div className="text-xs text-muted">{d.vendor_invoice_no}</div>}</td><td>{d.invoice_date ?? d.bill_date}</td><td>{d.due_date}</td><td>{d.currency}</td><td className="num">{fmtMoney(d.balance)}</td>
            <td><div className="flex gap-1"><input className="input text-right" type="number" step="0.01" min="0" max={d.balance} value={amt[d.id] ?? ''} onChange={e => setAmt(a => ({ ...a, [d.id]: Number(e.target.value) }))} /><button type="button" className="btn outline sm" onClick={() => setAmt(a => ({ ...a, [d.id]: d.balance }))}>Full</button></div></td></tr>)}
        </tbody></table>)}
    </Modal>
  )
}

export function EntityFormModal({ entity, id, presets, onClose, onSaved, lockedOnEdit, childKeys, title, width }: { entity: string; id?: number; presets?: Row; onClose: () => void; onSaved: (r: Row) => void; lockedOnEdit?: string[]; childKeys?: string[]; title?: string; width?: number }) {
  const { def } = useMeta()
  const d = def(entity)
  const [rec, setRec] = useState<Row | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { if (id) get<Row>(`/api/e/${entity}/${id}`).then(setRec).catch(e => setErr(e.message)) }, [id, entity])
  return (
    <Modal open onClose={onClose} persistent title={title ?? (id ? `Edit ${d.label}` : `New ${d.label}`)} width={width ?? (d.fields.filter(f => !f.hidden).length > 14 || (d.children?.length ?? 0) > 0 ? 1100 : 760)}>
      {err ? <div className="text-signal">{err}</div> : id && !rec ? <Loading /> : <EntityForm def={d} record={rec} presets={presets} onCancel={onClose} onSaved={onSaved} lockedOnEdit={lockedOnEdit} childKeys={childKeys} />}
    </Modal>
  )
}
void Badge

