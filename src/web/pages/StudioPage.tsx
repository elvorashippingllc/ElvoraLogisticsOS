import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy, Eye, FilePenLine, FileText, Mail, Printer, Save, Search, Sparkles, Wand2, CheckCircle2, ReceiptText, Languages, Scissors, Expand, SpellCheck, Briefcase, Users } from 'lucide-react'
import { get, post, put } from '../lib/api'
import { useMeta } from '../lib/meta'
import { useToast } from '../lib/toast'
import { Badge, Empty, ErrorBox, Loading, Modal, PageHeader, useDialogs } from '../ui/kit'
import { RefSelect } from '../components/RefSelect'
import { PdfDownload, DocumentPrinter } from '../components/ui/document-printer'
import { EmailPdfDialog } from './EntityPages'
import { Letterhead } from '../print/PrintPage'
import { RichEditor, type RichEditorHandle } from '../studio/RichEditor'
import { safeHtml } from '../studio/safe-html'
import { fillPlaceholder as fillInHtml, listPlaceholders, markPlaceholders, mergeCompanyTokens } from '@shared/studio-html'
import { STUDIO_CATEGORIES, STUDIO_STATUS } from '@shared/entities/studio'
import { cls, fmtDate, todayIso } from '../lib/format'

interface Tpl { id: number; code: string; title: string; category: string; kind: string; description?: string; tags?: string; orientation: string; letterhead: boolean; is_system: boolean; active: boolean }

const ACCOUNTING_HINT: Record<string, { text: string; to: string; label: string }> = {
  'ELV-023': { text: 'This is a blank form. To issue an invoice that is numbered, posted to accounts and tracked for payment, create it in Accounts.', to: '/finance/new-invoice', label: 'Create an invoice' },
  'ELV-024': { text: 'To issue a service invoice that posts to accounts and tracks payment, create it in Accounts. You do not need a job.', to: '/finance/new-invoice', label: 'Create an invoice' },
  'ELV-025': { text: 'To issue a numbered pro forma invoice, create it in Accounts and choose Proforma Invoice.', to: '/finance/new-invoice', label: 'Create an invoice' },
  'ELV-027': { text: 'Credit notes that reduce what a customer owes are issued from the original invoice in Accounts.', to: '/e/invoices', label: 'Open invoices' },
  'ELV-029': { text: 'Receipts that settle invoices are recorded in Accounts so the balance updates.', to: '/e/receipts', label: 'Open receipts' },
  'ELV-031': { text: 'The customer statement in Accounts is calculated from the ledger. Open the customer and choose Statement of account.', to: '/e/parties', label: 'Open customers' },
}

export function StudioHome() {
  const { me, can, meta } = useMeta(); const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient()
  const [search, setSearch] = useState(''), [cat, setCat] = useState('All'), [kind, setKind] = useState('All'), [preview, setPreview] = useState<Tpl | null>(null), [ask, setAsk] = useState(''), [busy, setBusy] = useState(false)
  const tpl = useQuery({ queryKey: ['studio', 'templates'], queryFn: () => get<{ rows: Tpl[] }>('/api/e/doc_templates', { pageSize: 500, sort: 'code', dir: 'asc' }) })
  const recent = useQuery({ queryKey: ['studio', 'recent'], queryFn: () => get<{ rows: any[] }>('/api/e/studio_documents', { pageSize: 8, sort: 'updated_at', dir: 'desc' }) })
  const rows = (tpl.data?.rows ?? []).filter(t => t.active)
  const cats = useMemo(() => { const m = new Map<string, number>(); for (const t of rows) m.set(t.category, (m.get(t.category) ?? 0) + 1); return [...m.entries()].sort((a, b) => STUDIO_CATEGORIES.indexOf(a[0]) - STUDIO_CATEGORIES.indexOf(b[0])) }, [rows.length])  // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = useMemo(() => ['All', ...new Set(rows.map(t => t.kind))], [rows.length])  // eslint-disable-line react-hooks/exhaustive-deps
  const needle = search.trim().toLowerCase()
  const shown = rows.filter(t => (cat === 'All' || t.category === cat) && (kind === 'All' || t.kind === kind) && (!needle || `${t.code} ${t.title} ${t.description ?? ''} ${t.tags ?? ''}`.toLowerCase().includes(needle)))
  if (me?.party_id) return <ErrorBox error={new Error('The Document Studio is for company staff.')} />
  const create = async (body: any, query = '') => {
    setBusy(true)
    try { const d = await post<any>('/api/studio/documents', body); void qc.invalidateQueries({ queryKey: ['studio'] }); nav(`/studio/${d.id}${query}`) } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fade-in">
      <PageHeader icon={<FilePenLine size={20} />} title="Document Studio" subtitle="Every company document, ready to fill in. Pick a template, edit or paste your text, let AI write it, then print or save as PDF."
        actions={<>{can('finance', 'create') && <Link className="btn outline" to="/finance/new-invoice"><ReceiptText /> New invoice (no job needed)</Link>}{can('documents', 'create') && <button className="btn green" disabled={busy} onClick={() => void create({ title: 'Untitled document' })}><FileText /> Blank document</button>}</>} />
      {can('documents', 'create') && <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-2"><Sparkles size={18} className="text-emerald" /><b>Describe the document you need</b></div>
        <div className="flex gap-2 flex-wrap"><input className="input flex-1 min-w-[240px]" value={ask} maxLength={1000} onChange={e => setAsk(e.target.value)} placeholder="e.g. A letter asking MAM Trading Group to settle invoice ES101, due 4 September" aria-label="Describe the document you need" onKeyDown={e => { if (e.key === 'Enter' && ask.trim()) void create({ title: ask.trim().slice(0, 80) }, `?ai=${encodeURIComponent(ask.trim())}`) }} />
          <button className="btn green" disabled={busy || !ask.trim()} onClick={() => void create({ title: ask.trim().slice(0, 80) }, `?ai=${encodeURIComponent(ask.trim())}`)}><Wand2 /> Write it with AI</button></div>
        <div className="text-xs text-muted mt-1.5">AI drafts the text; you check and edit it before it is used. It never sends anything. Needs an AI provider under Administration → Integrations.</div>
      </div>}
      {(recent.data?.rows.length ?? 0) > 0 && <div className="mb-5"><div className="flex items-center gap-3 mb-2"><h2 className="m-0 text-[16px] font-bold">Continue where you left off</h2><Link to="/e/studio_documents" className="text-sm">All saved documents</Link></div>
        <div className="studio-gallery">{recent.data!.rows.slice(0, 4).map(d => <Link key={d.id} to={`/studio/${d.id}`} className="studio-card" style={{ textDecoration: 'none', color: 'inherit' }}><div className="flex items-center gap-2"><Badge value={d.status} /><span className="text-xs text-muted">{d.doc_no}</span></div><h3>{d.title}</h3><p>{d._labels?.party_id ? `${d._labels.party_id} · ` : ''}updated {fmtDate(d.updated_at)}</p></Link>)}</div></div>}
      <div className="flex gap-2 flex-wrap items-center mb-3">
        <div className="relative flex-1 min-w-[220px] max-w-[420px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input" style={{ paddingLeft: 34 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${rows.length || ''} templates`} aria-label="Search templates" /></div>
        <select className="select" style={{ width: 'auto' }} value={kind} onChange={e => setKind(e.target.value)} aria-label="Type">{kinds.map(k => <option key={k} value={k}>{k === 'All' ? 'All types' : k}</option>)}</select>
        <Link className="btn ghost sm" to="/e/doc_templates">Manage templates</Link>
      </div>
      <div className="flex gap-2 flex-wrap mb-4" role="group" aria-label="Categories"><button className="studio-chip" aria-pressed={cat === 'All'} onClick={() => setCat('All')}>All ({rows.length})</button>{cats.map(([c, n]) => <button key={c} className="studio-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c} ({n})</button>)}</div>
      {tpl.error ? <ErrorBox error={tpl.error} onRetry={() => void tpl.refetch()} /> : !tpl.data ? <Loading /> : shown.length === 0 ? <Empty title="No template matches" hint="Try another word, or start from a blank document." /> :
        <div className="studio-gallery">{shown.map(t => <div key={t.id} className="studio-card">
          <div className="flex items-center gap-2 flex-wrap"><Badge value={t.kind} tone="teal" /><span className="text-xs text-muted">{t.code}</span>{!t.is_system && <Badge value="Own" tone="violet" />}</div>
          <h3>{t.title}</h3><p>{t.description}</p>
          <div className="text-xs text-muted">{t.category}{t.orientation === 'Landscape' ? ' · landscape' : ''}</div>
          <div className="flex gap-2 mt-auto pt-2"><button className="btn green sm flex-1" disabled={busy || !can('documents', 'create')} onClick={() => void create({ template_id: t.id })}>Use template</button><button className="btn outline sm" onClick={() => setPreview(t)} aria-label={`Preview ${t.title}`}><Eye /> Preview</button></div>
        </div>)}</div>}
      <TemplatePreview tpl={preview} settings={meta?.settings ?? {}} onClose={() => setPreview(null)} onUse={t => { setPreview(null); void create({ template_id: t.id }) }} />
    </div>
  )
}

function TemplatePreview({ tpl, settings, onClose, onUse }: { tpl: Tpl | null; settings: Record<string, any>; onClose: () => void; onUse: (t: Tpl) => void }) {
  const { can } = useMeta()
  const full = useQuery({ queryKey: ['studio', 'template', tpl?.id], enabled: !!tpl, queryFn: () => get<any>(`/api/e/doc_templates/${tpl!.id}`) })
  const hint = tpl ? ACCOUNTING_HINT[tpl.code] : undefined
  return (
    <Modal open={!!tpl} onClose={onClose} width={900} title={tpl ? `${tpl.code} · ${tpl.title}` : ''} footer={tpl && <><Link className="btn ghost" to="/e/doc_templates" onClick={onClose}>Manage templates</Link><div className="flex-1" /><button className="btn outline" onClick={onClose}>Close</button>{can('documents', 'create') && <button className="btn green" onClick={() => onUse(tpl)}>Use template</button>}</>}>
      {hint && <div className="mb-3 rounded-xl border border-line bg-hover px-3 py-2 text-sm">{hint.text} <Link to={hint.to} onClick={onClose}>{hint.label}</Link></div>}
      {!full.data ? <Loading /> : <div className="studio-stage" style={{ maxHeight: '60vh' }}><div className={cls('studio-paper', tpl?.orientation === 'Landscape' && 'landscape')} style={{ zoom: 0.8 }}>{tpl?.letterhead && <Letterhead />}<div className="studio-content" dangerouslySetInnerHTML={{ __html: safeHtml(mergeCompanyTokens(full.data.content ?? '', settings, todayIso())) }} /></div></div>}
    </Modal>
  )
}

const AI_TASKS: { key: string; label: string; icon: any }[] = [
  { key: 'improve', label: 'Improve', icon: Wand2 }, { key: 'shorten', label: 'Shorten', icon: Scissors }, { key: 'expand', label: 'Expand', icon: Expand }, { key: 'formal', label: 'More formal', icon: Wand2 },
  { key: 'friendly', label: 'Friendlier', icon: Wand2 }, { key: 'proofread', label: 'Proofread', icon: SpellCheck },
]
const LANGUAGES = ['Arabic', 'English', 'Hindi', 'Urdu', 'French', 'Chinese (Simplified)', 'Russian', 'Spanish', 'Turkish']

export function StudioEditor() {
  const { id = '' } = useParams(); const [sp, setSp] = useSearchParams(); const nav = useNavigate(); const qc = useQueryClient()
  const { can, me, meta } = useMeta(); const toast = useToast(); const dlg = useDialogs()
  const doc = useQuery({ queryKey: ['studio', 'doc', id], queryFn: () => get<any>(`/api/e/studio_documents/${id}`), refetchOnWindowFocus: false })
  const editor = useRef<RichEditorHandle>(null)
  const [f, setF] = useState<any>(null), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [html, setHtml] = useState(''), [selChars, setSelChars] = useState(0)
  const [aiAsk, setAiAsk] = useState(''), [aiLang, setAiLang] = useState('Arabic'), [aiBusy, setAiBusy] = useState<string | null>(null), [aiOut, setAiOut] = useState<{ html: string; scope: 'selection' | 'document'; task: string } | null>(null), [aiErr, setAiErr] = useState('')
  const [email, setEmail] = useState(false), [fillBusy, setFillBusy] = useState(false), [vals, setVals] = useState<Record<string, string>>({})
  const version = useRef(0), htmlRef = useRef(''), aiUsed = useRef(false), startedAi = useRef(false)

  useEffect(() => { if (doc.data && !f) { setF(doc.data); setHtml(doc.data.content ?? ''); htmlRef.current = doc.data.content ?? ''; version.current = doc.data.version } }, [doc.data, f])
  const locked = f?.status === 'Issued' || f?.status === 'Cancelled'
  const canEdit = can('documents', 'edit') && !locked
  const set = (patch: Record<string, any>) => { setF((x: any) => ({ ...x, ...patch })); setDirty(true) }
  const onChange = useCallback((h: string) => { htmlRef.current = h; setHtml(h); setDirty(true) }, [])

  const save = useCallback(async (quiet = false): Promise<boolean> => {
    if (!f || !canEdit) return true
    setSaving(true)
    try {
      const r = await put<any>(`/api/e/studio_documents/${f.id}`, { title: f.title, category: f.category, status: f.status, party_id: f.party_id ?? null, job_id: f.job_id ?? null, orientation: f.orientation, letterhead: f.letterhead, page_numbers: f.page_numbers, footer_text: f.footer_text ?? null, doc_date: f.doc_date ?? null, notes: f.notes ?? null, ai_assisted: !!f.ai_assisted || aiUsed.current, content: htmlRef.current, version: version.current })
      version.current = r.version; setDirty(false); setF((x: any) => ({ ...x, version: r.version, doc_no: r.doc_no, _labels: r._labels, ai_assisted: r.ai_assisted }))
      void qc.invalidateQueries({ queryKey: ['studio', 'recent'] }); if (!quiet) toast.ok('Saved')
      return true
    } catch (e: any) { toast.error(e.message); return false } finally { setSaving(false) }
  }, [f, canEdit, qc, toast])

  // autosave a few seconds after the last change
  useEffect(() => { if (!dirty || !canEdit) return; const t = window.setTimeout(() => void save(true), 4000); return () => window.clearTimeout(t) }, [dirty, html, f, canEdit, save])
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h) }, [dirty])
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save() } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [save])

  const placeholders = useMemo(() => listPlaceholders(html), [html])
  const runAi = useCallback(async (action: string, extra: { request?: string; language?: string } = {}) => {
    if (!f) return
    const selected = action === 'draft' || action === 'fill' ? '' : (editor.current?.selectionHtml() ?? '')
    const whole = !selected
    setAiBusy(action); setAiErr(''); setAiOut(null)
    try {
      const r = await post<{ html: string }>('/api/studio/ai', { action, request: extra.request ?? aiAsk, html: action === 'draft' ? htmlRef.current : (selected || htmlRef.current), title: f.title, kind: f.category, language: extra.language ?? 'English', whole })
      aiUsed.current = true
      setAiOut({ html: r.html, scope: whole ? 'document' : 'selection', task: action })
    } catch (e: any) { setAiErr(e.message) } finally { setAiBusy(null) }
  }, [f, aiAsk])

  // arriving from the Studio home with a request: draft straight away
  useEffect(() => { const ask = sp.get('ai'); if (f && ask && !startedAi.current) { startedAi.current = true; setAiAsk(ask); setSp({}, { replace: true }); void runAi('draft', { request: ask }) } }, [f, sp, setSp, runAi])

  const applyAi = (mode: 'replace' | 'insert') => {
    if (!aiOut) return
    if (mode === 'replace' && aiOut.scope === 'document') editor.current?.replaceAll(aiOut.html); else editor.current?.replaceSelection(aiOut.html)
    setAiOut(null); setDirty(true); toast.ok('Added to the document. Check it before you use it.')
  }
  const fillFromRecords = async () => {
    if (!f?.party_id && !f?.job_id) { toast.error('Choose a customer or a job in Details first'); return }
    setFillBusy(true)
    try {
      const r = await get<{ values: Record<string, string> }>('/api/studio/fill-data', { party_id: f.party_id || undefined, job_id: f.job_id || undefined })
      let n = 0
      for (const ph of listPlaceholders(htmlRef.current)) { const v = r.values[ph.slice(1, -1).trim().toLowerCase()]; if (v) n += editor.current?.fillPlaceholder(ph, v) ? 1 : 0 }
      toast.ok(n ? `Filled ${n} field${n === 1 ? '' : 's'} from the records. Check each one.` : 'Nothing in this document matched the selected records.')
    } catch (e: any) { toast.error(e.message) } finally { setFillBusy(false) }
  }
  const fillOne = (ph: string) => { const v = (vals[ph] ?? '').trim(); if (!v) return; editor.current?.fillPlaceholder(ph, v); setVals(x => { const n = { ...x }; delete n[ph]; return n }) }

  const goPrint = async () => { if (await save(true)) nav(`/print/studio_documents/${f.id}`) }
  const issue = async () => {
    if (placeholders.length && !(await dlg.confirm({ title: `${placeholders.length} field${placeholders.length === 1 ? ' is' : 's are'} still empty`, message: 'Empty [fields] will print as they are. Issue anyway?', ok: 'Issue anyway' }))) return
    if (!(await dlg.confirm({ title: 'Mark as issued?', message: 'An issued document is locked. To change it later, duplicate it.', ok: 'Mark issued' }))) return
    set({ status: 'Issued' }); window.setTimeout(() => void save(true).then(() => qc.invalidateQueries({ queryKey: ['studio', 'doc', id] })), 0)
  }

  if (me?.party_id) return <ErrorBox error={new Error('The Document Studio is for company staff.')} />
  if (doc.error) return <ErrorBox error={doc.error} onRetry={() => void doc.refetch()} />
  if (!f) return <Loading />
  const hasAi = can('documents', 'create')
  return (
    <div className="fade-in">
      <PageHeader back={<Link className="btn grey" to="/studio"><ArrowLeft /> Studio</Link>} icon={<FileText size={20} />} title={<span className="flex items-center gap-3 flex-wrap">{f.title || 'Untitled'}<Badge value={f.status} />{dirty ? <span className="text-xs text-muted font-normal">Unsaved changes</span> : <span className="text-xs text-muted font-normal inline-flex items-center gap-1"><CheckCircle2 size={13} /> Saved</span>}</span>}
        subtitle={`${f.doc_no}${f._labels?.template_id ? ` · from ${f._labels.template_id}` : ''}`}
        actions={<>
          {canEdit && <button className="btn green" disabled={saving || !dirty} onClick={() => void save()}><Save /> {saving ? 'Saving…' : 'Save'}</button>}
          <button className="btn outline" onClick={() => void goPrint()}><Printer /> Print / preview</button>
          <PdfDownload entity="studio_documents" id={f.id} />
          {can('documents', 'edit') && <button className="btn outline" onClick={() => void save(true).then(ok => ok && setEmail(true))}><Mail /> E-mail</button>}
        </>} />
      {locked && <div className="mb-3 rounded-xl border border-line bg-hover px-4 py-2.5 text-sm">This document is {f.status.toLowerCase()} and cannot be edited. <button className="btn sm outline ml-2" onClick={async () => { try { const d = await post<any>(`/api/studio/documents/${f.id}/duplicate`); nav(`/studio/${d.id}`); window.location.reload() } catch (e: any) { toast.error(e.message) } }}><Copy /> Duplicate to edit</button></div>}
      <div className="studio-shell">
        <div className="min-w-0">
          <RichEditor ref={editor} value={f.content ?? ''} onChange={onChange} readOnly={!canEdit} landscape={f.orientation === 'Landscape'} onSelection={setSelChars}
            paperTop={f.letterhead ? <Letterhead /> : undefined} paperBottom={f.footer_text ? <div className="studio-content muted small" style={{ marginTop: 18, paddingTop: 8, borderTop: '1px solid #dfe6e1', textAlign: 'center' }}>{f.footer_text}</div> : undefined} />
        </div>
        <aside className="studio-side" aria-label="Document tools">
          <section className="card">
            <h3>Details</h3>
            <div className="grid gap-2.5">
              <div><label className="label" htmlFor="sd-title">Title</label><input id="sd-title" className="input" value={f.title ?? ''} disabled={!canEdit} maxLength={200} onChange={e => set({ title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="sd-cat">Category</label><select id="sd-cat" className="select" value={f.category ?? 'Other'} disabled={!canEdit} onChange={e => set({ category: e.target.value })}>{STUDIO_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="label" htmlFor="sd-status">Status</label><select id="sd-status" className="select" value={f.status} disabled={!canEdit} onChange={e => e.target.value === 'Issued' ? void issue() : set({ status: e.target.value })}>{STUDIO_STATUS.filter(s => s !== 'Cancelled' || f.status === 'Cancelled').map(s => <option key={s}>{s}</option>)}</select></div></div>
              <div><label className="label">Customer</label><RefSelect entity="parties" value={f.party_id} label={f._labels?.party_id} disabled={!canEdit || !can('crm', 'view')} onChange={(v, l) => set({ party_id: v, _labels: { ...f._labels, party_id: l } })} /></div>
              <div><label className="label">Job</label><RefSelect entity="jobs" value={f.job_id} label={f._labels?.job_id} disabled={!canEdit || !can('jobs', 'view')} onChange={(v, l) => set({ job_id: v, _labels: { ...f._labels, job_id: l } })} /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="sd-date">Document date</label><input id="sd-date" type="date" className="input" value={f.doc_date ?? ''} disabled={!canEdit} onChange={e => set({ doc_date: e.target.value })} /></div>
                <div><label className="label" htmlFor="sd-or">Page</label><select id="sd-or" className="select" value={f.orientation} disabled={!canEdit} onChange={e => set({ orientation: e.target.value })}><option>Portrait</option><option>Landscape</option></select></div></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={!!f.letterhead} disabled={!canEdit} onChange={e => set({ letterhead: e.target.checked })} /> Company letterhead</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={!!f.page_numbers} disabled={!canEdit} onChange={e => set({ page_numbers: e.target.checked })} /> Page numbers in the PDF</label>
              <div><label className="label" htmlFor="sd-foot">Footer line (every page of the PDF)</label><input id="sd-foot" className="input" value={f.footer_text ?? ''} disabled={!canEdit} maxLength={200} placeholder="e.g. Confidential" onChange={e => set({ footer_text: e.target.value })} /></div>
            </div>
          </section>
          <section className="card">
            <h3>Fields to fill {placeholders.length > 0 && <Badge value={String(placeholders.length)} tone="amber" />}</h3>
            <div className="flex gap-2 mb-2 flex-wrap"><button className="btn outline sm" disabled={!canEdit || fillBusy} onClick={() => void fillFromRecords()}><Users /> Fill from customer / job</button></div>
            {placeholders.length === 0 ? <p className="text-sm text-muted m-0">No empty [fields] left.</p> : <ul className="m-0 p-0 grid gap-2" style={{ listStyle: 'none', maxHeight: 260, overflow: 'auto' }}>{placeholders.slice(0, 40).map(ph => <li key={ph} className="flex gap-1.5 items-center">
              <button className="btn ghost sm" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', justifyContent: 'flex-start' }} title={`Find ${ph} in the document`} onClick={() => editor.current?.selectPlaceholder(ph)}>{ph}</button>
              <input className="input" style={{ minHeight: 30, padding: '2px 8px' }} aria-label={`Value for ${ph}`} disabled={!canEdit} value={vals[ph] ?? ''} onChange={e => setVals(x => ({ ...x, [ph]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') fillOne(ph) }} />
              <button className="btn outline sm" disabled={!canEdit || !(vals[ph] ?? '').trim()} onClick={() => fillOne(ph)}>Fill</button></li>)}</ul>}
            {placeholders.length > 40 && <p className="text-xs text-muted mb-0">Showing the first 40 of {placeholders.length}.</p>}
          </section>
          {hasAi && <section className="card">
            <h3 className="flex items-center gap-1.5"><Sparkles size={16} className="text-emerald" /> AI writing</h3>
            <label className="label" htmlFor="sd-ai">Tell the AI what you need</label>
            <textarea id="sd-ai" className="textarea" rows={4} maxLength={4000} value={aiAsk} disabled={!canEdit || !!aiBusy} onChange={e => setAiAsk(e.target.value)} placeholder="e.g. Write a firm but polite payment reminder for invoice DXB/IMP/ES101, AED 86,258.00, due 4 September 2026." />
            <div className="flex gap-2 flex-wrap mt-2"><button className="btn green sm" disabled={!canEdit || !!aiBusy || !aiAsk.trim()} onClick={() => void runAi('draft')}>{aiBusy === 'draft' ? 'Writing…' : <><Wand2 /> Write document</>}</button>
              <button className="btn outline sm" disabled={!canEdit || !!aiBusy || !aiAsk.trim() || !placeholders.length} title="Keep this template and fill the [fields] from your notes" onClick={() => void runAi('fill')}>{aiBusy === 'fill' ? 'Working…' : 'Fill fields from notes'}</button></div>
            <div className="text-xs text-muted mt-3 mb-1.5">{selChars ? `Works on your selection (${selChars} characters)` : 'Works on the whole document. Select text first to change only that part.'}</div>
            <div className="flex gap-1.5 flex-wrap">{AI_TASKS.map(t => <button key={t.key} className="btn outline sm" disabled={!canEdit || !!aiBusy} onClick={() => void runAi(t.key)}>{aiBusy === t.key ? 'Working…' : <><t.icon />{t.label}</>}</button>)}</div>
            <div className="flex gap-1.5 mt-2"><select className="select" style={{ flex: 1 }} value={aiLang} onChange={e => setAiLang(e.target.value)} aria-label="Translate to">{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select><button className="btn outline sm" disabled={!canEdit || !!aiBusy} onClick={() => void runAi('translate', { language: aiLang })}>{aiBusy === 'translate' ? 'Working…' : <><Languages />Translate</>}</button></div>
            {aiErr && <div role="alert" className="mt-3 p-2.5 rounded-lg border border-[#f2bcc3] bg-blush text-[#8f1325] text-sm">{aiErr} {aiErr.includes('Integrations') && can('admin', 'view') && <Link to="/admin/integrations">Open integrations</Link>}</div>}
            {aiOut && <div className="mt-3"><div className="text-xs text-muted mb-1">AI draft – check it before you use it{aiOut.scope === 'selection' ? ' (replaces your selection)' : ''}</div>
              <div className="studio-ai-result studio-content" dangerouslySetInnerHTML={{ __html: safeHtml(aiOut.html) }} />
              <div className="flex gap-2 mt-2 flex-wrap"><button className="btn green sm" onClick={() => applyAi('replace')}>{aiOut.scope === 'selection' ? 'Replace selection' : 'Replace document'}</button><button className="btn outline sm" onClick={() => applyAi('insert')}>Insert at cursor</button><button className="btn ghost sm" onClick={() => setAiOut(null)}>Discard</button></div></div>}
            <p className="text-xs text-muted mb-0 mt-3">AI can make mistakes. Check names, amounts, dates and legal wording.</p>
          </section>}
          <section className="card">
            <h3>More</h3>
            <div className="flex gap-2 flex-wrap">
              <button className="btn outline sm" disabled={!can('documents', 'create')} onClick={async () => { try { const d = await post<any>(`/api/studio/documents/${f.id}/duplicate`); toast.ok('Duplicated'); nav(`/studio/${d.id}`); window.location.reload() } catch (e: any) { toast.error(e.message) } }}><Copy /> Duplicate</button>
              <button className="btn outline sm" disabled={!can('documents', 'create')} onClick={async () => { const t = await dlg.prompt({ title: 'Save as template', label: 'Template name', initial: f.title, required: true, ok: 'Save template' }); if (!t) return; try { if (dirty) await save(true); await post(`/api/studio/documents/${f.id}/save-as-template`, { title: t }); void qc.invalidateQueries({ queryKey: ['studio', 'templates'] }); toast.ok('Saved to the template library') } catch (e: any) { toast.error(e.message) } }}>Save as template</button>
              {canEdit && f.status !== 'Issued' && <button className="btn outline sm" onClick={() => void issue()}><CheckCircle2 /> Mark issued</button>}
              <Link className="btn ghost sm" to={`/e/studio_documents/${f.id}`}>History &amp; files</Link>
            </div>
            <div className="mt-2"><label className="label" htmlFor="sd-notes">Internal notes (not printed)</label><textarea id="sd-notes" className="textarea" rows={2} value={f.notes ?? ''} disabled={!canEdit} onChange={e => set({ notes: e.target.value })} /></div>
          </section>
        </aside>
      </div>
      {email && <EmailPdfDialog entity="studio_documents" rec={{ ...f, party_id: f.party_id }} onClose={() => setEmail(false)} />}
      {saving && <DocumentPrinter label="Saving…" />}
    </div>
  )
}

/** The document as printed: used by the print page and the PDF export. */
export function StudioDoc({ r, seal, sealImage }: { r: any; seal: boolean; sealImage?: string }) {
  const { meta } = useMeta()
  const body = useMemo(() => safeHtml(mergeCompanyTokens(r.content ?? '', meta?.settings ?? {}, todayIso())), [r.content, meta?.settings])
  return <>
    {r.orientation === 'Landscape' && <style>{'@page { size: A4 landscape; }'}</style>}
    <div className="studio-content" dangerouslySetInnerHTML={{ __html: body }} />
    {(r.footer_text || (seal && sealImage)) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginTop: 20, paddingTop: 10, borderTop: '1px solid #dfe6e1', fontSize: 10, color: '#444' }}><span>{r.footer_text}</span>{seal && sealImage && <img className="document-seal" src={sealImage} alt="Company seal" />}</div>}
  </>
}
void fillInHtml; void markPlaceholders; void Briefcase
