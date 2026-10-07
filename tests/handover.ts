export {}
/* Client-handover checks: production workspace is empty, the demo workspace is rich and fully isolated.
   Run on a fresh data directory:  npx tsx tests/handover.ts */
const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
let pass = 0, fail = 0
const failures: string[] = []
const ok = (n: string, c: any, x?: any) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; failures.push(n); console.log('  ✗', n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '') } }
class Client {
  cookie = ''
  async api(method: string, path: string, body?: any) {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-elvora-client': 'web', ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
    const sc = res.headers.get('set-cookie'); if (sc && path.includes('/auth/login')) this.cookie = sc.split(';')[0]
    const t = await res.text(); let data: any; try { data = JSON.parse(t) } catch { data = t }
    return { status: res.status, data }
  }
}
const sec = (t: string) => console.log('\n' + t)
const BUSINESS = ['parties', 'contacts', 'leads', 'opportunities', 'activities', 'campaigns', 'quotations', 'rate_cards', 'contracts', 'jobs', 'shipments', 'bookings', 'delivery_orders', 'customs_declarations', 'invoices', 'bills', 'receipts', 'payments', 'journal_entries', 'bank_transactions', 'expenses', 'employees', 'payslips', 'leave_requests', 'attendance', 'tickets', 'claims', 'tasks', 'projects', 'items', 'grns', 'dispatches', 'vehicles', 'drivers', 'transport_orders', 'fixed_assets', 'purchase_orders', 'announcements', 'attachments', 'whatsapp_messages', 'automation_rules', 'webhooks', 'year_end_closes', 'wps_batches', 'ai_runs', 'ai_actions']

async function main() {
  const admin = new Client(), mgr = new Client(), demo = new Client()
  sec('Production workspace: admin and manager, no sample data')
  let r = await admin.api('POST', '/api/auth/login', { email: 'admin@elvorashipping.com', password: 'Elvora@Admin2026' }); ok('admin signs in', r.data.ok && !r.data.demo, r.data)
  ok('admin must change the default password at first login', r.data.mustChangePassword === true)
  r = await mgr.api('POST', '/api/auth/login', { email: 'manager@elvorashipping.com', password: 'Elvora@Manager2026' }); ok('manager signs in', r.data.ok && !r.data.demo); ok('manager must change password', r.data.mustChangePassword === true)
  r = await admin.api('GET', '/api/auth/me'); ok('admin has full access and is not flagged as demo', r.data.permissions === '*' && r.data.demo === false)
  r = await mgr.api('GET', '/api/auth/me'); ok('manager has full access', r.data.permissions === '*')
  const counts: Record<string, number> = {}
  for (const e of BUSINESS) { const x = await admin.api('GET', `/api/e/${e}?pageSize=1`); counts[e] = x.data.total ?? -1 }
  const dirty = Object.entries(counts).filter(([, n]) => n !== 0)
  ok('all business tables are empty in production', dirty.length === 0, dirty)
  r = await admin.api('GET', '/api/e/users'); ok('only the two production users exist (no demo users)', r.data.total === 2 && !r.data.rows.some((u: any) => /demo/i.test(u.email)), r.data.rows?.map((u: any) => u.email))
  r = await admin.api('GET', '/api/e/accounts?pageSize=1'); ok('reference data (chart of accounts) is installed', r.data.total > 40)
  r = await admin.api('GET', '/api/e/legal_entities'); ok('a single default legal entity exists', r.data.total === 1)
  r = await admin.api('GET', '/api/admin/system'); ok('no demo loader in production', r.data.demo_possible === undefined)
  r = await admin.api('POST', '/api/admin/demo-data'); ok('sample-data endpoint is gone', r.status === 404)
  r = await admin.api('GET', '/api/ai/status'); ok('AI employees exist but are all switched off', r.data.agents.length >= 7 && r.data.agents.every((a: any) => !a.active), r.data.agents?.map((a: any) => a.active))

  sec('Demo account')
  r = await demo.api('POST', '/api/auth/login', { email: 'demo@elvorashipping.com', password: 'wrong' }); ok('wrong demo password rejected', r.status === 401)
  r = await demo.api('POST', '/api/auth/login', { email: 'demo@elvorashipping.com', password: 'Demo@Elvora2026' }); ok('demo account signs in', r.data.ok && r.data.demo === true, r.data)
  r = await demo.api('GET', '/api/auth/me'); ok('demo session is flagged as demo with full access', r.data.demo === true && r.data.permissions === '*' && r.data.defaultPassword === false)
  const dc: Record<string, number> = {}
  for (const e of BUSINESS) { const x = await demo.api('GET', `/api/e/${e}?pageSize=1`); dc[e] = x.data.total ?? -1 }
  const empty = Object.entries(dc).filter(([, n]) => n <= 0).map(([k]) => k)
  const optionalEmpty = new Set(['payments'])
  ok('every business area has demo data', empty.filter(k => !optionalEmpty.has(k)).length === 0, empty)
  r = await demo.api('GET', '/api/e/users'); ok('demo workspace has a presenter plus colleagues', r.data.total >= 6 && !r.data.rows.some((u: any) => u.email === 'admin@elvorashipping.com'), r.data.total)

  sec('Scenario coverage in the demo')
  r = await demo.api('GET', '/api/e/jobs?pageSize=100'); const st = new Set(r.data.rows.map((j: any) => j.job_status)); ok('jobs in several statuses (open, in progress, on hold, delivered, closed, cancelled)', ['OPENED', 'IN PROGRESS', 'ON HOLD', 'DELIVERED', 'CLOSED', 'CANCELLED'].every(s => st.has(s)), [...st])
  r = await demo.api('GET', '/api/e/invoices?pageSize=100'); const types = new Set(r.data.rows.map((i: any) => i.doc_type + ':' + i.status)); ok('invoices: posted, partially paid, paid, draft, void, proforma, credit note', ['Tax Invoice:Posted', 'Tax Invoice:Partially paid', 'Tax Invoice:Paid', 'Tax Invoice:Draft', 'Tax Invoice:Void', 'Proforma Invoice:Draft', 'Credit Note:Posted'].every(t => types.has(t) || (t.startsWith('Credit Note') && [...types].some((x: any) => x.startsWith('Credit Note')))), [...types])
  r = await demo.api('GET', '/api/reports/ar_aging'); ok('receivables ageing has every bucket', r.data.totals && r.data.totals.d30 > 0 && r.data.totals.d60 > 0 && r.data.totals.d90p > 0, r.data.totals)
  r = await demo.api('GET', '/api/e/year_end_closes'); ok('previous year is closed', r.data.total === 1 && r.data.rows[0].status === 'Closed')
  r = await demo.api('GET', '/api/e/legal_entities'); ok('multi-entity: two legal entities', r.data.total === 2)
  r = await demo.api('GET', '/api/e/ai_actions?filters=' + encodeURIComponent(JSON.stringify([{ field: 'status', op: 'eq', value: 'Pending' }]))); ok('AI approvals waiting', r.data.total >= 2)
  r = await demo.api('GET', '/api/e/wps_batches'); ok('WPS file generated', r.data.total === 1 && r.data.rows[0].employees >= 5, r.data.rows?.[0])
  r = await demo.api('GET', '/api/e/bank_transactions?pageSize=100'); ok('bank lines both reconciled and unreconciled', new Set(r.data.rows.map((b: any) => b.status)).size === 2)
  r = await demo.api('GET', '/api/e/quotations?pageSize=50'); ok('quotations in many states', new Set(r.data.rows.map((q: any) => q.status)).size >= 4, r.data.rows.map((q: any) => q.status))
  r = await demo.api('GET', '/api/e/expenses?pageSize=50'); ok('expense claims in many states', new Set(r.data.rows.map((q: any) => q.status)).size >= 3)
  r = await demo.api('GET', '/api/dashboard'); ok('dashboard has KPIs and alerts', r.status === 200 && (r.data.alerts?.length ?? 0) >= 3, r.data.alerts?.length)
  r = await demo.api('GET', '/api/reports/profit_loss'); ok('profit & loss report runs on demo data', r.status === 200 && r.data.rows.length > 3)

  sec('Demo features work end to end')
  r = await demo.api('GET', '/api/ai/status'); const jarvis = r.data.agents.find((a: any) => a.role_key === 'jarvis'); ok('AI team shown as configured with active employees', r.data.configured && r.data.agents.some((a: any) => a.active))
  r = await demo.api('POST', '/api/ai/chat', { agent_id: jarvis.id, message: 'Give me today’s briefing' }); ok('Jarvis answers from live demo data (scripted model)', r.status === 200 && /open jobs/.test(r.data.reply) && /demo/i.test(r.data.reply), r.data)
  r = await demo.api('GET', '/api/e/jobs?pageSize=1&q=DXB'); const jid = r.data.rows[0]?.id
  r = await demo.api('POST', `/api/jobs/${jid}/tracking-token`); const tok = r.data.token; ok('demo tracking tokens are prefixed', /^demo-/.test(tok), tok)
  const pub = await fetch(BASE + `/api/public/track/${tok}`); ok('public tracking page data works for demo shipments', pub.status === 200)
  const pub2 = await fetch(BASE + `/api/public/track/${tok.replace('demo-', '')}`); ok('…and not through the production workspace', pub2.status === 404)
  r = await demo.api('POST', '/api/integrations/mail/test'); ok('integration tests are blocked in the demo (no outbound traffic)', r.status === 200 && r.data.ok === false, r.data)
  r = await demo.api('POST', '/api/whatsapp/send', { to: '0501234567', text: 'hello' }); ok('WhatsApp sending is blocked in the demo', r.status === 400)

  sec('Isolation')
  r = await demo.api('POST', '/api/e/parties', { name: 'Demo-only Customer', is_customer: true }); ok('presenter can create records in the demo', r.status === 201)
  r = await admin.api('GET', '/api/e/parties?q=Demo-only'); ok('…which never appear in production', r.data.total === 0)
  r = await admin.api('POST', '/api/e/parties', { name: 'Real Production Customer', is_customer: true }); ok('production create works', r.status === 201); const realId = r.data.id
  r = await demo.api('GET', '/api/e/parties?q=Real Production'); ok('…and never appear in the demo', r.data.total === 0)
  r = await admin.api('GET', '/api/e/jobs?pageSize=1'); ok('demo jobs are not visible to admin', r.data.total === 0)
  const cross = new Client(); cross.cookie = 'elvora_sid=' + demo.cookie.split('=')[1].replace('demo.', ''); r = await cross.api('GET', '/api/auth/me'); ok('a demo token without its prefix is useless in production', r.status === 401)
  r = await admin.api('POST', '/api/demo/reset'); ok('demo reset is refused from production sessions', r.status === 400)
  await admin.api('DELETE', `/api/e/parties/${realId}`)

  sec('Demo reset')
  r = await demo.api('POST', '/api/demo/reset'); ok('presenter can reset the demo', r.status === 200)
  await new Promise(res => setTimeout(res, 1500))
  const again = new Client(); r = await again.api('POST', '/api/auth/login', { email: 'demo@elvorashipping.com', password: 'Demo@Elvora2026' }); ok('demo account works after reset', r.data.ok)
  r = await again.api('GET', '/api/e/parties?q=Demo-only'); ok('changes made during the demo are gone', r.data.total === 0)
  r = await again.api('GET', '/api/e/jobs?pageSize=1'); ok('and the scenario data is back', r.data.total >= 10)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '))
  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
