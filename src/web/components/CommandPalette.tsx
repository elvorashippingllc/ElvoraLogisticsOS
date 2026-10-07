import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { get } from '../lib/api'
import { useMeta } from '../lib/meta'
import { iconByName } from '../lib/icons'
import { cls } from '../lib/format'

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate(); const { meta } = useMeta()
  const [q, setQ] = useState(''); const [remote, setRemote] = useState<any[]>([]); const [hi, setHi] = useState(0)
  const pages = useMemo(() => (meta?.nav ?? []).flatMap(g => g.items.map(i => ({ group: 'Go to', label: i.label, link: i.to, icon: i.icon, sub: g.label }))), [meta])
  useEffect(() => {
    if (q.trim().length < 2) { setRemote([]); return }
    const t = setTimeout(() => { get<any[]>('/api/search/global', { q }).then(setRemote).catch(() => setRemote([])) }, 160)
    return () => clearTimeout(t)
  }, [q])
  const local = q.trim() ? pages.filter(p => p.label.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : pages.slice(0, 8)
  const items = [...remote.map(r => ({ group: r.group, label: r.label, link: r.link, icon: r.icon, sub: '' })), ...local]
  useEffect(() => setHi(0), [q, remote.length])
  const go = (l: string) => { onClose(); nav(l) }
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  let lastGroup = ''
  return (
    <div className="overlay" style={{ paddingTop: '10vh' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Search">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line"><Search size={18} className="text-muted" /><input autoFocus className="flex-1 bg-transparent border-0 outline-none text-[16px] text-ink" placeholder="Search jobs, containers, customers, invoices… or jump to a page" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, items.length - 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) } else if (e.key === 'Enter' && items[hi]) go(items[hi].link) }} /><kbd className="text-xs border border-line rounded px-1.5 text-muted">Esc</kbd></div>
        <div className="max-h-[56vh] overflow-auto py-1">
          {items.length === 0 && <div className="p-8 text-center text-muted text-sm">No results for “{q}”.</div>}
          {items.map((it, i) => {
            const I = iconByName(it.icon); const head = it.group !== lastGroup; lastGroup = it.group
            return (<div key={i}>{head && <div className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{it.group}</div>}
              <button className={cls('w-full text-start flex items-center gap-3 px-4 py-2 border-0 cursor-pointer text-[14px]', i === hi ? 'bg-mint text-fold' : 'bg-transparent text-ink hover:bg-hover')} onMouseEnter={() => setHi(i)} onClick={() => go(it.link)}><I size={16} className="flex-none" /><span className="flex-1 truncate">{it.label}</span>{it.sub && <span className="text-xs text-muted">{it.sub}</span>}{i === hi && <CornerDownLeft size={14} />}</button></div>)
          })}
        </div>
      </div>
    </div>
  )
}
