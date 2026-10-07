import type { EntityDef } from '../types'
import { T, TA, I, M, B, S, R, D, DT } from '../dsl'

export const ITEM_TYPES = [
  'Trade licence', 'Commercial register', 'Chamber of Commerce membership', 'Customs broker registration (Dubai Customs)', 'Maritime / shipping agent approval (DMA)',
  'Warehouse / additional office permit (DET)', 'Signage permit', 'VAT registration (FTA)', 'Corporate tax registration (FTA)', 'E-invoicing service provider (ASP)',
  'MOHRE establishment card / WPS', 'ICP establishment card', 'Tenancy contract (Ejari)', 'Insurance policy', 'UBO register', 'Data protection / privacy', 'Other',
]
export const FILING_TYPES = ['VAT return', 'VAT payment', 'Corporate tax registration', 'Corporate tax return', 'Corporate tax payment', 'E-invoicing ASP appointment', 'E-invoicing go-live', 'Licence renewal', 'UBO register review', 'Other']

export const compliance: EntityDef[] = [
  {
    key: 'compliance_items', label: 'Licence / registration', plural: 'Licences & registrations', module: 'compliance', icon: 'BadgeCheck', title: ['name'], panel: true, statusField: 'status',
    description: 'Register of every licence, permit, registration and policy the company must hold. Expiry dates drive alerts, the compliance calendar and the readiness score.',
    fields: [
      S('type', 'Type', ITEM_TYPES, { required: true, list: true, section: 'Registration' }), T('name', 'Name', { required: true, list: true, search: true, span: 2 }),
      T('reference_no', 'Number / reference', { list: true, search: true }), T('authority', 'Issuing authority', { list: true }),
      S('status', 'Status', ['Active', 'Pending', 'To obtain', 'To verify', 'Expired', 'Not applicable'], { default: 'To verify', list: true }),
      D('issue_date', 'Issue date'), D('expiry_date', 'Expiry date', { list: true }), I('renewal_lead_days', 'Remind before expiry (days)', { default: 60 }),
      R('owner_id', 'Responsible', 'users', { list: true }), M('annual_cost', 'Annual cost'), T('portal_url', 'Portal / verification link', { span: 2 }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'expiry_date', dir: 'asc' },
  },
  {
    key: 'licence_activities', label: 'Licensed activity', plural: 'Licensed activities', module: 'compliance', icon: 'ListChecks', title: ['activity_en'], statusField: 'status',
    description: 'Activities printed on the trade licence. Jobs, quotations, transport and warehouse documents are checked against this list. If you obtain a licence amendment or permit, add the activity here.',
    fields: [
      T('activity_en', 'Activity (English)', { required: true, list: true, search: true, section: 'Activity', span: 2 }), T('activity_ar', 'Activity (Arabic)', { list: true }),
      S('status', 'Status', ['Active', 'Suspended', 'Cancelled'], { default: 'Active', list: true }),
      T('covers', 'Service codes covered', { list: true, span: 2, help: 'Comma separated: SEA_FREIGHT, CUSTOMS, SEA_AGENCY, CARGO_HANDLING, AIR_FREIGHT, ROAD_TRANSPORT, WAREHOUSING, COURIER' }),
      T('source', 'Source', { default: 'Trade licence', list: true }), T('authority', 'Follow-up authority'), TA('notes', 'Notes / conditions'),
    ],
  },
  {
    key: 'compliance_filings', label: 'Statutory deadline', plural: 'Compliance calendar', module: 'compliance', icon: 'CalendarClock', title: ['type', 'period'], titleSep: ' – ', panel: true, statusField: 'status', calendar: { field: 'due_date' },
    description: 'Tax returns, registrations and renewals with their due dates. Press “Generate calendar” on the Compliance Centre to create the upcoming ones from your settings.',
    fields: [
      S('type', 'Obligation', FILING_TYPES, { required: true, list: true, section: 'Deadline' }), T('period', 'Period / reference', { list: true, search: true }), D('due_date', 'Due date', { required: true, list: true }),
      S('status', 'Status', ['Upcoming', 'Filed', 'Overdue', 'Not applicable'], { default: 'Upcoming', list: true }), D('filed_on', 'Filed / done on'), T('filing_ref', 'Acknowledgement / reference', { list: true }),
      M('amount', 'Amount (AED)'), B('auto', 'Generated automatically', { readonly: true }), T('basis', 'Basis', { span: 2, readonly: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'due_date', dir: 'asc' },
  },
  {
    key: 'compliance_exceptions', label: 'Compliance exception', plural: 'Compliance exceptions', module: 'compliance', icon: 'ShieldAlert', title: ['rule', 'message'], titleSep: ' – ', statusField: 'status', readonlyApi: true, noDelete: true,
    description: 'Automatic findings raised when a document breaks a UAE rule or falls outside the licensed activities. Acknowledge with a note once reviewed; findings resolve themselves when the record is fixed.',
    fields: [
      T('rule', 'Rule', { list: true, search: true, section: 'Finding' }), S('severity', 'Severity', ['Info', 'Warning', 'Blocker'], { default: 'Warning', list: true }), T('message', 'Finding', { list: true, search: true, span: 3 }),
      T('link_entity', 'Record type', { list: true }), I('link_id', 'Record'), T('link_label', 'Record label', { list: true }),
      S('status', 'Status', ['Open', 'Acknowledged', 'Resolved'], { default: 'Open', list: true }), DT('detected_at', 'Detected', { list: true }), R('acknowledged_by', 'Acknowledged by', 'users'), DT('acknowledged_at', 'Acknowledged at'), TA('note', 'Review note'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
]
