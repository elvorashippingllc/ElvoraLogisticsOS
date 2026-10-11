import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { X, ChevronDown, Loader2, Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import { cls } from '../lib/format'
import { statusTone } from '../lib/status'

export function Modal({ open, onClose, title, children, footer, width = 560, persistent = false, className }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; persistent?: boolean; className?: string }) {
  const dialog = useRef<HTMLDivElement>(null), titleId = useId(), close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const controls = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []).filter(el => el.getClientRects().length)
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) close.current()
      if (e.key === 'Tab') {
        const nodes = controls(), first = nodes[0], last = nodes[nodes.length - 1]
        if (!first) { e.preventDefault(); dialog.current?.focus() }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    if (!dialog.current?.contains(document.activeElement)) (controls()[0] || dialog.current)?.focus()
    document.addEventListener('keydown', h); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; if (previous?.isConnected) previous.focus() }
  }, [open, persistent])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget && !persistent) onClose() }}>
      <div ref={dialog} className={cls("modal", className)} style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-head"><span id={titleId}>{title}</span><button className="btn ghost icon sm" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ confirm / prompt
interface Dlg { confirm: (o: { title: string; message?: ReactNode; danger?: boolean; ok?: string }) => Promise<boolean>; prompt: (o: { title: string; label: string; required?: boolean; ok?: string; multiline?: boolean; initial?: string; message?: ReactNode }) => Promise<string | null> }
const DlgCtx = createContext<Dlg>(null as any)
export const useDialogs = () => useContext(DlgCtx)
export function DialogProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<any>(null)
  const [val, setVal] = useState('')
  const confirm = useCallback<Dlg['confirm']>(o => new Promise(res => setSt({ kind: 'confirm', ...o, res })), [])
  const prompt = useCallback<Dlg['prompt']>(o => new Promise(res => { setVal(o.initial ?? ''); setSt({ kind: 'prompt', ...o, res }) }), [])
  const close = (v: any) => { st?.res(v); setSt(null) }
  return (
    <DlgCtx.Provider value={{ confirm, prompt }}>
      {children}
      <Modal open={!!st} onClose={() => close(st?.kind === 'confirm' ? false : null)} title={st?.title} width={460} footer={
        <><button className="btn outline" onClick={() => close(st.kind === 'confirm' ? false : null)}>Cancel</button><div className="flex-1" />
          <button className={cls('btn', st?.danger ? 'red' : 'green')} disabled={st?.kind === 'prompt' && st.required && !val.trim()} onClick={() => close(st.kind === 'confirm' ? true : val.trim())}>{st?.ok ?? (st?.kind === 'prompt' ? 'Continue' : 'Confirm')}</button></>
      }>
        {st?.message && <div className="mb-3 text-[14px]">{st.message}</div>}
        {st?.kind === 'prompt' && (<div><label className="label">{st.label}{st.required && <span className="req">*</span>}</label>
          {st.multiline ? <textarea className="textarea" autoFocus value={val} onChange={e => setVal(e.target.value)} /> : <input className="input" autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (!st.required || val.trim())) close(val.trim()) }} />}</div>)}
      </Modal>
    </DlgCtx.Provider>
  )
}

export function Badge({ value, tone }: { value?: string | null; tone?: 'green' | 'blue' | 'amber' | 'red' | 'grey' | 'violet' | 'teal' }) {
  if (!value) return null
  return <span className={cls('badge', tone ?? statusTone(value))}>{value}</span>
}
export const Spinner = ({ size = 18 }: { size?: number }) => <Loader2 size={size} className="animate-spin text-muted" />
export function Loading({ label = 'Loading…' }: { label?: string }) { return <div className="loading-state flex items-center gap-2 p-6 text-muted text-sm" role="status" aria-live="polite"><Spinner /> {label}</div> }
export function Empty({ title, hint, action, icon }: { title: string; hint?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return <div className="flex flex-col items-center text-center gap-2 py-12 px-4"><div className="text-muted">{icon ?? <Inbox size={34} strokeWidth={1.5} />}</div><div className="font-display font-bold text-ink">{title}</div>{hint && <div className="text-sm text-muted max-w-md">{hint}</div>}{action}</div>
}
export function ErrorBox({ error, onRetry }: { error: any; onRetry?: () => void }) {
  return <div role="alert" className="m-4 p-4 rounded-xl border border-[#f2bcc3] bg-blush text-[#8f1325] text-sm flex items-center gap-3"><span className="flex-1">{error?.message ?? String(error)}</span>{onRetry && <button className="btn sm outline" onClick={onRetry}>Retry</button>}</div>
}

export function useClickOutside<T extends HTMLElement>(cb: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb() }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [cb])
  return ref
}
export function Dropdown({ label, items, className = 'btn violet', align = 'right', icon }: { label: ReactNode; items: { label: ReactNode; onClick?: () => void; to?: string; danger?: boolean; disabled?: boolean; divider?: boolean }[]; className?: string; align?: 'left' | 'right'; icon?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  return (
    <div className="relative inline-block" ref={ref}>
      <button className={className} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>{icon}{label}<ChevronDown size={14} /></button>
      {open && <div role="menu" className={cls('absolute z-50 mt-1 min-w-[220px] bg-card border border-line rounded-xl shadow-xl py-1 fade-in', align === 'right' ? 'right-0' : 'left-0')}>
        {items.map((it, i) => it.divider ? <div key={i} className="h-px bg-line my-1" /> : (
          <button key={i} role="menuitem" disabled={it.disabled} className={cls('w-full text-start px-3 py-2 text-[13.5px] hover:bg-hover disabled:opacity-40 cursor-pointer bg-transparent border-0 flex items-center gap-2', it.danger ? 'text-signal' : 'text-ink')}
            onClick={() => { setOpen(false); if (it.to) location.assign(it.to); else it.onClick?.() }}>{it.label}</button>))}
      </div>}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage, onSize }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onSize?: (s: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize)), from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-[13px] text-muted border-t border-line flex-wrap">
      <span>{from}–{to} of {total.toLocaleString()}</span><div className="flex-1" />
      {onSize && <select className="select" style={{ width: 84, minHeight: 30 }} value={pageSize} onChange={e => onSize(Number(e.target.value))}>{[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} / pg</option>)}</select>}
      <button className="btn outline sm icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft /></button>
      <span>Page {page} / {pages}</span>
      <button className="btn outline sm icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight /></button>
    </div>
  )
}

export function Panel({ title, color = '#15526B', tools, children, className, bodyClass = '', collapsible = true }: { title: ReactNode; color?: string; tools?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; collapsible?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <section className={cls('panel', className)}>
      <div className="panel-head" style={{ '--panel-accent': color } as CSSProperties}><span>{title}</span><div className="tools">{tools}{collapsible && <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse' : 'Expand'} title={open ? 'Collapse' : 'Expand'}><ChevronDown size={16} style={{ transform: open ? '' : 'rotate(-90deg)', transition: 'transform .2s' }} /></button>}</div></div>
      {open && <div className={bodyClass}>{children}</div>}
    </section>
  )
}
export function Tabs({ tabs, value, onChange, variant = 'bar' }: { tabs: { key: string; label: ReactNode; count?: number }[]; value: string; onChange: (k: string) => void; variant?: 'bar' | 'sub' }) {
  return <div className={variant === 'bar' ? 'tabs' : 'subtabs'} role="tablist">{tabs.map(t => <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>{t.label}{t.count !== undefined && <span className="ml-1.5 opacity-80">({t.count})</span>}</button>)}</div>
}
export function PageHeader({ title, subtitle, actions, back, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="page-header flex items-start gap-3 flex-wrap mb-4">
      {back}
      {icon && <div className="w-10 h-10 rounded-xl bg-mint text-fold grid place-items-center flex-none">{icon}</div>}
      <div className="min-w-0 flex-1"><h1 className="text-[22px] font-extrabold m-0 break-words">{title}</h1>{subtitle && <div className="text-sm text-muted mt-0.5">{subtitle}</div>}</div>
      <div className="flex items-center gap-2 flex-wrap">{actions}</div>
    </div>
  )
}
export function Kpi({ label, value, hint, tone, onClick, className }: { className?: string; label: string; value: ReactNode; hint?: ReactNode; tone?: 'red' | 'amber' | 'green'; onClick?: () => void }) {
  return <div className={cls('card kpi', className, onClick && 'cursor-pointer hover:shadow-md transition-shadow')} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }} onClick={onClick} style={tone ? { borderTop: `3px solid ${tone === 'red' ? '#c32135' : tone === 'amber' ? '#d9a21a' : '#007b52'}` } : undefined}><div className="l">{label}</div><div className="v">{value}</div>{hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}</div>
}

