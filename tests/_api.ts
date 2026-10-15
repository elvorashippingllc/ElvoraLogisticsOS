import { signInReady } from './login-ready'

export const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
let pass = 0, fail = 0
const failures: string[] = []
export const ok = (name: string, cond: any, extra?: any) => { if (cond) { pass++; console.log('  ✓', name) } else { fail++; failures.push(name); console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : '') } }
export const sec = (t: string) => console.log('\n' + t)
export const finish = () => { console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1) } }

export class Api {
  cookie = ''
  async login(email = 'admin@elvorashipping.com', password = 'Elvora@Admin2026') {
    const res = await signInReady(BASE, { email, password })
    const sc = res.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0]
    return res.status === 200
  }
  async call(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-elvora-client': 'web', ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
    const text = await res.text(); let data: any; try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, data }
  }
  get = (p: string) => this.call('GET', p)
  post = (p: string, b?: any) => this.call('POST', p, b ?? {})
  put = (p: string, b?: any) => this.call('PUT', p, b ?? {})
  del = (p: string) => this.call('DELETE', p)
  async raw(path: string): Promise<Response> { return fetch(BASE + path, { headers: { 'x-elvora-client': 'web', ...(this.cookie ? { cookie: this.cookie } : {}) } }) }
}
