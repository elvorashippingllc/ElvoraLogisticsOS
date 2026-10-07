import { q } from '../db'
import { getSetting } from '../settings'
import { chat, aiConfigured, type ChatMsg, type ToolDef } from './llm'
import { TOOLS, toolByName, type Tool } from './tools'
import { AGENT_TEMPLATES } from './templates'
import { AGENT_AUTONOMY } from '../../shared/entities/automation'
import { createRecord, getDef, insertRow, SYSTEM_CTX } from '../engine'
import { nowLocal, nowIso, todayStr, safeJson, bad } from '../util'
import { notifyRole } from '../notify'
import { queueEmail } from '../mailer'
import { messageOwners } from '../integrations/whatsapp'
import { logIntegration } from '../integrations/log'
import { businessSnapshot } from '../integrations/snapshot'

const MAX_STEPS = 8

export function ensureAgents() {
  for (const t of AGENT_TEMPLATES) {
    if (q.get(`SELECT id FROM ai_agents WHERE role_key = ? AND deleted_at IS NULL`, t.key)) continue
    if (q.val(`SELECT 1 FROM settings WHERE key = ?`, `seed:agent:${t.key}`)) continue
    createRecord(getDef('ai_agents'), { name: t.name, title: t.title, avatar: t.avatar, instructions: t.instructions, autonomy: t.autonomy, schedule: t.schedule, run_hour: t.run_hour, deliver_to: t.deliver_to, tools: t.tools, active: false, role_key: t.key }, SYSTEM_CTX)
    q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, `seed:agent:${t.key}`, nowIso())
  }
}

const autonomyLevel = (a: string) => Math.max(0, AGENT_AUTONOMY.indexOf(a))
const allowed = (agent: any): Tool[] => {
  const spec = String(agent.tools ?? '*').trim()
  if (spec === '*' || !spec) return TOOLS
  const names = new Set(spec.split(',').map(s => s.trim()))
  return TOOLS.filter(t => names.has(t.name))
}
const toDef = (t: Tool): ToolDef => ({ name: t.name, description: `${t.description}${t.risk !== 'read' ? ` [${t.risk === 'external' ? 'sends outside the company' : 'changes data'}]` : ''}`, parameters: t.parameters })

function systemPrompt(agent: any, channel: string) {
  const ctx = String(getSetting('ai_company_context') || '')
  return [
    `You are ${agent.name}, ${agent.title || 'an AI employee'} at ${getSetting('company_name')} (UAE freight forwarding & logistics). Today is ${todayStr()} (Asia/Dubai). Currency is AED unless stated.`,
    ctx ? `Company notes from the founder: ${ctx}` : '',
    `Your standing instructions:\n${agent.instructions}`,
    `Rules: be accurate and concise. Use the provided tools to read live data and to act. Actions that change data or contact people may be held for the founder's approval – if a tool says it was queued, do not retry it, just mention it. Never reveal credentials. Never invent data. Channel: ${channel}${channel === 'whatsapp' ? ' – reply in under 900 characters, plain text, no markdown' : ''}.`,
  ].filter(Boolean).join('\n\n')
}

function queueAction(agent: any, runId: number | null, tool: Tool, args: any): string {
  const id = insertRow(getDef('ai_actions'), { agent_id: agent.id, run_id: runId, tool: tool.name, summary: tool.summarize?.(args) ?? `${tool.name} ${JSON.stringify(args).slice(0, 200)}`, args, status: 'Pending', created: nowLocal() })
  notifyRole('ai', `${agent.name} needs approval`, tool.summarize?.(args) ?? tool.name, '/ai?tab=approvals', 'approval', `aiact-${id}`)
  return JSON.stringify({ queued_for_approval: true, action_id: id, note: 'The founder must approve this before it happens.' })
}

async function execTool(agent: any, runId: number | null, name: string, args: any, tools: Tool[]): Promise<string> {
  const tool = tools.find(t => t.name === name)
  if (!tool) return JSON.stringify({ error: `Unknown or not permitted tool "${name}"` })
  const lvl = autonomyLevel(agent.autonomy)
  const needsApproval = tool.risk !== 'read' && (lvl === 0 || (lvl === 1 && tool.risk === 'external'))
  if (needsApproval) return queueAction(agent, runId, tool, args)
  try { const out = await tool.run(args ?? {}, { agent: agent.name }); return JSON.stringify(out ?? { ok: true }).slice(0, 7000) } catch (e: any) { return JSON.stringify({ error: String(e?.message ?? e).slice(0, 300) }) }
}

/** The agent loop: think → call tools → think … → final answer. */
async function loop(agent: any, messages: ChatMsg[], runId: number | null, channel: string): Promise<{ text: string; steps: number; tokens: number; model: string }> {
  const tools = allowed(agent)
  const defs = tools.map(toDef)
  let tokens = 0, model = '', steps = 0
  for (; steps < MAX_STEPS; steps++) {
    const r = await chat(messages, defs, agent.model || undefined)
    tokens += r.tokens; model = r.model
    if (!r.tool_calls.length) return { text: r.content || '(no answer)', steps: steps + 1, tokens, model }
    messages.push({ role: 'assistant', content: r.content || null, tool_calls: r.tool_calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) })
    for (const c of r.tool_calls) messages.push({ role: 'tool', tool_call_id: c.id, name: c.name, content: await execTool(agent, runId, c.name, c.args, tools) })
  }
  messages.push({ role: 'user', content: 'Stop calling tools now and write your final answer from what you have.' })
  const fin = await chat(messages, undefined, agent.model || undefined)
  return { text: fin.content || '(no answer)', steps, tokens: tokens + fin.tokens, model: fin.model }
}

export async function runAgent(agentId: number, task?: string, trigger = 'manual'): Promise<{ run_id: number; output: string; ok: boolean }> {
  const agent = q.get(`SELECT * FROM ai_agents WHERE id = ? AND deleted_at IS NULL`, agentId)
  if (!agent) throw bad('Agent not found')
  if (!aiConfigured()) throw bad('AI is not configured yet. Open Integrations → AI and choose a provider (free options: Groq, OpenRouter :free models, Ollama).')
  const prompt = task || `Run your standing routine now. Today is ${todayStr()}.`
  const runId = insertRow(getDef('ai_runs'), { agent_id: agentId, started_at: nowLocal(), trigger, status: 'running', input: prompt })
  try {
    const res = await loop(agent, [{ role: 'system', content: systemPrompt(agent, 'report') }, { role: 'user', content: prompt }], runId, 'report')
    q.run(`UPDATE ai_runs SET status='ok', output=?, steps=?, tokens=?, model=? WHERE id=?`, res.text, res.steps, res.tokens, res.model, runId)
    q.run(`UPDATE ai_agents SET last_run_at=?, last_status='ok' WHERE id=?`, nowLocal(), agentId)
    await deliver(agent, res.text, trigger)
    return { run_id: runId, output: res.text, ok: true }
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 400)
    q.run(`UPDATE ai_runs SET status='failed', error=? WHERE id=?`, msg, runId)
    q.run(`UPDATE ai_agents SET last_run_at=?, last_status='failed' WHERE id=?`, nowLocal(), agentId)
    logIntegration('ai', 'run', false, `${agent.name}: ${msg}`)
    return { run_id: runId, output: msg, ok: false }
  }
}

async function deliver(agent: any, text: string, trigger: string) {
  notifyRole('ai', `${agent.avatar ?? ''} ${agent.name}: report ready`, text.slice(0, 200), '/ai?tab=activity', 'info', `ai-${agent.id}-${nowLocal()}`)
  if (trigger === 'manual') return
  if (agent.deliver_to?.includes('WhatsApp')) await messageOwners(`${agent.avatar ?? ''} ${agent.name}\n${text.slice(0, 1200)}`, 'agent', 'wa_tpl_report')
  if (agent.deliver_to?.includes('e-mail')) { const to = q.val<string>(`SELECT u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'Admin' AND u.deleted_at IS NULL ORDER BY u.id LIMIT 1`); if (to) queueEmail({ to, subject: `${agent.name} – report ${todayStr()}`, body: text }) }
}

/** Conversational use (web chat or WhatsApp): the caller supplies history. */
export async function chatWithAgent(nameOrId: string | number, message: string, o: { channel?: string; history?: { role: 'user' | 'assistant'; content: string }[] } = {}): Promise<string> {
  const agent = typeof nameOrId === 'number' ? q.get(`SELECT * FROM ai_agents WHERE id = ? AND deleted_at IS NULL`, nameOrId) : q.get(`SELECT * FROM ai_agents WHERE lower(name) = lower(?) AND deleted_at IS NULL`, nameOrId)
  if (!agent) throw bad('Agent not found')
  if (!aiConfigured()) throw bad('AI is not configured yet. Open Integrations → AI.')
  const channel = o.channel ?? 'chat'
  const msgs: ChatMsg[] = [{ role: 'system', content: systemPrompt(agent, channel) }, ...(o.history ?? []).slice(-12).map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }]
  const runId = insertRow(getDef('ai_runs'), { agent_id: agent.id, started_at: nowLocal(), trigger: channel, status: 'running', input: message.slice(0, 2000) })
  try {
    const res = await loop(agent, msgs, runId, channel)
    q.run(`UPDATE ai_runs SET status='ok', output=?, steps=?, tokens=?, model=? WHERE id=?`, res.text, res.steps, res.tokens, res.model, runId)
    return res.text
  } catch (e: any) { q.run(`UPDATE ai_runs SET status='failed', error=? WHERE id=?`, String(e?.message ?? e).slice(0, 400), runId); throw e }
}

export async function decideAction(id: number, approve: boolean, userId: number): Promise<{ status: string; result?: any }> {
  const a = q.get(`SELECT * FROM ai_actions WHERE id = ?`, id)
  if (!a) throw bad('Action not found')
  if (a.status !== 'Pending') throw bad(`Already ${a.status.toLowerCase()}`)
  if (!approve) { q.run(`UPDATE ai_actions SET status='Rejected', decided_at=?, decided_by=? WHERE id=?`, nowLocal(), userId, id); return { status: 'Rejected' } }
  const tool = toolByName(a.tool)
  const agent = q.get(`SELECT name FROM ai_agents WHERE id = ?`, a.agent_id)
  if (!tool) { q.run(`UPDATE ai_actions SET status='Failed', result='Unknown tool', decided_at=?, decided_by=? WHERE id=?`, nowLocal(), userId, id); return { status: 'Failed' } }
  try {
    let args: any = safeJson(a.args, {}); if (typeof args === 'string') args = safeJson(args, {})
    const out = await tool.run(args, { agent: agent?.name ?? 'AI' })
    if (out && typeof out === 'object' && (out as any).error) { q.run(`UPDATE ai_actions SET status='Failed', result=?, decided_at=?, decided_by=? WHERE id=?`, String((out as any).error), nowLocal(), userId, id); return { status: 'Failed', result: out } }
    q.run(`UPDATE ai_actions SET status='Executed', result=?, decided_at=?, decided_by=? WHERE id=?`, JSON.stringify(out ?? { ok: true }).slice(0, 2000), nowLocal(), userId, id)
    return { status: 'Executed', result: out }
  } catch (e: any) { q.run(`UPDATE ai_actions SET status='Failed', result=?, decided_at=?, decided_by=? WHERE id=?`, String(e?.message ?? e).slice(0, 500), nowLocal(), userId, id); return { status: 'Failed', result: String(e?.message ?? e) } }
}

/** Called by the hourly scheduler. */
export async function runDueAgents() {
  if (!aiConfigured()) return
  const hour = Number(nowLocal().slice(11, 13)), today = todayStr(), dow = new Date(today + 'T12:00:00Z').getUTCDay()
  for (const a of q.all(`SELECT * FROM ai_agents WHERE active = 1 AND deleted_at IS NULL AND schedule <> 'Manual only'`)) {
    const last = String(a.last_run_at ?? '')
    const due = a.schedule === 'Hourly' ? last.slice(0, 13) !== nowLocal().slice(0, 13)
      : a.schedule === 'Daily' ? hour >= (a.run_hour ?? 8) && last.slice(0, 10) !== today
      : a.schedule.startsWith('Weekly') ? dow === 1 && hour >= (a.run_hour ?? 8) && last.slice(0, 10) !== today : false
    if (due) { try { await runAgent(a.id, undefined, 'schedule') } catch { /* logged inside */ } }
  }
}
export const latestBrief = () => q.get(`SELECT r.output, r.started_at, a.name FROM ai_runs r JOIN ai_agents a ON a.id = r.agent_id WHERE r.status = 'ok' AND r.trigger = 'schedule' AND a.role_key = 'jarvis' ORDER BY r.id DESC LIMIT 1`) ?? { output: businessSnapshot().text, started_at: nowLocal(), name: 'Snapshot' }
