import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { Bot, Send, Play, Plus, Check, X as XIcon, Sparkles, Settings2, Loader2, ShieldCheck } from 'lucide-react'
import { get, post, put } from '../lib/api'
import { useToast } from '../lib/toast'
import { PageHeader, Loading, ErrorBox, Tabs, Badge, Empty, Modal } from '../ui/kit'
import { useMeta } from '../lib/meta'
import { cls, fmtIsoStamp } from '../lib/format'

interface Agent { id: number; name: string; title: string; avatar: string; active: boolean; schedule: string; run_hour: number; autonomy: string; deliver_to: string; last_run_at: string | null; last_status: string | null; role_key: string | null; instructions: string; tools: string }
interface Status { configured: boolean; pending: number; agents: Agent[]; templates: { key: string; name: string; title: string; avatar: string; blurb: string }[]; tools: { name: string; risk: string; description: string }[] }

const SUGGESTIONS = ['Give me today’s briefing', 'Who owes us money and for how long?', 'Which jobs are at risk of delay?', 'Any revenue we have not invoiced yet?', 'Summarise our open leads', 'What needs my approval or attention today?']

export function AiPage() {
  const [sp, setSp] = useSearchParams(); const tab = sp.get('tab') ?? 'chat'
  const q = useQuery({ queryKey: ['ai-status'], queryFn: () => get<Status>('/api/ai/status'), refetchInterval: 20000 })
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <Loading />
  const d = q.data
  return (
    <div className="fade-in">
      <PageHeader icon={<Bot size={20} />} title="AI Team" subtitle="Jarvis and your digital employees – they read live company data, do the routine work and report to you. Anything that leaves the company waits for your approval unless you grant autopilot." actions={<Link className="btn outline" to="/admin/integrations"><Settings2 /> AI provider</Link>} />
      {!d.configured && <div className="mb-4 p-4 rounded-xl border border-[#ecd9a0] bg-[#fbf3d6] text-[14px]"><b>AI is not connected yet.</b> Choose a provider in <Link to="/admin/integrations" className="underline">Integrations → AI employees</Link>. Free options: Groq, OpenRouter “:free” models, Google Gemini, Cloudflare Workers AI, or your own Ollama server.</div>}
      <div className="card overflow-hidden">
        <Tabs tabs={[{ key: 'chat', label: 'Chat with Jarvis' }, { key: 'team', label: 'Employees', count: d.agents.length }, { key: 'approvals', label: 'Approvals', count: d.pending || undefined }, { key: 'activity', label: 'Activity' }]} value={tab} onChange={k => setSp({ tab: k })} />
        <div className="p-4 md:p-5">
          {tab === 'chat' && <Chat status={d} />}
          {tab === 'team' && <Team status={d} reload={() => void q.refetch()} />}
          {tab === 'approvals' && <Approvals reload={() => void q.refetch()} />}
          {tab === 'activity' && <Activity />}
        </div>
      </div>
    </div>
  )
}

function Chat({ status }: { status: Status }) {
  const toast = useToast()
  const agents = status.agents.filter(a => a.active || a.role_key === 'jarvis')
  const [agentId, setAgentId] = useState<number>(agents.find(a => a.role_key === 'jarvis')?.id ?? agents[0]?.id)
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])
  const send = async (m: string) => {
    if (!m.trim() || busy) return
    const history = msgs; setMsgs([...history, { role: 'user', content: m }]); setText(''); setBusy(true)
    try { const r = await post<{ reply: string }>('/api/ai/chat', { agent_id: agentId, message: m, history }); setMsgs(x => [...x, { role: 'assistant', content: r.reply }]) } catch (e: any) { toast.error(e.message); setMsgs(x => [...x, { role: 'assistant', content: '⚠ ' + e.message }]) } finally { setBusy(false) }
  }
  const agent = agents.find(a => a.id === agentId)
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 flex-wrap"><span className="text-sm text-muted">Talking to</span>
        <select className="select !w-auto" value={agentId} onChange={e => { setAgentId(Number(e.target.value)); setMsgs([]) }}>{agents.map(a => <option key={a.id} value={a.id}>{a.avatar} {a.name} – {a.title}</option>)}</select>
        {msgs.length > 0 && <button className="btn ghost sm" onClick={() => setMsgs([])}>Clear</button>}</div>
      <div className="rounded-xl border border-line bg-soft p-3 md:p-4 min-h-[320px] max-h-[56vh] overflow-auto grid gap-3 content-start">
        {msgs.length === 0 && <div className="grid gap-2 py-4"><div className="text-[15px]"><span className="text-[26px] mr-2">{agent?.avatar}</span><b>{agent?.name}</b> here. Ask me anything about the business – I read your live data.</div>
          <div className="flex flex-wrap gap-2">{SUGGESTIONS.map(s => <button key={s} className="btn outline sm" onClick={() => void send(s)} disabled={!status.configured}><Sparkles /> {s}</button>)}</div></div>}
        {msgs.map((m, i) => <div key={i} className={cls('max-w-[88%] rounded-2xl px-4 py-2.5 text-[14.5px] whitespace-pre-wrap leading-relaxed', m.role === 'user' ? 'justify-self-end bg-fold text-white' : 'bg-card border border-line')}>{m.content}</div>)}
        {busy && <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="animate-spin" size={16} /> {agent?.name} is checking the data…</div>}
        <div ref={end} />
      </div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void send(text) }}>
        <input className="input flex-1" placeholder={status.configured ? 'Ask Jarvis… e.g. “chase the three biggest overdue customers”' : 'Connect an AI provider first'} value={text} onChange={e => setText(e.target.value)} disabled={!status.configured || busy} />
        <button className="btn green" disabled={!status.configured || busy || !text.trim()}><Send /> Send</button>
      </form>
    </div>
  )
}

function Team({ status, reload }: { status: Status; reload: () => void }) {
  const toast = useToast(); const qc = useQueryClient(); const [edit, setEdit] = useState<Agent | null>(null); const [hire, setHire] = useState(false); const [busy, setBusy] = useState<number | null>(null); const [out, setOut] = useState<{ name: string; text: string } | null>(null)
  const toggle = async (a: Agent) => { try { await put(`/api/e/ai_agents/${a.id}`, { active: !a.active }); toast.ok(`${a.name} ${a.active ? 'paused' : 'is now on duty'}`); reload() } catch (e: any) { toast.error(e.message) } }
  const run = async (a: Agent) => { setBusy(a.id); try { const r = await post<any>(`/api/ai/agents/${a.id}/run`, {}); setOut({ name: a.name, text: r.output }); reload(); void qc.invalidateQueries({ queryKey: ['ai-activity'] }) } catch (e: any) { toast.error(e.message) } finally { setBusy(null) } }
  const level = (s: string) => s.startsWith('Ask') ? 'Asks first' : s.startsWith('Auto') ? 'Acts internally, asks before sending' : 'Autopilot'
  return (
    <div className="grid gap-4">
      <div className="flex items-center"><div className="text-sm text-muted flex-1">Switch an employee on and choose how much freedom they have. They report in the Activity tab, by notification, and optionally on WhatsApp.</div><button className="btn green" onClick={() => setHire(true)}><Plus /> Hire an AI employee</button></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {status.agents.map(a => (
          <div key={a.id} className={cls('rounded-2xl border p-4 grid gap-2 content-start', a.active ? 'border-[#bfe3d0] bg-card' : 'border-line bg-soft')}>
            <div className="flex items-start gap-3"><div className="text-[30px] leading-none">{a.avatar}</div><div className="flex-1 min-w-0"><div className="font-display font-extrabold text-ink truncate">{a.name}</div><div className="text-[13px] text-muted">{a.title}</div></div>
              <label className="relative inline-flex items-center cursor-pointer" title={a.active ? 'On duty' : 'Paused'}><input type="checkbox" className="sr-only peer" checked={a.active} onChange={() => void toggle(a)} /><div className="w-10 h-6 bg-[#c9d3cc] peer-checked:bg-fold rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" /></label></div>
            <div className="text-[12.5px] text-muted flex gap-1.5 flex-wrap"><Badge value={a.schedule === 'Manual only' ? 'Manual' : a.schedule === 'Daily' ? `Daily ${String(a.run_hour).padStart(2, '0')}:00` : a.schedule} tone="blue" /><Badge value={level(a.autonomy)} tone={a.autonomy.startsWith('Auto') && !a.autonomy.includes('approve') ? 'amber' : 'grey'} />{a.last_status && <Badge value={a.last_status} tone={a.last_status === 'ok' ? 'green' : 'red'} />}</div>
            <div className="text-[12.5px] text-muted">{a.last_run_at ? `Last run ${fmtIsoStamp(a.last_run_at.length === 16 ? a.last_run_at + ':00' : a.last_run_at)}` : 'Never run'}</div>
            <div className="flex gap-2 mt-1"><button className="btn outline sm" disabled={!status.configured || busy === a.id} onClick={() => void run(a)}>{busy === a.id ? <Loader2 className="animate-spin" /> : <Play />} Run now</button><button className="btn ghost sm" onClick={() => setEdit(a)}><Settings2 /> Configure</button></div>
          </div>
        ))}
      </div>
      {edit && <AgentEditor agent={edit} tools={status.tools} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
      <Modal open={hire} onClose={() => setHire(false)} title="Hire an AI employee" width={640}>
        <div className="grid gap-2">{status.templates.map(t => <button key={t.key} className="text-start rounded-xl border border-line p-3 flex gap-3 items-start bg-card hover:bg-soft cursor-pointer" onClick={async () => { try { await post('/api/ai/agents/hire', { template: t.key }); toast.ok(`${t.name} hired – switch them on when ready`); setHire(false); reload() } catch (e: any) { toast.error(e.message) } }}><span className="text-[26px]">{t.avatar}</span><span><b>{t.name}</b> – {t.title}<span className="block text-[13px] text-muted">{t.blurb}</span></span></button>)}
          <div className="text-xs text-muted">Or create a fully custom employee from <Link to="/e/ai_agents" className="underline">AI employees</Link> (name, instructions, tools).</div></div>
      </Modal>
      <Modal open={!!out} onClose={() => setOut(null)} title={`${out?.name} – report`} width={680} footer={<><div className="flex-1" /><button className="btn green" onClick={() => setOut(null)}>Close</button></>}><div className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{out?.text}</div></Modal>
    </div>
  )
}

function AgentEditor({ agent, tools, onClose, onSaved }: { agent: Agent; tools: Status['tools']; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const [a, setA] = useState(agent); const [busy, setBusy] = useState(false)
  const set = (k: keyof Agent, v: any) => setA(x => ({ ...x, [k]: v }))
  const selected = a.tools === '*' ? null : new Set(a.tools.split(',').map(s => s.trim()))
  const save = async () => { setBusy(true); try { await put(`/api/e/ai_agents/${a.id}`, { name: a.name, title: a.title, avatar: a.avatar, instructions: a.instructions, autonomy: a.autonomy, schedule: a.schedule, run_hour: a.run_hour, deliver_to: a.deliver_to, tools: a.tools || '*' }); toast.ok('Saved'); onSaved() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title={`Configure ${agent.name}`} width={760} footer={<><button className="btn outline" onClick={onClose}>Cancel</button><div className="flex-1" /><button className="btn green" disabled={busy} onClick={() => void save()}>Save</button></>}>
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="label">Name</label><input className="input" value={a.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="label">Job title</label><input className="input" value={a.title ?? ''} onChange={e => set('title', e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">What this employee does (standing instructions)</label><textarea className="textarea" rows={7} value={a.instructions} onChange={e => set('instructions', e.target.value)} /></div>
        <div><label className="label">Autonomy</label><select className="select" value={a.autonomy} onChange={e => set('autonomy', e.target.value)}><option>Ask first (every action needs approval)</option><option>Auto for internal actions (approve external messages)</option><option>Autopilot (act, then report)</option></select></div>
        <div><label className="label">Runs</label><select className="select" value={a.schedule} onChange={e => set('schedule', e.target.value)}><option>Manual only</option><option>Hourly</option><option>Daily</option><option>Weekly (Monday)</option></select></div>
        <div><label className="label">Hour of day (Dubai)</label><input className="input" type="number" min={0} max={23} value={a.run_hour} onChange={e => set('run_hour', Number(e.target.value))} /></div>
        <div><label className="label">Send the report to</label><select className="select" value={a.deliver_to} onChange={e => set('deliver_to', e.target.value)}><option>In-app only</option><option>In-app + WhatsApp (owner)</option><option>In-app + e-mail (admin)</option></select></div>
        <div className="md:col-span-2"><label className="label">Tools this employee may use</label>
          <label className="flex gap-2 items-center text-sm mb-2"><input type="checkbox" checked={a.tools === '*'} onChange={e => set('tools', e.target.checked ? '*' : tools.filter(t => t.risk === 'read').map(t => t.name).join(','))} /> All tools</label>
          {selected && <div className="grid gap-1 sm:grid-cols-2 max-h-48 overflow-auto border border-line rounded-xl p-2">{tools.map(t => <label key={t.name} className="flex gap-2 text-[13px] items-start" title={t.description}><input type="checkbox" checked={selected.has(t.name)} onChange={e => { const s = new Set(selected); e.target.checked ? s.add(t.name) : s.delete(t.name); set('tools', [...s].join(',')) }} /> <span>{t.name} <span className={cls('text-[11px] font-bold', t.risk === 'external' ? 'text-[#b4232f]' : t.risk === 'internal' ? 'text-[#9a6b00]' : 'text-muted')}>{t.risk === 'read' ? '' : t.risk === 'external' ? 'sends outside' : 'changes data'}</span></span></label>)}</div>}</div>
      </div>
    </Modal>
  )
}

function Approvals({ reload }: { reload: () => void }) {
  const toast = useToast()
  const q = useQuery({ queryKey: ['ai-approvals'], queryFn: () => get<any>('/api/e/ai_actions', { filters: JSON.stringify([{ field: 'status', op: 'eq', value: 'Pending' }]), pageSize: 50 }), refetchInterval: 15000 })
  const decide = async (id: number, d: 'approve' | 'reject') => { try { const r = await post<any>(`/api/ai/actions/${id}/${d}`); r.status === 'Failed' ? toast.error(`Failed: ${typeof r.result === 'string' ? r.result : r.result?.error ?? ''}`) : toast.ok(d === 'approve' ? 'Done' : 'Rejected'); void q.refetch(); reload() } catch (e: any) { toast.error(e.message) } }
  if (q.error) return <ErrorBox error={q.error} />
  if (!q.data) return <Loading />
  if (!q.data.rows.length) return <Empty icon={<ShieldCheck size={34} />} title="Nothing waiting for you" hint="When an employee wants to send an e-mail or WhatsApp, or change data they are not allowed to change alone, it appears here." />
  return (
    <div className="grid gap-3">{q.data.rows.map((r: any) => (
      <div key={r.id} className="rounded-xl border border-line p-3 md:p-4 flex gap-3 items-start flex-wrap">
        <div className="flex-1 min-w-[240px]"><div className="text-xs text-muted">{r._labels?.agent_id} · {fmtIsoStamp(r.created?.length === 16 ? r.created + ':00' : r.created)} · {r.tool}</div><div className="text-[14.5px] font-semibold mt-0.5 whitespace-pre-wrap">{r.summary}</div>
          {r.args && <details className="mt-1 text-[12.5px] text-muted"><summary className="cursor-pointer">Show details</summary><pre className="whitespace-pre-wrap break-words bg-soft rounded-lg p-2 mt-1">{typeof r.args === 'string' ? r.args : JSON.stringify(r.args, null, 2)}</pre></details>}</div>
        <div className="flex gap-2"><button className="btn green" onClick={() => void decide(r.id, 'approve')}><Check /> Approve</button><button className="btn red" onClick={() => void decide(r.id, 'reject')}><XIcon /> Reject</button></div>
      </div>))}</div>
  )
}

function Activity() {
  const q = useQuery({ queryKey: ['ai-activity'], queryFn: () => get<any>('/api/e/ai_runs', { pageSize: 25, sort: 'id', dir: 'desc' }), refetchInterval: 20000 })
  const [open, setOpen] = useState<number | null>(null)
  if (q.error) return <ErrorBox error={q.error} />
  if (!q.data) return <Loading />
  if (!q.data.rows.length) return <Empty title="No activity yet" hint="Run an employee from the Employees tab, or switch one on to run on its schedule." />
  return <div className="grid gap-2">{q.data.rows.map((r: any) => (
    <div key={r.id} className="rounded-xl border border-line p-3"><button className="w-full text-start bg-transparent border-0 p-0 cursor-pointer flex gap-2 items-center flex-wrap" onClick={() => setOpen(open === r.id ? null : r.id)}><Badge value={r.status} /><b className="text-[14px]">{r._labels?.agent_id}</b><span className="text-xs text-muted">{r.trigger} · {r.started_at?.replace('T', ' ')} · {r.steps ?? 0} steps{r.tokens ? ` · ${r.tokens} tokens` : ''}{r.model ? ` · ${r.model}` : ''}</span></button>
      {(open === r.id || r.status === 'failed') && <div className="mt-2 text-[13.5px] whitespace-pre-wrap leading-relaxed">{r.output || r.error}{r.status === 'failed' && r.error && r.output ? '\n' + r.error : ''}</div>}</div>))}</div>
}
