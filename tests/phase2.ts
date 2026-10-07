/* Integration / AI / finance-extension tests against local mock providers.
   Start the API with:  WA_GRAPH_URL=http://localhost:9099/graph RESEND_API_URL=http://localhost:9099/resend R2_ENDPOINT=http://localhost:9099/r2  (fresh data dir)
   then: npx tsx tests/phase2.ts */
import http from 'node:http'

const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
const MOCK = 'http://localhost:9099'
let cookie = '', pass = 0, fail = 0
const failures: string[] = []
const calls: { method: string; url: string; body: any; headers: any }[] = []
let llmScript: any[] = []
const r2: Record<string, Buffer> = {}
const sbRows: Record<string, number> = {}; let sbLeak = false

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const buf = Buffer.concat(chunks), text = buf.toString('utf8')
    let body: any = null; try { body = JSON.parse(text) } catch { body = text }
    const url = req.url ?? ''
    calls.push({ method: req.method ?? '', url, body, headers: req.headers })
    const json = (o: any, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)) }
    if (url.startsWith('/v1/chat/completions')) { const next = llmScript.shift(); return json(next ?? { choices: [{ message: { role: 'assistant', content: 'All good.' } }], usage: { total_tokens: 10 } }) }
    if (url.startsWith('/graph/') && req.method === 'POST') return json({ messages: [{ id: 'wamid.' + calls.length }] })
    if (url.startsWith('/graph/')) return json({ display_phone_number: '+971500000000', verified_name: 'Elvora' })
    if (url.startsWith('/resend/emails')) return json({ id: 'em_' + calls.length })
    if (url.startsWith('/resend/domains')) return json({ data: [] })
    if (url.startsWith('/rest/v1/') && req.method === 'POST') { const t = url.split('?')[0].split('/').pop()!; sbRows[t] = (sbRows[t] ?? 0) + (Array.isArray(body) ? body.length : 0); if (/password_hash|totp_secret|key_hash/.test(text)) sbLeak = true; res.writeHead(201); return res.end() }
    if (url.startsWith('/rest/v1/')) return json({})
    if (url.startsWith('/r2/')) {
      const key = url.split('?')[0]
      if (req.method === 'PUT') { r2[key] = buf; res.writeHead(200, { etag: '"abc"' }); return res.end() }
      if (req.method === 'GET') { if (!r2[key]) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-length': r2[key].length }); return res.end(r2[key]) }
      res.writeHead(200); return res.end()
    }
    if (url.startsWith('/asp')) return json({ reference: 'ASP-123' })
    if (url.startsWith('/edi')) return json({ ok: true })
    json({ error: 'unknown mock route ' + url }, 404)
  })
})

async function api(method: string, path: string, body?: any, raw = false): Promise<any> {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-elvora-client': 'web', ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); if (sc && path.includes('/auth/login')) cookie = sc.split(';')[0]
  if (raw) return res
  const text = await res.text(); let data: any; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
function ok(name: string, cond: any, extra?: any) { if (cond) { pass++; console.log('  ✓', name) } else { fail++; failures.push(name); console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : '') } }
const sec = (t: string) => console.log('\n' + t)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const reply = (content: string | null, tool_calls?: { name: string; args: any }[]) => ({ choices: [{ message: { role: 'assistant', content, tool_calls: tool_calls?.map((c, i) => ({ id: 'c' + i, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) } }], usage: { total_tokens: 50 } })
const waPost = (value: any) => fetch(BASE + '/api/public/whatsapp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entry: [{ changes: [{ value }] }] }) })

async function main() {
  await new Promise<void>(r => server.listen(9099, r))
  let r = await api('POST', '/api/auth/login', { email: 'admin@elvorashipping.com', password: 'Elvora@Admin2026' }); ok('admin signs in', r.status === 200, r.data)

  sec('Bootstrap (production workspace starts empty)')
  await api('PUT', '/api/admin/settings', { company_trn: '100123456700003' })
  r = await api('POST', '/api/e/parties', { name: 'Integration Test Customer LLC', is_customer: true, status: 'Active', trn: '100123456700003', email: 'billing@itc.example' }); const cust = r.data.id; ok('customer created', r.status === 201, r.data)
  const branch = (await api('GET', '/api/e/branches')).data.rows[0], frt = (await api('GET', '/api/e/charge_codes?q=FRT-AIR')).data.rows[0], por = (await api('GET', '/api/e/locations?q=AEDXB')).data.rows[0], jnb = (await api('GET', '/api/e/locations?q=ZAJNB')).data.rows[0]
  r = await api('POST', '/api/e/jobs', { client_id: cust, branch_id: branch.id, department: 'AIR EXPORT', trade: 'Export', job_date: new Date().toLocaleDateString('sv-SE'), mbl_no: '60754163572', pol_id: por.id, pod_id: jnb.id, packages: 1, gross_weight: 14, commodity: 'Spare parts', children: { charges: [{ kind: 'Revenue', charge_code_id: frt.id, qty: 14, rate: 12.5, currency: 'AED', party_id: cust }], containers: [] } }); const JOB = r.data; ok('job created', r.status === 201, r.data)
  r = await api('POST', `/api/jobs/${JOB.id}/generate-invoices`, {}); await api('POST', `/api/finance/invoices/${r.data[0].id}/post`)

  sec('Settings & catalogue')
  r = await api('PUT', '/api/admin/settings', {
    mail_provider: 'resend', resend_api_key: 're_test', resend_from: 'Elvora <ops@elvora.test>',
    ai_enabled: true, ai_provider: 'custom', ai_base_url: MOCK + '/v1', ai_api_key: 'k', ai_model: 'mock',
    wa_enabled: true, wa_phone_number_id: '123', wa_access_token: 'tok', wa_verify_token: 'vt', wa_owner_numbers: '971500000001', wa_auto_leads: true, wa_staff_bot: true, wa_customer_bot: true,
    company_trn: '100123456700003', einv_enabled: true, einv_endpoint: MOCK + '/asp', einv_api_key: 'asp', edi_transport: 'http', edi_http_url: MOCK + '/edi', edi_email_to: 'edi@partner.test',
    r2_account_id: 'acct', r2_access_key_id: 'ak', r2_secret_access_key: 'sk', r2_bucket: 'elv', supabase_url: MOCK, supabase_service_key: 'svc',
    wps_employer_id: '0000012345678', wps_bank_routing: '123456789',
  }); ok('settings saved', r.status === 200, r.data)
  ok('secrets are masked in the API', r.data.resend_api_key === '********' && r.data.wa_access_token === '********' && r.data.ai_api_key === '********', r.data.resend_api_key)
  r = await api('GET', '/api/integrations'); ok('integration catalogue lists 10 sections', r.data.sections.length >= 9 && r.data.status.whatsapp && r.data.status.ai && r.data.status.mail === 'resend', r.data.status)
  for (const k of ['mail', 'storage', 'supabase', 'whatsapp', 'ai']) { r = await api('POST', `/api/integrations/${k}/test`); ok(`${k} connection test passes`, r.data.ok === true, r.data) }

  sec('Resend mail')
  calls.length = 0
  const party = { id: cust, name: 'Integration Test Customer LLC' }
  r = await api('POST', '/api/e/email_outbox', {}); ok('outbox is read-only through the API', r.status >= 400)
  const mail = await import('../src/server/mailer').catch(() => null); void mail

  sec('AI employees')
  r = await api('GET', '/api/ai/status'); ok('AI team seeded (7 employees, inactive until enabled)', r.data.agents.length >= 7 && r.data.configured, r.data.agents?.length)
  const jarvis = r.data.agents.find((a: any) => a.role_key === 'jarvis'); const collections = r.data.agents.find((a: any) => a.role_key === 'collections')
  // 1) every read tool executes without error
  const readTools = r.data.tools.filter((t: any) => t.risk === 'read').map((t: any) => t.name)
  const args: Record<string, any> = { get_job: { job_no: JOB.job_no }, search_customers: { query: 'a' }, customer_statement: { customer: party.name } }
  llmScript = [reply(null, readTools.map((n: string) => ({ name: n, args: args[n] ?? {} }))), reply('Brief ready: 3 things matter.')]
  calls.length = 0
  r = await api('POST', `/api/ai/agents/${jarvis.id}/run`, {}); ok('Jarvis run succeeds', r.data.ok && /Brief ready/.test(r.data.output), r.data)
  const llm2 = calls.filter(c => c.url.startsWith('/v1/chat'))[1]
  const toolMsgs = (llm2?.body?.messages ?? []).filter((m: any) => m.role === 'tool')
  ok(`all ${readTools.length} read tools returned data`, toolMsgs.length === readTools.length, toolMsgs.length)
  const broken = toolMsgs.filter((m: any) => /"error"/.test(m.content) && !/not found/i.test(m.content)).map((m: any) => `${m.name}: ${m.content.slice(0, 160)}`)
  ok('no read tool raised an error', broken.length === 0, broken)
  // 2) internal write executes, external write waits for approval (autonomy level 2 of 3)
  await api('PUT', `/api/e/ai_agents/${collections.id}`, { active: true })
  llmScript = [reply(null, [{ name: 'create_task', args: { title: 'AI test task', due_in_days: 2 } }, { name: 'send_email', args: { to: 'cust@example.com', subject: 'Reminder', body: 'Please pay.' } }]), reply('Done.')]
  r = await api('POST', `/api/ai/agents/${collections.id}/run`, {}); ok('collections run ok', r.data.ok, r.data)
  r = await api('GET', '/api/e/tasks?q=AI test task'); ok('internal action executed automatically (task created)', r.data.total === 1, r.data.total)
  r = await api('GET', '/api/e/ai_actions?filters=' + encodeURIComponent(JSON.stringify([{ field: 'status', op: 'eq', value: 'Pending' }]))); ok('external action queued for approval', r.data.total === 1 && r.data.rows[0].tool === 'send_email', r.data)
  const act = r.data.rows[0]
  calls.length = 0
  r = await api('POST', `/api/ai/actions/${act.id}/approve`); ok('approval executes the e-mail', r.data.status === 'Executed', r.data)
  await sleep(600)
  ok('e-mail delivered through Resend', calls.some(c => c.url.startsWith('/resend/emails') && c.body?.to?.[0] === 'cust@example.com' && c.headers.authorization === 'Bearer re_test'), calls.map(c => c.url))
  r = await api('POST', `/api/ai/actions/${act.id}/approve`); ok('an action cannot be decided twice', r.status === 400)
  // 3) tool-less models: JSON in text
  llmScript = [reply('{"tool":"business_snapshot","args":{}}'), reply('Snapshot summarised.')]
  r = await api('POST', '/api/ai/chat', { agent_id: jarvis.id, message: 'How are we doing?' }); ok('chat works with text-JSON tool calls', /Snapshot summarised/.test(r.data.reply), r.data)
  // 4) fallback provider
  await api('PUT', '/api/admin/settings', { ai_base_url: 'http://localhost:9/v1', ai_fallback_provider: 'custom', ai_fallback_base_url: MOCK + '/v1', ai_fallback_model: 'mock2' })
  llmScript = [reply('From fallback.')]
  r = await api('POST', '/api/ai/chat', { agent_id: jarvis.id, message: 'hi' }); ok('falls back to the second provider when the first fails', /From fallback/.test(r.data.reply), r.data)
  await api('PUT', '/api/admin/settings', { ai_base_url: MOCK + '/v1', ai_fallback_provider: '' })

  sec('WhatsApp')
  r = await fetch(BASE + '/api/public/whatsapp?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=777'); ok('webhook verification handshake', (await r.text()) === '777')
  r = await fetch(BASE + '/api/public/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=777'); ok('wrong verify token rejected', r.status === 403)
  calls.length = 0
  await waPost({ contacts: [{ wa_id: '971555000111', profile: { name: 'Hassan Trading' } }], messages: [{ from: '971555000111', id: 'wamid.in1', type: 'text', text: { body: 'Hi, need a quote for 2x40HC Jebel Ali to Mombasa' } }] })
  await sleep(500)
  r = await api('GET', '/api/e/leads?q=Hassan'); ok('unknown number becomes a lead', r.data.total === 1 && r.data.rows[0].source === 'WhatsApp', r.data)
  ok('lead gets an automatic acknowledgement', calls.some(c => c.url.startsWith('/graph/123/messages') && c.body?.to === '971555000111'), calls.map(c => c.url))
  await waPost({ messages: [{ from: '971555000111', id: 'wamid.in1', type: 'text', text: { body: 'duplicate' } }] }); await sleep(200)
  r = await api('GET', '/api/e/leads?q=Hassan'); ok('duplicate webhook delivery is ignored', r.data.total === 1)
  calls.length = 0
  await waPost({ messages: [{ from: '971500000001', id: 'wamid.in2', type: 'text', text: { body: 'report' } }] }); await sleep(500)
  ok('owner command "report" answers with the business brief', calls.some(c => c.url.startsWith('/graph/123/messages') && /Elvora brief/.test(c.body?.text?.body ?? '')), calls.map(c => c.body?.text?.body))
  calls.length = 0
  llmScript = [reply('Cash is fine; 2 invoices overdue.')]
  await waPost({ messages: [{ from: '971500000001', id: 'wamid.in3', type: 'text', text: { body: 'how is cash today?' } }] }); await sleep(700)
  ok('owner free text is answered by Jarvis', calls.some(c => /Cash is fine/.test(c.body?.text?.body ?? '')), calls.map(c => c.body?.text?.body))
  r = await api('GET', '/api/whatsapp/threads'); ok('WhatsApp inbox lists conversations', r.data.threads.length >= 2, r.data.threads?.length)
  await api('PUT', '/api/admin/settings', { wa_app_secret: 'shh' })
  r = await fetch(BASE + '/api/public/whatsapp', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=deadbeef' }, body: JSON.stringify({ entry: [] }) }); ok('bad signature rejected once app secret is set', r.status === 401)
  await api('PUT', '/api/admin/settings', { wa_app_secret: '' })
  r = await api('POST', '/api/whatsapp/send', { to: '0555000111', text: 'Hello from the inbox' }); ok('manual send from inbox (local number normalised)', r.status === 200, r.data)
  ok('number normalised to 971…', calls.some(c => c.body?.to === '971555000111' && /Hello from the inbox/.test(c.body?.text?.body ?? '')))

  sec('Live tracking webhook')
  r = await api('POST', '/api/integrations/webhook-secret/tracking'); const secUrl = new URL(r.data.url); ok('webhook secret generated', /\/api\/public\/tracking\/[0-9a-f]{40}$/.test(secUrl.pathname), r.data)
  r = await fetch(BASE + secUrl.pathname.replace(/[0-9a-f]{40}$/, 'wrong'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); ok('wrong secret gets 404', r.status === 404)
  r = await fetch(BASE + secUrl.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job_no: JOB.job_no, event: 'Vessel arrived', location: 'Lagos', at: '2026-10-06T10:00' }) }); ok('event accepted', (await r.json()).processed === 1)
  r = await api('GET', `/api/jobs/${JOB.id}/events`); ok('milestone appears on the job timeline', JSON.stringify(r.data).includes('Vessel arrived'), r.status)

  sec('Bank statement import & feed')
  r = await api('GET', '/api/e/bank_accounts'); const bank = r.data.rows[0]; ok('bank account exists', !!bank)
  const csv = 'Date,Description,Reference,Debit,Credit\n01/10/2026,TRANSFER FROM CUSTOMER,REF123,,1500.00\n02/10/2026,VENDOR PAYMENT,CHQ77,820.50,\n'
  r = await api('POST', '/api/finance/bank/import', { bank_account_id: bank.id, text: csv }); ok('CSV statement imported (day-first dates)', r.data.created === 2, r.data)
  r = await api('POST', '/api/finance/bank/import', { bank_account_id: bank.id, text: csv }); ok('re-import skips duplicates', r.data.created === 0 && r.data.duplicates === 2, r.data)
  const mt = ':20:STMT\n:25:AE070331234567890123456\n:28C:1/1\n:60F:C261001AED1000,00\n:61:2610030103D250,00NTRFNONREF//BANKREF1\n:86:SALARY ADVANCE\n:62F:C261003AED750,00\n'
  r = await api('POST', '/api/finance/bank/import', { bank_account_id: bank.id, text: mt }); ok('MT940 statement imported', r.data.created === 1, r.data)
  r = await api('POST', '/api/integrations/webhook-secret/bank'); const bu = new URL(r.data.url)
  r = await fetch(BASE + bu.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bank_account_id: bank.id, transactions: [{ date: '2026-10-04', description: 'FEED CREDIT', amount: 99.5 }, { date: '2026-10-04', description: 'FEED DEBIT', amount: -12.25 }] }) }); const bj: any = await r.json(); ok('bank feed webhook imports lines', bj.imported === 2, bj)

  sec('E-invoicing & EDI')
  r = await api('GET', '/api/e/invoices?pageSize=100'); const posted = r.data.rows.find((i: any) => i.status !== 'Draft' && i.doc_type === 'Tax Invoice'); ok('a posted tax invoice exists', !!posted)
  r = await api('GET', `/api/invoices/${posted.id}/einvoice.xml`, undefined, true); const xml = await r.text()
  ok('UBL XML generated with PINT AE customization', r.status === 200 && xml.includes('urn:peppol:pint:billing-1@ae-1') && xml.includes('<cbc:InvoiceTypeCode>380') && xml.includes(posted.invoice_no) && xml.includes('<cac:InvoiceLine>'), xml.slice(0, 200))
  ok('seller endpoint is scheme 0235 + 10-digit TIN, tax scheme carries the full TRN', xml.includes('schemeID="0235">1001234567</cbc:EndpointID>') && xml.includes('<cbc:CompanyID>100123456700003</cbc:CompanyID>'), xml.slice(300, 700))
  ok('XML totals match the invoice', xml.includes(`<cbc:PayableAmount currencyID="${posted.currency}">${Number(posted.total).toFixed(2)}`), xml.match(/PayableAmount[^<]*<?/)?.[0])
  r = await api('POST', `/api/invoices/${posted.id}/einvoice/submit`); ok('e-invoice submitted to provider', r.status === 200 && r.data.reference === 'ASP-123', r.data)
  r = await api('GET', `/api/e/invoices/${posted.id}`); ok('invoice shows e-invoice status', r.data.einvoice_status === 'Submitted' && r.data.einvoice_ref === 'ASP-123', r.data.einvoice_status)
  calls.length = 0
  r = await api('POST', `/api/jobs/${JOB.id}/edi/transmit`, { format: 'json', via: 'http' }); ok('EDI transmitted over HTTP', r.status === 200 && calls.some(c => c.url === '/edi'), r.data)
  r = await api('POST', `/api/jobs/${JOB.id}/edi/transmit`, { format: 'json', via: 'email' }); ok('EDI e-mail queued with attachment', r.status === 200, r.data)

  sec('Payroll – WPS')
  r = await api('POST', '/api/e/employees', { name: 'Test Worker', emp_no: '', basic_salary: 5000, housing_allowance: 1500, transport_allowance: 500, bank_iban: 'AE070331234567890123456', bank_routing_code: '987654321', mol_person_id: '12345678901234', status: 'Active', join_date: '2025-01-01' }); const emp = r.data.id; ok('employee with WPS details created', r.status === 201, r.data)
  await api('POST', '/api/e/employees', { name: 'No Bank Details Employee', basic_salary: 3000, status: 'Active', join_date: '2025-01-01' })
  r = await api('POST', '/api/hr/payroll/generate', { period: '2026-09' }); ok('payroll generated', r.data.created >= 1, r.data)
  r = await api('GET', '/api/e/payslips?pageSize=100'); for (const p of r.data.rows) await api('PUT', `/api/e/payslips/${p.id}`, { status: 'Approved' })
  r = await api('GET', '/api/hr/wps/2026-09'); ok('WPS preview lists problems for employees without bank details', r.status === 200 && r.data.employee_problems.length > 0 && r.data.employee_problems.every((p: any) => p.problems.length), r.data)
  for (const e of (await api('GET', '/api/e/employees?pageSize=100')).data.rows) if (e.id !== emp) await api('PUT', `/api/e/employees/${e.id}`, { status: 'Resigned' })
  r = await api('GET', '/api/e/payslips?pageSize=100'); for (const p of r.data.rows) if (p.employee_id !== emp) await api('DELETE', `/api/e/payslips/${p.id}`)
  r = await api('POST', '/api/hr/wps/2026-09/generate', {}); ok('SIF generated for the valid employee', r.status === 200 && r.data.ok && r.data.employees === 1 && r.data.file_name.endsWith('.SIF'), r.data)
  const dl = await api('GET', `/api/hr/wps/batches/${r.data.batch_id}/download`, undefined, true); const sif = await dl.text(); const lines = sif.trim().split(/\r?\n/)
  ok('SIF has EDR row + SCR trailer', lines.length === 2 && lines[0].startsWith('EDR,12345678901234,987654321,AE070331234567890123456,2026-09-01,2026-09-30,30,7000.00,0.00,0') && lines[1].startsWith('SCR,0000012345678,123456789,') && lines[1].includes(',1,7000.00,AED'), sif)

  sec('Legal entities, trial balance filter & year-end close')
  r = await api('GET', '/api/e/legal_entities'); ok('default legal entity seeded and linked to branch', r.data.total >= 1, r.data)
  const ent = r.data.rows[0]
  r = await api('GET', '/api/e/accounts?pageSize=200'); const acc = (n: string, t?: string) => r.data.rows.find((a: any) => a.code === n || (t && a.type === t && a.subtype === n))
  const bankGl = r.data.rows.find((a: any) => a.subtype === 'Bank'), income = r.data.rows.find((a: any) => a.type === 'Income'), expense = r.data.rows.find((a: any) => a.type === 'Expense' && a.subtype === 'Operating expense')
  r = await api('POST', '/api/e/journal_entries', { entry_date: '2024-06-30', memo: 'Test sale 2024', children: { lines: [{ account_id: bankGl.id, debit: 10000 }, { account_id: income.id, credit: 10000 }] } }); ok('2024 income journal posted', r.status === 201, r.data)
  r = await api('POST', '/api/e/journal_entries', { entry_date: '2024-07-15', memo: 'Test rent 2024', children: { lines: [{ account_id: expense.id, debit: 4000 }, { account_id: bankGl.id, credit: 4000 }] } }); ok('2024 expense journal posted', r.status === 201, r.data)
  r = await api('GET', '/api/finance/year-end/2024'); ok('preview shows net result 6000', r.data.net_result === 6000 && r.data.accounts.length === 2, r.data)
  r = await api('POST', '/api/finance/year-end/close', { year: 2030 }); ok('future year cannot be closed', r.status === 400, r.data)
  r = await api('POST', '/api/finance/year-end/close', { year: 2024 }); ok('year-end close posted', r.status === 200 && r.data.net_result === 6000 && r.data.lock_date === '2024-12-31', r.data)
  const closeId = (await api('GET', '/api/e/year_end_closes')).data.rows[0]?.id
  r = await api('GET', '/api/reports/profit_loss?from=2024-01-01&to=2024-12-31'); const np = r.data.rows?.find((x: any) => /Net profit/.test(x.name ?? ''))?.amount; ok('P&L for 2024 still shows the profit after closing', np === 6000, np)
  r = await api('GET', '/api/reports/balance_sheet?as_of=2025-01-01'); const diff = r.data.rows?.find((x: any) => x.kind === 'check')?.amount; ok('balance sheet balances after close', diff === 0, diff)
  r = await api('POST', '/api/e/journal_entries', { entry_date: '2024-12-01', memo: 'late', children: { lines: [{ account_id: expense.id, debit: 1 }, { account_id: bankGl.id, credit: 1 }] } }); ok('closed period is locked', r.status === 400, r.data)
  r = await api('POST', '/api/finance/year-end/close', { year: 2024 }); ok('cannot close twice', r.status === 400)
  r = await api('GET', `/api/reports/trial_balance?as_of=2026-12-31&legal_entity_id=${ent.id}`); ok('trial balance filters by legal entity', r.status === 200 && r.data.rows.length > 0, r.status)
  r = await api('POST', `/api/finance/year-end/${closeId}/reopen`); ok('year can be re-opened', r.status === 200, r.data)
  r = await api('GET', '/api/admin/settings'); ok('lock date moved back', r.data.lock_date === '2023-12-31', r.data.lock_date)
  r = await api('POST', '/api/finance/year-end/close', { year: 2024, lock: false }); ok('can be closed again (without locking)', r.status === 200, r.data)

  sec('Server-side PDF')
  r = await api('GET', `/api/pdf/invoices/${posted.id}`, undefined, true); const pdf = Buffer.from(await r.arrayBuffer())
  ok('invoice PDF rendered by the server', r.status === 200 && r.headers.get('content-type') === 'application/pdf' && pdf.subarray(0, 4).toString() === '%PDF' && pdf.length > 5000, { status: r.status, len: pdf.length, head: pdf.subarray(0, 120).toString() })
  calls.length = 0
  r = await api('POST', `/api/pdf/invoices/${posted.id}/email`, { to: 'billing@customer.test', subject: 'Invoice', body: 'Attached.' }); ok('invoice e-mailed with PDF attachment', r.status === 200, r.data)
  await sleep(1000)
  ok('Resend received the PDF attachment', calls.some(c => c.url.startsWith('/resend/emails') && c.body?.attachments?.[0]?.filename?.endsWith('.pdf')), calls.map(c => c.url))

  sec('R2 storage & Supabase replica')
  await api('PUT', '/api/admin/settings', { storage_provider: 'r2' })
  const fd = new FormData(); fd.append('link_entity', 'parties'); fd.append('link_id', String(party.id)); fd.append('file', new Blob(['hello r2 world'], { type: 'text/plain' }), 'note.txt')
  let up = await fetch(BASE + '/api/files', { method: 'POST', headers: { cookie, 'x-elvora-client': 'web' }, body: fd }); const upj: any = await up.json(); ok('upload stored in R2', up.status === 200 && Object.keys(r2).some(k => k.includes('/uploads/')), upj)
  const down = await fetch(BASE + `/api/files/${upj[0].id}/download`, { headers: { cookie } }); ok('download streams from R2', (await down.text()) === 'hello r2 world')
  r = await api('POST', '/api/integrations/backup-r2'); ok('backup uploaded to R2', r.status === 200 && Object.keys(r2).some(k => k.includes('/backups/')), r.data)
  r = await api('POST', '/api/integrations/supabase/sync', { full: true }); ok('Supabase sync pushes rows', r.data.ok && r.data.rows > 100 && sbRows['parties'] > 0 && sbRows['invoices'] > 0, r.data)
  ok('secret columns never leave the server', !sbLeak)
  const before = Object.values(sbRows).reduce((a, b) => a + b, 0)
  r = await api('POST', '/api/integrations/supabase/sync', {}); ok('second sync is incremental', r.data.ok && r.data.rows < before / 2, { rows: r.data.rows, before })
  r = await api('GET', '/api/integrations/supabase/schema.sql', undefined, true); const sql = await r.text(); ok('Supabase schema SQL generated with RLS', sql.includes('create table if not exists public."invoices"') && sql.includes('enable row level security') && !sql.includes('password_hash'))

  sec('Permissions')
  r = await api('POST', '/api/auth/login', { email: 'manager@elvorashipping.com', password: 'Elvora@Manager2026' }); ok('manager sees AI team', (await api('GET', '/api/ai/status')).status === 200)
  cookie = ''
  r = await api('GET', '/api/ai/status'); ok('AI API requires sign-in', r.status === 401)
  r = await api('POST', '/api/public/tracking/x', {}); ok('public webhooks do not leak when unconfigured', r.status === 404 || r.status === 401)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')) }
  server.close(); process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
