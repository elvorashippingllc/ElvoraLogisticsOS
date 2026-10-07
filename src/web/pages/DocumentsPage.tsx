import { useState } from 'react'
import { FolderOpen, Upload } from 'lucide-react'
import { upload } from '../lib/api'
import { EntityList } from '../components/EntityList'
import { useToast } from '../lib/toast'
import { useQueryClient } from '@tanstack/react-query'
import { useMeta } from '../lib/meta'
import { PageHeader, Modal } from '../ui/kit'
import { optValue } from '@shared/types'

export function DocumentsPage() {
  const { def, can } = useMeta(); const toast = useToast(); const qc = useQueryClient()
  const [open, setOpen] = useState(false); const [files, setFiles] = useState<File[]>([]); const [cat, setCat] = useState('General'); const [exp, setExp] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false)
  const cats = (def('attachments').fields.find(f => f.name === 'category')?.options ?? []).map(optValue)
  return (
    <div className="fade-in">
      <PageHeader icon={<FolderOpen size={20} />} title="Documents Library" subtitle="Every file attached to any record — search by name, category, linked record or expiry. Click a row to open the file." actions={can('documents', 'create') && <button className="btn green" onClick={() => setOpen(true)}><Upload /> Upload</button>} />
      <EntityList entity="attachments" embedded hideNew onOpen={r => window.open(`/api/files/${r.id}/download`, '_blank', 'noopener')} pageSizeDefault={50} />
      <Modal open={open} onClose={() => setOpen(false)} title="Upload to library" width={520} footer={<><div className="flex-1" /><button className="btn outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn green" disabled={!files.length || busy} onClick={async () => { setBusy(true); try { await upload(files, { category: cat, expiry_date: exp, note }); toast.ok('Uploaded'); setOpen(false); setFiles([]); void qc.invalidateQueries({ queryKey: ['list', 'attachments'] }) } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }}>{busy ? 'Uploading…' : 'Upload'}</button></>}>
        <div className="grid gap-3"><input type="file" multiple className="input" onChange={e => setFiles([...(e.target.files ?? [])])} /><div className="grid grid-cols-2 gap-3"><div><label className="label">Category</label><select className="select" value={cat} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select></div><div><label className="label">Expiry (optional)</label><input className="input" type="date" value={exp} onChange={e => setExp(e.target.value)} /></div></div><div><label className="label">Note</label><input className="input" value={note} onChange={e => setNote(e.target.value)} /></div>
          <p className="text-xs text-muted m-0">To attach a file to a specific job, quotation or customer, open that record and use the Attachments panel.</p></div>
      </Modal>
    </div>
  )
}
