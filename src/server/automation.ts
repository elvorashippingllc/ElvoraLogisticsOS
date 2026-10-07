import { q } from './db'
import { addDays, todayStr } from './util'
import { notify } from './notify'
import { queueEmail } from './mailer'
import { ENTITIES } from '../shared/entities'
import { createRecord, patchRecord, SYSTEM_CTX, type Rec } from './engine'

let depth = 0
const render = (tpl: string, rec: Rec) => tpl.replace(/\{(\w+)\}/g, (_m, n) => String(rec._labels?.[n] ?? rec[n] ?? ''))

function test(op: string, actual: any, expected: string): boolean {
  const a = actual === null || actual === undefined ? '' : String(actual)
  switch (op) {
    case 'equals': return a.toLowerCase() === expected.toLowerCase()
    case 'not equals': return a.toLowerCase() !== expected.toLowerCase()
    case 'contains': return a.toLowerCase().includes(expected.toLowerCase())
    case 'greater than': return Number(a) > Number(expected)
    case 'less than': return Number(a) < Number(expected)
    case 'is empty': return a === ''
    case 'is not empty': return a !== ''
  }
  return false
}

export function runAutomations(entity: string, event: 'created' | 'updated', rec: Rec, _old: Rec | null, diff?: Record<string, [any, any]>) {
  if (depth > 2 || entity === 'automation_rules' || entity === 'tasks' || entity === 'email_outbox') return
  let rules: any[] = []
  try { rules = q.all(`SELECT * FROM automation_rules WHERE entity = ? AND active = 1 AND deleted_at IS NULL`, entity) } catch { return }
  if (!rules.length) return
  depth++
  try {
    for (const r of rules) {
      try {
        const trig: string = r.trigger
        if (trig === 'Record created' && event !== 'created') continue
        if (trig === 'Record updated' && event !== 'updated') continue
        if (trig === 'Status / stage changed to') {
          if (event !== 'updated' || !r.field || !diff?.[r.field]) continue
          if (!test('equals', rec[r.field], r.value ?? '')) continue
        } else if (r.field) {
          if (!test(r.operator ?? 'equals', rec[r.field], r.value ?? '')) continue
        }
        runAction(r, entity, rec)
      } catch { /* a faulty rule must never block the save */ }
    }
  } finally { depth-- }
}

function runAction(r: any, entity: string, rec: Rec) {
  const title = render(r.message || `${r.name}: ${rec._title ?? entity}`, rec)
  const body = render(r.body || '', rec)
  const link = `/e/${entity}/${rec.id}`
  switch (r.action) {
    case 'Create follow-up task':
      createRecord(ENTITIES.tasks, { title, description: body, assignee_id: r.assignee_id ?? undefined, due_date: addDays(todayStr(), Number(r.due_days ?? 1)), kind: 'Follow-up', link_entity: entity, link_id: rec.id, link_label: rec._title }, SYSTEM_CTX)
      break
    case 'Notify user': notify(r.assignee_id, title, body, link, 'automation'); break
    case 'Queue e-mail to address': if (r.target) queueEmail({ to: r.target, subject: title, body, link_entity: entity, link_id: rec.id }); break
    case 'Queue e-mail to customer contact': {
      const partyId = rec.client_id ?? rec.party_id ?? rec.customer_id
      if (!partyId) break
      const c = q.get(`SELECT email FROM contacts WHERE party_id = ? AND deleted_at IS NULL AND email IS NOT NULL AND email <> '' ORDER BY is_primary DESC, id LIMIT 1`, partyId)
        ?? q.get(`SELECT email FROM parties WHERE id = ?`, partyId)
      if (c?.email) queueEmail({ to: c.email, subject: title, body, link_entity: entity, link_id: rec.id })
      break
    }
    case 'Send WhatsApp to customer contact': {
      const partyId = rec.client_id ?? rec.party_id ?? rec.customer_id
      if (partyId) void import('./integrations/whatsapp').then(async m => { for (const ph of m.phonesForParty(partyId).slice(0, 2)) await m.sendWhatsApp(ph, `${title}${body ? '\n' + body : ''}`, { origin: 'automation', party_id: partyId, tpl: 'wa_tpl_notify' }) }).catch(() => {})
      break
    }
    case 'Send WhatsApp to number': if (r.target) void import('./integrations/whatsapp').then(m => m.sendWhatsApp(r.target, `${title}${body ? '\n' + body : ''}`, { origin: 'automation', tpl: 'wa_tpl_notify' })).catch(() => {}); break
    case 'Ask an AI employee to review': void import('./ai/agents').then(m => { const a = q.get(`SELECT id FROM ai_agents WHERE deleted_at IS NULL AND (lower(name) = lower(?) OR role_key = ?) LIMIT 1`, r.target ?? 'Jarvis', r.target ?? 'jarvis'); if (a) return m.runAgent(a.id, `${title}\n${body}\nRecord: ${entity} #${rec.id} (${rec._title ?? ''}). Review it and take the appropriate action.`, 'automation') }).catch(() => {}); break
    case 'Set field value': {
      const [field, ...rest] = String(r.target ?? '').split('=')
      if (field && ENTITIES[entity].fields.some(f => f.name === field.trim())) patchRecord(ENTITIES[entity], rec.id, { [field.trim()]: rest.join('=').trim() }, SYSTEM_CTX)
      break
    }
  }
}
