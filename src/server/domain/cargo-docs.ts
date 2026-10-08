import {createHash} from 'node:crypto'
import {q} from '../db'
import {assertCan,can,getDef,getRecord,createRecord,patchRecord,audit,type Ctx,type Rec} from '../engine'
import {loadUser} from '../auth'
import {bad,nowIso,todayStr} from '../util'
import type {Hooks} from '../hooks'
import {closureReadiness} from './job-controls'
export const freightDocumentHooks:Hooks={beforeSave({rec,old,ctx}){
 const job=getRecord(getDef('jobs'),rec.job_id,ctx,{children:false})
 if(['CLOSED','CANCELLED'].includes(job.job_status))throw bad('Reopen the job before changing freight documents')
 if(old&&old.status!=='Draft'&&!ctx.system)throw bad('Approved documents are immutable; use the amendment workflow')
 if(old&&(old.job_id!==rec.job_id||old.kind!==rec.kind))throw bad('Document job and kind cannot change')
 if(['MBL','HBL'].includes(rec.kind)&&job.mode!=='Sea')throw bad('BL documents require an ocean job')
 if(['MAWB','HAWB'].includes(rec.kind)&&job.mode!=='Air')throw bad('AWB documents require an air job')
 for(const k of ['original_count','copy_count'])if(!Number.isInteger(rec[k])||rec[k]<0||rec[k]>12)throw bad('Original and copy counts must be 0–12')
 if(!Number.isInteger(rec.packages)||rec.packages<1||!Number.isFinite(rec.gross_weight)||rec.gross_weight<=0)throw bad('Provide positive package count and gross weight')
 if(rec.release_mode==='Original'&&rec.original_count<1)throw bad('Original release requires at least one registered original')
 if(rec.release_mode==='Sea waybill'&&(rec.kind!=='MBL'&&rec.kind!=='HBL'||rec.original_count!==0))throw bad('Sea waybill requires an ocean document with zero originals')
 if(['Telex','Surrender'].includes(rec.release_mode)&&!['MBL','HBL'].includes(rec.kind))throw bad('Telex/surrender applies to ocean BL documents')
 if(!old){rec.status='Draft';rec.revision=1;rec.draft_author_id=ctx.user?.id}
},beforeDelete(){throw bad('Freight documents must be retained')}}
function doc(id:number,ctx:Ctx){const r=getRecord(getDef('freight_documents'),id,ctx);const job=getRecord(getDef('jobs'),r.job_id,ctx,{children:false});if(['CLOSED','CANCELLED'].includes(job.job_status))throw bad('Reopen the job before changing documents or custody');return r}
export function approveFreightDocument(id:number,ctx:Ctx){assertCan(ctx,'documents','approve');const r=doc(id,ctx);if(r.status!=='Draft')throw bad('Only draft revisions can be approved');if(r.draft_author_id===ctx.user?.id||r.updated_by===ctx.user?.id)throw bad('An independent reviewer must approve the draft')
 if(['MBL','MAWB'].includes(r.kind)&&!r.carrier_document_no)throw bad('Record the carrier-issued master document number')
 if(r.kind==='MAWB'){const n=String(r.carrier_document_no).replace(/[ -]/g,'');if(!/^\d{11}$/.test(n)||Number(n.slice(3,10))%7!==Number(n[10]))throw bad('MAWB number must have 11 digits and a valid modulo-7 check digit')}
 if(r.carrier_document_no&&q.val('SELECT 1 FROM freight_documents WHERE kind=? AND carrier_document_no=? AND id<>? AND deleted_at IS NULL',r.kind,r.carrier_document_no,id))throw bad('Carrier number is already used by another document')
 const at=nowIso(),snapshot=Object.fromEntries(getDef('freight_documents').fields.filter(f=>!['status','approved_by','approved_at','released_at','released_by','release_evidence'].includes(f.name)).map(f=>[f.name,r[f.name]]))
 createRecord(getDef('freight_document_versions'),{document_id:id,doc_no:r.doc_no,revision:r.revision,snapshot,checksum:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),approved_by:ctx.user?.id,approved_at:at},{...ctx,system:true})
 const job=q.get('SELECT b.name FROM jobs j JOIN branches b ON b.id=j.branch_id WHERE j.id=?',r.job_id)
 for(let n=1;n<=r.original_count;n++){const original=createRecord(getDef('document_originals'),{document_id:id,revision:r.revision,original_no:n,status:'In office',holder_kind:'Office',holder_name:job?.name??'Origin office'},{...ctx,system:true});createRecord(getDef('document_custody_events'),{original_id:original.id,event:'Original registered',actor_id:ctx.user?.id,holder_kind:'Office',holder_name:job?.name??'Origin office',at,status:'Acknowledged'},{...ctx,system:true})}
 return patchRecord(getDef('freight_documents'),id,{status:'Approved',approved_by:ctx.user?.id,approved_at:at},ctx)
}
export function amendFreightDocument(id:number,reason:string,ctx:Ctx){assertCan(ctx,'documents','edit');const r=doc(id,ctx);if(r.status!=='Approved')throw bad('Only approved, unreleased documents can be amended');if(reason.trim().length<10)throw bad('Explain the amendment');if(q.val("SELECT 1 FROM document_originals WHERE document_id=? AND revision=? AND status NOT IN ('In office','Returned') AND deleted_at IS NULL",id,r.revision))throw bad('Return and acknowledge all originals before an amendment');return patchRecord(getDef('freight_documents'),id,{status:'Draft',revision:r.revision+1,draft_author_id:ctx.user?.id,approved_by:null,approved_at:null,amendment_reason:reason},ctx)}
export function releaseFreightDocument(id:number,evidence:string,ctx:Ctx){assertCan(ctx,'documents','approve');const r=doc(id,ctx);if(r.status!=='Approved')throw bad('Only approved documents can be released');if(r.draft_author_id===ctx.user?.id)throw bad('The draft author cannot authorise release');if(evidence.trim().length<10)throw bad('Record release authority and evidence')
 const job=q.get('SELECT * FROM jobs WHERE id=?',r.job_id)!;if(['CLOSED','CANCELLED'].includes(job.job_status))throw bad('Closed/cancelled jobs cannot release documents')
 const customs=closureReadiness(r.job_id,ctx).checks.find(c=>c.key==='customs');if(!customs?.passed)throw bad('Customs must be cleared or independently verified not applicable')
 if(q.val("SELECT 1 FROM job_charges WHERE job_id=? AND kind='Revenue' AND status='Unbilled' AND amount<>0 AND deleted_at IS NULL",r.job_id)||q.val("SELECT 1 FROM invoices WHERE job_id=? AND doc_type<>'Proforma Invoice' AND status<>'Void' AND (status='Draft' OR balance>0.005) AND deleted_at IS NULL",r.job_id))throw bad('Document release is on financial hold: invoice and settle job revenue first')
 const originals=q.all('SELECT * FROM document_originals WHERE document_id=? AND revision=? AND deleted_at IS NULL',id,r.revision)
 if(originals.some(o=>o.status==='Transfer pending'))throw bad('Acknowledge pending original handovers before release')
 if(['Telex','Surrender'].includes(r.release_mode)&&originals.some(o=>!['In office','Returned'].includes(o.status)))throw bad('All originals must be returned for telex/surrender release')
 if(r.release_mode==='Original'&&originals.some(o=>o.status!=='With custodian'))throw bad('Record and acknowledge the delivery of each original before original release')
 for(const o of originals){patchRecord(getDef('document_originals'),o.id,{status:'Released',release_date:todayStr()},ctx);createRecord(getDef('document_custody_events'),{original_id:o.id,event:`Released: ${r.release_mode}`,actor_id:ctx.user?.id,holder_kind:o.holder_kind,holder_name:o.holder_name,evidence,at:nowIso(),status:'Acknowledged'},{...ctx,system:true})}
 return patchRecord(getDef('freight_documents'),id,{status:'Released',released_by:ctx.user?.id,released_at:nowIso(),release_evidence:evidence},ctx)
}
export function requestCustodyTransfer(id:number,b:Rec,ctx:Ctx){assertCan(ctx,'documents','edit');const o=getRecord(getDef('document_originals'),id,ctx),r=doc(o.document_id,ctx);if(r.status!=='Approved'||o.revision!==r.revision)throw bad('Only originals of the current approved revision can move');if(['Transfer pending','Released'].includes(o.status))throw bad('Resolve the pending transfer first')
 if(o.holder_user_id&&o.holder_user_id!==ctx.user?.id&&!can(ctx.user,'documents','approve'))throw bad('Only the current custodian or authorised supervisor can transfer this original')
 if(b.holder_kind==='Courier'&&!b.tracking)throw bad('Courier transfers need a tracking reference')
 if(['Office','Employee'].includes(b.holder_kind)){const recipient=loadUser(b.recipient_id);if(!recipient||recipient.party_id||!can(recipient,'documents','edit')||!can(recipient,'jobs','view')||recipient.id===ctx.user?.id)throw bad('Choose another active staff recipient with document access')}
 else if(b.recipient_id)throw bad('External custodian receipt is recorded by an independent document approver')
 const event=createRecord(getDef('document_custody_events'),{original_id:id,event:'Custody transfer',actor_id:ctx.user?.id,recipient_id:b.recipient_id??null,holder_kind:b.holder_kind,holder_name:b.holder_name,tracking:b.tracking,evidence:b.evidence,at:nowIso(),status:'Pending'},{...ctx,system:true});patchRecord(getDef('document_originals'),id,{status:'Transfer pending'},ctx);return event
}
export function acknowledgeCustody(eventId:number,evidence:string,ctx:Ctx){assertCan(ctx,'documents','edit');const e=getRecord(getDef('document_custody_events'),eventId,ctx),o=getRecord(getDef('document_originals'),e.original_id,ctx);doc(o.document_id,ctx)
 if(e.status!=='Pending'||o.status!=='Transfer pending')throw bad('Transfer is already acknowledged or not pending')
 if(e.recipient_id?e.recipient_id!==ctx.user?.id:e.actor_id===ctx.user?.id||!can(ctx.user,'documents','approve'))throw bad('Only the named recipient or independent external-receipt approver can acknowledge')
 if(evidence.trim().length<10)throw bad('Record receipt evidence')
 patchRecord(getDef('document_originals'),o.id,{status:e.holder_kind==='Office'?'Returned':'With custodian',holder_kind:e.holder_kind,holder_name:e.holder_name,holder_user_id:e.recipient_id??null,courier_tracking:e.tracking??null},ctx)
 return patchRecord(getDef('document_custody_events'),eventId,{status:'Acknowledged',acknowledgement:evidence,acknowledged_at:nowIso()},ctx)
}
