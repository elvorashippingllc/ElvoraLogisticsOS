import assert from 'node:assert/strict'
import {syncSchema} from '../src/server/schema'
import {seedReference} from '../src/server/seed'
import {q,tx} from '../src/server/db'
import {loadUser} from '../src/server/auth'
import {createRecord,getDef,getRecord,updateRecord} from '../src/server/engine'
import {requestDepositEvent,decideDepositEvent,reverseDepositEvent} from '../src/server/domain/deposits'
import {reverseEntry} from '../src/server/domain/finance'
syncSchema();seedReference()
const maker={user:loadUser(q.val<number>("SELECT id FROM users WHERE email='admin@elvorashipping.com'")!)!},checker={user:loadUser(q.val<number>("SELECT id FROM users WHERE email='manager@elvorashipping.com'")!)!},mk=(k:string,b:any)=>createRecord(getDef(k),b,maker)
const party=mk('parties',{name:'Container deposit customer',is_customer:true}),carrier=mk('parties',{name:'Container deposit carrier',is_vendor:true}),branch=q.val<number>('SELECT id FROM branches LIMIT 1')!
const job=mk('jobs',{client_id:party.id,branch_id:branch,department:'FCL IMPORT',trade:'Import',children:{containers:[{container_no:'MSCU1234567'}]}})
const asset=q.val<number>("SELECT id FROM accounts WHERE code='1300'")!,expense=q.val<number>("SELECT id FROM accounts WHERE type='Expense' AND active=1 LIMIT 1")!,bank=q.val<number>("SELECT id FROM bank_accounts WHERE currency='AED' AND active=1 LIMIT 1")!
const deposit=mk('container_deposits',{job_id:job.id,container_no:'MSCU1234567',carrier_id:carrier.id,amount:1000,asset_account_id:asset,refund_due:'2099-12-31'})
const body={kind:'Payment',amount:1000,bank_account_id:bank,transaction_date:'2026-10-08',reference:'BANK-DEP-001',evidence:'Verified bank advice for refundable container deposit'}
const payment=tx(()=>requestDepositEvent(deposit.id,body,maker));assert.throws(()=>decideDepositEvent(payment.id,true,'Maker cannot approve own payment',maker),/independent/)
tx(()=>decideDepositEvent(payment.id,true,'Independent bank advice verified',checker));let d=getRecord(getDef('container_deposits'),deposit.id,maker);assert.equal(d.paid,1000);assert.equal(d.balance,1000)
assert.throws(()=>decideDepositEvent(payment.id,true,'Do not double post payment',checker),/already/);assert.throws(()=>requestDepositEvent(deposit.id,body,maker),/exceeds/)
assert.throws(()=>updateRecord(getDef('container_deposits'),deposit.id,{amount:2000},maker),/locked/)
const damage=tx(()=>requestDepositEvent(deposit.id,{...body,kind:'Damage deduction',amount:100,bank_account_id:undefined,expense_account_id:expense,reference:'DAMAGE-001'},maker));tx(()=>decideDepositEvent(damage.id,true,'Carrier damage assessment accepted',checker))
const refund=tx(()=>requestDepositEvent(deposit.id,{...body,kind:'Refund',amount:900,reference:'REFUND-001'},maker));tx(()=>decideDepositEvent(refund.id,true,'Refund bank credit independently verified',checker));d=getRecord(getDef('container_deposits'),deposit.id,maker);assert.equal(d.refund_received,900);assert.equal(d.damage_deduction,100);assert.equal(d.balance,0);assert.equal(d.status,'Settled')
const events=q.all("SELECT journal_id FROM container_deposit_events WHERE deposit_id=? AND status='Posted'",deposit.id);assert.equal(events.length,3)
for(const e of events){const totals=q.get('SELECT SUM(debit) debit,SUM(credit) credit FROM journal_lines WHERE entry_id=? AND deleted_at IS NULL',e.journal_id)!;assert.equal(totals.debit,totals.credit)}
assert.throws(()=>reverseEntry(events[0].journal_id,checker),/deposit transaction/)
assert.throws(()=>reverseDepositEvent(payment.id,'Reverse funding before refunds',checker),/refunds\/damage first/)
tx(()=>reverseDepositEvent(refund.id,'Refund recorded against wrong bank advice',checker));d=getRecord(getDef('container_deposits'),deposit.id,maker);assert.equal(d.balance,900);assert.equal(d.refund_received,0)
assert.throws(()=>reverseDepositEvent(refund.id,'Duplicate reversal must be blocked',checker),/Only posted/)
tx(()=>reverseDepositEvent(damage.id,'Damage assessment withdrawn by carrier',checker));tx(()=>reverseDepositEvent(payment.id,'Deposit funding record entered in error',checker));d=getRecord(getDef('container_deposits'),deposit.id,maker);assert.equal(d.paid,0);assert.equal(d.balance,0);assert.equal(d.status,'Unpaid')
// Two pending refund requests cannot both consume the same balance at approval time.
const funded=tx(()=>requestDepositEvent(deposit.id,{...body,amount:500},maker));tx(()=>decideDepositEvent(funded.id,true,'Fund new refundable deposit balance',checker))
const pending1=tx(()=>requestDepositEvent(deposit.id,{...body,kind:'Refund',amount:400},maker)),pending2=tx(()=>requestDepositEvent(deposit.id,{...body,kind:'Refund',amount:400},maker));tx(()=>decideDepositEvent(pending1.id,true,'First refund verified against bank statement',checker));assert.throws(()=>tx(()=>decideDepositEvent(pending2.id,true,'Second refund cannot exceed balance',checker)),/exceeds/);assert.equal(getRecord(getDef('container_deposit_events'),pending2.id,maker).status,'Pending')
console.log('Container deposit controls passed: independent posting, balanced asset/bank/expense journals, refunds/damage/balance, protected reversal, duplicate rejection and pending overpayment revalidation.')
