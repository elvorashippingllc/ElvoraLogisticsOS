import {createHash} from 'node:crypto'
import {q} from '../db'
import {assertCan,getRecord,getDef,createRecord,patchRecord,listRecords,audit,type Ctx,type Rec} from '../engine'
import type {Hooks} from '../hooks'
import {bad,nowIso,todayStr} from '../util'
import {loadUser} from '../auth'
import {queueEmail} from '../mailer'
const digest=(v:string)=>createHash('sha256').update(v).digest('hex')
const dateValid=(v:string)=>!!v&&v>=todayStr()
export const rfqHooks:Hooks={beforeSave({rec,old,children,ctx}){
 if(old&&old.status!=='Draft'&&!ctx.system)throw bad('Issued RFQs are locked; create another request for changed requirements')
 if(!old)rec.status='Draft'
 if(rec.status==='Draft'&&!dateValid(rec.response_deadline))throw bad('Response deadline must be today or later')
 const providers=children.providers
 if(providers){const ids=new Set();for(const p of providers){if(ids.has(p.provider_id))throw bad('Invite each provider only once');ids.add(p.provider_id);const vendor=q.get('SELECT is_vendor FROM parties WHERE id=? AND deleted_at IS NULL',p.provider_id);if(!vendor?.is_vendor)throw bad('RFQ providers must be vendors')}}
}}
export const offerHooks:Hooks={beforeSave({rec,old,ctx}){
 if(old)throw bad('Responses are immutable; record a new revision to preserve history')
 const rfq=getRecord(getDef('carrier_rfqs'),rec.rfq_id,ctx)
 if(rfq.status!=='Issued')throw bad('Responses require an issued RFQ')
 if(!dateValid(rfq.response_deadline))throw bad('RFQ response deadline has passed')
 if(!q.val('SELECT 1 FROM rfq_providers WHERE rfq_id=? AND provider_id=? AND deleted_at IS NULL',rfq.id,rec.provider_id))throw bad('Provider was not invited to this RFQ')
 for(const k of ['freight','local_charges'])if(!Number.isFinite(rec[k])||rec[k]<0)throw bad('Rate components must be non-negative amounts')
 for(const k of ['transit_days','free_days'])if(!Number.isInteger(rec[k])||rec[k]<0||rec[k]>3650)throw bad('Transit/free days must be 0–3650')
 if(!Number.isFinite(rec.ex_rate)||rec.ex_rate<=0||(rec.currency==='AED'&&rec.ex_rate!==1))throw bad('Provide a positive exchange rate; AED uses 1')
 if(!dateValid(rec.valid_until))throw bad('Response validity must be today or later')
 if(rec.terms.trim().length<10)throw bad('Record rate inclusions, exclusions and terms')
 rec.total=Math.round((rec.freight+rec.local_charges)*100)/100;rec.total_aed=Math.round(rec.total*rec.ex_rate*100)/100
 rec.revision=(q.val<number>('SELECT MAX(revision) FROM rfq_offers WHERE rfq_id=? AND provider_id=?',rec.rfq_id,rec.provider_id)??0)+1;rec.received_at=nowIso()
}}
export function issueRfq(id:number,ctx:Ctx){assertCan(ctx,'sales','edit');const r=getRecord(getDef('carrier_rfqs'),id,ctx);if(r.status!=='Draft')throw bad('RFQ has already been issued or closed');if(!dateValid(r.response_deadline))throw bad('Deadline has passed');if(!r.children.providers.length)throw bad('Invite at least one provider')
 for(const p of r.children.providers){const mail=queueEmail({to:p.email,subject:`Rate request ${r.rfq_no}: ${r.origin} → ${r.destination}`,body:`${r.title}\nMode: ${r.mode}\nOrigin: ${r.origin}\nDestination: ${r.destination}\nRequirements: ${r.cargo}\nRespond by: ${r.response_deadline}\nPlease include freight, local charges, currency, transit days, free days, validity and all exclusions.`,link_entity:'carrier_rfqs',link_id:id,userId:ctx.user?.id});q.run('UPDATE rfq_providers SET outbox_id=? WHERE id=?',mail,p.id)}
 return patchRecord(getDef('carrier_rfqs'),id,{status:'Issued'},ctx)
}
export function compareRfq(id:number,ctx:Ctx){const rfq=getRecord(getDef('carrier_rfqs'),id,ctx);const rows=listRecords(getDef('rfq_offers'),{filters:[{field:'rfq_id',op:'eq',value:id}],pageSize:1000},ctx).rows
 const latest=rows.filter(r=>!rows.some(o=>o.provider_id===r.provider_id&&o.revision>r.revision)).map((r):Rec=>({...r,eligible:dateValid(r.valid_until)})).sort((a,b)=>a.total_aed-b.total_aed||a.transit_days-b.transit_days)
 return {rfq,latest,history:rows}
}
export function awardRfq(id:number,offerId:number,reason:string,ctx:Ctx){assertCan(ctx,'sales','approve');const r=getRecord(getDef('carrier_rfqs'),id,ctx),offer=getRecord(getDef('rfq_offers'),offerId,ctx)
 if(r.status!=='Issued')throw bad('Only an issued RFQ can be awarded');if(r.created_by===ctx.user?.id||offer.created_by===ctx.user?.id)throw bad('The RFQ maker and response recorder cannot approve their own award')
 if(offer.rfq_id!==id)throw bad('Response belongs to another RFQ');if(!dateValid(offer.valid_until))throw bad('Selected response has expired')
 if(q.val('SELECT 1 FROM rfq_offers WHERE rfq_id=? AND provider_id=? AND revision>? AND deleted_at IS NULL',id,offer.provider_id,offer.revision))throw bad('Select the latest provider response')
 if(reason.trim().length<10)throw bad('Record an award justification of at least 10 characters')
 const out=patchRecord(getDef('carrier_rfqs'),id,{status:'Awarded',award_offer_id:offerId,awarded_by:ctx.user?.id,awarded_at:nowIso(),award_reason:reason},ctx);audit(ctx,getDef('carrier_rfqs'),id,'award',{offer_id:offerId,reason},r._title);return out
}
export const knowledgeHooks:Hooks={beforeSave({rec,old,ctx}){
 if(old&&old.status==='Published'&&!ctx.system)throw bad('Published content is immutable; start a new revision')
 if(!old){rec.status='Draft';rec.revision=1;rec.owner_id??=ctx.user?.id}
 if(!rec.owner_id)throw bad('Assign an article owner')
}}
export function publishKnowledge(id:number,ctx:Ctx){assertCan(ctx,'projects','approve');const r=getRecord(getDef('knowledge_articles'),id,ctx)
 if(r.status!=='Draft')throw bad('This revision is already published');if(r.created_by===ctx.user?.id||r.owner_id===ctx.user?.id||r.updated_by===ctx.user?.id)throw bad('A second authorised reviewer must publish this revision')
 if(r.content.trim().length<100)throw bad('Published articles need at least 100 characters of reviewed content')
 const at=nowIso();createRecord(getDef('knowledge_versions'),{article_id:id,revision:r.revision,title:r.title,category:r.category,content:r.content,author_id:r.owner_id,published_by:ctx.user?.id,published_at:at,checksum:digest(r.content),revision_reason:r.revision_reason},{...ctx,system:true})
 return patchRecord(getDef('knowledge_articles'),id,{status:'Published',published_by:ctx.user?.id,published_at:at},ctx)
}
export function reviseKnowledge(id:number,reason:string,ctx:Ctx){assertCan(ctx,'projects','edit');const r=getRecord(getDef('knowledge_articles'),id,ctx);if(r.status!=='Published')throw bad('Finish the current draft before another revision');if(reason.trim().length<10)throw bad('Explain the revision in at least 10 characters');return patchRecord(getDef('knowledge_articles'),id,{status:'Draft',revision:r.revision+1,revision_reason:reason,published_by:null,published_at:null},ctx)}
export function acknowledgeKnowledge(id:number,ctx:Ctx){assertCan(ctx,'projects','view');const r=getRecord(getDef('knowledge_articles'),id,ctx);if(r.status!=='Published')throw bad('Only a published revision can be acknowledged');const v=q.get('SELECT id FROM knowledge_versions WHERE article_id=? AND revision=? AND deleted_at IS NULL',id,r.revision)!;if(q.val('SELECT 1 FROM knowledge_acknowledgements WHERE version_id=? AND user_id=? AND deleted_at IS NULL',v.id,ctx.user?.id))throw bad('You have already acknowledged this revision');return createRecord(getDef('knowledge_acknowledgements'),{version_id:v.id,user_id:ctx.user?.id,acknowledged_at:nowIso()},{...ctx,system:true})}
export const qualificationHooks:Hooks={beforeSave({rec,old}){
 if(old&&old.status!=='Pending')throw bad('Verified/revoked qualifications are immutable; record a new assessment')
 if(!old)rec.status='Pending'
 if(!loadUser(rec.user_id)||loadUser(rec.user_id)?.party_id)throw bad('Choose an active staff member')
 if(!Number.isInteger(rec.level)||rec.level<1||rec.level>5)throw bad('Qualification level must be 1–5')
 if(rec.assessed_on>todayStr()||rec.expires_on<rec.assessed_on)throw bad('Check assessment and expiry dates')
 if(rec.evidence.trim().length<10)throw bad('Record the certificate or assessment evidence')
}}
export const skillRuleHooks:Hooks={beforeSave({rec}){if(!Number.isInteger(rec.minimum_level)||rec.minimum_level<1||rec.minimum_level>5)throw bad('Minimum level must be 1–5')}}
export function verifyQualification(id:number,ctx:Ctx){assertCan(ctx,'hr','approve');const r=getRecord(getDef('staff_qualifications'),id,ctx);if(r.status!=='Pending')throw bad('Qualification has already been decided');if(r.user_id===ctx.user?.id||r.created_by===ctx.user?.id)throw bad('An independent assessor must verify the qualification');if(!dateValid(r.expires_on))throw bad('Expired qualifications cannot be verified');
 // Internal SQL preserves immutable assessment fields while recording its controlled decision.
 q.run("UPDATE staff_qualifications SET status='Verified',verified_by=?,verified_at=?,updated_by=?,updated_at=?,version=version+1 WHERE id=?",ctx.user?.id,nowIso(),ctx.user?.id,nowIso(),id);audit(ctx,getDef('staff_qualifications'),id,'verify',{},r._title);return getRecord(getDef('staff_qualifications'),id,ctx)
}
export function revokeQualification(id:number,reason:string,ctx:Ctx){assertCan(ctx,'hr','approve');const r=getRecord(getDef('staff_qualifications'),id,ctx);if(r.status!=='Verified')throw bad('Only a verified qualification can be revoked');if(r.user_id===ctx.user?.id)throw bad('An independent assessor must revoke the qualification');if(reason.trim().length<10)throw bad('Record a revocation reason');q.run("UPDATE staff_qualifications SET status='Revoked',revocation_reason=?,updated_by=?,updated_at=?,version=version+1 WHERE id=?",reason,ctx.user?.id,nowIso(),id);audit(ctx,getDef('staff_qualifications'),id,'revoke',{reason},r._title);return getRecord(getDef('staff_qualifications'),id,ctx)}
export function eligibleForActivity(userId:number,activity:string,department:number){const rules=q.all('SELECT * FROM activity_skill_rules WHERE active=1 AND deleted_at IS NULL AND lower(activity)=lower(?) AND (department_id IS NULL OR department_id=?)',activity,department)
 return rules.every(r=>!!q.val("SELECT 1 FROM staff_qualifications f JOIN competencies c ON c.id=f.competency_id WHERE f.user_id=? AND f.competency_id=? AND f.level>=? AND f.status='Verified' AND f.expires_on>=? AND f.deleted_at IS NULL AND c.active=1 AND c.deleted_at IS NULL",userId,r.competency_id,r.minimum_level,todayStr()))
}
export function competencyMatrix(ctx:Ctx){assertCan(ctx,'hr','view');const users=q.all('SELECT id,name,department_id FROM users WHERE active=1 AND party_id IS NULL AND deleted_at IS NULL'),skills=listRecords(getDef('competencies'),{pageSize:1000},ctx).rows,qualifications=listRecords(getDef('staff_qualifications'),{pageSize:10000},ctx).rows
 return {users,skills,qualifications:qualifications.map((r):Rec=>({...r,current:r.status==='Verified'&&dateValid(r.expires_on)}))}
}
