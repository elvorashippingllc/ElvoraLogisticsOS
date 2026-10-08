import assert from 'node:assert/strict'
import {syncSchema} from '../src/server/schema'
import {seedReference} from '../src/server/seed'
import {q,tx} from '../src/server/db'
import {createRecord,getDef,SYSTEM_CTX,patchRecord} from '../src/server/engine'
import {processWorkflowQueue,runAutomations} from '../src/server/automation'
const mk=(key:string,body:any)=>createRecord(getDef(key),body,SYSTEM_CTX)
syncSchema();seedReference()
if(process.argv[2]==='resume') {
 const job=q.get(`SELECT * FROM workflow_runs WHERE label LIKE 'Persistent%: %' AND status='Queued'`)!;assert.ok(job)
 q.run(`UPDATE workflow_runs SET next_at='2000-01-01T00:00:00.000Z' WHERE id=?`,job.id)
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,job.id),'Succeeded')
 console.log('Workflow process-restart persistence passed.')
}else{
 const r=mk('automation_rules',{name:'Good lead follow-up',entity:'leads',trigger:'Record created',action:'Create follow-up task',message:'Follow up {company}',active:true})
 const lead=mk('leads',{company:'Workflow prospect'})
 const job=q.get(`SELECT * FROM workflow_runs WHERE rule_id=? AND record_id=?`,r.id,lead.id)!;assert.ok(job)
 runAutomations('leads','created',lead,null);assert.equal(q.val(`SELECT COUNT(*) FROM workflow_runs WHERE rule_id=? AND record_id=?`,r.id,lead.id),1)
 await Promise.all([processWorkflowQueue(),processWorkflowQueue()])
 assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,job.id),'Succeeded')
 assert.equal(q.val(`SELECT COUNT(*) FROM tasks WHERE link_entity='leads' AND link_id=?`,lead.id),1)
 assert.equal(q.val(`SELECT COUNT(*) FROM workflow_attempts WHERE run_id=?`,job.id),1)
 const before=q.val<number>(`SELECT COUNT(*) FROM workflow_runs`)
 assert.throws(()=>tx(()=>{mk('leads',{company:'Rolled back prospect'});throw Error('Abort transaction')}),/Abort/)
 assert.equal(q.val(`SELECT COUNT(*) FROM workflow_runs`),before)
 assert.equal(q.val(`SELECT COUNT(*) FROM leads WHERE company='Rolled back prospect'`),0)
 patchRecord(getDef('automation_rules'),r.id,{active:false},SYSTEM_CTX)
 const delayed=mk('automation_rules',{name:'Delayed follow-up',entity:'leads',trigger:'Record created',action:'Create follow-up task',message:'Later {company}',delay_minutes:60})
 const dl=mk('leads',{company:'Delayed prospect'}),dj=q.get(`SELECT * FROM workflow_runs WHERE rule_id=? AND record_id=?`,delayed.id,dl.id)!
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,dj.id),'Queued')
 patchRecord(getDef('automation_rules'),delayed.id,{message:'Edited rule'},SYSTEM_CTX)
 q.run(`UPDATE workflow_runs SET next_at='2000-01-01T00:00:00.000Z' WHERE id=?`,dj.id)
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,dj.id),'Cancelled')
 patchRecord(getDef('automation_rules'),delayed.id,{active:false},SYSTEM_CTX)
 const failing=mk('automation_rules',{name:'Failing task',entity:'leads',trigger:'Record created',action:'Create follow-up task',message:'{unknown_field}',max_attempts:2})
 const fl=mk('leads',{company:'Failure prospect'}),fj=q.get(`SELECT * FROM workflow_runs WHERE rule_id=? AND record_id=?`,failing.id,fl.id)!
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,fj.id),'Queued');assert.equal(q.val(`SELECT attempts FROM workflow_runs WHERE id=?`,fj.id),1)
 q.run(`UPDATE workflow_runs SET next_at='2000-01-01T00:00:00.000Z' WHERE id=?`,fj.id)
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,fj.id),'Failed');assert.equal(q.val(`SELECT COUNT(*) FROM workflow_attempts WHERE run_id=? AND status='Failed'`,fj.id),2)
 assert.equal(q.val(`SELECT COUNT(*) FROM tasks WHERE link_entity='leads' AND link_id=?`,fl.id),0)
 patchRecord(getDef('automation_rules'),failing.id,{active:false},SYSTEM_CTX)
 assert.throws(()=>mk('automation_rules',{name:'Bypass closure',entity:'jobs',trigger:'Record updated',action:'Set field value',target:'job_status=CLOSED'}),/ordinary editable fields/)
 const wa=mk('automation_rules',{name:'Unconfigured WhatsApp',entity:'leads',trigger:'Record created',action:'Send WhatsApp to number',target:'+971500000000',message:'Test without provider'})
 const wl=mk('leads',{company:'Unconfigured provider prospect'}),wj=q.get(`SELECT * FROM workflow_runs WHERE rule_id=? AND record_id=?`,wa.id,wl.id)!
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,wj.id),'Needs review');await processWorkflowQueue();assert.equal(q.val(`SELECT attempts FROM workflow_runs WHERE id=?`,wj.id),1)
 patchRecord(getDef('automation_rules'),wa.id,{active:false},SYSTEM_CTX)
 const begin=mk('automation_rules',{name:'Chain begin',entity:'leads',trigger:'Record created',action:'Set field value',target:'notes=beta'})
 const back=mk('automation_rules',{name:'Chain back',entity:'leads',trigger:'Record updated',field:'notes',operator:'equals',value:'beta',action:'Set field value',target:'notes=alpha'})
 const forth=mk('automation_rules',{name:'Chain forth',entity:'leads',trigger:'Record updated',field:'notes',operator:'equals',value:'alpha',action:'Set field value',target:'notes=beta'})
 const chained=mk('leads',{company:'Bounded chain prospect',notes:'alpha'})
 for(let i=0;i<6;i++)await processWorkflowQueue()
 assert.equal(q.val(`SELECT COUNT(*) FROM workflow_runs WHERE source_entity='leads' AND record_id=?`,chained.id),3)
 for(const rule of [begin,back,forth])patchRecord(getDef('automation_rules'),rule.id,{active:false},SYSTEM_CTX)
 const staleRule=mk('automation_rules',{name:'Stale field update',entity:'leads',trigger:'Record created',action:'Set field value',target:'notes=Old plan',max_attempts:1})
 const staleLead=mk('leads',{company:'Stale prospect'}),stale=q.get(`SELECT id FROM workflow_runs WHERE rule_id=? AND record_id=?`,staleRule.id,staleLead.id)!
 patchRecord(getDef('leads'),staleLead.id,{notes:'New live plan'},SYSTEM_CTX)
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,stale.id),'Failed');assert.equal(q.val(`SELECT notes FROM leads WHERE id=?`,staleLead.id),'New live plan')
 const deleted=mk('leads',{company:'Deleted prospect'}),deletedJob=q.get(`SELECT id FROM workflow_runs WHERE rule_id=? AND record_id=?`,staleRule.id,deleted.id)!
 q.run(`UPDATE leads SET deleted_at='2026-10-08T12:00:00Z' WHERE id=?`,deleted.id)
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,deletedJob.id),'Cancelled')
 patchRecord(getDef('automation_rules'),staleRule.id,{active:false},SYSTEM_CTX)
 q.run(`UPDATE workflow_runs SET status='Running',started_at='2000-01-01T00:00:00.000Z' WHERE id=?`,wj.id)
 await processWorkflowQueue();assert.equal(q.val(`SELECT status FROM workflow_runs WHERE id=?`,wj.id),'Needs review');assert.equal(q.val(`SELECT attempts FROM workflow_runs WHERE id=?`,wj.id),1)
 mk('automation_rules',{name:'Persistent follow-up',entity:'leads',trigger:'Record created',action:'Create follow-up task',message:'Persistent {company}',delay_minutes:60})
 mk('leads',{company:'Persistent prospect'})
 console.log('Workflow controls passed: atomic enqueue/rollback, event deduplication, one internal execution, delays, edited-rule cancellation, durable retries/attempt history, dead letter, prohibited state changes, external uncertainty without replay, bounded recursive chains, stale field updates, deleted-source cancellation and interrupted-worker review.')
}
