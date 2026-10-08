import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import {tx} from '../db'
import {getDef,listRecords,assertCan,patchRecord} from '../engine'
import {idOf} from './helpers'
import {handoverRecipients,workOverview,transitionWork,createHandover,acknowledgeHandover} from '../domain/work'
export default async function(app:FastifyInstance){
 app.get('/api/work/recipients',async req=>handoverRecipients(req.ctx))
 app.get('/api/work/overview',async req=>workOverview(req.ctx))
 app.post('/api/work/items/:id/transition',async req=>{const b=z.object({status:z.enum(['In progress','Waiting','Completed','Cancelled']),note:z.string().trim().max(2000).default('')}).parse(req.body);return tx(()=>transitionWork(idOf((req.params as any).id),b.status,b.note,req.ctx))})
 app.post('/api/work/handovers',async req=>{const b=z.object({to_user_id:z.number().int().positive(),note:z.string().trim().min(10).max(2000)}).parse(req.body);return tx(()=>createHandover(b.to_user_id,b.note,req.ctx))})
 app.get('/api/work/handovers',async req=>listRecords(getDef('shift_handovers'),{pageSize:100},req.ctx))
 app.post('/api/work/handovers/:id/acknowledge',async req=>{const b=z.object({note:z.string().trim().min(10).max(2000)}).parse(req.body);return tx(()=>acknowledgeHandover(idOf((req.params as any).id),b.note,req.ctx))})
}
