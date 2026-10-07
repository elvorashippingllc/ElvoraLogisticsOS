import { getSetting } from '../settings'
import { http } from '../integrations/log'
import { inDemo } from '../db'

export interface Preset { key: string; label: string; base: string; model: string; keyRequired: boolean; free: string; notes: string }
export const PRESETS: Preset[] = [
  { key: 'groq', label: 'Groq (free tier)', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyRequired: true, free: 'Free tier with rate limits', notes: 'Fast Llama / Qwen models. Get a key at console.groq.com.' },
  { key: 'openrouter', label: 'OpenRouter (free models)', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', keyRequired: true, free: 'Models ending in ":free" cost nothing', notes: 'Pick any model ending in :free at openrouter.ai/models.' },
  { key: 'ollama', label: 'Ollama (your own server)', base: 'http://localhost:11434/v1', model: 'llama3.1:8b', keyRequired: false, free: 'Free – runs on your hardware', notes: 'Install Ollama on a PC/VPS and pull a model that supports tools (llama3.1, qwen2.5). Use http://host.docker.internal:11434/v1 from Docker.' },
  { key: 'opencode', label: 'OpenCode Zen', base: 'https://opencode.ai/zen/v1', model: '', keyRequired: true, free: 'Some models are free', notes: 'Enter the model id shown in your OpenCode Zen dashboard.' },
  { key: 'xai', label: 'xAI Grok', base: 'https://api.x.ai/v1', model: 'grok-3-mini', keyRequired: true, free: 'Paid / promotional credits', notes: 'console.x.ai' },
  { key: 'gemini', label: 'Google Gemini (free tier)', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', keyRequired: true, free: 'Free tier with limits', notes: 'aistudio.google.com/apikey' },
  { key: 'cloudflare', label: 'Cloudflare Workers AI', base: 'https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', keyRequired: true, free: 'Daily free allowance', notes: 'Replace ACCOUNT_ID in the base URL; the key is a Workers AI API token.' },
  { key: 'openai', label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyRequired: true, free: 'Paid', notes: '' },
  { key: 'custom', label: 'Custom OpenAI-compatible', base: '', model: '', keyRequired: false, free: '', notes: 'Any server exposing /chat/completions (LM Studio, vLLM, LiteLLM…).' },
]
export interface Endpoint { base: string; key: string; model: string; label: string }

export function endpoints(modelOverride?: string): Endpoint[] {
  const out: Endpoint[] = []
  const mk = (pre: string, label: string) => {
    const provider = String(getSetting(pre ? 'ai_fallback_provider' : 'ai_provider') || '')
    if (!provider) return
    const p = PRESETS.find(x => x.key === provider)
    const base = String(getSetting(pre ? 'ai_fallback_base_url' : 'ai_base_url') || p?.base || '').replace(/\/+$/, '')
    const model = String((!pre && modelOverride) || getSetting(pre ? 'ai_fallback_model' : 'ai_model') || p?.model || '')
    const key = String(getSetting(pre ? 'ai_fallback_api_key' : 'ai_api_key') || '')
    if (base && model) out.push({ base, key, model, label })
  }
  mk('', 'primary'); mk('f', 'fallback')
  return out
}
export const aiConfigured = () => inDemo() || (!!getSetting('ai_enabled') && endpoints().length > 0)

export interface ChatMsg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }
export interface ToolDef { name: string; description: string; parameters: any }
export interface ChatResult { content: string; tool_calls: { id: string; name: string; args: any }[]; tokens: number; model: string }

function extractToolJson(text: string): { json: any; raw: string } | null {
  const at = text.search(/\{\s*"tool"\s*:/)
  if (at < 0) return null
  let depth = 0
  for (let i = at; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) { const raw = text.slice(at, i + 1); try { return { json: JSON.parse(raw), raw } } catch { return null } }
  }
  return null
}

async function callOne(e: Endpoint, messages: ChatMsg[], tools: ToolDef[] | undefined): Promise<ChatResult> {
  const body: any = { model: e.model, messages, temperature: 0.2, max_tokens: 1500 }
  if (tools?.length) { body.tools = tools.map(t => ({ type: 'function', function: t })); body.tool_choice = 'auto' }
  const r = await http(`${e.base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(e.key ? { Authorization: `Bearer ${e.key}` } : {}) }, body: JSON.stringify(body), timeoutMs: 90000 })
  if (!r.ok) throw new Error(`${e.label} model ${e.model}: HTTP ${r.status} ${r.data?.error?.message ?? r.data?.message ?? r.text.slice(0, 160)}`)
  const msg = r.data?.choices?.[0]?.message
  if (!msg) throw new Error(`${e.label}: empty response`)
  let content: string = typeof msg.content === 'string' ? msg.content : ''
  let calls = (msg.tool_calls ?? []).map((c: any) => { let a: any = {}; try { a = JSON.parse(c.function?.arguments || '{}') } catch { /* keep empty */ } return { id: c.id ?? Math.random().toString(36).slice(2), name: c.function?.name, args: a } })
  // models without native tool calling: accept {"tool":"name","args":{...}} written in the text
  if (!calls.length && tools?.length) {
    const found = extractToolJson(content)
    if (found && tools.some(t => t.name === found.json.tool)) { calls = [{ id: 't' + Date.now(), name: found.json.tool, args: found.json.args ?? {} }]; content = content.replace(found.raw, '').replace(/```(json)?/g, '').trim() }
  }
  return { content: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), tool_calls: calls, tokens: r.data?.usage?.total_tokens ?? 0, model: e.model }
}

/** Try the primary provider, then the fallback (e.g. when a free tier is rate limited). */
/** Demo workspace only: a scripted assistant that really calls the read tools and writes a briefing from their output. */
function demoChat(messages: ChatMsg[], tools?: ToolDef[]): ChatResult {
  const lastUser = [...messages].map((m, i) => ({ m, i })).filter(x => x.m.role === 'user').pop()?.i ?? 0
  const results = messages.slice(lastUser).filter(m => m.role === 'tool')
  const ask = String(messages[lastUser]?.content ?? '').toLowerCase()
  if (!results.length && tools?.length) {
    const want = ['business_snapshot', 'overdue_invoices', 'stalled_jobs', 'open_tickets', 'list_leads'].filter(n => tools.some(t => t.name === n))
    if (want.length) return { content: '', tokens: 0, model: 'demo-assistant', tool_calls: want.map((n, i) => ({ id: 'demo' + i, name: n, args: {} })) }
  }
  const get = (n: string) => { const m = results.find(r => r.name === n); try { return JSON.parse(m?.content ?? 'null') } catch { return null } }
  const snap = get('business_snapshot'), od = get('overdue_invoices') ?? [], st = get('stalled_jobs') ?? {}, tk = get('open_tickets') ?? [], ld = get('list_leads') ?? []
  const lines = [`Here is where things stand (live data from this demo workspace).`]
  if (snap) lines.push(`• ${snap.open_jobs} open jobs, revenue this month AED ${Math.round(snap.revenue_month_aed).toLocaleString('en-US')}, unbilled work AED ${Math.round(snap.unbilled_revenue_aed).toLocaleString('en-US')}.`, `• Receivables AED ${Math.round(snap.ar_outstanding_aed).toLocaleString('en-US')}, of which AED ${Math.round(snap.ar_overdue_aed).toLocaleString('en-US')} is overdue. Cash and bank AED ${Math.round(snap.cash_aed).toLocaleString('en-US')}.`)
  if (od.length) lines.push(`• Chase first: ${od.slice(0, 3).map((o: any) => `${o.customer} (${o.invoice_no}, ${o.days_overdue} days, ${o.balance.toLocaleString('en-US')})`).join('; ')}.`)
  const late = (st.eta_passed ?? []).length + (st.free_time_ending ?? []).length + (st.no_update_5d ?? []).length
  if (late) lines.push(`• ${late} shipment alerts: ${[...(st.eta_passed ?? []).map((j: any) => j.job_no + ' ETA passed'), ...(st.free_time_ending ?? []).map((j: any) => j.container_no + ' free time ending')].slice(0, 3).join(', ')}.`)
  if (tk.length) lines.push(`• ${tk.length} open tickets, oldest: “${tk[tk.length - 1].subject}”.`)
  if (ld.length) lines.push(`• ${ld.length} recent leads; newest is ${ld[0].company}.`)
  lines.push(`Suggested next actions: call the largest overdue customer today, chase carriers on late shipments, and follow up the newest lead.`, `(Demo mode: this assistant is scripted. In your production workspace Jarvis uses the AI model you connect under Integrations.)`)
  void ask
  return { content: lines.join('\n'), tool_calls: [], tokens: 0, model: 'demo-assistant' }
}

export async function chat(messages: ChatMsg[], tools?: ToolDef[], modelOverride?: string): Promise<ChatResult> {
  if (inDemo()) return demoChat(messages, tools)
  const eps = endpoints(modelOverride)
  if (!eps.length) throw new Error('AI is not configured. Choose a provider under Integrations → AI.')
  let last: Error | null = null
  for (const e of eps) { try { return await callOne(e, messages, tools) } catch (err: any) { last = err } }
  throw last!
}
export async function testLlm(): Promise<{ ok: boolean; error?: string; model?: string; reply?: string }> {
  try { const r = await chat([{ role: 'user', content: 'Reply with the single word: ready' }]); return { ok: true, model: r.model, reply: r.content.slice(0, 40) } } catch (e: any) { return { ok: false, error: String(e?.message ?? e) } }
}
