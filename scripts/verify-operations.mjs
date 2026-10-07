import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Execute the actual route handlers and migration SQL against an in-memory
// SQLite database. Only the hosted auth headers and D1/R2 adapters are mocked.
const root=resolve('.');await mkdir('.sites-runtime/qa',{recursive:true});
const temp=await mkdtemp(resolve('.sites-runtime/qa/run-'));let checks=0;
const database=new DatabaseSync(':memory:');database.exec('PRAGMA foreign_keys=ON');
for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort())database.exec(await readFile(join('drizzle',name),'utf8'));
const objects=new Map();
const adapter={prepare(sql){let params=[];const execute=()=>database.prepare(sql);return {bind(...values){params=values;return this;},async first(){return execute().get(...params)??null;},async all(){return {results:execute().all(...params)};},async run(){const r=execute().run(...params);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},runSync(){const r=execute().run(...params);return {success:true,meta:{changes:Number(r.changes)}};}};},async batch(stmts){database.exec('BEGIN IMMEDIATE');try{const rows=stmts.map(s=>s.runSync());database.exec('COMMIT');return rows;}catch(e){database.exec('ROLLBACK');throw e;}}};
globalThis.__osQA={request:new Request('https://elvoraos.test/'),user:null,env:{DB:adapter,BUCKET:{async put(k,bytes){objects.set(k,bytes);},async delete(k){objects.delete(k);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;}}}};
await writeFile(join(temp,'mock.mjs'),`export const env=globalThis.__osQA.env;export async function headers(){return globalThis.__osQA.request.headers;}export async function getChatGPTUser(){return globalThis.__osQA.user;}`);
const replacements=new Map([['cloudflare:workers','./mock.mjs'],['next/headers','./mock.mjs'],['@/app/chatgpt-auth','./mock.mjs'],['@/lib/os-db','./os-db.mjs'],['@/lib/domain','./domain.mjs']]);
for(const [source,name] of [['lib/domain.ts','domain'],['lib/os-db.ts','os-db'],['app/api/os/route.ts','list'],['app/api/os/records/route.ts','records'],['app/api/os/action/route.ts','action'],['app/api/os/documents/route.ts','documents']]){let content=await readFile(source,'utf8');for(const[a,b]of replacements)content=content.replaceAll(a,b);await writeFile(join(temp,name+'.mjs'),ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
const importModule=n=>import(pathToFileURL(join(temp,n+'.mjs')).href);
const records=await importModule('records'),actions=await importModule('action'),list=await importModule('list'),docs=await importModule('documents'),domain=await importModule('domain');
const owner={userId:'qa-owner',email:'owner@example.test',displayName:'QA owner'},operator={userId:'qa-operator',email:'operator@example.test',displayName:'QA operator'};
async function call(handler,body,actor=owner,method='POST',extra={}){globalThis.__osQA.user=actor;const headers={'Host':'elvoraos.test','Origin':'https://elvoraos.test',...extra};let content;if(body instanceof FormData)content=body;else if(body!==undefined){headers['Content-Type']='application/json';content=JSON.stringify(body);}const request=new Request('https://elvoraos.test/api/os',{method,headers,body:content});globalThis.__osQA.request=request;const response=await handler(request);const result=await response.json();return {status:response.status,body:result};}
const row=id=>{const r=database.prepare('SELECT * FROM records WHERE id=?').get(id);return {...JSON.parse(r.data),id:r.id,version:r.version,ref:r.ref};};
async function create(kind,data,actor=owner,key=crypto.randomUUID()){const result=await call(records.POST,{kind,data},actor,'POST',{'Idempotency-Key':key});assert.equal(result.status,201,JSON.stringify(result));return row(result.body.id);}
async function action(name,r,data={},actor=owner){return call(actions.POST,{action:name,id:r?.id,version:r?.version,data},actor);}
const expect=(result,status)=>{assert.equal(result.status,status,JSON.stringify(result));checks++;};
try{
 expect(await call(list.GET,undefined,null,'GET'),401);
 expect(await call(list.GET,undefined,owner,'GET'),200);
 expect(await call(actions.POST,{action:'invite',data:{email:operator.email,role:'operator'}}),200);
 expect(await call(list.GET,undefined,operator,'GET'),200);
 const customerKey=crypto.randomUUID(),customerData={name:'QA cargo owner',email:'cust@example.test'};
 const c1=await create('customer',customerData,owner,customerKey);const duplicate=await call(records.POST,{kind:'customer',data:customerData},owner,'POST',{'Idempotency-Key':customerKey});expect(duplicate,201);assert.equal(duplicate.body.id,c1.id);checks++;
 expect(await call(records.POST,{kind:'customer',data:{...customerData,name:'Changed'}},owner,'POST',{'Idempotency-Key':customerKey}),409);
 expect(await call(records.POST,{kind:'employee',data:{name:'Unauthorized'}},operator,'POST',{'Idempotency-Key':crypto.randomUUID()}),403);
 const future=domain.dubaiDay(new Date(Date.now()+10*86400000));const past=domain.dubaiDay(new Date(Date.now()-2*86400000));const base={customer:'QA cargo owner',origin:'Shanghai',destination:'Jebel Ali',mode:'Ocean',sale:1000,cost:950,expiry:future,weight:1200,cbm:4};
 const quote=await create('quote',base);assert.equal(quote.status,'Approval required');checks++;
 expect(await action('accept_quote',quote,{evidence:'Customer email acceptance'}),400);
 const approval=database.prepare('SELECT * FROM approvals WHERE record_id=?').get(quote.id);
 expect(await call(actions.POST,{action:'approval',id:approval.id,data:{decision:'approved'}},operator),403);
 expect(await call(actions.POST,{action:'approval',id:approval.id,data:{decision:'approved'}}),200);
 const approved=row(quote.id);const accepts=await Promise.all([action('accept_quote',approved,{evidence:'QA written acceptance'}),action('accept_quote',approved,{evidence:'QA written acceptance'})]);assert.deepEqual(accepts.map(r=>r.status).sort(),[200,409]);checks++;
 assert.equal(database.prepare("SELECT COUNT(*) n FROM records WHERE kind='job'").get().n,1);checks++;
 const accepted=row(quote.id),job=row(accepted.jobId);assert.equal(accepted.acceptedVersion.version,approved.version);checks++;
 expect(await call(records.PATCH,{kind:'quote',id:quote.id,version:accepted.version,data:base}),400);
 const expired=await create('quote',{...base,cost:700,expiry:past});expect(await action('accept_quote',expired,{evidence:'Late acceptance'}),400);
 const second=await create('job',{...base,cost:700,weight:2400,cbm:8});const consolidation=await create('consolidation',{name:'QA master',mode:'Ocean',basis:'Weight',cost:100.01,memberIds:[job.id,second.id]});assert.equal(consolidation.members.reduce((n,m)=>n+Math.round(m.allocatedCost*100),0),10001);checks++;
 expect(await action('add_cost',job,{name:'Freight',supplier:'QA carrier',amount:500,costType:'Budget allocation'}),200);assert.equal(row(job.id).cost,950);checks++;
 expect(await action('add_cost',row(job.id),{name:'Extra handling',supplier:'QA carrier',amount:25,costType:'Additional cost'}),200);assert.equal(row(job.id).cost,975);checks++;
 expect(await action('milestone',row(job.id),{status:'Customs cleared',source:'Manual',evidence:'Checklist complete'}),400);
 const invoice=await create('invoice',{customer:base.customer,jobId:job.id,net:200,taxCategory:'Standard-rated',taxRate:5,dueDate:past});
 expect(await action('post_invoice',invoice,{taxRationale:'Reviewed standard-rated domestic service'}),200);assert.equal(row(invoice.id).total,210);checks++;
 expect(await action('post_invoice',invoice,{taxRationale:'Repeat attempt'}),409);
 expect(await action('record_payment',row(invoice.id),{amount:211,reference:'BANK-OVERPAY'}),400);
 expect(await action('record_payment',row(invoice.id),{amount:50,reference:'BANK-QA-001'}),200);
 expect(await action('record_payment',row(invoice.id),{amount:50,reference:'BANK-QA-001'}),400);assert.equal(row(invoice.id).paid,50);checks++;
 const bill=await create('bill',{jobId:job.id,supplier:'QA supplier',supplierReference:'BILL-QA-01',net:100,taxCategory:'Standard-rated',taxRate:5});
 expect(await action('post_invoice',bill,{taxRationale:'Reviewed supplier input tax'}),200);
 expect(await action('pay_bill',row(bill.id),{amount:25,reference:'OUT-QA-001'},operator),403);
 expect(await action('pay_bill',row(bill.id),{amount:25,reference:'OUT-QA-001'}),200);
 const billRaceData={jobId:job.id,supplier:'QA concurrent supplier',supplierReference:'SAME-REF',net:75,taxCategory:'Standard-rated',taxRate:5};const billRace=await Promise.all([call(records.POST,{kind:'bill',data:billRaceData},owner,'POST',{'Idempotency-Key':crypto.randomUUID()}),call(records.POST,{kind:'bill',data:billRaceData},owner,'POST',{'Idempotency-Key':crypto.randomUUID()})]);assert.deepEqual(billRace.map(r=>r.status).sort(),[201,400]);checks++;
 const totals=database.prepare('SELECT SUM(debit) d,SUM(credit) c FROM journal_lines').get();assert.equal(totals.d,totals.c);checks++;
 expect(await call(actions.POST,{action:'settings',data:{name:'QA Elvora',minMargin:15,vatRate:5,trn:'',warehouseEnabled:true}}),200);
 const stock=await create('warehouse',{name:'QA custody cargo',owner:base.customer,location:'QA / A / 01',quantity:10,regulatoryStatus:'Customs-controlled',evidence:'QA receipt'});
 expect(await action('warehouse_move',stock,{direction:'Dispatch',quantity:1,evidence:'Not authorised'}),400);
 const releaseForm=new FormData();releaseForm.set('recordId',stock.id);releaseForm.set('category','Warehouse release evidence');releaseForm.set('file',new File(['Test authority evidence, not real cargo'],'release.txt',{type:'text/plain'}));const uploaded=await call(docs.POST,releaseForm);expect(uploaded,201);
 expect(await action('warehouse_hold',row(stock.id),{hold:false,documentId:uploaded.body.id,evidence:'QA owner release'},operator),403);
 expect(await action('warehouse_hold',row(stock.id),{hold:false,documentId:uploaded.body.id,evidence:'QA owner release'}),200);
 const released=row(stock.id);const dispatches=await Promise.all([action('warehouse_move',released,{direction:'Dispatch',quantity:7,evidence:'QA handover 1'}),action('warehouse_move',released,{direction:'Dispatch',quantity:7,evidence:'QA handover 2'})]);assert.deepEqual(dispatches.map(r=>r.status).sort(),[200,409]);assert.equal(row(stock.id).quantity,3);checks++;
 expect(await action('warehouse_move',row(stock.id),{direction:'Dispatch',quantity:4,evidence:'QA shortage'}),400);
 expect(await action('warehouse_move',row(stock.id),{direction:'Receive',quantity:5,evidence:'QA receipt 2'},operator),200);assert.equal(row(stock.id).quantity,8);checks++;
 assert.equal(database.prepare('SELECT SUM(debit) d,SUM(credit) c FROM journal_lines').get().d,totals.d);checks++;
 const service=await create('service',{name:'QA repacking',jobId:job.id,basis:'Per unit',quantity:10,rate:3});expect(await action('complete_work',service,{evidence:'QA completed service event'}),200);const completed=row(service.id);
 expect(await action('invoice_service',completed,{dueDate:future,taxCategory:'Standard-rated'}),200);expect(await action('invoice_service',row(service.id),{dueDate:future,taxCategory:'Standard-rated'}),400);assert.ok(row(service.id).invoiceId);checks++;
 expect(await call(actions.POST,{action:'run_rules'}),200);const taskCount=database.prepare("SELECT COUNT(*) n FROM records WHERE kind='task'").get().n;expect(await call(actions.POST,{action:'run_rules'}),200);assert.equal(database.prepare("SELECT COUNT(*) n FROM records WHERE kind='task'").get().n,taskCount);checks++;
 expect(await action('milestone',row(job.id),{status:'Closed',source:'Manual',evidence:'QA close request'}),400);
 expect(await call(actions.POST,{action:'settings',data:{name:'Not allowed',minMargin:0,vatRate:0,trn:'',warehouseEnabled:false}},operator),403);
 const badOrigin=await call(records.POST,{kind:'task',data:{title:'CSRF'}},owner,'POST',{'Idempotency-Key':crypto.randomUUID(),'Origin':'https://other.test'});expect(badOrigin,403);
 const balance=database.prepare('SELECT SUM(debit) d,SUM(credit) c FROM journal_lines').get();assert.equal(balance.d,balance.c);checks++;
 console.log(JSON.stringify({passed:checks,scope:'Actual routes + SQLite migrations; simulated identity and D1/R2 adapters',invariants:['role boundaries','request idempotency','quote acceptance','stock concurrency','evidence-controlled releases','balanced postings','duplicate receipts','service billing','repeat-safe task rules']}));
}finally{database.close();delete globalThis.__osQA;await rm(temp,{recursive:true,force:true});}
