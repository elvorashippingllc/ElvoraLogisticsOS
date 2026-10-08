import {q} from '../db'
import {assertCan,getDef,getRecord,createRecord,patchRecord,audit,type Ctx,type Rec} from '../engine'
import type {Hooks} from '../hooks'
import {bad,nowIso,r2,toCents} from '../util'
import {BASE,postJournal,reverseJournal} from './accounting'
export const depositHooks:Hooks={beforeSave({rec,old,ctx}){
 if(BASE()!=='AED')throw bad('Container deposit ledger currently requires AED base currency')
 const job=getRecord(getDef('jobs'),rec.job_id,ctx,{children:false});if(!old&&['CLOSED','CANCELLED'].includes(job.job_status))throw bad('Do not create new deposits on a closed/cancelled job')
 if(old&&(rec.job_id!==old.job_id||rec.container_no!==old.container_no||rec.carrier_id!==old.carrier_id||rec.asset_account_id!==old.asset_account_id))throw bad('Job, container, carrier and asset account are fixed')
 if(old&&(old.paid>0||q.val('SELECT 1 FROM container_deposit_events WHERE deposit_id=? AND deleted_at IS NULL',old.id))&&!ctx.system)throw bad('Deposits with transactions are locked; use controlled transaction actions')
 if(!Number.isFinite(rec.amount)||rec.amount<=0)throw bad('Deposit must be a positive amount')
 if(!old&&!q.val('SELECT 1 FROM job_containers WHERE job_id=? AND container_no=? AND deleted_at IS NULL',rec.job_id,rec.container_no))throw bad('Container must belong to this job')
 if(!q.val('SELECT 1 FROM parties WHERE id=? AND is_vendor=1 AND deleted_at IS NULL',rec.carrier_id))throw bad('Choose a carrier/agent vendor')
 if(!q.val("SELECT 1 FROM accounts WHERE id=? AND type='Asset' AND active=1 AND deleted_at IS NULL",rec.asset_account_id))throw bad('Choose an active deposit asset account')
 if(!old){rec.status='Unpaid';rec.paid=0;rec.refund_received=0;rec.damage_deduction=0;rec.balance=0}
}}
function bankGl(id:number){const b=q.get('SELECT * FROM bank_accounts WHERE id=? AND active=1 AND deleted_at IS NULL',id);if(!b||b.currency!=='AED'||!q.val('SELECT 1 FROM accounts WHERE id=? AND active=1 AND deleted_at IS NULL',b.gl_account_id))throw bad('Use an active AED bank/cash account with an active GL account');return b.gl_account_id}
function validateAmount(d:Rec,b:Rec){const amount=toCents(b.amount);if(amount<=0)throw bad('Transaction must have a positive amount');if(b.kind==='Payment'&&amount>toCents(d.amount-d.paid))throw bad('Payment exceeds the authorised remaining deposit');if(b.kind!=='Payment'&&amount>toCents(d.balance))throw bad('Refund/damage exceeds the recoverable deposit balance')}
function recalc(id:number,ctx:Ctx){const sums=q.all("SELECT kind,SUM(amount) amount FROM container_deposit_events WHERE deposit_id=? AND status='Posted' AND deleted_at IS NULL GROUP BY kind",id),sum=(kind:string)=>(sums.find(r=>r.kind===kind)?.amount??0)/100
 const paid=sum('Payment'),refund=sum('Refund'),damage=sum('Damage deduction'),balance=r2(paid-refund-damage),status=paid===0?'Unpaid':balance===0?'Settled':refund+damage>0?'Partially recovered':'Paid'
 return patchRecord(getDef('container_deposits'),id,{paid,refund_received:refund,damage_deduction:damage,balance,status},ctx)
}
export function requestDepositEvent(id:number,b:Rec,ctx:Ctx){assertCan(ctx,'finance','edit');const d=getRecord(getDef('container_deposits'),id,ctx);validateAmount(d,b)
 if(b.kind!=='Damage deduction')bankGl(b.bank_account_id)
 else if(!q.val("SELECT 1 FROM accounts WHERE id=? AND type='Expense' AND active=1 AND deleted_at IS NULL",b.expense_account_id))throw bad('Choose an active damage expense account')
 if(b.evidence.trim().length<10)throw bad('Record the bank/assessment evidence')
 return createRecord(getDef('container_deposit_events'),{...b,deposit_id:id,status:'Pending',requested_by:ctx.user?.id},{...ctx,system:true})
}
export function decideDepositEvent(id:number,approve:boolean,reason:string,ctx:Ctx){assertCan(ctx,'finance','approve');const e=getRecord(getDef('container_deposit_events'),id,ctx),d=getRecord(getDef('container_deposits'),e.deposit_id,ctx)
 if(e.status!=='Pending')throw bad('Deposit transaction has already been decided');if(e.requested_by===ctx.user?.id)throw bad('An independent finance approver must decide the transaction');if(reason.trim().length<10)throw bad('Record a decision reason')
 let journal:number|null=null
 if(approve){validateAmount(d,e);const job=q.get('SELECT branch_id FROM jobs WHERE id=?',d.job_id)!,base={party_id:d.carrier_id,job_id:d.job_id,description:`${d.deposit_no}: ${e.kind} ${e.reference}`},debit=e.kind==='Payment'?d.asset_account_id:e.kind==='Refund'?bankGl(e.bank_account_id):e.expense_account_id,credit=e.kind==='Payment'?bankGl(e.bank_account_id):d.asset_account_id
  if(e.kind==='Damage deduction'&&!q.val("SELECT 1 FROM accounts WHERE id=? AND type='Expense' AND active=1 AND deleted_at IS NULL",debit))throw bad('Damage expense account is no longer active')
  journal=postJournal(ctx,{date:e.transaction_date,memo:base.description,source_type:'Container deposit',source_id:e.id,source_no:d.deposit_no,branch_id:job.branch_id,lines:[{...base,account_id:debit,debit:e.amount},{...base,account_id:credit,credit:e.amount}]})
 }
 patchRecord(getDef('container_deposit_events'),id,{status:approve?'Posted':'Rejected',decided_by:ctx.user?.id,decided_at:nowIso(),decision_reason:reason,journal_id:journal},ctx);recalc(d.id,ctx);audit(ctx,getDef('container_deposit_events'),id,approve?'approve_post':'reject',{reason},e._title);return getRecord(getDef('container_deposit_events'),id,ctx)
}
export function reverseDepositEvent(id:number,reason:string,ctx:Ctx){assertCan(ctx,'finance','approve');const e=getRecord(getDef('container_deposit_events'),id,ctx),d=getRecord(getDef('container_deposits'),e.deposit_id,ctx)
 if(e.status!=='Posted')throw bad('Only posted transactions can be reversed');if(e.requested_by===ctx.user?.id)throw bad('An independent approver must authorise reversal');if(reason.trim().length<10)throw bad('Record a reversal reason')
 if(e.kind==='Payment'&&toCents(d.balance)<toCents(e.amount))throw bad('Reverse linked refunds/damage first; the deposit balance cannot become negative')
 const reversal=reverseJournal(ctx,e.journal_id,`${d.deposit_no}: ${reason}`)
 patchRecord(getDef('container_deposit_events'),id,{status:'Reversed',reversal_journal_id:reversal,decision_reason:reason},ctx);recalc(d.id,ctx);return getRecord(getDef('container_deposit_events'),id,ctx)
}
