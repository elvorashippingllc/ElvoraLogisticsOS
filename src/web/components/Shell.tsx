import type { NavGroup } from '@shared/types'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Search, User, Mail, LayoutGrid, ChevronRight, Check } from 'lucide-react'
import { useMeta } from '../lib/meta'
import { get, post } from '../lib/api'
import { cls, fmtIsoStamp } from '../lib/format'
import { Modal, useClickOutside } from '../ui/kit'
import { tr } from '../lib/i18n'
import { ProductBrand } from './ProductBrand'
import { CommandPalette } from './CommandPalette'
import { workspacePath } from '../pages/Workspaces'
import { iconByName } from '../lib/icons'

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
        <div className="notification-popover bg-card text-ink border border-line rounded-xl shadow-2xl overflow-hidden fade-in z-50">
          <div className="flex items-center px-4 py-2.5 border-b border-line"><b className="font-display">Notifications</b><div className="flex-1" />{unread > 0 && <button className="btn ghost sm" onClick={() => void read()}><Check /> Mark all read</button>}</div>
          <div className="max-h-[60vh] overflow-auto">
            {!q.data?.rows.length ? <div className="p-8 text-center text-muted text-sm">You're all caught up.</div> : q.data.rows.map(n => (
              <button key={n.id} className={cls('w-full text-start px-4 py-3 border-0 border-b border-line bg-transparent cursor-pointer hover:bg-hover', !n.read_at && 'bg-[#f1faf5]')} onClick={() => { void read([n.id]); setOpen(false); if (n.link) nav(n.link) }}>
                <div className="flex gap-2 items-start">{!n.read_at && <span className="w-2 h-2 rounded-full bg-emerald mt-1.5 flex-none" />}<div className="min-w-0"><div className="text-[13.5px] font-semibold text-ink">{n.title}</div>{n.body && <div className="text-xs text-muted notification-body">{n.body}</div>}<div className="text-[11px] text-muted mt-0.5">{fmtIsoStamp(n.created_at)}</div></div></div>
              </button>))}
          </div>
        </div>)}
    </div>
  )
}

export function Shell() {
  const { me, setMe, meta } = useMeta()
  const nav = useNavigate()
  const [palette, setPalette] = useState(false)
  const [guide, setGuide] = useState(false)
  const [workspaceMenu, setWorkspaceMenu] = useState<NavGroup | null>(null)
  const loc = useLocation()
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  const logout = async () => { try { await post('/api/auth/logout') } catch { /* ignore */ } setMe(null); nav('/login') }
  const activeGroup = meta?.nav.find(g => g.items.some(i => { const path = i.to.split('?')[0]; return loc.pathname === path || loc.pathname.startsWith(path + '/') || (path === '/e/jobs' && loc.pathname.startsWith('/jobs/')) }))
  const isPrint = loc.pathname.startsWith('/print')
  return (
    <div className="workspace-frame h-full flex flex-col">
      <header className="topbar no-print">
        <Link to="/" className="flex items-center gap-2 mr-2" aria-label="Elvora Logistics OS home"><img src="/brand/logo-primary.png?v=elvora-website-4" alt="Elvora Shipping LLC" width="132" height="35" className="h-8 w-auto max-w-[132px] object-contain" /><span className="font-display font-extrabold text-[17px] tracking-tight hidden sm:block">Logistics OS</span></Link>
        <nav className="primary-pills" aria-label="Primary navigation">
          <Link to="/dashboard" className={cls('primary-pill', loc.pathname === '/dashboard' && 'active')}><LayoutGrid size={15} />Dashboard</Link>
          <Link to="/" className={cls('primary-pill', (loc.pathname === '/' || loc.pathname.startsWith('/workspace/')) && 'active')}>Workspaces</Link>
          {meta?.nav.some(g => g.items.some(i => i.to.startsWith('/reports'))) && <Link to="/reports" className={cls('primary-pill', loc.pathname === '/reports' && 'active')}>Reports</Link>}
        </nav>
        <div className="flex-1" />
        {!me?.party_id && (canEmail(me?.permissions)) && <Link to="/email" className="tb" aria-label="Email"><Mail /><span className="toolbar-label">Email</span></Link>}
        <NotificationBell />
        <button className="tb" onClick={() => setPalette(true)} aria-label="Search"><Search /><span className="toolbar-label">{tr('Search')}</span><kbd className="hidden xl:inline text-[10px] border border-line rounded px-1">Ctrl K</kbd></button>
        <Link to="/workspace-tools" className="tb" aria-label="Account, help and language"><User /><span className="toolbar-label">{me?.email.split('@')[0]}</span></Link>
      </header>
      <div className="flex flex-1 min-h-0">
        {!isPrint && <nav className="workspace-rail no-print" aria-label="Workspace shortcuts">
          <button onClick={() => setWorkspaceMenu({ label: 'All workspaces', icon: 'LayoutGrid', items: (meta?.nav || []).map(g => ({ label: g.label, to: workspacePath(g), icon: g.icon, module: 'dashboard' })) })} className={cls('rail-shortcut', loc.pathname === '/' && 'active')} aria-haspopup="dialog" aria-label="All workspaces" title="All workspaces"><LayoutGrid size={19} /><span className="rail-shortcut-label">Workspaces</span></button>
          {(meta?.nav ?? []).filter(g => g.items.length).map(g => { const Icon = iconByName(g.icon); return <button key={g.icon} onClick={() => setWorkspaceMenu(g)} aria-haspopup="dialog" className={cls('rail-shortcut', (activeGroup?.icon === g.icon || loc.pathname === workspacePath(g)) && 'active')} aria-label={g.label} title={g.label}><Icon size={19} /><span className="rail-shortcut-label">{g.label}</span></button> })}
          <button className="rail-shortcut" onClick={() => setGuide(true)} aria-label="Quick guide" title="Quick guide"><span aria-hidden="true">?</span><span className="rail-shortcut-label">Quick guide</span></button>
        </nav>}
        <div className="flex-1 min-w-0 flex flex-col">
          {me?.demo && !isPrint && <div className="demo-notice no-print"><span><strong>Demo workspace</strong> · fictional data · external sending disabled</span><details><summary>Details</summary><p>Isolated from production. Resets every night. External e-mail, WhatsApp and integrations are switched off.</p><button className="btn outline sm" onClick={async () => { if (confirm('Restore the demo to its original state and sign out?')) { await post('/api/demo/reset'); window.location.href = '/login' } }}>Reset demo</button></details></div>}
          {me?.defaultPassword && !me?.demo && !isPrint && <div className="no-print bg-gold text-[#6b4a00] px-4 py-2 text-sm font-semibold flex items-center gap-3 flex-wrap">⚠ You are signed in with the default password. <Link to="/profile" className="underline">Change it now</Link></div>}
          <main className="app-main flex-1 overflow-y-auto p-4 md:p-6" id="main">
            {!isPrint && loc.pathname !== '/' && <nav className="workspace-breadcrumb no-print" aria-label="Breadcrumb"><Link to="/"><LayoutGrid size={16} />Workspaces</Link>{activeGroup && <><ChevronRight size={14} /><Link to={workspacePath(activeGroup)}>{activeGroup.label}</Link></>}</nav>}
            <Outlet context={{ openGuide: () => setGuide(true), openSearch: () => setPalette(true), logout }} />
          </main>
          <footer className="statusbar no-print"><span className="s1">User : {me?.email}</span><span className="s2"><Clock /></span><span className="s3 flex-1">Elvora Logistics OS</span><ProductBrand compact /></footer>
        </div>
      </div>
      <Modal open={!!workspaceMenu} onClose={() => setWorkspaceMenu(null)} title={workspaceMenu?.label} width={700}>
        <p className="text-muted">{workspaceDescription(workspaceMenu?.icon)}</p>
        <nav className="workspace-menu-links" aria-label={workspaceMenu?.label}>{workspaceMenu?.items.map(item => <Link key={item.to} to={item.to} onClick={() => setWorkspaceMenu(null)}><span>{item.label}</span><ChevronRight size={18} /></Link>)}</nav>
        {workspaceMenu && <Link className="btn green mt-5" to={workspaceMenu.icon === 'LayoutGrid' ? '/' : workspacePath(workspaceMenu)} onClick={() => setWorkspaceMenu(null)}>Open {workspaceMenu.label}</Link>}
      </Modal>
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



function canEmail(p: any) { return p === '*' || ['crm', 'finance', 'admin'].some(k => p?.[k]?.includes('view') || p?.[k]?.includes('*')) }
function workspaceDescription(icon?: string) {
  const descriptions: Record<string, string> = { Handshake: 'Keep customer details, follow up enquiries, prepare quotations and record calls.', Users: 'Manage staff, leave and payroll, and follow up customer complaints and cargo claims.', Truck: 'Plan transport trips, assign drivers and vehicles, and review fuel and maintenance.', ListChecks: 'Manage tasks, handovers, shipment documents and the shared document library.', Bot: 'Ask the AI team for help, review approvals and check its activity.', BadgeCheck: 'Review licences, filing dates and compliance exceptions.', Database: 'Maintain ports, carriers, currencies, charge codes and other shared reference data.', Briefcase: 'Plan and manage shipment jobs, bookings, cargo movements and delivery.', Ship: 'Plan and manage shipment jobs, bookings, cargo movements and delivery.', FileText: 'Prepare shipment documents, manage originals and check what is still needed.', Wallet: 'Raise invoices, record receipts, pay suppliers and review outstanding balances.', Landmark: 'Raise invoices, record receipts, pay suppliers and review outstanding balances.', Warehouse: 'Receive goods, check stock and organise dispatches.', Settings: 'Manage company settings, users, connections and system activity.', Shield: 'Review company licences, approvals and compliance checks.', BarChart3: 'Review business results, customer balances and shipment performance.' }
  return descriptions[icon || ''] || 'Choose a task below, or open the workspace to see its tools and records.'
}
