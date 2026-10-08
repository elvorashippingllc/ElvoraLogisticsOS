import assert from 'node:assert/strict'
const base=process.env.BASE_URL??'http://127.0.0.1:8098'
async function login(email:string,password:string){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json','x-elvora-client':'web'},body:JSON.stringify({email,password})});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]}
const maker=await login('admin@elvorashipping.com','Elvora@Admin2026'),checker=await login('manager@elvorashipping.com','Elvora@Manager2026')
async function api(path:string,method='GET',body?:unknown,cookie=maker,status=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json','x-elvora-client':'web',cookie},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json() as any;assert.equal(r.status,status,JSON.stringify(data));return data}
const vendor=await api('/api/e/parties','POST',{name:'API carrier '+Date.now(),is_vendor:true},maker,201),customer=await api('/api/e/parties','POST',{name:'API document customer '+Date.now(),is_customer:true},maker,201)
const rfq=await api('/api/e/carrier_rfqs','POST',{title:'API rate enquiry',mode:'Air',origin:'Dubai',destination:'London',cargo:'10 cartons, 100 kg',response_deadline:'2099-12-31',children:{providers:[{provider_id:vendor.id,email:'carrier@example.invalid'}]}},maker,201)
await api(`/api/rfqs/${rfq.id}/issue`,'POST');await api(`/api/rfqs/${rfq.id}/issue`,'POST',{},maker,400)
const offer=await api('/api/e/rfq_offers','POST',{rfq_id:rfq.id,provider_id:vendor.id,freight:100,local_charges:10,transit_days:2,free_days:3,valid_until:'2099-12-31',terms:'Includes freight; excludes destination customs',reference:'API-RESPONSE'},maker,201)
assert.equal((await api(`/api/rfqs/${rfq.id}/compare`)).latest[0].total_aed,110)
await api(`/api/rfqs/${rfq.id}/award`,'POST',{offer_id:offer.id,reason:'Own maker award must be rejected'},maker,400)
await api(`/api/rfqs/${rfq.id}/award`,'POST',{offer_id:offer.id,reason:'Competitive compliant rate accepted'},checker)
const adminId=(await api('/api/e/users')).rows.find((u:any)=>u.email==='admin@elvorashipping.com').id
const article=await api('/api/e/knowledge_articles','POST',{title:'API knowledge SOP',category:'SOP',owner_id:adminId,content:'Verified carrier documentation procedure and handover instructions. '.repeat(5)},maker,201)
await api(`/api/knowledge/${article.id}/publish`,'POST',{},maker,400);await api(`/api/knowledge/${article.id}/publish`,'POST',{},checker);await api(`/api/knowledge/${article.id}/acknowledge`,'POST');await api(`/api/knowledge/${article.id}/acknowledge`,'POST',{},maker,400)
const skill=await api('/api/e/competencies','POST',{name:'API air handling '+Date.now(),discipline:'Air',criteria:'Verify air documentation competency'},maker,201)
const qualification=await api('/api/e/staff_qualifications','POST',{user_id:adminId,competency_id:skill.id,level:3,assessed_on:'2026-10-08',expires_on:'2099-12-31',evidence:'Reviewed assessment reference API-AIR-001'},maker,201)
await api(`/api/qualifications/${qualification.id}/verify`,'POST',{},maker,400);await api(`/api/qualifications/${qualification.id}/verify`,'POST',{},checker);assert.ok((await api('/api/competency/matrix')).qualifications.find((q:any)=>q.id===qualification.id).current)
const branch=(await api('/api/e/branches')).rows[0],job=await api('/api/e/jobs','POST',{client_id:customer.id,branch_id:branch.id,department:'FCL EXPORT',trade:'Export',children:{containers:[{container_no:'MSCU1234567'}]}},maker,201)
const doc=await api('/api/e/freight_documents','POST',{kind:'HBL',job_id:job.id,shipper:'Test shipper',consignee:'Test consignee',origin:'Dubai',destination:'London',goods:'10 cartons',packages:10,gross_weight:100,original_count:1},maker,201)
await api(`/api/freight-documents/${doc.id}/approve`,'POST',{},maker,400);await api(`/api/freight-documents/${doc.id}/approve`,'POST',{},checker);await api(`/api/freight-documents/${doc.id}/release`,'POST',{evidence:'Customs gate must reject this release'},checker,400)
const original=(await api('/api/e/document_originals')).rows.find((o:any)=>o.document_id===doc.id)
const recipients=await api('/api/custody/recipients'),recipient=recipients.find((u:any)=>u.name.includes('Manager'))??recipients[0]
const transfer=await api(`/api/document-originals/${original.id}/transfer`,'POST',{holder_kind:'Employee',holder_name:'Documentation manager',recipient_id:recipient.id,evidence:'Physical original handover reference API-CUST-001'})
await api(`/api/custody-events/${transfer.id}/acknowledge`,'POST',{evidence:'Maker receipt must be rejected'},maker,400);await api(`/api/custody-events/${transfer.id}/acknowledge`,'POST',{evidence:'Physical original received and checked'},checker)
const accounts=(await api('/api/e/accounts')).rows;const asset=accounts.find((a:any)=>a.code==='1300')??(await api('/api/e/accounts?q=1300')).rows[0],bank=(await api('/api/e/bank_accounts')).rows.find((b:any)=>b.currency==='AED')
const deposit=await api('/api/e/container_deposits','POST',{job_id:job.id,container_no:'MSCU1234567',carrier_id:vendor.id,amount:100,asset_account_id:asset.id,refund_due:'2099-12-31'},maker,201)
const event=await api(`/api/container-deposits/${deposit.id}/request`,'POST',{kind:'Payment',amount:100,bank_account_id:bank.id,transaction_date:'2026-10-08',reference:'API-DEP-001',evidence:'Bank evidence verified for refundable deposit'})
await api(`/api/deposit-events/${event.id}/approve`,'POST',{reason:'Maker cannot approve own deposit'},maker,400);await api(`/api/deposit-events/${event.id}/approve`,'POST',{reason:'Independent bank evidence accepted'},checker);assert.equal((await api(`/api/e/container_deposits/${deposit.id}`)).balance,100)
await api(`/api/deposit-events/${event.id}/approve`,'POST',{reason:'Duplicate must be rejected'},checker,400)
// Uploaded text is extracted using the same authenticated file/association flow as an image or PDF.
const data=new FormData();data.append('category','Bill of Lading');data.append('file',new Blob([`BILL OF LADING\nJob reference ${job.job_no}\nShipper Test shipper\nConsignee Test consignee\n`],{type:'text/plain'}),'api-bl.txt')
const upload=await fetch(base+'/api/files',{method:'POST',headers:{'x-elvora-client':'web',cookie:maker},body:data});assert.equal(upload.status,200);const files=await upload.json() as any
const extraction=await api(`/api/files/${files[0].id}/extract`,'POST');assert.equal(extraction.status,'Ready for review');assert.ok(extraction.candidates.some((c:any)=>c.job_id===job.id))
await api(`/api/extractions/${extraction.id}/review`,'POST',{job_id:job.id,note:'Verified original job reference and shipper'});await api(`/api/extractions/${extraction.id}/review`,'POST',{job_id:job.id,note:'Duplicate review cannot overwrite association'},maker,400)
console.log('Enterprise API acceptance passed: RFQ, reviewed knowledge, competency, BL/custody, deposit ledger and uploaded document extraction/matching with independent/duplicate guards.')
