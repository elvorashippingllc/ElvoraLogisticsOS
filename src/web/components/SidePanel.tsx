import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Hand, Paperclip, Link as LinkIcon, Tag, Link2, ThumbsUp, MessageCircleWarning, Video, History, X, Trash2, Plus, Download, Send, ExternalLink, Check } from 'lucide-react'
import { del, get, post, put, upload } from '../lib/api'
import { useMeta } from '../lib/meta'
import { Badge, Loading, useDialogs } from '../ui/kit'
import { RefSelect } from './RefSelect'
import { useToast } from '../lib/toast'
import { cls, fmtDate, fmtIsoStamp, fmtDateTime, todayIso } from '../lib/format'
import { recordPath } from './EntityList'
import { optValue } from '@shared/types'

type Key = 'comments' | 'followups' | 'attachments' | 'references' | 'tags' | 'links' | 'likes' | 'complaints' | 'videocalls' | 'history'
const ITEMS: { key: Key; label: string; icon: ReactNode }[] = [
  { key: 'comments', label: 'Comments', icon: <MessageSquare /> }, { key: 'followups', label: 'Follow Up', icon: <Hand /> }, { key: 'attachments', label: 'Attachments', icon: <Paperclip /> },
  { key: 'references', label: 'References', icon: <LinkIcon /> }, { key: 'tags', label: 'Tags', icon: <Tag /> }, { key: 'links', label: 'Links', icon: <Link2 /> },
  { key: 'likes', label: 'Likes', icon: <ThumbsUp /> }, { key: 'complaints', label: 'Complaints', icon: <MessageCircleWarning /> }, { key: 'videocalls', label: 'Video Call', icon: <Video /> }, { key: 'history', label: 'History', icon: <History /> },
]

export function SidePanel({ entity, id, onChanged }: { entity: string; id: number; onChanged?: () => void }) {
  const [active, setActive] = useState<Key | null>(null)
  const qc = useQueryClient()
  const counts = useQuery({ queryKey: ['panel', entity, id], queryFn: () => get<any>(`/api/panel/${entity}/${id}`) })
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['panel', entity, id] }); onChanged?.() }
  const c = counts.data ?? {}
  return (
    <>
      <nav className="rail card" aria-label="Collaboration">
        {ITEMS.map(i => <button key={i.key} className={cls(active === i.key && 'active')} onClick={() => setActive(a => (a === i.key ? null : i.key))}>{i.icon}<span className="cnt">{c[i.key] ?? 0}</span><span>- {i.label}</span></button>)}
      </nav>
      {active && (
        <div className="fixed inset-y-0 right-0 z-50 w-[min(480px,100vw)] bg-card border-l border-line shadow-2xl flex flex-col fade-in" role="dialog" aria-label={ITEMS.find(i => i.key === active)?.label}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-emerald text-white"><span className="font-display font-extrabold flex-1">{ITEMS.find(i => i.key === active)?.label} <span className="font-normal opacity-80 text-sm">· {c.title}</span></span><button className="btn ghost icon sm text-white" onClick={() => setActive(null)} aria-label="Close panel"><X /></button></div>
          <div className="flex-1 overflow-auto p-4">
            {active === 'comments' && <Comments entity={entity} id={id} refresh={refresh} />}
            {active === 'followups' && <FollowUps entity={entity} id={id} title={c.title} refresh={refresh} />}
            {active === 'attachments' && <Attachments entity={entity} id={id} refresh={refresh} />}
            {active === 'references' && <Refs entity={entity} id={id} refresh={refresh} />}
            {active === 'tags' && <Tags entity={entity} id={id} refresh={refresh} />}
            {active === 'links' && <Links entity={entity} id={id} refresh={refresh} />}
            {active === 'likes' && <Likes entity={entity} id={id} liked={c.liked} refresh={refresh} />}
            {active === 'complaints' && <Complaints entity={entity} id={id} refresh={refresh} />}
            {active === 'videocalls' && <VideoCalls entity={entity} id={id} refresh={refresh} />}
            {active === 'history' && <HistoryTab entity={entity} id={id} />}
          </div>
        </div>
      )}
    </>
  )
}

function useList<T = any>(key: string[], url: string) { return useQuery({ queryKey: key, queryFn: () => get<T>(url) }) }
const Row = ({ children, onDelete }: { children: ReactNode; onDelete?: () => void }) => <div className="flex gap-2 items-start py-2.5 border-b border-line last:border-0"><div className="flex-1 min-w-0">{children}</div>{onDelete && <button className="btn ghost icon sm" onClick={onDelete} aria-label="Delete"><Trash2 className="text-signal" /></button>}</div>

function Comments({ entity, id, refresh }: any) {
  const { me } = useMeta(); const toast = useToast(); const qc = useQueryClient()
  const q = useList<any[]>(['comments', entity, String(id)], `/api/panel/${entity}/${id}/comments`)
  const [text, setText] = useState('')
  const send = async () => { if (!text.trim()) return; try { await post(`/api/panel/${entity}/${id}/comments`, { body: text }); setText(''); void qc.invalidateQueries({ queryKey: ['comments', entity, String(id)] }); refresh() } catch (e: any) { toast.error(e.message) } }
  return (<div>
    <textarea className="textarea" rows={3} placeholder="Write a comment… use @Full Name to notify a colleague (Ctrl+Enter to post)" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send() }} />
    <div className="flex justify-end mt-2"><button className="btn green sm" disabled={!text.trim()} onClick={() => void send()}><Send /> Post</button></div>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.length === 0 ? <p className="text-sm text-muted text-center py-6">No comments yet.</p> : q.data.map(c => <Row key={c.id} onDelete={c.user_id === me?.id ? async () => { await del(`/api/panel/${entity}/${id}/comments/${c.id}`); void qc.invalidateQueries({ queryKey: ['comments', entity, String(id)] }); refresh() } : undefined}><div className="text-xs text-muted"><b className="text-ink">{c.user_name}</b> · {fmtIsoStamp(c.created_at)}</div><div className="whitespace-pre-wrap text-[13.5px] mt-0.5">{c.body}</div></Row>)}</div>
  </div>)
}

function FollowUps({ entity, id, title, refresh }: any) {
  const qc = useQueryClient(); const toast = useToast()
  const filters = JSON.stringify([{ field: 'link_entity', op: 'eq', value: entity }, { field: 'link_id', op: 'eq', value: id }])
  const q = useQuery({ queryKey: ['followups', entity, id], queryFn: () => get<{ rows: any[] }>('/api/e/tasks', { filters, pageSize: 100, sort: 'due_date', dir: 'asc' }) })
  const [t, setT] = useState(''); const [due, setDue] = useState(todayIso()); const [who, setWho] = useState<number | null>(null)
  const { me } = useMeta()
  const inv = () => { void qc.invalidateQueries({ queryKey: ['followups', entity, id] }); refresh() }
  const add = async () => { try { await post('/api/e/tasks', { title: t, due_date: due, assignee_id: who ?? me?.id, kind: 'Follow-up', link_entity: entity, link_id: id }); setT(''); inv() } catch (e: any) { toast.error(e.message) } }
  return (<div>
    <div className="grid gap-2"><input className="input" placeholder={`Follow-up for ${title ?? 'this record'}…`} value={t} onChange={e => setT(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && t.trim()) void add() }} />
      <div className="grid grid-cols-2 gap-2"><input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} /><RefSelect entity="users" value={who ?? me?.id} onChange={id => setWho(id)} /></div>
      <button className="btn green sm self-end" disabled={!t.trim()} onClick={() => void add()}><Plus /> Add follow-up</button></div>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.rows.length === 0 ? <p className="text-sm text-muted text-center py-6">No follow-ups.</p> : q.data.rows.map(r => (
      <Row key={r.id}><div className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-emerald" checked={r.status === 'Done'} onChange={async e => { await put(`/api/e/tasks/${r.id}`, { status: e.target.checked ? 'Done' : 'To do', version: r.version }); inv() }} aria-label="Done" />
        <div className="flex-1"><div className={cls('font-semibold text-ink', r.status === 'Done' && 'line-through text-muted')}>{r.title}</div><div className="text-xs text-muted">Due {fmtDate(r.due_date)} · {r._labels.assignee_id} {r.due_date < todayIso() && r.status !== 'Done' && <span className="text-signal font-bold">· overdue</span>}</div></div></div></Row>))}</div>
  </div>)
}

export function Attachments({ entity, id, refresh }: any) {
  const qc = useQueryClient(); const toast = useToast(); const dlg = useDialogs()
  const filters = JSON.stringify([{ field: 'link_entity', op: 'eq', value: entity }, { field: 'link_id', op: 'eq', value: id }])
  const q = useQuery({ queryKey: ['attach', entity, id], queryFn: () => get<{ rows: any[] }>('/api/e/attachments', { filters, pageSize: 200 }) })
  const { def } = useMeta()
  const cats = (def('attachments').fields.find(f => f.name === 'category')?.options ?? []).map(optValue)
  const [cat, setCat] = useState('General'); const [exp, setExp] = useState(''); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false)
  const go = async (files: FileList | File[]) => { if (!files.length) return; setBusy(true); try { await upload([...files], { link_entity: entity, link_id: id, category: cat, expiry_date: exp }); toast.ok('Uploaded'); void qc.invalidateQueries({ queryKey: ['attach', entity, id] }); refresh() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  return (<div>
    <div className="grid grid-cols-2 gap-2 mb-2"><select className="select" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">{cats.map(c => <option key={c}>{c}</option>)}</select><input className="input" type="date" value={exp} onChange={e => setExp(e.target.value)} title="Expiry date (optional)" aria-label="Expiry date" /></div>
    <label className={cls('block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer text-sm', drag ? 'border-emerald bg-mint' : 'border-line-strong hover:bg-hover')} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void go(e.dataTransfer.files) }}>
      <input type="file" multiple hidden onChange={e => { if (e.target.files) void go(e.target.files); e.target.value = '' }} />{busy ? 'Uploading…' : <><b>Drop files here</b> or click to browse<div className="text-xs text-muted mt-1">Max 25 MB per file · PDF, images, Office files, ZIP…</div></>}</label>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.rows.length === 0 ? <p className="text-sm text-muted text-center py-6">No documents attached.</p> : q.data.rows.map(f => (
      <Row key={f.id} onDelete={async () => { if (await dlg.confirm({ title: 'Remove document?', message: f.file_name, danger: true, ok: 'Remove' })) { await del(`/api/files/${f.id}`); void qc.invalidateQueries({ queryKey: ['attach', entity, id] }); refresh() } }}>
        <a className="link flex items-center gap-1.5" href={`/api/files/${f.id}/download`} target="_blank" rel="noreferrer"><Download size={14} />{f.file_name}</a>
        <div className="text-xs text-muted">{f.category} · v{f.doc_version} · {(f.size / 1024).toFixed(0)} KB · {fmtIsoStamp(f.created_at)}{f.expiry_date && <> · <span className={f.expiry_date < todayIso() ? 'text-signal font-bold' : ''}>expires {fmtDate(f.expiry_date)}</span></>}</div></Row>))}</div>
  </div>)
}

function Refs({ entity, id, refresh }: any) {
  const qc = useQueryClient(); const q = useList<any[]>(['refs', entity, String(id)], `/api/panel/${entity}/${id}/refs`)
  const [type, setType] = useState('Customer PO'); const [val, setVal] = useState(''); const [note, setNote] = useState(''); const toast = useToast()
  const types = ['Customer PO', 'Carrier booking', 'Carrier reference', 'Shipper reference', 'Consignee reference', 'LC number', 'Insurance policy', 'Permit / licence', 'Agent reference', 'Other']
  const add = async () => { try { await post(`/api/panel/${entity}/${id}/refs`, { ref_type: type, ref_value: val, note: note || undefined }); setVal(''); setNote(''); void qc.invalidateQueries({ queryKey: ['refs', entity, String(id)] }); refresh() } catch (e: any) { toast.error(e.message) } }
  return (<div>
    <div className="grid gap-2"><select className="select" value={type} onChange={e => setType(e.target.value)}>{types.map(t => <option key={t}>{t}</option>)}</select><input className="input" placeholder="Reference number" value={val} onChange={e => setVal(e.target.value)} /><input className="input" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} /><button className="btn green sm self-end" disabled={!val.trim()} onClick={() => void add()}><Plus /> Add reference</button></div>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.length === 0 ? <p className="text-sm text-muted text-center py-6">No references.</p> : q.data.map(r => <Row key={r.id} onDelete={async () => { await del(`/api/panel/${entity}/${id}/refs/${r.id}`); void qc.invalidateQueries({ queryKey: ['refs', entity, String(id)] }); refresh() }}><div className="text-xs text-muted">{r.ref_type}</div><div className="font-bold text-ink">{r.ref_value}</div>{r.note && <div className="text-xs">{r.note}</div>}</Row>)}</div>
  </div>)
}

function Tags({ entity, id, refresh }: any) {
  const qc = useQueryClient(); const q = useList<string[]>(['tags', entity, String(id)], `/api/panel/${entity}/${id}/tags`); const all = useList<any[]>(['alltags'], '/api/tags')
  const [t, setT] = useState('')
  const add = async (tag: string) => { if (!tag.trim()) return; await post(`/api/panel/${entity}/${id}/tags`, { tag }); setT(''); void qc.invalidateQueries({ queryKey: ['tags', entity, String(id)] }); void qc.invalidateQueries({ queryKey: ['alltags'] }); refresh() }
  return (<div>
    <div className="flex gap-2"><input className="input" list="taglist" placeholder="Add a tag (e.g. urgent, dg-cargo, vip)" value={t} onChange={e => setT(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void add(t) }} /><datalist id="taglist">{all.data?.map(x => <option key={x.tag} value={x.tag} />)}</datalist><button className="btn green sm" onClick={() => void add(t)} disabled={!t.trim()}><Plus /></button></div>
    <div className="flex flex-wrap gap-2 mt-4">{!q.data ? <Loading /> : q.data.length === 0 ? <p className="text-sm text-muted w-full text-center py-6">No tags.</p> : q.data.map(tag => <span key={tag} className="badge teal">{tag}<button className="ml-1 bg-transparent border-0 cursor-pointer text-inherit p-0" aria-label={`Remove ${tag}`} onClick={async () => { await del(`/api/panel/${entity}/${id}/tags/${encodeURIComponent(tag)}`); void qc.invalidateQueries({ queryKey: ['tags', entity, String(id)] }); refresh() }}>×</button></span>)}</div>
  </div>)
}

const LINKABLE = ['jobs', 'shipments', 'quotations', 'invoices', 'bills', 'parties', 'contacts', 'bookings', 'tickets', 'claims', 'opportunities', 'leads', 'transport_orders', 'customs_declarations', 'grns', 'dispatches', 'contracts', 'projects']
function Links({ entity, id, refresh }: any) {
  const { def } = useMeta(); const qc = useQueryClient(); const q = useList<any[]>(['links', entity, String(id)], `/api/panel/${entity}/${id}/links`); const toast = useToast()
  const [to, setTo] = useState('jobs'); const [tid, setTid] = useState<number | null>(null)
  return (<div>
    <div className="grid gap-2"><select className="select" value={to} onChange={e => { setTo(e.target.value); setTid(null) }}>{LINKABLE.map(k => <option key={k} value={k}>{def(k).label}</option>)}</select><RefSelect key={to} entity={to} value={tid} onChange={setTid} placeholder={`Search ${def(to).plural.toLowerCase()}…`} />
      <button className="btn green sm self-end" disabled={!tid} onClick={async () => { try { await post(`/api/panel/${entity}/${id}/links`, { to_entity: to, to_id: tid }); setTid(null); void qc.invalidateQueries({ queryKey: ['links', entity, String(id)] }); refresh() } catch (e: any) { toast.error(e.message) } }}><Plus /> Link record</button></div>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.length === 0 ? <p className="text-sm text-muted text-center py-6">No linked records.</p> : q.data.map(l => <Row key={l.id} onDelete={async () => { await del(`/api/panel/${entity}/${id}/links/${l.id}`); void qc.invalidateQueries({ queryKey: ['links', entity, String(id)] }); refresh() }}><div className="text-xs text-muted">{l.type_label}</div><Link className="link inline-flex items-center gap-1" to={recordPath(l.to_entity, l.to_id)}>{l.label}<ExternalLink size={12} /></Link></Row>)}</div>
  </div>)
}

function Likes({ entity, id, liked, refresh }: any) {
  const qc = useQueryClient(); const q = useList<any[]>(['likes', entity, String(id)], `/api/panel/${entity}/${id}/likes`)
  return (<div><button className={cls('btn', liked ? 'green' : 'outline')} onClick={async () => { await post(`/api/panel/${entity}/${id}/like`); void qc.invalidateQueries({ queryKey: ['likes', entity, String(id)] }); refresh() }}><ThumbsUp /> {liked ? 'Liked' : 'Like this record'}</button>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.length === 0 ? <p className="text-sm text-muted py-4">Nobody has liked this yet.</p> : q.data.map((l, i) => <Row key={i}><b className="text-ink">{l.name}</b> <span className="text-xs text-muted">· {fmtIsoStamp(l.created_at)}</span></Row>)}</div></div>)
}

function Complaints({ entity, id, refresh }: any) {
  const qc = useQueryClient(); const toast = useToast()
  const filters = JSON.stringify([{ field: 'link_entity', op: 'eq', value: entity }, { field: 'link_id', op: 'eq', value: id }])
  const q = useQuery({ queryKey: ['complaints', entity, id], queryFn: () => get<{ rows: any[] }>('/api/e/tickets', { filters, pageSize: 50 }) })
  const [subject, setSubject] = useState(''); const [prio, setPrio] = useState('Medium'); const [desc, setDesc] = useState('')
  const rec = useQuery({ queryKey: ['rec-min', entity, id], queryFn: () => get<any>(`/api/e/${entity}/${id}`) })
  const add = async () => {
    const r = rec.data ?? {}
    const customer = r.client_id ?? r.customer_id ?? (entity === 'parties' ? id : r.party_id)
    try { await post('/api/e/tickets', { subject, priority: prio, description: desc || null, type: 'Complaint', customer_id: customer ?? null, job_id: entity === 'jobs' ? id : r.job_id ?? null, link_entity: entity, link_id: id }); setSubject(''); setDesc(''); void qc.invalidateQueries({ queryKey: ['complaints', entity, id] }); refresh() } catch (e: any) { toast.error(e.message) }
  }
  return (<div>
    <div className="grid gap-2"><input className="input" placeholder="Complaint / issue summary" value={subject} onChange={e => setSubject(e.target.value)} /><textarea className="textarea" rows={2} placeholder="Details" value={desc} onChange={e => setDesc(e.target.value)} />
      <div className="flex gap-2"><select className="select" value={prio} onChange={e => setPrio(e.target.value)}>{['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}</select><button className="btn red sm" disabled={!subject.trim()} onClick={() => void add()}><Plus /> Log complaint</button></div></div>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.rows.length === 0 ? <p className="text-sm text-muted text-center py-6">No complaints recorded.</p> : q.data.rows.map(t => <Row key={t.id}><Link className="link" to={`/e/tickets/${t.id}`}>{t.ticket_no}</Link> <Badge value={t.status} /> <Badge value={t.priority} /><div className="text-[13.5px]">{t.subject}</div></Row>)}</div>
  </div>)
}

function VideoCalls({ entity, id, refresh }: any) {
  const qc = useQueryClient(); const q = useList<any[]>(['video', entity, String(id)], `/api/panel/${entity}/${id}/video`); const toast = useToast()
  return (<div><button className="btn green" onClick={async () => { try { const r = await post<{ url: string }>(`/api/panel/${entity}/${id}/video`); window.open(r.url, '_blank', 'noopener'); void qc.invalidateQueries({ queryKey: ['video', entity, String(id)] }); refresh() } catch (e: any) { toast.error(e.message) } }}><Video /> Start video call</button>
    <p className="text-xs text-muted mt-2">Creates a private Jitsi Meet room (no account needed) and posts the link as a comment so teammates can join.</p>
    <div className="mt-3">{!q.data ? <Loading /> : q.data.length === 0 ? <p className="text-sm text-muted text-center py-6">No calls yet.</p> : q.data.map(v => <Row key={v.id}><a className="link" href={v.url} target="_blank" rel="noreferrer">{v.url.replace('https://', '')}</a><div className="text-xs text-muted">{v.user_name} · {fmtIsoStamp(v.created_at)}</div></Row>)}</div></div>)
}

function HistoryTab({ entity, id }: any) {
  const { def } = useMeta(); const d = def(entity)
  const q = useList<any[]>(['history', entity, String(id)], `/api/panel/${entity}/${id}/history`)
  const label = (n: string) => d.fields.find(f => f.name === n)?.label ?? n
  const show = (v: any) => (v === null || v === undefined || v === '' ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v))
  return !q.data ? <Loading /> : q.data.length === 0 ? <p className="text-sm text-muted text-center py-6">No history.</p> : (
    <ol className="m-0 p-0 list-none border-l-2 border-line ml-2">{q.data.map(h => (
      <li key={h.id} className="relative pl-5 pb-4"><span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-emerald border-2 border-card" />
        <div className="text-xs text-muted"><b className="text-ink">{h.user_name}</b> · {fmtIsoStamp(h.at)}</div><div className="font-semibold text-ink capitalize">{String(h.action).replace(/-/g, ' ')}</div>
        {h.changes && <div className="mt-1 text-[12.5px] grid gap-0.5">{Object.entries<any>(h.changes).slice(0, 14).map(([k, v]) => k === '_children' ? <div key={k} className="text-muted">Lines changed: {Object.entries<any>(v).map(([ck, [a, b]]) => `${ck} ${a}→${b}`).join(', ')}</div> : <div key={k}><span className="text-muted">{label(k)}:</span> <s className="text-muted">{show(v[0])}</s> <Check size={11} className="inline text-muted" /> <b>{show(v[1])}</b></div>)}</div>}
      </li>))}</ol>)
}
void fmtDateTime
