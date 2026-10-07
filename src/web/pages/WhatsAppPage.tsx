import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MessageCircle, Send, Settings2, Plus } from 'lucide-react'
import { get, post } from '../lib/api'
import { useToast } from '../lib/toast'
import { PageHeader, Loading, ErrorBox, Empty } from '../ui/kit'
import { cls } from '../lib/format'

export function WhatsAppPage() {
  const toast = useToast()
  const th = useQuery({ queryKey: ['wa-threads'], queryFn: () => get<any>('/api/whatsapp/threads'), refetchInterval: 8000 })
  const [sel, setSel] = useState<string | null>(null); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [newNo, setNewNo] = useState('')
  const msgs = useQuery({ queryKey: ['wa-thread', sel], enabled: !!sel, queryFn: () => get<any[]>(`/api/whatsapp/thread/${sel}`), refetchInterval: 5000 })
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView() }, [msgs.data])
  useEffect(() => { if (!sel && th.data?.threads?.length) setSel(th.data.threads[0].wa_id) }, [th.data, sel])
  if (th.error) return <ErrorBox error={th.error} />
  if (!th.data) return <Loading />
  const send = async () => { if (!sel || !text.trim()) return; setBusy(true); try { await post('/api/whatsapp/send', { to: sel, text }); setText(''); void msgs.refetch(); void th.refetch() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  const cur = th.data.threads.find((t: any) => t.wa_id === sel)
  return (
    <div className="fade-in">
      <PageHeader icon={<MessageCircle size={20} />} title="WhatsApp" subtitle="Customer and lead conversations. New numbers become leads automatically; owners can text “report”, “overdue” or ask Jarvis anything." actions={<Link className="btn outline" to="/admin/integrations"><Settings2 /> Connection & automations</Link>} />
      {!th.data.configured && <div className="mb-4 p-4 rounded-xl border border-[#ecd9a0] bg-[#fbf3d6] text-[14px]">WhatsApp is not connected. Set it up in <Link className="underline" to="/admin/integrations">Integrations → WhatsApp</Link>. Callback URL: <code>{th.data.webhook}</code></div>}
      <div className="card grid md:grid-cols-[320px_1fr] min-h-[540px] overflow-hidden">
        <div className="border-b md:border-b-0 md:border-r border-line overflow-auto max-h-[70vh]">
          <div className="p-2 flex gap-2 border-b border-line"><input className="input !min-h-[34px]" placeholder="New chat: number e.g. 0501234567" value={newNo} onChange={e => setNewNo(e.target.value)} /><button className="btn outline sm" disabled={newNo.replace(/\D/g, '').length < 7} onClick={() => { setSel(newNo.replace(/\D/g, '')); setNewNo('') }}><Plus /></button></div>
          {th.data.threads.length === 0 && <Empty title="No conversations yet" hint="Messages will appear here as soon as customers write in." />}
          {th.data.threads.map((t: any) => (
            <button key={t.wa_id} className={cls('w-full text-start px-3 py-2.5 border-0 border-b border-line cursor-pointer block', sel === t.wa_id ? 'bg-mint' : 'bg-transparent hover:bg-soft')} onClick={() => setSel(t.wa_id)}>
              <div className="flex items-center gap-2"><b className="text-[14px] flex-1 truncate">{t.name || '+' + t.wa_id}</b><span className="text-[11px] text-muted">{t.at?.slice(5, 16).replace('T', ' ')}</span></div>
              <div className="text-[12.5px] text-muted truncate">{t.direction === 'out' ? '✓ ' : ''}{t.last}</div>
            </button>))}
        </div>
        <div className="flex flex-col min-h-[420px]">
          {sel ? <>
            <div className="px-4 py-2.5 border-b border-line font-display font-bold">{cur?.name || '+' + sel} <span className="text-xs text-muted font-normal">+{sel}{cur?.party ? ' · ' + cur.party : ''}</span></div>
            <div className="flex-1 overflow-auto p-4 grid gap-2 content-start bg-soft max-h-[56vh]">
              {(msgs.data ?? []).map((m: any) => <div key={m.id} className={cls('max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] whitespace-pre-wrap', m.direction === 'out' ? 'justify-self-end bg-[#d7f5e3] border border-[#bfe3d0]' : 'bg-card border border-line')}>{m.body}<div className="text-[10.5px] text-muted mt-1 flex gap-2 justify-end">{m.origin && m.origin !== 'customer' && m.origin !== 'unknown' && <span>{m.origin}</span>}<span>{m.at?.slice(11, 16)}</span>{m.direction === 'out' && <span className={m.status === 'failed' ? 'text-[#b4232f]' : ''}>{m.status}</span>}</div>{m.error && <div className="text-[11px] text-[#b4232f]">{m.error}</div>}</div>)}
              <div ref={end} />
            </div>
            <form className="p-3 border-t border-line flex gap-2" onSubmit={e => { e.preventDefault(); void send() }}><input className="input flex-1" placeholder="Type a message…" value={text} onChange={e => setText(e.target.value)} /><button className="btn green" disabled={busy || !text.trim()}><Send /> Send</button></form>
            <div className="px-3 pb-2 text-[11.5px] text-muted">WhatsApp only allows free-text replies within 24 hours of the customer’s last message; otherwise use an approved template.</div>
          </> : <Empty title="Select a conversation" />}
        </div>
      </div>
    </div>
  )
}
