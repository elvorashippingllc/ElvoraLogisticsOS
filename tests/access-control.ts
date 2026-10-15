/* Access control for company-wide endpoints: a customer-portal user and a role without CRM/finance access must not read other people's data.
   Needs a server on a fresh data directory with STARTER_DATA=false:  npx tsx tests/access-control.ts */
import { Api, ok, sec, finish } from './_api'

async function main() {
  const a = new Api()
  ok('administrator signs in', await a.login())
  await a.put('/api/admin/settings', { company_trn: '100123456700003' })
  const dxb = (await a.get('/api/e/branches')).data.rows[0].id
  const roles = (await a.get('/api/e/roles?pageSize=50')).data.rows
  const roleId = (n: string) => roles.find((r: any) => r.name === n).id
  const mine = (await a.post('/api/e/parties', { name: 'Portal Customer A', is_customer: true, status: 'Active' })).data.id
  const other = (await a.post('/api/e/parties', { name: 'Rival Customer B', is_customer: true, status: 'Active' })).data.id
  const zr = (await a.get('/api/e/vat_codes?pageSize=20')).data.rows.find((v: any) => v.code === 'ZR').id
  const job = (await a.post('/api/e/jobs', { client_id: other, branch_id: dxb, department: 'FCL IMPORT', trade: 'Import', job_date: '2026-10-01' })).data.id
  const inv = (await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: other, job_id: job, invoice_date: '2026-10-01', children: { lines: [{ description: 'Freight', qty: 1, rate: 5000, vat_code_id: zr }] } })).data.id
  await a.post(`/api/finance/invoices/${inv}/post`)
  const myInv = (await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: mine, invoice_date: '2026-10-01', children: { lines: [{ description: 'Own freight', qty: 1, rate: 100, vat_code_id: zr }] } })).data.id
  await a.post(`/api/finance/invoices/${myInv}/post`)
  await a.post('/api/e/users', { name: 'Portal A', email: 'portal@a.example', password: 'Portal-Pass-2026!', role_id: roleId('Customer Portal'), branch_id: dxb, party_id: mine, active: true, must_change_password: false })
  await a.post('/api/e/users', { name: 'Warehouse', email: 'wh@a.example', password: 'Warehouse-Pass-2026!', role_id: roleId('Warehouse'), branch_id: dxb, active: true, must_change_password: false })
  const p = new Api(), w = new Api()
  ok('portal user signs in', await p.login('portal@a.example', 'Portal-Pass-2026!'))
  ok('warehouse user signs in', await w.login('wh@a.example', 'Warehouse-Pass-2026!'))

  sec('Customer portal: own records only')
  let r = await p.get('/api/e/invoices?pageSize=20'); ok('portal lists only its own invoices', r.status === 200 && r.data.total === 1 && r.data.rows[0].party_id === mine, r.data)
  r = await p.get(`/api/e/invoices/${inv}`); ok('another customer’s invoice is not found', r.status === 404)
  r = await p.get(`/api/finance/statement/${mine}`); ok('own statement is readable', r.status === 200 && r.data.closing === 100, r.data)
  r = await p.get(`/api/finance/statement/${other}`); ok('another customer’s statement is refused', r.status === 403)
  r = await p.get(`/api/finance/open-invoices?party_id=${other}`); ok('open invoices of another customer are closed to portal users', r.status === 403, r.data)
  r = await p.get(`/api/finance/open-invoices?party_id=${mine}`); ok('open invoices endpoint is staff-only even for the own company', r.status === 403)
  r = await p.get('/api/finance/open-bills?vendor_id=1'); ok('open vendor bills are closed to portal users', r.status === 403)
  r = await p.get('/api/finance/bank/summary'); ok('company bank balances are closed to portal users', r.status === 403, r.data)
  r = await p.get('/api/finance/year-end/2026'); ok('company year-end figures are closed to portal users', r.status === 403)
  r = await p.get('/api/rates/search'); ok('rate cards (buy and sell rates) are closed to portal users', r.status === 403)
  r = await p.get('/api/custody/recipients'); ok('internal staff list is closed to portal users', r.status === 403)
  r = await p.get('/api/studio/fill-data'); ok('Document Studio helpers are closed to portal users', r.status === 403)
  r = await p.post('/api/studio/documents', {}); ok('portal users cannot create Studio documents', r.status === 403)
  r = await p.get('/api/e/doc_templates?pageSize=2'); ok('portal users cannot browse the template library', r.status === 403 || r.data.total === 0, r.data.total)
  r = await p.get('/api/e/parties/lookup?q=Rival'); ok('portal users cannot look up customers', r.status === 403)
  r = await p.get(`/api/jobs/${job}/closure`); ok('closure data of another customer’s job is closed', r.status === 403 || r.status === 404)
  r = await p.get('/api/admin/system'); ok('administration is closed', r.status === 403)
  r = await p.get('/api/dashboard'); ok('portal dashboard still works', r.status === 200 && r.data.portal === true)
  r = await p.get('/api/calendar'); ok('portal calendar still works', r.status === 200)

  sec('Staff without CRM or finance access')
  r = await w.get('/api/e/parties?pageSize=5'); ok('the record API refuses CRM to a warehouse role', r.status === 403)
  r = await w.get('/api/e/parties/lookup?q=Rival'); ok('a warehouse role can pick a party name for its own forms (reference picker only, no detail)', r.status === 200)
  r = await w.get(`/api/e/parties/${other}`); ok('but cannot read the party record itself', r.status === 403)
  r = await w.get('/api/e/bank_accounts/lookup?q='); ok('bank account names are not listed to a warehouse role', r.status === 403, r.data)
  r = await w.get('/api/e/employees/lookup?q='); ok('employee names are not listed to a warehouse role', r.status === 403, r.data)
  r = await w.get('/api/e/branches/lookup?q='); ok('branches (a reference used by warehouse forms) can still be picked', r.status === 200 && r.data.length >= 1, r.data)
  r = await w.get('/api/e/users/lookup?q='); ok('assignee pickers still list colleagues', r.status === 200 && r.data.length >= 2, r.data)
  r = await w.get('/api/e/items/lookup?q='); ok('items (own module) can be picked', r.status === 200)
  r = await w.get('/api/finance/bank/summary'); ok('bank balances are closed to a warehouse role', r.status === 403)
  finish()
}
main().catch(e => { console.error(e); process.exit(1) })
