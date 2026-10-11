import { useMeta } from '../../lib/meta'
import { useDocumentSeal } from '@shared/document-presentation'
import { Button } from './button'
import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { useToast } from '../../lib/toast'
export function DocumentPrinter({ label = 'Loading…' }: { label?: string }) {
  return <div className="document-loading no-print" role="status" aria-live="polite"><div className="printer-scene" aria-hidden="true"><div className="printer-paper"><i /><i /><i /><i /></div><div className="printer-body"><div className="printer-slot" /><span className="printer-led" /></div><div className="printer-tray" /></div><span>{label}</span></div>
}
export function PdfDownload({ entity, id }: { entity: string; id: number }) {
  const [busy, setBusy] = useState(false), toast = useToast()
  const { meta } = useMeta(), [choice, setChoice] = useState<string | null>(null)
  const seal = useDocumentSeal(choice, !!meta?.settings.document_seal_default)
  const download = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/pdf/${entity}/${id}?download=1&seal=${seal ? '1' : '0'}`, { credentials: 'same-origin' })
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error || res.statusText || 'Request failed') }
      const blob = await res.blob(), url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = res.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? `${entity}-${id}.pdf`
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return <><SealChoice value={seal} onChange={value => setChoice(value ? '1' : '0')} disabled={busy} /><Button className="outline" disabled={busy} aria-busy={busy} onClick={() => void download()} title="Download a PDF generated on the server"><FileDown /> PDF</Button>{busy && <div className="pdf-progress"><DocumentPrinter label="Rendering PDF…" /></div>}</>
}

export function SealChoice({ value, onChange, disabled }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { meta } = useMeta()
  return <label className="document-seal-choice"><input type="checkbox" checked={value && !!meta?.settings.document_seal} disabled={disabled || !meta?.settings.document_seal} onChange={e => onChange(e.target.checked)} />Include company seal{!meta?.settings.document_seal && <span className="help">Upload in Company settings → Document text.</span>}</label>
}
