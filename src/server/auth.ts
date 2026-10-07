import crypto from 'node:crypto'
import { q } from './db'
import { config } from './config'
import { nowIso, safeJson, bad, HttpError } from './util'
import type { SessionUser, Perms } from './engine'

// ---------------------------------------------------------------- passwords (scrypt)
const N = 16384, R = 8, P = 1, KEYLEN = 64
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(pw, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}
export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) { crypto.scryptSync(pw, 'x'.repeat(16), KEYLEN, { N, r: R, p: P }); return false } // constant-ish time for unknown users
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt') return false
  const calc = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), KEYLEN, { N: Number(n), r: Number(r), p: Number(p) })
  const exp = Buffer.from(hash, 'base64')
  return exp.length === calc.length && crypto.timingSafeEqual(exp, calc)
}
export function validatePasswordStrength(pw: string) {
  if (pw.length < 10) throw bad('Password must be at least 10 characters')
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) throw bad('Password needs upper-case, lower-case letters and a digit')
}

// ---------------------------------------------------------------- sessions
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
export function createSession(userId: number, ip?: string, ua?: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  const now = new Date()
  const exp = new Date(now.getTime() + config.sessionHours * 3600_000)
  q.run(`INSERT INTO sessions(id, user_id, created_at, expires_at, last_seen, ip, user_agent) VALUES (?,?,?,?,?,?,?)`, sha(token), userId, now.toISOString(), exp.toISOString(), now.toISOString(), ip ?? null, (ua ?? '').slice(0, 200))
  return { token, expires: exp }
}
export function destroySession(token: string) { q.run(`DELETE FROM sessions WHERE id = ?`, sha(token)) }
export function destroyUserSessions(userId: number, exceptHash?: string) { q.run(`DELETE FROM sessions WHERE user_id = ? AND id <> ?`, userId, exceptHash ?? '') }
export const sessionHash = sha

export function loadUser(userId: number): SessionUser | null {
  const u = q.get(`SELECT u.*, r.name AS role_name, r.permissions FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND u.deleted_at IS NULL AND u.active = 1`, userId)
  if (!u) return null
  const perms = safeJson<Perms>(u.permissions, {})
  return { id: u.id, name: u.name, email: u.email, role_id: u.role_id, role_name: u.role_name ?? '', permissions: perms, branch_id: u.branch_id, party_id: u.party_id ?? null }
}

export function userFromToken(token: string | undefined): { user: SessionUser; hash: string } | null {
  if (!token) return null
  const h = sha(token)
  const s = q.get(`SELECT * FROM sessions WHERE id = ?`, h)
  if (!s) return null
  const now = new Date()
  if (new Date(s.expires_at) < now) { q.run(`DELETE FROM sessions WHERE id = ?`, h); return null }
  const user = loadUser(s.user_id)
  if (!user) return null
  if (now.getTime() - new Date(s.last_seen).getTime() > 60_000) {
    // sliding expiry
    q.run(`UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id = ?`, now.toISOString(), new Date(now.getTime() + config.sessionHours * 3600_000).toISOString(), h)
  }
  return { user, hash: h }
}

export function userFromApiKey(key: string | undefined): SessionUser | null {
  if (!key || !key.startsWith('elv_')) return null
  const row = q.get(`SELECT * FROM api_keys WHERE key_hash = ? AND active = 1 AND deleted_at IS NULL`, sha(key))
  if (!row) return null
  q.run(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`, nowIso().slice(0, 16), row.id)
  const u = loadUser(row.user_id)
  return u ? { ...u, apiKey: true } : null
}
export function newApiKey() {
  const key = 'elv_' + crypto.randomBytes(24).toString('base64url')
  return { key, hash: sha(key), prefix: key.slice(0, 8) }
}

// ---------------------------------------------------------------- login with lockout
const MAX_FAILS = 5
export function attemptLogin(email: string, password: string, totp: string | undefined, ip?: string, ua?: string): { user: SessionUser; needsTotp?: false } | { needsTotp: true } {
  const e = email.trim().toLowerCase()
  const row = q.get(`SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL`, e)
  const log = (success: boolean, reason: string) => q.run(`INSERT INTO login_events(at, email, user_id, success, reason, ip, user_agent) VALUES (?,?,?,?,?,?,?)`, nowIso(), e, row?.id ?? null, success ? 1 : 0, reason, ip ?? null, (ua ?? '').slice(0, 200))
  if (row?.locked_until && row.locked_until > nowIso().slice(0, 16)) { log(false, 'locked'); throw new HttpError(423, 'Account temporarily locked after repeated failures. Try again in 15 minutes.') }
  const ok = verifyPassword(password, row?.password_hash)
  if (!row || !ok || !row.active) {
    if (row) {
      const fails = (row.failed_logins ?? 0) + 1
      q.run(`UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?`, fails, fails >= MAX_FAILS ? new Date(Date.now() + 15 * 60_000).toISOString().slice(0, 16) : null, row.id)
    }
    log(false, !row ? 'unknown user' : !row.active ? 'inactive' : 'bad password')
    throw new HttpError(401, 'Incorrect e-mail or password')
  }
  if (row.totp_secret) {
    if (!totp) return { needsTotp: true }
    if (!verifyTotp(row.totp_secret, totp)) { log(false, 'bad totp'); throw new HttpError(401, 'Invalid authenticator code') }
  }
  q.run(`UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?`, nowIso().slice(0, 16), row.id)
  log(true, 'ok')
  const user = loadUser(row.id)
  if (!user) throw new HttpError(401, 'Account unavailable')
  return { user }
}

// ---------------------------------------------------------------- TOTP (RFC 6238)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function newTotpSecret(): string {
  const b = crypto.randomBytes(20); let bits = '', out = ''
  for (const x of b) bits += x.toString(2).padStart(8, '0')
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}
function b32decode(s: string): Buffer {
  let bits = ''
  for (const c of s.replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, '0') }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}
export function totpAt(secret: string, t: number): string {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(t / 30)))
  const h = crypto.createHmac('sha1', b32decode(secret)).update(counter).digest()
  const o = h[h.length - 1] & 0xf
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(code % 1_000_000).padStart(6, '0')
}
export function verifyTotp(secret: string, code: string): boolean {
  const now = Date.now() / 1000
  return [-1, 0, 1].some(w => totpAt(secret, now + w * 30) === String(code).trim())
}
