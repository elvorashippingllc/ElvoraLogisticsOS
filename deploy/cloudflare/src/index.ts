import { Container, getContainer } from '@cloudflare/containers'

/** Secrets and settings, set with `npx wrangler secret put NAME` (see docs/DEPLOY-CLOUDFLARE.md). */
interface Env {
  ELVORA: DurableObjectNamespace<ElvoraOS>
  DATABASE_URL: string
  APP_SECRET: string
  ADMIN_PASSWORD: string
  MANAGER_PASSWORD: string
  PUBLIC_URL?: string
  PG_SCHEMA?: string
  DEMO_ENABLED?: string
}

const INSTANCE = 'main' // one instance only – the app holds a single database connection and runs its own scheduler

export class ElvoraOS extends Container<Env> {
  defaultPort = 8080
  // Idle containers sleep; the cron trigger below keeps this one awake, so it is effectively always on.
  sleepAfter = '1h'
  enableInternet = true // needs outbound access to Supabase, e-mail, WhatsApp, etc.

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx as any, env) // the two Cloudflare type packages disagree on a generic; harmless
    this.envVars = {
      NODE_ENV: 'production',
      REQUIRE_DATABASE_URL: 'true', // the app refuses to start rather than use a throw-away local database
      TRUST_PROXY: 'true',
      COOKIE_SECURE: 'true',
      APP_TIMEZONE: 'Asia/Dubai',
      DEMO_ENABLED: env.DEMO_ENABLED ?? 'false',
      PG_SCHEMA: env.PG_SCHEMA ?? 'elvora',
      DATABASE_URL: env.DATABASE_URL,
      APP_SECRET: env.APP_SECRET,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD,
      MANAGER_PASSWORD: env.MANAGER_PASSWORD,
      ...(env.PUBLIC_URL ? { PUBLIC_URL: env.PUBLIC_URL } : {}),
    }
  }
}

/** Start the container if it is not up. The first start creates the database tables, so allow plenty of time. */
async function ensureRunning(env: Env) {
  const missing = ['DATABASE_URL', 'APP_SECRET', 'ADMIN_PASSWORD', 'MANAGER_PASSWORD'].filter(k => !(env as unknown as Record<string, string | undefined>)[k])
  if (missing.length) throw new Error(`Missing secret(s): ${missing.join(', ')}. Set them with "npx wrangler secret put <NAME>".`)
  const c = getContainer(env.ELVORA, INSTANCE)
  const state = await c.getState()
  if (state.status !== 'healthy') await c.startAndWaitForPorts({ ports: 8080, cancellationOptions: { portReadyTimeoutMS: 240_000 } })
  return c
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const c = await ensureRunning(env)
      const url = new URL(request.url)
      const headers = new Headers(request.headers)
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
      headers.set('x-forwarded-host', url.host)
      return await c.fetch(new Request(request, { headers }))
    } catch (e) {
      return new Response('Elvora Logistics OS is starting or temporarily unavailable. Please retry in a minute.\n' + (e instanceof Error ? e.message : ''), { status: 503, headers: { 'retry-after': '30' } })
    }
  },
  // Cron: make sure the app is awake so scheduled jobs (reminders, outbox, backups) keep running.
  async scheduled(_c: ScheduledController, env: Env): Promise<void> {
    const c = await ensureRunning(env)
    await c.fetch(new Request('http://container/api/health'))
  },
} satisfies ExportedHandler<Env>
