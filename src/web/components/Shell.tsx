import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Languages, Bell, BookOpen, Search, User, CircleHelp, Power, Menu, ChevronDown, ChevronRight, LayoutDashboard, X, KeyRound, ShieldCheck, Calculator, ExternalLink, Command, Check } from 'lucide-react'
import { useMeta } from '../lib/meta'
import { get, post } from '../lib/api'
import { iconByName } from '../lib/icons'
import { cls, fmtIsoStamp } from '../lib/format'
import { Dropdown, Modal, useClickOutside } from '../ui/kit'
import { tr, lang, setLang } from '../lib/i18n'
import { CommandPalette } from './CommandPalette'

function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 15000); return () => clearInterval(i) }, [])
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(t)) p[x.type] = x.value
  return <>{`${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}:${(p.dayPeriod ?? '').toUpperCase()} Asia/Dubai`}</>
}

function NotificationBell() {
  const nav = useNavigate(), qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ unread: number; rows: any[] }>('/api/notifications'), refetchInterval: 60000 })
  const unread = q.data?.unread ?? 0
  const read = async (ids?: number[]) => { await post('/api/notifications/read', ids ? { ids } : { all: true }); void qc.invalidateQueries({ queryKey: ['notifications'] }) }
  return (
    <div className="relative" ref={ref}>
      <button className="tb" onClick={() => setOpen(o => !o)} aria-label={`Notifications, ${unread} unread`}><Bell /><span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-white/90 text-fold text-xs font-extrabold">{unread}</span></button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(380px,92vw)] bg-card text-ink border border-line rounded-xl shadow-2xl overflow-hidden fade-in z-50">
          <div className="flex items-center px-4 py-2.5 border-b border-line"><b className="font-display">Notifications</b><div className="flex-1" />{unread > 0 && <button className="btn ghost sm" onClick={() => void read()}><Check /> Mark all read</button>}</div>
          <div className="max-h-[60vh] overflow-auto">
            {!q.data?.rows.length ? <div className="p-8 text-center text-muted text-sm">You're all caught up.</div> : q.data.rows.map(n => (
              <button key={n.id} className={cls('w-full text-start px-4 py-3 border-0 border-b border-line bg-transparent cursor-pointer hover:bg-hover', !n.read_at && 'bg-[#f1faf5]')} onClick={() => { void read([n.id]); setOpen(false); if (n.link) nav(n.link) }}>
                <div className="flex gap-2 items-start">{!n.read_at && <span className="w-2 h-2 rounded-full bg-emerald mt-1.5 flex-none" />}<div className="min-w-0"><div className="text-[13.5px] font-semibold text-ink">{n.title}</div>{n.body && <div className="text-xs text-muted truncate">{n.body}</div>}<div className="text-[11px] text-muted mt-0.5">{fmtIsoStamp(n.created_at)}</div></div></div>
              </button>))}
          </div>
        </div>)}
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { meta } = useMeta()
  const loc = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const groups = meta?.nav ?? []
  const activeGroup = useMemo(() => groups.find(g => g.items.some(i => loc.pathname === i.to || loc.pathname.startsWith(i.to + '/') || (i.to === '/e/jobs' && loc.pathname.startsWith('/jobs')))), [groups, loc.pathname])
  useEffect(() => { if (activeGroup) setOpen(o => ({ ...o, [activeGroup.label]: true })) }, [activeGroup?.label])
  return (
    <nav className="sidebar h-full" aria-label="Main navigation">
      <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => cls('group-btn no-underline', isActive && 'bg-white/10')} style={{ borderLeft: '3px solid transparent' }}><LayoutDashboard />{tr('Dashboard')}</NavLink>
      {groups.map(g => {
        const Icon = iconByName(g.icon); const isOpen = open[g.label]
        return (
          <div key={g.label}>
            <button className="group-btn" aria-expanded={!!isOpen} onClick={() => setOpen(o => ({ ...o, [g.label]: !o[g.label] }))}><Icon />{g.label}<span className="flex-1" />{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
            {isOpen && g.items.map(i => {
              const I = iconByName(i.icon)
              const active = loc.pathname === i.to || loc.pathname.startsWith(i.to + '/') || (i.to === '/e/jobs' && loc.pathname.startsWith('/jobs'))
              return <Link key={i.to} to={i.to} onClick={onNavigate} className={cls('navlink', active && 'active')}><I />{i.label}</Link>
            })}
          </div>)
      })}
      <div className="px-4 py-4 text-[11px] text-[#7d8f85]">Elvora Logistics OS v1.0</div>
    </nav>
  )
}

export function Shell() {
  const { me, setMe, meta } = useMeta()
  const nav = useNavigate()
  const [mobile, setMobile] = useState(false)
  const [palette, setPalette] = useState(false)
  const [guide, setGuide] = useState(false)
  const loc = useLocation()
  useEffect(() => { setMobile(false) }, [loc.pathname])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  const logout = async () => { try { await post('/api/auth/logout') } catch { /* ignore */ } setMe(null); nav('/login') }
  const isPrint = loc.pathname.startsWith('/print')
  return (
    <div className="h-full flex flex-col">
      <header className="topbar no-print">
        <button className="tb lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu /></button>
        <Link to="/" className="flex items-center gap-2 mr-2" aria-label="Elvora Logistics OS home"><img src="/brand/icon-reverse.png" alt="" width="32" height="27" className="h-7 w-auto" /><span className="font-display font-extrabold text-[17px] tracking-tight hidden sm:block">Elvora <span className="font-semibold opacity-90">Logistics OS</span></span></Link>
        <div className="flex-1" />
        <NotificationBell />
        <Link to="/e/announcements" className="tb hidden md:inline-flex"><BookOpen />{tr('Blog')}</Link>
        <button className="tb" onClick={() => setPalette(true)} aria-label="Search"><Search /><span className="hidden md:inline">{tr('Search')}</span><kbd className="hidden xl:inline text-[10px] border border-white/40 rounded px-1 ml-1">Ctrl K</kbd></button>
        <Dropdown className="tb" label={<><User /><span className="hidden sm:inline">{me?.email.split('@')[0]}</span></>} items={[
          { label: <><KeyRound size={15} /> Profile &amp; security</>, onClick: () => nav('/profile') }, { label: <><ShieldCheck size={15} /> {me?.role}</>, disabled: true }, { divider: true, label: '' }, { label: <><Power size={15} /> Sign out</>, onClick: () => void logout() }]} />
        <Dropdown className="tb hidden sm:inline-flex" label={<><CircleHelp />{tr('Help')}</>} items={[
          { label: 'Quick guide & shortcuts', onClick: () => setGuide(true) }, { label: <><Calculator size={15} /> Freight tools</>, onClick: () => nav('/tools') }, { label: <><ExternalLink size={15} /> Elvora website</>, onClick: () => window.open('https://www.elvorashipping.com', '_blank', 'noopener') }]} />
        <button className="tb" onClick={() => void logout()}><Power /><span className="hidden md:inline">{tr('Log Out')}</span></button>
        <button className="tb" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} title="English / العربية" aria-label="Language"><Languages /><span className="hidden lg:inline">{lang === 'ar' ? 'English' : 'العربية'}</span></button>
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:block no-print flex-none" style={{ width: 252 }}><div className="h-full overflow-y-auto sidebar" style={{ width: 252 }}><Sidebar /></div></aside>
        {mobile && <div className="fixed inset-0 z-[70] lg:hidden flex no-print"><div className="w-[min(300px,86vw)] h-full overflow-y-auto sidebar fade-in"><div className="flex justify-end p-2"><button className="tb text-white bg-transparent border-0" onClick={() => setMobile(false)} aria-label="Close menu"><X color="#fff" /></button></div><Sidebar onNavigate={() => setMobile(false)} /></div><div className="flex-1 bg-black/50" onClick={() => setMobile(false)} /></div>}
        <div className="flex-1 min-w-0 flex flex-col">
          {me?.demo && !isPrint && <div className="no-print bg-[#1f3a8a] text-white px-4 py-2 text-sm font-semibold flex items-center gap-3 flex-wrap">DEMO WORKSPACE – fictional data, isolated from production, resets every night. External sending (e-mail, WhatsApp, integrations) is switched off. <button className="underline bg-transparent border-0 text-white cursor-pointer font-semibold" onClick={async () => { if (confirm('Restore the demo to its original state and sign out?')) { await post('/api/demo/reset'); window.location.href = '/login' } }}>Reset demo now</button></div>}
          {me?.defaultPassword && !me?.demo && !isPrint && <div className="no-print bg-gold text-[#6b4a00] px-4 py-2 text-sm font-semibold flex items-center gap-3 flex-wrap">⚠ You are signed in with the default password. <Link to="/profile" className="underline">Change it now</Link></div>}
          <main className="app-main flex-1 overflow-y-auto p-4 md:p-6" id="main"><Outlet /></main>
          <footer className="statusbar no-print"><span className="s1">User : {me?.email}</span><span className="s2"><Clock /></span><span className="s3 flex-1">Elvora Logistics OS · Elvora Shipping L.L.C.</span></footer>
        </div>
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <Modal open={guide} onClose={() => setGuide(false)} title="Quick guide" width={640}>
        <div className="grid gap-4 text-sm">
          <div><b className="font-display text-ink">Search anything</b> — press <kbd className="border border-line rounded px-1.5">Ctrl</kbd> + <kbd className="border border-line rounded px-1.5">K</kbd> for jobs, containers, customers, invoices, quotations and more.</div>
          <div><b className="font-display text-ink">Job screen</b> — open any Master Job to see Accounting, SB/BOE, Customs, Shipments and Inventory tabs. The right-hand rail holds comments, follow-ups, attachments, references, tags, links, likes, complaints, video calls and the full change history.</div>
          <div><b className="font-display text-ink">From quote to cash</b> — Quotation → (margin approval) → Job → charges → Invoice → Receipt. Costs flow Job → Vendor bill → Payment. Everything posts to a double-entry ledger.</div>
          <div><b className="font-display text-ink">Warehouse</b> — Goods receipt → stock by owner / bin / lot → Dispatch (earliest expiry first). Adjust and transfer from Stock on Hand.</div>
          <div><b className="font-display text-ink">Printing</b> — open a document and press Print; choose "Save as PDF" in the print dialog to get a file.</div>
          <div className="text-muted">{meta?.settings.company_name} · {meta?.entities.length} record types · times shown in Asia/Dubai</div>
        </div>
      </Modal>
    </div>
  )
}
export type { ReactNode }
void useRef
