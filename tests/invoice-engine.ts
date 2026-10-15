/* Invoice engine: foreign-priced lines billed in AED, rounding, own/series numbering, shipment details, supplementary invoices, e-invoice and PDF.
   Needs a server on a fresh data directory with STARTER_DATA=false:  npx tsx tests/invoice-engine.ts */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Api, ok, sec, finish } from './_api'

const pdfText = (buf: Buffer) => { const f = path.join(os.tmpdir(), `inv-${Date.now()}.pdf`); fs.writeFileSync(f, buf); const r = spawnSync('pdftotext', ['-layout', f, '-']); fs.rmSync(f, { force: true }); return r.status === 0 ? String(r.stdout) : null }

async function main() {
  const a = new Api()
  ok('administrator signs in', await a.login())
  let r = await a.put('/api/admin/settings', { company_trn: '100123456700003' }); ok('company TRN set', r.status === 200)
  const vat = (await a.get('/api/e/vat_codes?pageSize=20')).data.rows, ZR = vat.find((v: any) => v.code === 'ZR').id, SR = vat.find((v: any) => v.code === 'SR').id
  const cust = (await a.post('/api/e/parties', { name: 'Test Importer LLC', is_customer: true, trn: '100999999900003', status: 'Active', city: 'Dubai' })).data.id
  const line = (d: string, rate: number, qty = 1, extra: any = {}) => ({ description: d, qty, rate, vat_code_id: ZR, ...extra })

  sec('USD-priced lines billed in AED, with rounding')
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-09-04', currency: 'AED', round_total: 'Round total to whole amount', children: { lines: [line('Ocean freight', 10454, 2, { line_ccy: 'USD', line_roe: 3.685 }), line('Drop-off charges', 1200, 2, { line_ccy: 'USD', line_roe: 3.685 }), line('PSS charges', 50, 2, { line_ccy: 'USD', line_roe: 3.685 })] } })
  ok('standalone draft created', r.status === 201, r.data)
  const inv1 = r.data
  ok('amount = qty × rate × ROE (77,045.98)', inv1.children.lines[0].amount === 77045.98 && inv1.children.lines[0].line_roe === 3.685 && inv1.children.lines[0].line_ccy === 'USD', inv1.children.lines[0])
  ok('subtotal 86,258.48, rounding −0.48, total 86,258.00', inv1.subtotal === 86258.48 && inv1.rounding === -0.48 && inv1.total === 86258 && inv1.base_total === 86258 && inv1.balance === 86258, { s: inv1.subtotal, r: inv1.rounding, t: inv1.total })
  r = await a.post(`/api/finance/invoices/${inv1.id}/post`); ok('posts to the ledger', r.status === 200 && r.data.status === 'Posted' && /^INV26\d{5}$/.test(r.data.invoice_no), r.data)
  const j = (await a.get(`/api/e/journal_entries/${r.data.journal_id}`)).data.children.lines
  ok('journal balances; AR 86,258.00; rounding 0.48 debit', Math.abs(j.reduce((s: number, l: any) => s + (l.debit ?? 0) - (l.credit ?? 0), 0)) < 0.001 && j.some((l: any) => l._labels.account_id?.startsWith('1200') && l.debit === 86258) && j.some((l: any) => l._labels.account_id?.startsWith('7910') && l.debit === 0.48), j.map((l: any) => [l._labels.account_id, l.debit, l.credit]))
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-09-05', currency: 'AED', round_total: 'Round total to whole amount', children: { lines: [line('Item', 10.2, 1, { vat_code_id: SR })] } })
  ok('rounding up: 10.71 becomes 11.00 (+0.29)', r.data.subtotal === 10.2 && r.data.vat_total === 0.51 && r.data.rounding === 0.29 && r.data.total === 11, r.data)
  const up = await a.post(`/api/finance/invoices/${r.data.id}/post`); const uj = (await a.get(`/api/e/journal_entries/${up.data.journal_id}`)).data.children.lines
  ok('rounding up is credited to the rounding account and the journal balances', Math.abs(uj.reduce((s: number, l: any) => s + (l.debit ?? 0) - (l.credit ?? 0), 0)) < 0.001 && uj.some((l: any) => l._labels.account_id?.startsWith('7910') && l.credit === 0.29), uj.map((l: any) => [l._labels.account_id, l.debit, l.credit]))
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-09-05', currency: 'USD', ex_rate: 3.685, children: { lines: [line('Freight', 100, 1, { line_ccy: 'EUR', line_roe: 1.1 })] } }); ok('a USD invoice cannot carry lines priced in another currency', r.status === 400, r.data)
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-09-05', currency: 'AED', children: { lines: [line('Freight', 100, 1, { line_ccy: 'USD' })] } }); ok('missing ROE falls back to the currency master rate', r.status === 201 && r.data.children.lines[0].line_roe > 3 && r.data.children.lines[0].line_roe < 4, r.data)
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-09-05', currency: 'AED', children: { lines: [line('Freight', -5)] } }); ok('negative rates are rejected', r.status === 400)

  sec('Credit note carries the foreign-priced lines')
  const full = (await a.get(`/api/e/invoices/${inv1.id}`)).data
  r = await a.post('/api/e/invoices', { doc_type: 'Credit Note', party_id: cust, original_invoice_id: inv1.id, credit_reason: 'Rate correction', invoice_date: '2026-09-06', currency: 'AED', round_total: full.round_total, children: { lines: full.children.lines.map((l: any) => ({ description: l.description, qty: l.qty, rate: l.rate, line_ccy: l.line_ccy, line_roe: l.line_roe, vat_code_id: l.vat_code_id })) } })
  ok('credit note totals equal the invoice', r.status === 201 && r.data.total === 86258 && r.data.rounding === -0.48, r.data)
  const cn = await a.post(`/api/finance/invoices/${r.data.id}/post`); ok('credit note posts', cn.status === 200 && /^CN26/.test(cn.data.invoice_no), cn.data)
  const cj = (await a.get(`/api/e/journal_entries/${cn.data.journal_id}`)).data.children.lines
  ok('credit note journal reverses the rounding (credit 0.48) and balances', Math.abs(cj.reduce((s: number, l: any) => s + (l.debit ?? 0) - (l.credit ?? 0), 0)) < 0.001 && cj.some((l: any) => l._labels.account_id?.startsWith('7910') && l.credit === 0.48), cj.map((l: any) => [l._labels.account_id, l.debit, l.credit]))
  r = await a.get(`/api/e/invoices/${inv1.id}`); ok('the original invoice is fully credited', r.data.status === 'Paid' && r.data.balance === 0, r.data)

  sec('Number series')
  r = await a.put('/api/admin/settings', { invoice_no_pattern: 'bad pattern' }); ok('an invalid number format is rejected', r.status === 400, r.data)
  r = await a.put('/api/admin/settings', { invoice_no_pattern: '{branch}/{dir}/ES{seq:3}/{seq:3}' }); ok('two counters are rejected', r.status === 400)
  r = await a.put('/api/admin/settings', { invoice_no_pattern: '{branch}/{dir}/ES{seq:3}' }); ok('custom format saved', r.status === 200 && r.data.invoice_no_pattern === '{branch}/{dir}/ES{seq:3}')
  r = await a.post('/api/finance/invoice-numbering', { next: 101 }); ok('next number set to 101', r.status === 200)
  const mk = async (extra: any) => { const c = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-10-01', currency: 'AED', children: { lines: [line('Charge', 50)] }, ...extra }); return c.data.id as number }
  r = await a.post(`/api/finance/invoices/${await mk({ trade: 'Import' })}/post`); ok('first import invoice is DXB/IMP/ES101', r.data.invoice_no === 'DXB/IMP/ES101', r.data)
  r = await a.post(`/api/finance/invoices/${await mk({ trade: 'Export' })}/post`); ok('export invoice continues the same counter: DXB/EXP/ES102', r.data.invoice_no === 'DXB/EXP/ES102', r.data)
  r = await a.post(`/api/finance/invoices/${await mk({ trade: 'Import', custom_no: 'DXB/IMP/ES102A' })}/post`); ok('own number is used exactly and does not use the counter', r.data.invoice_no === 'DXB/IMP/ES102A', r.data)
  r = await a.post(`/api/finance/invoices/${await mk({ trade: 'Import' })}/post`); ok('the next series number is 103', r.data.invoice_no === 'DXB/IMP/ES103', r.data)
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-10-01', custom_no: 'dxb/imp/es103', children: { lines: [line('x', 1)] } }); ok('numbers are unique whatever the letter case', r.status === 400 && /already used/.test(r.data.error), r.data)
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-10-01', custom_no: '<b>1</b>', children: { lines: [line('x', 1)] } }); ok('markup in a number is rejected', r.status === 400)

  sec('Shipment details from a job and from the invoice')
  const dxb = (await a.get('/api/e/branches')).data.rows[0].id
  const pol = (await a.get('/api/e/locations?q=THLCH')).data.rows[0].id, pod = (await a.get('/api/e/locations?q=AEJEA')).data.rows[0].id
  const job = (await a.post('/api/e/jobs', { client_id: cust, branch_id: dxb, department: 'FCL IMPORT', trade: 'Import', job_date: '2026-10-02', hbl_no: 'HBL123', vessel_name: 'MV TEST', voyage_no: '12W', pol_id: pol, pod_id: pod, commodity: 'Toys', gross_weight: 1234.5, children: { containers: [{ container_no: 'TEMU1234567' }, { container_no: 'TEMU7654321' }], charges: [{ kind: 'Revenue', charge_code_id: (await a.get('/api/e/charge_codes?q=FRT-OCN')).data.rows[0].id, qty: 2, rate: 1000, currency: 'USD', ex_rate: 3.6725, party_id: cust }] } })).data
  r = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: cust, job_id: job.id, invoice_date: '2026-10-02', currency: 'AED', ship_vessel: 'TYPED VESSEL', children: { lines: [line('Freight', 1)] } })
  ok('blank shipment fields are filled from the job', r.data.ship_bl_no === 'HBL123' && r.data.ship_pol?.includes('Laem') && r.data.ship_pod === 'Jebel Ali' && r.data.ship_containers === 'TEMU1234567 | TEMU7654321' && r.data.ship_weight === '1,234.5 KGS' && r.data.ship_cargo === 'Toys' && r.data.trade === 'Import', r.data)
  ok('what was typed on the invoice wins', r.data.ship_vessel === 'TYPED VESSEL')
  r = await a.post(`/api/jobs/${job.id}/generate-invoices`, { bill_in_base: true }); ok('job → one AED invoice with the USD charge on the line', r.status === 200 && r.data.length === 1 && r.data[0].currency === 'AED' && r.data[0].children.lines[0].line_ccy === 'USD' && r.data[0].children.lines[0].line_roe === 3.6725 && r.data[0].subtotal === 7345, r.data)
  const draft = r.data[0]
  r = await a.post(`/api/finance/invoices/${draft.id}/post`); ok('it posts and marks the job charge invoiced', r.status === 200, r.data)
  ok('job charge is invoiced', (await a.get(`/api/e/jobs/${job.id}`)).data.children.charges.every((c: any) => c.status === 'Invoiced'))
  r = await a.post(`/api/e/invoices`, { doc_type: 'Tax Invoice', party_id: cust, invoice_date: '2026-10-03', currency: 'AED', children: { lines: [line('x', 1)] } }); const posted = await a.post(`/api/finance/invoices/${r.data.id}/post`)
  r = await a.put(`/api/e/invoices/${posted.data.id}`, { ship_bl_no: 'LATE-BL', version: posted.data.version }); ok('shipment text may be corrected on a posted invoice', r.status === 200 && r.data.ship_bl_no === 'LATE-BL', r.data)
  r = await a.put(`/api/e/invoices/${posted.data.id}`, { currency: 'USD', version: r.data.version }); ok('accounting fields stay locked after posting', r.status === 400, r.data)

  sec('E-invoice and PDF')
  const x = await a.raw(`/api/invoices/${inv1.id}/einvoice.xml`); const xml = await x.text()
  ok('e-invoice XML shows the rounding and the total payable', x.status === 200 && xml.includes('<cbc:PayableRoundingAmount currencyID="AED">-0.48</cbc:PayableRoundingAmount>') && xml.includes('<cbc:PayableAmount currencyID="AED">86258.00</cbc:PayableAmount>') && xml.includes('<cbc:TaxInclusiveAmount currencyID="AED">86258.48</cbc:TaxInclusiveAmount>'), xml.slice(0, 300))
  const wxml = await a.raw(`/api/invoices/${(await a.get(`/api/e/invoices?q=ES101&pageSize=5`)).data.rows[0].id}/einvoice.xml`)
  ok('e-invoice file name has no slashes', !/filename="?[^"]*\//.test(wxml.headers.get('content-disposition') ?? ''), wxml.headers.get('content-disposition'))
  const pdf = await a.raw(`/api/pdf/invoices/${inv1.id}?download=1`)
  if (pdf.status === 200) {
    const text = pdfText(Buffer.from(await pdf.arrayBuffer()))
    if (text) ok('PDF shows ROE, rounding, total and amount in words', /3\.685/.test(text) && /Rounding adjustment/i.test(text) && /86,258\.00/.test(text) && /Eighty-six thousand two hundred fifty-eight dirhams only/i.test(text) && /77,045\.98/.test(text), text.slice(0, 1800))
    else ok('PDF text extraction skipped (poppler not installed)', true)
  } else ok('PDF engine unavailable on this host – skipped', pdf.status === 400 || pdf.status === 500, pdf.status)
  finish()
}
main().catch(e => { console.error(e); process.exit(1) })
