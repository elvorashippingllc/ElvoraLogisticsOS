import type { EntityDef } from '../types'
import { T, TA, R, S, D, N, M, B, CURRENCIES_COMMON } from '../dsl'
const CURRENCIES = CURRENCIES_COMMON.filter(c => !['KES', 'PKR'].includes(c))
export const VENDOR_SERVICE_COMMERCIAL = ['job_id', 'vendor_id', 'service_type', 'description', 'charge_code_id', 'buy_basis', 'buy_qty', 'buy_rate', 'buy_currency', 'buy_ex_rate', 'buy_vat_code_id', 'sell_basis', 'sell_qty', 'sell_rate', 'sell_currency', 'sell_ex_rate', 'sell_vat_code_id', 'purchase_order_id', 'transport_order_id', 'return_required', 'terms']

export const vendorServices: EntityDef[] = [{
  key: 'vendor_services', label: 'Vendor service', plural: 'Vendor services & hired equipment', module: 'jobs', icon: 'Truck', title: ['service_no'], panel: true, noDelete: true, statusField: 'status',
  numbering: { field: 'service_no', pattern: 'VS{YY}{MM}{seq:5}' },
  description: 'Buy a service from a vendor and provide it to your customer. Record one agreed service or hire per row; confirm it to add vendor cost and customer revenue to the job.',
  fields: [
    T('service_no', 'Service order', { readonly: true, list: true, search: true, section: 'Job and supplier' }),
    R('job_id', 'Customer job', 'jobs', { required: true, list: true }), R('branch_id', 'Branch', 'branches', { readonly: true, hidden: true }),
    R('vendor_id', 'Vendor / supplier', 'parties', { required: true, refFilter: { is_vendor: 1 }, list: true }),
    S('service_type', 'Service / equipment', ['Container hire', 'Truck hire', 'Trailer hire', 'Transport service', 'Forklift / crane', 'Warehouse / storage', 'Customs clearance', 'Other service'], { required: true, list: true }),
    T('description', 'Service description', { required: true, list: true, search: true, span: 2 }), T('vendor_reference', 'Vendor quotation / booking reference', { search: true }),
    R('purchase_order_id', 'Approved purchase order (optional)', 'purchase_orders'), R('transport_order_id', 'Transport trip (optional)', 'transport_orders'),
    S('status', 'Status', ['Draft', 'Confirmed', 'In use', 'Completed', 'Returned', 'Cancelled'], { default: 'Draft', list: true, help: 'Save a Draft, then use Confirm and add job charges. Update to In use, Completed and Returned as work progresses.' }),
    T('equipment_no', 'Container / truck plate / trailer number', { list: true, search: true, section: 'Equipment and execution' }), T('equipment_spec', 'Size / type / capacity', { help: 'For example: 40ft high cube, 10-ton truck, 40ft flatbed.' }),
    T('driver_name', 'Vendor driver / operator'), T('driver_phone', 'Driver phone'), T('pickup_location', 'Collection / origin'), T('delivery_location', 'Delivery / destination'),
    D('start_date', 'Service / hire starts', { required: true, default: 'today', list: true }), D('end_date', 'Service / hire ends'),
    B('return_required', 'Equipment must be returned', { default: false, help: 'Enable for hired equipment; required for container, truck and trailer hire.' }), D('return_due', 'Return due', { list: true }), D('returned_on', 'Actual return date'),
    T('completion_reference', 'POD / completion / return reference', { help: 'Attach the proof in Files and record its reference here.' }),
    R('charge_code_id', 'Accounting charge code', 'charge_codes', { required: true, section: 'Vendor buying price' }),
    S('buy_basis', 'Vendor charging basis', ['Trip', 'Day', 'Hour', 'Month', 'Container', 'Unit', 'Lump sum'], { default: 'Trip', required: true }), N('buy_qty', 'Vendor quantity', { default: 1, min: 0.000001, required: true }), M('buy_rate', 'Vendor rate before tax', { required: true, min: 0 }),
    S('buy_currency', 'Vendor currency', CURRENCIES, { default: 'AED', required: true }), N('buy_ex_rate', 'Vendor exchange rate', { default: 1, min: 0.000001 }), R('buy_vat_code_id', 'Vendor tax code', 'vat_codes', { required: true }),
    M('buy_amount', 'Vendor amount before tax', { computed: true, list: true }),
    S('sell_basis', 'Customer charging basis', ['Trip', 'Day', 'Hour', 'Month', 'Container', 'Unit', 'Lump sum'], { default: 'Trip', required: true, section: 'Customer selling price' }), N('sell_qty', 'Customer quantity', { default: 1, min: 0.000001, required: true }), M('sell_rate', 'Customer rate before tax', { required: true, min: 0 }),
    S('sell_currency', 'Customer currency', CURRENCIES, { default: 'AED', required: true }), N('sell_ex_rate', 'Customer exchange rate', { default: 1, min: 0.000001 }), R('sell_vat_code_id', 'Customer tax code', 'vat_codes', { required: true }),
    M('sell_amount', 'Customer amount before tax', { computed: true, list: true }), M('margin_base', 'Expected profit in base currency', { computed: true, list: true }),
    B('charges_created', 'Added to job accounting', { readonly: true, default: false, list: true }), TA('terms', 'Vendor agreement / inclusions / exclusions', { help: 'Record fuel, tolls, waiting, overtime, free days, damage terms and payment terms. Add extra agreed charges as separate services.' }), TA('notes', 'Internal notes'),
  ],
}]
