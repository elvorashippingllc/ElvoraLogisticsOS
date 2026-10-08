import { useState } from 'react'
import { ClipboardList, Download } from 'lucide-react'
import scope from '@shared/enterprise-scope.json'
import { Empty, PageHeader } from '../ui/kit'

const statuses = ['Partial', 'Missing', 'External validation']
export function ScopePage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const needle = query.trim().toLocaleLowerCase()
  const rows = scope.sections.filter(s => (status === 'All' || status === s.status) && (!needle || `${s.id} ${s.title} ${s.specification} ${s.gap}`.toLocaleLowerCase().includes(needle)))
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(scope, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'elvora-enterprise-scope.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="workspace-page">
    <PageHeader title="Enterprise scope" subtitle="ELVORA CONTROL · Every requirement, with its remaining acceptance work." icon={<ClipboardList />} actions={<button className="btn outline" onClick={download}><Download size={16} />Export scope</button>} />
    <div className="card p-5 mb-5"><p className="font-semibold mb-2">147 areas tracked. Implementation is still incomplete.</p><p className="text-sm text-muted">{scope.notice}</p><p className="text-xs text-muted mt-3">Source review: {scope.reviewedAt}. This is a fixed assessment of the reviewed version, not a live completion tracker.</p><div className="flex flex-wrap gap-2 mt-3" aria-label="Product areas">{scope.areas.map(area => <span className="badge" key={area}>{area}</span>)}</div></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">{statuses.map(s => <button key={s} className="card p-4 text-left" aria-pressed={status === s} onClick={() => setStatus(status === s ? 'All' : s)}><span className="block text-2xl font-bold">{scope.sections.filter(r => r.status === s).length}</span><span className="text-sm">{s === 'Partial' ? 'Partial foundations' : s === 'Missing' ? 'Missing implementations' : 'Need external validation'}</span></button>)}</div>
    <div className="flex flex-wrap gap-3 mb-4"><input className="input flex-1 min-w-0" type="search" aria-label="Search enterprise requirements" placeholder="Search requirements, features or gaps" value={query} onChange={e => setQuery(e.target.value)} /><select className="input w-auto" aria-label="Filter coverage status" value={status} onChange={e => setStatus(e.target.value)}><option>All</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>
    <p className="text-sm text-muted mb-3" role="status">Showing {rows.length} of {scope.sections.length} areas</p>
    <div className="space-y-3">{rows.map(s => <details key={s.id} className="card p-4"><summary className="cursor-pointer font-semibold break-words">{s.id}. {s.title} <span className="text-xs font-normal text-muted">· {s.status}</span></summary><div className="mt-4 space-y-4 text-sm"><p>{s.evidence}</p><div><h2 className="font-semibold mb-1">Remaining acceptance work</h2><p>{s.gap}</p></div>{s.sources.length > 0 && <div><h2 className="font-semibold mb-1">Code evidence</h2><ul className="list-disc pl-5">{s.sources.map(p => <li className="break-all" key={p}><code>{p}</code></li>)}</ul></div>}<details><summary className="cursor-pointer font-semibold">Original requirement</summary><div className="whitespace-pre-wrap break-words text-sm mt-3">{s.specification}</div></details></div></details>)}</div>
    {!rows.length && <Empty title="No matching requirements" action={<button className="btn outline" onClick={() => { setQuery(''); setStatus('All') }}>Clear filters</button>} />}
  </div>
}
