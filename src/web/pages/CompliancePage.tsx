import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarClock, CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw } from 'lucide-react'
import { get, post } from '../lib/api'
import { useToast } from '../lib/toast'
import { PageHeader, Loading, ErrorBox, Badge, Empty, Tabs, useDialogs } from '../ui/kit'
import { fmtDate } from '../lib/format'

const ICON = { ok: <CheckCircle2 size={18} className="text-emerald" />, warn: <AlertTriangle size={18} style={{ color: '#b7791f' }} />, fail: <XCircle size={18} style={{ color: '#c32135' }} />, info: <Info size={18} className="text-muted" /> }
const TONE: Record<string, 'green' | 'amber' | 'red' | 'grey'> = { ok: 'green', warn: 'amber', fail: 'red', info: 'grey' }
const sevTone = (s: string) => (s === 'Blocker' ? 'red' : s === 'Warning' ? 'amber' : 'grey') as 'red' | 'amber' | 'grey'
const dayText = (d: number) => (d < 0 ? `${-d} days overdue` : d === 0 ? 'today' : `in ${d} days`)

export function CompliancePage() {
  const [tab, setTab] = useState('overview')
  const toast = useToast(); const qc = useQueryClient(); const dlg = useDialogs()
  const ov = useQuery({ queryKey: ['compliance'], queryFn: () => get<any>('/api/compliance/overview') })
  const ex = useQuery({ queryKey: ['compliance-ex'], queryFn: () => get<any>('/api/e/compliance_exceptions', { pageSize: 200 }), enabled: tab === 'exceptions' })
  const gen = async () => { try { const r = await post<any>('/api/compliance/generate-calendar', {}); toast.ok(`Calendar updated: ${r.created} added, ${r.updated} changed`); await qc.invalidateQueries({ queryKey: ['compliance'] }) } catch (e: any) { toast.error(e.message) } }
  const ack = async (id: number) => {
    const note = await dlg.prompt({ title: 'Acknowledge finding', label: 'Review note (why is this acceptable?)', required: true, multiline: true, ok: 'Acknowledge' })
    if (!note) return
    try { await post(`/api/compliance/exceptions/${id}/acknowledge`, { note }); toast.ok('Finding acknowledged'); await ex.refetch(); await qc.invalidateQueries({ queryKey: ['compliance'] }) } catch (e: any) { toast.error(e.message) }
  }
  if (ov.error) return <ErrorBox error={ov.error} />
  const d = ov.data
  if (!d) return <Loading />
  const open = (ex.data?.rows ?? []).filter((r: any) => r.status !== 'Resolved')
  return (
    <div className="fade-in">
      <PageHeader icon={<BadgeCheck size={20} />} title="Compliance Centre (UAE)" subtitle={`${d.identity.name}${d.identity.name_ar ? ' · ' + d.identity.name_ar : ''} · Licence ${d.identity.licence_no || '—'}${d.identity.authority ? ' · ' + d.identity.authority : ''}`}
        actions={<><button className="btn outline" onClick={() => void gen()}><RefreshCw /> Generate calendar</button><Link className="btn outline" to="/admin/settings">Settings</Link></>} />
      <div className="card overflow-hidden">
        <Tabs variant="sub" tabs={[{ key: 'overview', label: 'Readiness' }, { key: 'scope', label: 'Licensed scope' }, { key: 'deadlines', label: 'Deadlines & renewals', count: d.deadlines.length + d.expiring.length }, { key: 'exceptions', label: 'Exceptions' }]} value={tab} onChange={setTab} />
        <div className="p-4 md:p-6">
          {tab === 'overview' && <>
            <div className="flex items-center gap-4 flex-wrap mb-4">
              <div className="rounded-xl bg-soft border border-line px-5 py-3"><div className="text-xs text-muted">Readiness score</div><div className="text-[30px] font-extrabold font-display">{d.score}%</div></div>
              <div className="text-[13px] text-muted max-w-xl">Enforcement: <b>{d.mode.compliance}</b> (statutory invoice rules {d.mode.compliance === 'enforce' ? 'block posting' : 'only warn'}) · licensed-scope check: <b>{d.mode.scope}</b>. Change both under Company Settings. Indicative aid – confirm obligations with your tax and legal advisers.</div>
            </div>
            <div className="grid gap-2">{d.checks.map((c: any) => (
              <Link key={c.key} to={c.link ?? '#'} className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 no-underline text-inherit hover:bg-hover">
                {ICON[c.status as keyof typeof ICON]}<div className="flex-1"><div className="font-bold text-[14px]">{c.label}</div><div className="text-[13px] text-muted">{c.detail}</div></div><Badge tone={TONE[c.status]} value={c.status === 'ok' ? 'OK' : c.status === 'warn' ? 'Attention' : c.status === 'fail' ? 'Action needed' : 'Info'} />
              </Link>))}</div>
          </>}
          {tab === 'scope' && <>
            <p className="text-[13.5px] mt-0">The trade licence lists four activities. Jobs, quotations, transport orders and warehouse receipts are checked against them. Services marked <b>Not licensed</b> are available in the OS but not covered by the licence – obtain the activity or permit first, or subcontract to a licensed party. Manage the list under <Link to="/e/licence_activities">Licensed activities</Link>.</p>
            <div className="card table-wrap"><table className="grid"><thead><tr><th>Service</th><th>Licence</th><th className="num">Jobs</th><th>What it needs</th></tr></thead><tbody>{d.scope.map((s: any) => <tr key={s.code}><td>{s.label}</td><td><Badge tone={s.covered ? 'green' : 'red'} value={s.covered ? 'Licensed' : 'Not licensed'} /></td><td className="num">{s.jobs}</td><td className="text-[13px]">{s.note}</td></tr>)}</tbody></table></div>
          </>}
          {tab === 'deadlines' && <>
            <h3 className="mt-0">Upcoming statutory deadlines</h3>
            {!d.deadlines.length ? <Empty title="No deadlines yet" hint="Press Generate calendar to create VAT, corporate tax, e-invoicing and renewal deadlines from your settings." icon={<CalendarClock />} /> :
              <div className="card table-wrap"><table className="grid"><thead><tr><th>Obligation</th><th>Period</th><th>Due</th><th>When</th><th>Status</th></tr></thead><tbody>{d.deadlines.map((f: any) => <tr key={f.id}><td><Link to={`/e/compliance_filings/${f.id}`}>{f.type}</Link></td><td>{f.period}</td><td>{fmtDate(f.due_date)}</td><td>{dayText(f.days)}</td><td><Badge tone={f.status === 'Overdue' || f.days < 0 ? 'red' : f.days <= 14 ? 'amber' : 'blue'} value={f.status} /></td></tr>)}</tbody></table></div>}
            <h3>Licences & registrations expiring within 90 days</h3>
            {!d.expiring.length ? <Empty title="Nothing expiring soon" /> :
              <div className="card table-wrap"><table className="grid"><thead><tr><th>Item</th><th>Type</th><th>Expiry</th><th>When</th></tr></thead><tbody>{d.expiring.map((f: any) => <tr key={f.id}><td><Link to={`/e/compliance_items/${f.id}`}>{f.name}</Link></td><td>{f.type}</td><td>{fmtDate(f.expiry_date)}</td><td><Badge tone={f.days < 0 ? 'red' : f.days <= 30 ? 'amber' : 'blue'} value={dayText(f.days)} /></td></tr>)}</tbody></table></div>}
          </>}
          {tab === 'exceptions' && (ex.error ? <ErrorBox error={ex.error} /> : !ex.data ? <Loading /> : !open.length ? <Empty title="No open compliance exceptions" hint="Findings appear here when a document breaks a UAE rule or falls outside the licensed activities." icon={<BadgeCheck />} /> :
            <div className="card table-wrap"><table className="grid"><thead><tr><th>Severity</th><th>Rule</th><th>Finding</th><th>Record</th><th>Status</th><th /></tr></thead><tbody>{open.map((r: any) => <tr key={r.id}><td><Badge tone={sevTone(r.severity)} value={r.severity} /></td><td>{r.rule}</td><td className="text-[13px]">{r.message}</td><td>{r.link_entity && r.link_id ? <Link to={`/e/${r.link_entity}/${r.link_id}`}>{r.link_label || r.link_entity}</Link> : r.link_label}</td><td>{r.status}{r.note ? <div className="text-xs text-muted">{r.note}</div> : null}</td><td>{r.status === 'Open' && <button className="btn outline sm" onClick={() => void ack(r.id)}>Acknowledge</button>}</td></tr>)}</tbody></table></div>)}
        </div>
      </div>
    </div>
  )
}
