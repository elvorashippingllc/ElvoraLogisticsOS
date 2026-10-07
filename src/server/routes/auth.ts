import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q } from '../db'
import { COOKIE, DEMO_PREFIX } from '../app'
import { runInDb, inDemo } from '../db'
import { getDemoDb } from '../demo/workspace'
import { config } from '../config'
import { attemptLogin, createSession, destroySession, destroyUserSessions, hashPassword, newTotpSecret, sessionHash, validatePasswordStrength, verifyPassword, verifyTotp } from '../auth'
import { bad, HttpError, nowIso } from '../util'
import { audit, getDef } from '../engine'
import { body } from './helpers'
import { getSetting } from '../settings'

export default async function (app: FastifyInstance) {
  const setCookie = (req: any, reply: any, token: string, expires: Date) => {
    const secure = config.cookieSecure ?? (config.isProd && (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https'))
    reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: !!secure, path: '/', expires })
  }

  app.get('/api/auth/branding', async () => ({ company_name: getSetting('company_name'), base_currency: getSetting('base_currency') }))

  app.post('/api/auth/login', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, reply) => {
    const b = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200), totp: z.string().max(10).optional() }).parse(req.body)
    const isDemoLogin = config.demo.enabled && b.email.trim().toLowerCase() === config.demo.email
    if (isDemoLogin && !getDemoDb()) throw new HttpError(503, 'The demo workspace is still being prepared. Try again in a minute.')
    const work = () => {
      const r = attemptLogin(b.email, b.password, b.totp, req.ip, req.headers['user-agent'])
      if ('needsTotp' in r && r.needsTotp) return { needsTotp: true as const }
      const user = (r as any).user
      const s = createSession(user.id, req.ip, req.headers['user-agent'])
      const must = q.val<number>(`SELECT must_change_password FROM users WHERE id = ?`, user.id)
      return { user, s, must }
    }
    const out = isDemoLogin ? runInDb(getDemoDb()!, work) : work()
    if ('needsTotp' in out) return { needsTotp: true }
    setCookie(req, reply, (isDemoLogin ? DEMO_PREFIX : '') + out.s.token, out.s.expires)
    return { ok: true, demo: isDemoLogin, user: { id: out.user.id, name: out.user.name, email: out.user.email, role: out.user.role_name }, mustChangePassword: !!out.must }
  })

  app.post('/api/auth/logout', async (req, reply) => {
    const t = req.cookies?.[COOKIE]
    if (t) destroySession(t.startsWith(DEMO_PREFIX) ? t.slice(DEMO_PREFIX.length) : t)
    reply.clearCookie(COOKIE, { path: '/' })
    return { ok: true }
  })

  app.get('/api/auth/me', async (req) => {
    const u = req.user!
    const row = q.get(`SELECT totp_secret, must_change_password, password_hash, last_login_at FROM users WHERE id = ?`, u.id)
    const config0 = config.accounts
    const usingDefault = !inDemo() && [config0.adminPassword, config0.managerPassword].some(p => verifyPassword(p, row?.password_hash))
    return { demo: inDemo(), id: u.id, name: u.name, email: u.email, role: u.role_name, permissions: u.permissions, branch_id: u.branch_id, party_id: u.party_id, totp: !!row?.totp_secret, mustChangePassword: !!row?.must_change_password, defaultPassword: usingDefault, lastLogin: row?.last_login_at }
  })

  app.post('/api/auth/change-password', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req) => {
    const b = z.object({ current: z.string(), next: z.string() }).parse(req.body)
    const row = q.get(`SELECT * FROM users WHERE id = ?`, req.user!.id)
    if (!verifyPassword(b.current, row?.password_hash)) throw new HttpError(400, 'Current password is incorrect')
    validatePasswordStrength(b.next)
    if (b.next === b.current) throw bad('Choose a different password')
    q.run(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`, hashPassword(b.next), nowIso(), req.user!.id)
    destroyUserSessions(req.user!.id, req.sessionHash)
    audit(req.ctx, getDef('users'), req.user!.id, 'password-change', null, req.user!.name)
    return { ok: true }
  })

  app.post('/api/auth/totp/setup', async (req) => {
    const secret = newTotpSecret()
    q.run(`UPDATE users SET totp_secret = NULL WHERE id = ?`, req.user!.id)
    const pending = secret
    // store pending secret in the session-less settings table keyed by user until verified
    q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, `totp-pending:${req.user!.id}`, JSON.stringify(pending), nowIso())
    const issuer = 'Elvora Logistics OS'
    return { secret, uri: `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(req.user!.email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30` }
  })
  app.post('/api/auth/totp/enable', async (req) => {
    const { code } = z.object({ code: z.string().min(6).max(8) }).parse(req.body)
    const raw = q.val<string>(`SELECT value FROM settings WHERE key = ?`, `totp-pending:${req.user!.id}`)
    if (!raw) throw bad('Start the setup first')
    const secret = JSON.parse(raw)
    if (!verifyTotp(secret, code)) throw bad('That code is not valid — check your authenticator app clock')
    q.run(`UPDATE users SET totp_secret = ? WHERE id = ?`, secret, req.user!.id)
    q.run(`DELETE FROM settings WHERE key = ?`, `totp-pending:${req.user!.id}`)
    audit(req.ctx, getDef('users'), req.user!.id, 'totp-enabled', null, req.user!.name)
    return { ok: true }
  })
  app.post('/api/auth/totp/disable', async (req) => {
    const { password } = z.object({ password: z.string() }).parse(req.body)
    const row = q.get(`SELECT password_hash FROM users WHERE id = ?`, req.user!.id)
    if (!verifyPassword(password, row?.password_hash)) throw bad('Password is incorrect')
    q.run(`UPDATE users SET totp_secret = NULL WHERE id = ?`, req.user!.id)
    audit(req.ctx, getDef('users'), req.user!.id, 'totp-disabled', null, req.user!.name)
    return { ok: true }
  })

  app.get('/api/auth/sessions', async (req) => {
    const rows = q.all(`SELECT id, created_at, last_seen, ip, user_agent FROM sessions WHERE user_id = ? ORDER BY last_seen DESC`, req.user!.id)
    return rows.map(r => ({ id: r.id.slice(0, 16), current: r.id === req.sessionHash, created_at: r.created_at, last_seen: r.last_seen, ip: r.ip, user_agent: r.user_agent }))
  })
  app.delete('/api/auth/sessions/:id', async (req) => {
    const id = String((req.params as any).id)
    q.run(`DELETE FROM sessions WHERE user_id = ? AND id LIKE ? AND id <> ?`, req.user!.id, id.replace(/[%_]/g, '') + '%', req.sessionHash ?? '')
    return { ok: true }
  })
  app.get('/api/auth/login-history', async (req) => q.all(`SELECT at, success, reason, ip, user_agent FROM login_events WHERE user_id = ? ORDER BY id DESC LIMIT 20`, req.user!.id))
  void sessionHash
}
