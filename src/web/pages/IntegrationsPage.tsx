import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, Save, CheckCircle2, XCircle, Copy, RefreshCw, Download, ChevronDown, ChevronRight, KeyRound, Cloud } from 'lucide-react'
import { get, post, put, downloadUrl } from '../lib/api'
import { useToast } from '../lib/toast'
import { PageHeader, Loading, ErrorBox } from '../ui/kit'
import { iconByName } from '../lib/icons'
import { cls } from '../lib/format'
import { useMeta } from '../lib/meta'

interface Field { key: string; label: string; type: 'text' | 'password' | 'select' | 'bool' | 'number' | 'textarea'; options?: { value: string; label: string }[]; help?: string; placeholder?: string }
interface Section { key: string; title: string; icon: string; summary: string; setup?: string; fields: Field[]; test?: boolean; values: Record<string, any>; webhooks?: { key: string; label: string; path: string; secret?: boolean; url: string | null }[] }

export function IntegrationsPage() {
  const q = useQuery({ queryKey: ['integrations'], queryFn: () => get<{ sections: Section[]; status: Record<string, any>; presets: any[] }>('/api/integrations') })
  const [open, setOpen] = useState<string | null>(null)
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <Loading />
  const st = q.data.status
  const ready = (k: string) => k === 'mail' ? st.mail !== 'none' : k === 'storage' ? st.r2 : k === 'supabase' ? st.supabase : k === 'whatsapp' ? st.whatsapp : k === 'ai' ? st.ai : null
  return (
    <div className="fade-in">
      <PageHeader icon={<Plug size={20} />} title="Integrations" subtitle="Connect e-mail, file storage, WhatsApp, AI, e-invoicing, carriers and banks. Secrets are encrypted at rest in your database and never shown again." />
      <div className="grid gap-3 max-w-4xl">
        {q.data.sections.map(s => (
          <SectionCard key={s.key} s={s} open={open === s.key} onToggle={() => setOpen(open === s.key ? null : s.key)} ready={ready(s.key)} presets={q.data.presets} pdf={s.key === 'storage' ? st.pdf : undefined} onSaved={() => void q.refetch()} />
        ))}
      </div>
    </div>
  )
}

function SectionCard({ s, open, onToggle, ready, presets, pdf, onSaved }: { s: Section; open: boolean; onToggle: () => void; ready: boolean | null; presets: any[]; pdf?: boolean; onSaved: () => void }) {
  const toast = useToast(); const qc = useQueryClient(); const { reload } = useMeta()
  const Icon = iconByName(s.icon)
  const [v, setV] = useState<Record<string, any>>(s.values); const [busy, setBusy] = useState<string | null>(null); const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null)
  const [secretUrl, setSecretUrl] = useState<Record<string, string>>({})
  useEffect(() => setV(s.values), [s.values])
  const dirty = Object.keys(v).filter(k => JSON.stringify(v[k]) !== JSON.stringify(s.values[k]))
  const set = (k: string, val: any) => setV(x => ({ ...x, [k]: val }))
  const save = async () => { setBusy('save'); try { const patch: Record<string, any> = {}; for (const k of dirty) patch[k] = v[k]; await put('/api/admin/settings', patch); toast.ok('Saved'); await qc.invalidateQueries({ queryKey: ['settings'] }); onSaved(); void reload() } catch (e: any) { toast.error(e.message); throw e } finally { setBusy(null) } }
  const test = async () => { setBusy('test'); setRes(null); try { if (dirty.length) await save(); const r = await post<any>(`/api/integrations/${s.key}/test`); setRes({ ok: !!r.ok, text: r.ok ? `Connected${r.model ? ' · model ' + r.model : ''}${r.provider ? ' · ' + r.provider : ''}${r.reply ? ' · replied “' + r.reply + '”' : ''}` : r.error ?? 'Failed' }) } catch (e: any) { setRes({ ok: false, text: e.message }) } finally { setBusy(null) } }
  const preset = s.key === 'ai' ? presets.find(p => p.key === v.ai_provider) : null
  const act = async (name: string, fn: () => Promise<string>) => { setBusy(name); try { toast.ok(await fn()); onSaved() } catch (e: any) { toast.error(e.message) } finally { setBusy(null) } }
  return (
    <div className="card overflow-hidden">
      <button className="w-full flex items-center gap-3 p-4 text-start bg-transparent border-0 cursor-pointer" onClick={onToggle} aria-expanded={open}>
        <div className="w-10 h-10 rounded-xl bg-mint text-fold grid place-items-center flex-none"><Icon size={20} /></div>
        <div className="flex-1 min-w-0"><div className="font-display font-extrabold text-ink">{s.title}</div><div className="text-[13px] text-muted">{s.summary}</div></div>
        {ready !== null && <span className={cls('badge', ready ? 'green' : 'grey')}>{ready ? 'Connected' : 'Not set up'}</span>}
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {open && (
        <div className="border-t border-line p-4 md:p-5 grid gap-4">
          {s.setup && <div className="text-[13px] bg-soft border border-line rounded-xl p-3 leading-relaxed"><b>Setup:</b> {s.setup}</div>}
          {preset && <div className="text-[13px] text-muted"><b>{preset.label}</b> · {preset.free}. {preset.notes} {preset.base && <span>Default URL <code>{preset.base}</code>{preset.model && <> · model <code>{preset.model}</code></>}.</span>}</div>}
          {s.webhooks?.map(w => (
            <div key={w.key} className="rounded-xl border border-line p-3 grid gap-2">
              <div className="label !mb-0">{w.label}</div>
              {secretUrl[w.key] || (!w.secret && w.url) ? <div className="flex gap-2 items-center"><input className="input flex-1 font-mono !text-[12.5px]" readOnly value={secretUrl[w.key] ?? w.url ?? ''} onFocus={e => e.target.select()} /><button className="btn outline" onClick={() => { void navigator.clipboard?.writeText(secretUrl[w.key] ?? w.url ?? ''); toast.ok('Copied') }}><Copy /> Copy</button></div> : <div className="text-[13px] text-muted">{w.secret ? 'No webhook URL generated yet.' : ''}</div>}
              {w.secret && <div className="flex gap-2 items-center flex-wrap"><button className="btn outline sm" disabled={busy === 'sec' + w.key} onClick={() => void act('sec' + w.key, async () => { const r = await post<any>(`/api/integrations/webhook-secret/${w.key === 'bank_webhook_secret' ? 'bank' : 'tracking'}`); setSecretUrl(x => ({ ...x, [w.key]: r.url })); return 'New URL generated – copy it now' })}><KeyRound /> {w.url ? 'Regenerate URL' : 'Generate URL'}</button><span className="text-xs text-muted">Shown once. Regenerating invalidates the old URL.</span></div>}
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-2">
            {s.fields.map(f => <FieldInput key={f.key} f={f} v={v[f.key]} onChange={val => set(f.key, val)} />)}
          </div>
          {s.key === 'storage' && <p className="text-xs text-muted m-0">PDF engine on this server: <b>{pdf ? 'available' : 'not installed (set CHROME_PATH, or use the Docker image)'}</b>.</p>}
          <div className="flex gap-2 flex-wrap items-center">
            <button className="btn green" disabled={!dirty.length || busy === 'save'} onClick={() => void save().catch(() => {})}><Save /> {busy === 'save' ? 'Saving…' : dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? 's' : ''}` : 'Saved'}</button>
            {s.test && <button className="btn outline" disabled={!!busy} onClick={() => void test()}><RefreshCw className={busy === 'test' ? 'animate-spin' : ''} /> Save & test connection</button>}
            {s.key === 'supabase' && <>
              <a className="btn outline" href="/api/integrations/supabase/schema.sql"><Download /> Schema SQL</a>
              <button className="btn outline" disabled={!!busy} onClick={() => void act('sync', async () => { const r = await post<any>('/api/integrations/supabase/sync', {}); if (!r.ok) throw new Error(r.errors.join('; ')); return `Synced ${r.rows} rows` })}><Cloud /> Sync now</button>
              <button className="btn outline" disabled={!!busy} onClick={() => void act('full', async () => { const r = await post<any>('/api/integrations/supabase/sync', { full: true }); if (!r.ok) throw new Error(r.errors.join('; ')); return `Full resync: ${r.rows} rows` })}>Full resync</button></>}
            {s.key === 'storage' && <button className="btn outline" disabled={!!busy} onClick={() => void act('bk', async () => { const r = await post<any>('/api/integrations/backup-r2'); return `Backup ${r.name} ${r.r2 ? 'uploaded to R2' : 'saved locally (R2 not configured)'}` })}><Cloud /> Backup to R2 now</button>}
          </div>
          {res && <div className={cls('flex items-center gap-2 text-sm rounded-xl p-3 border', res.ok ? 'bg-mint border-[#bfe3d0] text-fold' : 'bg-blush border-[#f2bcc3] text-[#8f1325]')}>{res.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {res.text}</div>}
        </div>
      )}
    </div>
  )
}

function FieldInput({ f, v, onChange }: { f: Field; v: any; onChange: (v: any) => void }) {
  if (f.type === 'bool') return <label className="flex items-start gap-2 text-[14px] md:col-span-2 cursor-pointer"><input type="checkbox" className="mt-1" checked={!!v} onChange={e => onChange(e.target.checked)} /> <span>{f.label}{f.help && <span className="block text-xs text-muted">{f.help}</span>}</span></label>
  return (
    <div className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
      <label className="label">{f.label}</label>
      {f.type === 'select' ? <select className="select" value={v ?? ''} onChange={e => onChange(e.target.value)}>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : f.type === 'textarea' ? <textarea className="textarea" rows={4} value={v ?? ''} onChange={e => onChange(e.target.value)} />
        : <input className="input" type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'} autoComplete="off" placeholder={f.placeholder} value={v ?? ''} onChange={e => onChange(f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
      {f.help && <div className="text-xs text-muted mt-1">{f.help}</div>}
    </div>
  )
}
void downloadUrl
