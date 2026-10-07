import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, E, PH, S, R, D, U } from '../dsl'

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
export const PACKAGE_TYPES = ['Carton', 'Pallet', 'Crate', 'Drum', 'Bag', 'Bundle', 'Roll', 'Case', 'Piece', 'Box', 'Skid', 'Barrel', 'Container (bulk)', 'Loose']
export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']

export const masters: EntityDef[] = [
  {
    key: 'countries', label: 'Country', plural: 'Countries', module: 'masters', icon: 'Globe2', title: ['name'],
    fields: [
      T('code', 'ISO code', { required: true, unique: true, list: true, search: true, section: 'Country' }),
      T('name', 'Name', { required: true, list: true, search: true }), T('region', 'Region', { list: true }),
      T('currency', 'Currency'), T('dial_code', 'Dial code'), B('active', 'Active', { default: true }),
    ],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  {
    key: 'locations', label: 'Location / Port', plural: 'Ports & Locations', module: 'masters', icon: 'Anchor', title: ['code', 'name', 'country_id'],
    titleFmt: '{code}-{name}/{country_id}', titleUpper: true,
    fields: [
      T('code', 'UN/LOCODE or IATA', { required: true, unique: true, list: true, search: true, section: 'Location', help: 'e.g. AEDXB, AEJEA, ZAJNB' }),
      T('name', 'Name', { required: true, list: true, search: true }), R('country_id', 'Country', 'countries', { required: true, list: true }),
      S('type', 'Type', ['Seaport', 'Airport', 'Inland depot / ICD', 'Border post', 'Free zone', 'City'], { list: true, default: 'Seaport' }),
      T('iata', 'IATA code'), T('timezone', 'Time zone'), B('active', 'Active', { default: true, list: true }),
    ],
    defaultSort: { field: 'code', dir: 'asc' },
  },
  {
    key: 'carriers', label: 'Carrier', plural: 'Carriers & Airlines', module: 'masters', icon: 'Ship', title: ['name'],
    fields: [
      T('name', 'Name', { required: true, list: true, search: true, section: 'Carrier' }),
      S('type', 'Type', ['Ocean line', 'Airline', 'Trucking', 'Rail', 'Courier', 'Feeder'], { required: true, list: true }),
      T('code', 'SCAC / IATA 2-letter', { list: true, search: true }), T('awb_prefix', 'AWB prefix (3 digits)', { list: true }),
      U('website', 'Website'), U('tracking_url', 'Tracking URL template', { span: 2, help: 'Use {no} as placeholder for the container / BL / AWB number' }),
      B('active', 'Active', { default: true, list: true }),
    ],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  {
    key: 'container_types', label: 'Container type', plural: 'Container types', module: 'masters', icon: 'Container', title: ['code', 'name'], titleSep: ' – ',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Container' }), T('name', 'Description', { required: true, list: true }),
      T('iso_code', 'ISO type', { list: true }), N('teu', 'TEU', { list: true }), N('tare_kg', 'Tare (kg)'), N('max_payload_kg', 'Max payload (kg)'), N('cbm', 'Internal volume (CBM)'),
      B('active', 'Active', { default: true }),
    ],
  },
  {
    key: 'currencies', label: 'Currency', plural: 'Currencies', module: 'masters', icon: 'Coins', title: ['code'],
    description: 'Exchange rates are expressed as units of the base currency (AED) per 1 unit of the currency. Only AED and the USD peg are pre-filled — maintain the rest in line with your bank.',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Currency' }), T('name', 'Name', { required: true, list: true }), T('symbol', 'Symbol'),
      N('rate', 'Rate to AED', { list: true, help: 'AED per 1 unit' }), D('rate_date', 'Rate date', { list: true }), I('decimals', 'Decimals', { default: 2 }), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'exchange_rates', label: 'Exchange rate', plural: 'Exchange-rate history', module: 'masters', icon: 'LineChart', title: ['currency', 'rate_date'],
    fields: [
      T('currency', 'Currency code', { required: true, list: true, section: 'Rate' }), D('rate_date', 'Date', { required: true, default: 'today', list: true }),
      N('rate', 'AED per unit', { required: true, list: true }), T('source', 'Source', { list: true }),
    ],
    defaultSort: { field: 'rate_date', dir: 'desc' },
  },
  {
    key: 'uoms', label: 'Unit of measure', plural: 'Units of measure', module: 'masters', icon: 'Ruler', title: ['code'],
    fields: [T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Unit' }), T('name', 'Name', { required: true, list: true }), B('active', 'Active', { default: true })],
  },
  {
    key: 'vat_codes', label: 'Tax code', plural: 'VAT / tax codes', module: 'masters', icon: 'Percent', title: ['code', 'name'], titleSep: ' – ',
    description: 'Review the treatment of each code with your tax adviser. UAE VAT standard rate is 5%; qualifying international transport is zero-rated.',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Tax code' }), T('name', 'Name', { required: true, list: true }),
      P('rate', 'Rate %', { required: true, list: true }), S('category', 'Category', ['Standard rated', 'Zero rated', 'Exempt', 'Out of scope', 'Reverse charge'], { list: true }),
      B('active', 'Active', { default: true }),
    ],
  },
  {
    key: 'charge_codes', label: 'Charge code', plural: 'Charge codes', module: 'masters', icon: 'Receipt', title: ['code', 'name'], titleSep: ' – ',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Charge' }), T('name', 'Charge name', { required: true, list: true, search: true }),
      S('applies_to', 'Applies to', ['Revenue & cost', 'Revenue only', 'Cost only'], { default: 'Revenue & cost', list: true }),
      S('group', 'Print group', ['Freight', 'Origin charges', 'Destination charges', 'Customs', 'Documentation', 'Handling', 'Transport', 'Warehousing', 'Insurance', 'Surcharges', 'Other'], { list: true, default: 'Freight' }),
      R('uom_id', 'Default unit', 'uoms'), M('default_rate', 'Default sell rate'), R('vat_code_id', 'Default tax code', 'vat_codes', { list: true }),
      R('income_account_id', 'Income account', 'accounts'), R('cost_account_id', 'Cost account', 'accounts'), B('active', 'Active', { default: true }),
    ],
  },
  {
    key: 'payment_terms', label: 'Payment term', plural: 'Payment terms', module: 'masters', icon: 'CalendarClock', title: ['name'],
    fields: [T('name', 'Name', { required: true, unique: true, list: true, section: 'Term' }), I('days', 'Due in (days)', { required: true, list: true }), T('description', 'Description', { span: 2 }), B('active', 'Active', { default: true })],
  },
  {
    key: 'hs_codes', label: 'HS code', plural: 'HS codes', module: 'masters', icon: 'Barcode', title: ['code', 'description'], titleSep: ' – ',
    fields: [
      T('code', 'HS code', { required: true, unique: true, list: true, search: true, section: 'HS code' }), T('description', 'Description', { required: true, list: true, search: true, span: 2 }),
      P('duty_rate', 'Duty %', { list: true, default: 5 }), TA('notes', 'Notes / restrictions'),
    ],
  },
  {
    key: 'vessels', label: 'Vessel', plural: 'Vessels', module: 'masters', icon: 'Sailboat', title: ['name'],
    fields: [T('name', 'Vessel name', { required: true, list: true, search: true, section: 'Vessel' }), T('imo', 'IMO no.', { list: true }), T('call_sign', 'Call sign'), T('flag', 'Flag', { list: true }), R('carrier_id', 'Operator', 'carriers', { list: true })],
  },
  {
    key: 'service_types', label: 'Service type', plural: 'Service types', module: 'masters', icon: 'Route', title: ['name'],
    fields: [T('name', 'Name', { required: true, unique: true, list: true, section: 'Service type' }), B('active', 'Active', { default: true })],
  },
]
