import assert from 'node:assert/strict'
import {syncSchema} from '../src/server/schema'
import {seedReference} from '../src/server/seed'
import {q,tx} from '../src/server/db'
import {loadUser} from '../src/server/auth'
import {createRecord,getDef,updateRecord,getRecord} from '../src/server/engine'
import {approveFreightDocument,amendFreightDocument,releaseFreightDocument,requestCustodyTransfer,acknowledgeCustody} from '../src/server/domain/cargo-docs'
import {addClosureEvidence,verifyClosureEvidence,closureReadiness} from '../src/server/domain/job-controls'
syncSchema();seedReference()
const aid=q.val<number>("SELECT id FROM users WHERE email='admin@elvorashipping.com'")!,mid=q.val<number>("SELECT id FROM users WHERE email='manager@elvorashipping.com'")!
const maker={user:loadUser(aid)!},checker={user:loadUser(mid)!},mk=(key:string,b:any)=>createRecord(getDef(key),b,maker)
const customer=mk('parties',{name:'Freight documents customer',is_customer:true}),branch=q.val<number>('SELECT id FROM branches LIMIT 1')!
const job=mk('jobs',{client_id:customer.id,branch_id:branch,department:'FCL EXPORT',trade:'Export'})
const fields={kind:'HBL',job_id:job.id,shipper:'Origin shipper',consignee:'Destination consignee',origin:'Jebel Ali',destination:'Rotterdam',goods:'General cargo cartons',packages:10,gross_weight:100,original_count:1,copy_count:2}
const doc=mk('freight_documents',fields);assert.throws(()=>approveFreightDocument(doc.id,maker),/independent/)
tx(()=>approveFreightDocument(doc.id,checker));assert.equal(q.val('SELECT COUNT(*) FROM document_originals WHERE document_id=?',doc.id),1)
assert.throws(()=>updateRecord(getDef('freight_documents'),doc.id,{goods:'Unapproved replacement'},maker),/immutable/)
assert.throws(()=>releaseFreightDocument(doc.id,'Authorised release request reference',checker),/Customs/)
const original=q.get('SELECT id FROM document_originals WHERE document_id=?',doc.id)!
const event=tx(()=>requestCustodyTransfer(original.id,{holder_kind:'Employee',holder_name:'Documentation manager',recipient_id:mid,evidence:'Original delivered to documentation manager'},maker))
assert.throws(()=>acknowledgeCustody(event.id,'Sender cannot acknowledge own handover',maker),/named recipient/)
assert.throws(()=>amendFreightDocument(doc.id,'Amend pending original document',maker),/Return/)
tx(()=>acknowledgeCustody(event.id,'Received the physical original in person',checker));assert.throws(()=>acknowledgeCustody(event.id,'Duplicate acknowledgement must fail',checker),/already/)
const returned=tx(()=>requestCustodyTransfer(original.id,{holder_kind:'Office',holder_name:'Dubai documentation office',recipient_id:aid,evidence:'Return original before amendment'},checker));tx(()=>acknowledgeCustody(returned.id,'Original returned and checked at office',maker))
tx(()=>amendFreightDocument(doc.id,'Correct consignee spelling on document',maker));updateRecord(getDef('freight_documents'),doc.id,{consignee:'Corrected destination consignee',release_mode:'Telex'},maker);tx(()=>approveFreightDocument(doc.id,checker))
assert.equal(q.val('SELECT COUNT(*) FROM freight_document_versions WHERE document_id=?',doc.id),2)
const evidence=addClosureEvidence(job.id,'Customs not applicable','Cross-trade reference confirms customs not applicable',maker);tx(()=>verifyClosureEvidence(job.id,evidence.id,checker))
assert.equal(closureReadiness(job.id,maker).checks.find(c=>c.key==='customs')!.passed,true)
tx(()=>releaseFreightDocument(doc.id,'Carrier release instruction verified REF-TEST-001',checker));assert.equal(getRecord(getDef('freight_documents'),doc.id,maker).status,'Released')
assert.throws(()=>releaseFreightDocument(doc.id,'Duplicate release should fail',checker),/Only approved/)
const air=mk('jobs',{client_id:customer.id,branch_id:branch,department:'AIR EXPORT',trade:'Export'}),mawb=mk('freight_documents',{...fields,kind:'MAWB',job_id:air.id,carrier_document_no:'12300000012'})
assert.throws(()=>approveFreightDocument(mawb.id,checker),/check digit/)
updateRecord(getDef('freight_documents'),mawb.id,{carrier_document_no:'12300000011'.slice(0,10)+'1'},maker)
// Serial 0000001 has check digit 1; use a deliberately invalid 2 first, then the valid serial.
updateRecord(getDef('freight_documents'),mawb.id,{carrier_document_no:'12300000012'},maker);assert.throws(()=>approveFreightDocument(mawb.id,checker),/check digit/)
updateRecord(getDef('freight_documents'),mawb.id,{carrier_document_no:'12300000011'},maker);tx(()=>approveFreightDocument(mawb.id,checker))
console.log('Cargo document controls passed: independent approval, immutable revisions, original custody/return/acknowledgement, amendment gates, customs release gate, telex release and AWB check digit.')
