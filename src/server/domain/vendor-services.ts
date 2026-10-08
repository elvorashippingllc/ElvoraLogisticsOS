import { q, tx } from '../db'
import { assertCan, audit, getDef, getRecord, insertRow, patchRecord, type Ctx } from '../engine'
import type { Hooks } from '../hooks'
import { bad, r2 } from '../util'
import { fxRate } from './accounting'
import { recomputeJobTotals } from './jobs'
import { VENDOR_SERVICE_COMMERCIAL } from '../../shared/entities/vendor-services'

export const vendorServiceHooks: Hooks = {
  beforeSave({ rec, old, ctx, isNew }) {
    const job = getRecord(getDef('jobs'), rec.job_id, ctx, { children: false })
    if (['CLOSED', 'CANCELLED'].includes(job.job_status)) throw bad('Reopen the job before changing vendor services')
    rec.branch_id = job.branch_id
    const vendor = getRecord(getDef('parties'), rec.vendor_id, ctx, { children: false })
    if ((isNew || old?.vendor_id !== rec.vendor_id || ctx.vendorServiceTransition === 'confirm') && (!vendor.is_vendor || ['Blocked', 'Inactive', 'On hold'].includes(vendor.status))) throw bad('Choose an active party marked as a vendor / supplier')
    if (['Container hire', 'Truck hire', 'Trailer hire'].includes(rec.service_type)) rec.return_required = true
    if (old?.charges_created && VENDOR_SERVICE_COMMERCIAL.some(f => JSON.stringify(rec[f] ?? null) !== JSON.stringify(old[f] ?? null))) throw bad('Buying and selling details are locked. Reset an unbilled service to draft before changing them.')
    if (isNew && rec.status !== 'Draft') throw bad('Create a draft service first')
    if (old && rec.status !== old.status) {
      const allowed: Record<string, string[]> = { Draft: ['Cancelled'], Confirmed: ['In use', 'Completed'], 'In use': ['Completed'], Completed: ['Returned'], Returned: [], Cancelled: [] }
      if (!(ctx.vendorServiceTransition === 'confirm' && old.status === 'Draft' && rec.status === 'Confirmed') && !(ctx.vendorServiceTransition === 'reset' && rec.status === 'Draft') && !allowed[old.status]?.includes(rec.status)) throw bad('Use Confirm and add job charges, or Reset to draft, for this change')
    }
    if (rec.end_date && rec.end_date < rec.start_date) throw bad('Hire end cannot be before its start')
    if (rec.return_due && rec.return_due < rec.start_date) throw bad('Return due cannot be before hire starts')
    if (rec.returned_on && rec.returned_on < rec.start_date) throw bad('Return date cannot be before hire starts')
    if (rec.return_required && rec.status !== 'Draft' && rec.status !== 'Cancelled' && !rec.return_due) throw bad('Enter the equipment return due date')
    if (rec.status === 'In use' && rec.return_required && !String(rec.equipment_no ?? '').trim()) throw bad('Record the container, truck plate or trailer number before use')
    if (['Completed', 'Returned'].includes(rec.status) && !String(rec.completion_reference ?? '').trim()) throw bad('Record the POD, service completion or return reference')
    if (rec.status === 'Returned' && (!rec.return_required || !rec.returned_on)) throw bad('Record the actual return date for hired equipment')
    if (rec.status === 'In use' && rec.equipment_no && q.val(`SELECT id FROM vendor_services WHERE vendor_id=? AND lower(equipment_no)=lower(?) AND status='In use' AND id<>? AND deleted_at IS NULL`, rec.vendor_id, rec.equipment_no, rec.id ?? 0)) throw bad('This vendor equipment is already in use on another service')
    if (rec.purchase_order_id && (!old?.charges_created || ctx.vendorServiceTransition === 'confirm')) {
      const po = getRecord(getDef('purchase_orders'), rec.purchase_order_id, ctx, { children: false })
      if (po.vendor_id !== rec.vendor_id || !['Approved', 'Ordered', 'Received'].includes(po.status)) throw bad('The linked purchase order must be approved and belong to this vendor')
    }
    if (rec.transport_order_id) {
      const trip = getRecord(getDef('transport_orders'), rec.transport_order_id, ctx, { children: false })
      if (trip.job_id !== rec.job_id || trip.customer_id !== job.client_id || (trip.subcontractor_id && trip.subcontractor_id !== rec.vendor_id)) throw bad('The linked trip must belong to this job, customer and vendor')
    }
    for (const side of ['buy', 'sell']) {
      if (!Number.isFinite(rec[side + '_qty']) || rec[side + '_qty'] <= 0 || !Number.isFinite(rec[side + '_rate']) || rec[side + '_rate'] < 0) throw bad('Quantities must be positive and rates cannot be negative')
      rec[side + '_rate'] = r2(rec[side + '_rate'])
      rec[side + '_ex_rate'] = fxRate(rec[side + '_currency'], rec[side + '_ex_rate'])
      rec[side + '_amount'] = r2(rec[side + '_qty'] * rec[side + '_rate'])
    }
    rec.margin_base = r2(rec.sell_amount * rec.sell_ex_rate - rec.buy_amount * rec.buy_ex_rate)
  },
}

/** Creates operational job charges only. Invoice/bill posting and payment approvals remain separate. */
export function confirmVendorService(id: number, ctx: Ctx) {
  return tx(() => {
    assertCan(ctx, 'jobs', 'edit'); assertCan(ctx, 'finance', 'create')
    const def = getDef('vendor_services')
    let service = getRecord(def, id, ctx)
    if (service.status !== 'Draft' || service.charges_created) throw bad('Only an unconfirmed draft can add job charges')
    const job = getRecord(getDef('jobs'), service.job_id, ctx)
    if (q.run("UPDATE vendor_services SET charges_created=1 WHERE id=? AND status='Draft' AND charges_created=0 AND version=?", id, service.version).changes !== 1) throw bad('This service changed or was already confirmed. Reload it.')
    // Hook validation occurs before any charges are written; transaction rolls back on failure.
    patchRecord(def, id, { status: 'Confirmed' }, { ...ctx, vendorServiceTransition: 'confirm' })
    service = getRecord(def, id, ctx)
    for (const side of ['buy', 'sell']) {
      const amount = service[side + '_amount'], tax = q.val<number>('SELECT rate FROM vat_codes WHERE id=? AND deleted_at IS NULL', service[side + '_vat_code_id'])
      if (tax === undefined) throw bad('Choose a valid tax code')
      insertRow(getDef('job_charges'), {
        job_id: job.id, vendor_service_id: id, kind: side === 'buy' ? 'Cost' : 'Revenue', charge_code_id: service.charge_code_id,
        description: `${service.service_no} · ${service.description}`, party_id: side === 'buy' ? service.vendor_id : job.client_id,
        basis: service[side + '_basis'], qty: service[side + '_qty'], rate: service[side + '_rate'], currency: service[side + '_currency'], ex_rate: service[side + '_ex_rate'],
        vat_code_id: service[side + '_vat_code_id'], vat_pct: tax, amount, vat_amount: r2(amount * tax / 100), base_amount: r2(amount * service[side + '_ex_rate']), status: 'Unbilled',
      }, ctx)
    }
    recomputeJobTotals(job.id)
    patchRecord(getDef('jobs'), job.id, {}, ctx)
    audit(ctx, def, id, 'confirm_service', { job_id: job.id }, service.service_no)
    return getRecord(def, id, ctx)
  })
}

export function resetVendorService(id: number, ctx: Ctx) {
  return tx(() => {
    assertCan(ctx, 'jobs', 'edit'); assertCan(ctx, 'finance', 'edit')
    const def = getDef('vendor_services'), service = getRecord(def, id, ctx)
    if (service.status !== 'Confirmed' || !service.charges_created) throw bad('Only a confirmed service that has not started can be reset')
    const charges = q.all('SELECT id,status FROM job_charges WHERE vendor_service_id=? AND deleted_at IS NULL', id)
    for (const c of charges) if (c.status !== 'Unbilled' || q.val('SELECT id FROM invoice_lines WHERE job_charge_id=? AND deleted_at IS NULL', c.id) || q.val('SELECT id FROM bill_lines WHERE job_charge_id=? AND deleted_at IS NULL', c.id)) throw bad('This service is referenced by an invoice or bill. Resolve the financial document before resetting.')
    if (q.run("UPDATE vendor_services SET charges_created=0 WHERE id=? AND status='Confirmed' AND charges_created=1 AND version=?", id, service.version).changes !== 1) throw bad('This service changed or was already reset. Reload it.')
    patchRecord(def, id, { status: 'Draft' }, { ...ctx, vendorServiceTransition: 'reset' })
    q.run('DELETE FROM job_charges WHERE vendor_service_id=?', id)
    recomputeJobTotals(service.job_id)
    patchRecord(getDef('jobs'), service.job_id, {}, ctx)
    audit(ctx, def, id, 'reset_service', { removed_charge_ids: charges.map(c => c.id) }, service.service_no)
    return getRecord(def, id, ctx)
  })
}
