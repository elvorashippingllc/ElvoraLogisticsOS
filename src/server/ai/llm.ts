import { getSetting } from '../settings'
import { http } from '../integrations/log'

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
export const aiConfigured = () => !!getSetting('ai_enabled') && endpoints().length > 0

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
export async function chat(messages: ChatMsg[], tools?: ToolDef[], modelOverride?: string): Promise<ChatResult> {
  const eps = endpoints(modelOverride)
  if (!eps.length) throw new Error('AI is not configured. Choose a provider under Integrations → AI.')
  let last: Error | null = null
  for (const e of eps) { try { return await callOne(e, messages, tools) } catch (err: any) { last = err } }
  throw last!
}
export async function testLlm(): Promise<{ ok: boolean; error?: string; model?: string; reply?: string }> {
  try { const r = await chat([{ role: 'user', content: 'Reply with the single word: ready' }]); return { ok: true, model: r.model, reply: r.content.slice(0, 40) } } catch (e: any) { return { ok: false, error: String(e?.message ?? e) } }
}
