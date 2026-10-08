import { createHash } from 'node:crypto'
import { q } from '../db'
import { assertCan, audit, getDef, getRecord, patchRecord, type Ctx } from '../engine'
import { bad, nowIso } from '../util'
import { addJobEvent } from './jobs'

export const EVIDENCE_TYPES = ['Documents verified', 'Costs complete', 'Customs not applicable', 'Equipment not applicable', 'POD not applicable'] as const
function fingerprint(id: number) {
  const job = q.get(`SELECT * FROM jobs WHERE id=?`,id) ?? {}
  for(const field of ['job_status','closed_at','updated_at','updated_by','version']) delete job[field]
  const snapshot = [job, ...['shipments','job_containers','job_charges','customs_declarations','invoices'].map(table=>q.all(`SELECT * FROM ${table} WHERE job_id=? AND deleted_at IS NULL ORDER BY id`,id)),q.all(`SELECT * FROM attachments WHERE link_entity='jobs' AND link_id=? AND deleted_at IS NULL ORDER BY id`,id)]
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}
export function closureReadiness(id: number, ctx: Ctx) {
  const job = getRecord(getDef('jobs'), id, ctx, { children: false })
  const currentFingerprint=fingerprint(id)
  const evidence: Record<string,any>[] = q.all(`SELECT e.*, u.name verified_by_name FROM job_closure_evidence e LEFT JOIN users u ON u.id=e.verified_by WHERE e.job_id=? ORDER BY e.id`, id).map(e=>({...e,current:!!e.verified_by && e.fingerprint===currentFingerprint}))
  const verified = (kind: string) => evidence.some(e => e.kind === kind && e.verified_by && e.verified_at && e.current)
  const n = (sql: string) => q.val<number>(sql, id) ?? 0
  const shipments = n(`SELECT COUNT(*) FROM shipments WHERE job_id=? AND deleted_at IS NULL`)
  const containers = n(`SELECT COUNT(*) FROM job_containers WHERE job_id=? AND deleted_at IS NULL`)
  const customs = n(`SELECT COUNT(*) FROM customs_declarations WHERE job_id=? AND deleted_at IS NULL`)
  const pod = shipments > 0 && n(`SELECT COUNT(*) FROM shipments WHERE job_id=? AND deleted_at IS NULL AND (COALESCE(pod_received,0)=0 OR status<>'Delivered')`) === 0
  const checks = [
    { key:'delivery', label:'Delivery complete', passed: ['DELIVERED','EMPTY RETURNED'].includes(job.operational_status) || job.job_status === 'DELIVERED' || job.job_status === 'CLOSED' },
    { key:'pod', label:'Proof of delivery', passed: pod || n(`SELECT COUNT(*) FROM attachments WHERE link_entity='jobs' AND link_id=? AND category='POD' AND deleted_at IS NULL`) > 0 || verified('POD not applicable') },
    { key:'documents', label:'Documents reviewed', passed:verified('Documents verified') },
    { key:'customs', label:'Customs released or verified not applicable', passed: customs > 0 ? n(`SELECT COUNT(*) FROM customs_declarations WHERE job_id=? AND deleted_at IS NULL AND status NOT IN ('Cleared','Cancelled')`) === 0 : job.customs_status === 'Cleared' || verified('Customs not applicable') },
    { key:'equipment', label:'Equipment returned or verified not applicable', passed:containers > 0 ? n(`SELECT COUNT(*) FROM job_containers WHERE job_id=? AND deleted_at IS NULL AND status<>'Empty returned'`) === 0 : verified('Equipment not applicable') },
    { key:'revenue', label:'All revenue invoiced', passed:n(`SELECT COUNT(*) FROM job_charges WHERE job_id=? AND kind='Revenue' AND status='Unbilled' AND deleted_at IS NULL AND amount<>0`) === 0 },
    { key:'costs', label:'Costs reviewed and billed', passed:verified('Costs complete') && n(`SELECT COUNT(*) FROM job_charges WHERE job_id=? AND kind='Cost' AND status='Unbilled' AND deleted_at IS NULL AND amount<>0`) === 0 },
    { key:'invoices', label:'No draft invoices', passed:n(`SELECT COUNT(*) FROM invoices WHERE job_id=? AND status='Draft' AND deleted_at IS NULL`) === 0 },
  ]
  return { job_id:id, status:job.job_status, ready:checks.every(c=>c.passed), checks, evidence, reopen_requests:q.all(`SELECT r.*, u.name requested_by_name FROM job_reopen_requests r LEFT JOIN users u ON u.id=r.requested_by WHERE r.job_id=? ORDER BY r.id DESC`,id) }
}
export function assertClosureReady(id: number, ctx: Ctx) {
  assertCan(ctx,'jobs','approve')
  const readiness = closureReadiness(id,ctx)
  const failed=readiness.checks.filter(c=>!c.passed)
  if(failed.length) throw bad('Job cannot close: '+failed.map(c=>c.label).join('; '))
}
export function addClosureEvidence(id:number,kind:string,note:string,ctx:Ctx) {
  assertCan(ctx,'jobs','edit'); const job=getRecord(getDef('jobs'),id,ctx,{children:false})
  if(['CLOSED','CANCELLED'].includes(job.job_status)) throw bad('Reopen the job before adding closure evidence')
  const result=q.insert(`INSERT INTO job_closure_evidence(job_id,kind,note,submitted_by,submitted_at) VALUES (?,?,?,?,?)`,id,kind,note,ctx.user!.id,nowIso())
  audit(ctx,getDef('jobs'),id,'closure_evidence',{kind,note},job._title)
  return {id:result}
}
export function verifyClosureEvidence(jobId:number,evidenceId:number,ctx:Ctx) {
  assertCan(ctx,'jobs','approve'); const job=getRecord(getDef('jobs'),jobId,ctx,{children:false})
  if(job.job_status==='CLOSED') throw bad('Closed evidence cannot be changed')
  const row=q.get(`SELECT * FROM job_closure_evidence WHERE id=? AND job_id=?`,evidenceId,jobId)
  if(!row) throw bad('Evidence not found')
  if(row.verified_by && row.fingerprint===fingerprint(jobId)) throw bad('Evidence is already verified for the current job')
  if(row.submitted_by===ctx.user?.id) throw bad('A different user must verify closure evidence')
  q.run(`UPDATE job_closure_evidence SET verified_by=?,verified_at=?,fingerprint=? WHERE id=?`,ctx.user!.id,nowIso(),fingerprint(jobId),evidenceId)
  audit(ctx,getDef('jobs'),jobId,'verify_closure_evidence',{evidence_id:evidenceId},job._title)
}
export function requestReopen(id:number,reason:string,ctx:Ctx) {
  assertCan(ctx,'jobs','edit');const job=getRecord(getDef('jobs'),id,ctx,{children:false})
  if(job.job_status!=='CLOSED')throw bad('Only closed jobs can be reopened')
  if(q.get(`SELECT id FROM job_reopen_requests WHERE job_id=? AND status='Pending'`,id))throw bad('A reopen request is already pending')
  const r=q.insert(`INSERT INTO job_reopen_requests(job_id,reason,requested_by,requested_at,status) VALUES (?,?,?,?,'Pending')`,id,reason,ctx.user!.id,nowIso())
  audit(ctx,getDef('jobs'),id,'request_reopen',{reason},job._title)
  return {id:r}
}
export function decideReopen(id:number,requestId:number,approve:boolean,reason:string,ctx:Ctx) {
  assertCan(ctx,'jobs','approve');const job=getRecord(getDef('jobs'),id,ctx,{children:false})
  const r=q.get(`SELECT * FROM job_reopen_requests WHERE id=? AND job_id=?`,requestId,id)
  if(!r || r.status!=='Pending')throw bad('No pending reopen request')
  if(r.requested_by===ctx.user?.id)throw bad('A different user must decide the reopen request')
  if(job.job_status!=='CLOSED')throw bad('Job is no longer closed')
  q.run(`UPDATE job_reopen_requests SET status=?,decided_by=?,decided_at=?,decision_reason=? WHERE id=? AND status='Pending'`,approve?'Approved':'Rejected',ctx.user!.id,nowIso(),reason,requestId)
  if(approve){
    patchRecord(getDef('jobs'),id,{job_status:'IN PROGRESS',closed_at:null},{...ctx,jobTransition:'reopen'})
    // Previous attestations must be reviewed again after new work.
    q.run(`UPDATE job_closure_evidence SET verified_by=NULL,verified_at=NULL WHERE job_id=?`,id)
    addJobEvent(id,'Note',{description:`Reopened after independent approval: ${r.reason}. Decision: ${reason}`,user_id:ctx.user!.id,visible:false})
  }
  audit(ctx,getDef('jobs'),id,approve?'approve_reopen':'reject_reopen',{request_id:requestId,reason},job._title)
  return {status:approve?'Approved':'Rejected'}
}
