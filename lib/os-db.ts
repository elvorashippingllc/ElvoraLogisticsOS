import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { headers } from 'next/headers';
export type Member={id:string;email:string;role:string;userId:string};
export class OsError extends Error{constructor(message:string,public status=400){super(message);}}
export function db(){const d=(env as unknown as {DB:D1Database}).DB;if(!d)throw new OsError('Company storage is unavailable. Try again shortly.',503);return d;}
export function bucket(){const b=(env as unknown as {BUCKET:R2Bucket}).BUCKET;if(!b)throw new OsError('Document storage is unavailable. Try again shortly.',503);return b;}
export const now=()=>new Date().toISOString();
export const id=()=>crypto.randomUUID();
export function json(row:Record<string,unknown>){return { ...JSON.parse(String(row.data)),id:row.id,ref:row.ref,kind:row.kind,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at};}
export async function requireMember(owner=false):Promise<Member>{const u=await getChatGPTUser();if(!u)throw new OsError('Sign in with ChatGPT to open company records.',401);
 const d=db(),stamp=now();const org=await d.prepare('SELECT * FROM organizations WHERE id = ?').bind('elvora').first();
 if(!org){await d.batch([d.prepare('INSERT OR IGNORE INTO organizations (id,owner_id,data,updated_at) VALUES (?,?,?,?)').bind('elvora',u.userId,JSON.stringify({name:'Elvora Shipping L.L.C.',currency:'AED',timezone:'Asia/Dubai',minMargin:15,vatRate:5,warehouseEnabled:false}),stamp),d.prepare('INSERT OR IGNORE INTO members (id,email,role,user_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM organizations WHERE owner_id = ?)').bind(id(),u.email.toLowerCase(),'owner',u.userId,stamp,u.userId)]);}
 const member=await d.prepare('SELECT * FROM members WHERE user_id = ? OR email = ?').bind(u.userId,u.email.toLowerCase()).first();if(!member)throw new OsError('Your account has not been assigned to ElvoraOS. Ask the owner for access.',403);
 if(member.user_id&&member.user_id!==u.userId)throw new OsError('Account identity does not match the assigned member.',403);
 if(!member.user_id)await d.prepare('UPDATE members SET user_id = ? WHERE id = ? AND user_id IS NULL').bind(u.userId,member.id).run();
 if(owner&&member.role!=='owner')throw new OsError('Owner approval is required for this action.',403);
 return {id:String(member.id),email:String(member.email),role:String(member.role),userId:u.userId};
}
export async function checkOrigin(request:Request){const h=await headers();const origin=request.headers.get('origin');const host=h.get('host');if(origin&&new URL(origin).host!==host&&new URL(origin).host!==new URL(request.url).host)throw new OsError('Request origin is not allowed.',403);}
export function auditStmt(actor:string,action:string,recordId:string|null,before:unknown,after:unknown){return db().prepare('INSERT INTO audit (id,actor,action,record_id,before,after,created_at) VALUES (?,?,?,?,?,?,?)').bind(id(),actor,action,recordId,before?JSON.stringify(before):null,after?JSON.stringify(after):null,now());}
export function eventStmt(event:string,recordId:string,data:unknown,status='completed'){return db().prepare('INSERT INTO outbox (id,event,record_id,data,status,created_at) VALUES (?,?,?,?,?,?)').bind(id(),event,recordId,JSON.stringify(data),status,now());}
const prefixes:Record<string,string>={customer:'CUS',supplier:'SUP',lead:'LEAD',quote:'Q',job:'JOB',invoice:'INV',bill:'BILL',rate:'RATE',task:'TASK',customs:'CUSCASE',delivery:'TRIP',warehouse:'STOCK',contract:'CON',claim:'CLM',employee:'EMP',expense:'EXP',payroll:'PAYROLL',compliance:'COMP',bank:'BANK',order:'ORD',leg:'LEG',booking:'BKG',cargo:'CARGO',consolidation:'CONSOL',warehouseOrder:'WH',service:'SVC',asset:'ASSET',ticket:'TKT',project:'PRJ',permit:'PERMIT'};
export async function reference(kind:string){const y=new Date().getFullYear();const r=await db().prepare('INSERT INTO sequences (kind,value) VALUES (?,1) ON CONFLICT(kind) DO UPDATE SET value = value + 1 RETURNING value').bind(kind+':'+y).first<{value:number}>();return `ELV-${prefixes[kind]??kind.toUpperCase()}-${y}-${String(r?.value??1).padStart(5,'0')}`;}
export function recordStmt(r:{id:string;kind:string;ref:string;data:unknown}){const stamp=now();return db().prepare('INSERT INTO records (id,kind,ref,data,version,created_at,updated_at) VALUES (?,?,?,?,1,?,?)').bind(r.id,r.kind,r.ref,JSON.stringify(r.data),stamp,stamp);}
export async function getRecord(recordId:string,kind?:string){const r=await db().prepare('SELECT * FROM records WHERE id = ?').bind(recordId).first();if(!r||kind&&r.kind!==kind)throw new OsError('Record not found.',404);return {row:r,data:JSON.parse(String(r.data))};}
export async function settings(){const r=await db().prepare('SELECT data FROM organizations WHERE id = ?').bind('elvora').first();return JSON.parse(String(r?.data??'{}'));}
export function errorResponse(e:unknown){console.error('ElvoraOS request:',e instanceof Error?e.message:'failed');return Response.json({error:e instanceof OsError||e instanceof Error&&!/D1|SQLITE|R2|constraint/i.test(e.message)?e.message:'The operation could not be saved. Refresh the record and try again.'},{status:e instanceof OsError?e.status:400,headers:{'Cache-Control':'no-store'}});}
