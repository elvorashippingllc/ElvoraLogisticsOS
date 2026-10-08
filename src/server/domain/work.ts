import {eligibleForActivity} from './enterprise'
import {q,tx} from '../db'
import {assertCan,can,getDef,getRecord,listRecords,createRecord,patchRecord,audit,SYSTEM_CTX,type Ctx,type Rec} from '../engine'
import {loadUser} from '../auth'
import {bad,nowIso,notFound} from '../util'
import {notify} from '../notify'
import type {Hooks} from '../hooks'
import {WORK_SOURCES} from '../../shared/entities/work'
const manager=(ctx:Ctx)=>can(ctx.user,'projects','approve')||can(ctx.user,'admin','edit')
const active=(s:string)=>['Open','In progress','Waiting'].includes(s)
const defaultMinutes:Record<string,number>={'Quotation':120,'Booking confirmation':240,'BL draft':480,'POD':240}
const addMinutes=(date:string,minutes:number)=>new Date(new Date(date).getTime()+minutes*60000).toISOString()
export const slaHooks:Hooks={beforeSave({rec}){
 if(!Number.isInteger(rec.minutes)||rec.minutes<1||rec.minutes>43200)throw bad('SLA must be 1–43200 elapsed minutes')
 if(!Number.isInteger(rec.priority))throw bad('Policy priority must be an integer')
}}
function source(entity:string,id:number,ctx:Ctx){if(!WORK_SOURCES.includes(entity))throw bad('Unsupported work source');return getRecord(getDef(entity),id,ctx,{children:false})}
function policy(rec:Rec){
 const policies=q.all(`SELECT * FROM sla_policies WHERE active=1 AND deleted_at IS NULL AND lower(activity)=lower(?)`,rec.activity)
 return policies.filter(p=>(!p.customer_id||p.customer_id===rec.customer_id)&&(!p.service||p.service.toLowerCase()===String(rec.service??'').toLowerCase())&&(!p.department_id||p.department_id===rec.department_id)).sort((a,b)=>{
  const score=(p:Rec)=>(p.customer_id?4:0)+(p.service?2:0)+(p.department_id?1:0)
  return score(b)-score(a)||(b.priority??0)-(a.priority??0)||b.id-a.id
 })[0]
}
export const workHooks:Hooks={beforeSave({rec,old,isNew,ctx}){
 const src=source(rec.source_entity,rec.source_id,ctx)
 if(old&&(rec.source_entity!==old.source_entity||rec.source_id!==old.source_id||rec.activity!==old.activity))throw bad('Source and activity are fixed; create a new work item instead')
 if(!Number.isInteger(rec.complexity)||rec.complexity<1||rec.complexity>10)throw bad('Complexity must be 1–10 points')
 rec.source_label=src._title;rec.source_link=rec.source_entity==='jobs'?`/jobs/${src.id}`:`/e/${rec.source_entity}/${src.id}`
 const job=src.job_id?q.get(`SELECT * FROM jobs WHERE id=? AND deleted_at IS NULL`,src.job_id):null
 rec.customer_id=src.client_id??src.customer_id??src.party_id??job?.client_id??null
 rec.service=src.service_type??src.mode??src.department??job?.department??null
 if(ctx.user&&!ctx.system&&!manager(ctx)){
  if(old?.assignee_id&&old.assignee_id!==ctx.user.id)throw bad('Only the owner or queue manager can edit assigned work')
  if(rec.assignee_id!==old?.assignee_id&&rec.assignee_id!==ctx.user.id)throw bad('Only a queue manager can assign work to another person')
 }
 if(rec.assignee_id){const owner=loadUser(rec.assignee_id);if(!owner||owner.party_id||!can(owner,'projects','view')||!can(owner,getDef(rec.source_entity).module,'view'))throw bad('Owner must be active and permitted to see the source record')}
 if(rec.assignee_id&&(!old||rec.assignee_id!==old.assignee_id)&&!eligibleForActivity(rec.assignee_id,rec.activity,rec.department_id))throw bad('Owner lacks a current verified qualification required for this activity')
 if(old&&!active(old.status)&&!ctx.system)throw bad('Completed/cancelled work is locked')
 if(isNew){
  const p=policy(rec);rec.sla_policy_id=p?.id??null;rec.sla_pause_waiting=!!p?.pause_waiting;rec.sla_minutes=p?.minutes??defaultMinutes[rec.activity]??null;rec.started_at=nowIso();rec.due_at=rec.sla_minutes?addMinutes(rec.started_at,rec.sla_minutes):null
  rec.status='Open'
 }
},afterSave({rec,old,isNew}){if(rec.assignee_id&&(isNew||old?.assignee_id!==rec.assignee_id))notify(rec.assignee_id,'Work assigned: '+rec.title,rec.source_label,'/work/queues','assignment')}}
function sourceDone(entity:string,rec:Rec,activity:string):'Completed'|'Cancelled'|null {
 if(rec.job_status==='CANCELLED'||['Cancelled','Void','Rejected','Expired'].includes(rec.status))return 'Cancelled'
 if(activity==='Quotation'&&['Sent','Accepted','Converted to job'].includes(rec.status))return 'Completed'
 if(activity==='Booking confirmation'&&rec.status==='Confirmed')return 'Completed'
 if(activity==='BL draft'&&rec.bl_status&&rec.bl_status!=='PENDING')return 'Completed'
 if(activity==='POD'&&rec.pod_received)return 'Completed'
 return null
}
/** Source hooks keep department queues and their SLA timers tied to actual workflow transitions. */
export function syncWorkQueues(entity:string,rec:Rec){
 let activity='',code='OPS',owner=rec.operator_id??rec.owner_id??rec.created_by
 if(entity==='quotations'){activity='Quotation';code='SAL';owner=rec.salesperson_id??rec.created_by}
 else if(entity==='bookings')activity='Booking confirmation'
 else if(entity==='jobs'&&['Sea','Air'].includes(rec.mode)){activity='BL draft';code='DOC'}
 else if(entity==='shipments'&&rec.status==='Delivered')activity='POD'
 else return
 const key=`${entity}:${rec.id}:${activity}`
 const existing=q.get(`SELECT id,status FROM work_items WHERE dedupe_key=? AND deleted_at IS NULL`,key)
 const done=sourceDone(entity,rec,activity)
 if(existing){if(done&&active(existing.status))patchRecord(getDef('work_items'),existing.id,{status:done,completed_at:nowIso(),resolution:'Source workflow completed automatically',paused_at:null},SYSTEM_CTX);return}
 if(done)return
 const department=q.val<number>(`SELECT id FROM departments WHERE code=? AND deleted_at IS NULL`,code)??q.val<number>(`SELECT id FROM departments WHERE deleted_at IS NULL ORDER BY id LIMIT 1`)
 if(!department)return
 const u=owner?loadUser(owner):null;if(!u||u.party_id||!can(u,'projects','view')||!can(u,getDef(entity).module,'view')||!eligibleForActivity(owner,activity,department))owner=null
 createRecord(getDef('work_items'),{title:`${activity}: ${rec._title}`,source_entity:entity,source_id:rec.id,activity,department_id:department,assignee_id:owner,complexity:1,dedupe_key:key},SYSTEM_CTX)
}
export function transitionWork(id:number,status:string,note:string,ctx:Ctx){
 assertCan(ctx,'projects','edit');const def=getDef('work_items'),r=getRecord(def,id,ctx,{children:false})
 if(!active(r.status))throw bad('Finished work cannot be transitioned')
 if(r.assignee_id!==ctx.user?.id&&!manager(ctx))throw bad('Only the owner or queue manager can change work state')
 if(!['In progress','Waiting','Completed','Cancelled'].includes(status))throw bad('Unknown work status')
 if(status===r.status)throw bad('Work is already in this state')
 if(status==='In progress'&&r.assignee_id&&!eligibleForActivity(r.assignee_id,r.activity,r.department_id))throw bad('Owner no longer meets activity qualification rules')
 const src=source(r.source_entity,r.source_id,ctx)
 if(status==='Completed'&&['Quotation','Booking confirmation','BL draft','POD'].includes(r.activity)&&sourceDone(r.source_entity,src,r.activity)!=='Completed')throw bad('Complete the source workflow before completing this tracked activity')
 if(['Completed','Cancelled'].includes(status)&&note.trim().length<10)throw bad('Record a resolution of at least 10 characters')
 const patch:Rec={status,resolution:note||r.resolution}
 if(status==='Waiting'&&r.sla_pause_waiting&&!r.paused_at)patch.paused_at=nowIso()
 else if(r.paused_at&&status!=='Waiting'){patch.paused_at=null;if(r.due_at)patch.due_at=new Date(new Date(r.due_at).getTime()+Date.now()-new Date(r.paused_at).getTime()).toISOString()}
 if(!active(status))patch.completed_at=nowIso()
 const result=patchRecord(def,id,patch,ctx)
 audit(ctx,def,id,'work_transition',{status,note},r._title)
 return result
}
export function slaTick(){
 for(const row of q.all(`SELECT w.*,p.escalate_to,d.manager_id FROM work_items w LEFT JOIN sla_policies p ON p.id=w.sla_policy_id LEFT JOIN departments d ON d.id=w.department_id WHERE w.deleted_at IS NULL AND w.status IN ('Open','In progress','Waiting') AND w.paused_at IS NULL AND w.breached_at IS NULL AND w.due_at<?`,nowIso()))tx(()=>{
  const claimed=q.run(`UPDATE work_items SET breached_at=? WHERE id=? AND breached_at IS NULL`,nowIso(),row.id)
  if(!claimed.changes)return
  const visible=(id:number|null)=>id&&can(loadUser(id),'projects','view')&&can(loadUser(id),getDef(row.source_entity).module,'view')?id:null
  notify(visible(row.assignee_id),'SLA breached: '+row.title,row.source_label,'/work/queues','alert',`sla-owner-${row.id}`)
  notify(visible(row.escalate_to??row.manager_id),'SLA escalation: '+row.title,row.source_label,'/work/queues','alert',`sla-manager-${row.id}`)
  audit(SYSTEM_CTX,getDef('work_items'),row.id,'sla_breach',{deadline:row.due_at},row.title)
 })
}
export function workOverview(ctx:Ctx){
 assertCan(ctx,'projects','view')
 const items=listRecords(getDef('work_items'),{pageSize:10000},ctx).rows
 const team=manager(ctx)
 const userRows=team?q.all(`SELECT id,name,department_id,work_capacity_points FROM users WHERE active=1 AND party_id IS NULL AND deleted_at IS NULL`):q.all(`SELECT id,name,department_id,work_capacity_points FROM users WHERE id=? AND active=1 AND deleted_at IS NULL`,ctx.user!.id)
 const workload:Rec[]=userRows.map(u=>{
  const assigned=items.filter(i=>i.assignee_id===u.id&&active(i.status)),jobs=can(ctx.user,'jobs','view')?q.val<number>(`SELECT COUNT(*) FROM jobs WHERE operator_id=? AND job_status NOT IN ('CLOSED','CANCELLED') AND deleted_at IS NULL`,u.id)??0:0
  const tasks=q.val<number>(`SELECT COUNT(*) FROM tasks WHERE assignee_id=? AND status NOT IN ('Done','Cancelled') AND deleted_at IS NULL`,u.id)??0
  const points=assigned.reduce((n,i)=>n+i.complexity,0)+jobs*2+tasks,capacity=u.work_capacity_points||40
  return {...u,work_items:assigned.length,jobs,tasks,overdue:assigned.filter(i=>i.due_at&&i.due_at<nowIso()&&!i.paused_at).length,points,capacity,utilization:Math.round(points/capacity*100)}
 })
 const recommendations=team?items.filter(i=>active(i.status)&&i.assignee_id).flatMap(item=>{
  const current=workload.find(u=>u.id===item.assignee_id);if(!current)return []
  const candidate=workload.filter(u=>u.id!==item.assignee_id&&u.department_id===current.department_id&&u.points+item.complexity<current.points&&eligibleForActivity(u.id,item.activity,item.department_id)&&can(loadUser(u.id),getDef(item.source_entity).module,'view')&&can(loadUser(u.id),'projects','view')).sort((a,b)=>a.utilization-b.utilization)[0]
  return candidate?[{work_id:item.id,title:item.title,from:current.name,to_user_id:candidate.id,to:candidate.name,reason:`${current.points} → ${candidate.points} points; same department and source permission`}]:[]
 }):[]
 return {items,workload,recommendations,can_manage:team,departments:q.all(`SELECT id,name FROM departments WHERE deleted_at IS NULL AND active=1`)}
}
export function createHandover(to:number,note:string,ctx:Ctx){
 assertCan(ctx,'projects','create');if(to===ctx.user?.id)throw bad('Choose a different recipient')
 const recipient=loadUser(to);if(!recipient||recipient.party_id||!can(recipient,'projects','view'))throw bad('Recipient must be an active staff user with work access')
 const overview=workOverview(ctx),items=overview.items.filter(i=>i.assignee_id===ctx.user?.id&&active(i.status))
 // Handover only includes records the recipient may read; do not transfer hidden departmental information.
 const permitted=items.filter(i=>can(recipient,getDef(i.source_entity).module,'view'))
 if(permitted.length!==items.length)throw bad('Recipient lacks permission for some outstanding work; choose an authorised recipient')
 const jobs=can(ctx.user,'jobs','view')&&can(recipient,'jobs','view')?q.all(`SELECT id,job_no,job_status,operational_status FROM jobs WHERE operator_id=? AND job_status NOT IN ('CLOSED','CANCELLED') AND deleted_at IS NULL`,ctx.user!.id):[]
 const tasks=q.all(`SELECT id,title,status,due_date,priority FROM tasks WHERE assignee_id=? AND status NOT IN ('Done','Cancelled') AND deleted_at IS NULL`,ctx.user!.id)
 const links=new Set([...items.map(i=>`${i.source_entity}:${i.source_id}`),...jobs.map(j=>`jobs:${j.id}`)])
 const emails=can(ctx.user,'admin','view')&&can(recipient,'admin','view')?q.all(`SELECT id,subject,status,link_entity,link_id FROM email_outbox WHERE status<>'Sent' AND deleted_at IS NULL`).filter(e=>links.has(`${e.link_entity}:${e.link_id}`)):[]
 const exceptions=items.filter(i=>i.breached_at||i.priority==='Critical')
 const r=createRecord(getDef('shift_handovers'),{title:`${ctx.user!.name} → ${recipient.name}`,from_user_id:ctx.user!.id,to_user_id:to,status:'Awaiting acknowledgement',note,sent_at:nowIso(),snapshot:{items:permitted.map(snapshotItem),jobs,tasks,critical_issues:exceptions.map(snapshotItem),pending_communications:emails}}, {...ctx,system:true})
 notify(to,'Shift handover from '+ctx.user!.name,`${items.length} outstanding work items; ${exceptions.length} critical issues`,'/work/handovers','assignment')
 audit(ctx,getDef('shift_handovers'),r.id,'send_handover',{to_user_id:to},r._title)
 return r
}
export function acknowledgeHandover(id:number,note:string,ctx:Ctx){
 assertCan(ctx,'projects','edit');const r=getRecord(getDef('shift_handovers'),id,ctx,{children:false})
 if(r.to_user_id!==ctx.user?.id)throw bad('Only the named recipient can acknowledge this handover')
 if(r.status!=='Awaiting acknowledgement')throw bad('Handover already acknowledged')
 return patchRecord(getDef('shift_handovers'),id,{status:'Acknowledged',acknowledged_at:nowIso(),acknowledgement:note},ctx)
}

function snapshotItem(i:Rec){return Object.fromEntries(['id','title','source_entity','source_id','source_link','status','activity','priority','due_at','breached_at'].map(k=>[k,i[k]]))}
export function handoverRecipients(ctx:Ctx){assertCan(ctx,'projects','view');return q.all('SELECT id,name FROM users WHERE active=1 AND party_id IS NULL AND deleted_at IS NULL').filter(u=>u.id!==ctx.user?.id&&can(loadUser(u.id),'projects','view'))}
