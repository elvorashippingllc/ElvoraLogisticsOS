import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ChildDef, FieldDef } from '@shared/types'
import { useMeta } from '../lib/meta'
import { FieldInput, CellValue } from './Fields'
import { fmtMoney } from '../lib/format'
import { useVatRates } from '../lib/lookups'
import { get } from '../lib/api'
import { cls } from '../lib/format'

export type Row = Record<string, any>
const num = (v: any) => Number(v) || 0
const r2 = (n: number) => Math.round((n + (n < 0 ? -1e-9 : 1e-9)) * 100) / 100

/** client-side preview of the server's line maths (the server remains the source of truth) */
export function previewRow(entity: string, row: Row, vat: Record<number, number>, parent: Row): Row {
  const out = { ...row }
  if ('qty' in out || 'rate' in out) {
    if (['quotation_lines', 'invoice_lines', 'bill_lines', 'job_charges', 'po_lines'].includes(entity)) {
      out.amount = r2((out.qty ?? 1) * num(out.rate))
      const pct = entity === 'po_lines' ? num(out.vat_pct ?? 5) : out.vat_code_id ? num(vat[out.vat_code_id]) : 0
      out.vat_amount = r2(out.amount * pct / 100)
      if (entity === 'quotation_lines') out.cost_amount = r2((out.qty ?? 1) * num(out.cost_rate))
      if (entity === 'job_charges') out.base_amount = r2(out.amount * num(out.ex_rate || 1))
    }
  }
  if (entity === 'customs_lines') { out.duty_amount = r2(num(out.value) * num(out.duty_pct) / 100); out.vat_amount = r2((num(out.value) + out.duty_amount) * num(out.vat_pct) / 100) }
  void parent
  return out
}

export function rowTotals(entity: string, rows: Row[]) {
  const sum = (k: string) => r2(rows.reduce((s, r) => s + num(r[k]), 0))
  switch (entity) {
    case 'quotation_lines': return [['Sell total', sum('amount')], ['VAT', sum('vat_amount')], ['Total', r2(sum('amount') + sum('vat_amount'))], ['Est. cost', sum('cost_amount')], ['Margin', r2(sum('amount') - sum('cost_amount'))]] as [string, number][]
    case 'invoice_lines': case 'bill_lines': case 'po_lines': return [['Subtotal', sum('amount')], ['VAT', sum('vat_amount')], ['Total', r2(sum('amount') + sum('vat_amount'))]] as [string, number][]
    case 'job_charges': {
      const rev = r2(rows.filter(r => r.kind !== 'Cost').reduce((s, r) => s + num(r.base_amount), 0)), cost = r2(rows.filter(r => r.kind === 'Cost').reduce((s, r) => s + num(r.base_amount), 0))
      return [['Revenue (AED)', rev], ['Cost (AED)', cost], ['Profit (AED)', r2(rev - cost)]] as [string, number][]
    }
    case 'customs_lines': return [['Value', sum('value')], ['Duty', sum('duty_amount')], ['VAT', sum('vat_amount')]] as [string, number][]
    case 'journal_lines': return [['Debit', sum('debit')], ['Credit', sum('credit')], ['Difference', r2(sum('debit') - sum('credit'))]] as [string, number][]
    case 'receipt_allocations': case 'payment_allocations': return [['Allocated', sum('amount')]] as [string, number][]
  }
  return []
}

export function ChildEditor({ child, rows, onChange, readOnly, parent, hideColumns }: { child: ChildDef; rows: Row[]; onChange: (r: Row[]) => void; readOnly?: boolean; parent: Row; hideColumns?: string[] }) {
  const { def } = useMeta()
  const vat = useVatRates()
  const cdef = def(child.entity)
  const cols: FieldDef[] = useMemo(() => {
    const byName = new Map(cdef.fields.map(f => [f.name, f]))
    const names = child.columns ?? cdef.fields.filter(f => !f.hidden && f.name !== child.fk).map(f => f.name)
    return names.map(n => byName.get(n)!).filter(Boolean).filter(f => !hideColumns?.includes(f.name)).filter(f => !(readOnly && f.name === 'ex_rate')).slice(0, 10)
  }, [cdef, child, hideColumns, readOnly])
  const set = (i: number, patch: Row) => onChange(rows.map((r, k) => (k === i ? previewRow(child.entity, { ...r, ...patch }, vat, parent) : r)))
  const add = () => {
    const base: Row = {}
    for (const f of cdef.fields) { if (f.default !== undefined && f.default !== null && !f.computed) base[f.name] = f.default === 'today' ? new Date().toLocaleDateString('sv-SE') : f.default === 'now' ? new Date().toLocaleString('sv-SE').slice(0, 16).replace(' ', 'T') : f.default === 'me' ? undefined : f.default }
    if (child.entity === 'job_charges' && parent.client_id) base.party_id = parent.client_id
    if (child.entity === 'job_charges' && parent.__currency) base.currency = parent.__currency
    if (['invoice_lines', 'bill_lines', 'quotation_lines'].includes(child.entity)) base.qty = 1
    onChange([...rows, previewRow(child.entity, base, vat, parent)])
  }
  const picked = async (i: number, f: FieldDef, id: number | null) => {
    if (f.name !== 'charge_code_id' || !id) return
    try {
      const cc = await get<any>(`/api/e/charge_codes/${id}`)
      const patch: Row = {}
      if (!rows[i]?.description) patch.description = cc.name
      if (cc.vat_code_id) { patch.vat_code_id = cc.vat_code_id; patch._labels = { ...(rows[i]?._labels ?? {}), vat_code_id: cc._labels?.vat_code_id } }
      if ((rows[i]?.rate === undefined || rows[i]?.rate === null || rows[i]?.rate === '') && cc.default_rate && rows[i]?.kind !== 'Cost' && child.entity !== 'bill_lines') patch.rate = cc.default_rate
      if (child.entity === 'job_charges' && !rows[i]?.basis && cc._labels?.uom_id) patch.basis = cc._labels.uom_id
      set(i, patch)
    } catch { /* ignore */ }
  }
  const totals = rowTotals(child.entity, rows)
  const mono = new Set(['money', 'number', 'int', 'percent'])
  return (
    <div>
      <div className="table-wrap border border-line rounded-xl">
        <table className="grid" style={{ minWidth: Math.max(560, cols.length * 130) }}>
          <thead><tr>{cols.map(f => <th key={f.name} className={mono.has(f.type) ? 'num' : ''}>{f.label}</th>)}{!readOnly && !child.fixed && <th style={{ width: 40 }} />}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="text-center text-muted py-5">No {child.label.toLowerCase()} yet{!readOnly && ' — add the first row'}</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id ?? `n${i}`}>
                {cols.map(f => {
                  const ro = readOnly || f.computed || (f.readonly && !!r.id)
                  return <td key={f.name} className={mono.has(f.type) ? 'num' : ''} style={{ minWidth: f.type === 'ref' || f.type === 'text' ? 150 : f.type === 'select' ? 120 : 100, padding: ro ? undefined : '5px 6px' }}>
                    {ro ? <CellValue f={f} rec={r} /> : <FieldInput f={f} compact value={r[f.name]} label={r._labels?.[f.name]} onChange={(v, l) => set(i, { [f.name]: v, ...(f.type === 'ref' ? { _labels: { ...(r._labels ?? {}), [f.name]: l } } : {}) })} onRef={id => void picked(i, f, id)} />}
                  </td>
                })}
                {!readOnly && !child.fixed && <td style={{ padding: '5px 6px' }}><button type="button" className="btn ghost icon sm" onClick={() => onChange(rows.filter((_, k) => k !== i))} aria-label="Remove row"><Trash2 className="text-signal" /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
        {!readOnly && !child.fixed ? <button type="button" className="btn outline sm" onClick={add}><Plus /> Add row</button> : <span />}
        {totals.length > 0 && <div className="flex gap-4 flex-wrap">{totals.map(([l, v]) => <div key={l} className="text-right"><div className="text-[11px] text-muted font-semibold">{l}</div><div className={cls('font-display font-extrabold text-[15px]', l === 'Difference' && Math.abs(v) > 0.004 ? 'text-signal' : 'text-ink')}>{fmtMoney(v)}</div></div>)}</div>}
      </div>
    </div>
  )
}
