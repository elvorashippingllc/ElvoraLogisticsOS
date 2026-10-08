import type { EntityDef } from '../types'
import { T, TA, I, B, E, PH, S, R, DT, D, J, U, N } from '../dsl'

export const MODULE_DEFS = [
  ['dashboard', 'Dashboard'], ['crm', 'CRM'], ['sales', 'Sales & Pricing'], ['jobs', 'Jobs & Shipments'],
  ['customs', 'Customs'], ['transport', 'Transport'], ['warehouse', 'Warehouse'], ['finance', 'Accounts & Finance'],
  ['hr', 'HR & Payroll'], ['support', 'Support & Claims'], ['projects', 'Projects & Tasks'], ['documents', 'Documents'],
  ['assets', 'Assets & Procurement'], ['compliance', 'Compliance & Legal'], ['ai', 'AI Team & Automation'], ['reports', 'Reports & KPI'], ['masters', 'Master Data'], ['admin', 'Administration'],
] as const

export const platform: EntityDef[] = [
  {
    key: 'branches', label: 'Branch', plural: 'Branches', module: 'admin', icon: 'Building2', title: ['code', 'name'], titleSep: ' – ',
    fields: [
      T('code', 'Branch code', { required: true, unique: true, list: true, search: true, help: 'Used as the job-number prefix, e.g. DXB', section: 'Branch' }),
      T('name', 'Branch name', { required: true, list: true, search: true }),
      T('address', 'Address', { span: 3 }), T('city', 'City', { list: true }), T('country', 'Country', { default: 'United Arab Emirates' }),
      PH('phone', 'Phone'), E('email', 'Email'), T('trn', 'Tax registration no. (TRN)'), R('legal_entity_id', 'Legal entity', 'legal_entities', { list: true }),
      T('trade_license', 'Trade licence no.'), B('is_head_office', 'Head office', { list: true }), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'departments', label: 'Department', plural: 'Departments', module: 'admin', icon: 'Network', title: ['name'],
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, section: 'Department' }),
      T('name', 'Name', { required: true, list: true, search: true }),
      R('manager_id', 'Head of department', 'users', { list: true }), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'roles', label: 'Role', plural: 'Roles', module: 'admin', icon: 'ShieldCheck', title: ['name'],
    fields: [
      T('name', 'Role name', { required: true, unique: true, list: true, search: true, section: 'Role' }),
      T('description', 'Description', { list: true, span: 2 }),
      B('is_system', 'System role', { readonly: true, list: true }),
      J('permissions', 'Permissions'),
    ],
  },
  {
    key: 'users', label: 'User', plural: 'Users', module: 'admin', icon: 'Users', title: ['name'], panel: true, noDelete: true,
    fields: [
      T('name', 'Full name', { required: true, list: true, search: true, section: 'User' }),
      E('email', 'Login e-mail', { required: true, unique: true, list: true, search: true }),
      R('role_id', 'Role', 'roles', { required: true, list: true }),
      R('branch_id', 'Branch', 'branches', { list: true }), R('department_id', 'Department', 'departments'),
      I('work_capacity_points','Work capacity points',{default:40,help:'Capacity used by workload recommendations; configure per employee'}), PH('phone', 'Phone'), T('designation', 'Designation'), R('party_id', 'Customer portal company', 'parties', { help: 'Only for customer-portal users: restricts the account to this company\'s own jobs, invoices and quotations' }),
      T('password', 'Set password', { virtual: true, help: 'Leave blank to keep the current password. Min 10 characters.' }),
      B('active', 'Active', { default: true, list: true }),
      B('must_change_password', 'Must change password at next login'),
      DT('last_login_at', 'Last login', { readonly: true, list: true }),
      T('password_hash', 'hash', { secret: true, hidden: true }),
      T('totp_secret', 'totp', { secret: true, hidden: true }),
      I('failed_logins', 'Failed logins', { readonly: true, hidden: true }),
      DT('locked_until', 'Locked until', { readonly: true, hidden: true }),
      T('signature', 'E-mail signature', { span: 3, hidden: true }),
    ],
  },
  {
    key: 'announcements', label: 'Announcement', plural: 'Blog & Announcements', module: 'documents', icon: 'Newspaper', title: ['title'], panel: true,
    fields: [
      T('title', 'Title', { required: true, list: true, search: true, span: 3, section: 'Post' }),
      S('category', 'Category', ['Announcement', 'Policy', 'Training / SOP', 'Market update', 'Holiday', 'Carrier notice', 'Customs notice'], { list: true, default: 'Announcement' }),
      B('pinned', 'Pinned', { list: true }), D('publish_date', 'Publish date', { default: 'today', list: true }),
      TA('body', 'Content', { required: true }),
    ],
    defaultSort: { field: 'publish_date', dir: 'desc' },
  },
  {
    key: 'webhooks', label: 'Webhook', plural: 'Webhooks', module: 'admin', icon: 'Webhook', title: ['name'],
    fields: [
      T('name', 'Name', { required: true, list: true, section: 'Webhook' }), U('url', 'Target URL', { required: true, list: true, span: 2 }),
      T('events', 'Events', { help: 'Comma separated, e.g. jobs.created,invoices.posted or *', default: '*', list: true, span: 2 }),
      T('secret', 'Signing secret', { help: 'Used for the X-Elvora-Signature HMAC-SHA256 header' }),
      B('active', 'Active', { default: true, list: true }),
      DT('last_delivery_at', 'Last delivery', { readonly: true, list: true }), T('last_status', 'Last status', { readonly: true, list: true }),
    ],
  },
  {
    key: 'api_keys', label: 'API key', plural: 'API keys', module: 'admin', icon: 'KeyRound', title: ['name'], noDelete: false,
    description: 'Keys authenticate external systems against the REST API (Authorization: Bearer <key>). The key is shown once when created.',
    fields: [
      T('name', 'Name', { required: true, list: true, section: 'API key' }),
      R('user_id', 'Acts as user', 'users', { required: true, list: true, help: 'The key inherits this user\'s role permissions' }),
      T('prefix', 'Key prefix', { readonly: true, list: true }), T('key_hash', 'hash', { secret: true, hidden: true }),
      B('active', 'Active', { default: true, list: true }), DT('last_used_at', 'Last used', { readonly: true, list: true }),
    ],
  },
  {
    key: 'email_outbox', label: 'E-mail', plural: 'E-mail outbox', module: 'admin', icon: 'Mail', title: ['subject'], readonlyApi: true,
    fields: [
      T('to_addr', 'To', { list: true, search: true }), T('cc_addr', 'Cc'), T('subject', 'Subject', { list: true, search: true, span: 3 }),
      TA('body', 'Body'), S('status', 'Status', ['Queued', 'Sent', 'Failed', 'Not configured'], { list: true }),
      T('error', 'Error', { span: 3 }), DT('sent_at', 'Sent at', { list: true }),
      T('link_entity', 'Linked entity'), I('link_id', 'Linked id'), J('attachments', 'Attachments'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'automation_rules', label: 'Automation rule', plural: 'Automation rules', module: 'admin', icon: 'Workflow', title: ['name'],
    description: 'When a record is created or changes, queue a durable workflow to create a follow-up task, notify someone or queue an e-mail. Failed runs remain visible in Workflow runs. Message templates may use {field_name} placeholders.',
    fields: [
      T('name', 'Rule name', { required: true, list: true, search: true, span: 2, section: 'Trigger' }), T('entity', 'Record type (entity key)', { required: true, list: true, help: 'e.g. jobs, invoices, quotations, tickets' }),
      S('trigger', 'When', ['Record created', 'Record updated', 'Status / stage changed to'], { required: true, list: true }), T('field', 'Field to check', { help: 'Optional field name, e.g. job_status' }),
      S('operator', 'Condition', ['equals', 'not equals', 'contains', 'greater than', 'less than', 'is empty', 'is not empty'], { default: 'equals' }), T('value', 'Value', { list: true }),
      S('action', 'Then', ['Create follow-up task', 'Notify user', 'Queue e-mail to customer contact', 'Queue e-mail to address', 'Send WhatsApp to customer contact', 'Send WhatsApp to number', 'Ask an AI employee to review', 'Set field value'], { required: true, list: true, section: 'Action' }),
      R('assignee_id', 'Assign / notify user', 'users'), T('target', 'E-mail address / field=value', { help: 'For "Queue e-mail to address": address. For "Set field value": field=value' }),
      T('message', 'Title / subject template', { span: 3, placeholder: 'Follow up job {job_no} – {job_status}' }), TA('body', 'Body template'), I('due_days', 'Task due in (days)', { default: 1 }), I('delay_minutes','Delay (minutes)',{default:0}), I('max_attempts','Max attempts (internal actions)',{default:3}), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'custom_fields', label: 'Custom field', plural: 'Custom fields', module: 'admin', icon: 'SlidersHorizontal', title: ['label'],
    description: 'Add your own fields to any record type — they appear on forms and detail pages automatically.',
    fields: [
      T('entity', 'Record type (entity key)', { required: true, list: true, help: 'e.g. jobs, parties, quotations', section: 'Field' }),
      T('name', 'Field key', { required: true, list: true, help: 'lowercase, letters/digits/underscore' }), T('label', 'Label', { required: true, list: true }),
      S('type', 'Type', ['text', 'textarea', 'number', 'date', 'select', 'bool'], { required: true, list: true }),
      T('options', 'Options (for select)', { help: 'Comma separated', span: 2 }), B('required', 'Required'), N('sort', 'Order', { default: 100 }),
    ],
  },
  {
    key: 'attachments', label: 'Attachment', plural: 'Documents library', module: 'documents', icon: 'FolderOpen', title: ['file_name'], readonlyApi: true, panel: true,
    fields: [
      T('file_name', 'File', { list: true, search: true }), S('category', 'Category', ['General', 'Bill of Lading', 'Air Waybill', 'Commercial Invoice', 'Packing List', 'Customs', 'Certificate of Origin', 'Insurance', 'POD', 'Contract', 'Licence / Permit', 'KYC', 'Invoice / Bill', 'Receipt', 'Photo', 'Other'], { list: true }),
      T('link_entity', 'Linked to', { list: true }), I('link_id', 'Record'), T('link_label', 'Record label', { list: true }),
      D('expiry_date', 'Expiry', { list: true }), I('size', 'Size (bytes)'), T('mime', 'Type'), T('stored_name', 'stored', { secret: true, hidden: true }),
      T('note', 'Note', { span: 3 }), I('doc_version', 'Doc version', { default: 1 }),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
]

