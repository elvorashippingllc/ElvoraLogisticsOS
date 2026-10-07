import type { FastifyRequest } from 'fastify'
import { can } from '../engine'
import { bad, forbidden } from '../util'
import type { Action } from '../../shared/types'
import type { Filter, ListParams } from '../engine'

export function need(req: FastifyRequest, module: string, action: Action = 'view') {
  if (!can(req.user, module, action)) throw forbidden(`You do not have ${action} access to ${module}`)
}
export function idOf(v: unknown): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw bad('Invalid id')
  return n
}
export function parseListParams(query: Record<string, any>): ListParams {
  let filters: Filter[] = []
  if (query.filters) { try { const f = JSON.parse(String(query.filters)); if (Array.isArray(f)) filters = f.filter(x => x && typeof x.field === 'string') } catch { throw bad('Invalid filters') } }
  return {
    q: query.q ? String(query.q) : undefined, page: query.page ? Number(query.page) : undefined, pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    sort: query.sort ? String(query.sort) : undefined, dir: query.dir ? String(query.dir) : undefined, filters,
    ids: query.ids ? String(query.ids).split(',').map(Number).filter(n => Number.isInteger(n) && n > 0) : undefined,
  }
}
export const body = <T = Record<string, any>>(req: FastifyRequest): T => ((req.body ?? {}) as T)
