/* Elvora starter data (customer, jobs and the four supplied invoices) and the business-data reset.
   Needs a server on a fresh data directory with default settings (STARTER_DATA on, demo off):  npx tsx tests/starter-data.ts */
import { Api, ok, sec, finish } from './_api'
import { amountInWords } from '../src/shared/words'

async function main() {
  const a = new Api()
  sec('Sign in')
  ok('administrator signs in', await a.login())
  let r = await a.get('/api/demo/status'); ok('demo workspace is off by default', r.status === 200 && r.data.enabled === false, r.data)

  sec('Customer and contact')
  r = await a.get('/api/e/parties?pageSize=50'); ok('exactly one party exists after first start', r.data.total === 1, r.data.total)
  const mam = r.data.rows[0]
  ok('customer is MAM Trading Group LLC with TRN', mam.name === 'MAM Trading Group LLC' && mam.trn === '101268312400003' && mam.is_customer === true, mam)
  ok('customer address, phone and e-mail from the invoice', mam.po_box === '5014' && mam.city === 'Dubai' && mam.phone === '+971 4 2250433' && mam.email === 'mamuae@eim.ae', mam)
  r = await a.get(`/api/e/contacts?pageSize=10`); ok('primary contact present', r.data.total === 1 && r.data.rows[0].is_primary === true && r.data.rows[0].party_id === mam.id)

  sec('Jobs')
  r = await a.get('/api/e/jobs?pageSize=10&sort=id&dir=asc'); ok('two jobs exist', r.data.total === 2, r.data.total)
  const [j1, j2] = r.data.rows
  r = await a.get(`/api/e/jobs/${j1.id}`); const job1 = r.data
  ok('job 1: BL, vessel, weight, FCL import', job1.mbl_no === 'BLJEA260800136' && job1.vessel_name === 'ESL BUSAN' && job1.gross_weight === 31629.75 && job1.department === 'FCL IMPORT' && job1.trade === 'Import', job1)
  ok('job 1: containers CAAU4171016 and BMOU9822371', job1.children.containers.map((c: any) => c.container_no).sort().join() === 'BMOU9822371,CAAU4171016', job1.children.containers)
  ok('job 1: all seven revenue charges are invoiced', job1.children.charges.length === 7 && job1.children.charges.every((c: any) => c.status === 'Invoiced' && c.currency === 'USD' && c.ex_rate === 3.685), job1.children.charges.map((c: any) => c.status))
  ok('job 1 revenue in AED', Math.abs(job1.total_revenue - 92338.73) < 0.005, job1.total_revenue)
  r = await a.get(`/api/e/jobs/${j2.id}`); const job2 = r.data
  ok('job 2: BL, POL Laem Chabang, POD Khor Fakkan, cargo', job2.mbl_no === 'CSSLCHJEA20262535' && job2._labels.pol_id?.includes('LAEM CHABANG') && job2._labels.pod_id?.includes('KHOR FAKKAN') && job2.place_of_delivery === 'Jebel Ali, UAE' && job2.packages === 2520 && job2.children.cargo[0].description === 'Assorted candy', job2)
  ok('job 2: two 40HC containers', job2.children.containers.length === 2 && job2.children.containers.every((c: any) => c._labels.type_id?.includes('40HC') || c._labels.type_id?.includes("40'")), job2.children.containers.map((c: any) => c._labels))
  ok('job 2 revenue in AED', Math.abs(job2.total_revenue - 73147.25) < 0.005, job2.total_revenue)
  r = await a.get('/api/e/shipments?pageSize=10'); ok('one shipment per job', r.data.total === 2)

  sec('The four invoices match the supplied PDFs')
  r = await a.get('/api/e/invoices?pageSize=10&sort=id&dir=asc'); ok('four invoices', r.data.total === 4, r.data.total)
  const byNo: Record<string, any> = Object.fromEntries(r.data.rows.map((x: any) => [x.invoice_no, x]))
  const expect: Record<string, [string, number, number, number, number]> = { 'DXB/IMP/ES101': ['2026-09-04', 86258.48, -0.48, 86258, 3], 'DXB/IMP/ES101A': ['2026-09-07', 6080.25, -0.25, 6080, 4], 'DXB/IMP/ES102': ['2026-10-15', 67067, 0, 67067, 3], 'DXB/IMP/ES102A': ['2026-10-15', 6080.25, 0, 6080.25, 4] }
  for (const [no, [date, sub, rounding, total, lines]] of Object.entries(expect)) {
    const i = byNo[no]
    ok(`${no}: exists, posted, dated ${date}`, i && i.status === 'Posted' && i.invoice_date === date && i.currency === 'AED' && i.doc_type === 'Tax Invoice', i)
    if (!i) continue
    ok(`${no}: charges ${sub}, rounding ${rounding}, total ${total}`, Math.abs(i.subtotal - sub) < 0.005 && Math.abs(i.rounding - rounding) < 0.005 && Math.abs(i.total - total) < 0.005 && i.vat_total === 0 && Math.abs(i.base_total - total) < 0.005 && Math.abs(i.balance - total) < 0.005, { s: i.subtotal, r: i.rounding, t: i.total })
    const full = (await a.get(`/api/e/invoices/${i.id}`)).data
    ok(`${no}: ${lines} lines, all USD at ROE 3.685, 0% VAT`, full.children.lines.length === lines && full.children.lines.every((l: any) => l.line_ccy === 'USD' && l.line_roe === 3.685 && l.vat_pct === 0), full.children.lines)
    ok(`${no}: customer and job linked, shipment details stored`, full.party_id === mam.id && !!full.job_id && !!full.ship_bl_no && !!full.ship_containers, full)
  }
  ok('ES101 shows route, vessel and weight', byNo['DXB/IMP/ES101'].ship_receipt === 'Lat Krabang' && byNo['DXB/IMP/ES101'].ship_destination === 'Jebel Ali' && byNo['DXB/IMP/ES101'].ship_vessel === 'ESL BUSAN' && byNo['DXB/IMP/ES101'].ship_weight === '31,629.75 KGS')
  ok('ES102 shows POL, POD, HS code and cargo', byNo['DXB/IMP/ES102'].ship_pol === 'Laem Chabang, Thailand' && byNo['DXB/IMP/ES102'].ship_pod === 'Khorfakkan, UAE' && byNo['DXB/IMP/ES102'].ship_hs_code === '1704.90.30' && byNo['DXB/IMP/ES102'].ship_cargo === "2 x 40' HQ | 2,520 cartons assorted candy")
  const es101 = (await a.get(`/api/e/invoices/${byNo['DXB/IMP/ES101'].id}`)).data
  ok('ES101 line amounts 77,045.98 / 8,844.00 / 368.50', es101.children.lines.map((l: any) => l.amount).join() === '77045.98,8844,368.5', es101.children.lines.map((l: any) => l.amount))
  ok('amount in words matches the PDFs', amountInWords(86258, 'AED') === 'AED Eighty-six thousand two hundred fifty-eight dirhams only.' && amountInWords(6080, 'AED') === 'AED Six thousand eighty dirhams only.' && amountInWords(67067, 'AED') === 'AED Sixty-seven thousand sixty-seven dirhams only.' && amountInWords(6080.25, 'AED') === 'AED Six thousand eighty dirhams and twenty-five fils only.')

  sec('Ledger')
  r = await a.get(`/api/e/journal_entries/${es101.journal_id}`); const lines = r.data.children.lines
  ok('ES101 journal balances and carries the 0.48 rounding', Math.abs(lines.reduce((s: number, l: any) => s + (l.debit ?? 0) - (l.credit ?? 0), 0)) < 0.001 && lines.some((l: any) => l._labels.account_id?.includes('Rounding') && l.debit === 0.48), lines)
  r = await a.get(`/api/finance/statement/${mam.id}`); ok('customer statement closing balance = 165,485.25', Math.abs(r.data.closing - (86258 + 6080 + 67067 + 6080.25)) < 0.005, r.data.closing)
  r = await a.get('/api/e/compliance_exceptions?pageSize=20'); ok('missing supplier TRN is visible as a warning, not hidden', r.data.rows.filter((x: any) => x.rule === 'SUPPLIER_TRN' && x.severity === 'Warning').length === 4, r.data.rows.map((x: any) => x.rule))

  sec('Numbering continues from 103')
  r = await a.put('/api/admin/settings', { company_trn: '100123456700003' }); ok('company TRN saved so new tax invoices can post', r.status === 200)
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: mam.id, trade: 'Import', invoice_date: '2026-10-16', currency: 'AED', children: { lines: [{ description: 'Detention charge', qty: 1, rate: 100, vat_code_id: (await a.get('/api/e/vat_codes?pageSize=10')).data.rows.find((v: any) => v.code === 'ZR').id }] } })
  ok('standalone invoice (no job) can be created', r.status === 201 && !r.data.job_id, r.data)
  r = await a.post(`/api/finance/invoices/${r.data.id}/post`); ok('next import invoice is DXB/IMP/ES103', r.status === 200 && r.data.invoice_no === 'DXB/IMP/ES103', r.data)
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: mam.id, invoice_date: '2026-10-16', custom_no: 'DXB/IMP/ES101', children: { lines: [{ description: 'x', qty: 1, rate: 1 }] } }); ok('an invoice number already used is rejected', r.status === 400 && /already used/.test(r.data.error), r.data)

  sec('Company profile and reference data')
  r = await a.get('/api/admin/settings'); ok('company phone, e-mail and website on documents', r.data.company_phone === '+971 50 422 1950' && r.data.company_email === 'sales@elvorashipping.com' && r.data.invoice_no_pattern === '{branch}/{dir}/ES{seq:3}', r.data)
  r = await a.get('/api/e/charge_codes?pageSize=200'); const codes = new Set(r.data.rows.map((c: any) => c.code)); ok('charge codes for the invoice lines exist', ['DROP-OFF', 'EMPTY-TR', 'LADEN-TR', 'BL-SURR', 'PORT-CONG', 'FRT-OCN', 'PSS', 'BLF'].every(c => codes.has(c)))
  r = await a.get('/api/e/users'); ok('only the two production users exist', r.data.total === 2, r.data.rows?.map((u: any) => u.email))

  sec('Clearing business data')
  r = await a.get('/api/admin/business-data'); ok('summary lists what would be removed', r.status === 200 && r.data.total > 10 && r.data.rows.some((x: any) => x.table === 'invoices' && x.count === 5), r.data)
  r = await a.post('/api/admin/business-data/reset', { confirm: 'delete everything' }); ok('wrong confirmation phrase is refused', r.status === 400, r.data)
  r = await a.post('/api/admin/business-data/reset', { confirm: 'DELETE ALL BUSINESS DATA', load_starter: false }); ok('reset succeeds and reports a backup', r.status === 200 && r.data.total > 10 && /^elvora-before-reset-/.test(r.data.backup), r.data)
  const bk = await a.get('/api/admin/backups'); ok('the pre-reset backup is listed', bk.data.some((b: any) => b.name === r.data.backup && b.bytes > 10000), bk.data)
  for (const e of ['parties', 'contacts', 'leads', 'jobs', 'shipments', 'invoices', 'bills', 'receipts', 'journal_entries', 'quotations', 'opportunities', 'activities', 'tasks', 'attachments']) { const c = await a.get(`/api/e/${e}?pageSize=1`); ok(`${e} is empty`, c.data.total === 0, c.data.total) }
  r = await a.get('/api/e/accounts?pageSize=1'); ok('chart of accounts is untouched', r.data.total > 40)
  r = await a.get('/api/e/charge_codes?pageSize=1'); ok('charge codes are untouched', r.data.total > 30)
  r = await a.get('/api/e/users'); ok('users are untouched', r.data.total === 2)
  r = await a.get('/api/e/doc_templates?pageSize=1'); ok('document templates are untouched', r.data.total > 150)
  r = await a.get('/api/admin/settings'); ok('company settings are untouched', r.data.company_phone === '+971 50 422 1950')
  r = await a.get('/api/admin/audit?action=business-reset'); ok('the reset is in the audit log', r.data.total >= 1, r.data)
  r = await a.post('/api/admin/business-data/load-starter'); ok('starter data can be loaded again on request', r.status === 200 && r.data.invoices.length === 4, r.data)
  r = await a.get('/api/e/invoices?pageSize=10&sort=id&dir=asc'); ok('invoices are back and numbering restarts correctly', r.data.total === 4 && r.data.rows.every((i: any) => /^DXB\/IMP\/ES10[12]A?$/.test(i.invoice_no)), r.data.rows.map((i: any) => i.invoice_no))
  r = await a.post('/api/admin/business-data/load-starter'); ok('loading twice is refused', r.status === 400)
  r = await a.post('/api/admin/business-data/reset', { confirm: 'DELETE ALL BUSINESS DATA', load_starter: true }); ok('reset with starter data reloads the set', r.status === 200 && r.data.starter?.loaded === true, r.data)
  finish()
}
main().catch(e => { console.error(e); process.exit(1) })
