import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { q } from '../src/server/db'
import { createRecord, getDef, insertRow, SYSTEM_CTX } from '../src/server/engine'
import { decideAction } from '../src/server/ai/agents'
import { toolByName } from '../src/server/ai/tools'
syncSchema();seedReference()
const agent=createRecord(getDef('ai_agents'),{name:'Race-test agent',instructions:'Exercise deterministic approval concurrency controls',tools:'create_task',autonomy:'Autopilot (act, then report)',active:false},SYSTEM_CTX)
const tool=toolByName('create_task')!,original=tool.run
let calls=0,release!:()=>void
const waiting=new Promise<void>(r=>release=r)
tool.run=async()=>{calls++;await waiting;return {ok:true}}
try {
 const id=insertRow(getDef('ai_actions'),{agent_id:agent.id,tool:'create_task',args:{title:'Concurrency test'},status:'Pending',summary:'One execution',created:'2026-10-08T12:00'})
 const first=decideAction(id,true,1)
 await assert.rejects(decideAction(id,true,2),/Already executing|already been claimed/)
 assert.equal(calls,1);release();assert.equal((await first).status,'Executed')
 await assert.rejects(decideAction(id,true,1),/Already executed/)
 const revoked=insertRow(getDef('ai_actions'),{agent_id:agent.id,tool:'create_task',args:{title:'Revoked'},status:'Pending',summary:'Revoked capability',created:'2026-10-08T12:00'})
 q.run(`UPDATE ai_agents SET tools='search_jobs' WHERE id=?`,agent.id)
 assert.equal((await decideAction(revoked,true,1)).status,'Failed');assert.equal(calls,1)
 const prohibited=insertRow(getDef('ai_actions'),{agent_id:agent.id,tool:'post_journal',args:{},status:'Pending',summary:'Prohibited capability',created:'2026-10-08T12:00'})
 assert.equal((await decideAction(prohibited,true,1)).status,'Failed');assert.equal(calls,1)
 console.log('AI controls passed: one execution under simultaneous decisions, repeat blocked, revoked and prohibited capabilities blocked.')
}finally{tool.run=original}
