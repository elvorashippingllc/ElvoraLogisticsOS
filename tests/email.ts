import assert from 'node:assert/strict'
import http from 'node:http'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { buildApp } from '../src/server/app'
import { q, db } from '../src/server/db'
import { config } from '../src/server/config'
import { newApiKey } from '../src/server/auth'
import { getSetting } from '../src/server/settings'
import { processOutbox } from '../src/server/mailer'

syncSchema(); seedReference()
const app = await buildApp(), received: any[] = []
let fail = false, checks = 0
const mock = http.createServer(async (req, res) => { let raw = ''; for await (const b of req) raw += b; received.push(JSON.parse(raw || '{}')); res.writeHead(fail ? 422 : 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(fail ? { message: 'Sender not authorised' } : { id: 'mock-message' })) })
await new Promise<void>(r => mock.listen(0, '127.0.0.1', r))
process.env.RESEND_API_URL = `http://127.0.0.1:${(mock.address() as any).port}`
const check = (label: string, value: unknown) => { assert.ok(value, label); checks++; console.log('  ✓', label) }
let cookie = ''
const request = (url: string, method = 'GET', payload?: any, bearer?: string) => app.inject({ url, method: method as any, payload, headers: { 'x-elvora-client': 'web', ...(bearer ? { authorization: `Bearer ${bearer}` } : { cookie }) } })
const waitStatus = async (id: number, status: string) => { for (let i = 0; i < 100; i++) { if (q.val('SELECT status FROM email_outbox WHERE id=?', id) === status) return true; await new Promise(r => setTimeout(r, 20)) } return false }
try {
  const login = await request('/api/auth/login', 'POST', { email: config.accounts.adminEmail, password: config.accounts.adminPassword })
  cookie = 'elvora_sid=' + login.cookies.find(c => c.name === 'elvora_sid')!.value
  await request('/api/auth/change-password', 'POST', { current: config.accounts.adminPassword, next: 'Mail-Regression2026!' })
  const account = (email: string) => ({ email, provider: 'resend', host: '', port: 465, secure: true, user: '', password: '', apiKey: 'mock-private-key', enabled: true })
  check('five company addresses are available', (await request('/api/email/senders')).json().length === 5)
  const message = { from: 'sales@elvorashipping.com', to: 'customer@example.com', cc: 'accounts@example.com', subject: 'Shipment update', body: 'Cargo is ready. <script>not HTML</script>' }
  check('unconnected sender rejected', (await request('/api/email/send', 'POST', message)).statusCode === 400)
  check('configure independent senders', (await request('/api/email/settings', 'PUT', [account(message.from), account('accounts@elvorashipping.com')])).statusCode === 200)
  check('credentials encrypted at rest', String(q.val('SELECT value FROM settings WHERE key=?', 'mail_accounts')).includes('enc:v1:') && !String(q.val('SELECT value FROM settings WHERE key=?', 'mail_accounts')).includes('mock-private-key'))
  check('credentials never returned by sender settings', !JSON.stringify((await request('/api/email/settings')).json()).includes('mock-private-key'))
  check('credentials masked in general settings', (await request('/api/admin/settings')).json().mail_accounts === '********')
  check('invalid recipients rejected', (await request('/api/email/send', 'POST', { ...message, to: 'invalid' })).statusCode === 400)
  check('unapproved from address rejected', (await request('/api/email/send', 'POST', { ...message, from: 'spoof@example.com' })).statusCode === 400)
  const sent = (await request('/api/email/send', 'POST', message)).json()
  await processOutbox()
  check('queued message reaches provider', await waitStatus(sent.id, 'Sent'))
  check('selected sender and cc reach provider', received[0].from === message.from && received[0].cc[0] === message.cc)
  check('body escaped in HTML version', received[0].html.includes('&lt;script&gt;'))
  fail = true
  const failed = (await request('/api/email/send', 'POST', { ...message, from: 'accounts@elvorashipping.com' })).json()
  check('provider failure is visible', await waitStatus(failed.id, 'Failed'))
  fail = false
  check('owner can retry failed mail', (await request(`/api/email/messages/${failed.id}/retry`, 'POST')).statusCode === 200)
  check('retry succeeds', await waitStatus(failed.id, 'Sent'))
  check('sender remains selected after retry', received.at(-1).from === 'accounts@elvorashipping.com')
  check('sent messages cannot be retried', (await request(`/api/email/messages/${sent.id}/retry`, 'POST')).statusCode === 400)
  const blank = [account(message.from), account('accounts@elvorashipping.com')].map(a => ({ ...a, apiKey: '' }))
  await request('/api/email/settings', 'PUT', blank)
  check('blank credentials preserve saved connection', JSON.parse(getSetting('mail_accounts'))[0].apiKey === 'mock-private-key')
  const key = newApiKey(), admin = login.json().user.id
  const role = q.insert(`INSERT INTO roles(name,permissions,created_at,updated_at) VALUES (?,?,?,?)`, 'Email viewer', JSON.stringify({ crm: ['view'] }), new Date().toISOString(), new Date().toISOString())
  q.run('UPDATE users SET role_id=? WHERE id=?', role, admin)
  q.run('INSERT INTO api_keys(name,user_id,key_hash,active,created_at,updated_at) VALUES (?,?,?,1,?,?)', 'Mail fixture', admin, key.hash, new Date().toISOString(), new Date().toISOString())
  check('viewer cannot send', (await request('/api/email/send', 'POST', message, key.key)).statusCode === 403)
  check('viewer cannot read credentials', (await request('/api/email/settings', 'GET', undefined, key.key)).statusCode === 403)
  check('viewer can read own message history', (await request('/api/email/messages', 'GET', undefined, key.key)).statusCode === 200)
  console.log(`PASS: ${checks} email checks`)
} finally { await app.close(); await new Promise<void>(r => mock.close(() => r())); db.close() }
