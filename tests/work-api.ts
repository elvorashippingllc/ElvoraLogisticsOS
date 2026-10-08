import assert from 'node:assert/strict'
const base=process.env.BASE_URL??'http://127.0.0.1:8098'
async function login(email:string,password:string){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json','x-elvora-client':'web'},body:JSON.stringify({email,password})});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]}
const maker=await login('admin@elvorashipping.com','Elvora@Admin2026'),checker=await login('manager@elvorashipping.com','Elvora@Manager2026')
async function api(path:string,method='GET',body?:unknown,cookie=maker,status=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json','x-elvora-client':'web',cookie},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json() as any;assert.equal(r.status,status,JSON.stringify(data));return data}
const recipients=await api('/api/work/recipients'),recipient=recipients.find((u:any)=>u.name.includes('Manager'))??recipients[0]
const lead=await api('/api/e/leads','POST',{company:'Handover API '+Date.now()},maker,201)
const dept=(await api('/api/e/departments')).rows[0]
const admin=(await api('/api/auth/me')).user??await api('/api/auth/me')
const me=admin.id??(await api('/api/e/users')).rows.find((u:any)=>u.email==='admin@elvorashipping.com').id
const item=await api('/api/e/work_items','POST',{title:'Review API enquiry',source_entity:'leads',source_id:lead.id,department_id:dept.id,activity:'Enquiry review',assignee_id:me},maker,201)
await api(`/api/e/work_items/${item.id}`,'PUT',{status:'Completed'})
assert.equal((await api(`/api/e/work_items/${item.id}`)).status,'Open','CRUD cannot set controlled state')
await api(`/api/work/items/${item.id}/transition`,'POST',{status:'Waiting',note:'Waiting for customer response'})
const handover=await api('/api/work/handovers','POST',{to_user_id:recipient.id,note:'Customer enquiry pending; please follow up'})
assert.ok(handover.snapshot.items.some((i:any)=>i.id===item.id))
await api(`/api/e/shift_handovers/${handover.id}`,'PUT',{status:'Acknowledged'},maker,403)
await api(`/api/work/handovers/${handover.id}/acknowledge`,'POST',{note:'Sender cannot acknowledge this handover'},maker,400)
await api(`/api/work/handovers/${handover.id}/acknowledge`,'POST',{note:'Received; customer enquiry accepted'},checker)
await api(`/api/work/handovers/${handover.id}/acknowledge`,'POST',{note:'Do not allow duplicate acknowledgement'},checker,400)
await api(`/api/work/items/${item.id}/transition`,'POST',{status:'Completed',note:'Customer enquiry reviewed and resolved'})
assert.equal((await api(`/api/e/work_items/${item.id}`)).status,'Completed')
console.log('Work API acceptance passed: scoped queues, controlled state, captured handover, recipient acknowledgement and duplicate rejection.')
