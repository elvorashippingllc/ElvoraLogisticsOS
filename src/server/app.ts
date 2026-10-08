import path from 'node:path'
import fs from 'node:fs'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fstatic from '@fastify/static'
import { config } from './config'
import { HttpError } from './util'
import { userFromToken, userFromApiKey } from './auth'
import { enterDb } from './db'
import { getDemoDb } from './demo/workspace'
import type { Ctx, SessionUser } from './engine'
import { ZodError } from 'zod'

declare module 'fastify' {
  interface FastifyRequest { user: SessionUser | null; ctx: Ctx; sessionHash?: string }
}

export const COOKIE = 'elvora_sid'
export const DEMO_PREFIX = 'demo.'
const PUBLIC = [/^\/api\/demo\/status$/, /^\/api\/health$/, /^\/api\/health\/db$/, /^\/api\/auth\/login$/, /^\/api\/public\//, /^\/api\/auth\/branding$/]

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.isProd ? { level: 'info' } : { level: 'warn' }, trustProxy: config.trustProxy, bodyLimit: 12 * 1024 * 1024 })

  // tolerate empty JSON bodies (action endpoints such as POST .../post)
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, raw, done) => {
    ;(req as any).rawBody = raw
    if (!raw || !(raw as string).trim()) return done(null, {})
    try { done(null, JSON.parse(raw as string)) } catch { const e: any = new Error('Invalid JSON body'); e.statusCode = 400; done(e) }
  })

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], fontSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'self'"], frameSrc: ["'self'"], frameAncestors: ["'self'"], baseUri: ["'self'"], formAction: ["'self'"] } },
    crossOriginEmbedderPolicy: false, hsts: config.isProd ? { maxAge: 15552000 } : false,
  })
  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 10 } })
  await app.register(rateLimit, { global: false })

  app.decorateRequest('user', null)
  app.decorateRequest('ctx', null as any)

  // Demo sessions (cookie prefix "demo.") and demo tracking links run against the isolated demo database.
  app.addHook('onRequest', (req: FastifyRequest, _reply, done) => {
    const raw = req.cookies?.[COOKIE]
    const demoRequest = (!!raw && raw.startsWith(DEMO_PREFIX)) || req.url.startsWith('/api/public/track/demo-')
    enterDb(demoRequest ? getDemoDb() ?? undefined : undefined, () => {
      try {
        req.user = null
        const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : undefined
        if (bearer) {
          req.user = userFromApiKey(bearer)
        } else {
          const found = userFromToken(raw && raw.startsWith(DEMO_PREFIX) ? raw.slice(DEMO_PREFIX.length) : raw)
          if (found) { req.user = found.user; req.sessionHash = found.hash }
        }
        req.ctx = { user: req.user, ip: req.ip }
        done()
      } catch (e: any) { done(e) }
    })
  })

  app.addHook('preHandler', async (req) => {
    const url = req.url.split('?')[0]
    if (!url.startsWith('/api/')) return
    if (PUBLIC.some(r => r.test(url))) return
    if (!req.user) throw new HttpError(401, 'Please sign in')
    // CSRF: cookie-authenticated mutations must carry the custom header (cannot be set cross-site without CORS)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.user.apiKey && req.headers['x-elvora-client'] !== 'web') throw new HttpError(403, 'Missing client header')
  })

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message, details: err.details })
    if (err instanceof ZodError) return reply.status(400).send({ error: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') })
    if (err?.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.message })
    if (typeof err?.code === 'string' && (err.code.startsWith('SQLITE_CONSTRAINT') || /^23\d{3}$/.test(err.code))) {
      req.log.warn({ err }, 'constraint')
      return reply.status(409).send({ error: /UNIQUE/.test(err.message) || err.code === '23505' || /duplicate key/.test(err.message) ? 'A record with the same unique value already exists' : 'The change conflicts with existing data' })
    }
    req.log.error({ err, url: req.url }, 'unhandled')
    return reply.status(500).send({ error: config.isProd ? 'Unexpected server error' : String(err?.message ?? err) })
  })

  // routes
  const mods = await Promise.all([
    import('./routes/auth'), import('./routes/meta'), import('./routes/crud'), import('./routes/panel'), import('./routes/files'),
    import('./routes/work'), import('./routes/jobs'), import('./routes/sales'), import('./routes/finance'), import('./routes/warehouse'), import('./routes/insights'), import('./routes/admin'), import('./routes/integrations'), import('./routes/compliance'), import('./routes/demo'),
  ])
  for (const m of mods) await app.register(m.default)
  app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }))
  // Database round-trip time. The app talks to PostgreSQL synchronously, so this is the number that decides whether the host is close enough to the database.
  app.get('/api/health/db', async () => {
    const { q, isPg } = await import('./db')
    const t = process.hrtime.bigint(); const n = 10
    for (let i = 0; i < n; i++) q.val('SELECT 1')
    const ms = Number(process.hrtime.bigint() - t) / 1e6 / n
    return { ok: true, driver: isPg ? 'postgresql' : 'sqlite', avg_query_ms: Math.round(ms * 100) / 100, verdict: !isPg ? 'local database' : ms < 10 ? 'excellent' : ms < 40 ? 'good' : ms < 100 ? 'slow - pages will feel sluggish' : 'too slow - move the app closer to the database' }
  })

  // static web app
  const webDir = path.resolve('dist/web')
  if (fs.existsSync(webDir)) {
    await app.register(fstatic, { root: webDir, wildcard: false, setHeaders(res, p) { if (/\/assets\//.test(p)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); else res.setHeader('Cache-Control', 'no-cache') } })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Not found' })
      return reply.sendFile('index.html')
    })
  } else {
    app.setNotFoundHandler((req, reply) => reply.status(404).send({ error: 'Not found' }))
  }
  return app
}

