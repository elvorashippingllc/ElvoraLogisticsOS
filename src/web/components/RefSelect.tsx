import { useEffect, useRef, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { get } from '../lib/api'
import { useClickOutside } from '../ui/kit'
import { cls } from '../lib/format'

interface Opt { id: number; label: string; sub?: string }
const cache = new Map<string, Opt[]>()

export function RefSelect({ entity, value, label, onChange, filter, disabled, invalid, placeholder = 'Search…', allowClear = true }: { entity: string; value: number | null | undefined; label?: string; onChange: (id: number | null, label?: string) => void; filter?: Record<string, any>; disabled?: boolean; invalid?: boolean; placeholder?: string; allowClear?: boolean }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [opts, setOpts] = useState<Opt[]>([])
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState<string>(label ?? '')
  const [hi, setHi] = useState(0)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const timer = useRef<any>(null)
  const fkey = JSON.stringify(filter ?? {})

  // resolve label for an id we only know numerically
  useEffect(() => {
    if (!value) { setShown(''); return }
    if (label) { setShown(label); return }
    let dead = false
    get<Opt[]>(`/api/e/${entity}/lookup`, { ids: String(value) }).then(r => { if (!dead && r[0]) setShown(r[0].label) }).catch(() => {})
    return () => { dead = true }
  }, [value, label, entity])

  useEffect(() => {
    if (!open) return
    clearTimeout(timer.current)
    const k = `${entity}|${fkey}|${text}`
    if (cache.has(k)) { setOpts(cache.get(k)!); return }
    setBusy(true)
    timer.current = setTimeout(() => {
      get<Opt[]>(`/api/e/${entity}/lookup`, { q: text, filter: filter && Object.keys(filter).length ? filter : undefined, limit: 25 }).then(r => { cache.set(k, r); if (cache.size > 300) cache.delete(cache.keys().next().value!); setOpts(r); setHi(0) }).catch(() => setOpts([])).finally(() => setBusy(false))
    }, text ? 180 : 0)
    return () => clearTimeout(timer.current)
  }, [open, text, entity, fkey])

  const pick = (o: Opt) => { onChange(o.id, o.label); setShown(o.label); setOpen(false); setText('') }
  return (
    <div className="ref-select relative" ref={ref}>
      <div className="relative">
        <input className={cls('input pr-14', invalid && 'invalid')} disabled={disabled} placeholder={shown ? '' : placeholder} value={open ? text : shown} title={shown}
          onFocus={() => { setOpen(true); setText('') }} onChange={e => { setText(e.target.value); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, opts.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
            else if (e.key === 'Enter' && open && opts[hi]) { e.preventDefault(); pick(opts[hi]) }
            else if (e.key === 'Escape') setOpen(false)
          }} autoComplete="off" role="combobox" aria-expanded={open} />
        <div className="ref-select-actions absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {allowClear && value && !disabled ? <button type="button" className="btn ghost icon sm" style={{ width: 22, minHeight: 22 }} onClick={() => { onChange(null); setShown('') }} aria-label="Clear"><X size={13} /></button> : null}
          <ChevronDown size={15} className="text-muted pointer-events-none" />
        </div>
      </div>
      {open && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-line rounded-xl shadow-xl max-h-64 overflow-auto fade-in" role="listbox">
          {busy && !opts.length && <div className="px-3 py-2 text-sm text-muted">Searching…</div>}
          {!busy && !opts.length && <div className="px-3 py-2 text-sm text-muted">No matches</div>}
          {opts.map((o, i) => <div key={o.id} role="option" aria-selected={o.id === value} className={cls('px-3 py-2 text-[13.5px] cursor-pointer flex justify-between gap-2', i === hi ? 'bg-mint text-fold' : 'hover:bg-hover', o.id === value && 'font-bold')} onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(o) }}><span className="truncate">{o.label}</span>{o.sub && <span className="text-xs text-muted flex-none">{o.sub}</span>}</div>)}
        </div>
      )}
    </div>
  )
}
export const clearRefCache = () => cache.clear()

