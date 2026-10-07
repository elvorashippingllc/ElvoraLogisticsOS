import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Settings, ScrollText, DatabaseBackup, Plus, Save, Download, Lock, ChevronDown, ChevronRight, Mail, Sparkles } from 'lucide-react'
import { get, post, put } from '../lib/api'
import { useMeta } from '../lib/meta'
import { Badge, ErrorBox, Loading, Modal, PageHeader, Pagination, Tabs, Empty, useDialogs } from '../ui/kit'
import { useToast } from '../lib/toast'
import { cls, fmtIsoStamp } from '../lib/format'
import { ACTIONS } from '@shared/types'
import { RefSelect } from '../components/RefSelect'

export function RolesPage() {
  const { meta } = useMeta(); const qc = useQueryClient(); const toast = useToast(); const dlg = useDialogs()
  const q = useQuery({ queryKey: ['roles'], queryFn: () => get<any[]>('/api/admin/roles') })
  const [sel, setSel] = useState<number | null>(null); const [perm, setPerm] = useState<Record<string, string[]>>({}); const [creating, setCreating] = useState(false); const [nm, setNm] = useState(''); const [ds, setDs] = useState('')
  const role = q.data?.find(r => r.id === sel)
  useEffect(() => { if (role && role.permissions !== '*') setPerm(role.permissions); else setPerm({}) }, [role?.id])
  useEffect(() => { if (!sel && q.data?.length) setSel(q.data.find(r => !r.is_system)?.id ?? q.data[0].id) }, [q.data])
  const mods = meta?.modules ?? []
  const toggle = (m: string, a: string) => setPerm(p => { const cur = new Set(p[m] ?? []); if (cur.has(a)) cur.delete(a); else { cur.add(a); if (a !== 'view') cur.add('view') } if (a === 'view' && !cur.has('view')) cur.clear(); return { ...p, [m]: [...cur] } })
  const save = async () => { try { await put(`/api/e/roles/${sel}`, { permissions: Object.fromEntries(Object.entries(perm).filter(([, v]) => v.length)), version: (await get<any>(`/api/e/roles/${sel}`)).version }); toast.ok('Permissions saved — applies at the next request'); void qc.invalidateQueries({ queryKey: ['roles'] }) } catch (e: any) { toast.error(e.message) } }
  if (q.error) return <ErrorBox error={q.error} />
  return (
    <div className="fade-in">
      <PageHeader icon={<ShieldCheck size={20} />} title="Roles & permissions" subtitle="Control what each role can view, create, edit, delete, approve and export per module" actions={<button className="btn green" onClick={() => setCreating(true)}><Plus /> New role</button>} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-start">
        <div className="card overflow-hidden">{!q.data ? <Loading /> : q.data.map(r => <button key={r.id} onClick={() => setSel(r.id)} className={cls('w-full text-start px-4 py-3 border-0 border-b border-line cursor-pointer flex items-center gap-2', r.id === sel ? 'bg-mint' : 'bg-card hover:bg-hover')}><div className="flex-1 min-w-0"><div className="font-bold text-ink flex items-center gap-1.5">{r.name}{r.is_system ? <Lock size={12} className="text-muted" /> : null}</div><div className="text-xs text-muted truncate">{r.description}</div></div><span className="text-xs text-muted">{r.users} user{r.users === 1 ? '' : 's'}</span></button>)}</div>
        <div className="card p-4 md:p-5">{!role ? <Empty title="Select a role" /> : <>
          <div className="flex items-center gap-3 mb-3 flex-wrap"><h2 className="m-0 text-[18px] flex-1">{role.name}</h2>{!role.is_system && <><button className="btn red sm" onClick={async () => { if (await dlg.confirm({ title: `Delete role ${role.name}?`, danger: true, ok: 'Delete' })) { try { await fetch(`/api/e/roles/${role.id}`, { method: 'DELETE', headers: { 'x-elvora-client': 'web' } }).then(async r => { if (!r.ok) throw new Error((await r.json()).error) }); setSel(null); void qc.invalidateQueries({ queryKey: ['roles'] }) } catch (e: any) { toast.error(e.message) } } }}>Delete</button><button className="btn green" onClick={() => void save()}><Save /> Save permissions</button></>}</div>
          {role.permissions === '*' ? <div className="rounded-xl bg-mint border border-[#b7e0cb] text-fold px-4 py-3 text-sm font-semibold">This system role has full access to every module and action, including administration. It cannot be edited.</div> : (
            <div className="table-wrap border border-line rounded-xl"><table className="grid"><thead><tr><th>Module</th>{ACTIONS.map(a => <th key={a} className="text-center capitalize">{a}</th>)}<th /></tr></thead><tbody>{mods.map(m => <tr key={m.key}><td className="font-semibold">{m.label}</td>{ACTIONS.map(a => <td key={a} className="text-center"><input type="checkbox" className="w-4 h-4 accent-emerald" aria-label={`${m.label} ${a}`} disabled={role.is_system} checked={(perm[m.key] ?? []).includes(a)} onChange={() => toggle(m.key, a)} /></td>)}<td><button className="btn ghost sm" onClick={() => setPerm(p => ({ ...p, [m.key]: (p[m.key]?.length ?? 0) === ACTIONS.length ? [] : [...ACTIONS] }))}>All</button></td></tr>)}</tbody></table></div>)}
          <p className="text-xs text-muted mt-3 mb-0">Granting any action also grants view. “Approve” covers quotation margin, bill / payment, expense and leave approvals. Portal roles are further restricted to their own company's records.</p></>}</div>
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="New role" width={460} footer={<><div className="flex-1" /><button className="btn outline" onClick={() => setCreating(false)}>Cancel</button><button className="btn green" disabled={!nm.trim()} onClick={async () => { try { const r = await post<any>('/api/e/roles', { name: nm.trim(), description: ds, permissions: { dashboard: ['view'] } }); setCreating(false); setNm(''); setDs(''); await qc.invalidateQueries({ queryKey: ['roles'] }); setSel(r.id) } catch (e: any) { toast.error(e.message) } }}>Create</button></>}>
        <label className="label">Name<span className="req">*</span></label><input className="input mb-3" value={nm} onChange={e => setNm(e.target.value)} autoFocus /><label className="label">Description</label><input className="input" value={ds} onChange={e => setDs(e.target.value)} /></Modal>
    </div>
  )
}

export function SettingsPage() {
  const toast = useToast(); const qc = useQueryClient(); const { reload } = useMeta()
  const q = useQuery({ queryKey: ['settings'], queryFn: () => get<Record<string, any>>('/api/admin/settings') })
  const [s, setS] = useState<Record<string, any>>({}); const [tab, setTab] = useState('company'); const [busy, setBusy] = useState(false)
  useEffect(() => { if (q.data) setS(q.data) }, [q.data])
  if (q.error) return <ErrorBox error={q.error} />
  if (!q.data) return <Loading />
  const set = (k: string, v: any) => setS(x => ({ ...x, [k]: v }))
  const I = ({ k, label, type = 'text', help, span }: { k: string; label: string; type?: string; help?: string; span?: boolean }) => <div className={span ? 'md:col-span-2' : ''}><label className="label">{label}</label><input className="input" type={type} value={s[k] ?? ''} onChange={e => set(k, type === 'number' ? e.target.value : e.target.value)} />{help && <div className="help">{help}</div>}</div>
  const T = ({ k, label, rows = 4 }: { k: string; label: string; rows?: number }) => <div className="md:col-span-2"><label className="label">{label}</label><textarea className="textarea" rows={rows} value={s[k] ?? ''} onChange={e => set(k, e.target.value)} /></div>
  const save = async () => { setBusy(true); try { await put('/api/admin/settings', s); toast.ok('Settings saved'); await qc.invalidateQueries({ queryKey: ['settings'] }); await reload() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  return (
    <div className="fade-in">
      <PageHeader icon={<Settings size={20} />} title="Company settings" subtitle="Legal details printed on documents, finance controls, e-mail delivery and tools" actions={<button className="btn green" onClick={() => void save()} disabled={busy}><Save /> {busy ? 'Saving…' : 'Save settings'}</button>} />
      <div className="card overflow-hidden"><Tabs variant="sub" tabs={[{ key: 'company', label: 'Company' }, { key: 'finance', label: 'Finance & approvals' }, { key: 'docs', label: 'Document text' }, { key: 'mail', label: 'E-mail (SMTP)' }, { key: 'uae', label: 'UAE compliance' }, { key: 'tools', label: 'Tracking & tools' }]} value={tab} onChange={setTab} />
        <div className="p-4 md:p-6 grid gap-4 md:grid-cols-2 max-w-4xl">
          {tab === 'company' && <><I k="company_name" label="Company name" /><I k="company_trn" label="Tax registration number (TRN)" help="Printed on tax invoices. UAE TRN is 15 digits." /><I k="company_trade_license" label="Trade licence no." /><I k="company_phone" label="Phone" /><I k="company_email" label="E-mail (sales)" type="email" /><I k="company_info_email" label="General enquiries e-mail" type="email" help="Printed on documents next to the sales address." /><I k="company_website" label="Website" /><T k="company_address" label="Address" rows={3} /></>}
          {tab === 'finance' && <><I k="quote_validity_days" label="Quotation validity (days)" type="number" /><I k="min_margin_pct" label="Minimum quotation margin %" type="number" help="Quotes below this margin need approval before sending." /><I k="bill_approval_limit" label="Vendor bills needing approval from (AED)" type="number" help="0 disables the approval step." /><I k="payment_approval_limit" label="Payments needing approval from (AED)" type="number" /><div><label className="label">Accounting lock date</label><input className="input" type="date" value={s.lock_date ?? ''} onChange={e => set('lock_date', e.target.value)} /><div className="help">No posting, voiding or journals dated on or before this date. Set after month-end close.</div></div><div><label className="label">Base currency</label><input className="input" value={s.base_currency} disabled /><div className="help">Fixed at AED for this installation.</div></div><T k="bank_details" label="Bank details printed on invoices" rows={4} /></>}
          {tab === 'docs' && <><T k="quote_terms" label="Quotation terms & conditions (default)" rows={6} /><T k="invoice_terms" label="Invoice terms (default)" rows={5} /><I k="invoice_footer" label="Document footer" span /><p className="md:col-span-2 text-xs text-muted m-0">Have your legal adviser review these texts, including your standard trading conditions and any liability limitation, before relying on them.</p></>}
          {tab === 'mail' && <><I k="smtp_host" label="SMTP host" help="e.g. smtp.office365.com" /><I k="smtp_port" label="Port" type="number" /><I k="smtp_user" label="Username" /><div><label className="label">Password</label><input className="input" type="password" autoComplete="new-password" value={s.smtp_pass ?? ''} onChange={e => set('smtp_pass', e.target.value)} placeholder="unchanged" /></div><I k="smtp_from" label="From address" help='e.g. "Elvora Shipping" <noreply@elvorashipping.com>' span /><label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.smtp_secure} onChange={e => set('smtp_secure', e.target.checked)} /> Use TLS on connect (port 465)</label>
            <div className="md:col-span-2 flex gap-2 flex-wrap"><button className="btn outline" onClick={async () => { await save(); const r = await post<any>('/api/admin/smtp-test'); r.ok ? toast.ok('SMTP connection verified') : toast.error(r.error) }}><Mail /> Save &amp; test connection</button><button className="btn outline" onClick={async () => { await post('/api/admin/outbox/retry'); toast.ok('Queued messages will be retried') }}>Retry queued / failed e-mails</button></div>
            <p className="md:col-span-2 text-xs text-muted m-0">Until SMTP is configured, messages are stored in the outbox with status “Not configured” and are sent automatically after you save valid settings and retry.</p></>}
          {tab === 'uae' && <><I k="company_name_ar" label="Company name (Arabic)" help="Printed on documents; must match the trade licence." /><I k="licence_name_en" label="Name exactly as on the licence" help="Used to check that documents carry the licensed name." /><I k="company_legal_form" label="Legal form" /><I k="licence_authority" label="Licensing authority" /><I k="licence_issue_date" label="Licence issue date" type="date" /><I k="licence_expiry_date" label="Licence expiry date" type="date" /><I k="dcci_no" label="Chamber membership no." /><I k="commercial_register_no" label="Commercial register no." />
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.vat_registered} onChange={e => set('vat_registered', e.target.checked)} /> VAT-registered with the FTA (untick if not yet registered – VAT can then not be charged)</label>
            <div><label className="label">VAT filing frequency</label><select className="select" value={s.vat_filing_frequency} onChange={e => set('vat_filing_frequency', e.target.value)}><option>Quarterly</option><option>Monthly</option></select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={!!s.ct_registered} onChange={e => set('ct_registered', e.target.checked)} /> Registered for corporate tax</label>
            <I k="ct_trn" label="Corporate tax TRN" /><I k="financial_year_end" label="Financial year end (MM-DD)" help="e.g. 12-31" />
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.einv_revenue_over_50m} onChange={e => set('einv_revenue_over_50m', e.target.checked)} /> Annual revenue is AED 50 million or more (earlier e-invoicing deadlines)</label>
            <div><label className="label">Statutory rules</label><select className="select" value={s.compliance_mode} onChange={e => set('compliance_mode', e.target.value)}><option value="enforce">Enforce – block non-compliant postings</option><option value="advisory">Advisory – warn only</option></select></div>
            <div><label className="label">Licensed-activity check</label><select className="select" value={s.activity_scope_mode} onChange={e => set('activity_scope_mode', e.target.value)}><option value="warn">Warn and log an exception</option><option value="block">Block jobs outside the licence</option><option value="off">Off</option></select></div>
            <I k="sanctions_review_days" label="Re-screen parties every (days)" type="number" />
            <p className="md:col-span-2 text-xs text-muted m-0">See the Compliance Centre for readiness, deadlines and exceptions. These settings are a working aid, not legal or tax advice.</p></>}
          {tab === 'tools' && <><div><label className="label">Air volumetric divisor</label><select className="select" value={s.weight_divisor_air} onChange={e => set('weight_divisor_air', Number(e.target.value))}><option value={6000}>6000 (IATA)</option><option value={5000}>5000</option><option value={4000}>4000</option></select></div><I k="free_days_default" label="Default container free days" type="number" /><label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.tracking_public_enabled} onChange={e => set('tracking_public_enabled', e.target.checked)} /> Allow public customer tracking links</label></>}
        </div></div>
    </div>
  )
}

export function AuditPage() {
  const { def } = useMeta()
  const [f, setF] = useState<Record<string, string>>({}); const [page, setPage] = useState(1); const [open, setOpen] = useState<number | null>(null)
  const params = { ...f, page, pageSize: 50 }
  const q = useQuery({ queryKey: ['audit', params], queryFn: () => get<any>('/api/admin/audit', params), placeholderData: p => p })
  const set = (k: string, v: string) => { setF(x => ({ ...x, [k]: v })); setPage(1) }
  const label = (e: string, n: string) => { try { return def(e).fields.find(x => x.name === n)?.label ?? n } catch { return n } }
  return (
    <div className="fade-in">
      <PageHeader icon={<ScrollText size={20} />} title="Audit log" subtitle="Every create, change, delete, posting, download and permission event — who, when and what changed" />
      <div className="card p-3 mb-4 flex gap-3 flex-wrap items-end">
        <div><label className="label">Record type</label><input className="input" placeholder="e.g. invoices" value={f.entity ?? ''} onChange={e => set('entity', e.target.value)} /></div><div><label className="label">User</label><input className="input" value={f.user ?? ''} onChange={e => set('user', e.target.value)} /></div>
        <div><label className="label">Action</label><select className="select" value={f.action ?? ''} onChange={e => set('action', e.target.value)}><option value="">Any</option>{['create', 'update', 'delete', 'upload', 'attachment', 'password-change', 'settings', 'backup', 'edi-generated', 'force-signout'].map(a => <option key={a}>{a}</option>)}</select></div>
        <div><label className="label">From</label><input className="input" type="date" value={f.from ?? ''} onChange={e => set('from', e.target.value)} /></div><div><label className="label">To</label><input className="input" type="date" value={f.to ?? ''} onChange={e => set('to', e.target.value)} /></div><div className="flex-1 min-w-[180px]"><label className="label">Search text</label><input className="input" value={f.q ?? ''} onChange={e => set('q', e.target.value)} /></div>
      </div>
      <div className="card overflow-hidden">{!q.data ? <Loading /> : <><div className="table-wrap"><table className="grid"><thead><tr><th style={{ width: 30 }} /><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Label</th></tr></thead><tbody>{q.data.rows.map((r: any) => <><tr key={r.id} className="clickable" onClick={() => setOpen(open === r.id ? null : r.id)}><td>{r.changes ? (open === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td><td className="whitespace-nowrap">{fmtIsoStamp(r.at)}</td><td>{r.user_name}</td><td><Badge value={r.action} tone={r.action === 'delete' ? 'red' : r.action === 'create' ? 'green' : 'blue'} /></td><td>{r.entity} #{r.record_id}</td><td>{r.record_label}</td></tr>{open === r.id && r.changes && <tr key={r.id + 'd'}><td /><td colSpan={5} className="!bg-soft"><div className="grid gap-0.5 text-[12.5px]">{Object.entries<any>(r.changes).map(([k, v]) => <div key={k}><b>{label(r.entity, k)}</b>: {k === '_children' ? JSON.stringify(v) : <><s className="text-muted">{String(v?.[0] ?? '∅')}</s> → <b>{String(v?.[1] ?? '∅')}</b></>}</div>)}{r.ip && <div className="text-muted">IP {r.ip}</div>}</div></td></tr>}</>)}</tbody></table></div>
        <Pagination page={page} pageSize={50} total={q.data.total} onPage={setPage} /></>}</div>
    </div>
  )
}

export function BackupPage() {
  const toast = useToast(); const qc = useQueryClient(); const dlg = useDialogs()
  const sys = useQuery({ queryKey: ['system'], queryFn: () => get<any>('/api/admin/system') })
  const bk = useQuery({ queryKey: ['backups'], queryFn: () => get<any[]>('/api/admin/backups') })
  const logins = useQuery({ queryKey: ['logins'], queryFn: () => get<any[]>('/api/admin/login-events') })
  const mb = (n: number) => (n / 1048576).toFixed(1) + ' MB'
  if (!sys.data) return <Loading />
  const s = sys.data
  return (
    <div className="fade-in">
      <PageHeader icon={<DatabaseBackup size={20} />} title="Backup & data" subtitle="Database snapshots, storage use and sign-in security events" actions={<button className="btn green" onClick={async () => { try { await post('/api/admin/backups'); toast.ok('Backup created'); void qc.invalidateQueries({ queryKey: ['backups'] }) } catch (e: any) { toast.error(e.message) } }}><Database /> Create backup now</button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5"><h3 className="m-0 mb-3 text-[16px]">System</h3><dl className="kv !grid-cols-[170px_1fr]"><dt>Version</dt><dd>{s.version}</dd><dt>Runtime</dt><dd>Node {s.node} · {s.env}</dd><dt>Time zone</dt><dd>{s.timezone}</dd><dt>Database size</dt><dd>{mb(s.db_bytes)}</dd><dt>Uploaded files</dt><dd>{mb(s.upload_bytes)}</dd><dt>E-mail (SMTP)</dt><dd>{s.smtp ? <Badge value="Configured" tone="green" /> : <Badge value="Not configured" tone="amber" />}</dd><dt>Uptime</dt><dd>{Math.round(s.uptime_s / 60)} min</dd></dl>
          <div className="mt-3 text-xs text-muted">Snapshots are consistent copies of the database file in <code>data/backups</code>. Copy them — and the <code>data/uploads</code> folder — to storage outside this server (nightly is typical). To restore, stop the app, replace <code>data/elvora.db</code> with a snapshot and start again.</div>
          </div>
        <div className="card p-5"><h3 className="m-0 mb-3 text-[16px]">Snapshots</h3>{!bk.data ? <Loading /> : bk.data.length === 0 ? <Empty title="No snapshots yet" /> : <table className="grid"><tbody>{bk.data.slice(0, 12).map(b => <tr key={b.name}><td>{b.name}</td><td>{mb(b.bytes)}</td><td><a className="btn outline sm" href={`/api/admin/backups/${b.name}`}><Download /> Download</a></td></tr>)}</tbody></table>}</div>
        <div className="card p-5 lg:col-span-2"><h3 className="m-0 mb-3 text-[16px]">Records</h3><div className="grid gap-x-6 gap-y-1 grid-cols-2 md:grid-cols-4 text-sm">{Object.entries<number>(s.counts).filter(([, n]) => n > 0).map(([k, n]) => <div key={k} className="flex justify-between border-b border-line py-1"><span className="text-muted">{k.replace(/_/g, ' ')}</span><b>{n.toLocaleString()}</b></div>)}</div></div>
        <div className="card p-5 lg:col-span-2"><h3 className="m-0 mb-3 text-[16px]">Sign-in events</h3>{!logins.data ? <Loading /> : <div className="table-wrap max-h-[320px]"><table className="grid"><thead><tr><th>When</th><th>E-mail</th><th>Result</th><th>IP</th></tr></thead><tbody>{logins.data.map(l => <tr key={l.id}><td>{fmtIsoStamp(l.at)}</td><td>{l.email}</td><td><Badge value={l.success ? 'Success' : `Failed – ${l.reason}`} tone={l.success ? 'green' : 'red'} /></td><td>{l.ip}</td></tr>)}</tbody></table></div>}</div>
      </div>
    </div>
  )
}
function Database(props: any) { return <DatabaseBackup {...props} /> }
void RefSelect
