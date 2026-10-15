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

// Stable component identities keep focus/caret while editing settings.
function SettingsInput({ settings, onChange, k, label, type = 'text', help, span }: { settings: Record<string, any>; onChange: (key: string, value: any) => void; k: string; label: string; type?: string; help?: string; span?: boolean }) {
  return <div className={span ? 'md:col-span-2' : ''}><label className="label" htmlFor={`setting-${k}`}>{label}</label><input id={`setting-${k}`} className="input" type={type} value={settings[k] ?? ''} onChange={e => onChange(k, e.target.value)} />{help && <div className="help">{help}</div>}</div>
}
function SettingsText({ settings, onChange, k, label, rows = 4 }: { settings: Record<string, any>; onChange: (key: string, value: any) => void; k: string; label: string; rows?: number }) {
  return <div className="md:col-span-2"><label className="label" htmlFor={`setting-${k}`}>{label}</label><textarea id={`setting-${k}`} className="textarea" rows={rows} value={settings[k] ?? ''} onChange={e => onChange(k, e.target.value)} /></div>
}

function InvoiceNumbering({ settings, onChange }: { settings: Record<string, any>; onChange: (key: string, value: any) => void }) {
  const toast = useToast(); const [next, setNext] = useState('')
  const pattern = String(settings.invoice_no_pattern ?? '')
  const custom = pattern !== '{prefix}{YY}{seq:5}'
  return <div className="md:col-span-2 document-seal-settings"><h2>Invoice numbering</h2>
    <p className="text-sm text-muted">Choose how invoice numbers look. Use <code>{'{seq:3}'}</code> for the running number, and optionally <code>{'{branch}'}</code>, <code>{'{dir}'}</code> (IMP / EXP / XTR / DOM from the trade), <code>{'{prefix}'}</code> (INV / PI / DN / CN), <code>{'{YY}'}</code>, <code>{'{YYYY}'}</code>, <code>{'{MM}'}</code>. A format such as <code>{'{branch}/{dir}/ES{seq:3}'}</code> prints DXB/IMP/ES103. You can also type your own number on any invoice.</p>
    <div className="grid gap-3 md:grid-cols-2"><SettingsInput settings={settings} onChange={onChange} k="invoice_no_pattern" label="Number format" help="Save settings after changing the format." />
      <div><label className="label" htmlFor="invoice-next">Next number in the series</label><div className="flex gap-2"><input id="invoice-next" className="input" type="number" min="1" value={next} disabled={!custom} onChange={e => setNext(e.target.value)} placeholder="e.g. 103" /><button type="button" className="btn outline" disabled={!custom || !next} onClick={async () => { try { await post('/api/finance/invoice-numbering', { next: Number(next) }); toast.ok(`The next invoice will use ${next} in the series`) } catch (e: any) { toast.error(e.message) } }}>Set</button></div><div className="help">{custom ? 'Save the format first, then set the number to continue from.' : 'Available after you choose a custom format.'}</div></div></div></div>
}

export function SettingsPage() {
  const toast = useToast(); const qc = useQueryClient(); const { reload } = useMeta()
  const q = useQuery({ queryKey: ['settings'], queryFn: () => get<Record<string, any>>('/api/admin/settings') })
  const [s, setS] = useState<Record<string, any>>({}); const [tab, setTab] = useState('company'); const [busy, setBusy] = useState(false)
  useEffect(() => { if (q.data) setS(q.data) }, [q.data])
  if (q.error) return <ErrorBox error={q.error} />
  if (!q.data) return <Loading />
  const set = (k: string, v: any) => setS(x => ({ ...x, [k]: v }))
  const save = async () => { setBusy(true); try { await put('/api/admin/settings', s); toast.ok('Settings saved'); await qc.invalidateQueries({ queryKey: ['settings'] }); await reload(); return true } catch (e: any) { toast.error(e.message); return false } finally { setBusy(false) } }
  const loadSeal = async (file?: File) => {
    if (!file) return
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) throw new Error('Use a PNG or JPEG company seal of up to 1 MB')
      const image = new Image(), url = URL.createObjectURL(file)
      try { image.src = url; await image.decode(); if (image.width > 4096 || image.height > 4096) throw new Error('Company seal dimensions must be at most 4096 pixels') } finally { URL.revokeObjectURL(url) }
      const reader = new FileReader()
      reader.onload = () => set('document_seal', String(reader.result))
      reader.onerror = () => toast.error('Could not read the seal image. Try uploading it again.')
      reader.readAsDataURL(file)
    } catch (e: any) { toast.error(e.message) }
  }
  return (
    <div className="fade-in">
      <PageHeader icon={<Settings size={20} />} title="Company settings" subtitle="Legal details printed on documents, finance controls, e-mail delivery and tools" actions={<button className="btn green" onClick={() => void save()} disabled={busy}><Save /> {busy ? 'Saving…' : 'Save settings'}</button>} />
      <div className="card overflow-hidden"><Tabs variant="sub" tabs={[{ key: 'company', label: 'Company' }, { key: 'finance', label: 'Finance & approvals' }, { key: 'docs', label: 'Document text' }, { key: 'mail', label: 'E-mail (SMTP)' }, { key: 'uae', label: 'UAE compliance' }, { key: 'tools', label: 'Tracking & tools' }]} value={tab} onChange={setTab} />
        <div className="p-4 md:p-6 grid gap-4 md:grid-cols-2 max-w-4xl">
          {tab === 'company' && <><SettingsInput settings={s} onChange={set} k="company_name" label="Company name" /><SettingsInput settings={s} onChange={set} k="company_trn" label="Tax registration number (TRN)" help="Printed on tax invoices. UAE TRN is 15 digits." /><SettingsInput settings={s} onChange={set} k="company_trade_license" label="Trade licence no." /><SettingsInput settings={s} onChange={set} k="company_phone" label="Phone" /><SettingsInput settings={s} onChange={set} k="company_email" label="E-mail (sales)" type="email" /><SettingsInput settings={s} onChange={set} k="company_info_email" label="General enquiries e-mail" type="email" help="Printed on documents next to the sales address." /><SettingsInput settings={s} onChange={set} k="company_website" label="Website" /><SettingsText settings={s} onChange={set} k="company_address" label="Address" rows={3} /></>}
          {tab === 'finance' && <><SettingsInput settings={s} onChange={set} k="quote_validity_days" label="Quotation validity (days)" type="number" /><SettingsInput settings={s} onChange={set} k="min_margin_pct" label="Minimum quotation margin %" type="number" help="Quotes below this margin need approval before sending." /><SettingsInput settings={s} onChange={set} k="bill_approval_limit" label="Vendor bills needing approval from (AED)" type="number" help="0 disables the approval step." /><SettingsInput settings={s} onChange={set} k="payment_approval_limit" label="Payments needing approval from (AED)" type="number" /><div><label className="label">Accounting lock date</label><input className="input" type="date" value={s.lock_date ?? ''} onChange={e => set('lock_date', e.target.value)} /><div className="help">No posting, voiding or journals dated on or before this date. Set after month-end close.</div></div><div><label className="label">Base currency</label><input className="input" value={s.base_currency} disabled /><div className="help">Fixed at AED for this installation.</div></div><SettingsText settings={s} onChange={set} k="bank_details" label="Bank details printed on invoices" rows={4} /><InvoiceNumbering settings={s} onChange={set} /></>}
          {tab === 'docs' && <><SettingsText settings={s} onChange={set} k="quote_terms" label="Quotation terms & conditions (default)" rows={6} /><SettingsText settings={s} onChange={set} k="invoice_terms" label="Invoice terms (default)" rows={5} /><SettingsInput settings={s} onChange={set} k="invoice_footer" label="Document footer" span /><div className="md:col-span-2 document-seal-settings"><h2>Company seal</h2><p className="text-sm text-muted">Upload the original Elvora seal image. Every generated document includes the system-generated notice; the seal is optional.</p><label className="label" htmlFor="company-seal">Seal image (PNG or JPEG, up to 1 MB)</label><input id="company-seal" type="file" accept="image/png,image/jpeg" onChange={e => { void loadSeal(e.target.files?.[0]); e.target.value = '' }} />{s.document_seal && <div className="flex items-center gap-4 mt-3"><img src={s.document_seal} alt="Company seal preview" style={{ width: 180, maxHeight: 150, objectFit: 'contain', background: '#fff' }} /><button className="btn outline" onClick={() => { set('document_seal', ''); set('document_seal_default', false) }}>Remove seal</button></div>}<label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={!!s.document_seal_default} disabled={!s.document_seal} onChange={e => set('document_seal_default', e.target.checked)} />Include the company seal by default</label><p className="help">You can change this choice for each print, PDF download or email. Save settings to apply your changes.</p></div><p className="md:col-span-2 text-xs text-muted m-0">Have your legal adviser review these texts, including your standard trading conditions and any liability limitation, before relying on them.</p></>}
          {tab === 'mail' && <><SettingsInput settings={s} onChange={set} k="smtp_host" label="SMTP host" help="e.g. smtp.office365.com" /><SettingsInput settings={s} onChange={set} k="smtp_port" label="Port" type="number" /><SettingsInput settings={s} onChange={set} k="smtp_user" label="Username" /><div><label className="label">Password</label><input className="input" type="password" autoComplete="new-password" value={s.smtp_pass ?? ''} onChange={e => set('smtp_pass', e.target.value)} placeholder="unchanged" /></div><SettingsInput settings={s} onChange={set} k="smtp_from" label="From address" help='e.g. "Elvora Shipping" <noreply@elvorashipping.com>' span /><label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.smtp_secure} onChange={e => set('smtp_secure', e.target.checked)} /> Use TLS on connect (port 465)</label>
            <div className="md:col-span-2 flex gap-2 flex-wrap"><button className="btn outline" onClick={async () => { if (!await save()) return; try { const r = await post<any>('/api/admin/smtp-test'); r.ok ? toast.ok('SMTP connection verified') : toast.error(r.error) } catch (e: any) { toast.error(e.message) } }}><Mail /> Save &amp; test connection</button><button className="btn outline" onClick={async () => { await post('/api/admin/outbox/retry'); toast.ok('Queued messages will be retried') }}>Retry queued / failed e-mails</button></div>
            <p className="md:col-span-2 text-xs text-muted m-0">Until SMTP is configured, messages are stored in the outbox with status “Not configured” and are sent automatically after you save valid settings and retry.</p></>}
          {tab === 'uae' && <><SettingsInput settings={s} onChange={set} k="company_name_ar" label="Company name (Arabic)" help="Printed on documents; must match the trade licence." /><SettingsInput settings={s} onChange={set} k="licence_name_en" label="Name exactly as on the licence" help="Used to check that documents carry the licensed name." /><SettingsInput settings={s} onChange={set} k="company_legal_form" label="Legal form" /><SettingsInput settings={s} onChange={set} k="licence_authority" label="Licensing authority" /><SettingsInput settings={s} onChange={set} k="licence_issue_date" label="Licence issue date" type="date" /><SettingsInput settings={s} onChange={set} k="licence_expiry_date" label="Licence expiry date" type="date" /><SettingsInput settings={s} onChange={set} k="dcci_no" label="Chamber membership no." /><SettingsInput settings={s} onChange={set} k="commercial_register_no" label="Commercial register no." />
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.vat_registered} onChange={e => set('vat_registered', e.target.checked)} /> VAT-registered with the FTA (untick if not yet registered – VAT can then not be charged)</label>
            <div><label className="label">VAT filing frequency</label><select className="select" value={s.vat_filing_frequency} onChange={e => set('vat_filing_frequency', e.target.value)}><option>Quarterly</option><option>Monthly</option></select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={!!s.ct_registered} onChange={e => set('ct_registered', e.target.checked)} /> Registered for corporate tax</label>
            <SettingsInput settings={s} onChange={set} k="ct_trn" label="Corporate tax TRN" /><SettingsInput settings={s} onChange={set} k="financial_year_end" label="Financial year end (MM-DD)" help="e.g. 12-31" />
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.einv_revenue_over_50m} onChange={e => set('einv_revenue_over_50m', e.target.checked)} /> Annual revenue is AED 50 million or more (earlier e-invoicing deadlines)</label>
            <div><label className="label">Statutory rules</label><select className="select" value={s.compliance_mode} onChange={e => set('compliance_mode', e.target.value)}><option value="enforce">Enforce – block non-compliant postings</option><option value="advisory">Advisory – warn only</option></select></div>
            <div><label className="label">Licensed-activity check</label><select className="select" value={s.activity_scope_mode} onChange={e => set('activity_scope_mode', e.target.value)}><option value="warn">Warn and log an exception</option><option value="block">Block jobs outside the licence</option><option value="off">Off</option></select></div>
            <SettingsInput settings={s} onChange={set} k="sanctions_review_days" label="Re-screen parties every (days)" type="number" />
            <p className="md:col-span-2 text-xs text-muted m-0">See the Compliance Centre for readiness, deadlines and exceptions. These settings are a working aid, not legal or tax advice.</p></>}
          {tab === 'tools' && <><div><label className="label">Air volumetric divisor</label><select className="select" value={s.weight_divisor_air} onChange={e => set('weight_divisor_air', Number(e.target.value))}><option value={6000}>6000 (IATA)</option><option value={5000}>5000</option><option value={4000}>4000</option></select></div><SettingsInput settings={s} onChange={set} k="free_days_default" label="Default container free days" type="number" /><label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-emerald" checked={!!s.tracking_public_enabled} onChange={e => set('tracking_public_enabled', e.target.checked)} /> Allow public customer tracking links</label></>}
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
        <BusinessDataCard />
        <div className="card p-5 lg:col-span-2"><h3 className="m-0 mb-3 text-[16px]">Records</h3><div className="grid gap-x-6 gap-y-1 grid-cols-2 md:grid-cols-4 text-sm">{Object.entries<number>(s.counts).filter(([, n]) => n > 0).map(([k, n]) => <div key={k} className="flex justify-between border-b border-line py-1"><span className="text-muted">{k.replace(/_/g, ' ')}</span><b>{n.toLocaleString()}</b></div>)}</div></div>
        <div className="card p-5 lg:col-span-2"><h3 className="m-0 mb-3 text-[16px]">Sign-in events</h3>{!logins.data ? <Loading /> : <div className="table-wrap max-h-[320px]"><table className="grid"><thead><tr><th>When</th><th>E-mail</th><th>Result</th><th>IP</th></tr></thead><tbody>{logins.data.map(l => <tr key={l.id}><td>{fmtIsoStamp(l.at)}</td><td>{l.email}</td><td><Badge value={l.success ? 'Success' : `Failed – ${l.reason}`} tone={l.success ? 'green' : 'red'} /></td><td>{l.ip}</td></tr>)}</tbody></table></div>}</div>
      </div>
    </div>
  )
}
function Database(props: any) { return <DatabaseBackup {...props} /> }

function BusinessDataCard() {
  const toast = useToast(); const qc = useQueryClient(); const dlg = useDialogs()
  const q = useQuery({ queryKey: ['business-data'], queryFn: () => get<any>('/api/admin/business-data') })
  const [open, setOpen] = useState(false), [phrase, setPhrase] = useState(''), [starter, setStarter] = useState(true), [busy, setBusy] = useState(false)
  if (!q.data) return null
  const d = q.data
  const groups = [...new Set<string>(d.rows.map((r: any) => r.group))]
  const reset = async () => {
    setBusy(true)
    try { const r = await post<any>('/api/admin/business-data/reset', { confirm: phrase, load_starter: starter }); toast.ok(`Cleared ${r.total.toLocaleString()} records. Backup: ${r.backup}`); setOpen(false); setPhrase(''); void qc.invalidateQueries(); window.setTimeout(() => window.location.assign('/'), 800) }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return <div className="card p-5 lg:col-span-2"><h3 className="m-0 mb-1 text-[16px]">Business data</h3>
    <p className="text-sm text-muted mt-0 mb-3">Customers, leads, jobs, invoices, bills, receipts and everything attached to them. Settings, users, roles, the chart of accounts, ports, carriers, charge codes, employees, licences and document templates are never touched.</p>
    <div className="grid gap-x-6 gap-y-1 grid-cols-2 md:grid-cols-4 text-sm mb-3">{groups.map(g => <div key={g}><div className="font-semibold">{g}</div>{d.rows.filter((r: any) => r.group === g && r.count > 0).map((r: any) => <div key={r.table} className="flex justify-between border-b border-line py-0.5"><span className="text-muted">{r.label}</span><b>{r.count.toLocaleString()}</b></div>)}{!d.rows.some((r: any) => r.group === g && r.count > 0) && <div className="text-muted">None</div>}</div>)}</div>
    <div className="flex gap-2 flex-wrap items-center"><span className="text-sm">{d.total.toLocaleString()} records ({d.journals.toLocaleString()} ledger entries included)</span><div className="flex-1" />
      {!d.starter_loaded && <button className="btn outline" onClick={async () => { try { await post('/api/admin/business-data/load-starter'); toast.ok('Elvora starter data loaded'); void qc.invalidateQueries({ queryKey: ['business-data'] }); void qc.invalidateQueries({ queryKey: ['system'] }) } catch (e: any) { toast.error(e.message) } }}>Load Elvora starter data</button>}
      <button className="btn red" onClick={() => setOpen(true)}>Clear all business data…</button></div>
    <Modal open={open} onClose={() => !busy && setOpen(false)} title="Clear all business data?" width={560} persistent={busy} footer={<><button className="btn outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><div className="flex-1" /><button className="btn red" disabled={busy || phrase !== d.confirm_phrase} onClick={() => void reset()}>{busy ? 'Clearing…' : 'Clear everything'}</button></>}>
      <p className="mt-0">This permanently removes <b>{d.total.toLocaleString()} records</b> listed above, including their ledger entries and the files attached to them. A database backup is taken first and kept in the backups list.</p>
      <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" className="accent-emerald" checked={starter} onChange={e => setStarter(e.target.checked)} /> Then load the Elvora starter data (MAM Trading Group LLC, its two shipments and invoices ES101, ES101A, ES102, ES102A)</label>
      <label className="label" htmlFor="reset-phrase">Type <b>{d.confirm_phrase}</b> to confirm</label><input id="reset-phrase" className="input" value={phrase} onChange={e => setPhrase(e.target.value)} autoComplete="off" /></Modal>
  </div>
}
void useDialogs
void RefSelect
