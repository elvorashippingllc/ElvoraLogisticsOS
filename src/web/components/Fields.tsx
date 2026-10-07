import type { FieldDef } from '@shared/types'
import { optLabel, optValue } from '@shared/types'
import { RefSelect } from './RefSelect'
import { cls, fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../lib/format'
import { Badge } from '../ui/kit'
import { Check } from 'lucide-react'

export function FieldInput({ f, value, label, onChange, disabled, invalid, compact, onRef }: { f: FieldDef; value: any; label?: string; onChange: (v: any, label?: string) => void; disabled?: boolean; invalid?: boolean; compact?: boolean; onRef?: (id: number | null) => void }) {
  const common = { disabled, 'aria-invalid': invalid || undefined, id: `f-${f.name}` } as const
  switch (f.type) {
    case 'textarea': return <textarea className={cls('textarea', invalid && 'invalid')} {...common} value={value ?? ''} onChange={e => onChange(e.target.value)} rows={compact ? 1 : 3} />
    case 'int': case 'number': case 'percent': case 'money':
      return <input className={cls('input', invalid && 'invalid', compact && 'text-right')} {...common} type="number" inputMode="decimal" step={f.type === 'int' ? 1 : f.type === 'money' ? 0.01 : 'any'} min={f.min} max={f.max} value={value ?? ''} placeholder={f.placeholder} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    case 'date': return <input className={cls('input', invalid && 'invalid')} {...common} type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)} />
    case 'datetime': return <input className={cls('input', invalid && 'invalid')} {...common} type="datetime-local" value={value ?? ''} onChange={e => onChange(e.target.value || null)} />
    case 'select': return (
      <select className={cls('select', invalid && 'invalid')} {...common} value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">{f.required ? 'Select…' : '—'}</option>
        {(f.options ?? []).map(o => <option key={optValue(o)} value={optValue(o)}>{optLabel(o)}</option>)}
      </select>)
    case 'bool': return (
      <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px] select-none">
        <input type="checkbox" className="w-4 h-4 accent-emerald" {...common} checked={!!value} onChange={e => onChange(e.target.checked)} /><span className="text-[13.5px] text-body">{value ? 'Yes' : 'No'}</span>
      </label>)
    case 'ref': return <RefSelect entity={f.ref!} value={value} label={label} filter={f.refFilter as any} disabled={disabled} invalid={invalid} onChange={(id, l) => { onChange(id, l); onRef?.(id) }} />
    case 'email': return <input className={cls('input', invalid && 'invalid')} {...common} type="email" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    case 'url': return <input className={cls('input', invalid && 'invalid')} {...common} type="url" placeholder="https://" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    case 'phone': return <input className={cls('input', invalid && 'invalid')} {...common} type="tel" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    default: return <input className={cls('input', invalid && 'invalid')} {...common} type="text" value={value ?? ''} placeholder={f.placeholder} onChange={e => onChange(e.target.value)} />
  }
}

/** Read-only rendering of a value by field type. */
export function CellValue({ f, rec, statusField }: { f: FieldDef; rec: Record<string, any>; statusField?: string }) {
  const v = rec[f.name]
  if (v === null || v === undefined || v === '') return <span className="text-muted">—</span>
  switch (f.type) {
    case 'ref': return <span>{rec._labels?.[f.name] ?? `#${v}`}</span>
    case 'money': return <span className="num">{fmtMoney(v)}</span>
    case 'number': return <span className="num">{fmtNum(v)}</span>
    case 'int': return <span className="num">{v}</span>
    case 'percent': return <span className="num">{fmtNum(v)}%</span>
    case 'date': return <span>{fmtDate(v)}</span>
    case 'datetime': return <span>{fmtDateTime(v)}</span>
    case 'bool': return v ? <Check size={16} className="text-emerald" aria-label="Yes" /> : <span className="text-muted">No</span>
    case 'select': return (f.name === statusField || /status|stage|priority|condition|kind/i.test(f.name)) ? <Badge value={String(v)} /> : <span>{String(v)}</span>
    case 'email': return <a className="link" href={`mailto:${v}`} onClick={e => e.stopPropagation()}>{v}</a>
    case 'url': return <a className="link" href={v} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{String(v).replace(/^https?:\/\//, '')}</a>
    case 'phone': return <a className="link" href={`tel:${v}`} onClick={e => e.stopPropagation()}>{v}</a>
    case 'textarea': return <span className="whitespace-pre-wrap">{String(v)}</span>
    default: return <span>{String(v)}</span>
  }
}
