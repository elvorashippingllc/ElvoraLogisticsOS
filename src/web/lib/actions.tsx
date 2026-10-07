import type { ReactNode } from 'react'
import { post, put, get } from './api'

export interface ActionHelpers {
  rec: any; entity: string
  toast: { ok: (t: string) => void; error: (t: string) => void }
  dlg: { confirm: (o: any) => Promise<boolean>; prompt: (o: any) => Promise<string | null> }
  nav: (to: string) => void; reload: () => void; can: (module: string, a?: any) => boolean
  dialog: (name: string, props?: any) => void
}
export interface ActionDef { key: string; label: ReactNode; tone?: 'green' | 'red' | 'violet' | 'blue' | 'orange' | 'outline' | 'dark' | 'teal'; show: (r: any, h: ActionHelpers) => boolean; run: (h: ActionHelpers) => Promise<void> | void; more?: boolean }

const run = async (h: ActionHelpers, fn: () => Promise<any>, ok: string) => { try { await fn(); h.toast.ok(ok); h.reload() } catch (e: any) { h.toast.error(e.message) } }
const fin = (h: ActionHelpers) => h.can('finance', 'edit')

export const ACTIONS: Record<string, ActionDef[]> = {
  invoices: [
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: async h => { if (await h.dlg.confirm({ title: `Post ${h.rec.doc_type.toLowerCase()}?`, message: h.rec.doc_type === 'Proforma Invoice' ? 'The proforma will be issued with its final number. No ledger entry is created.' : 'This assigns the final sequential number and creates the ledger entry. Posted documents can only be voided or credited.', ok: 'Post' })) await run(h, () => post(`/api/finance/invoices/${h.rec.id}/post`), 'Posted') } },
    { key: 'receipt', label: 'Record receipt', tone: 'violet', show: (r, h) => ['Posted', 'Partially paid'].includes(r.status) && r.balance > 0 && ['Tax Invoice', 'Debit Note'].includes(r.doc_type) && h.can('finance', 'create'), run: h => h.dialog('pay', { kind: 'receipt', doc: h.rec }) },
    { key: 'cn', label: 'Issue credit note', tone: 'outline', show: (r, h) => ['Posted', 'Partially paid', 'Paid'].includes(r.status) && r.doc_type === 'Tax Invoice' && h.can('finance', 'create'), run: async h => {
      if (!(await h.dlg.confirm({ title: 'Create credit note?', message: 'A draft credit note for the full invoice is created. Edit the lines for a partial credit, then post it.', ok: 'Create draft' }))) return
      try { const r = h.rec; const full = await get<any>(`/api/e/invoices/${r.id}`); const cn = await post<any>('/api/e/invoices', { doc_type: 'Credit Note', party_id: r.party_id, job_id: r.job_id, branch_id: r.branch_id, currency: r.currency, ex_rate: r.ex_rate, original_invoice_id: r.id, invoice_date: new Date().toLocaleDateString('sv-SE'), notes: `Credit note against ${r.invoice_no}`, children: { lines: full.children.lines.map((l: any) => ({ charge_code_id: l.charge_code_id, description: l.description, qty: l.qty, rate: l.rate, vat_code_id: l.vat_code_id })) } }); h.nav(`/e/invoices/${cn.id}`) } catch (e: any) { h.toast.error(e.message) } } },
    { key: 'conv', label: 'Convert to tax invoice', tone: 'violet', show: (r, h) => r.doc_type === 'Proforma Invoice' && r.status !== 'Void' && h.can('finance', 'create'), run: async h => { try { const n = await post<any>(`/api/invoices/${h.rec.id}/convert-proforma`); h.toast.ok('Draft tax invoice created'); h.nav(`/e/invoices/${n.id}`) } catch (e: any) { h.toast.error(e.message) } } },
    { key: 'einv', label: 'E-invoice XML (PINT AE)', tone: 'outline', more: true, show: (r, h) => r.status !== 'Draft' && r.status !== 'Void' && r.doc_type !== 'Proforma Invoice' && h.can('finance', 'export'), run: h => { window.location.href = `/api/invoices/${h.rec.id}/einvoice.xml` } },
    { key: 'einvsub', label: 'Submit e-invoice to provider', tone: 'outline', more: true, show: (r, h) => r.status !== 'Draft' && r.status !== 'Void' && r.doc_type !== 'Proforma Invoice' && h.can('finance', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Submit e-invoice?', message: `Sends ${h.rec.invoice_no} as UBL (PINT AE) to your accredited service provider.`, ok: 'Submit' })) await run(h, () => post(`/api/invoices/${h.rec.id}/einvoice/submit`), 'E-invoice submitted') } },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h) && !(r.paid_amount > 0 && r.doc_type !== 'Credit Note'), run: async h => { const reason = await h.dlg.prompt({ title: 'Void document', label: 'Reason', required: true, message: 'The ledger entry is reversed and linked job charges become unbilled again.', ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/invoices/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  bills: [
    { key: 'req', label: 'Request approval', tone: 'orange', show: (r, h) => r.status === 'Draft' && r.approval_status === 'Not required' && h.can('finance', 'edit'), run: h => run(h, () => post(`/api/approvals/bills/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.approval_status === 'Pending' && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/approvals/bills/${h.rec.id}/approve`), 'Approved') },
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: async h => { if (await h.dlg.confirm({ title: 'Post vendor bill?', message: 'Creates the payable and expense entries in the ledger.', ok: 'Post' })) await run(h, () => post(`/api/finance/bills/${h.rec.id}/post`), 'Posted') } },
    { key: 'pay', label: 'Pay', tone: 'violet', show: (r, h) => ['Posted', 'Partially paid'].includes(r.status) && r.balance > 0 && h.can('finance', 'create'), run: h => h.dialog('pay', { kind: 'payment', doc: h.rec }) },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h) && !(r.paid_amount > 0), run: async h => { const reason = await h.dlg.prompt({ title: 'Void bill', label: 'Reason', required: true, ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/bills/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  receipts: [
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: h => run(h, () => post(`/api/finance/receipts/${h.rec.id}/post`), 'Receipt posted') },
    { key: 'alloc', label: 'Allocate on-account balance', tone: 'violet', show: (r, h) => r.status === 'Posted' && r.unallocated > 0 && fin(h), run: h => h.dialog('allocate', { kind: 'receipt', rec: h.rec }) },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h), run: async h => { const reason = await h.dlg.prompt({ title: 'Void receipt', label: 'Reason', required: true, ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/receipts/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  payments: [
    { key: 'req', label: 'Request approval', tone: 'orange', show: (r, h) => r.status === 'Draft' && r.approval_status === 'Not required' && h.can('finance', 'edit'), run: h => run(h, () => post(`/api/approvals/payments/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.approval_status === 'Pending' && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/approvals/payments/${h.rec.id}/approve`), 'Approved') },
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: h => run(h, () => post(`/api/finance/payments/${h.rec.id}/post`), 'Payment posted') },
    { key: 'alloc', label: 'Allocate advance', tone: 'violet', show: (r, h) => r.status === 'Posted' && r.unallocated > 0 && fin(h), run: h => h.dialog('allocate', { kind: 'payment', rec: h.rec }) },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h), run: async h => { const reason = await h.dlg.prompt({ title: 'Void payment', label: 'Reason', required: true, ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/payments/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  journal_entries: [
    { key: 'rev', label: 'Reverse entry', tone: 'red', show: (r, h) => r.status === 'Posted' && r.source_type !== 'Reversal' && fin(h), run: async h => { if (await h.dlg.confirm({ title: 'Reverse this journal?', message: 'Posts an equal and opposite entry dated today.', danger: true, ok: 'Reverse' })) await run(h, async () => { const r = await post<any>(`/api/finance/journals/${h.rec.id}/reverse`); h.nav(`/e/journal_entries/${r.reversal_id}`) }, 'Reversed') } },
  ],
  expenses: [
    { key: 'submit', label: 'Submit for approval', tone: 'violet', show: (r, h) => ['Draft', 'Rejected'].includes(r.status) && h.can('finance', 'create'), run: h => run(h, () => post(`/api/finance/expenses/${h.rec.id}/submit`), 'Submitted') },
    { key: 'approve', label: 'Approve', tone: 'green', show: (r, h) => r.status === 'Submitted' && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/finance/expenses/${h.rec.id}/approve`), 'Approved and posted') },
    { key: 'reject', label: 'Reject', tone: 'red', show: (r, h) => r.status === 'Submitted' && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/finance/expenses/${h.rec.id}/reject`), 'Rejected') },
    { key: 'pay', label: 'Mark paid', tone: 'violet', show: (r, h) => r.status === 'Approved' && fin(h), run: h => h.dialog('payExpense', { rec: h.rec }) },
  ],
  quotations: [
    { key: 'req', label: 'Request margin approval', tone: 'orange', show: (r, h) => r.approval_status === 'Pending' && r.status === 'Draft' && h.can('sales', 'edit'), run: h => run(h, () => post(`/api/approvals/quotations/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve margin', tone: 'violet', show: (r, h) => r.approval_status === 'Pending' && h.can('sales', 'approve'), run: h => run(h, () => post(`/api/approvals/quotations/${h.rec.id}/approve`), 'Approved') },
    { key: 'send', label: 'Send to customer', tone: 'green', show: (r, h) => ['Draft', 'Approved', 'Sent'].includes(r.status) && !['Pending', 'Rejected'].includes(r.approval_status) && h.can('sales', 'edit'), run: async h => { const to = await h.dlg.prompt({ title: 'Send quotation', label: 'Send to (leave blank for the customer contact)', initial: '', ok: 'Queue e-mail', message: 'The e-mail is queued in the outbox and delivered when SMTP is configured.' }); if (to === null) return; await run(h, () => post(`/api/quotes/${h.rec.id}/send`, to ? { to } : {}), 'Quotation queued for sending') } },
    { key: 'accept', label: 'Mark accepted', tone: 'violet', show: (r, h) => ['Sent', 'Approved'].includes(r.status) && h.can('sales', 'edit') && !['Pending', 'Rejected'].includes(r.approval_status), run: h => run(h, () => post(`/api/quotes/${h.rec.id}/accept`), 'Accepted') },
    { key: 'convert', label: 'Convert to job', tone: 'blue', show: (r, h) => !r.job_id && ['Sent', 'Approved', 'Accepted'].includes(r.status) && h.can('jobs', 'create'), run: async h => { try { const j = await post<any>(`/api/quotes/${h.rec.id}/convert`); h.toast.ok(`Job ${j.job_no} created`); h.nav(`/jobs/${j.id}`) } catch (e: any) { h.toast.error(e.message) } } },
    { key: 'lost', label: 'Mark lost', tone: 'red', more: true, show: (r, h) => ['Sent', 'Approved', 'Draft'].includes(r.status) && h.can('sales', 'edit'), run: async h => { const reason = await h.dlg.prompt({ title: 'Quotation lost / rejected', label: 'Reason (optional)', ok: 'Mark lost' }); if (reason !== null) await run(h, () => post(`/api/quotes/${h.rec.id}/reject`, { reason }), 'Marked as rejected') } },
    { key: 'rev', label: 'New revision', tone: 'outline', more: true, show: (_r, h) => h.can('sales', 'create'), run: async h => { try { const n = await post<any>(`/api/quotes/${h.rec.id}/revise`); h.nav(`/e/quotations/${n.id}`) } catch (e: any) { h.toast.error(e.message) } } },
  ],
  leads: [{ key: 'convert', label: 'Convert to customer', tone: 'green', show: (r, h) => r.status !== 'Converted' && h.can('crm', 'create'), run: async h => { try { const r = await post<any>(`/api/leads/${h.rec.id}/convert`); h.toast.ok('Converted to customer and opportunity'); h.nav(`/e/parties/${r.party.id}`) } catch (e: any) { h.toast.error(e.message) } } }],
  opportunities: [{ key: 'quote', label: 'Create quotation', tone: 'green', show: (r, h) => !['Won', 'Lost'].includes(r.stage) && h.can('sales', 'create'), run: async h => { try { const qt = await post<any>(`/api/opportunities/${h.rec.id}/quote`); h.nav(`/e/quotations/${qt.id}`) } catch (e: any) { h.toast.error(e.message) } } }],
  grns: [
    { key: 'post', label: 'Post receipt', tone: 'green', show: (r, h) => r.status === 'Draft' && h.can('warehouse', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Post goods receipt?', message: 'Stock is added to the owner\'s balance in the selected bins.', ok: 'Post' })) await run(h, () => post(`/api/warehouse/grns/${h.rec.id}/post`), 'Stock received') } },
    { key: 'cancel', label: 'Cancel', tone: 'red', more: true, show: (r, h) => r.status !== 'Cancelled' && h.can('warehouse', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Cancel this receipt?', message: 'Any posted stock is reversed (only possible if it has not been moved or dispatched).', danger: true, ok: 'Cancel receipt' })) await run(h, () => post(`/api/warehouse/grns/${h.rec.id}/cancel`), 'Cancelled') } },
  ],
  dispatches: [
    { key: 'post', label: 'Post dispatch', tone: 'green', show: (r, h) => r.status === 'Draft' && h.can('warehouse', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Post dispatch?', message: 'Stock is issued first-expiry-first-out unless a lot / bin is specified.', ok: 'Post' })) await run(h, () => post(`/api/warehouse/dispatches/${h.rec.id}/post`), 'Stock dispatched') } },
    { key: 'cancel', label: 'Cancel', tone: 'red', more: true, show: (r, h) => r.status !== 'Cancelled' && h.can('warehouse', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Cancel this dispatch?', message: 'Issued stock is returned to the bins.', danger: true, ok: 'Cancel dispatch' })) await run(h, () => post(`/api/warehouse/dispatches/${h.rec.id}/cancel`), 'Cancelled') } },
  ],
  leave_requests: [
    { key: 'approve', label: 'Approve', tone: 'green', show: (r, h) => r.status === 'Pending' && h.can('hr', 'approve'), run: h => run(h, () => post(`/api/hr/leave/${h.rec.id}/approve`), 'Approved') },
    { key: 'reject', label: 'Reject', tone: 'red', show: (r, h) => r.status === 'Pending' && h.can('hr', 'approve'), run: h => run(h, () => post(`/api/hr/leave/${h.rec.id}/reject`), 'Rejected') },
    { key: 'cancel', label: 'Cancel leave', tone: 'outline', more: true, show: (r, h) => ['Pending', 'Approved'].includes(r.status) && h.can('hr', 'approve'), run: h => run(h, () => post(`/api/hr/leave/${h.rec.id}/cancel`), 'Cancelled') },
  ],
  purchase_orders: [
    { key: 'req', label: 'Request approval', tone: 'orange', show: (r, h) => r.status === 'Draft' && h.can('assets', 'edit'), run: h => run(h, () => post(`/api/approvals/purchase_orders/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.status === 'Pending approval' && h.can('assets', 'approve'), run: h => run(h, () => post(`/api/approvals/purchase_orders/${h.rec.id}/approve`), 'Approved') },
    { key: 'order', label: 'Mark ordered', tone: 'green', show: (r, h) => r.status === 'Approved' && h.can('assets', 'edit'), run: h => run(h, () => put(`/api/e/purchase_orders/${h.rec.id}`, { status: 'Ordered', version: h.rec.version }), 'Marked as ordered') },
    { key: 'recv', label: 'Mark received', tone: 'violet', show: (r, h) => r.status === 'Ordered' && h.can('assets', 'edit'), run: h => run(h, () => put(`/api/e/purchase_orders/${h.rec.id}`, { status: 'Received', version: h.rec.version }), 'Marked as received') },
  ],
  tickets: [{ key: 'resolve', label: 'Resolve', tone: 'green', show: (r, h) => !['Resolved', 'Closed'].includes(r.status) && h.can('support', 'edit'), run: async h => { const res = await h.dlg.prompt({ title: 'Resolve ticket', label: 'Resolution / root cause', required: true, multiline: true, ok: 'Resolve' }); if (res) await run(h, () => put(`/api/e/tickets/${h.rec.id}`, { status: 'Resolved', resolution: res, version: h.rec.version }), 'Ticket resolved') } }],
  tasks: [{ key: 'done', label: 'Mark done', tone: 'green', show: r => r.status !== 'Done', run: h => run(h, () => put(`/api/e/tasks/${h.rec.id}`, { status: 'Done', version: h.rec.version }), 'Done') }],
  payslips: [
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.status === 'Draft' && h.can('hr', 'edit'), run: h => run(h, () => put(`/api/e/payslips/${h.rec.id}`, { status: 'Approved', version: h.rec.version }), 'Approved') },
    { key: 'paid', label: 'Mark paid', tone: 'green', show: (r, h) => r.status === 'Approved' && h.can('hr', 'edit'), run: h => run(h, () => put(`/api/e/payslips/${h.rec.id}`, { status: 'Paid', version: h.rec.version }), 'Marked as paid') },
  ],
  bank_transactions: [{ key: 'rec', label: 'Reconcile…', tone: 'green', show: r => r.status === 'Unreconciled', run: h => h.dialog('reconcile', { txn: h.rec }) }, { key: 'undo', label: 'Un-reconcile', tone: 'outline', show: r => r.status === 'Reconciled', run: h => run(h, () => post('/api/finance/bank/reconcile', { txn_id: h.rec.id, undo: true }), 'Reopened') }],
  transport_orders: [{ key: 'pod', label: 'Capture POD', tone: 'green', show: (r, h) => !['POD received', 'Cancelled'].includes(r.status) && h.can('transport', 'edit'), run: h => h.dialog('pod', { order: h.rec }) }],
  customs_declarations: [
    { key: 'gw', label: 'Submit to customs gateway', tone: 'violet', show: (r, h) => ['Draft', 'Query raised'].includes(r.status) && h.can('customs', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Submit declaration?', message: 'Sends this declaration to the configured customs gateway / broker API.', ok: 'Submit' })) await run(h, async () => { const r = await post<any>(`/api/customs/${h.rec.id}/submit`); h.toast.ok(r.message) }, 'Submitted') } },
    { key: 'json', label: 'Export JSON for broker', tone: 'outline', more: true, show: () => true, run: h => { window.open(`/api/e/customs_declarations/${h.rec.id}`, '_blank') } },
  ],
  users: [
    { key: 'unlock', label: 'Unlock account', tone: 'outline', more: true, show: (_r, h) => h.can('admin', 'edit'), run: h => run(h, () => post(`/api/admin/users/${h.rec.id}/unlock`), 'Unlocked') },
    { key: 'signout', label: 'Sign out everywhere', tone: 'outline', more: true, show: (_r, h) => h.can('admin', 'edit'), run: h => run(h, () => post(`/api/admin/users/${h.rec.id}/sign-out`), 'Sessions ended') },
    { key: 'reset2fa', label: 'Reset 2-step verification', tone: 'outline', more: true, show: (_r, h) => h.can('admin', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Reset 2-step verification?', message: 'The user will sign in with password only until they enable it again.', danger: true, ok: 'Reset' })) await run(h, () => post(`/api/admin/users/${h.rec.id}/reset-2fa`), '2-step verification reset') } },
  ],
  parties: [
    { key: 'job', label: 'New job', tone: 'violet', show: (r, h) => r.is_customer && h.can('jobs', 'create'), run: h => h.nav(`/e/jobs?new=1&client_id=${h.rec.id}`) },
    { key: 'quote', label: 'New quotation', tone: 'outline', show: (r, h) => r.is_customer && h.can('sales', 'create'), run: h => h.nav(`/e/quotations?new=1&customer_id=${h.rec.id}`) },
    { key: 'stmt', label: 'Statement of account', tone: 'outline', show: (_r, h) => h.can('finance', 'view'), run: h => h.nav(`/print/statement/${h.rec.id}`) },
  ],
}

export const PRINTABLE = new Set(['invoices', 'quotations', 'delivery_orders', 'receipts', 'payments', 'grns', 'dispatches', 'transport_orders', 'shipments', 'customs_declarations', 'payslips', 'purchase_orders', 'insurance_certs', 'parties'])
export const RELATED: Record<string, { key: string; label: string; entity: string; field: string }[]> = {
  parties: [
    { key: 'contacts', label: 'Contacts', entity: 'contacts', field: 'party_id' }, { key: 'jobs', label: 'Jobs', entity: 'jobs', field: 'client_id' }, { key: 'quotes', label: 'Quotations', entity: 'quotations', field: 'customer_id' },
    { key: 'invoices', label: 'Invoices', entity: 'invoices', field: 'party_id' }, { key: 'receipts', label: 'Receipts', entity: 'receipts', field: 'party_id' }, { key: 'bills', label: 'Vendor bills', entity: 'bills', field: 'vendor_id' },
    { key: 'opps', label: 'Opportunities', entity: 'opportunities', field: 'party_id' }, { key: 'acts', label: 'Calls & activities', entity: 'activities', field: 'party_id' }, { key: 'tickets', label: 'Tickets', entity: 'tickets', field: 'customer_id' },
    { key: 'contracts', label: 'Contracts', entity: 'contracts', field: 'party_id' }, { key: 'items', label: 'Stock items', entity: 'items', field: 'customer_id' },
  ],
  vehicles: [{ key: 'trips', label: 'Trips', entity: 'transport_orders', field: 'vehicle_id' }, { key: 'fuel', label: 'Fuel', entity: 'fuel_logs', field: 'vehicle_id' }, { key: 'svc', label: 'Maintenance', entity: 'vehicle_services', field: 'vehicle_id' }],
  drivers: [{ key: 'trips', label: 'Trips', entity: 'transport_orders', field: 'driver_id' }],
  employees: [{ key: 'leave', label: 'Leave', entity: 'leave_requests', field: 'employee_id' }, { key: 'att', label: 'Attendance', entity: 'attendance', field: 'employee_id' }, { key: 'pay', label: 'Payslips', entity: 'payslips', field: 'employee_id' }, { key: 'exp', label: 'Expense claims', entity: 'expenses', field: 'employee_id' }],
  warehouses: [{ key: 'bins', label: 'Bins', entity: 'wh_locations', field: 'warehouse_id' }, { key: 'grns', label: 'Receipts', entity: 'grns', field: 'warehouse_id' }, { key: 'dsp', label: 'Dispatches', entity: 'dispatches', field: 'warehouse_id' }],
  items: [{ key: 'ledger', label: 'Stock ledger', entity: 'stock_moves', field: 'item_id' }],
  carriers: [{ key: 'jobs', label: 'Jobs', entity: 'jobs', field: 'carrier_id' }, { key: 'bookings', label: 'Bookings', entity: 'bookings', field: 'carrier_id' }],
  branches: [{ key: 'jobs', label: 'Jobs', entity: 'jobs', field: 'branch_id' }],
  campaigns: [{ key: 'leads', label: 'Leads', entity: 'leads', field: 'campaign_id' }],
  opportunities: [{ key: 'quotes', label: 'Quotations', entity: 'quotations', field: 'opportunity_id' }],
  projects: [{ key: 'tasks', label: 'Tasks', entity: 'tasks', field: 'project_id' }],
}
