import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createHash} from 'node:crypto'
import {q,tx} from '../db'
import {assertCan,getRecord,getDef,createRecord,patchRecord,audit,type Ctx,type Rec} from '../engine'
import {openStored} from '../integrations/storage'
import {bad,notFound,nowIso} from '../util'
const exec=promisify(execFile)
export function accessibleAttachment(id:number,ctx:Ctx){assertCan(ctx,'documents','view');if(ctx.user?.party_id)throw bad('OCR review is available to internal staff only');const a=q.get('SELECT * FROM attachments WHERE id=? AND deleted_at IS NULL',id);if(!a)throw notFound();if(a.link_entity)getRecord(getDef(a.link_entity),a.link_id,ctx,{children:false});return a}
async function bytes(a:Rec){const stream=await openStored(a.stored_name);if(!stream)throw bad('The stored file is missing');const chunks:Buffer[]=[];let size=0;for await(const c of stream){size+=c.length;if(size>20*1024*1024){stream.destroy();throw bad('OCR accepts files up to 20 MB')}chunks.push(Buffer.from(c))}return Buffer.concat(chunks)}
export function matchReferences(text:string,ctx:Ctx){assertCan(ctx,'jobs','view');const escaped=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),candidates:Rec[]=[],references:Rec[]=[]
 for(const j of q.all("SELECT id,job_no,mbl_no FROM jobs WHERE deleted_at IS NULL AND job_status<>'CANCELLED'")){const hits=[['Job number',j.job_no],['Master BL/AWB',j.mbl_no]].filter(([,ref])=>ref&&new RegExp(`(^|[^A-Z0-9])${escaped(String(ref))}($|[^A-Z0-9])`,'i').test(text));if(hits.length){getRecord(getDef('jobs'),j.id,ctx,{children:false});candidates.push({job_id:j.id,job_no:j.job_no,references:hits.map(([kind,value])=>({kind,value})),confidence:100});references.push(...hits.map(([kind,value])=>({kind,value})))}}
 for(const house of q.all('SELECT job_id,hbl_no FROM shipments WHERE hbl_no IS NOT NULL AND deleted_at IS NULL'))if(house.hbl_no&&new RegExp(`(^|[^A-Z0-9])${escaped(house.hbl_no)}($|[^A-Z0-9])`,'i').test(text)){const job=getRecord(getDef('jobs'),house.job_id,ctx,{children:false});let candidate=candidates.find(c=>c.job_id===job.id);if(!candidate){candidate={job_id:job.id,job_no:job.job_no,references:[],confidence:100};candidates.push(candidate)}candidate.references.push({kind:'House BL/AWB',value:house.hbl_no});references.push({kind:'House BL/AWB',value:house.hbl_no})}
 return {candidates,fields:references}
}
const typeFor=(category:string)=>({'Bill of Lading':'BL','Air Waybill':'AWB','Commercial Invoice':'Invoice','Invoice / Bill':'Invoice','Packing List':'Packing list','Certificate of Origin':'COO','Customs':'Customs','Receipt':'Receipt'} as Record<string,string>)[category]??'Other'
async function command(binary:string,args:string[]){try{return (await exec(binary,args,{timeout:30000,maxBuffer:8*1024*1024})).stdout}catch(e:any){throw bad(e.code==='ENOENT'?`${binary} is not installed on the server`:e.killed?`${binary} exceeded the 30-second extraction limit`:`${binary} could not read this file`)}}
export async function extractDocument(id:number,ctx:Ctx){assertCan(ctx,'documents','edit');assertCan(ctx,'jobs','view');const a=accessibleAttachment(id,ctx)
 if(q.val("SELECT 1 FROM document_extractions WHERE attachment_id=? AND status='Running' AND deleted_at IS NULL",id))throw bad('An extraction is already running for this file')
 const r=createRecord(getDef('document_extractions'),{attachment_id:id,status:'Running',document_type:typeFor(a.category),started_at:nowIso()},{...ctx,system:true})
 let dir:string|undefined
 try{const data=await bytes(a);dir=await fs.mkdtemp(path.join(os.tmpdir(),'elvora-ocr-'));const ext=path.extname(a.file_name).toLowerCase(),input=path.join(dir,'input'+ext);await fs.writeFile(input,data)
  let text='',confidence:number|null=null,pages=1,engine=''
  if(ext==='.txt'){text=data.toString('utf8');engine='UTF-8 text'}
  else if(ext==='.pdf'){text=await command('pdftotext',['-layout','-f','1','-l','20',input,'-']);engine='PDF embedded text';pages=Math.max(1,text.split('\f').length-1)
   if(text.trim().length<20){await command('pdftoppm',['-f','1','-l','10','-scale-to','1600','-png',input,path.join(dir,'page')]);const images=(await fs.readdir(dir)).filter(f=>/^page-.*\.png$/.test(f)).sort();const chunks:string[]=[],conf:number[]=[];for(const image of images){const tsv=await command('tesseract',[path.join(dir,image),'stdout','-l','eng','tsv']);const parsed=parseTsv(tsv);chunks.push(parsed.text);conf.push(...parsed.confidence)}text=chunks.join('\n\n');confidence=conf.length?Math.round(conf.reduce((n,v)=>n+v,0)/conf.length):0;pages=images.length;engine='Tesseract English PDF raster OCR'}
  }else if(['.png','.jpg','.jpeg','.tif','.tiff','.webp'].includes(ext)){const parsed=parseTsv(await command('tesseract',[input,'stdout','-l','eng','tsv']));text=parsed.text;confidence=parsed.confidence.length?Math.round(parsed.confidence.reduce((n,v)=>n+v,0)/parsed.confidence.length):0;engine='Tesseract English image OCR'}
  else throw bad('Use PDF, PNG, JPEG, TIFF, WebP or UTF-8 text')
  if(!text.trim())throw bad('No readable text found; use a clearer scan')
  const current=accessibleAttachment(id,ctx);if(current.stored_name!==a.stored_name)throw bad('Source file changed during extraction')
  const matching=matchReferences(text,ctx)
  return tx(()=>patchRecord(getDef('document_extractions'),r.id,{status:'Ready for review',engine,text:text.trim().slice(0,20000),confidence,pages_processed:pages,...matching,checksum:createHash('sha256').update(data).digest('hex'),completed_at:nowIso()},ctx))
 }catch(e:any){return tx(()=>patchRecord(getDef('document_extractions'),r.id,{status:'Failed',error:String(e.message).slice(0,1000),completed_at:nowIso()},ctx))}
 finally{if(dir)await fs.rm(dir,{recursive:true,force:true})}
}
export function parseTsv(tsv:string){const confidence:number[]=[],words:string[]=[],lines=tsv.split('\n');let line='';for(const row of lines.slice(1)){const col=row.split('\t');if(col.length<12||!col[11]?.trim())continue;const group=col.slice(1,5).join(':');if(group!==line){words.push('\n');line=group}words.push(col.slice(11).join('\t').trim());const n=Number(col[10]);if(n>=0&&n<=100)confidence.push(n)}return {text:words.join(' ').trim(),confidence}}
export async function reviewExtraction(id:number,jobId:number|null,note:string,ctx:Ctx){assertCan(ctx,'documents','edit');const r=getRecord(getDef('document_extractions'),id,ctx),a=accessibleAttachment(r.attachment_id,ctx);if(r.status!=='Ready for review')throw bad('Only a ready extraction can be reviewed');if(note.trim().length<10)throw bad('Record your verification evidence')
 if(createHash('sha256').update(await bytes(a)).digest('hex')!==r.checksum)throw bad('Source file changed; extract and review it again')
 const job=jobId?getRecord(getDef('jobs'),jobId,ctx,{children:false}):null;if(job){assertCan(ctx,'jobs','edit');if(['CLOSED','CANCELLED'].includes(job.job_status))throw bad('Reopen the job before matching new documents');if(a.link_entity&&(a.link_entity!=='jobs'||a.link_id!==jobId))throw bad('File is already linked elsewhere; do not overwrite that association')}
 return tx(()=>{const latest=getRecord(getDef('document_extractions'),id,ctx),file=accessibleAttachment(a.id,ctx);if(latest.status!=='Ready for review')throw bad('Extraction was already reviewed');if(file.link_entity!==a.link_entity||file.link_id!==a.link_id||file.stored_name!==a.stored_name)throw bad('File association changed during review')
  if(job){q.run('UPDATE attachments SET link_entity=?,link_id=?,link_label=?,updated_by=?,updated_at=?,version=version+1 WHERE id=?','jobs',jobId,job._title,ctx.user?.id,nowIso(),a.id);audit(ctx,getDef('jobs'),jobId!,'document_match',{attachment_id:a.id,extraction_id:id,note},job._title)}
  return patchRecord(getDef('document_extractions'),id,{status:'Reviewed',matched_job_id:jobId,reviewed_by:ctx.user?.id,reviewed_at:nowIso(),review_note:note},ctx)
 })
}
export function recoverInterruptedExtractions(){q.run("UPDATE document_extractions SET status='Failed',error='Extraction worker interrupted; start a fresh extraction',completed_at=? WHERE status='Running' AND started_at<?",nowIso(),new Date(Date.now()-15*60000).toISOString())}
