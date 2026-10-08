import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import {tx} from '../db'
import {idOf} from './helpers'
import {requestDepositEvent,decideDepositEvent,reverseDepositEvent} from '../domain/deposits'
const reason=z.object({reason:z.string().trim().min(10).max(2000)})
export default async function(app:FastifyInstance){
 app.post('/api/container-deposits/:id/request',async req=>{const b=z.object({kind:z.enum(['Payment','Refund','Damage deduction']),amount:z.number().positive(),bank_account_id:z.number().int().positive().optional(),expense_account_id:z.number().int().positive().optional(),transaction_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),reference:z.string().trim().min(3).max(200),evidence:z.string().trim().min(10).max(2000)}).parse(req.body);return tx(()=>requestDepositEvent(idOf((req.params as any).id),b,req.ctx))})
 app.post('/api/deposit-events/:id/approve',async req=>{const b=reason.parse(req.body);return tx(()=>decideDepositEvent(idOf((req.params as any).id),true,b.reason,req.ctx))})
 app.post('/api/deposit-events/:id/reject',async req=>{const b=reason.parse(req.body);return tx(()=>decideDepositEvent(idOf((req.params as any).id),false,b.reason,req.ctx))})
 app.post('/api/deposit-events/:id/reverse',async req=>{const b=reason.parse(req.body);return tx(()=>reverseDepositEvent(idOf((req.params as any).id),b.reason,req.ctx))})
}
