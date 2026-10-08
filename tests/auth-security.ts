import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { buildApp } from '../src/server/app'
import { q, db } from '../src/server/db'
import { config } from '../src/server/config'
import { newApiKey, totpAt, attemptLogin, verifyTotp } from '../src/server/auth'
import { setSettings } from '../src/server/settings'
import { pgConnectionOptions } from '../src/server/pgbridge'
import { can } from '../src/server/engine'

syncSchema(); seedReference()
const app = await buildApp()
let checks = 0, address = 1
const check = (label: string, value: unknown) => { assert.ok(value, label); checks++; console.log('  ✓', label) }
async function request(path: string, method = 'GET', payload?: any, cookie?: string, bearer?: string) {
  return app.inject({ url: path, method: method as any, payload, remoteAddress: `127.0.0.${address++}`, headers: { 'x-elvora-client': 'web', ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) } })
}
const sid = (r: any) => 'elvora_sid=' + r.cookies.find((c: any) => c.name === 'elvora_sid').value
try {
  const credentials = { email: config.accounts.adminEmail, password: config.accounts.adminPassword }
  const login = await request('/api/auth/login', 'POST', credentials)
  check('fresh login requires a personal password', login.json().mustChangePassword)
  const cookie = sid(login), id = login.json().user.id
  check('business reads blocked before password change', (await request('/api/dashboard', 'GET', undefined, cookie)).statusCode === 403)
  check('business writes blocked before password change', (await request('/api/admin/settings', 'PUT', { company_name: 'Bypass' }, cookie)).statusCode === 403)
  check('profile remains available', (await request('/api/auth/me', 'GET', undefined, cookie)).statusCode === 200)
  const meta = (await request('/api/meta', 'GET', undefined, cookie)).json()
  check('setup metadata exposes no business configuration', meta.entities.length === 0 && !('company_trn' in meta.settings))
  const key = newApiKey()
  q.run('INSERT INTO api_keys(name,user_id,key_hash,active,created_at,updated_at) VALUES (?,?,?,1,?,?)', 'Security fixture', id, key.hash, new Date().toISOString(), new Date().toISOString())
  check('API key cannot bypass required password change', (await request('/api/dashboard', 'GET', undefined, undefined, key.key)).statusCode === 403)
  const password = 'Personal-Security2026!'
  check('personal password unlocks current browser', (await request('/api/auth/change-password', 'POST', { current: credentials.password, next: password }, cookie)).statusCode === 200)
  check('dashboard available after password change', (await request('/api/dashboard', 'GET', undefined, cookie)).statusCode === 200)
  check('API key cannot change account security', (await request('/api/auth/totp/setup', 'POST', { password }, undefined, key.key)).statusCode === 403)
  check('missing demo workspace fails closed', (await request('/api/auth/me', 'GET', undefined, cookie.replace('elvora_sid=', 'elvora_sid=demo.'))).statusCode === 503)
  check('public requests ignore unrelated demo cookies', (await request('/api/auth/branding', 'GET', undefined, cookie.replace('elvora_sid=', 'elvora_sid=demo.'))).statusCode === 200)
  check('bearer authentication ignores unrelated demo cookie', (await request('/api/dashboard', 'GET', undefined, 'elvora_sid=demo.invalid', key.key)).statusCode === 200)
  check('authenticator setup requires password', (await request('/api/auth/totp/setup', 'POST', {}, cookie)).statusCode === 400)
  check('incorrect setup password rejected', (await request('/api/auth/totp/setup', 'POST', { password: 'incorrect' }, cookie)).statusCode === 400)
  const second = sid(await request('/api/auth/login', 'POST', { email: credentials.email, password }))
  const setup = await request('/api/auth/totp/setup', 'POST', { password }, cookie)
  check('verified password can start setup', setup.statusCode === 200)
  const secret = setup.json().secret, code = () => totpAt(secret, Date.now() / 1000), pendingKey = `totp-pending:${id}`
  const pending = JSON.parse(q.val<string>('SELECT value FROM settings WHERE key = ?', pendingKey)!)
  check('pending secret encrypted at rest', pending.secret.startsWith('enc:v1:') && !pending.secret.includes(secret))
  setSettings({}) // Reload the newly persisted internal key rather than relying on a pre-setup cache.
  check('admin settings never expose pending secret', !JSON.stringify((await request('/api/admin/settings', 'GET', undefined, cookie)).json()).includes('totp-pending:'))
  check('another session cannot confirm setup', (await request('/api/auth/totp/enable', 'POST', { code: code() }, second)).statusCode === 400)
  q.run('UPDATE settings SET value = ? WHERE key = ?', JSON.stringify({ ...pending, expires: Date.now() - 1 }), pendingKey)
  check('expired setup cannot be confirmed', (await request('/api/auth/totp/enable', 'POST', { code: code() }, cookie)).statusCode === 400)
  q.run('UPDATE settings SET value = ? WHERE key = ?', JSON.stringify(pending), pendingKey)
  check('valid confirmation enables two-factor authentication', (await request('/api/auth/totp/enable', 'POST', { code: code() }, cookie)).statusCode === 200)
  const stored = q.val<string>('SELECT totp_secret FROM users WHERE id = ?', id)!
  check('active authenticator secret encrypted at rest', stored.startsWith('enc:v1:') && stored !== secret)
  check('enabling two-factor authentication revokes other sessions', (await request('/api/auth/me', 'GET', undefined, second)).statusCode === 401)
  check('setup cannot silently disable active protection', (await request('/api/auth/totp/setup', 'POST', { password }, cookie)).statusCode === 400 && q.val('SELECT totp_secret FROM users WHERE id = ?', id) === stored)
  check('login still requires authenticator code', (await request('/api/auth/login', 'POST', { email: credentials.email, password })).json().needsTotp === true)
  const signedIn = await request('/api/auth/login', 'POST', { email: credentials.email, password, totp: code() })
  check('encrypted authenticator works at sign-in', signedIn.statusCode === 200 && signedIn.json().ok)
  const wrongCode = code() === '000000' ? '999999' : '000000'
  check('disabling requires an authenticator code', (await request('/api/auth/totp/disable', 'POST', { password }, cookie)).statusCode === 400)
  check('wrong disable code preserves protection', (await request('/api/auth/totp/disable', 'POST', { password, code: wrongCode }, cookie)).statusCode === 400 && q.val('SELECT totp_secret FROM users WHERE id = ?', id) === stored)
  check('password and valid code can disable protection', (await request('/api/auth/totp/disable', 'POST', { password, code: code() }, cookie)).statusCode === 200)
  check('disabling revokes other sessions', (await request('/api/auth/me', 'GET', undefined, sid(signedIn))).statusCode === 401)
  check('disabled authenticator is removed', q.val('SELECT totp_secret FROM users WHERE id = ?', id) === null)
  // Legacy plaintext secrets remain usable; repeated bad codes participate in account lockout.
  q.run('UPDATE users SET totp_secret = ? WHERE id = ?', secret, id)
  for (let i = 0; i < 5; i++) { try { attemptLogin(credentials.email, password, wrongCode) } catch { /* expected */ } }
  check('bad authenticator codes lock the account', !!q.val('SELECT locked_until FROM users WHERE id = ?', id))
  assert.throws(() => attemptLogin(credentials.email, password, code()), /temporarily locked/)
  check('valid code cannot bypass temporary lockout', true)
  q.run('UPDATE users SET locked_until = NULL, failed_logins = 0 WHERE id = ?', id)
  check('legacy authenticator remains compatible', 'user' in attemptLogin(credentials.email, password, code()))
  check('unreadable or corrupt authenticator secret fails closed', !verifyTotp('', totpAt('', Date.now() / 1000)))
  const restricted = { id: 99, name: 'Scoped staff', email: 'scoped@example.test', role_id: null, role_name: 'Scoped', permissions: { ai: ['*'] }, branch_id: 1, party_id: null }
  check('restricted roles cannot access company-wide AI tools', !can(restricted, 'ai', 'view'))
  check('portal users cannot access company-wide AI tools', !can({ ...restricted, permissions: '*' as const, party_id: 1 }, 'ai', 'view'))
  const remote = pgConnectionOptions('postgresql://user:pass@database.example/db?sslmode=no-verify')
  check('remote PostgreSQL verifies certificates', remote.ssl !== false && remote.ssl.rejectUnauthorized)
  check('URL parameters cannot override verified TLS', !remote.connectionString.includes('sslmode'))
  const privateCa = pgConnectionOptions('postgresql://user:pass@database.example/db', 'PEM\\nCERT')
  check('private provider CA supported', privateCa.ssl !== false && privateCa.ssl.ca === 'PEM\nCERT')
  check('local PostgreSQL fixture remains compatible', pgConnectionOptions('postgresql://localhost/db').ssl === false)
  console.log(`${checks} security regression checks passed`)
} finally { await app.close(); db.close() }
