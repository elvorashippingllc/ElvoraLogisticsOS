import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ArrowLeft, Mail, FileBarChart2, Pencil, Plus, FileCode2, Gauge, FileStack, MapPinned, Save, X, Copy, Trash2, Link2, Printer, ExternalLink, Check, Circle, CircleCheck, Upload } from 'lucide-react'
import { del, get, post, put } from '../lib/api'
import { useMeta } from '../lib/meta'
import { EntityList } from '../components/EntityList'
import { EntityFormModal } from '../components/EntityForm'
import { RecordView } from '../components/RecordView'
import { ChildEditor, type Row } from '../components/ChildEditor'
import { SidePanel, Attachments } from '../components/SidePanel'
import { Badge, Dropdown, ErrorBox, Loading, Modal, Tabs, useDialogs, Empty, Spinner } from '../ui/kit'
import { useToast } from '../lib/toast'
import { cls, fmtDate, fmtDateTime, fmtMoney, nowIsoLocal } from '../lib/format'
import { JOB_STATUS, BL_STATUS, OPERATIONAL_STATUS, EVENT_TYPES } from '@shared/entities'
import { statusTone } from '../lib/status'

const LOCKED_ON_EDIT = ['client_id', 'branch_id', 'department', 'job_date', 'job_no', 'job_status', 'bl_status']

export function JobPage() {
  const { id = '' } = useParams()
  const jid = Number(id)
  const { def, can } = useMeta()
  const nav = useNavigate(), qc = useQueryClient(), toast = useToast(), dlg = useDialogs()
  const q = useQuery({ queryKey: ['rec', 'jobs', jid], queryFn: () => get<any>(`/api/e/jobs/${jid}`) })
  const [sp] = useSearchParams()
  const [tab, setTab] = useState(sp.get('tab') ?? 'info')
  const [editing, setEditing] = useState(false)
  const [modal, setModal] = useState<null | 'mail' | 'kpi' | 'edi' | 'track'>(null)
  const jobDef = def('jobs')
  const reload = () => { void qc.invalidateQueries({ queryKey: ['rec', 'jobs', jid] }); void qc.invalidateQueries({ queryKey: ['list', 'jobs'] }); void qc.invalidateQueries({ queryKey: ['panel', 'jobs', jid] }) }
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <Loading />
  const j = q.data
  const L = j._labels ?? {}
  const canEdit = can('jobs', 'edit')
  const air = (j.mode ?? '') === 'Air'
  const margin = j.total_revenue > 0 ? Math.round((j.profit / j.total_revenue) * 1000) / 10 : null

  const setField = async (field: string, value: string) => {
    try { await put(`/api/e/jobs/${jid}`, { [field]: value, version: j.version }); toast.ok('Updated'); reload() } catch (e: any) { toast.error(e.message) }
  }
  const createMenu = [
    { label: 'Vendor service / hired equipment', onClick: () => nav(`/e/vendor_services?new=1&job_id=${jid}`) },
    { label: 'Sub-Job / Shipment', onClick: () => nav(`/e/shipments?new=1&job_id=${jid}`) },
    { label: 'Container (add on Containers tab)', onClick: () => setTab('containers') },
    { label: 'Carrier booking', onClick: () => nav(`/e/bookings?new=1&job_id=${jid}&carrier_id=${j.carrier_id ?? ''}`) },
    { label: 'Delivery order', onClick: async () => { try { await post(`/api/jobs/${jid}/generate-do`); toast.ok('DO created'); reload() } catch (e: any) { toast.error(e.message) } } },
    { label: 'Customs declaration (SB / BOE)', onClick: () => nav(`/e/customs_declarations?new=1&job_id=${jid}`) },
    { label: 'Transport order', onClick: () => nav(`/e/transport_orders?new=1&job_id=${jid}&customer_id=${j.client_id}`) },
    { divider: true, label: '' },
    { label: 'Tax invoice from unbilled charges', onClick: async () => { if (!(await dlg.confirm({ title: 'Create tax invoice(s)?', message: 'One draft invoice is created per bill-to party and currency from all unbilled revenue charges. You can review before posting.', ok: 'Create drafts' }))) return; try { const r = await post<any[]>(`/api/jobs/${jid}/generate-invoices`, {}); toast.ok(`${r.length} draft invoice(s) created`); reload(); nav(`/e/invoices/${r[0].id}`) } catch (e: any) { toast.error(e.message) } } },
    { label: 'Tax invoice in AED (foreign charges at their ROE)', onClick: async () => { if (!(await dlg.confirm({ title: 'Create AED invoice?', message: 'One draft invoice per bill-to party in AED. Charges priced in USD or other currencies keep their currency and rate of exchange on the invoice line.', ok: 'Create drafts' }))) return; try { const r = await post<any[]>(`/api/jobs/${jid}/generate-invoices`, { bill_in_base: true }); toast.ok(`${r.length} draft invoice(s) created`); reload(); nav(`/e/invoices/${r[0].id}`) } catch (e: any) { toast.error(e.message) } } },
    { label: 'Proforma invoice', onClick: async () => { try { const r = await post<any[]>(`/api/jobs/${jid}/generate-invoices`, { doc_type: 'Proforma Invoice' }); toast.ok('Proforma created'); nav(`/e/invoices/${r[0].id}`) } catch (e: any) { toast.error(e.message) } } },
    { label: 'Vendor bill (from cost charges)', onClick: () => setTab('accounting') },
    { divider: true, label: '' },
    { label: 'Cargo insurance certificate', onClick: () => nav(`/e/insurance_certs?new=1&job_id=${jid}&customer_id=${j.client_id}`) },
    { label: 'Cargo claim', onClick: () => nav(`/e/claims?new=1&job_id=${jid}&customer_id=${j.client_id}`) },
    { label: 'Duplicate this job', onClick: async () => { if (!(await dlg.confirm({ title: 'Duplicate job?', message: 'Copies parties, route, cargo, legs and charges into a new OPENED job (dates, B/L and carrier references are not copied).', ok: 'Duplicate' }))) return; try { const n = await post<any>(`/api/jobs/${jid}/duplicate`); toast.ok(`Job ${n.job_no} created`); nav(`/jobs/${n.id}`) } catch (e: any) { toast.error(e.message) } } },
  ]
  const tabs = [
    { key: 'vendor-services', label: 'Vendor services' },
    { key: 'info', label: 'Job Info' }, { key: 'routing', label: 'Routing', count: j.children.legs.length }, { key: 'containers', label: 'Containers', count: j.children.containers.length }, { key: 'cargo', label: 'Cargo', count: j.children.cargo.length },
    { key: 'track', label: 'Track & Trace', count: j.children.events.length }, { key: 'accounting', label: 'Accounting', count: j.children.charges.length }, { key: 'sbboe', label: 'SB No/BOE No' }, { key: 'customs', label: 'Customs' },
    { key: 'shipments', label: 'Shipments' }, { key: 'inventory', label: 'Inventory' }, { key: 'transport', label: 'Transport' }, { key: 'docs', label: 'Documents' },
  ]
  const Btn = ({ className, onClick, children, to, disabled }: any) => to ? <Link className={cls('btn', className)} to={to}>{children}</Link> : <button className={cls('btn', className)} onClick={onClick} disabled={disabled}>{children}</button>

  return (
    <div className="fade-in">
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <Btn className="grey" to="/e/jobs"><ArrowLeft /> Back</Btn>
        <Btn className="violet" onClick={() => setModal('mail')}><Mail /> Bulk Mail / Print</Btn>
        <Btn className="grey" to={`/jobs/${jid}/closure`}><Check />Closure review</Btn>
        <Btn className="red" to={`/print/jobs/${jid}`}><FileBarChart2 /> Report</Btn>
        {canEdit && <Btn className="green" onClick={() => setEditing(true)}><Pencil /> Edit</Btn>}
        {can('jobs', 'create') && <Dropdown label="Create" icon={<Plus size={16} />} className="btn violet" items={createMenu} align="left" />}
        <div className="flex-1" />
        <div className="text-right"><div className="font-display font-extrabold text-[22px] text-ink leading-none">{j.job_no}</div><div className="text-xs text-muted mt-1">{L.client_id}</div></div>
      </div>

      <div className="flex gap-4 items-start flex-col lg:flex-row">
        <div className="flex-1 min-w-0 w-full">
          <div className="card p-4 md:p-5 mb-4">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] items-start">
              <div className="text-sm space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap"><Badge value={j.department} tone="teal" /><Badge value={j.mode} tone="grey" />{j.is_hazardous === 'Yes' && <Badge value="DANGEROUS GOODS" tone="red" />}</div>
                <div className="font-display font-extrabold text-[20px] text-ink leading-tight">{L.client_id}</div>
                <div className="text-muted">Branch {L.branch_id} · Job date {fmtDate(j.job_date)}</div>
                <div className="job-route flex items-center gap-2 font-semibold text-ink pt-1 text-[15px]"><span>{L.pol_id?.split('-')[0] ?? '—'}</span><span className="text-muted">→</span><span>{L.pod_id?.split('-')[0] ?? '—'}</span><span className="text-xs text-muted font-normal ml-1">{j.carrier_id ? L.carrier_id : ''}{j.vessel_name ? ` · ${j.vessel_name} ${j.voyage_no ?? ''}` : ''}</span></div>
                <div className="text-xs text-muted">ETD {fmtDateTime(j.etd) || '—'} · ETA {fmtDateTime(j.eta) || '—'}{j.atd ? ` · ATD ${fmtDateTime(j.atd)}` : ''}{j.ata ? ` · ATA ${fmtDateTime(j.ata)}` : ''}</div>
              </div>
              <dl className="kv m-0 content-start">
                <dt>Department</dt><dd>{j.department}</dd>
                <dt>Job Status</dt><dd>{canEdit ? <StatusSelect value={j.job_status} options={JOB_STATUS} onChange={v => void setField('job_status', v)} /> : <Badge value={j.job_status} />}</dd>
                <dt>B/L Status</dt><dd>{canEdit ? <StatusSelect value={j.bl_status} options={BL_STATUS} onChange={v => void setField('bl_status', v)} /> : <Badge value={j.bl_status} />}</dd>
                <dt>INCO Terms</dt><dd>{j.inco_terms ?? '—'}</dd>
                <dt>Operational Status</dt><dd>{canEdit ? <StatusSelect value={j.operational_status} options={OPERATIONAL_STATUS} onChange={v => void setField('operational_status', v)} allowEmpty /> : <Badge value={j.operational_status} />}</dd>
              </dl>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Revenue', j.total_revenue, ''], ['Cost', j.total_cost, ''], ['Profit', j.profit, j.profit < 0 ? 'text-signal' : 'text-fold']].map(([l, v, c]) => <div key={l as string} className="rounded-xl bg-soft border border-line px-2 py-3"><div className="text-[11px] font-semibold text-muted">{l} (AED)</div><div className={cls('font-display font-extrabold text-[17px]', c as string)}>{fmtMoney(v as number, 0)}</div></div>)}
                <div className="col-span-3 text-xs text-muted text-start">{margin !== null ? <>Margin <b className="text-ink">{margin}%</b> · </> : null}{j.containers_summary ? <>Equipment <b className="text-ink">{j.containers_summary}</b> · </> : null}{j.packages ? <>{j.packages} pkgs · </> : null}{j.gross_weight ? <>{j.gross_weight} kg · </> : null}{j.volume_cbm ? <>{j.volume_cbm} CBM</> : null}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-line">
              <Btn className="green" onClick={() => setModal('edi')}><FileCode2 /> Generate EDI</Btn>
              <Btn className="violet" onClick={() => setModal('kpi')}><Gauge /> KPI</Btn>
              <Btn className="blue" onClick={async () => { if (!can('finance', 'create')) { toast.error('You cannot create invoices'); return } try { const r = await post<any>('/api/jobs/bulk-proforma', { job_ids: [jid] }); if (r.created.length) { toast.ok(`${r.created.length} proforma invoice(s) generated`); nav(`/e/invoices/${r.created[0].id}`) } else toast.error(r.skipped[0]?.reason ?? 'Nothing to invoice') } catch (e: any) { toast.error(e.message) } }}><FileStack /> Generate Bulk PI</Btn>
              <Btn className="orange" onClick={() => { setTab('track'); setModal(null); window.scrollTo({ top: 0 }) }}><MapPinned /> Track-Trace</Btn>
            </div>
          </div>

          <div className="card overflow-hidden">
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
            <div className="p-4 md:p-5">
              {tab === 'info' && <RecordView def={jobDef} rec={j} />}
              {tab === 'vendor-services' && <><p className="text-sm text-muted mb-4">Record containers, trucks, trailers and other services bought from suppliers for this customer. Confirm each agreement to include its cost and selling price in job profit. Complete the service and record equipment returns before closing the job.</p><EntityList entity="vendor_services" embedded preset={[{ field: 'job_id', op: 'eq', value: jid }]} createPresets={{ job_id: jid }} /></>}
              {tab === 'routing' && <ChildTab job={j} childKey="legs" reload={reload} />}
              {tab === 'containers' && <ChildTab job={j} childKey="containers" reload={reload} />}
              {tab === 'cargo' && <ChildTab job={j} childKey="cargo" reload={reload} />}
              {tab === 'track' && <TrackTab job={j} reload={reload} />}
              {tab === 'accounting' && <AccountingTab job={j} reload={reload} />}
              {tab === 'sbboe' && <SbBoeTab job={j} reload={reload} />}
              {tab === 'customs' && <CustomsTab job={j} reload={reload} />}
              {tab === 'shipments' && <EntityList entity="shipments" embedded preset={[{ field: 'job_id', op: 'eq', value: jid }]} createPresets={{ job_id: jid }} />}
              {tab === 'inventory' && <InventoryTab job={j} />}
              {tab === 'transport' && <EntityList entity="transport_orders" embedded preset={[{ field: 'job_id', op: 'eq', value: jid }]} createPresets={{ job_id: jid, customer_id: j.client_id }} />}
              {tab === 'docs' && <div className="max-w-xl"><Attachments entity="jobs" id={jid} refresh={reload} /></div>}
            </div>
          </div>
        </div>
        <div className="w-full lg:w-auto flex-none"><SidePanel entity="jobs" id={jid} onChanged={reload} /></div>
      </div>

      {editing && <EntityFormModal entity="jobs" id={jid} title="Job Info" childKeys={[]} lockedOnEdit={LOCKED_ON_EDIT} width={1180} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      {modal === 'mail' && <MailPrintDialog jobIds={[jid]} jobNo={j.job_no} air={air} onClose={() => setModal(null)} />}
      {modal === 'kpi' && <KpiDialog jid={jid} onClose={() => setModal(null)} />}
      {modal === 'edi' && <EdiDialog jid={jid} air={air} onClose={() => setModal(null)} />}
    </div>
  )
}

function StatusSelect({ value, options, onChange, allowEmpty }: { value: string | null; options: string[]; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const tone = statusTone(value ?? '')
  return <select className={cls('select !min-h-[28px] !py-0.5 !text-[12.5px] !font-bold !rounded-full !w-auto', `tone-${tone}`)} style={{ paddingRight: 24 }} value={value ?? ''} onChange={e => e.target.value && onChange(e.target.value)} aria-label="Change status">{allowEmpty && !value && <option value="">— not set —</option>}{options.map(o => <option key={o}>{o}</option>)}</select>
}

function ChildTab({ job, childKey, reload }: { job: any; childKey: string; reload: () => void }) {
  const { def, can } = useMeta(); const toast = useToast()
  const child = def('jobs').children!.find(c => c.key === childKey)!
  const [editing, setEditing] = useState(false); const [rows, setRows] = useState<Row[]>(job.children[childKey]); const [busy, setBusy] = useState(false)
  useEffect(() => { if (!editing) setRows(job.children[childKey]) }, [job, childKey, editing])
  const save = async () => {
    setBusy(true)
    try { await put(`/api/e/jobs/${job.id}`, { version: job.version, children: { [childKey]: rows.map(({ _labels, ...r }) => r) } }); toast.ok(`${child.label} saved`); setEditing(false); reload() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><h3 className="m-0 text-[15px] flex-1">{child.label}</h3>
        {can('jobs', 'edit') && (editing ? <><button className="btn green sm" onClick={() => void save()} disabled={busy}><Save /> {busy ? 'Saving…' : 'Save'}</button><button className="btn red sm" onClick={() => { setEditing(false); setRows(job.children[childKey]) }}><X /> Cancel</button></> : <button className="btn green sm" onClick={() => setEditing(true)}><Pencil /> Edit {child.label.toLowerCase()}</button>)}</div>
      <ChildEditor child={child} rows={rows} onChange={setRows} readOnly={!editing} parent={{ ...job, __currency: 'AED' }} />
    </div>
  )
}

function AccountingTab({ job, reload }: { job: any; reload: () => void }) {
  const { def, can } = useMeta(); const toast = useToast(); const nav = useNavigate(); const dlg = useDialogs()
  const child = def('jobs').children!.find(c => c.key === 'charges')!
  const [editing, setEditing] = useState(false); const [rows, setRows] = useState<Row[]>(job.children.charges); const [busy, setBusy] = useState(false)
  const [vendorBill, setVendorBill] = useState(false)
  useEffect(() => { if (!editing) setRows(job.children.charges) }, [job, editing])
  const unbilledRev = job.children.charges.filter((c: any) => c.kind === 'Revenue' && c.status === 'Unbilled' && c.amount !== 0).length
  const unbilledCost = job.children.charges.filter((c: any) => c.kind === 'Cost' && c.status === 'Unbilled')
  const save = async () => { setBusy(true); try { await put(`/api/e/jobs/${job.id}`, { version: job.version, children: { charges: rows.map(({ _labels, ...r }) => r) } }); toast.ok('Charges saved'); setEditing(false); reload() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap"><h3 className="m-0 text-[15px] flex-1">Job charges &amp; profitability</h3>
        {!editing && can('finance', 'create') && <>
          <button className="btn violet sm" disabled={!unbilledRev} onClick={async () => { if (!(await dlg.confirm({ title: 'Create tax invoice(s)?', message: `${unbilledRev} unbilled revenue charge(s) will be invoiced as drafts per bill-to party and currency.`, ok: 'Create drafts' }))) return; try { const r = await post<any[]>(`/api/jobs/${job.id}/generate-invoices`, {}); toast.ok(`${r.length} draft invoice(s) created`); reload(); nav(`/e/invoices/${r[0].id}`) } catch (e: any) { toast.error(e.message) } }}>Create tax invoice{unbilledRev ? ` (${unbilledRev})` : ''}</button>
          <button className="btn outline sm" disabled={!unbilledRev} onClick={async () => { try { const r = await post<any[]>(`/api/jobs/${job.id}/generate-invoices`, { doc_type: 'Proforma Invoice' }); toast.ok('Proforma created'); nav(`/e/invoices/${r[0].id}`) } catch (e: any) { toast.error(e.message) } }}>Proforma</button>
          <button className="btn outline sm" disabled={!unbilledCost.length} onClick={() => setVendorBill(true)}>Vendor bill{unbilledCost.length ? ` (${unbilledCost.length})` : ''}</button></>}
        {can('jobs', 'edit') && (editing ? <><button className="btn green sm" onClick={() => void save()} disabled={busy}><Save /> {busy ? 'Saving…' : 'Save charges'}</button><button className="btn red sm" onClick={() => { setEditing(false); setRows(job.children.charges) }}><X /> Cancel</button></> : <button className="btn green sm" onClick={() => setEditing(true)}><Pencil /> Edit charges</button>)}</div>
      <ChildEditor child={child} rows={rows} onChange={setRows} readOnly={!editing} parent={{ ...job, __currency: 'AED' }} />
      <p className="text-xs text-muted mt-2">Revenue and cost are valued in AED at each line's exchange rate. Invoiced / billed charges are locked until the document is voided.</p>
      <div className="grid gap-5 mt-6">
        <div><h3 className="text-[14px] mb-2">Customer invoices &amp; notes</h3><EntityList entity="invoices" embedded preset={[{ field: 'job_id', op: 'eq', value: job.id }]} /></div>
        <div><h3 className="text-[14px] mb-2">Vendor bills</h3><EntityList entity="bills" embedded preset={[{ field: 'job_id', op: 'eq', value: job.id }]} createPresets={{ job_id: job.id }} /></div>
      </div>
      {vendorBill && <VendorBillDialog job={job} costs={unbilledCost} onClose={() => setVendorBill(false)} onDone={id => { setVendorBill(false); reload(); nav(`/e/bills/${id}`) }} />}
    </div>
  )
}

function VendorBillDialog({ job, costs, onClose, onDone }: { job: any; costs: any[]; onClose: () => void; onDone: (id: number) => void }) {
  const toast = useToast()
  const vendors = [...new Map(costs.filter(c => c.party_id).map(c => [c.party_id, c._labels?.party_id ?? `#${c.party_id}`])).entries()]
  const [vendor, setVendor] = useState<number | null>(vendors[0]?.[0] ?? null); const [no, setNo] = useState('')
  const noVendor = costs.filter(c => !c.party_id).length
  return (
    <Modal open onClose={onClose} title="Create vendor bill from job costs" width={520} footer={<><div className="flex-1" /><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn green" disabled={!vendor || !no.trim()} onClick={async () => { try { const b = await post<any>(`/api/jobs/${job.id}/bill-from-costs`, { vendor_id: vendor, vendor_invoice_no: no.trim() }); toast.ok('Draft bill created'); onDone(b.id) } catch (e: any) { toast.error(e.message) } }}>Create draft bill</button></>}>
      {vendors.length === 0 ? <p className="text-sm">Assign a vendor to the cost charges first (Edit charges → “Bill to / vendor”).</p> : <>
        <label className="label">Vendor</label><select className="select mb-3" value={vendor ?? ''} onChange={e => setVendor(Number(e.target.value))}>{vendors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <label className="label">Vendor invoice number<span className="req">*</span></label><input className="input" value={no} onChange={e => setNo(e.target.value)} autoFocus />
        {noVendor > 0 && <p className="text-xs text-muted mt-3">{noVendor} cost charge(s) have no vendor and are not included.</p>}</>}
    </Modal>
  )
}

function TrackTab({ job, reload }: { job: any; reload: () => void }) {
  const toast = useToast(); const qc = useQueryClient(); const { can } = useMeta()
  const links = useQuery({ queryKey: ['tracklinks', job.id], queryFn: () => get<any>(`/api/jobs/${job.id}/tracking-links`) })
  const tok = useQuery({ queryKey: ['tracktoken', job.id], queryFn: () => get<{ token: string | null }>(`/api/jobs/${job.id}/tracking-token`) })
  const [f, setF] = useState({ event_type: EVENT_TYPES[0], event_at: nowIsoLocal(), location: '', container_no: '', description: '', visible_to_customer: true })
  const [qr, setQr] = useState('')
  const url = tok.data?.token ? `${location.origin}/t/${tok.data.token}` : ''
  useEffect(() => { if (url) void QRCode.toDataURL(url, { margin: 1, width: 160, color: { dark: '#161d1a' } }).then(setQr); else setQr('') }, [url])
  const events = [...job.children.events].sort((a: any, b: any) => String(b.event_at).localeCompare(String(a.event_at)))
  const add = async () => { try { await post(`/api/jobs/${job.id}/events`, { ...f, location: f.location || null, container_no: f.container_no || null, description: f.description || null }); toast.ok('Milestone recorded'); setF(x => ({ ...x, description: '', location: '', event_at: nowIsoLocal() })); reload() } catch (e: any) { toast.error(e.message) } }
  const from = job.etd ? Date.parse(job.atd ?? job.etd) : null, to = job.eta ? Date.parse(job.ata ?? job.eta) : null
  const pct = from && to && to > from ? Math.max(0, Math.min(100, ((Date.now() - from) / (to - from)) * 100)) : null
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        {pct !== null && <div className="mb-5"><div className="flex justify-between text-xs text-muted mb-1"><span>{job._labels.pol_id?.split('-')[0]} · {fmtDateTime(job.atd ?? job.etd)}</span><span>{job._labels.pod_id?.split('-')[0]} · {fmtDateTime(job.ata ?? job.eta)}</span></div><div className="h-2 rounded-full bg-soft border border-line overflow-hidden"><div className="h-full bg-emerald" style={{ width: pct + '%' }} /></div><div className="text-xs text-muted mt-1">{job.ata ? 'Arrived' : job.atd ? `${Math.round(pct)}% of planned transit elapsed` : 'Not yet departed'}</div></div>}
        <h3 className="text-[15px] mt-0">Timeline</h3>
        {events.length === 0 ? <Empty title="No milestones yet" hint="Record cargo receipt, gate-in, departure, arrival and delivery as they happen." /> : (
          <ol className="list-none m-0 p-0 border-l-2 border-line ml-2.5">{events.map((e: any) => (
            <li key={e.id} className="relative pl-6 pb-5"><span className={cls('absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 border-card', e.source === 'System' ? 'bg-[#9fb3a7]' : 'bg-emerald')} />
              <div className="flex items-start gap-2"><div className="flex-1"><div className="font-bold text-ink">{e.event_type}{!e.visible_to_customer && <span className="ml-2 text-[11px] font-semibold text-muted">(internal)</span>}</div><div className="text-xs text-muted">{fmtDateTime(e.event_at)}{e.location && ` · ${e.location}`}{e.container_no && ` · ${e.container_no}`} · {e.source}</div>{e.description && <div className="text-[13.5px] mt-0.5">{e.description}</div>}</div>
                {can('jobs', 'edit') && e.source !== 'System' && <button className="btn ghost icon sm" aria-label="Delete milestone" onClick={async () => { await del(`/api/jobs/${job.id}/events/${e.id}`); reload() }}><Trash2 className="text-signal" /></button>}</div></li>))}</ol>)}
      </div>
      <div className="grid gap-4 content-start">
        {can('jobs', 'edit') && <div className="rounded-xl border border-line p-4 bg-soft"><div className="flex items-center gap-2 mb-3"><h3 className="m-0 text-[14px] flex-1">Add milestone</h3><button className="btn outline sm" title="Ask the carrier-tracking provider to push events for this job's MBL / container" onClick={async () => { try { const r = await post<any>(`/api/jobs/${job.id}/live-tracking`); toast.ok(r.message) } catch (e: any) { toast.error(e.message) } }}><MapPinned /> Start live tracking</button></div><div className="grid gap-2">
          <select className="select" value={f.event_type} onChange={e => setF({ ...f, event_type: e.target.value })}>{EVENT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <input className="input" type="datetime-local" value={f.event_at} onChange={e => setF({ ...f, event_at: e.target.value })} />
          <input className="input" placeholder="Location (e.g. Jebel Ali)" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} />
          <select className="select" value={f.container_no} onChange={e => setF({ ...f, container_no: e.target.value })}><option value="">Container / AWB (optional)</option>{job.children.containers.filter((c: any) => c.container_no).map((c: any) => <option key={c.id}>{c.container_no}</option>)}{job.mbl_no && <option>{job.mbl_no}</option>}</select>
          <textarea className="textarea" rows={2} placeholder="Details" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={f.visible_to_customer} onChange={e => setF({ ...f, visible_to_customer: e.target.checked })} /> Show on the customer tracking page</label>
          <button className="btn green" onClick={() => void add()}><Plus /> Record milestone</button></div></div>}
        <div className="rounded-xl border border-line p-4"><h3 className="m-0 mb-2 text-[14px]">Carrier tracking</h3>
          {!links.data ? <Spinner /> : links.data.links.length === 0 ? <p className="text-sm text-muted m-0">Add container, booking or MBL numbers to get tracking links.</p> : <ul className="list-none m-0 p-0 text-sm">{links.data.links.map((l: any) => <li key={l.value} className="flex items-center gap-2 py-1"><span className="text-muted w-20">{l.label}</span><b className="flex-1 text-ink">{l.value}</b><button className="btn ghost icon sm" aria-label="Copy" onClick={() => { void navigator.clipboard.writeText(l.value); toast.ok('Copied') }}><Copy /></button>{l.url && <a className="btn outline sm" href={l.url} target="_blank" rel="noreferrer"><ExternalLink /> Track</a>}</li>)}</ul>}
          {links.data?.website && <a className="link text-sm inline-flex items-center gap-1 mt-2" href={links.data.website} target="_blank" rel="noreferrer">{links.data.carrier} website <ExternalLink size={12} /></a>}
          <p className="text-xs text-muted mt-2 mb-0">Live carrier feeds are not connected — links open the carrier's own tracking page.</p></div>
        <div className="rounded-xl border border-line p-4"><h3 className="m-0 mb-2 text-[14px]">Customer tracking page</h3>
          {url ? <div className="flex gap-3 items-start"><div className="flex-1 min-w-0"><div className="text-xs break-all bg-soft border border-line rounded-lg p-2">{url}</div><div className="flex gap-2 mt-2"><button className="btn outline sm" onClick={() => { void navigator.clipboard.writeText(url); toast.ok('Link copied') }}><Copy /> Copy</button><a className="btn outline sm" href={url} target="_blank" rel="noreferrer"><ExternalLink /> Open</a></div></div>{qr && <img src={qr} alt="QR code of the tracking link" width="96" height="96" className="rounded border border-line" />}</div>
            : <><p className="text-sm text-muted mt-0">Create an unguessable public link the customer can open without signing in. It shows only milestones marked “customer visible” — never financials.</p>{can('jobs', 'edit') && <button className="btn green sm" onClick={async () => { await post(`/api/jobs/${job.id}/tracking-token`); void qc.invalidateQueries({ queryKey: ['tracktoken', job.id] }) }}><Link2 /> Create public link</button>}</>}</div>
      </div>
    </div>
  )
}

function SbBoeTab({ job, reload }: { job: any; reload: () => void }) {
  const toast = useToast(); const { can } = useMeta()
  const [sb, setSb] = useState(job.sb_no ?? ''); const [boe, setBoe] = useState(job.boe_no ?? '')
  const dirty = sb !== (job.sb_no ?? '') || boe !== (job.boe_no ?? '')
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mb-5">
        <div><label className="label">SB No. (Shipping Bill – export)</label><input className="input" value={sb} onChange={e => setSb(e.target.value)} disabled={!can('jobs', 'edit')} /></div>
        <div><label className="label">BOE No. (Bill of Entry – import)</label><input className="input" value={boe} onChange={e => setBoe(e.target.value)} disabled={!can('jobs', 'edit')} /></div>
        {dirty && <div className="md:col-span-2"><button className="btn green sm" onClick={async () => { try { await put(`/api/e/jobs/${job.id}`, { sb_no: sb || null, boe_no: boe || null, version: job.version }); toast.ok('Saved'); reload() } catch (e: any) { toast.error(e.message) } }}><Save /> Save numbers</button></div>}
      </div>
      <h3 className="text-[14px] mb-2">Declarations for this job</h3>
      <EntityList entity="customs_declarations" embedded preset={[{ field: 'job_id', op: 'eq', value: job.id }]} createPresets={{ job_id: job.id, declaration_type: job.trade === 'Import' ? 'Import – Bill of Entry (BOE)' : 'Export – Shipping Bill (SB)' }} />
    </div>
  )
}

const CUSTOMS_STEPS = ['Not started', 'Documents received', 'Declaration filed', 'Under assessment', 'Cleared']
const CHECKLIST: [string, string][] = [['Commercial Invoice', 'Commercial Invoice'], ['Packing List', 'Packing List'], ['Bill of Lading', 'Bill of Lading'], ['Air Waybill', 'Air Waybill'], ['Certificate of Origin', 'Certificate of Origin'], ['Customs', 'Declaration / permit copy'], ['Insurance', 'Insurance certificate']]
function CustomsTab({ job, reload }: { job: any; reload: () => void }) {
  const toast = useToast(); const { can } = useMeta(); const qc = useQueryClient()
  const att = useQuery({ queryKey: ['attach', 'jobs', job.id], queryFn: () => get<{ rows: any[] }>('/api/e/attachments', { filters: JSON.stringify([{ field: 'link_entity', op: 'eq', value: 'jobs' }, { field: 'link_id', op: 'eq', value: job.id }]), pageSize: 200 }) })
  const have = new Set((att.data?.rows ?? []).map(a => a.category))
  const cur = job.customs_status ?? 'Not started'; const idx = Math.max(0, CUSTOMS_STEPS.indexOf(cur))
  const set = async (v: string) => { try { await put(`/api/e/jobs/${job.id}`, { customs_status: v, version: job.version }); reload() } catch (e: any) { toast.error(e.message) } }
  return (
    <div className="grid gap-6">
      <div><h3 className="text-[14px] mt-0 mb-3">Clearance progress</h3>
        <div className="flex items-center gap-1 flex-wrap">{CUSTOMS_STEPS.map((s, i) => <button key={s} disabled={!can('jobs', 'edit')} onClick={() => void set(s)} className={cls('flex items-center gap-2 px-3 py-2 rounded-full text-[13px] font-bold border cursor-pointer', i < idx ? 'bg-mint text-fold border-[#b7e0cb]' : i === idx ? 'bg-emerald text-white border-emerald' : 'bg-card text-muted border-line')}>{i < idx ? <CircleCheck size={15} /> : <Circle size={15} />}{s}</button>)}{cur === 'Query' && <Badge value="Customs query raised" tone="red" />}</div>
        <div className="text-sm text-muted mt-2">SB {job.sb_no || '—'} · BOE {job.boe_no || '—'}. Status updates automatically from declarations; internal records only — declarations are filed with Dubai Customs outside this system.</div></div>
      <div><h3 className="text-[14px] mt-0 mb-2">Document checklist</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{CHECKLIST.map(([cat, label]) => <div key={cat} className={cls('flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm', have.has(cat) ? 'bg-mint border-[#b7e0cb] text-fold font-semibold' : 'bg-card border-line text-body')}>{have.has(cat) ? <CircleCheck size={16} /> : <Circle size={16} className="text-muted" />}{label}</div>)}</div>
        <div className="mt-3 max-w-xl"><Attachments entity="jobs" id={job.id} refresh={() => { void qc.invalidateQueries({ queryKey: ['attach', 'jobs', job.id] }); reload() }} /></div></div>
      <div><h3 className="text-[14px] mt-0 mb-2">Customs declarations</h3><EntityList entity="customs_declarations" embedded preset={[{ field: 'job_id', op: 'eq', value: job.id }]} createPresets={{ job_id: job.id }} /></div>
    </div>
  )
}

function InventoryTab({ job }: { job: any }) {
  const [sub, setSub] = useState('grns')
  return (
    <div>
      <Tabs variant="sub" tabs={[{ key: 'grns', label: 'Goods receipts' }, { key: 'dispatches', label: 'Dispatches' }, { key: 'stock_moves', label: 'Stock movements' }]} value={sub} onChange={setSub} />
      <div className="pt-4">{sub === 'stock_moves' ? <EntityList entity="stock_moves" embedded preset={[{ field: 'job_id', op: 'eq', value: job.id }]} /> : <EntityList entity={sub} key={sub} embedded preset={[{ field: 'job_id', op: 'eq', value: job.id }]} createPresets={{ job_id: job.id, customer_id: job.client_id }} />}</div>
    </div>
  )
}

function KpiDialog({ jid, onClose }: { jid: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['jobkpi', jid], queryFn: () => get<any>(`/api/jobs/${jid}/kpi`) })
  return (
    <Modal open onClose={onClose} title={`Job KPI – ${q.data?.job_no ?? ''}`} width={720}>
      {!q.data ? <Loading /> : <div className="grid gap-3 sm:grid-cols-2">{q.data.items.map((i: any) => (
        <div key={i.key} className={cls('rounded-xl border p-3.5', i.status === 'good' ? 'border-[#b7e0cb] bg-[#f1faf5]' : i.status === 'bad' ? 'border-[#f2bcc3] bg-[#fff5f6]' : 'border-line bg-card')}>
          <div className="text-xs font-semibold text-muted">{i.label}</div><div className="flex items-baseline gap-1.5"><span className="font-display font-extrabold text-[24px] text-ink">{i.value ?? '—'}</span><span className="text-sm text-muted">{i.value !== null ? i.unit : ''}</span><span className="ml-auto">{i.status === 'good' ? <Check size={16} className="text-emerald" /> : i.status === 'bad' ? <X size={16} className="text-signal" /> : null}</span></div></div>))}</div>}
    </Modal>
  )
}

function EdiDialog({ jid, air, onClose }: { jid: number; air: boolean; onClose: () => void }) {
  const [fmt, setFmt] = useState(air ? 'fwb' : 'iftmin')
  const q = useQuery({ queryKey: ['edi', jid, fmt], queryFn: () => get<any>(`/api/jobs/${jid}/edi-preview`, { format: fmt }), retry: false })
  const toast = useToast(); const [via, setVia] = useState(''); const [sending, setSending] = useState(false)
  const transmit = async () => { setSending(true); try { const r = await post<any>(`/api/jobs/${jid}/edi/transmit`, { format: fmt, via: via || undefined }); toast.ok(r.message) } catch (e: any) { toast.error(e.message) } finally { setSending(false) } }
  return (
    <Modal open onClose={onClose} title="Generate EDI / data file" width={760} footer={<><select className="select !w-auto" value={via} onChange={e => setVia(e.target.value)} title="Transport (default from Integrations)"><option value="">Default transport</option><option value="http">HTTP</option><option value="email">E-mail</option><option value="sftp">SFTP</option></select><button className="btn violet" disabled={!q.data || sending} onClick={() => void transmit()}>{sending ? 'Sending…' : 'Transmit'}</button><div className="flex-1" /><button className="btn outline" onClick={onClose}>Close</button><button className="btn outline" disabled={!q.data} onClick={() => { void navigator.clipboard.writeText(q.data.content); toast.ok('Copied') }}><Copy /> Copy</button><a className={cls('btn green', !q.data && 'opacity-50 pointer-events-none')} href={`/api/jobs/${jid}/edi?format=${fmt}`}>Download</a></>}>
      <div className="flex gap-2 mb-3 flex-wrap">{[['iftmin', 'UN/EDIFACT IFTMIN (booking / instruction)'], ...(air ? [['fwb', 'IATA FWB (air waybill)']] : []), ['json', 'JSON (full job record)']].map(([k, l]) => <button key={k} className={cls('btn sm', fmt === k ? 'green' : 'outline')} onClick={() => setFmt(k)}>{l}</button>)}</div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : <><pre className="bg-graphite text-[#d6f5e6] rounded-xl p-4 text-[12px] overflow-auto max-h-[46vh] m-0 whitespace-pre-wrap break-all">{q.data.content}</pre><p className="text-xs text-muted mt-2 mb-0">{q.data.note}</p></>}
    </Modal>
  )
}

export function MailPrintDialog({ jobIds, jobNo, air, onClose }: { jobIds: number[]; jobNo?: string; air?: boolean; onClose: () => void }) {
  const toast = useToast(); const [tab, setTab] = useState<'mail' | 'print'>('mail')
  const [tpl, setTpl] = useState('status'); const [msg, setMsg] = useState(''); const [to, setTo] = useState('')
  const [prev, setPrev] = useState<any[] | null>(null); const [busy, setBusy] = useState(false)
  const run = async (preview: boolean) => { setBusy(true); try { const r = await post<any[]>('/api/jobs/bulk-mail', { job_ids: jobIds, template: tpl, message: msg || undefined, to: to || undefined, preview }); if (preview) setPrev(r); else { const ok = r.filter(x => x.queued).length; toast.ok(`${ok} e-mail(s) queued${r.length - ok ? `, ${r.length - ok} skipped` : ''}`); if (r.length - ok) setPrev(r); else onClose() } } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  const docs = [['Job report', 'jobs'], ['House B/L (draft)', 'bl'], ...(air ? [['House air waybill (draft)', 'awb']] : []), ['Cargo labels', 'labels'], ['Delivery order', 'do']]
  return (
    <Modal open onClose={onClose} title={`Bulk Mail / Print${jobNo ? ' – ' + jobNo : ` – ${jobIds.length} jobs`}`} width={720}>
      <Tabs variant="sub" tabs={[{ key: 'mail', label: 'E-mail customers' }, { key: 'print', label: 'Print documents' }]} value={tab} onChange={k => setTab(k as any)} />
      {tab === 'mail' ? <div className="pt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Template</label><select className="select" value={tpl} onChange={e => { setTpl(e.target.value); setPrev(null) }}><option value="status">Shipment status update</option><option value="arrival">Arrival notice</option><option value="documents">Document status</option><option value="custom">Custom message only</option></select></div><div><label className="label">Send to (blank = customer contacts)</label><input className="input" placeholder="name@company.com" value={to} onChange={e => setTo(e.target.value)} /></div></div>
        <div><label className="label">Message (added above the template)</label><textarea className="textarea" rows={3} value={msg} onChange={e => setMsg(e.target.value)} /></div>
        <div className="flex gap-2"><button className="btn outline" disabled={busy} onClick={() => void run(true)}>Preview</button><button className="btn green" disabled={busy} onClick={() => void run(false)}><Mail /> Queue e-mail</button><span className="text-xs text-muted self-center">Delivered via your SMTP settings; see Admin → E-mail Outbox.</span></div>
        {prev && <div className="max-h-[34vh] overflow-auto grid gap-3">{prev.map(p => <div key={p.job_id} className="border border-line rounded-xl p-3 text-sm">{p.error ? <div className="text-signal font-semibold">{p.job_no}: {p.error}</div> : <><div className="text-xs text-muted">To: <b className="text-ink">{p.to}</b></div><div className="font-bold">{p.subject}</div><pre className="whitespace-pre-wrap text-[12.5px] m-0 mt-1 font-sans">{p.body}</pre></>}</div>)}</div>}
      </div> : <div className="pt-4 grid gap-2 sm:grid-cols-2">{jobIds.length === 1 ? docs.map(([label, key]) => <Link key={key} className="btn outline justify-start" to={key === 'jobs' ? `/print/jobs/${jobIds[0]}` : key === 'do' ? `/print/jobs/${jobIds[0]}?doc=do` : `/print/jobs/${jobIds[0]}?doc=${key}`}><Printer /> {label}</Link>) : <Link className="btn green" to={`/print/jobs/${jobIds.join(',')}`}><Printer /> Print job reports ({jobIds.length})</Link>}</div>}
    </Modal>
  )
}
void useMemo; void Upload


