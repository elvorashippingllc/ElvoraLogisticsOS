import {q} from '../db'
import {assertCan,can} from '../engine'
import {loadUser} from '../auth'
import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import {tx} from '../db'
import {idOf} from './helpers'
import {approveFreightDocument,amendFreightDocument,releaseFreightDocument,requestCustodyTransfer,acknowledgeCustody} from '../domain/cargo-docs'
export default async function(app:FastifyInstance){
 app.get('/api/custody/recipients',async req=>{assertCan(req.ctx,'documents','view');return q.all('SELECT id,name FROM users WHERE active=1 AND party_id IS NULL AND deleted_at IS NULL').filter(u=>u.id!==req.ctx.user?.id&&can(loadUser(u.id),'documents','edit')&&can(loadUser(u.id),'jobs','view'))})
 app.post('/api/freight-documents/:id/approve',async req=>tx(()=>approveFreightDocument(idOf((req.params as any).id),req.ctx)))
 app.post('/api/freight-documents/:id/amend',async req=>{const b=z.object({reason:z.string().trim().min(10).max(2000)}).parse(req.body);return tx(()=>amendFreightDocument(idOf((req.params as any).id),b.reason,req.ctx))})
 app.post('/api/freight-documents/:id/release',async req=>{const b=z.object({evidence:z.string().trim().min(10).max(2000)}).parse(req.body);return tx(()=>releaseFreightDocument(idOf((req.params as any).id),b.evidence,req.ctx))})
 app.post('/api/document-originals/:id/transfer',async req=>{const b=z.object({holder_kind:z.enum(['Office','Employee','Customer','Bank','Courier']),holder_name:z.string().trim().min(3).max(200),recipient_id:z.number().int().positive().optional(),tracking:z.string().trim().max(200).optional(),evidence:z.string().trim().min(10).max(2000)}).parse(req.body);return tx(()=>requestCustodyTransfer(idOf((req.params as any).id),b,req.ctx))})
 app.post('/api/custody-events/:id/acknowledge',async req=>{const b=z.object({evidence:z.string().trim().min(10).max(2000)}).parse(req.body);return tx(()=>acknowledgeCustody(idOf((req.params as any).id),b.evidence,req.ctx))})
}
