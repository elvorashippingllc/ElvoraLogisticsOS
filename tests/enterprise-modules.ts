import assert from 'node:assert/strict'
import {syncSchema} from '../src/server/schema'
import {seedReference} from '../src/server/seed'
import {q,tx} from '../src/server/db'
import {loadUser} from '../src/server/auth'
import {createRecord,getDef,updateRecord,getRecord,deleteRecord,SYSTEM_CTX} from '../src/server/engine'
import {issueRfq,compareRfq,awardRfq,publishKnowledge,reviseKnowledge,acknowledgeKnowledge,verifyQualification,revokeQualification,eligibleForActivity,competencyMatrix} from '../src/server/domain/enterprise'
import {transitionWork} from '../src/server/domain/work'
syncSchema();seedReference()
const admin=q.get("SELECT id FROM users WHERE email='admin@elvorashipping.com'")!,manager=q.get("SELECT id FROM users WHERE email='manager@elvorashipping.com'")!
const maker={user:loadUser(admin.id)!},checker={user:loadUser(manager.id)!}
const mk=(key:string,b:any,ctx=maker)=>createRecord(getDef(key),b,ctx)
const vendor=mk('parties',{name:'RFQ provider one',is_vendor:true}),vendor2=mk('parties',{name:'RFQ provider two',is_vendor:true}),vendor3=mk('parties',{name:'Not invited',is_vendor:true})
const future='2099-12-31',rfq=mk('carrier_rfqs',{title:'Ocean request',mode:'Ocean FCL',origin:'Jebel Ali',destination:'Rotterdam',cargo:'1 x 40HC general cargo',response_deadline:future,children:{providers:[{provider_id:vendor.id,email:'one@example.invalid'},{provider_id:vendor2.id,email:'two@example.invalid'}]}})
const offerBody={rfq_id:rfq.id,provider_id:vendor.id,freight:100,local_charges:25,currency:'USD',ex_rate:3.67,transit_days:14,free_days:7,valid_until:future,terms:'Freight and local port charges only; excludes customs duty.',reference:'PROVIDER-001'}
assert.throws(()=>mk('rfq_offers',offerBody),/issued RFQ/)
tx(()=>issueRfq(rfq.id,maker));assert.equal(q.val('SELECT COUNT(*) FROM email_outbox WHERE link_entity=? AND link_id=?','carrier_rfqs',rfq.id),2)
assert.throws(()=>issueRfq(rfq.id,maker),/already/)
assert.throws(()=>updateRecord(getDef('carrier_rfqs'),rfq.id,{cargo:'Changed requirements'},maker),/locked/)
assert.throws(()=>mk('rfq_offers',{...offerBody,provider_id:vendor3.id}),/not invited/)
const offer=mk('rfq_offers',offerBody);assert.equal(offer.total,125);assert.equal(offer.total_aed,458.75)
assert.throws(()=>updateRecord(getDef('rfq_offers'),offer.id,{freight:90},maker),/immutable/)
const revision=mk('rfq_offers',{...offerBody,freight:80,reference:'PROVIDER-002'})
const second=mk('rfq_offers',{...offerBody,provider_id:vendor2.id,currency:'AED',ex_rate:1,freight:400,reference:'SECOND-001'})
const comparison=compareRfq(rfq.id,maker);assert.equal(comparison.history.length,3);assert.equal(comparison.latest.length,2);assert.equal(comparison.latest[0].id,revision.id)
assert.throws(()=>awardRfq(rfq.id,revision.id,'Lowest eligible freight price',maker),/own award/)
assert.throws(()=>awardRfq(rfq.id,offer.id,'Older rate should be rejected',checker),/latest/)
tx(()=>awardRfq(rfq.id,revision.id,'Best compliant rate and transit selected',checker));assert.equal(getRecord(getDef('carrier_rfqs'),rfq.id,maker).award_offer_id,revision.id)
assert.throws(()=>awardRfq(rfq.id,second.id,'Second award must be rejected',checker),/issued RFQ/)
assert.throws(()=>mk('rfq_offers',offerBody),/issued RFQ/)
const content='Reviewed operating instructions. '.repeat(8),article=mk('knowledge_articles',{title:'Air documentation SOP',category:'SOP',owner_id:admin.id,content})
assert.throws(()=>publishKnowledge(article.id,maker),/second authorised/)
tx(()=>publishKnowledge(article.id,checker));assert.throws(()=>updateRecord(getDef('knowledge_articles'),article.id,{content:'Unapproved replacement'},maker),/immutable/)
const ack=tx(()=>acknowledgeKnowledge(article.id,maker));assert.ok(ack.id);assert.throws(()=>acknowledgeKnowledge(article.id,maker),/already acknowledged/)
assert.throws(()=>updateRecord(getDef('knowledge_versions'),ack.version_id,{content:'Tamper'},maker),/read-only/)
tx(()=>reviseKnowledge(article.id,'Update carrier filing instructions',maker));assert.equal(getRecord(getDef('knowledge_articles'),article.id,maker).revision,2)
updateRecord(getDef('knowledge_articles'),article.id,{content:content+'Revision two details.'},maker);tx(()=>publishKnowledge(article.id,checker));tx(()=>acknowledgeKnowledge(article.id,maker))
const versions=q.all('SELECT content,revision,checksum FROM knowledge_versions WHERE article_id=? ORDER BY revision',article.id);assert.equal(versions.length,2);assert.equal(versions[0].content,content.trim());assert.notEqual(versions[0].checksum,versions[1].checksum)
const skill=mk('competencies',{name:'Air freight qualification',discipline:'Air',criteria:'Assess AWB handling and airline documentation accuracy'})
const qual=mk('staff_qualifications',{user_id:admin.id,competency_id:skill.id,level:3,assessed_on:'2026-10-08',expires_on:future,evidence:'Independent assessment certificate REF-AIR-001'})
const dep=q.val<number>('SELECT id FROM departments WHERE code=?','DOC')!
mk('activity_skill_rules',{activity:'Air review',department_id:dep,competency_id:skill.id,minimum_level:2})
assert.equal(eligibleForActivity(admin.id,'Air review',dep),false)
const lead=mk('leads',{company:'Qualification-gated enquiry'})
assert.throws(()=>mk('work_items',{title:'Air review',source_entity:'leads',source_id:lead.id,department_id:dep,activity:'Air review',assignee_id:admin.id}),/current verified qualification/)
assert.throws(()=>verifyQualification(qual.id,maker),/independent assessor/)
tx(()=>verifyQualification(qual.id,checker));assert.equal(eligibleForActivity(admin.id,'Air review',dep),true)
assert.throws(()=>updateRecord(getDef('staff_qualifications'),qual.id,{level:5},maker),/immutable/)
const work=mk('work_items',{title:'Air review',source_entity:'leads',source_id:lead.id,department_id:dep,activity:'Air review',assignee_id:admin.id});transitionWork(work.id,'Waiting','Waiting for supporting documents',maker)
tx(()=>revokeQualification(qual.id,'Certificate withdrawn after review',checker));assert.equal(eligibleForActivity(admin.id,'Air review',dep),false);assert.throws(()=>transitionWork(work.id,'In progress','Resume without current qualification',maker),/no longer meets/)
assert.equal(competencyMatrix(maker).qualifications.find(r=>r.id===qual.id)!.current,false)
const role=mk('roles',{name:'Projects viewer only',permissions:{projects:['view']}}),limitedUser=createRecord(getDef('users'),{name:'Projects-only reader',email:'projects-reader@example.invalid',role_id:role.id,password:'Temporary-test-12345',active:true},SYSTEM_CTX),limited={user:loadUser(limitedUser.id)!}
assert.throws(()=>compareRfq(rfq.id,limited),/permission|access/i);assert.throws(()=>competencyMatrix(limited),/permission|access/i)
assert.throws(()=>deleteRecord(getDef('rfq_offers'),offer.id,maker),/cannot be deleted/)
console.log('Enterprise module controls passed: RFQ issue/queue/history/comparison/independent award; immutable reviewed knowledge versions and acknowledgement; qualification review/revocation, assignment guards and permission checks.')
