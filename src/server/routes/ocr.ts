import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import {idOf} from './helpers'
import {extractDocument,reviewExtraction} from '../domain/ocr'
export default async function(app:FastifyInstance){
 app.post('/api/files/:id/extract',async req=>extractDocument(idOf((req.params as any).id),req.ctx))
 app.post('/api/extractions/:id/review',async req=>{const b=z.object({job_id:z.number().int().positive().nullable(),note:z.string().trim().min(10).max(2000)}).parse(req.body);return reviewExtraction(idOf((req.params as any).id),b.job_id,b.note,req.ctx)})
}
