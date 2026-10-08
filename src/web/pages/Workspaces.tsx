import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, LayoutDashboard, Search, User, CircleHelp, Calculator, BookOpen, Languages, ExternalLink, Power } from 'lucide-react'
import type { NavGroup } from '@shared/types'
import { useMeta } from '../lib/meta'
import { iconByName } from '../lib/icons'
import { tr, lang, setLang } from '../lib/i18n'
import { Empty, PageHeader } from '../ui/kit'

// Group icon keys are stable across languages and permission-filtered item lists.
export const workspaceId = (g: NavGroup) => g.icon.toLowerCase()
export const workspacePath = (g: NavGroup) => '/workspace/' + workspaceId(g)
const flowOrder = ['Handshake', 'Ship', 'Truck', 'Warehouse', 'Landmark', 'ListChecks', 'Users', 'Bot', 'BadgeCheck', 'BarChart3', 'Database', 'Settings']

export function Workspaces() {
  const { meta, me } = useMeta()
  const { workspace } = useParams()
  const [query, setQuery] = useState('')
  const groups = [...(meta?.nav ?? [])].filter(g => g.items.length).sort((a, b) => {
    const rank = (g: NavGroup) => { const n = flowOrder.indexOf(g.icon); return n < 0 ? flowOrder.length : n }
    return rank(a) - rank(b)
  })
  const selected = groups.find(g => workspaceId(g) === workspace)
  const needle = query.trim().toLocaleLowerCase()
  const cards = groups.filter(g => !needle || g.label.toLocaleLowerCase().includes(needle) || g.items.some(i => i.label.toLocaleLowerCase().includes(needle)))
  const matches = groups.flatMap(g => g.items.map(i => ({ ...i, group: g.label }))).filter(i => i.label.toLocaleLowerCase().includes(needle))
  const featureCard = (i: NavGroup['items'][number], group?: string) => {
    const Icon = iconByName(i.icon)
    return <Link to={i.to} className="feature-card" key={i.to}><span className="feature-icon"><Icon size={20} /></span><span className="feature-copy"><strong>{i.label}</strong>{group && <span>{group}</span>}</span><ArrowUpRight size={17} className="feature-arrow" /></Link>
  }
  if (workspace && !selected) return <Empty title="Workspace unavailable" hint="Choose a workspace available to your account." action={<Link className="btn green" to="/">Workspaces</Link>} />
  return <div className="workspace-page">
    {!selected && <div className="workspace-intro"><div><h1>Good to see you{me?.name ? `, ${me.name.split(' ')[0]}` : ''}.</h1><p>Sales to shipments. Accounts to operations. Choose where to work today.</p></div><img src="/brand/icon-primary.png" alt="" /></div>}
    <PageHeader title={selected?.label ?? 'Workspaces'} subtitle={selected ? 'Choose the work you want to do.' : 'Choose a workspace, then select your task.'} actions={!selected && <Link to="/dashboard" className="btn dark"><LayoutDashboard />{tr('Dashboard')}</Link>} />
    <div className="workspace-heading-tools"><label className="workspace-search"><Search size={18} /><input className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={selected ? `Search ${selected.label}` : 'Find a workspace or feature'} aria-label={selected ? `Search ${selected.label}` : 'Find a workspace or feature'} /></label></div>
    {selected ? <><div className="workspace-feature-grid">{selected.items.filter(i => i.label.toLocaleLowerCase().includes(needle)).map(i => featureCard(i))}</div>{!selected.items.some(i => i.label.toLocaleLowerCase().includes(needle)) && <Empty title="No matching features" action={<button className="btn outline" onClick={() => setQuery('')}>Clear search</button>} />}<Link to="/" className="workspace-return"><ArrowLeft size={16} />All workspaces</Link></> : needle ? <><div className="workspace-feature-grid">{matches.map(i => featureCard(i, i.group))}</div>{!matches.length && !cards.length && <Empty title="No matching workspaces or features" action={<button className="btn outline" onClick={() => setQuery('')}>Clear search</button>} />}{cards.length > 0 && <div className="workspace-card-grid mt-6">{cards.map(g => <WorkspaceCard key={workspaceId(g)} group={g} />)}</div>}</> : <><div className="workspace-card-grid">{cards.map(g => <WorkspaceCard key={workspaceId(g)} group={g} />)}</div><nav className="workspace-flow" aria-label="From quote to cash">{[['Quotation', '/e/quotations'], ['Job', '/e/jobs'], ['Invoice', '/e/invoices'], ['Receipt', '/e/receipts']].filter(([, to]) => groups.some(g => g.items.some(i => i.to === to))).map(([label, to]) => <Link to={to} key={to}>{label}<ArrowUpRight size={15} /></Link>)}</nav></>}
  </div>
}

function WorkspaceCard({ group }: { group: NavGroup }) {
  const Icon = iconByName(group.icon)
  return <Link to={workspacePath(group)} className="workspace-card"><div className="workspace-card-symbol"><Icon size={32} strokeWidth={1.5} /><ArrowUpRight size={20} /></div><h2>{group.label}</h2><div className="workspace-card-preview">{group.items.slice(0, 3).map(i => <span key={i.to}>{i.label}</span>)}</div><div className="workspace-card-foot"><span>{group.items.length} features</span><span>Open workspace <ArrowUpRight size={15} /></span></div></Link>
}

export function WorkspaceUtilities() {
  const { me } = useMeta()
  const { openGuide, openSearch, logout } = useOutletContext<{ openGuide: () => void; openSearch: () => void; logout: () => Promise<void> }>()
  return <div className="workspace-page"><PageHeader title="Profile & security" subtitle={<>{me?.email} · {me?.role}</>} /><div className="workspace-feature-grid">
    <Link className="feature-card" to="/profile"><User /><strong>Profile &amp; security</strong><ArrowUpRight /></Link>
    <button className="feature-card" onClick={openGuide}><CircleHelp /><strong>Quick guide &amp; shortcuts</strong><ArrowUpRight /></button>
    <button className="feature-card" onClick={openSearch}><Search /><strong>{tr('Search')}</strong><ArrowUpRight /></button>
    <Link className="feature-card" to="/tools"><Calculator /><strong>Freight tools</strong><ArrowUpRight /></Link>
    <Link className="feature-card" to="/e/announcements"><BookOpen /><strong>{tr('Blog')}</strong><ArrowUpRight /></Link>
    <a className="feature-card" href="https://www.elvorashipping.com" target="_blank" rel="noopener noreferrer"><ExternalLink /><strong>Elvora website</strong><ArrowUpRight /></a>
    <button className="feature-card" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Languages /><strong>{lang === 'ar' ? 'English' : 'العربية'}</strong><ArrowUpRight /></button>
    <button className="feature-card" onClick={() => void logout()}><Power /><strong>Sign out</strong><ArrowUpRight /></button>
  </div><p className="text-xs text-muted mt-6">Elvora Logistics OS v1.0</p></div>
}

