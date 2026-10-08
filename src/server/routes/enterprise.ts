import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import {tx} from '../db'
import {idOf} from './helpers'
import {issueRfq,compareRfq,awardRfq,publishKnowledge,reviseKnowledge,acknowledgeKnowledge,verifyQualification,revokeQualification,competencyMatrix} from '../domain/enterprise'
const reason=z.object({reason:z.string().trim().min(10).max(2000)})
export default async function(app:FastifyInstance){
 app.post('/api/rfqs/:id/issue',async req=>tx(()=>issueRfq(idOf((req.params as any).id),req.ctx)))
 app.get('/api/rfqs/:id/compare',async req=>compareRfq(idOf((req.params as any).id),req.ctx))
 app.post('/api/rfqs/:id/award',async req=>{const b=reason.extend({offer_id:z.number().int().positive()}).parse(req.body);return tx(()=>awardRfq(idOf((req.params as any).id),b.offer_id,b.reason,req.ctx))})
 app.post('/api/knowledge/:id/publish',async req=>tx(()=>publishKnowledge(idOf((req.params as any).id),req.ctx)))
 app.post('/api/knowledge/:id/revise',async req=>{const b=reason.parse(req.body);return tx(()=>reviseKnowledge(idOf((req.params as any).id),b.reason,req.ctx))})
 app.post('/api/knowledge/:id/acknowledge',async req=>tx(()=>acknowledgeKnowledge(idOf((req.params as any).id),req.ctx)))
 app.get('/api/competency/matrix',async req=>competencyMatrix(req.ctx))
 app.post('/api/qualifications/:id/verify',async req=>tx(()=>verifyQualification(idOf((req.params as any).id),req.ctx)))
 app.post('/api/qualifications/:id/revoke',async req=>{const b=reason.parse(req.body);return tx(()=>revokeQualification(idOf((req.params as any).id),b.reason,req.ctx))})
}
