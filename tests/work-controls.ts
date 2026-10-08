import assert from 'node:assert/strict'
import {syncSchema} from '../src/server/schema'
import {seedReference} from '../src/server/seed'
import {q,tx} from '../src/server/db'
import {createRecord,getDef,getRecord,listRecords,SYSTEM_CTX,patchRecord,updateRecord} from '../src/server/engine'
import {loadUser} from '../src/server/auth'
import {transitionWork,slaTick,workOverview,createHandover,acknowledgeHandover} from '../src/server/domain/work'
syncSchema();seedReference()
const mk=(key:string,b:any)=>createRecord(getDef(key),b,SYSTEM_CTX)
const admin=q.get(`SELECT id FROM users WHERE email='admin@elvorashipping.com'`)!,manager=q.get(`SELECT id FROM users WHERE email='manager@elvorashipping.com'`)!
const maker={user:loadUser(admin.id)!},checker={user:loadUser(manager.id)!}
const party=mk('parties',{name:'Work test customer',is_customer:true}),dep=q.get(`SELECT id FROM departments WHERE code='SAL'`)!
const generic=mk('sla_policies',{name:'Generic quotations',activity:'Quotation',minutes:60,priority:100,pause_waiting:false})
const specific=mk('sla_policies',{name:'Customer quotations',activity:'Quotation',customer_id:party.id,department_id:dep.id,minutes:15,pause_waiting:true,escalate_to:manager.id})
assert.throws(()=>mk('sla_policies',{name:'Invalid duration',activity:'Quotation',minutes:0}),/elapsed minutes/)
const quote=mk('quotations',{customer_id:party.id,mode:'Air',salesperson_id:admin.id})
const item=q.get(`SELECT * FROM work_items WHERE source_entity='quotations' AND source_id=?`,quote.id)!
assert.ok(item);assert.equal(item.sla_policy_id,specific.id);assert.equal(new Date(item.due_at).getTime()-new Date(item.started_at).getTime(),15*60000)
patchRecord(getDef('quotations'),quote.id,{notes:'Source update'},SYSTEM_CTX)
assert.equal(q.val(`SELECT COUNT(*) FROM work_items WHERE source_entity='quotations' AND source_id=?`,quote.id),1)
assert.throws(()=>transitionWork(item.id,'Completed','Quotation prepared successfully',maker),/source workflow/)
transitionWork(item.id,'Waiting','Waiting for customer rates',maker)
q.run(`UPDATE work_items SET paused_at='2026-01-01T00:00:00.000Z',due_at='2026-01-01T01:00:00.000Z' WHERE id=?`,item.id)
slaTick();assert.equal(q.val(`SELECT breached_at FROM work_items WHERE id=?`,item.id),null)
transitionWork(item.id,'In progress','Customer provided revised rates',maker)
assert.ok(new Date(q.val<string>(`SELECT due_at FROM work_items WHERE id=?`,item.id)!).getTime()>Date.now())
q.run(`UPDATE work_items SET due_at='2020-01-01T00:00:00.000Z' WHERE id=?`,item.id)
slaTick();slaTick();assert.ok(q.val(`SELECT breached_at FROM work_items WHERE id=?`,item.id));assert.equal(q.val(`SELECT COUNT(*) FROM notifications WHERE dedupe_key=?`,'sla-owner-'+item.id),1)
const overview=workOverview(maker);assert.ok(overview.items.some(i=>i.id===item.id));assert.ok(overview.workload.some(u=>u.id===admin.id&&u.points>0))
const handover=tx(()=>createHandover(manager.id,'Rates pending; follow up customer today',maker))
assert.ok(handover.snapshot.items.some((i:any)=>i.id===item.id));assert.ok(handover.snapshot.critical_issues.some((i:any)=>i.id===item.id));assert.equal(handover.snapshot.items[0].customer_id,undefined)
assert.throws(()=>acknowledgeHandover(handover.id,'I am the sender, not recipient',maker),/named recipient/)
assert.equal(tx(()=>acknowledgeHandover(handover.id,'Received; customer follow-up accepted',checker)).status,'Acknowledged')
assert.throws(()=>acknowledgeHandover(handover.id,'Duplicate acknowledgement is rejected',checker),/already acknowledged/)
const role=mk('roles',{name:'Work-only permission test',permissions:{projects:['view','create','edit']}})
const staff=mk('users',{name:'Limited work user',email:'limited-work@test.invalid',role_id:role.id,password:'Temporary-Test-12345',active:true})
const limited={user:loadUser(staff.id)!}
assert.equal(listRecords(getDef('work_items'),{},limited).rows.some(i=>i.id===item.id),false)
assert.throws(()=>getRecord(getDef('work_items'),item.id,limited),/not found/i)
assert.throws(()=>createHandover(staff.id,'Unpermitted source cannot be sent',maker),/lacks permission/)
assert.equal(listRecords(getDef('shift_handovers'),{},limited).rows.length,0)
assert.throws(()=>getRecord(getDef('shift_handovers'),handover.id,limited),/not found/i)
assert.throws(()=>updateRecord(getDef('users'),admin.id,{work_capacity_points:-1},maker),/Work capacity/)
assert.throws(()=>updateRecord(getDef('work_items'),item.id,{assignee_id:staff.id},maker),/Owner must be active/)
// A recipient losing source permission cannot read a previously captured source snapshot.
q.run(`UPDATE users SET role_id=? WHERE id=?`,role.id,manager.id)
const restricted=getRecord(getDef('shift_handovers'),handover.id,{user:loadUser(manager.id)!})
assert.equal(restricted.snapshot.items.length,0);assert.ok(restricted.snapshot.hidden_items>0)
patchRecord(getDef('quotations'),quote.id,{status:'Sent'},SYSTEM_CTX)
assert.equal(q.val(`SELECT status FROM work_items WHERE id=?`,item.id),'Completed')
assert.throws(()=>transitionWork(item.id,'In progress','Reopen completed tracked work',maker),/Finished work/)
const lead=mk('leads',{company:'Custom activity customer'})
const custom=mk('work_items',{title:'Investigate enquiry',source_entity:'leads',source_id:lead.id,activity:'Investigation',department_id:dep.id,assignee_id:admin.id})
transitionWork(custom.id,'Completed','Enquiry investigated and recorded',maker)
assert.equal(q.val(`SELECT status FROM work_items WHERE id=?`,custom.id),'Completed')
console.log('Work controls passed: source sync/deduplication, policy specificity, pause/resume, one-time breach escalation, workload, handover acknowledgement and permissions.')
