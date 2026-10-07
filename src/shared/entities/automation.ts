import type { EntityDef } from '../types'
import { T, TA, I, M, B, S, R, D, DT, J } from '../dsl'

export const AGENT_AUTONOMY = ['Ask first (every action needs approval)', 'Auto for internal actions (approve external messages)', 'Autopilot (act, then report)']
export const AGENT_SCHEDULE = ['Manual only', 'Hourly', 'Daily', 'Weekly (Monday)']

export const automation: EntityDef[] = [
  {
    key: 'legal_entities', label: 'Legal entity', plural: 'Legal entities (companies)', module: 'finance', icon: 'Building2', title: ['code', 'name'], titleSep: ' – ',
    description: 'Run more than one company or free-zone licence in the same system. Each branch belongs to one entity; ledgers and statements can be filtered per entity.',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Entity' }), T('name', 'Legal name', { required: true, list: true, search: true, span: 2 }),
      T('name_ar', 'Legal name (Arabic)', { span: 2 }), T('trn', 'Tax registration no. (TRN)', { list: true }), T('trade_license', 'Trade licence no.'), T('address', 'Address', { span: 3 }),
      S('base_currency', 'Base currency', ['AED', 'USD', 'EUR', 'SAR', 'GBP'], { default: 'AED', list: true }), B('is_default', 'Default entity', { list: true }), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'year_end_closes', label: 'Year-end close', plural: 'Year-end closes', module: 'finance', icon: 'CalendarCheck2', title: ['fiscal_year'], readonlyApi: true, noDelete: true,
    fields: [
      T('fiscal_year', 'Fiscal year', { list: true }), R('legal_entity_id', 'Entity', 'legal_entities', { list: true }), D('closing_date', 'Closing date', { list: true }),
      M('net_result', 'Net profit / (loss)', { list: true }), R('journal_id', 'Closing journal', 'journal_entries', { list: true }), S('status', 'Status', ['Closed', 'Re-opened'], { list: true }),
      D('reopened_on', 'Re-opened on'), T('note', 'Note', { span: 3 }),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'wps_batches', label: 'WPS file', plural: 'WPS salary files', module: 'hr', icon: 'FileSpreadsheet', title: ['file_name'], readonlyApi: true, noDelete: true,
    description: 'UAE Wages Protection System (SIF) files generated from approved payslips. Check the file with your bank before first use.',
    fields: [
      T('period', 'Period', { list: true }), R('legal_entity_id', 'Entity', 'legal_entities'), T('file_name', 'File', { list: true, search: true }), I('employees', 'Employees', { list: true }),
      M('total', 'Total (AED)', { list: true }), T('employer_id', 'Employer ID'), T('bank_routing', 'Employer bank routing code'), J('content', 'File content'), DT('created', 'Generated', { list: true }),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'integration_logs', label: 'Integration log', plural: 'Integration log', module: 'admin', icon: 'Activity', title: ['summary'], readonlyApi: true, noDelete: true,
    fields: [
      DT('at', 'When', { list: true }), T('provider', 'Provider', { list: true, search: true }), T('action', 'Action', { list: true }), B('ok', 'OK', { list: true }), T('summary', 'Summary', { list: true, search: true, span: 3 }),
      T('link_entity', 'Record type'), I('link_id', 'Record'), TA('detail', 'Detail'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'whatsapp_messages', label: 'WhatsApp message', plural: 'WhatsApp messages', module: 'crm', icon: 'MessageCircle', title: ['body'], readonlyApi: true, noDelete: true,
    fields: [
      DT('at', 'When', { list: true }), S('direction', 'Direction', ['in', 'out'], { list: true }), T('wa_id', 'Number', { list: true, search: true }), T('contact_name', 'Name', { list: true }),
      TA('body', 'Message', { list: true, search: true }), S('status', 'Status', ['received', 'queued', 'sent', 'delivered', 'read', 'failed'], { list: true }), T('wa_message_id', 'WhatsApp id', { hidden: true }),
      R('party_id', 'Customer', 'parties', { list: true }), R('lead_id', 'Lead', 'leads'), T('origin', 'Origin', { list: true, help: 'staff command, customer, automation, agent, manual' }), T('error', 'Error'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'ai_agents', label: 'AI employee', plural: 'AI employees', module: 'ai', icon: 'Bot', title: ['name'], panel: true,
    description: 'Digital employees that read your live data, do routine work and report back. Choose how much freedom each one has.',
    fields: [
      T('name', 'Name', { required: true, list: true, search: true, section: 'Employee' }), T('title', 'Job title', { list: true, span: 2 }), T('avatar', 'Emoji', { default: '🤖' }),
      TA('instructions', 'Standing instructions (what this employee does)', { required: true }),
      S('autonomy', 'Autonomy', AGENT_AUTONOMY, { default: AGENT_AUTONOMY[1], list: true }),
      S('schedule', 'Runs', AGENT_SCHEDULE, { default: 'Manual only', list: true }), I('run_hour', 'Hour of day (Dubai time)', { default: 8, min: 0, max: 23 }),
      S('deliver_to', 'Send the report to', ['In-app only', 'In-app + WhatsApp (owner)', 'In-app + e-mail (admin)'], { default: 'In-app only', list: true }),
      T('tools', 'Allowed tools', { help: 'Comma separated tool names, or * for all', default: '*', span: 3 }),
      B('active', 'Active', { default: true, list: true }), DT('last_run_at', 'Last run', { list: true, readonly: true }), S('last_status', 'Last status', ['', 'ok', 'failed', 'skipped'], { list: true, readonly: true }),
      T('role_key', 'Template key', { hidden: true }), T('model', 'Model override', { help: 'Leave blank to use the default AI model', hidden: false }),
    ],
  },
  {
    key: 'ai_runs', label: 'Agent run', plural: 'AI activity', module: 'ai', icon: 'Activity', title: ['id'], readonlyApi: true, noDelete: true,
    fields: [
      R('agent_id', 'Employee', 'ai_agents', { list: true }), DT('started_at', 'Started', { list: true }), T('trigger', 'Trigger', { list: true }), S('status', 'Status', ['running', 'ok', 'failed', 'skipped'], { list: true }),
      TA('input', 'Task'), TA('output', 'Result', { list: true }), I('steps', 'Steps', { list: true }), I('tokens', 'Tokens'), T('model', 'Model', { list: true }), T('error', 'Error'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'ai_actions', label: 'Proposed action', plural: 'AI approvals', module: 'ai', icon: 'ShieldCheck', title: ['summary'], readonlyApi: true, noDelete: true, statusField: 'status',
    fields: [
      R('agent_id', 'Employee', 'ai_agents', { list: true }), R('run_id', 'Run', 'ai_runs'), T('tool', 'Action', { list: true }), TA('summary', 'What it wants to do', { list: true }), J('args', 'Arguments'),
      S('status', 'Status', ['Pending', 'Approved', 'Rejected', 'Executed', 'Failed'], { default: 'Pending', list: true }), TA('result', 'Result'), DT('created', 'Proposed', { list: true }), DT('decided_at', 'Decided'), R('decided_by', 'Decided by', 'users'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
]
