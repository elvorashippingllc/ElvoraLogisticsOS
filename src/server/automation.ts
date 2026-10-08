import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { q, tx } from './db'
import { addDays, todayStr, nowIso, bad, safeJson } from './util'
import { notify } from './notify'
import { queueEmail } from './mailer'
import { ENTITIES } from '../shared/entities'
import { createRecord, patchRecord, insertRow, getDef, SYSTEM_CTX, type Rec } from './engine'
import type { Hooks } from './hooks'

const lineage=new AsyncLocalStorage<number>()
const render = (tpl: string, rec: Rec) => tpl.replace(/\{(\w+)\}/g, (_m, n) => String(rec._labels?.[n] ?? rec[n] ?? ''))
const external=(action:string)=>action.startsWith('Send WhatsApp') || action==='Ask an AI employee to review'
export const automationRuleHooks: Hooks={beforeSave({rec}) {
  rec.delay_minutes ??=0;rec.max_attempts ??=3
  const def=ENTITIES[rec.entity]
  if(!def || ['automation_rules','workflow_runs','email_outbox','ai_actions','users','roles','api_keys'].includes(rec.entity))throw bad('Select a supported operational record type')
  if(rec.field && !def.fields.some(f=>f.name===rec.field))throw bad('Condition field is not available on this record type')
  if(!Number.isInteger(rec.delay_minutes) || rec.delay_minutes<0 || rec.delay_minutes>10080)throw bad('Delay must be between 0 and 10080 minutes')
  if(!Number.isInteger(rec.max_attempts) || rec.max_attempts<1 || rec.max_attempts>5)throw bad('Max attempts must be between 1 and 5')
  if(rec.action==='Notify user' && !rec.assignee_id)throw bad('Choose the user to notify')
  if(rec.action==='Queue e-mail to address' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec.target??''))throw bad('Enter a valid target email address')
  if(rec.action==='Send WhatsApp to number' && !/^\+?\d[\d\s-]{6,19}$/.test(rec.target??''))throw bad('Enter an international WhatsApp number')
  if(rec.action==='Set field value') {
    const field=String(rec.target??'').split('=')[0].trim(),f=def.fields.find(f=>f.name===field)
    if(!String(rec.target??'').includes('=') || !f || !['text','textarea','bool'].includes(f.type) || f.readonly || f.computed || f.virtual || f.secret || field.endsWith('_id') || /status|approval|paid|balance/i.test(field))throw bad('Workflows can only set ordinary editable fields; statuses, approvals, references and financial state require their domain actions')
  }
}}
function test(op:string,actual:any,expected:string) {
  const a=actual==null?'':String(actual)
  switch(op){case 'equals':return a.toLowerCase()===expected.toLowerCase();case 'not equals':return a.toLowerCase()!==expected.toLowerCase();case 'contains':return a.toLowerCase().includes(expected.toLowerCase());case 'greater than':return Number(a)>Number(expected);case 'less than':return Number(a)<Number(expected);case 'is empty':return !a;case 'is not empty':return !!a;default:return false}
}
/** Enqueued within the originating record transaction: event and workflow commit together. */
export function runAutomations(entity:string,event:'created'|'updated',rec:Rec,_old:Rec|null,diff?:Record<string,[any,any]>) {
  const depth=lineage.getStore()??0
  if(depth>=3 || ['automation_rules','workflow_runs','tasks','email_outbox','ai_actions'].includes(entity))return
  const rules=q.all(`SELECT * FROM automation_rules WHERE entity=? AND active=1 AND deleted_at IS NULL`,entity)
  for(const rule of rules) {
    if(rule.trigger==='Record created' && event!=='created')continue
    if(rule.trigger==='Record updated' && event!=='updated')continue
    if(rule.trigger==='Status / stage changed to') {
      if(event!=='updated' || !rule.field || !diff?.[rule.field] || !test('equals',rec[rule.field],rule.value??''))continue
    }else if(rule.field && !test(rule.operator??'equals',rec[rule.field],rule.value??''))continue
    const key=createHash('sha256').update(JSON.stringify([rule.id,entity,rec.id,rec.version,event])).digest('hex')
    if(q.get(`SELECT id FROM workflow_runs WHERE event_key=?`,key))continue
    insertRow(getDef('workflow_runs'),{label:`${rule.name}: ${rec._title??rec.id}`,rule_id:rule.id,source_entity:entity,record_id:rec.id,event_key:key,status:'Queued',attempts:0,max_attempts:Math.max(1,Math.min(5,rule.max_attempts??3)),depth,next_at:new Date(Date.now()+(rule.delay_minutes??0)*60000).toISOString(),payload:{rule,rec}},SYSTEM_CTX)
  }
}
function internalAction(rule:any,entity:string,rec:Rec) {
  const title=render(rule.message||`${rule.name}: ${rec._title??entity}`,rec),body=render(rule.body||'',rec),link=`/e/${entity}/${rec.id}`
  switch(rule.action) {
    case 'Create follow-up task': return createRecord(ENTITIES.tasks,{title,description:body,assignee_id:rule.assignee_id??undefined,due_date:addDays(todayStr(),Number(rule.due_days??1)),kind:'Follow-up',link_entity:entity,link_id:rec.id,link_label:rec._title},SYSTEM_CTX)
    case 'Notify user': if(!rule.assignee_id)throw bad('Notification recipient is missing');return notify(rule.assignee_id,title,body,link,'automation')
    case 'Queue e-mail to address': if(!rule.target)throw bad('Email recipient is missing');return queueEmail({to:rule.target,subject:title,body,link_entity:entity,link_id:rec.id})
    case 'Queue e-mail to customer contact': {
      const party=rec.client_id??rec.party_id??rec.customer_id
      const c=party&&(q.get(`SELECT email FROM contacts WHERE party_id=? AND deleted_at IS NULL AND email IS NOT NULL AND email<>'' ORDER BY is_primary DESC,id LIMIT 1`,party)??q.get(`SELECT email FROM parties WHERE id=? AND deleted_at IS NULL`,party))
      if(!c?.email)throw bad('Customer email is missing');return queueEmail({to:c.email,subject:title,body,link_entity:entity,link_id:rec.id})
    }
    case 'Set field value': {
      automationRuleHooks.beforeSave!({rec:rule,old:null,isNew:false,children:{},def:getDef('automation_rules'),ctx:SYSTEM_CTX})
      const [key,...value]=String(rule.target).split('='),field=key.trim()
      const current=q.get(`SELECT * FROM "${entity}" WHERE id=? AND deleted_at IS NULL`,rec.id)
      if(!current)throw bad('Source record was deleted')
      if(current.version!==rec.version)throw bad('Source record changed; review this stale field-update action')
      return patchRecord(ENTITIES[entity],rec.id,{[field]:value.join('=').trim()},SYSTEM_CTX)
    }
    default:throw bad('Unsupported workflow action')
  }
}
async function externalAction(rule:any,entity:string,rec:Rec) {
  const title=render(rule.message||`${rule.name}: ${rec._title??entity}`,rec),body=render(rule.body||'',rec),text=`${title}${body?'\n'+body:''}`
  if(rule.action.startsWith('Send WhatsApp')) {
    const m=await import('./integrations/whatsapp'),party=rec.client_id??rec.party_id??rec.customer_id
    const phones=rule.action==='Send WhatsApp to number'?[rule.target]:party?m.phonesForParty(party).slice(0,2):[]
    if(!phones.length)throw bad('WhatsApp recipient is missing')
    for(const phone of phones){const r=await m.sendWhatsApp(phone,text,{origin:'automation',party_id:party,tpl:'wa_tpl_notify'});if(!r.ok)throw bad(r.error??'WhatsApp delivery failed')}
    return
  }
  const m=await import('./ai/agents'),agent=q.get(`SELECT id FROM ai_agents WHERE deleted_at IS NULL AND (lower(name)=lower(?) OR role_key=?) LIMIT 1`,rule.target??'Jarvis',rule.target??'jarvis')
  if(!agent)throw bad('AI employee not found')
  const r=await m.runAgent(agent.id,`${title}\n${body}\nRecord: ${entity} #${rec.id} (${rec._title??''}). Review it and take the appropriate action.`,'automation')
  if(!r.ok)throw bad(r.output)
}
export async function processWorkflowQueue(limit=20) {
  const cutoff=new Date(Date.now()-30*60000).toISOString()
  q.run(`UPDATE workflow_attempts SET status='Needs review',finished_at=?,error='Worker interrupted; inspect external effects' WHERE status='Running' AND started_at<?`,nowIso(),cutoff)
  q.run(`UPDATE workflow_runs SET status='Needs review',error='Worker interrupted: inspect possible external effects before any replay' WHERE status='Running' AND started_at<?`,cutoff)
  for(const job of q.all(`SELECT * FROM workflow_runs WHERE status='Queued' AND next_at<=? AND deleted_at IS NULL ORDER BY next_at,id LIMIT ?`,nowIso(),limit)) {
    let payload:any=safeJson(job.payload,{})
    if(typeof payload==='string')payload=safeJson(payload,{})
    const rule=payload.rule,rec=payload.rec
    if(!rule || !rec){q.run(`UPDATE workflow_runs SET status='Failed',error='Invalid event snapshot' WHERE id=? AND status='Queued'`,job.id);continue}
    if(!ENTITIES[job.source_entity] || !q.get(`SELECT id FROM "${job.source_entity}" WHERE id=? AND deleted_at IS NULL`,job.record_id)){q.run(`UPDATE workflow_runs SET status='Cancelled',error='Source record deleted',finished_at=? WHERE id=? AND status='Queued'`,nowIso(),job.id);continue}
    const live=q.get(`SELECT active,deleted_at,version FROM automation_rules WHERE id=?`,job.rule_id)
    if(!live?.active || live.deleted_at || live.version!==rule.version){q.run(`UPDATE workflow_runs SET status='Cancelled',error='Rule disabled, edited or deleted',finished_at=? WHERE id=? AND status='Queued'`,nowIso(),job.id);continue}
    if(external(rule.action)) {
      const attempt=tx(()=>{
        const claim=q.run(`UPDATE workflow_runs SET status='Running',attempts=attempts+1,started_at=? WHERE id=? AND status='Queued'`,nowIso(),job.id)
        if(!claim.changes)return null
        return insertRow(getDef('workflow_attempts'),{run_id:job.id,attempt_no:job.attempts+1,started_at:nowIso(),status:'Running'})
      })
      if(!attempt)continue
      try{await lineage.run(job.depth+1,()=>externalAction(rule,job.source_entity,rec));q.run(`UPDATE workflow_runs SET status='Succeeded',finished_at=?,error=NULL WHERE id=?`,nowIso(),job.id);q.run(`UPDATE workflow_attempts SET status='Succeeded',finished_at=? WHERE id=?`,nowIso(),attempt)}catch(e:any){q.run(`UPDATE workflow_runs SET status='Needs review',finished_at=?,error=? WHERE id=?`,nowIso(),String(e?.message??e).slice(0,2000),job.id);q.run(`UPDATE workflow_attempts SET status='Needs review',finished_at=?,error=? WHERE id=?`,nowIso(),String(e?.message??e).slice(0,2000),attempt)}
    }else {
      try{tx(()=>{
        const claim=q.run(`UPDATE workflow_runs SET status='Running',attempts=attempts+1,started_at=? WHERE id=? AND status='Queued'`,nowIso(),job.id)
        if(!claim.changes)return
        const started=nowIso()
        lineage.run(job.depth+1,()=>internalAction(rule,job.source_entity,rec))
        insertRow(getDef('workflow_attempts'),{run_id:job.id,attempt_no:job.attempts+1,started_at:started,finished_at:nowIso(),status:'Succeeded'})
        q.run(`UPDATE workflow_runs SET status='Succeeded',finished_at=?,error=NULL WHERE id=?`,nowIso(),job.id)
      })}catch(e:any){
        const attempts=job.attempts+1,next=new Date(Date.now()+Math.min(3600,60*2**(attempts-1))*1000).toISOString()
        tx(()=>{
          const saved=q.run(`UPDATE workflow_runs SET status=?,attempts=?,next_at=?,error=? WHERE id=? AND status='Queued'`,attempts>=job.max_attempts?'Failed':'Queued',attempts,next,String(e?.message??e).slice(0,2000),job.id)
          if(saved.changes)insertRow(getDef('workflow_attempts'),{run_id:job.id,attempt_no:attempts,started_at:nowIso(),finished_at:nowIso(),status:'Failed',error:String(e?.message??e).slice(0,2000)})
        })
      }
    }
  }
}
