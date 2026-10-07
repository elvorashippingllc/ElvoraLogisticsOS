import { AccountCarousel } from './ui/account-card'
import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Upload, Filter, RefreshCw, Trash2, ArrowUp, ArrowDown, Columns3, Table2, X } from 'lucide-react'
import type { FieldDef } from '@shared/types'
import { optValue } from '@shared/types'
import { useMeta, type MetaEntity } from '../lib/meta'
import { get, post, put, downloadUrl } from '../lib/api'
import { CellValue } from './Fields'
import { EntityFormModal } from './EntityForm'
import { Badge, Empty, ErrorBox, Modal, PageHeader, Pagination, useDialogs, Loading } from '../ui/kit'
import { iconByName } from '../lib/icons'
import { useToast } from '../lib/toast'
import { cls, fmtMoney } from '../lib/format'

export const recordPath = (entity: string, id: number) => (entity === 'jobs' ? `/jobs/${id}` : `/e/${entity}/${id}`)

interface Flt { field: string; op: string; value: string }
const OPS: Record<string, [string, string][]> = {
  text: [['contains', 'contains'], ['eq', 'equals'], ['starts', 'starts with'], ['ends', 'ends with'], ['null', 'is empty'], ['notnull', 'is not empty']],
  num: [['eq', '='], ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['between', 'between (a..b)']],
  date: [['eq', 'on'], ['gte', 'on or after'], ['lte', 'on or before'], ['between', 'between (a..b)'], ['null', 'is empty']],
  select: [['eq', 'is'], ['ne', 'is not'], ['null', 'is empty']],
  bool: [['eq', 'is']],
  ref: [['contains', 'name contains'], ['null', 'is empty'], ['notnull', 'is set']],
}
const opKind = (f: FieldDef) => (['int', 'number', 'money', 'percent'].includes(f.type) ? 'num' : f.type === 'date' || f.type === 'datetime' ? 'date' : f.type === 'select' ? 'select' : f.type === 'bool' ? 'bool' : f.type === 'ref' ? 'ref' : 'text')

export function listColumns(def: MetaEntity): FieldDef[] {
  const l = def.fields.filter(f => f.list && !f.secret)
  return (l.length ? l : def.fields.filter(f => !f.hidden && !f.secret && f.type !== 'json' && f.type !== 'textarea').slice(0, 6)).slice(0, 9)
}

export function EntityList({ entity, preset, embedded, title, hideNew, createPresets, bulkActions, headerExtra, onOpen, pageSizeDefault = 25 }: { entity: string; preset?: { field: string; op: string; value: any }[]; embedded?: boolean; title?: ReactNode; hideNew?: boolean; createPresets?: Record<string, any>; bulkActions?: { label: ReactNode; run: (ids: number[]) => void | Promise<void> }[]; headerExtra?: ReactNode; onOpen?: (rec: any) => void; pageSizeDefault?: number }) {
  const { def: getDef, can } = useMeta()
  const def = getDef(entity)
  const nav = useNavigate(), qc = useQueryClient(), toast = useToast(), dlg = useDialogs()
  const [sp, setSp] = useSearchParams()
  const [local, setLocal] = useState<Record<string, string>>({})
  const param = (k: string) => (embedded ? local[k] : sp.get(k)) ?? ''
  const setParam = (patch: Record<string, string | null>) => {
    if (embedded) setLocal(l => ({ ...l, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? ''])) }))
    else setSp(p => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) { if (v === null || v === '') n.delete(k); else n.set(k, v) } return n }, { replace: true })
  }
  const page = Number(param('page')) || 1, size = Number(param('size')) || pageSizeDefault
  const sort = param('sort') || def.defaultSort?.field || 'id', dir = param('dir') || def.defaultSort?.dir || 'desc'
  const [search, setSearch] = useState(param('q'))
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const filters: Flt[] = useMemo(() => { try { return param('filters') ? JSON.parse(param('filters')) : [] } catch { return [] } }, [param('filters')])
  const status = param('status')
  useEffect(() => { const t = setTimeout(() => { if (search !== param('q')) setParam({ q: search, page: null }) }, 280); return () => clearTimeout(t) }, [search])

  const allFilters = [...(preset ?? []), ...filters.filter(f => f.field && (f.value !== '' || ['null', 'notnull'].includes(f.op))), ...(status && def.statusField ? [{ field: def.statusField, op: 'eq', value: status }] : [])]
  const params = { q: param('q'), page, pageSize: view === 'kanban' ? 200 : size, sort, dir, filters: allFilters.length ? JSON.stringify(allFilters) : undefined }
  const query = useQuery({ queryKey: ['list', entity, params], queryFn: () => get<{ rows: any[]; total: number }>(`/api/e/${entity}`, params), placeholderData: p => p })
  const cols = listColumns(def)
  const Icon = iconByName(def.icon)
  const canCreate = can(def.module, 'create') && !def.readonlyApi && !hideNew
  const statusOpts = def.statusField ? (def.fields.find(f => f.name === def.statusField)?.options ?? []).map(optValue) : []
  const rows = query.data?.rows ?? []
  const refresh = () => qc.invalidateQueries({ queryKey: ['list', entity] })
  const open = (r: any) => (onOpen ? onOpen(r) : nav(recordPath(entity, r.id)))
  const allSel = rows.length > 0 && rows.every(r => selected.has(r.id))

  const runBulk = async (kind: 'delete' | 'status', value?: string) => {
    const ids = [...selected]
    if (kind === 'delete' && !(await dlg.confirm({ title: `Delete ${ids.length} ${ids.length === 1 ? def.label : def.plural}?`, message: 'This cannot be undone. Records that are in use will be skipped.', danger: true, ok: 'Delete' }))) return
    try {
      const r = await post<{ ok: number; failed: { id: number; error: string }[] }>(`/api/e/${entity}/bulk`, kind === 'delete' ? { ids, action: 'delete' } : { ids, action: 'set', field: def.statusField, value })
      if (r.failed.length) toast.error(`${r.ok} done, ${r.failed.length} skipped: ${r.failed[0].error}`); else toast.ok(`${r.ok} updated`)
      setSelected(new Set()); refresh()
    } catch (e: any) { toast.error(e.message) }
  }

  const SortIcon = ({ f }: { f: FieldDef }) => (sort === f.name ? (dir === 'asc' ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />) : null)

  const content = (
    <div className={cls(!embedded && 'fade-in')}>
      {!embedded && (
        <PageHeader icon={<Icon size={20} />} title={title ?? def.plural} subtitle={def.description ?? `${(query.data?.total ?? 0).toLocaleString()} records`} actions={<>
          {headerExtra}
          {can(def.module, 'export') && <a className="btn outline" href={downloadUrl(`/api/e/${entity}/export.csv`, { q: param('q'), filters: allFilters.length ? JSON.stringify(allFilters) : undefined, sort, dir })}><Download /> Export</a>}
          {canCreate && !def.children?.length && <button className="btn outline" onClick={() => setShowImport(true)}><Upload /> Import</button>}
          {canCreate && <button className="btn green" onClick={() => setEditing('new')}><Plus /> New {def.label}</button>}
        </>} />
      )}
      {entity === 'bank_accounts' && !embedded && !query.error && <AccountCarousel def={def} rows={rows} />}
      <div className="entity-surface card overflow-hidden">
        <div className="flex items-center gap-2 p-3 flex-wrap border-b border-line">
          <div className="relative flex-1 min-w-[200px] max-w-[420px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder={`Search ${def.plural.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} aria-label="Search" /></div>
          {statusOpts.length > 0 && <select className="select" style={{ width: 170 }} value={status} onChange={e => setParam({ status: e.target.value, page: null })} aria-label="Status filter"><option value="">All statuses</option>{statusOpts.map(o => <option key={o}>{o}</option>)}</select>}
          <button className={cls('btn outline', filters.length > 0 && 'ring-2 ring-emerald/40')} onClick={() => setShowFilters(s => !s)}><Filter /> Filters{filters.length ? ` (${filters.length})` : ''}</button>
          {def.kanban && <div className="flex gap-1"><button className={cls('btn sm', view === 'list' ? 'dark' : 'outline')} onClick={() => setView('list')}><Table2 /> List</button><button className={cls('btn sm', view === 'kanban' ? 'dark' : 'outline')} onClick={() => setView('kanban')}><Columns3 /> Board</button></div>}
          <div className="flex-1" />
          <button className="btn ghost icon" onClick={refresh} aria-label="Refresh"><RefreshCw className={query.isFetching ? 'animate-spin' : ''} /></button>
          {embedded && canCreate && <button className="btn green sm" onClick={() => setEditing('new')}><Plus /> New</button>}
        </div>
        {showFilters && <FilterBuilder def={def} value={filters} onApply={f => { setParam({ filters: f.length ? JSON.stringify(f) : null, page: null }); setShowFilters(false) }} />}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-mint text-fold text-sm font-semibold flex-wrap"><span>{selected.size} selected</span>
            {bulkActions?.map((b, i) => <button key={i} className="btn sm dark" onClick={() => void b.run([...selected])}>{b.label}</button>)}
            {statusOpts.length > 0 && can(def.module, 'edit') && <select className="select" style={{ width: 170, minHeight: 30 }} value="" onChange={e => { if (e.target.value) void runBulk('status', e.target.value) }}><option value="">Set {def.statusField?.replace(/_/g, ' ')}…</option>{statusOpts.map(o => <option key={o}>{o}</option>)}</select>}
            {can(def.module, 'delete') && !def.noDelete && <button className="btn sm red" onClick={() => void runBulk('delete')}><Trash2 /> Delete</button>}
            <button className="btn sm ghost" onClick={() => setSelected(new Set())}><X /> Clear</button></div>)}
        {query.error ? <ErrorBox error={query.error} onRetry={() => void query.refetch()} /> : !query.data ? <Loading /> : view === 'kanban' && def.kanban ? (
          <Kanban def={def} rows={rows} onOpen={open} onMoved={refresh} />
        ) : rows.length === 0 ? (
          <Empty title={param('q') || filters.length || status ? 'Nothing matches your search' : `No ${def.plural.toLowerCase()} yet`} hint={param('q') || filters.length ? 'Try clearing the filters or searching for something else.' : def.description} action={canCreate && !param('q') ? <button className="btn green" onClick={() => setEditing('new')}><Plus /> Create the first {def.label.toLowerCase()}</button> : undefined} />
        ) : (
          <div className="table-wrap" style={{ maxHeight: embedded ? 480 : undefined }}>
            <table className="grid">
              <thead><tr>
                <th style={{ width: 34 }}><input type="checkbox" aria-label="Select all" checked={allSel} onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th>
                {cols.map(f => <th key={f.name} className={cls('sortable', ['money', 'number', 'int', 'percent'].includes(f.type) && 'num')} onClick={() => setParam({ sort: f.name, dir: sort === f.name && dir === 'asc' ? 'desc' : 'asc', page: null })} aria-sort={sort === f.name ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>{f.label}<SortIcon f={f} /></th>)}
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="clickable" onClick={() => open(r)}>
                    <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label="Select row" checked={selected.has(r.id)} onChange={e => setSelected(s => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n })} /></td>
                    {cols.map((f, i) => <td key={f.name} className={['money', 'number', 'int', 'percent'].includes(f.type) ? 'num' : ''}>{i === 0 ? <Link to={recordPath(entity, r.id)} className="link" onClick={e => e.stopPropagation()}><CellValue f={f} rec={r} statusField={def.statusField} /></Link> : <CellValue f={f} rec={r} statusField={def.statusField} />}</td>)}
                  </tr>))}
              </tbody>
              {cols.some(f => f.type === 'money') && rows.length > 1 && <tfoot><tr><td /> {cols.map((f, i) => <td key={f.name} className={f.type === 'money' ? 'num' : ''}>{f.type === 'money' ? fmtMoney(rows.reduce((s, r) => s + (Number(r[f.name]) || 0), 0)) : i === 0 ? 'Page total' : ''}</td>)}</tr></tfoot>}
            </table>
          </div>
        )}
        {view === 'list' && query.data && <Pagination page={page} pageSize={size} total={query.data.total} onPage={p => setParam({ page: String(p) })} onSize={s => setParam({ size: String(s), page: null })} />}
      </div>
      {editing !== null && <EntityFormModal entity={entity} id={editing === 'new' ? undefined : editing} presets={createPresets} onClose={() => setEditing(null)} onSaved={r => { setEditing(null); refresh(); if (editing === 'new' && !embedded) nav(recordPath(entity, r.id)) }} />}
      {showImport && <ImportModal def={def} onClose={() => setShowImport(false)} onDone={() => { refresh(); }} />}
    </div>
  )
  return content
}

function FilterBuilder({ def, value, onApply }: { def: MetaEntity; value: Flt[]; onApply: (f: Flt[]) => void }) {
  const fields = def.fields.filter(f => !f.secret && !f.virtual && f.type !== 'json' && (!f.hidden || f.list))
  const [rows, setRows] = useState<Flt[]>(value.length ? value : [{ field: fields[0]?.name ?? '', op: 'contains', value: '' }])
  const upd = (i: number, p: Partial<Flt>) => setRows(r => r.map((x, k) => (k === i ? { ...x, ...p } : x)))
  return (
    <div className="p-3 bg-soft border-b border-line">
      {rows.map((r, i) => {
        const f = fields.find(x => x.name === r.field)
        const kind = f ? opKind(f) : 'text'
        const ops = OPS[kind]
        return (
          <div key={i} className="flex gap-2 mb-2 flex-wrap items-center">
            <select className="select" style={{ width: 200 }} value={r.field} onChange={e => { const nf = fields.find(x => x.name === e.target.value)!; upd(i, { field: nf.name, op: OPS[opKind(nf)][0][0], value: '' }) }}>{fields.map(x => <option key={x.name} value={x.name}>{x.label}</option>)}</select>
            <select className="select" style={{ width: 170 }} value={r.op} onChange={e => upd(i, { op: e.target.value })}>{ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            {!['null', 'notnull'].includes(r.op) && (kind === 'select' && f ? <select className="select" style={{ width: 200 }} value={r.value} onChange={e => upd(i, { value: e.target.value })}><option value="">Select…</option>{(f.options ?? []).map(o => <option key={optValue(o)}>{optValue(o)}</option>)}</select>
              : kind === 'bool' ? <select className="select" style={{ width: 120 }} value={r.value} onChange={e => upd(i, { value: e.target.value })}><option value="">Select…</option><option value="1">Yes</option><option value="0">No</option></select>
              : <input className="input" style={{ width: 240 }} type={kind === 'date' && r.op !== 'between' ? 'date' : kind === 'num' && r.op !== 'between' ? 'number' : 'text'} placeholder={r.op === 'between' ? 'from..to' : 'Value'} value={r.value} onChange={e => upd(i, { value: e.target.value })} />)}
            <button className="btn ghost icon sm" onClick={() => setRows(x => x.filter((_, k) => k !== i))} aria-label="Remove filter"><X /></button>
          </div>)
      })}
      <div className="flex gap-2"><button className="btn outline sm" onClick={() => setRows(r => [...r, { field: fields[0].name, op: 'contains', value: '' }])}><Plus /> Add condition</button><div className="flex-1" /><button className="btn ghost sm" onClick={() => onApply([])}>Clear</button><button className="btn green sm" onClick={() => onApply(rows)}>Apply</button></div>
    </div>
  )
}

function Kanban({ def, rows, onOpen, onMoved }: { def: MetaEntity; rows: any[]; onOpen: (r: any) => void; onMoved: () => void }) {
  const field = def.fields.find(f => f.name === def.kanban!.field)!
  const toast = useToast()
  const [over, setOver] = useState<string | null>(null)
  const opts = (field.options ?? []).map(optValue)
  const cols = listColumns(def).filter(f => f.name !== field.name).slice(1, 4)
  const money = def.fields.find(f => f.type === 'money' && f.list)
  const move = async (id: number, to: string) => {
    const r = rows.find(x => x.id === id); if (!r || r[field.name] === to) return
    try { await put(`/api/e/${def.key}/${id}`, { [field.name]: to, version: r.version }); onMoved() } catch (e: any) { toast.error(e.message) }
  }
  return (
    <div className="flex gap-3 p-3 overflow-x-auto items-start" style={{ minHeight: 320 }}>
      {opts.map(o => {
        const list = rows.filter(r => r[field.name] === o)
        return (
          <div key={o} className={cls('w-[270px] flex-none rounded-xl bg-soft border border-line', over === o && 'ring-2 ring-emerald')} onDragOver={e => { e.preventDefault(); setOver(o) }} onDragLeave={() => setOver(null)} onDrop={e => { e.preventDefault(); setOver(null); void move(Number(e.dataTransfer.getData('text/plain')), o) }}>
            <div className="flex items-center justify-between px-3 py-2"><Badge value={o} /><span className="text-xs text-muted font-bold">{list.length}{money ? ` · ${fmtMoney(list.reduce((s, r) => s + (r[money.name] || 0), 0), 0)}` : ''}</span></div>
            <div className="p-2 flex flex-col gap-2">
              {list.map(r => (
                <div key={r.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(r.id))} onClick={() => onOpen(r)} className="bg-card border border-line rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                  <div className="font-bold text-ink text-[13.5px] leading-snug">{r._title}</div>
                  {cols.map(f => <div key={f.name} className="text-xs text-muted mt-1 truncate"><span className="font-semibold">{f.label}: </span><CellValue f={f} rec={r} /></div>)}
                </div>))}
              {!list.length && <div className="text-xs text-muted text-center py-4">Drop here</div>}
            </div>
          </div>)
      })}
    </div>
  )
}

function ImportModal({ def, onClose, onDone }: { def: MetaEntity; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(''); const [name, setName] = useState('')
  const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const toast = useToast()
  const run = async (dryRun: boolean) => {
    setBusy(true)
    try { const r = await post<any>(`/api/e/${def.key}/import`, { csv: text, dryRun }); setRes(r); if (!dryRun && r.created) { toast.ok(`${r.created} ${def.plural.toLowerCase()} imported`); onDone() } } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Import ${def.plural} from CSV`} width={640} footer={<><a className="btn outline" href={`/api/e/${def.key}/template.csv`}><Download /> Template</a><div className="flex-1" /><button className="btn outline" onClick={onClose}>Close</button><button className="btn outline" disabled={!text || busy} onClick={() => void run(true)}>Validate only</button><button className="btn green" disabled={!text || busy} onClick={() => void run(false)}>Import</button></>}>
      <p className="text-sm text-muted mt-0">Use the template for column names. Reference columns (customer, port, carrier…) accept the code or exact name. Up to 5,000 rows.</p>
      <input type="file" accept=".csv,text/csv" className="input" onChange={async e => { const f = e.target.files?.[0]; if (f) { setName(f.name); setText(await f.text()); setRes(null) } }} />
      {name && <div className="text-xs text-muted mt-1">{name} · {text.split('\n').length - 1} rows</div>}
      {res && <div className="mt-3 text-sm"><div className={res.failed ? 'text-[#8f1325] font-bold' : 'text-fold font-bold'}>{res.dryRun ? 'Validation: ' : 'Imported: '}{res.created} OK, {res.failed} failed</div>
        {res.errors.length > 0 && <ul className="mt-2 max-h-48 overflow-auto text-[13px] pl-4">{res.errors.map((e: any) => <li key={e.row}>Row {e.row}: {e.error}</li>)}</ul>}</div>}
    </Modal>
  )
}

