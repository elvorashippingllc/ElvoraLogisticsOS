import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, E, PH, S, R, D, DT } from '../dsl'

export const transportWarehouse: EntityDef[] = [
  // ---------------- Transport / fleet
  {
    key: 'vehicles', label: 'Vehicle', plural: 'Fleet vehicles', module: 'transport', icon: 'Truck', title: ['plate_no'], panel: true, statusField: 'status',
    fields: [
      T('plate_no', 'Plate no.', { required: true, unique: true, list: true, search: true, section: 'Vehicle' }), S('type', 'Type', ['Pickup', 'Van', '3-ton truck', '7-ton truck', '10-ton truck', 'Flatbed', 'Trailer head', 'Trailer – 20ft', 'Trailer – 40ft', 'Low-bed', 'Reefer truck', 'Forklift', 'Car'], { list: true }),
      T('make', 'Make', { list: true }), T('model', 'Model'), I('year', 'Year'), N('capacity_kg', 'Capacity (kg)', { list: true }), R('driver_id', 'Assigned driver', 'drivers', { list: true }),
      S('ownership', 'Ownership', ['Owned', 'Leased', 'Subcontracted'], { default: 'Owned' }), S('status', 'Status', ['Available', 'On trip', 'Maintenance', 'Inactive'], { default: 'Available', list: true }),
      N('odometer', 'Odometer (km)'), D('registration_expiry', 'Registration (Mulkiya) expiry', { list: true }), D('insurance_expiry', 'Insurance expiry', { list: true }), D('next_service_date', 'Next service'), T('chassis_no', 'Chassis no.'), TA('notes', 'Notes'),
    ],
  },
  {
    key: 'drivers', label: 'Driver', plural: 'Drivers', module: 'transport', icon: 'IdCard', title: ['name'], panel: true,
    fields: [
      T('name', 'Name', { required: true, list: true, search: true, section: 'Driver' }), PH('phone', 'Phone', { list: true }), T('licence_no', 'Licence no.', { list: true }), D('licence_expiry', 'Licence expiry', { list: true }),
      T('nationality', 'Nationality'), T('emirates_id', 'Emirates ID'), D('visa_expiry', 'Visa expiry'), S('type', 'Type', ['Employee', 'Subcontract'], { default: 'Employee' }), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'transport_orders', label: 'Transport order', plural: 'Transport orders (trips)', module: 'transport', icon: 'Route', title: ['order_no'], panel: true, statusField: 'status', print: 'trip',
    numbering: { field: 'order_no', pattern: 'TRK{YY}{MM}{seq:5}' }, calendar: { field: 'pickup_at' },
    fields: [
      T('order_no', 'Trip no.', { readonly: true, list: true, search: true, section: 'Trip' }), R('customer_id', 'Customer', 'parties', { required: true, list: true }), R('job_id', 'Master job', 'jobs', { list: true }), R('shipment_id', 'Shipment', 'shipments'),
      S('type', 'Type', ['Pickup', 'Delivery', 'Inter-warehouse', 'Port shuttle', 'Cross-border', 'Empty return'], { list: true }), S('status', 'Status', ['Planned', 'Dispatched', 'In transit', 'Delivered', 'POD received', 'Cancelled'], { default: 'Planned', list: true }),
      T('pickup_location', 'Pick-up location', { list: true, span: 2 }), DT('pickup_at', 'Pick-up time', { list: true }), T('delivery_location', 'Delivery location', { list: true, span: 2 }), DT('delivery_at', 'Delivery time'),
      R('vehicle_id', 'Vehicle', 'vehicles', { list: true }), R('driver_id', 'Driver', 'drivers', { list: true }), R('subcontractor_id', 'Subcontractor', 'parties', { refFilter: { is_transporter: 1 } }),
      T('container_no', 'Container no.'), T('cargo_description', 'Cargo', { span: 2 }), N('weight_kg', 'Weight (kg)'), N('distance_km', 'Distance (km)'),
      M('rate', 'Customer rate'), M('cost', 'Transport cost'), T('pod_signed_by', 'POD signed by'), DT('pod_at', 'POD time'), TA('pod_signature', 'Signature (image data)', { hidden: true }), TA('instructions', 'Instructions'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'fuel_logs', label: 'Fuel log', plural: 'Fuel logs', module: 'transport', icon: 'Fuel', title: ['id'],
    fields: [
      D('log_date', 'Date', { required: true, default: 'today', list: true, section: 'Fuel' }), R('vehicle_id', 'Vehicle', 'vehicles', { required: true, list: true }), R('driver_id', 'Driver', 'drivers'),
      N('litres', 'Litres', { required: true, list: true }), M('amount', 'Amount (AED)', { list: true }), N('odometer', 'Odometer', { list: true }), T('station', 'Station'),
    ],
    defaultSort: { field: 'log_date', dir: 'desc' },
  },
  {
    key: 'vehicle_services', label: 'Vehicle service', plural: 'Vehicle maintenance', module: 'transport', icon: 'Wrench', title: ['id'],
    fields: [
      D('service_date', 'Date', { required: true, default: 'today', list: true, section: 'Service' }), R('vehicle_id', 'Vehicle', 'vehicles', { required: true, list: true }),
      S('type', 'Type', ['Scheduled service', 'Repair', 'Tyres', 'Inspection', 'Accident', 'Registration / insurance'], { list: true }), T('vendor', 'Workshop / vendor', { list: true }), M('cost', 'Cost', { list: true }),
      N('odometer', 'Odometer'), D('next_due', 'Next due'), TA('description', 'Work done'),
    ],
    defaultSort: { field: 'service_date', dir: 'desc' },
  },
  // ---------------- Warehouse
  {
    key: 'warehouses', label: 'Warehouse', plural: 'Warehouses', module: 'warehouse', icon: 'Warehouse', title: ['code', 'name'], titleSep: ' – ',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Warehouse' }), T('name', 'Name', { required: true, list: true }), S('type', 'Type', ['General', 'Bonded', 'Free zone', 'Cold storage', 'Hazardous', 'Open yard', 'Cross-dock'], { list: true }),
      R('branch_id', 'Branch', 'branches'), T('address', 'Address', { span: 2 }), R('manager_id', 'Manager', 'users'), N('area_sqm', 'Area (sqm)'), N('capacity_pallets', 'Capacity (pallets)'), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'wh_locations', label: 'Storage location', plural: 'Bins & storage locations', module: 'warehouse', icon: 'LayoutGrid', title: ['code'],
    fields: [
      R('warehouse_id', 'Warehouse', 'warehouses', { required: true, list: true, section: 'Location' }), T('code', 'Bin / rack code', { required: true, list: true, search: true, placeholder: 'A-01-03' }),
      T('zone', 'Zone', { list: true }), S('type', 'Type', ['Rack', 'Floor', 'Dock', 'Staging', 'Quarantine', 'Cold room'], { list: true }), N('capacity_pallets', 'Capacity'), B('active', 'Active', { default: true }),
    ],
  },
  {
    key: 'items', label: 'Item / SKU', plural: 'Items (SKU)', module: 'warehouse', icon: 'Boxes', title: ['sku', 'name'], titleSep: ' – ', panel: true,
    fields: [
      T('sku', 'SKU', { required: true, unique: true, list: true, search: true, section: 'Item' }), T('name', 'Name', { required: true, list: true, search: true }), R('customer_id', 'Owner (customer)', 'parties', { list: true }),
      T('barcode', 'Barcode', { search: true }), R('uom_id', 'Unit', 'uoms', { list: true }), R('hs_code_id', 'HS code', 'hs_codes'), N('weight_kg', 'Unit weight (kg)'), N('volume_cbm', 'Unit CBM'),
      N('min_stock', 'Min. stock'), I('shelf_life_days', 'Shelf life (days)'), B('is_dg', 'Dangerous goods'), B('track_lot', 'Track lot / batch', { default: true }), B('active', 'Active', { default: true }), TA('description', 'Description'),
    ],
  },
  {
    key: 'stock_moves', label: 'Stock move', plural: 'Stock ledger', module: 'warehouse', icon: 'ArrowLeftRight', title: ['id'], readonlyApi: true,
    description: 'Every receipt, dispatch, transfer and adjustment is recorded here. Stock on hand is the sum of this ledger.',
    fields: [
      DT('moved_at', 'Date', { list: true }), S('move_type', 'Type', ['GRN', 'Dispatch', 'Transfer in', 'Transfer out', 'Adjustment', 'Return'], { list: true }), R('item_id', 'Item', 'items', { list: true }),
      R('warehouse_id', 'Warehouse', 'warehouses', { list: true }), R('location_id', 'Location', 'wh_locations', { list: true }), T('lot_no', 'Lot', { list: true }), D('expiry_date', 'Expiry'),
      N('qty', 'Qty (+/-)', { list: true }), R('customer_id', 'Owner', 'parties'), R('job_id', 'Job', 'jobs'), T('ref_no', 'Reference', { list: true }), T('ref_entity', 'ref', { hidden: true }), I('ref_id', 'ref id', { hidden: true }), T('note', 'Note'), R('user_id', 'By', 'users'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'grns', label: 'Goods receipt (GRN)', plural: 'Goods receipts (GRN)', module: 'warehouse', icon: 'PackagePlus', title: ['grn_no'], panel: true, statusField: 'status', print: 'grn',
    numbering: { field: 'grn_no', pattern: 'GRN{YY}{MM}{seq:5}' },
    children: [{ key: 'lines', label: 'Received items', entity: 'grn_lines', fk: 'grn_id' }],
    fields: [
      T('grn_no', 'GRN no.', { readonly: true, list: true, search: true, section: 'Receipt' }), R('warehouse_id', 'Warehouse', 'warehouses', { required: true, list: true }), R('customer_id', 'Owner (customer)', 'parties', { required: true, list: true }),
      R('job_id', 'Master job', 'jobs'), DT('received_at', 'Received at', { default: 'now', list: true }), S('status', 'Status', ['Draft', 'Posted', 'Cancelled'], { default: 'Draft', list: true }),
      T('delivery_note', 'Delivery note / ref.'), T('vehicle_no', 'Vehicle no.'), T('driver_name', 'Driver'), TA('remarks', 'Remarks'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'grn_lines', label: 'GRN line', plural: 'GRN lines', module: 'warehouse', icon: 'List', title: ['id'], child: true,
    fields: [
      R('grn_id', 'GRN', 'grns', { hidden: true }), R('item_id', 'Item', 'items', { required: true }), N('qty', 'Qty', { required: true }), R('location_id', 'Put-away bin', 'wh_locations'), T('lot_no', 'Lot / batch'), D('expiry_date', 'Expiry'),
      S('condition', 'Condition', ['Good', 'Damaged', 'Short', 'Quarantine'], { default: 'Good' }), T('note', 'Note'),
    ],
  },
  {
    key: 'dispatches', label: 'Dispatch', plural: 'Dispatch orders', module: 'warehouse', icon: 'PackageMinus', title: ['dispatch_no'], panel: true, statusField: 'status', print: 'dispatch',
    numbering: { field: 'dispatch_no', pattern: 'DSP{YY}{MM}{seq:5}' },
    children: [{ key: 'lines', label: 'Dispatched items', entity: 'dispatch_lines', fk: 'dispatch_id' }],
    fields: [
      T('dispatch_no', 'Dispatch no.', { readonly: true, list: true, search: true, section: 'Dispatch' }), R('warehouse_id', 'Warehouse', 'warehouses', { required: true, list: true }), R('customer_id', 'Owner (customer)', 'parties', { required: true, list: true }),
      R('job_id', 'Master job', 'jobs'), DT('dispatch_at', 'Dispatch at', { default: 'now', list: true }), S('status', 'Status', ['Draft', 'Posted', 'Cancelled'], { default: 'Draft', list: true }),
      T('consignee', 'Deliver to', { span: 2 }), T('vehicle_no', 'Vehicle no.'), T('driver_name', 'Driver'), TA('remarks', 'Remarks'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'dispatch_lines', label: 'Dispatch line', plural: 'Dispatch lines', module: 'warehouse', icon: 'List', title: ['id'], child: true,
    fields: [
      R('dispatch_id', 'Dispatch', 'dispatches', { hidden: true }), R('item_id', 'Item', 'items', { required: true }), N('qty', 'Qty', { required: true }), R('location_id', 'From bin', 'wh_locations'), T('lot_no', 'Lot / batch'), T('note', 'Note'),
    ],
  },
]
