import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { q } from '../src/server/db'
import { loadUser } from '../src/server/auth'
import { createRecord, getDef, getRecord, updateRecord, deleteRecord, type Ctx } from '../src/server/engine'
import { confirmVendorService, resetVendorService } from '../src/server/domain/vendor-services'
import { createBillFromJobCosts, generateInvoicesFromJob } from '../src/server/domain/jobs'
import { postInvoice, postBill } from '../src/server/domain/finance'
import { closureReadiness } from '../src/server/domain/job-controls'
import { validateMeta } from '../src/shared/entities'
import { setSettings } from '../src/server/settings'

syncSchema(); seedReference(); assert.deepEqual(validateMeta(), [])
setSettings({ company_trn: '100000000000001' })
const ctx: Ctx = { user: loadUser(q.val<number>("SELECT id FROM users WHERE email='admin@elvorashipping.com'")!)! }
const mk = (entity: string, payload: any) => createRecord(getDef(entity), payload, ctx)
const customer = mk('parties', { name: 'Customer receiving vendor service', is_customer: true })
const vendor = mk('parties', { name: 'Truck and trailer supplier', is_vendor: true, is_transporter: true, trn: '100000000000002' })
const branch = q.val<number>('SELECT id FROM branches LIMIT 1')!
const job = mk('jobs', { client_id: customer.id, branch_id: branch, department: 'ROAD IMPORT', trade: 'Import' })
const code = q.val<number>('SELECT id FROM charge_codes WHERE cost_account_id IS NOT NULL AND income_account_id IS NOT NULL LIMIT 1')!
const vat = q.val<number>('SELECT id FROM vat_codes WHERE rate=5 LIMIT 1')!
const zero = q.val<number>('SELECT id FROM vat_codes WHERE rate=0 LIMIT 1')!
const payload = { job_id: job.id, vendor_id: vendor.id, service_type: 'Truck hire', description: '10-ton truck for customer delivery', start_date: '2026-10-08', return_due: '2026-10-10', charge_code_id: code, buy_qty: 2, buy_rate: 500, buy_vat_code_id: vat, sell_qty: 2, sell_rate: 700, sell_vat_code_id: vat }
const service = mk('vendor_services', payload)
assert.equal(service.buy_amount, 1000); assert.equal(service.sell_amount, 1400); assert.equal(service.margin_base, 400); assert.equal(service.return_required, true)
assert.equal(q.val('SELECT COUNT(*) FROM job_charges WHERE job_id=?', job.id), 0)
assert.throws(() => updateRecord(getDef('vendor_services'), service.id, { status: 'Confirmed' }, ctx), /Use Confirm/)
const denied: Ctx = { user: { ...ctx.user!, permissions: { jobs: ['view','edit'] } } }
assert.throws(() => confirmVendorService(service.id, denied), /finance/)
const confirmed = confirmVendorService(service.id, ctx)
assert.equal(confirmed.charges_created, true)
assert.throws(() => confirmVendorService(service.id, ctx), /unconfirmed draft/)
assert.throws(() => updateRecord(getDef('jobs'), job.id, { client_id: mk('parties', { name: 'Different customer', is_customer: true }).id }, ctx), /Customer cannot change/)
let j = getRecord(getDef('jobs'), job.id, ctx)
assert.equal(j.total_cost, 1000); assert.equal(j.total_revenue, 1400); assert.equal(j.profit, 400)
assert.equal(j.children.charges.length, 2)
const cost = j.children.charges.find((c: any) => c.kind === 'Cost'), revenue = j.children.charges.find((c: any) => c.kind === 'Revenue')
assert.equal(cost.party_id, vendor.id); assert.equal(revenue.party_id, customer.id); assert.equal(cost.vat_amount, 50)
assert.throws(() => updateRecord(getDef('vendor_services'), service.id, { buy_rate: 600 }, ctx), /locked/)
assert.throws(() => updateRecord(getDef('jobs'), job.id, { children: { charges: [] } }, ctx), /cannot be removed/)
assert.throws(() => updateRecord(getDef('jobs'), job.id, { children: { charges: j.children.charges.map((c: any) => ({ ...c, party_id: customer.id })) } }, ctx), /locked/)
assert.throws(() => updateRecord(getDef('jobs'), job.id, { children: { charges: j.children.charges.map((c: any) => ({ ...c, party_id: null })) } }, ctx), /locked/)
updateRecord(getDef('jobs'), job.id, { children: { charges: j.children.charges.map((c: any) => ({ id: c.id })) } }, ctx)
assert.equal(getRecord(getDef('jobs'),job.id,ctx).profit, 400)
assert.throws(() => deleteRecord(getDef('vendor_services'), service.id, ctx), /cannot be deleted/)
assert.throws(() => updateRecord(getDef('jobs'), job.id, { job_status: 'CANCELLED' }, ctx), /vendor services/)
assert.equal(closureReadiness(job.id,ctx).checks.find(c => c.key === 'vendor_services')!.passed, false)
resetVendorService(service.id, ctx)
assert.equal(q.val('SELECT COUNT(*) FROM job_charges WHERE job_id=?', job.id), 0)
assert.equal(getRecord(getDef('jobs'), job.id, ctx).profit, 0)
confirmVendorService(service.id, ctx)
const invoice = generateInvoicesFromJob(job.id, {}, ctx)[0]
const bill = createBillFromJobCosts(job.id, vendor.id, 'VENDOR-TRUCK-001', [], ctx)
assert.equal(invoice.party_id, customer.id); assert.equal(invoice.total, 1470)
assert.equal(bill.vendor_id, vendor.id); assert.equal(bill.total, 1050)
assert.throws(() => resetVendorService(service.id, ctx), /referenced by an invoice or bill/)
const postedInvoice = postInvoice(invoice.id, ctx), postedBill = postBill(bill.id, ctx)
for (const doc of [postedInvoice, postedBill]) {
  const total = q.get('SELECT SUM(debit) debit,SUM(credit) credit FROM journal_lines WHERE entry_id=? AND deleted_at IS NULL', doc.journal_id)!
  assert.equal(total.debit, total.credit)
}
assert.equal(q.val("SELECT COUNT(*) FROM job_charges WHERE vendor_service_id=? AND status IN ('Billed','Invoiced')", service.id), 2)
assert.throws(() => updateRecord(getDef('vendor_services'), service.id, { status: 'In use' }, ctx), /number before use/)
updateRecord(getDef('vendor_services'), service.id, { equipment_no: 'DUBAI-TRUCK-123', status: 'In use' }, ctx)
const busy = mk('vendor_services', { ...payload, equipment_no: 'dubai-truck-123' })
confirmVendorService(busy.id, ctx)
assert.throws(() => updateRecord(getDef('vendor_services'), busy.id, { status: 'In use' }, ctx), /already in use/)
resetVendorService(busy.id, ctx)
updateRecord(getDef('vendor_services'), busy.id, { status: 'Cancelled' }, ctx)
assert.throws(() => updateRecord(getDef('vendor_services'), service.id, { status: 'Completed' }, ctx), /completion or return reference/)
updateRecord(getDef('vendor_services'), service.id, { status: 'Completed', completion_reference: 'Signed POD 123' }, ctx)
assert.throws(() => updateRecord(getDef('vendor_services'), service.id, { status: 'Returned' }, ctx), /actual return date/)
updateRecord(getDef('vendor_services'), service.id, { status: 'Returned', returned_on: '2026-10-10', completion_reference: 'Vendor return receipt 123' }, ctx)
assert.equal(closureReadiness(job.id,ctx).checks.find(c => c.key === 'vendor_services')!.passed, true)

const job2 = mk('jobs', { client_id: customer.id, branch_id: branch, department: 'ROAD IMPORT', trade: 'Import' })
const fx = mk('vendor_services', { ...payload, job_id: job2.id, service_type: 'Transport service', buy_qty: 1, buy_rate: 100, buy_currency: 'USD', buy_ex_rate: 3.6725, buy_vat_code_id: zero, sell_qty: 1, sell_rate: 500 })
confirmVendorService(fx.id, ctx)
j = getRecord(getDef('jobs'), job2.id, ctx)
assert.equal(j.total_cost, 367.25); assert.equal(j.total_revenue, 500); assert.equal(j.profit, 132.75)
updateRecord(getDef('vendor_services'), fx.id, { status: 'Completed', completion_reference: 'Transport POD 456' }, ctx)
assert.equal(closureReadiness(job2.id,ctx).checks.find(c => c.key === 'vendor_services')!.passed, true)
const nonvendor = mk('parties', { name: 'Not a supplier', is_customer: true })
assert.throws(() => mk('vendor_services', { ...payload, vendor_id: nonvendor.id }), /vendor \/ supplier/)
assert.throws(() => mk('vendor_services', { ...payload, buy_qty: 0 }), /minimum|positive/)
assert.throws(() => mk('vendor_services', { ...payload, end_date: '2026-10-07' }), /before its start/)
const wrongTrip = mk('transport_orders', { customer_id: customer.id, job_id: job2.id })
assert.throws(() => mk('vendor_services', { ...payload, transport_order_id: wrongTrip.id }), /linked trip/)
const po = mk('purchase_orders', { vendor_id: vendor.id })
assert.throws(() => mk('vendor_services', { ...payload, purchase_order_id: po.id }), /purchase order must be approved/)
const portal: Ctx = { user: { ...ctx.user!, party_id: customer.id } }
assert.throws(() => getRecord(getDef('vendor_services'), service.id, portal), /not found/i)
const missingReturn = mk('vendor_services', { ...payload, return_due: null })
assert.throws(() => confirmVendorService(missingReturn.id, ctx), /return due date/)
assert.equal(getRecord(getDef('vendor_services'), missingReturn.id, ctx).charges_created, false)
assert.equal(q.val('SELECT COUNT(*) FROM job_charges WHERE vendor_service_id=?', missingReturn.id), 0)
const rounded = mk('vendor_services', { ...payload, job_id: job2.id, buy_rate: 500.123, sell_rate: 700.126 })
assert.equal(rounded.buy_rate, 500.12); assert.equal(rounded.buy_amount, 1000.24)
confirmVendorService(rounded.id, ctx)
assert.equal(q.val<number>("SELECT amount FROM job_charges WHERE vendor_service_id=? AND kind='Cost'", rounded.id), 100024)
console.log('Vendor services passed: buy/sell amounts, currencies and tax, charge locks, duplicate prevention, bills/invoices, balanced journals, equipment returns, closure, permissions and party/trip/PO validation.')
