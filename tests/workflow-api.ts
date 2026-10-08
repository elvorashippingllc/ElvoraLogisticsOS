import { signInReady } from './login-ready'
import assert from 'node:assert/strict'
const base=process.env.BASE_URL??'http://127.0.0.1:8098'
async function login(email:string,password:string){const r=await signInReady(base,{email,password});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]}
const admin=await login('admin@elvorashipping.com','Elvora@Admin2026')
async function api(path:string,method='GET',body?:unknown,status=200,cookie=admin){const r=await fetch(base+path,{method,headers:{'content-type':'application/json','x-elvora-client':'web',cookie},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json() as any;assert.equal(r.status,status,JSON.stringify(data));return data}
await api('/api/e/workflow_runs','POST',{label:'Forged run'},403)
await api('/api/e/automation_rules','POST',{name:'Bad state change',entity:'jobs',trigger:'Record updated',action:'Set field value',target:'job_status=CLOSED'},400)
const rule=await api('/api/e/automation_rules','POST',{name:'API dead-letter test',entity:'leads',trigger:'Record created',action:'Create follow-up task',message:'{unknown}',max_attempts:1},201)
const lead=await api('/api/e/leads','POST',{company:'API workflow test '+Date.now()},201)
async function waitFor(ruleId:number,recordId:number,status:string){for(let i=0;i<45;i++){const d=await api('/api/e/workflow_runs?pageSize=100');const r=d.rows.find((r:any)=>r.rule_id===ruleId&&r.record_id===recordId);if(r?.status===status)return r;await new Promise(r=>setTimeout(r,500))}throw Error('Workflow status did not reach '+status)}
const run=await waitFor(rule.id,lead.id,'Failed')
const full=await api(`/api/e/workflow_runs/${run.id}`);assert.equal(full.children.attempts.length,1)
await api(`/api/workflow-runs/${run.id}/retry`,'POST',{reason:'short'},400)
await api(`/api/workflow-runs/${run.id}/retry`,'POST',{reason:'Reviewed error and authorised retry'})
assert.equal((await api(`/api/e/workflow_runs/${run.id}`)).status,'Queued')
await api('/api/e/automation_rules/'+rule.id,'PUT',{active:false})
const wa=await api('/api/e/automation_rules','POST',{name:'API uncertainty test',entity:'leads',trigger:'Record created',action:'Send WhatsApp to number',target:'+971500000000',message:'No configured provider'},201)
const prospect=await api('/api/e/leads','POST',{company:'API uncertainty '+Date.now()},201)
const uncertain=await waitFor(wa.id,prospect.id,'Needs review')
await api(`/api/workflow-runs/${uncertain.id}/retry`,'POST',{reason:'Unsafe replay must be prevented'},400)
await api(`/api/workflow-runs/${uncertain.id}/resolve`,'POST',{outcome:'Cancelled',reason:'Reviewed provider log; cancel without replay'})
await api(`/api/workflow-runs/${uncertain.id}/resolve`,'POST',{outcome:'Succeeded',reason:'Duplicate contradictory decision blocked'},400)
assert.equal((await api(`/api/e/workflow_runs/${uncertain.id}`)).status,'Cancelled')
const limitedRole=await api('/api/e/roles','POST',{name:'Workflow permission test '+Date.now(),permissions:{jobs:['view']}},201)
const limitedEmail='workflow-clerk-'+Date.now()+'@example.invalid'
await api('/api/e/users','POST',{name:'Workflow clerk',email:limitedEmail,role_id:limitedRole.id,password:'Clerk@Pass2026',active:true},201)
const clerk=await login(limitedEmail,'Clerk@Pass2026')
await api(`/api/e/workflow_runs/${run.id}`,'GET',undefined,403,clerk)
await api(`/api/workflow-runs/${run.id}/retry`,'POST',{reason:'Unauthorised attempt'},403,clerk)
console.log('Workflow API passed: read-only queue, protected states, worker failure/history, manual internal retry, uncertain external review without replay, duplicate decisions and permission checks.')
