/* End-to-end API smoke test. Usage: BASE_URL=http://localhost:8080 npm test  (server must be running on an empty database) */
const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
let cookie = ''
let pass = 0, fail = 0
const failures: string[] = []

async function api(method: string, path: string, body?: any, opts: { raw?: boolean; noAuth?: boolean } = {}): Promise<any> {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-elvora-client': 'web', ...(cookie && !opts.noAuth ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); if (sc && path.includes('/auth/login')) cookie = sc.split(';')[0]
  if (opts.raw) return res
  const text = await res.text()
  let data: any; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
function ok(name: string, cond: any, extra?: any) { if (cond) { pass++; console.log('  ✓', name) } else { fail++; failures.push(name); console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : '') } }
const sec = (t: string) => console.log('\n' + t)
const id = (r: any) => r.data?.id

async function main() {
  sec('Auth')
  let r = await api('POST', '/api/auth/login', { email: 'admin@elvorashipping.com', password: 'wrong-password' }, { noAuth: true }); ok('wrong password rejected', r.status === 401)
  r = await api('GET', '/api/e/jobs', undefined, { noAuth: true }); ok('unauthenticated API call rejected', r.status === 401)
  r = await api('POST', '/api/auth/login', { email: 'manager@elvorashipping.com', password: 'Elvora@Manager2026' }); ok('manager can sign in', r.status === 200 && r.data.ok, r.data)
  const mgrCookie = cookie
  r = await api('POST', '/api/auth/login', { email: 'admin@elvorashipping.com', password: 'Elvora@Admin2026' }); ok('admin can sign in', r.status === 200 && r.data.ok, r.data)
  r = await api('GET', '/api/auth/me'); ok('me returns full permissions for admin', r.data.permissions === '*' && r.data.defaultPassword === true, r.data)
  r = await api('GET', '/api/meta'); ok('meta lists entities and navigation', r.data.entities.length > 70 && r.data.nav.length >= 8, Object.keys(r.data))
  const meta = r.data
  r = await api('PUT', '/api/admin/settings', { company_trn: '100123456700003' }); ok('company TRN saved (needed to post tax invoices)', r.status === 200 && r.data.company_trn === '100123456700003', r.data)

  sec('Master data seeded')
  r = await api('GET', '/api/e/countries?pageSize=1'); ok('countries seeded', r.data.total > 200, r.data.total)
  r = await api('GET', '/api/e/locations?q=jebel'); ok('Jebel Ali port available', r.data.rows.some((x: any) => x.code === 'AEJEA'), r.data.total)
  r = await api('GET', '/api/e/accounts?pageSize=200'); ok('chart of accounts seeded', r.data.total > 40)
  r = await api('GET', '/api/e/charge_codes?pageSize=1'); ok('charge codes seeded', r.data.total > 30)

  sec('CRM')
  r = await api('POST', '/api/e/parties', { name: 'Procet Freight', is_customer: true, trn: '100123456700003', status: 'Active', credit_limit: 50000, credit_days: 30 }); ok('create customer', r.status === 201 && /^P\d{5}$/.test(r.data.code), r.data)
  const cust = id(r)
  r = await api('POST', '/api/e/parties', { name: 'procet freight', is_customer: true }); ok('duplicate customer name blocked', r.status === 400, r.data)
  r = await api('POST', '/api/e/parties', { name: 'Gulf Haulage LLC', is_vendor: true, is_transporter: true }); const vendor = id(r); ok('create vendor', r.status === 201)
  r = await api('POST', '/api/e/parties', { name: 'Bad TRN Co', is_customer: true, trn: '123' }); ok('invalid TRN rejected', r.status === 400)
  r = await api('POST', '/api/e/leads', { company: 'Atlas Trading', contact_name: 'S. Khan', email: 'sk@atlas.example', status: 'New', source: 'Website' }); const lead = id(r); ok('create lead', r.status === 201 && r.data.lead_no)
  r = await api('POST', `/api/leads/${lead}/convert`); ok('convert lead to customer + opportunity', r.status === 200 && r.data.party?.id && r.data.opportunity?.id, r.data)

  sec('Master job (Fresa-style Job Info)')
  const por = (await api('GET', '/api/e/locations?q=AEDXB')).data.rows[0], jnb = (await api('GET', '/api/e/locations?q=ZAJNB')).data.rows[0]
  const etihad = (await api('GET', '/api/e/carriers?q=Etihad')).data.rows[0]
  const branch = (await api('GET', '/api/e/branches')).data.rows[0]
  const frt = (await api('GET', '/api/e/charge_codes?q=FRT-AIR')).data.rows[0], docf = (await api('GET', '/api/e/charge_codes?q=DOC')).data.rows.find((x: any) => x.code === 'DOC')
  r = await api('POST', '/api/e/jobs', {
    client_id: cust, branch_id: branch.id, department: 'AIR EXPORT', trade: 'Export', job_date: '2026-10-12', mbl_no: '60754163572', hbl_no: '60754163572', mbl_date: '2026-10-02', hbl_date: '2026-10-02',
    carrier_id: etihad.id, place_of_receipt: 'DUBAI', por_id: por.id, pol_id: por.id, pod_id: jnb.id, pof_id: jnb.id, inco_terms: 'EXW', freight_terms: 'Prepaid', payable_at: 'DUBAI, UNITED ARAB EMIRATES',
    dispatch_at: 'DUBAI, UNITED ARAB EMIRATES', no_originals: 3, no_copies: 1, etd: '2026-10-02T14:27', marks_no: '14 KG', gross_weight: 14, packages: 1, commodity: 'Spare parts',
    children: { charges: [
      { kind: 'Revenue', charge_code_id: frt.id, qty: 14, rate: 12.5, currency: 'AED', party_id: cust },
      { kind: 'Revenue', charge_code_id: docf.id, qty: 1, rate: 150, currency: 'AED', party_id: cust },
      { kind: 'Cost', charge_code_id: frt.id, qty: 14, rate: 9, currency: 'AED', party_id: vendor },
    ], containers: [] },
  })
  ok('create master job', r.status === 201, r.data)
  const job = r.data
  ok('job number format <BRANCH><MM><YY><SEQ4> (DXB10260001)', /^DXB1026\d{4}$/.test(job.job_no), job.job_no)
  ok('job totals computed (rev 175+150=325, cost 126, profit 199)', job.total_revenue === 325 && job.total_cost === 126 && job.profit === 199, [job.total_revenue, job.total_cost, job.profit])
  ok('job mode derived from department', job.mode === 'Air')
  r = await api('GET', `/api/e/jobs/${job.id}`); ok('job has 3 charges, default statuses, labels', r.data.children.charges.length === 3 && r.data.job_status === 'OPENED' && r.data._labels.pol_id.startsWith('AEDXB'), r.data._labels)
  ok('location label like AEDXB-DUBAI/UNITED ARAB EMIRATES', r.data._labels.pol_id === 'AEDXB-DUBAI/UNITED ARAB EMIRATES', r.data._labels.pol_id)
  r = await api('PUT', `/api/e/jobs/${job.id}`, { version: 99, remarks: 'x' }); ok('optimistic locking rejects stale version', r.status === 409)
  r = await api('POST', `/api/jobs/${job.id}/generate-do`); ok('Generate DO number', r.status === 200 && /^DO\d{9}$/.test(r.data.do_no), r.data)
  r = await api('GET', `/api/e/jobs/${job.id}`); ok('job DO No/DO Date updated', !!r.data.do_no && !!r.data.do_date)
  r = await api('PUT', `/api/e/jobs/${job.id}`, { job_status: 'CLOSED', version: r.data.version }); ok('cannot close job with unbilled revenue', r.status === 400, r.data)
  r = await api('POST', `/api/jobs/${job.id}/events`, { event_type: 'Cargo received', location: 'Dubai warehouse', description: 'Received 1 pkg' }); ok('add track & trace milestone', r.status === 200)
  r = await api('GET', `/api/jobs/${job.id}/events`); ok('events recorded (job opened + cargo received)', r.data.length >= 2, r.data.length)
  r = await api('GET', `/api/jobs/${job.id}/kpi`); ok('job KPI computed', r.data.items.length > 5)
  r = await api('GET', `/api/jobs/${job.id}/edi?format=fwb`, undefined, { raw: true }); const fwb = await (r as Response).text(); ok('FWB message generated for air job', fwb.startsWith('FWB/16') && fwb.includes('607-54163572DXBJNB'), fwb.slice(0, 120))
  r = await api('GET', `/api/jobs/${job.id}/edi-preview?format=iftmin`); ok('IFTMIN message generated', r.data.content.includes('UNH+1+IFTMIN'), r.data)
  r = await api('POST', `/api/jobs/${job.id}/tracking-token`); const token = r.data.token; ok('public tracking token', token?.length === 32)
  r = await api('GET', `/api/public/track/${token}`, undefined, { noAuth: true }); ok('public tracking works without login and hides finance', r.status === 200 && r.data.job_no === job.job_no && !('total_revenue' in r.data), r.data)
  r = await api('GET', `/api/public/track/${'0'.repeat(32)}`, undefined, { noAuth: true }); ok('unknown tracking token 404', r.status === 404)

  sec('Search (Job No / contains)')
  r = await api('GET', `/api/search/jobs?type=job_no&op=contains&value=${job.job_no.slice(-4)}`); ok('search by job no returns row with columns', r.data.rows.length === 1 && r.data.rows[0].mbl_no === '60754163572' && r.data.rows[0].sub_jobs === 0, r.data)
  r = await api('GET', `/api/search/jobs?type=mbl_no&op=equals&value=60754163572`); ok('search by MBL equals', r.data.rows.length === 1)
  r = await api('GET', `/api/search/jobs?type=client&op=contains&value=procet`); ok('search by client name', r.data.rows.length === 1)
  r = await api('GET', `/api/search/global?q=procet`); ok('global search finds customer and job', r.data.some((x: any) => x.entity === 'parties'), r.data)

  sec('Sub-jobs, containers')
  r = await api('POST', '/api/e/shipments', { job_id: job.id, status: 'Booked', commodity: 'Spare parts', packages: 1, gross_weight: 14 }); ok('create sub-job with auto number', r.status === 201 && r.data.shipment_no === `${job.job_no}/01`, r.data)
  r = await api('GET', `/api/search/jobs?type=job_no&op=contains&value=${job.job_no}`); ok('No Of S.Jobs counts sub-jobs', r.data.rows[0].sub_jobs === 1)

  sec('Invoicing → posting → ledger')
  r = await api('POST', `/api/jobs/${job.id}/generate-invoices`, {}); ok('generate invoice from unbilled revenue', r.status === 200 && r.data.length === 1, r.data)
  const inv = r.data[0]
  ok('invoice totals: 175 zero-rated freight + 150 doc fee → net 325, VAT 7.50, total 332.50', inv.subtotal === 325 && inv.vat_total === 7.5 && inv.total === 332.5, [inv.subtotal, inv.vat_total, inv.total])
  ok('draft invoice number is a draft placeholder', inv.invoice_no.startsWith('DRAFT-'))
  r = await api('POST', `/api/finance/invoices/${inv.id}/post`); ok('post invoice', r.status === 200 && /^INV26\d{5}$/.test(r.data.invoice_no) && r.data.status === 'Posted', r.data)
  ok('posted invoice has journal and balance', !!r.data.journal_id && r.data.balance === 332.5)
  r = await api('PUT', `/api/e/invoices/${inv.id}`, { party_id: vendor, version: r.data.version }); ok('posted invoice is locked', r.status === 400, r.data)
  r = await api('POST', `/api/finance/invoices/${inv.id}/post`); ok('cannot post twice', r.status === 400)
  r = await api('GET', `/api/e/jobs/${job.id}`); ok('job charges flagged Invoiced', r.data.children.charges.filter((c: any) => c.kind === 'Revenue').every((c: any) => c.status === 'Invoiced'))
  r = await api('POST', `/api/jobs/${job.id}/generate-invoices`, {}); ok('no double invoicing of charges', r.status === 400, r.data)
  const bank = (await api('GET', '/api/e/bank_accounts')).data.rows.find((b: any) => b.type === 'Bank')
  r = await api('POST', '/api/e/receipts', { party_id: cust, bank_account_id: bank.id, amount: 332.5, receipt_date: '2026-10-20', reference: 'TRF-1', children: { allocations: [{ invoice_id: inv.id, amount: 332.5 }] } }); ok('create receipt with allocation', r.status === 201, r.data)
  const rec = id(r)
  r = await api('POST', `/api/finance/receipts/${rec}/post`); ok('post receipt', r.status === 200 && r.data.status === 'Posted', r.data)
  r = await api('GET', `/api/e/invoices/${inv.id}`); ok('invoice settled → Paid, balance 0', r.data.status === 'Paid' && r.data.balance === 0 && r.data.paid_amount === 332.5, [r.data.status, r.data.balance])
  r = await api('POST', `/api/finance/invoices/${inv.id}/void`, { reason: 'test' }); ok('cannot void a paid invoice', r.status === 400)
  r = await api('POST', `/api/jobs/${job.id}/bill-from-costs`, { vendor_id: vendor, vendor_invoice_no: 'GH-7781' }); ok('create vendor bill from job costs', r.status === 200 && r.data.total === 126 && r.data.vat_total === 0, [r.data.total, r.data.vat_total])
  const bill = r.data.id
  r = await api('POST', `/api/finance/bills/${bill}/post`); ok('post vendor bill', r.status === 200 && r.data.status === 'Posted', r.data)
  r = await api('POST', '/api/e/bills', { vendor_id: vendor, vendor_invoice_no: 'gh-7781', bill_date: '2026-10-21', children: { lines: [{ description: 'dup', qty: 1, rate: 10 }] } }); ok('duplicate vendor invoice number blocked', r.status === 400, r.data)
  r = await api('GET', '/api/reports/trial_balance?as_of=2026-12-31'); ok('trial balance balances', r.status === 200 && r.data.totals.debit === r.data.totals.credit && r.data.totals.debit > 0, r.data.totals)
  r = await api('GET', '/api/reports/profit_loss?from=2026-01-01&to=2026-12-31'); const pl = r.data.rows.find((x: any) => x.name === 'Net profit / (loss)'); ok('P&L: revenue 325 − cost 126 = 199', pl?.amount === 199, pl)
  r = await api('GET', '/api/reports/balance_sheet?as_of=2026-12-31'); const chk = r.data.rows.find((x: any) => x.kind === 'check'); ok('balance sheet balances', chk?.amount === 0, chk)
  r = await api('GET', '/api/reports/vat_return?from=2026-10-01&to=2026-10-31'); ok('VAT return: output 7.50 (doc fee only), input 0', r.data.rows.find((x: any) => x.box === '8')?.vat === 7.5 && r.data.rows.find((x: any) => x.box === '11')?.vat === 0, r.data.rows)
  r = await api('GET', '/api/reports/ar_aging?as_of=2026-10-30'); ok('AR ageing empty after payment', r.data.totals.total === 0, r.data.totals)
  r = await api('POST', `/api/e/journal_entries`, { entry_date: '2026-10-22', memo: 'unbalanced', children: { lines: [{ account_id: 1, debit: 10 }, { account_id: 2, credit: 5 }] } }); ok('unbalanced manual journal rejected', r.status === 400, r.data)

  sec('Quotation → job')
  r = await api('POST', '/api/e/quotations', { customer_id: cust, mode: 'Ocean FCL', trade: 'Export', pol_id: por.id, pod_id: jnb.id, currency: 'AED', children: { lines: [{ charge_code_id: frt.id, qty: 1, rate: 1000, cost_rate: 960 }] } }); ok('create quotation', r.status === 201 && /^QT2610\d{4}$/.test(r.data.quote_no), r.data)
  const quote = r.data
  ok('quote margin below minimum triggers approval', quote.approval_status === 'Pending' && quote.margin_pct === 4, [quote.approval_status, quote.margin_pct])
  r = await api('POST', `/api/quotes/${quote.id}/convert`); ok('cannot convert unapproved/unsent quote', r.status === 400, r.data)
  r = await api('POST', `/api/approvals/quotations/${quote.id}/approve`); ok('admin approves quote margin', r.status === 200 && r.data.approval_status === 'Approved', r.data)
  r = await api('POST', `/api/quotes/${quote.id}/send`, { to: 'buyer@procet.example' }); ok('send quotation (outbox)', r.status === 200, r.data)
  r = await api('POST', `/api/quotes/${quote.id}/accept`); ok('accept quotation', r.status === 200 && r.data.status === 'Accepted', r.data)
  r = await api('POST', `/api/quotes/${quote.id}/convert`); ok('convert quotation to job with charges', r.status === 200 && r.data.total_revenue === 1000 && r.data.total_cost === 960 && r.data.department === 'FCL EXPORT', r.data)
  r = await api('GET', '/api/e/email_outbox'); ok('email queued in outbox', r.data.total >= 1)

  sec('Warehouse (GRN → FEFO dispatch)')
  const wh = (await api('POST', '/api/e/warehouses', { code: 'DXB-WH1', name: 'Dubai Warehouse 1', type: 'General' })).data
  const bin = (await api('POST', '/api/e/wh_locations', { warehouse_id: wh.id, code: 'A-01-01', type: 'Rack' })).data
  const item = (await api('POST', '/api/e/items', { sku: 'SKU-001', name: 'Cotton rolls', customer_id: cust, min_stock: 5, track_lot: true })).data
  r = await api('POST', '/api/e/grns', { warehouse_id: wh.id, customer_id: cust, children: { lines: [{ item_id: item.id, qty: 10, location_id: bin.id, lot_no: 'L-LATE', expiry_date: '2027-06-01' }, { item_id: item.id, qty: 5, location_id: bin.id, lot_no: 'L-EARLY', expiry_date: '2026-12-01' }] } }); ok('create GRN', r.status === 201 && /^GRN26/.test(r.data.grn_no), r.data)
  const grn = id(r)
  r = await api('POST', `/api/warehouse/grns/${grn}/post`); ok('post GRN', r.status === 200 && r.data.status === 'Posted', r.data)
  r = await api('GET', `/api/warehouse/stock?item_id=${item.id}`); ok('stock on hand = 15', r.data.summary[0].qty === 15, r.data.summary)
  r = await api('POST', '/api/e/dispatches', { warehouse_id: wh.id, customer_id: cust, children: { lines: [{ item_id: item.id, qty: 7 }] } }); const dsp = id(r)
  r = await api('POST', `/api/warehouse/dispatches/${dsp}/post`); ok('post dispatch (FEFO)', r.status === 200, r.data)
  r = await api('GET', `/api/warehouse/stock?item_id=${item.id}`); const early = r.data.detail.find((d: any) => d.lot_no === 'L-EARLY'), late = r.data.detail.find((d: any) => d.lot_no === 'L-LATE')
  ok('FEFO: earliest-expiry lot consumed first (5 from L-EARLY, 2 from L-LATE)', !early && late?.qty === 8, r.data.detail)
  r = await api('POST', '/api/e/dispatches', { warehouse_id: wh.id, customer_id: cust, children: { lines: [{ item_id: item.id, qty: 99 }] } }); const d2 = id(r)
  r = await api('POST', `/api/warehouse/dispatches/${d2}/post`); ok('cannot dispatch more than available', r.status === 400 && /Insufficient stock/.test(r.data.error), r.data)

  sec('Transport, customs, tasks, panel')
  const veh = (await api('POST', '/api/e/vehicles', { plate_no: 'DXB A 12345', type: '7-ton truck' })).data
  r = await api('POST', '/api/e/transport_orders', { customer_id: cust, job_id: job.id, status: 'Dispatched', pickup_location: 'Dubai', delivery_location: 'Jebel Ali' }); ok('cannot dispatch trip without vehicle', r.status === 400)
  r = await api('POST', '/api/e/transport_orders', { customer_id: cust, job_id: job.id, status: 'Dispatched', vehicle_id: veh.id, pickup_location: 'Dubai', delivery_location: 'Jebel Ali' }); ok('dispatch trip → vehicle on trip', r.status === 201)
  r = await api('GET', `/api/e/vehicles/${veh.id}`); ok('vehicle status On trip', r.data.status === 'On trip')
  r = await api('POST', '/api/e/customs_declarations', { declaration_type: 'Export – Shipping Bill (SB)', job_id: job.id, declaration_no: 'SB-123456', status: 'Cleared', children: { lines: [{ description: 'Spare parts', value: 1000, duty_pct: 0, vat_pct: 5 }] } }); ok('customs declaration with duty calc', r.status === 201 && r.data.total_value === 1000 && r.data.vat_total === 50, r.data)
  r = await api('GET', `/api/e/jobs/${job.id}`); ok('job SB No & customs status synced from declaration', r.data.sb_no === 'SB-123456' && r.data.customs_status === 'Cleared', [r.data.sb_no, r.data.customs_status])
  r = await api('POST', `/api/panel/jobs/${job.id}/comments`, { body: 'Please confirm AWB draft' }); ok('add comment', r.status === 200)
  r = await api('POST', `/api/panel/jobs/${job.id}/tags`, { tag: 'urgent' }); ok('add tag', r.status === 200)
  r = await api('POST', `/api/panel/jobs/${job.id}/refs`, { ref_type: 'Customer PO', ref_value: 'PO-8891' }); ok('add reference', r.status === 200)
  r = await api('POST', `/api/panel/jobs/${job.id}/like`); ok('like record', r.data.liked === true)
  r = await api('POST', `/api/panel/jobs/${job.id}/video`); ok('start video call link', /^https:\/\/meet\.jit\.si\/Elvora-jobs-/.test(r.data.url))
  r = await api('POST', '/api/e/tasks', { title: 'Chase AWB signature', due_date: '2026-10-09', link_entity: 'jobs', link_id: job.id }); ok('follow-up task linked to job', r.status === 201 && r.data.link_label === job.job_no, r.data)
  r = await api('POST', '/api/e/tickets', { subject: 'Late delivery', customer_id: cust, link_entity: 'jobs', link_id: job.id, priority: 'High' }); ok('complaint linked to job with SLA', r.status === 201 && !!r.data.due_at, r.data)
  r = await api('GET', `/api/panel/jobs/${job.id}`); const p = r.data
  ok('side panel counts (comments, follow ups, tags, refs, likes, complaints, video, history)', p.comments === 2 && p.followups === 1 && p.tags === 1 && p.references === 1 && p.likes === 1 && p.complaints === 1 && p.videocalls === 1 && p.history >= 3, p)
  r = await api('GET', `/api/panel/jobs/${job.id}/history`); ok('history has field-level changes', r.data.some((h: any) => h.action === 'update' && h.changes))

  sec('Dashboard, reports, calendar, KPI')
  r = await api('GET', '/api/dashboard'); ok('dashboard payload (sales by branch, recent jobs, calls, shipments)', r.data.charts.sales_branch && r.data.lists.recent_jobs.length >= 2 && r.data.lists.recent_shipments.length === 1 && Array.isArray(r.data.lists.recent_calls), Object.keys(r.data.lists))
  r = await api('GET', '/api/reports'); ok('report catalogue', r.data.length >= 20, r.data.length)
  for (const key of ['job_register', 'job_profitability', 'sales_by_branch', 'sales_by_customer', 'ar_aging', 'ap_aging', 'unbilled_charges', 'open_jobs_aging', 'container_status', 'on_time', 'quotation_funnel', 'pipeline', 'lead_funnel', 'document_expiries', 'shipment_register', 'customer_profitability', 'lane_profitability', 'transport_utilisation', 'leave_balance', 'ticket_sla', 'tax_invoice_register', 'sales_by_month', 'sales_by_salesperson']) { r = await api('GET', `/api/reports/${key}`); ok(`report ${key} runs`, r.status === 200 && Array.isArray(r.data.rows), r.data) }
  r = await api('GET', '/api/reports/job_register?format=csv', undefined, { raw: true }); ok('report CSV export', ((r as Response).headers.get('content-type') ?? '').includes('text/csv'))
  r = await api('GET', '/api/calendar?from=2026-10-01&to=2026-10-31'); ok('calendar aggregates events', r.data.some((e: any) => e.type === 'ETD'), r.data.length)
  r = await api('GET', '/api/kpi'); ok('KPI board', r.data.kpis.length >= 10)
  r = await api('GET', `/api/e/jobs/export.csv`, undefined, { raw: true }); const csv = await (r as Response).text(); ok('CSV export of jobs', csv.includes(job.job_no))

  sec('Security & permissions')
  r = await api('POST', '/api/e/roles', { name: 'Clerk', permissions: { jobs: ['view'] } }); const clerkRole = id(r); ok('create custom role', r.status === 201, r.data)
  r = await api('POST', '/api/e/users', { name: 'Test Clerk', email: 'clerk@elvorashipping.com', password: 'weak', role_id: clerkRole }); ok('weak password rejected', r.status === 400, r.data)
  r = await api('POST', '/api/e/users', { name: 'Test Clerk', email: 'clerk@elvorashipping.com', password: 'Clerk@Pass2026', role_id: clerkRole, active: true }); ok('create user', r.status === 201, r.data)
  const adminCookie = cookie
  r = await api('POST', '/api/auth/login', { email: 'clerk@elvorashipping.com', password: 'Clerk@Pass2026' }); ok('clerk signs in', r.status === 200)
  r = await api('GET', '/api/e/jobs'); ok('clerk can view jobs', r.status === 200)
  r = await api('GET', '/api/e/invoices'); ok('clerk cannot view invoices (403)', r.status === 403, r.data)
  r = await api('POST', '/api/e/jobs', { client_id: cust }); ok('clerk cannot create jobs (403)', r.status === 403)
  r = await api('GET', '/api/e/users'); ok('clerk cannot read users (403)', r.status === 403)
  r = await api('GET', '/api/meta'); ok('navigation filtered by permission', r.data.nav.length === 1 && r.data.nav[0].items.every((i: any) => i.module === 'jobs'), r.data.nav.map((g: any) => g.label))
  r = await fetch(BASE + '/api/e/jobs', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}' }); ok('CSRF header required for cookie mutations', r.status === 403)
  cookie = mgrCookie
  r = await api('GET', '/api/e/users'); ok('manager has full access (users list)', r.status === 200 && r.data.total >= 3, r.status)
  r = await api('GET', '/api/admin/audit'); ok('audit log recorded', r.data.total > 20, r.data.total)
  cookie = adminCookie
  r = await api('DELETE', `/api/e/parties/${cust}`); ok('cannot delete a customer that has records', r.status === 409, r.data)
  r = await api('PUT', '/api/e/users/1', { active: false }); ok('cannot deactivate yourself', r.status === 400, r.data)
  r = await api('POST', '/api/admin/backups'); ok('database backup created', r.status === 200 && /\.(db|json\.gz)$/.test(r.data.name ?? ''), r.data)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1) }
  void meta
}
main().catch(e => { console.error(e); process.exit(1) })
