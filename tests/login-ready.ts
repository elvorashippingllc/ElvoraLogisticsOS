import assert from 'node:assert/strict'

// Exercise the real first-login password change in each isolated API fixture.
const passwords = new Map<string, string>()
export async function signInReady(base: string, body: { email: string; password: string; totp?: string }) {
  const key = base + ':' + body.email + ':' + body.password
  const headers = { 'content-type': 'application/json', 'x-elvora-client': 'web' }
  const current = passwords.get(key) ?? body.password
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ ...body, password: current }) })
  if (r.ok && (await r.clone().json() as any).mustChangePassword) {
    const next = current + '-Personal1'
    const changed = await fetch(base + '/api/auth/change-password', { method: 'POST', headers: { ...headers, cookie: r.headers.get('set-cookie')!.split(';')[0] }, body: JSON.stringify({ current, next }) })
    assert.equal(changed.status, 200, await changed.text())
    passwords.set(key, next)
  }
  return r
}
