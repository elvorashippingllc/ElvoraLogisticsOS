import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, S, R, D, DT } from '../dsl'
import { INCOTERMS, PACKAGE_TYPES } from './masters'

export const JOB_DEPARTMENTS = ['FCL EXPORT', 'FCL IMPORT', 'LCL EXPORT', 'LCL IMPORT', 'AIR EXPORT', 'AIR IMPORT', 'ROAD EXPORT', 'ROAD IMPORT', 'CUSTOMS CLEARANCE', 'WAREHOUSING', 'PROJECT CARGO', 'CROSS TRADE', 'COURIER']
export const JOB_STATUS = ['OPENED', 'IN PROGRESS', 'ON HOLD', 'DELIVERED', 'CLOSED', 'CANCELLED']
export const BL_STATUS = ['PENDING', 'CREATED', 'DRAFT APPROVED', 'ISSUED', 'SURRENDERED', 'RELEASED', 'NOT REQUIRED']
export const OPERATIONAL_STATUS = ['BOOKING REQUESTED', 'BOOKING CONFIRMED', 'CARGO RECEIVED', 'DOCUMENTS PENDING', 'CUSTOMS CLEARED', 'STUFFED / LOADED', 'GATE-IN', 'DEPARTED', 'IN TRANSIT', 'ARRIVED', 'DISCHARGED', 'OUT FOR DELIVERY', 'DELIVERED', 'EMPTY RETURNED']
export const EVENT_TYPES = [
  'Booking confirmed', 'Cargo received', 'Container released / picked up', 'Stuffing completed', 'Gate-in at port', 'Export customs cleared', 'Loaded on vessel', 'Vessel departed',
  'Transhipment arrival', 'Transhipment departure', 'Vessel arrived', 'Discharged', 'Import customs cleared', 'Container gate-out', 'Out for delivery', 'Delivered', 'Empty returned',
  'DO released', 'Documents sent', 'B/L issued', 'Flight departed', 'Flight arrived', 'POD received', 'Delay', 'Exception / hold', 'Note',
]
export const SERVICE_TYPES = ['Port to Port', 'Door to Door', 'Door to Port', 'Port to Door', 'Warehouse to Warehouse']

export const ops: EntityDef[] = [
  {
    key: 'jobs', label: 'Master Job', plural: 'Master Jobs', module: 'jobs', icon: 'Briefcase', title: ['job_no'], panel: true, statusField: 'job_status', print: 'job',
    numbering: { field: 'job_no', pattern: '{branch}{MM}{YY}{seq:4}' }, customFields: true, noDelete: true,
    children: [
      { key: 'containers', label: 'Containers', entity: 'job_containers', fk: 'job_id' },
      { key: 'cargo', label: 'Cargo', entity: 'job_cargo', fk: 'job_id' },
      { key: 'legs', label: 'Routing', entity: 'job_legs', fk: 'job_id' },
      { key: 'events', label: 'Track & Trace', entity: 'job_events', fk: 'job_id' },
      { key: 'charges', label: 'Accounting', entity: 'job_charges', fk: 'job_id', columns: ['kind', 'charge_code_id', 'description', 'party_id', 'qty', 'rate', 'currency', 'ex_rate', 'vat_code_id', 'amount', 'status'] },
    ],
    // Field order follows the three-column "Job Info" screen: col 1, col 2, col 3 per row.
    fields: [
      R('client_id', 'Client', 'parties', { required: true, refFilter: { is_customer: 1 }, list: true, search: true, section: 'Job Info', key: true }),
      R('branch_id', 'Branch', 'branches', { required: true, list: true }),
      S('department', 'Department', JOB_DEPARTMENTS, { required: true, list: true, key: true }),
      T('job_no', 'Job No.', { readonly: true, list: true, search: true, key: true }),
      D('job_date', 'Job Date', { required: true, default: 'today', list: true }),
      S('job_status', 'Job Status', JOB_STATUS, { default: 'OPENED', list: true, key: true }),
      T('mbl_no', 'MBL / MAWB No.', { list: true, search: true }), D('mbl_date', 'MBL Date'), S('bl_status', 'B/L Status', BL_STATUS, { default: 'PENDING', list: true }),
      T('hbl_no', 'HBL / HAWB No.', { list: true, search: true }), D('hbl_date', 'HBL Date'), T('bl_place_of_issue', 'B/L Place of Issue'),
      R('carrier_id', 'Carrier', 'carriers', { list: true }), T('vessel_name', 'Vessel Name / Flight'), T('voyage_no', 'Voyage / Flight No.'),
      T('booking_no', 'Carrier booking no.', { list: true, search: true }), T('vessel_id', 'Vessel ID (IMO)'), T('scn_no', 'SCN No.'),
      T('place_of_receipt', 'Place of Receipt'), R('por_id', 'POR', 'locations'), R('pol_id', 'POL', 'locations', { list: true }),
      R('pod_id', 'POD', 'locations', { list: true }), R('pof_id', 'POF', 'locations'), T('place_of_delivery', 'Place of Delivery'),
      S('trade', 'Export / Import', ['Export', 'Import', 'Cross trade', 'Domestic'], { default: 'Export', required: true }), DT('etd', 'ETD', { list: true }), DT('atd', 'ATD'),
      DT('eta', 'ETA', { list: true }), DT('ata', 'ATA'), S('service_type', 'Service Type', SERVICE_TYPES),
      S('inco_terms', 'INCO Terms', INCOTERMS, { key: true }), T('do_no', 'DO No.', { readonly: true }), DT('do_date', 'DO Date', { readonly: true }),
      S('freight_terms', 'Freight', ['Prepaid', 'Collect', 'Third party'], { default: 'Prepaid' }), S('is_hazardous', 'Is Hazardous', ['No', 'Yes'], { default: 'No' }), T('sb_no', 'SB No.'),
      T('payable_at', 'Payable At'), T('dispatch_at', 'Dispatch At'), T('boe_no', 'BOE No.'),
      I('no_originals', 'No. of Originals', { default: 3 }), I('no_copies', 'No. of Copies', { default: 1 }), S('is_cross_trade', 'Is Cross Trade', ['No', 'Yes'], { default: 'No' }),
      T('first_original_sent_to', '1st Original Sent To'), T('second_original_sent_to', '2nd Original Sent To'), T('third_original_sent_to', '3rd Original Sent To'),
      TA('handling_info', 'Handling Information', { span: 1 }), TA('accounting_info', 'Accounting Information', { span: 1 }), TA('marks_no', 'Marks & No.', { span: 1 }),
      // parties
      R('shipper_id', 'Shipper', 'parties', { section: 'Parties' }), R('consignee_id', 'Consignee', 'parties'), R('notify_id', 'Notify party', 'parties'),
      R('agent_id', 'Overseas agent', 'parties', { refFilter: { is_agent: 1 } }), R('salesperson_id', 'Salesperson', 'users'), R('operator_id', 'Operations executive', 'users', { default: 'me', list: true }),
      T('customer_ref', 'Customer reference / PO'), R('quote_id', 'Quotation', 'quotations', { readonly: true }),
      // cargo
      T('commodity', 'Commodity', { section: 'Cargo summary', list: true }), I('packages', 'Packages'), S('package_type', 'Package type', PACKAGE_TYPES), N('gross_weight', 'Gross weight (kg)'), N('volume_cbm', 'Volume (CBM)'),
      N('chargeable_weight', 'Chargeable weight (kg)'), T('containers_summary', 'Equipment', { computed: true, list: true }),
      // status & finance
      S('operational_status', 'Operational Status', ['BOOKING REQUESTED', 'BOOKING CONFIRMED', 'CARGO RECEIVED', 'DOCUMENTS PENDING', 'CUSTOMS CLEARED', 'STUFFED / LOADED', 'GATE-IN', 'DEPARTED', 'IN TRANSIT', 'ARRIVED', 'DISCHARGED', 'OUT FOR DELIVERY', 'DELIVERED', 'EMPTY RETURNED'], { section: 'Status & profit', list: true, key: true }),
      S('customs_status', 'Customs status', ['Not started', 'Documents received', 'Declaration filed', 'Under assessment', 'Cleared', 'Query']),
      S('mode', 'Mode', ['Sea', 'Air', 'Road', 'Customs', 'Warehouse', 'Other'], { computed: true }),
      M('total_revenue', 'Revenue (AED)', { computed: true, key: true }), M('total_cost', 'Cost (AED)', { computed: true, key: true }), M('profit', 'Profit (AED)', { computed: true, key: true }),
      DT('closed_at', 'Closed at', { readonly: true }), TA('remarks', 'Remarks'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
    calendar: { field: 'etd' },
  },
  {
    key: 'job_containers', label: 'Container', plural: 'Containers', module: 'jobs', icon: 'Container', title: ['container_no'], child: true,
    fields: [
      R('job_id', 'Job', 'jobs', { hidden: true }), T('container_no', 'Container no.', { list: true, search: true, placeholder: 'MSCU1234567' }), R('type_id', 'Type', 'container_types', { list: true }),
      T('seal_no', 'Seal no.', { list: true }), T('line_seal_no', 'Line seal'), N('gross_weight', 'Gross wt (kg)'), N('tare_weight', 'Tare (kg)'), N('vgm_weight', 'VGM (kg)'), I('packages', 'Pkgs'), N('volume_cbm', 'CBM'),
      S('status', 'Status', ['Planned', 'Empty released', 'Stuffed', 'Gated in', 'Loaded', 'Discharged', 'Gated out', 'Delivered', 'Empty returned'], { default: 'Planned', list: true }),
      DT('gate_in_at', 'Gate-in'), DT('gate_out_at', 'Gate-out'), D('free_time_until', 'Free time until'), T('remarks', 'Remarks'),
    ],
  },
  {
    key: 'job_cargo', label: 'Cargo line', plural: 'Cargo lines', module: 'jobs', icon: 'Package', title: ['description'], child: true,
    fields: [
      R('job_id', 'Job', 'jobs', { hidden: true }), T('description', 'Description of goods', { list: true }), R('hs_code_id', 'HS code', 'hs_codes'), I('packages', 'Pkgs', { list: true }), S('package_type', 'Pack type', PACKAGE_TYPES),
      N('gross_weight', 'Gross wt (kg)', { list: true }), N('net_weight', 'Net wt (kg)'), N('volume_cbm', 'CBM', { list: true }), N('length_cm', 'L (cm)'), N('width_cm', 'W (cm)'), N('height_cm', 'H (cm)'),
      T('marks', 'Marks & numbers'), B('is_dg', 'DG'), T('un_no', 'UN no.'), T('dg_class', 'IMO class'), T('container_no', 'Container'),
    ],
  },
  {
    key: 'job_legs', label: 'Route leg', plural: 'Routing', module: 'jobs', icon: 'Route', title: ['id'], child: true,
    fields: [
      R('job_id', 'Job', 'jobs', { hidden: true }), I('seq', 'Leg', { default: 1 }), S('mode', 'Mode', ['Sea', 'Air', 'Road', 'Rail', 'Barge'], { default: 'Sea', list: true }),
      R('from_id', 'From', 'locations', { list: true }), R('to_id', 'To', 'locations', { list: true }), T('carrier', 'Carrier / operator'), T('vessel_flight', 'Vessel / flight / truck'), T('voyage', 'Voyage'),
      DT('etd', 'ETD'), DT('eta', 'ETA'), DT('atd', 'ATD'), DT('ata', 'ATA'), S('status', 'Status', ['Planned', 'In progress', 'Completed', 'Cancelled'], { default: 'Planned' }),
    ],
  },
  {
    key: 'job_events', label: 'Tracking event', plural: 'Track & Trace events', module: 'jobs', icon: 'MapPinned', title: ['event_type'], child: true,
    fields: [
      R('job_id', 'Job', 'jobs', { hidden: true }), DT('event_at', 'Date & time', { default: 'now', required: true, list: true }), S('event_type', 'Milestone', EVENT_TYPES, { required: true, list: true }),
      T('location', 'Location', { list: true }), T('container_no', 'Container / AWB'), T('description', 'Details', { list: true }), S('source', 'Source', ['Manual', 'Carrier', 'Customer', 'Agent', 'System'], { default: 'Manual', list: true }),
      B('visible_to_customer', 'Show to customer', { default: true }), R('user_id', 'Recorded by', 'users', { readonly: true, default: 'me' }),
    ],
  },
  {
    key: 'job_charges', label: 'Job charge', plural: 'Job charges', module: 'jobs', icon: 'Calculator', title: ['description'], child: true,
    fields: [
      R('job_id', 'Job', 'jobs', { hidden: true }), S('kind', 'Type', ['Revenue', 'Cost'], { required: true, default: 'Revenue', list: true }), R('charge_code_id', 'Charge', 'charge_codes', { required: true, list: true }),
      T('description', 'Description', { list: true }), R('party_id', 'Bill to / vendor', 'parties', { list: true }), T('basis', 'Basis'), N('qty', 'Qty', { default: 1, list: true }), M('rate', 'Rate', { list: true }),
      S('currency', 'Cur', ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR', 'CNY', 'ZAR'], { default: 'AED', list: true }), N('ex_rate', 'Ex. rate', { default: 1 }), R('vat_code_id', 'Tax', 'vat_codes'), P('vat_pct', 'VAT %', { hidden: true }),
      M('amount', 'Amount', { computed: true, list: true }), M('vat_amount', 'VAT', { computed: true }), M('base_amount', 'Amount (AED)', { computed: true, hidden: true }),
      R('invoice_id', 'Invoice', 'invoices', { readonly: true }), R('bill_id', 'Bill', 'bills', { readonly: true }), S('status', 'Status', ['Unbilled', 'Invoiced', 'Billed'], { default: 'Unbilled', readonly: true, list: true }),
      R('shipment_id', 'Shipment', 'shipments', { hidden: true }),
    ],
  },
  {
    key: 'shipments', label: 'Shipment (Sub-Job)', plural: 'Shipments (Sub-Jobs)', module: 'jobs', icon: 'PackageCheck', title: ['shipment_no'], panel: true, statusField: 'status', print: 'shipment',
    fields: [
      T('shipment_no', 'Sub-job no.', { readonly: true, list: true, search: true, section: 'Shipment' }), R('job_id', 'Master job', 'jobs', { required: true, list: true }),
      S('status', 'Status', ['Booked', 'Cargo received', 'Loaded', 'In transit', 'Arrived', 'Delivered', 'Cancelled'], { default: 'Booked', list: true }),
      R('shipper_id', 'Shipper', 'parties', { list: true }), R('consignee_id', 'Consignee', 'parties', { list: true }), R('notify_id', 'Notify party', 'parties'),
      T('hbl_no', 'HBL / HAWB No.', { list: true, search: true }), S('freight_terms', 'Freight', ['Prepaid', 'Collect', 'Third party']), T('customer_ref', 'Customer reference'),
      T('commodity', 'Commodity', { list: true }), I('packages', 'Packages'), N('gross_weight', 'Gross weight (kg)'), N('volume_cbm', 'Volume (CBM)'), T('container_no', 'Container no.'),
      DT('delivered_at', 'Delivered at'), B('pod_received', 'POD received'), TA('remarks', 'Remarks'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'bookings', label: 'Booking', plural: 'Carrier bookings', module: 'jobs', icon: 'CalendarCheck', title: ['booking_no'], panel: true, statusField: 'status',
    fields: [
      T('booking_no', 'Booking no.', { required: true, list: true, search: true, section: 'Booking' }), R('job_id', 'Master job', 'jobs', { list: true }), R('carrier_id', 'Carrier', 'carriers', { list: true }),
      S('status', 'Status', ['Requested', 'Confirmed', 'Amended', 'Rolled', 'Cancelled'], { default: 'Requested', list: true }), T('vessel_name', 'Vessel / flight'), T('voyage_no', 'Voyage'),
      R('pol_id', 'POL', 'locations'), R('pod_id', 'POD', 'locations'), DT('etd', 'ETD', { list: true }), DT('eta', 'ETA'),
      DT('doc_cutoff', 'Documents cut-off'), DT('vgm_cutoff', 'VGM cut-off'), DT('gate_cutoff', 'Gate cut-off', { list: true }), T('equipment', 'Equipment', { placeholder: '2 x 40HC', list: true }), D('confirmed_on', 'Confirmed on'),
      R('empty_depot_id', 'Empty pick-up depot', 'locations'), TA('remarks', 'Remarks'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'delivery_orders', label: 'Delivery order', plural: 'Delivery orders', module: 'jobs', icon: 'FileOutput', title: ['do_no'], panel: true, statusField: 'status', print: 'do',
    numbering: { field: 'do_no', pattern: 'DO{YY}{MM}{seq:5}' },
    fields: [
      T('do_no', 'DO no.', { readonly: true, list: true, search: true, section: 'Delivery order' }), R('job_id', 'Master job', 'jobs', { required: true, list: true }), R('shipment_id', 'Shipment', 'shipments'),
      R('issued_to_id', 'Release to', 'parties', { list: true }), D('do_date', 'Date', { default: 'today', list: true }), D('valid_until', 'Valid until', { list: true }),
      S('status', 'Status', ['Draft', 'Issued', 'Released', 'Cancelled'], { default: 'Draft', list: true }), T('release_note', 'Release conditions', { span: 3 }),
      B('freight_cleared', 'Freight & charges cleared'), B('original_bl_received', 'Original B/L received'), TA('remarks', 'Remarks'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'customs_declarations', label: 'Customs declaration', plural: 'Customs (SB / BOE)', module: 'customs', icon: 'Stamp', title: ['declaration_no'], panel: true, statusField: 'status', print: 'customs',
    numbering: { field: 'ref_no', pattern: 'CUS{YY}{seq:5}' },
    children: [{ key: 'lines', label: 'HS lines', entity: 'customs_lines', fk: 'declaration_id' }],
    fields: [
      T('ref_no', 'Internal ref.', { readonly: true, list: true, search: true, section: 'Declaration' }),
      S('declaration_type', 'Type', ['Export – Shipping Bill (SB)', 'Import – Bill of Entry (BOE)', 'Transit', 'Re-export', 'Temporary admission', 'Free zone transfer'], { required: true, list: true }),
      T('declaration_no', 'SB / BOE no.', { list: true, search: true }), D('declaration_date', 'Declaration date', { list: true }), R('job_id', 'Master job', 'jobs', { required: true, list: true }), R('shipment_id', 'Shipment', 'shipments'),
      R('broker_id', 'Customs broker', 'parties', { refFilter: { is_broker: 1 } }), T('customs_office', 'Customs centre', { placeholder: 'e.g. Jebel Ali / DAFZA / Dubai Airport' }), T('regime', 'Customs regime / code'),
      S('status', 'Status', ['Draft', 'Submitted', 'Under assessment', 'Query raised', 'Duty payable', 'Duty paid', 'Cleared', 'Rejected', 'Cancelled'], { default: 'Draft', list: true }),
      B('exam_required', 'Physical inspection'), S('exam_status', 'Inspection status', ['Not required', 'Scheduled', 'Passed', 'Failed']), DT('released_at', 'Released at'),
      T('currency', 'Currency', { default: 'AED' }), M('total_value', 'Declared value', { computed: true, list: true }), M('duty_total', 'Duty', { computed: true, list: true }), M('vat_total', 'VAT', { computed: true }), M('other_fees', 'Other fees'),
      TA('remarks', 'Remarks / query details'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'customs_lines', label: 'Customs line', plural: 'Customs lines', module: 'customs', icon: 'List', title: ['description'], child: true,
    fields: [
      R('declaration_id', 'Declaration', 'customs_declarations', { hidden: true }), R('hs_code_id', 'HS code', 'hs_codes'), T('hs_text', 'HS (free text)'), T('description', 'Description', { list: true }), R('origin_country_id', 'Origin', 'countries'),
      N('qty', 'Qty', { default: 1 }), S('uom', 'Unit', ['PCS', 'KG', 'CTN', 'SET', 'LTR', 'MTR']), N('weight', 'Weight (kg)'), M('value', 'Value (CIF)', { list: true }),
      P('duty_pct', 'Duty %', { default: 5 }), M('duty_amount', 'Duty', { computed: true }), P('vat_pct', 'VAT %', { default: 5 }), M('vat_amount', 'VAT', { computed: true }),
    ],
  },
]
