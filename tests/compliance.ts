import { signInReady } from './login-ready'
/* UAE compliance suite. Usage: server running on an empty data directory, then: npx tsx tests/compliance.ts */
export {}
const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
let cookie = '', pass = 0, fail = 0
const failures: string[] = []
async function api(method: string, path: string, body?: any): Promise<any> {
  const res = path === '/api/auth/login' ? await signInReady(BASE, body) : await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-elvora-client': 'web', ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); if (sc && path.includes('/auth/login')) cookie = sc.split(';')[0]
  const text = await res.text(); let data: any; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
function ok(name: string, cond: any, extra?: any) { if (cond) { pass++; console.log('  ✓', name) } else { fail++; failures.push(name); console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : '') } }
const sec = (t: string) => console.log('\n' + t)
const today = new Date().toLocaleDateString('sv-SE')

async function main() {
  let r = await api('POST', '/api/auth/login', { email: 'admin@elvorashipping.com', password: 'Elvora@Admin2026' }); ok('admin signs in', r.data.ok)

  sec('Company licence data seeded from the DET licence')
  r = await api('GET', '/api/admin/settings')
  ok('trade licence no. 1645802', r.data.company_trade_license === '1645802', r.data.company_trade_license)
  ok('Arabic name and licensed name recorded', r.data.company_name_ar === 'إلفورا للشحن ش.ذ.م.م' && r.data.licence_name_en === 'ELVORA SHIPPING L.L.C', [r.data.company_name_ar, r.data.licence_name_en])
  ok('DCCI and commercial register numbers', r.data.dcci_no === '697774' && r.data.commercial_register_no === '2911510')
  r = await api('GET', '/api/e/licence_activities?pageSize=50'); const acts = r.data.rows
  ok('four licensed activities', acts.length === 4 && ['CUSTOMS', 'SEA_AGENCY', 'CARGO_HANDLING', 'SEA_FREIGHT'].every((c: string) => acts.some((a: any) => a.covers === c)), acts.map((a: any) => a.covers))
  r = await api('GET', '/api/e/compliance_items?pageSize=50'); const lic = r.data.rows.find((i: any) => i.type === 'Trade licence')
  ok('trade licence item with expiry 2027-08-16', lic?.reference_no === '1645802' && lic.expiry_date === '2027-08-16' && lic.status === 'Active', lic)
  ok('register lists chamber, commercial register and the registrations still to verify', ['Chamber of Commerce membership', 'Commercial register', 'VAT registration (FTA)', 'Corporate tax registration (FTA)', 'Customs broker registration (Dubai Customs)', 'Maritime / shipping agent approval (DMA)'].every(t => r.data.rows.some((i: any) => i.type === t)))

  sec('Settings validation')
  r = await api('PUT', '/api/admin/settings', { company_trn: '12345' }); ok('short TRN rejected', r.status === 400, r.data)
  r = await api('PUT', '/api/admin/settings', { activity_scope_mode: 'maybe' }); ok('invalid scope mode rejected', r.status === 400)
  r = await api('PUT', '/api/admin/settings', { financial_year_end: '13-45' }); ok('invalid year end rejected', r.status === 400)

  sec('Master data for the scenarios')
  const por = (await api('GET', '/api/e/locations?q=AEDXB')).data.rows[0], jnb = (await api('GET', '/api/e/locations?q=ZAJNB')).data.rows[0], jea = (await api('GET', '/api/e/locations?q=AEJEA')).data.rows[0]
  const branch = (await api('GET', '/api/e/branches')).data.rows[0]
  const vat = (await api('GET', '/api/e/vat_codes?pageSize=20')).data.rows; const SR = vat.find((v: any) => v.code === 'SR'), ZR = vat.find((v: any) => v.code === 'ZR')
  r = await api('POST', '/api/e/parties', { name: 'Compliance Test Customer LLC', is_customer: true, status: 'Active', address1: 'Office 1, Dubai', city: 'Dubai' }); const cust = r.data.id; ok('customer created', r.status === 201, r.data)
  const job = (dept: string, extra: any = {}) => api('POST', '/api/e/jobs', { client_id: cust, branch_id: branch.id, department: dept, trade: 'Export', job_date: today, pol_id: por.id, pod_id: jnb.id, ...extra })
  const exceptions = async (rule: string, status = 'Open') => (await api('GET', '/api/e/compliance_exceptions?pageSize=200')).data.rows.filter((x: any) => x.rule === rule && x.status === status)

  sec('Licensed-activity guard')
  r = await job('FCL EXPORT'); ok('sea freight job is within the licence', r.status === 201 && !(await exceptions('SCOPE')).length, r.data)
  r = await job('AIR EXPORT'); const airJob = r.data
  ok('air freight job is created in warn mode', r.status === 201, r.data)
  let sc = await exceptions('SCOPE'); ok('…and logged as a SCOPE exception', sc.length === 1 && sc[0].link_entity === 'jobs' && /Air freight/.test(sc[0].message), sc)
  r = await api('POST', '/api/e/quotations', { customer_id: cust, mode: 'Warehousing', quote_date: today }); ok('warehousing quotation logs an exception', r.status === 201 && (await exceptions('SCOPE')).length === 2, r.data)
  r = await api('PUT', '/api/admin/settings', { activity_scope_mode: 'block' }); ok('block mode enabled', r.data.activity_scope_mode === 'block')
  r = await job('ROAD EXPORT'); ok('road transport job is blocked', r.status === 400 && /outside the licensed activities/.test(r.data.error), r.data)
  r = await job('CUSTOMS CLEARANCE'); ok('customs clearance job is allowed', r.status === 201, r.data)
  r = await api('POST', '/api/e/licence_activities', { activity_en: 'Air cargo services', activity_ar: 'خدمات الشحن الجوي', covers: 'AIR_FREIGHT', status: 'Active' }); const airAct = r.data.id; ok('air activity added after licence amendment', r.status === 201)
  r = await job('AIR IMPORT', { trade: 'Import' }); ok('air job now allowed in block mode', r.status === 201, r.data)
  await api('PUT', '/api/admin/settings', { activity_scope_mode: 'warn' })
  r = await api('PUT', `/api/e/jobs/${airJob.id}`, { version: airJob.version, department: 'FCL EXPORT' }); ok('job moved to a licensed service', r.status === 200, r.data)
  ok('…its SCOPE exception resolves itself', !(await exceptions('SCOPE')).some((x: any) => x.link_id === airJob.id), await exceptions('SCOPE'))
  await api('DELETE', `/api/e/licence_activities/${airAct}`)

  sec('Sanctions screening')
  r = await api('POST', '/api/e/parties', { name: 'Unscreened Trading FZE', is_customer: true, status: 'Active' }); const unscreened = r.data.id
  r = await api('POST', '/api/e/jobs', { client_id: unscreened, branch_id: branch.id, department: 'FCL EXPORT', trade: 'Export', job_date: today, pol_id: jea.id, pod_id: jnb.id }); ok('job for unscreened party is allowed with one warning on the party', r.status === 201 && (await exceptions('SANCTIONS')).filter((x: any) => x.link_entity === 'parties' && x.link_id === unscreened).length === 1, await exceptions('SANCTIONS'))
  r = await api('POST', `/api/compliance/parties/${unscreened}/screen`, { result: 'Potential match' }); ok('potential match recorded', r.status === 200, r.data)
  r = await job('FCL EXPORT', { client_id: unscreened }); ok('potential match still warns (a second job adds no duplicate finding)', r.status === 201 && (await exceptions('SANCTIONS')).filter((x: any) => x.link_id === unscreened).length === 1)
  r = await api('POST', `/api/compliance/parties/${unscreened}/screen`, { result: 'Confirmed match', note: 'List hit' }); ok('confirmed match recorded', r.status === 200)
  r = await api('GET', `/api/e/parties/${unscreened}`); ok('party is blocked and dated', r.data.status === 'Blocked' && r.data.sanctions_screened_on === today, [r.data.status, r.data.sanctions_screened_on])
  r = await api('POST', '/api/e/quotations', { customer_id: unscreened, mode: 'Ocean FCL', quote_date: today }); ok('quotation for a confirmed match is refused', r.status === 400, r.data)

  sec('UAE tax-invoice rules')
  const mk = (extra: any = {}, lines: any[] = [{ description: 'Documentation fee', qty: 1, rate: 100, vat_code_id: SR.id }]) => api('POST', '/api/e/invoices', { party_id: cust, branch_id: branch.id, invoice_date: today, doc_type: 'Tax Invoice', currency: 'AED', children: { lines }, ...extra })
  const post = (id: number) => api('POST', `/api/finance/invoices/${id}/post`)
  r = await api('PUT', '/api/admin/settings', { company_trn: '' }); let inv = await mk(); r = await post(inv.data.id)
  ok('posting without a supplier TRN is refused', r.status === 400 && /15-digit TRN/.test(r.data.error), r.data)
  await api('PUT', '/api/admin/settings', { company_trn: '100123456700003' })
  r = await post(inv.data.id); ok('posts once the TRN is entered', r.status === 200 && r.data.status === 'Posted', r.data)
  await api('PUT', '/api/admin/settings', { vat_registered: false })
  inv = await mk(); r = await post(inv.data.id); ok('VAT cannot be charged while not registered', r.status === 400 && /not VAT-registered/.test(r.data.error), r.data)
  inv = await mk({}, [{ description: 'Out-of-scope disbursement', qty: 1, rate: 50, vat_code_id: vat.find((v: any) => v.code === 'OS').id }]); r = await post(inv.data.id); ok('invoice without VAT posts when not registered', r.status === 200, r.data)
  await api('PUT', '/api/admin/settings', { vat_registered: true })
  inv = await mk({ doc_type: 'Credit Note' }); r = await post(inv.data.id); ok('credit note without a reason is refused', r.status === 400 && /reason/.test(r.data.error), r.data)
  inv = await mk({ doc_type: 'Credit Note', credit_reason: 'Rate correction' }); r = await post(inv.data.id); ok('credit note with a reason posts (reference warning raised)', r.status === 200 && (await exceptions('CREDIT_REF')).length === 1, r.data)
  inv = await mk({ supply_date: new Date(Date.now() - 20 * 86400000).toLocaleDateString('sv-SE') }); r = await post(inv.data.id); ok('late issue (>14 days after supply) warns but posts', r.status === 200 && (await exceptions('LATE_ISSUE')).length === 1, r.data)
  inv = await mk({}, [{ description: 'Ocean freight', qty: 1, rate: 12000, vat_code_id: ZR.id }]); r = await post(inv.data.id)
  const zr1 = (await exceptions('ZERO_RATE_EVIDENCE')).filter((x: any) => x.link_id === inv.data.id), ct1 = (await exceptions('CUSTOMER_TRN')).filter((x: any) => x.link_id === inv.data.id)
  ok('zero-rated line without a linked job warns; large invoice to customer without TRN warns', r.status === 200 && zr1.length === 1 && ct1.length === 1, { status: r.status, err: r.data.error, zr1: zr1.length, ct1: ct1.length })
  ok('exceptions carry the final invoice number', zr1[0]?.link_label?.startsWith('INV'), zr1[0]?.link_label)
  const dom = (await job('FCL EXPORT', { pol_id: por.id, pod_id: jea.id, trade: 'Domestic' })).data
  inv = await mk({ job_id: dom.id }, [{ description: 'Local move', qty: 1, rate: 500, vat_code_id: ZR.id }]); r = await post(inv.data.id)
  ok('zero-rating a domestic job is flagged', r.status === 200 && (await exceptions('ZERO_RATE_EVIDENCE')).some((x: any) => x.link_id === inv.data.id && /domestic/.test(x.message)), await exceptions('ZERO_RATE_EVIDENCE'))
  await api('PUT', '/api/admin/settings', { compliance_mode: 'advisory' })
  inv = await mk({ doc_type: 'Credit Note' }); r = await post(inv.data.id); ok('advisory mode downgrades blockers to warnings', r.status === 200, r.data)
  await api('PUT', '/api/admin/settings', { compliance_mode: 'enforce' })
  r = await api('POST', '/api/e/parties', { name: 'No TRN Supplier', is_vendor: true, status: 'Active' }); const sup = r.data.id
  r = await api('POST', '/api/e/bills', { vendor_id: sup, vendor_invoice_no: 'S-1', bill_date: today, branch_id: branch.id, children: { lines: [{ description: 'Local charges', qty: 1, rate: 200, vat_code_id: SR.id }] } }); const bill = r.data.id
  r = await api('POST', `/api/finance/bills/${bill}/post`); ok('bill with VAT from a supplier without TRN posts with an input-VAT warning', r.status === 200 && (await exceptions('INPUT_VAT_TRN')).length === 1, r.data)

  sec('Licence validity')
  await api('PUT', `/api/e/compliance_items/${lic.id}`, { version: lic.version, expiry_date: '2026-01-01' })
  r = await job('FCL EXPORT'); ok('new jobs are refused on an expired trade licence', r.status === 400 && /expired/.test(r.data.error), r.data)
  r = await api('GET', '/api/compliance/overview'); ok('overview flags the expired licence', r.data.checks.find((c: any) => c.key === 'licence').status === 'fail')
  lic.version += 1
  r = await api('GET', `/api/e/compliance_items/${lic.id}`); await api('PUT', `/api/e/compliance_items/${lic.id}`, { version: r.data.version, expiry_date: '2027-08-16' })
  r = await job('FCL EXPORT'); ok('…and allowed again after renewal', r.status === 201, r.data)

  sec('Compliance centre & calendar')
  r = await api('GET', '/api/compliance/overview'); const ov = r.data
  ok('overview returns score, checks, scope table', typeof ov.score === 'number' && ov.checks.length >= 10 && ov.scope.length === 9, ov.score)
  ok('scope table: sea and customs licensed; air, road, warehousing, courier not', ov.scope.find((s: any) => s.code === 'SEA_FREIGHT').covered && ov.scope.find((s: any) => s.code === 'CUSTOMS').covered && ['AIR_FREIGHT', 'ROAD_TRANSPORT', 'WAREHOUSING', 'COURIER'].every(c => !ov.scope.find((s: any) => s.code === c).covered))
  ok('VAT check ok with the TRN entered', ov.checks.find((c: any) => c.key === 'vat').status === 'ok')
  r = await api('POST', '/api/compliance/generate-calendar'); ok('calendar generated', r.status === 200 && r.data.created >= 8, r.data)
  r = await api('POST', '/api/compliance/generate-calendar'); ok('generation is idempotent', r.data.created === 0, r.data)
  r = await api('GET', '/api/e/compliance_filings?pageSize=200'); const f = r.data.rows
  ok('corporate-tax registration due 3 months after licence issue (2026-11-17)', f.some((x: any) => x.type === 'Corporate tax registration' && x.due_date === '2026-11-17'), f.filter((x: any) => /Corporate/.test(x.type)))
  ok('e-invoicing ASP appointment 2027-03-31 and go-live 2027-07-01', f.some((x: any) => x.type === 'E-invoicing ASP appointment' && x.due_date === '2027-03-31') && f.some((x: any) => x.type === 'E-invoicing go-live' && x.due_date === '2027-07-01'))
  ok('VAT returns fall 28 days after quarter end', f.filter((x: any) => x.type === 'VAT return').every((x: any) => /-(01-28|04-28|07-28|10-28)$/.test(x.due_date)), f.filter((x: any) => x.type === 'VAT return').map((x: any) => x.due_date))
  ok('first corporate-tax return due 9 months after the first year end', f.some((x: any) => x.type === 'Corporate tax return' && x.due_date === '2027-09-30'), f.filter((x: any) => x.type === 'Corporate tax return'))
  ok('licence renewal deadlines generated from the register', f.some((x: any) => x.type === 'Licence renewal' && x.due_date === '2027-08-16'))

  sec('Exceptions workflow')
  const open = (await exceptions('SCOPE'))[0] ?? (await exceptions('SANCTIONS'))[0]
  r = await api('POST', `/api/compliance/exceptions/${open.id}/acknowledge`, { note: '' }); ok('acknowledge needs a note', r.status === 400)
  r = await api('POST', `/api/compliance/exceptions/${open.id}/acknowledge`, { note: 'Reviewed with DET – subcontracted to a licensed carrier' }); ok('acknowledge with a note', r.status === 200)
  r = await api('GET', `/api/e/compliance_exceptions/${open.id}`); ok('status and reviewer stored', r.data.status === 'Acknowledged' && !!r.data.acknowledged_by, r.data)
  r = await api('POST', '/api/e/compliance_exceptions', { rule: 'x' }); ok('exceptions cannot be created through the API', r.status === 403 || r.status === 404 || r.status === 405, r.status)

  sec('Reports')
  r = await api('GET', '/api/reports/end_of_service?as_at=2026-10-07'); ok('gratuity report runs', r.status === 200 && Array.isArray(r.data.rows), r.data)
  r = await api('GET', '/api/reports/related_party'); ok('related-party report runs', r.status === 200 && Array.isArray(r.data.rows), r.data)
  r = await api('GET', '/api/reports/document_expiries?days=400'); ok('expiring documents include company licences', r.data.rows.some((x: any) => x.type === 'Company licence' && /licence/i.test(x.record)), r.data.rows)
  r = await api('POST', '/api/e/employees', { name: 'Gratuity Test', join_date: '2018-10-07', basic_salary: 6000, housing_allowance: 2000, status: 'Active' }); ok('employee created', r.status === 201, r.data)
  r = await api('GET', '/api/reports/end_of_service?as_at=2026-10-07'); const g = r.data.rows.find((x: any) => x.name === 'Gratuity Test')
  // 8 years: (21 × 5 + 30 × 3) = 195 days × (6000 / 30) = 39,000; cap = 24 × 8,000 = 192,000
  ok('gratuity: 5 yrs × 21 days + 3 yrs × 30 days of basic = AED 39,000', g && Math.abs(g.gratuity - 39000) < 60, g)

  sec('Permissions')
  r = await api('POST', '/api/e/users', { name: 'Sales Rep', email: 'rep@elvorashipping.com', password: 'Sales-Pass-2026!', role_id: (await api('GET', '/api/admin/roles')).data.find((x: any) => x.name === 'Sales').id, active: true, must_change_password: false }); ok('sales user created', r.status === 201, r.data)
  cookie = ''; r = await api('POST', '/api/auth/login', { email: 'rep@elvorashipping.com', password: 'Sales-Pass-2026!' }); ok('sales user signs in', r.data.ok, r.data)
  r = await api('GET', '/api/compliance/overview'); ok('compliance centre is hidden from roles without the module', r.status === 403, r.status)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) { console.log('Failed:\n - ' + failures.join('\n - ')); process.exit(1) }
}
main().catch(e => { console.error(e); process.exit(1) })
