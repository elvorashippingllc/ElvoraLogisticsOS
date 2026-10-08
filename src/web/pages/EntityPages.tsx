import { SenderSelect } from './EmailPage'
import { PdfDownload, DocumentPrinter } from '../components/ui/document-printer'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, Printer, MoreHorizontal, Plus, FileDown, Mail as MailIcon } from 'lucide-react'
import { del, get, post } from '../lib/api'
import { useMeta } from '../lib/meta'
import { EntityList, recordPath } from '../components/EntityList'
import { EntityFormModal } from '../components/EntityForm'
import { RecordView } from '../components/RecordView'
import { ChildEditor } from '../components/ChildEditor'
import { SidePanel } from '../components/SidePanel'
import { QuickPayDialog, AllocateDialog, ReconcileDialog, PodDialog } from '../components/Dialogs'
import { RefSelect } from '../components/RefSelect'
import { Badge, Dropdown, ErrorBox, Loading, Modal, PageHeader, Tabs, useDialogs } from '../ui/kit'
import { ACTIONS, PRINTABLE, RELATED, type ActionDef } from '../lib/actions'
import { useToast } from '../lib/toast'
import { iconByName } from '../lib/icons'
import { cls, fmtMoney } from '../lib/format'
import { CellValue } from '../components/Fields'

export function EntityListPage() {
  const { entity = '' } = useParams()
  const { meta } = useMeta()
  const [sp, setSp] = useSearchParams()
  const [open, setOpen] = useState(sp.get('new') === '1')
  const known = meta?.entities.find(e => e.key === entity)
  const nav = useNavigate()
  if (!known || known.child) return <ErrorBox error={new Error('Unknown record type')} />
  const presets: Record<string, any> = {}
  for (const [k, v] of sp.entries()) if (!['new', 'q', 'page', 'size', 'sort', 'dir', 'status', 'filters'].includes(k)) presets[k] = /^\d+$/.test(v) ? Number(v) : v
  const done = (r: any) => { setOpen(false); const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }); nav(recordPath(entity, r.id)) }
  return (<>
    <EntityList key={entity} entity={entity} />
    {open && <EntityFormModal entity={entity} presets={presets} onClose={() => { setOpen(false); const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }) }} onSaved={done} />}
  </>)
}

const LOCKED: Record<string, (r: any) => boolean> = {
  invoices: r => r.status !== 'Draft', bills: r => r.status !== 'Draft', receipts: r => r.status !== 'Draft', payments: r => r.status !== 'Draft', journal_entries: () => true,
  grns: r => r.status !== 'Draft', dispatches: r => r.status !== 'Draft', expenses: r => !['Draft', 'Rejected'].includes(r.status), payslips: r => r.status === 'Paid', quotations: r => ['Accepted', 'Converted to job'].includes(r.status),
  leave_requests: r => r.status !== 'Pending', purchase_orders: r => ['Ordered', 'Received', 'Cancelled'].includes(r.status),
}

export function EntityRecordPage() {
  const { entity = '', id = '' } = useParams()
  const { def: getDef, can, meta, me } = useMeta()
  const nav = useNavigate(), qc = useQueryClient(), toast = useToast(), dlg = useDialogs()
  const rid = Number(id)
  const known = meta?.entities.find(e => e.key === entity)
  const q = useQuery({ queryKey: ['rec', entity, rid], queryFn: () => get<any>(`/api/e/${entity}/${rid}`), enabled: !!known })
  const [tab, setTab] = useState('details')
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState<{ name: string; props: any } | null>(null)
  if (!known) return <ErrorBox error={new Error('Unknown record type')} />
  const def = getDef(entity)
  const Icon = iconByName(def.icon)
  const reload = () => { void qc.invalidateQueries({ queryKey: ['rec', entity, rid] }); void qc.invalidateQueries({ queryKey: ['list', entity] }); void qc.invalidateQueries({ queryKey: ['panel', entity, rid] }) }
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <Loading />
  const rec = q.data
  const helpers = { rec, entity, userId:me?.id, toast, dlg, nav: (to: string) => nav(to), reload, can, dialog: (name: string, props?: any) => setDialog({ name, props }) }
  const acts = (ACTIONS[entity] ?? []).filter((a: ActionDef) => a.show(rec, helpers))
  const primary = acts.filter(a => !a.more), more = acts.filter(a => a.more)
  const locked = LOCKED[entity]?.(rec) || def.readonlyApi
  const canEdit = can(def.module, 'edit') && !locked
  const canDelete = can(def.module, 'delete') && !def.noDelete && !def.readonlyApi
  const keyFields = def.fields.filter(f => f.key && rec[f.name] !== null && rec[f.name] !== undefined && rec[f.name] !== '').slice(0, 5)
  const facts = keyFields.length ? keyFields : def.fields.filter(f => f.list && f.name !== def.title[0] && rec[f.name] !== null && rec[f.name] !== '' && f.type !== 'textarea').slice(0, 4)
  const tabs = [{ key: 'details', label: 'Details' }, ...(def.children ?? []).map(c => ({ key: 'c:' + c.key, label: c.label, count: rec.children?.[c.key]?.length })), ...(RELATED[entity] ?? []).filter(r => can(getDef(r.entity).module, 'view')).map(r => ({ key: 'r:' + r.key, label: r.label }))]
  const status = def.statusField ? rec[def.statusField] : null
  const del_ = async () => { if (await dlg.confirm({ title: `Delete ${def.label.toLowerCase()}?`, message: rec._title, danger: true, ok: 'Delete' })) { try { await del(`/api/e/${entity}/${rid}`); toast.ok('Deleted'); void qc.invalidateQueries({ queryKey: ['list', entity] }); nav(`/e/${entity}`) } catch (e: any) { toast.error(e.message) } } }
  const approvalBadge = rec.approval_status && rec.approval_status !== 'Not required' ? <Badge value={`Approval: ${rec.approval_status}`} tone={rec.approval_status === 'Approved' ? 'green' : rec.approval_status === 'Rejected' ? 'red' : 'amber'} /> : null

  return (
    <div className="fade-in record-page">
      <PageHeader back={<Link className="btn grey" to={`/e/${entity}`}><ArrowLeft /> Back</Link>} icon={<Icon size={20} />} title={<span className="flex items-center gap-3 flex-wrap">{rec._title}{status && <Badge value={status} />}{approvalBadge}{rec.doc_type && <Badge value={rec.doc_type} tone="blue" />}</span>} subtitle={`${def.label} · last updated ${new Date(rec.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`}
        actions={<>
          {primary.map(a => <button key={a.key} className={cls('btn', a.tone ?? 'green')} onClick={() => void a.run(helpers)}>{a.label}</button>)}
          {PRINTABLE.has(entity) && <Link className="btn outline" to={`/print/${entity}/${rid}`}><Printer /> Print</Link>}
          {PRINTABLE.has(entity) && <PdfDownload entity={entity} id={rid} />}
          {PRINTABLE.has(entity) && can(def.module, 'edit') && !['payslips', 'insurance_certs', 'grns', 'dispatches', 'transport_orders'].includes(entity) && <button className="btn outline" onClick={() => setDialog({ name: 'emailPdf', props: {} })}><MailIcon /> E-mail</button>}
          {canEdit && <button className="btn green" onClick={() => setEditing(true)}><Pencil /> Edit</button>}
          {(more.length > 0 || canDelete) && <Dropdown className="btn outline" label={<MoreHorizontal size={16} />} items={[...more.map(a => ({ label: a.label, onClick: () => void a.run(helpers), danger: a.tone === 'red' })), ...(canDelete ? [{ label: <><Trash2 size={14} /> Delete</>, onClick: () => void del_(), danger: true, divider: false }] : [])]} />}
        </>} />
      {facts.length > 0 && <div className="grid gap-3 mb-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">{facts.map(f => <div key={f.name} className="card px-4 py-3"><div className="text-[11.5px] font-semibold text-muted">{f.label}</div><div className="font-display font-extrabold text-[17px] text-ink mt-0.5 break-words"><CellValue f={f} rec={rec} statusField={def.statusField} /></div></div>)}</div>}
      <div className="record-workspace flex gap-4 items-start flex-col lg:flex-row">
        <div className="flex-1 min-w-0 w-full card overflow-hidden">
          {tabs.length > 1 && <Tabs variant="sub" tabs={tabs} value={tab} onChange={setTab} />}
          <div className="p-4 md:p-5">
            {tab === 'details' && <RecordView def={def} rec={rec} />}
            {tab.startsWith('c:') && (() => { const c = def.children!.find(x => 'c:' + x.key === tab)!; return <ChildEditor child={c} rows={rec.children[c.key] ?? []} onChange={() => {}} readOnly parent={rec} /> })()}
            {tab.startsWith('r:') && (() => { const r = RELATED[entity].find(x => 'r:' + x.key === tab)!; return <EntityList key={r.key} entity={r.entity} embedded preset={[{ field: r.field, op: 'eq', value: rid }]} createPresets={{ [r.field]: rid }} /> })()}
          </div>
        </div>
        {def.panel && <div className="w-full lg:w-auto flex-none"><SidePanel entity={entity} id={rid} onChanged={reload} /></div>}
      </div>
      {editing && <EntityFormModal entity={entity} id={rid} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />}
      {dialog?.name === 'emailPdf' && <EmailPdfDialog entity={entity} rec={rec} onClose={() => setDialog(null)} />}
      {dialog?.name === 'pay' && <QuickPayDialog kind={dialog.props.kind} doc={dialog.props.doc} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload() }} />}
      {dialog?.name === 'allocate' && <AllocateDialog kind={dialog.props.kind} rec={dialog.props.rec} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload() }} />}
      {dialog?.name === 'reconcile' && <ReconcileDialog txn={dialog.props.txn} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload() }} />}
      {dialog?.name === 'pod' && <PodDialog order={dialog.props.order} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload() }} />}
      {dialog?.name === 'payExpense' && <PayExpense rec={dialog.props.rec} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload() }} />}
    </div>
  )
}

function PayExpense({ rec, onClose, onDone }: { rec: any; onClose: () => void; onDone: () => void }) {
  const [bank, setBank] = useState<number | null>(null); const toast = useToast()
  return <Modal open onClose={onClose} title={`Pay ${rec.expense_no}`} width={460} footer={<><div className="flex-1" /><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn green" disabled={!bank} onClick={async () => { try { await post(`/api/finance/expenses/${rec.id}/pay`, { bank_account_id: bank }); toast.ok('Marked paid'); onDone() } catch (e: any) { toast.error(e.message) } }}>Pay {fmtMoney(rec.amount)}</button></>}><label className="label">Paid from</label><RefSelect entity="bank_accounts" value={bank} onChange={setBank} /></Modal>
}
void Plus


function EmailPdfDialog({ entity, rec, onClose }: { entity: string; rec: any; onClose: () => void }) {
  const toast = useToast(); const partyId = rec.party_id ?? rec.customer_id ?? rec.vendor_id ?? rec.client_id
  const guess = useQuery({ queryKey: ['mailto', entity, rec.id], enabled: !!partyId, queryFn: async () => { const c = await get<any>('/api/e/contacts', { filters: JSON.stringify([{ field: 'party_id', op: 'eq', value: partyId }]), pageSize: 5 }); const p = await get<any>(`/api/e/parties/${partyId}`); return c.rows.find((x: any) => x.email)?.email ?? p.email ?? '' } })
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [subject, setSubject] = useState(`${rec._title}`); const [body, setBody] = useState(`Dear customer,\n\nPlease find attached ${rec._title}.\n\nKind regards,\nElvora Shipping team`); const [busy, setBusy] = useState(false)
  useEffect(() => { if (guess.data && !to) setTo(guess.data) }, [guess.data])  // eslint-disable-line
  const send = async () => { setBusy(true); try { await post(`/api/pdf/${entity}/${rec.id}/email`, { from, to, subject, body }); toast.ok('E-mail with PDF queued'); onClose() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title={`E-mail ${rec._title} as PDF`} width={600} footer={<><button className="btn outline" onClick={onClose}>Cancel</button><div className="flex-1" /><button className="btn green" disabled={busy || !to || !from} onClick={() => void send()}>{busy ? 'Rendering PDF…' : 'Send'}</button></>}>
      {busy && <DocumentPrinter label="Rendering PDF…" />}
      <div className="grid gap-3"><SenderSelect value={from} onChange={setFrom} /><div><label className="label">To</label><input className="input" value={to} onChange={e => setTo(e.target.value)} placeholder="customer@example.com" /></div><div><label className="label">Subject</label><input className="input" value={subject} onChange={e => setSubject(e.target.value)} /></div><div><label className="label">Message</label><textarea className="textarea" rows={6} value={body} onChange={e => setBody(e.target.value)} /></div><div className="text-xs text-muted">The PDF is generated by the server and attached automatically.</div></div>
    </Modal>
  )
}


