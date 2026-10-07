import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, E, PH, S, R, D, DT, U } from '../dsl'

export const people: EntityDef[] = [
  // ---------------- HR
  {
    key: 'employees', label: 'Employee', plural: 'Employees', module: 'hr', icon: 'UserRound', title: ['emp_no', 'name'], titleSep: ' – ', panel: true, statusField: 'status',
    numbering: { field: 'emp_no', pattern: 'EMP{seq:4}' },
    fields: [
      T('emp_no', 'Employee no.', { readonly: true, list: true, search: true, section: 'Employee' }), T('name', 'Full name', { required: true, list: true, search: true, span: 2 }), R('user_id', 'Linked user', 'users'),
      R('department_id', 'Department', 'departments', { list: true }), T('designation', 'Designation', { list: true }), R('branch_id', 'Branch', 'branches', { list: true }), R('manager_id', 'Reports to', 'employees'),
      S('status', 'Status', ['Active', 'On leave', 'Probation', 'Resigned', 'Terminated'], { default: 'Active', list: true }), D('join_date', 'Join date', { list: true }), S('contract_type', 'Contract', ['Unlimited', 'Limited', 'Part-time', 'Contractor']),
      PH('phone', 'Phone'), E('email', 'Work e-mail'), T('nationality', 'Nationality'), S('gender', 'Gender', ['Male', 'Female']), D('dob', 'Date of birth'),
      T('passport_no', 'Passport no.', { section: 'Documents' }), D('passport_expiry', 'Passport expiry', { list: true }), T('emirates_id', 'Emirates ID'), D('eid_expiry', 'Emirates ID expiry'), T('visa_no', 'Visa / residence no.'), D('visa_expiry', 'Visa expiry', { list: true }), T('labour_card_no', 'Labour card no.'),
      D('health_card_expiry', 'Health insurance expiry'), T('work_permit_no', 'Work permit no.'), D('work_permit_expiry', 'Work permit / labour contract expiry', { list: false }),
      S('iloe_status', 'Unemployment insurance (ILOE)', ['Subscribed', 'Not subscribed', 'Exempt'], { default: 'Not subscribed' }),
      M('basic_salary', 'Basic salary', { section: 'Compensation' }), M('housing_allowance', 'Housing'), M('transport_allowance', 'Transport'), M('other_allowance', 'Other allowances'), T('bank_iban', 'Salary IBAN'), T('bank_routing_code', 'Bank routing code (WPS, 9 digits)'), T('bank_name', 'Salary bank'), T('mol_person_id', 'MOHRE person ID (WPS, 14 digits)'),
      N('annual_leave_days', 'Annual leave entitlement', { default: 30 }), TA('notes', 'Notes'),
    ],
  },
  {
    key: 'leave_requests', label: 'Leave request', plural: 'Leave requests', module: 'hr', icon: 'Plane', title: ['id'], panel: true, statusField: 'status', calendar: { field: 'from_date' },
    fields: [
      R('employee_id', 'Employee', 'employees', { required: true, list: true, section: 'Leave' }), S('type', 'Leave type', ['Annual', 'Sick', 'Unpaid', 'Maternity / paternity', 'Compassionate', 'Hajj', 'Public holiday swap'], { required: true, list: true }),
      D('from_date', 'From', { required: true, list: true }), D('to_date', 'To', { required: true, list: true }), N('days', 'Days', { list: true }),
      S('status', 'Status', ['Pending', 'Approved', 'Rejected', 'Cancelled'], { default: 'Pending', list: true, readonly: true }), R('approver_id', 'Approver', 'users', { readonly: true }), TA('reason', 'Reason'),
    ],
    defaultSort: { field: 'from_date', dir: 'desc' },
  },
  {
    key: 'attendance', label: 'Attendance', plural: 'Attendance', module: 'hr', icon: 'Clock', title: ['id'],
    fields: [
      R('employee_id', 'Employee', 'employees', { required: true, list: true, section: 'Attendance' }), D('att_date', 'Date', { required: true, default: 'today', list: true }),
      DT('check_in', 'Check-in', { list: true }), DT('check_out', 'Check-out', { list: true }), N('hours', 'Hours', { computed: true, list: true }),
      S('status', 'Status', ['Present', 'Absent', 'Late', 'Half day', 'Remote', 'On leave', 'Public holiday'], { default: 'Present', list: true }), T('note', 'Note'),
    ],
    defaultSort: { field: 'att_date', dir: 'desc' },
  },
  {
    key: 'payslips', label: 'Payslip', plural: 'Payroll', module: 'hr', icon: 'BadgeDollarSign', title: ['period'], panel: true, statusField: 'status', print: 'payslip',
    description: 'Internal payroll records. Generation calculates pay from the employee record; bank/WPS salary transfer files are produced outside this system.',
    fields: [
      R('employee_id', 'Employee', 'employees', { required: true, list: true, section: 'Payslip' }), T('period', 'Period (YYYY-MM)', { required: true, list: true }),
      M('basic', 'Basic', { list: true }), M('allowances', 'Allowances'), M('overtime', 'Overtime'), M('deductions', 'Deductions'), M('net_pay', 'Net pay', { computed: true, list: true }),
      N('unpaid_days', 'Unpaid leave days'), S('status', 'Status', ['Draft', 'Approved', 'Paid'], { default: 'Draft', list: true }), D('paid_on', 'Paid on'), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'period', dir: 'desc' },
  },
  // ---------------- Support
  {
    key: 'tickets', label: 'Ticket / Complaint', plural: 'Complaints & tickets', module: 'support', icon: 'LifeBuoy', title: ['ticket_no', 'subject'], titleSep: ' – ', panel: true, statusField: 'status',
    numbering: { field: 'ticket_no', pattern: 'TKT{YY}{seq:5}' },
    fields: [
      T('ticket_no', 'Ticket no.', { readonly: true, list: true, search: true, section: 'Ticket' }), T('subject', 'Subject', { required: true, list: true, search: true, span: 2 }),
      S('type', 'Type', ['Complaint', 'Query', 'Service request', 'Cargo damage', 'Delay', 'Billing dispute', 'Documentation issue'], { default: 'Complaint', list: true }), S('priority', 'Priority', ['Low', 'Medium', 'High', 'Urgent'], { default: 'Medium', list: true }),
      S('status', 'Status', ['Open', 'In progress', 'Waiting on customer', 'Resolved', 'Closed'], { default: 'Open', list: true }), R('customer_id', 'Customer', 'parties', { list: true }), R('job_id', 'Master job', 'jobs', { list: true }),
      R('assigned_to', 'Assigned to', 'users', { list: true }), DT('due_at', 'SLA due', { list: true }), DT('resolved_at', 'Resolved at', { readonly: true }), T('link_entity', 'Linked record type', { hidden: true }), I('link_id', 'Linked record id', { hidden: true }),
      TA('description', 'Description'), TA('resolution', 'Resolution / root cause'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'claims', label: 'Cargo claim', plural: 'Cargo claims', module: 'support', icon: 'ShieldAlert', title: ['claim_no'], panel: true, statusField: 'status',
    numbering: { field: 'claim_no', pattern: 'CLM{YY}{seq:4}' },
    fields: [
      T('claim_no', 'Claim no.', { readonly: true, list: true, search: true, section: 'Claim' }), R('job_id', 'Master job', 'jobs', { required: true, list: true }), R('customer_id', 'Claimant', 'parties', { list: true }),
      S('type', 'Type', ['Damage', 'Shortage', 'Loss', 'Delay', 'Misdelivery', 'Contamination'], { list: true }), S('status', 'Status', ['Reported', 'Under investigation', 'Submitted to insurer', 'Settled', 'Rejected', 'Closed'], { default: 'Reported', list: true }),
      D('incident_date', 'Incident date', { list: true }), M('claim_amount', 'Claim amount', { list: true }), M('settled_amount', 'Settled amount'), T('liable_party', 'Liable party'), T('insurer', 'Insurer'), T('insurance_ref', 'Insurance claim ref.'),
      TA('description', 'Description of loss / damage'), TA('resolution', 'Resolution'),
    ],
  },
  {
    key: 'insurance_certs', label: 'Insurance certificate', plural: 'Cargo insurance', module: 'support', icon: 'Umbrella', title: ['certificate_no'], panel: true, print: 'insurance',
    numbering: { field: 'certificate_no', pattern: 'INS{YY}{seq:5}' },
    fields: [
      T('certificate_no', 'Certificate no.', { readonly: true, list: true, search: true, section: 'Insurance' }), R('job_id', 'Master job', 'jobs', { required: true, list: true }), R('customer_id', 'Insured', 'parties', { list: true }), T('insurer', 'Insurer', { list: true }), T('policy_no', 'Policy no.', { list: true }),
      S('cover_type', 'Cover', ['All risks (ICC A)', 'ICC B', 'ICC C', 'Air cargo all risks', 'Road transit'], { list: true }), T('voyage', 'Voyage / transit', { span: 2 }), S('currency', 'Currency', ['AED', 'USD', 'EUR'], { default: 'USD' }), M('insured_value', 'Sum insured', { list: true }),
      P('rate_pct', 'Premium rate %'), M('premium', 'Premium', { list: true }), D('cover_from', 'Cover from'), D('cover_to', 'Cover to'), T('commodity', 'Commodity'), TA('notes', 'Special conditions'),
    ],
  },
  // ---------------- Projects & tasks
  {
    key: 'projects', label: 'Project', plural: 'Projects', module: 'projects', icon: 'FolderKanban', title: ['name'], panel: true, statusField: 'status',
    fields: [
      T('name', 'Project', { required: true, list: true, search: true, span: 2, section: 'Project' }), R('customer_id', 'Customer', 'parties', { list: true }), R('job_id', 'Master job', 'jobs'), R('manager_id', 'Project manager', 'users', { list: true }),
      S('status', 'Status', ['Planned', 'Active', 'On hold', 'Completed', 'Cancelled'], { default: 'Planned', list: true }), D('start_date', 'Start', { list: true }), D('end_date', 'Due', { list: true }), M('budget', 'Budget'), TA('description', 'Scope'),
    ],
  },
  {
    key: 'tasks', label: 'Task', plural: 'Tasks & follow-ups', module: 'projects', icon: 'ListChecks', title: ['title'], panel: true, statusField: 'status', kanban: { field: 'status' }, calendar: { field: 'due_date' },
    fields: [
      T('title', 'Task', { required: true, list: true, search: true, span: 2, section: 'Task' }), S('status', 'Status', ['To do', 'In progress', 'Blocked', 'Done'], { default: 'To do', list: true }), S('priority', 'Priority', ['Low', 'Medium', 'High', 'Urgent'], { default: 'Medium', list: true }),
      D('due_date', 'Due date', { list: true }), R('assignee_id', 'Assigned to', 'users', { default: 'me', list: true }), R('project_id', 'Project', 'projects'), S('kind', 'Kind', ['Task', 'Follow-up', 'Approval', 'Document chase', 'Payment reminder'], { default: 'Task', list: true }),
      T('link_entity', 'Linked record type', { hidden: true }), I('link_id', 'Linked record id', { hidden: true }), T('link_label', 'Linked record', { list: true, readonly: true }), DT('completed_at', 'Completed at', { readonly: true }), TA('description', 'Details'),
    ],
    defaultSort: { field: 'due_date', dir: 'asc' },
  },
  // ---------------- Assets & procurement
  {
    key: 'fixed_assets', label: 'Asset', plural: 'Fixed assets', module: 'assets', icon: 'Armchair', title: ['asset_no', 'name'], titleSep: ' – ', panel: true,
    numbering: { field: 'asset_no', pattern: 'AST{seq:4}' }, statusField: 'status',
    fields: [
      T('asset_no', 'Asset no.', { readonly: true, list: true, search: true, section: 'Asset' }), T('name', 'Name', { required: true, list: true, search: true, span: 2 }), S('category', 'Category', ['Vehicles', 'Warehouse equipment', 'IT equipment', 'Furniture', 'Office equipment', 'Leasehold improvements', 'Other'], { list: true }),
      S('status', 'Status', ['In use', 'In storage', 'Under repair', 'Disposed'], { default: 'In use', list: true }), D('purchase_date', 'Purchase date', { list: true }), M('cost', 'Cost', { list: true }), I('life_years', 'Useful life (years)', { default: 5 }), M('salvage_value', 'Salvage value'),
      T('serial_no', 'Serial no.'), T('location', 'Location'), R('assigned_to', 'Assigned to', 'employees'), R('vendor_id', 'Supplier', 'parties'), D('warranty_expiry', 'Warranty expiry'), D('next_maintenance', 'Next maintenance'), TA('notes', 'Notes'),
    ],
  },
  {
    key: 'purchase_orders', label: 'Purchase order', plural: 'Purchase orders', module: 'assets', icon: 'ShoppingCart', title: ['po_no'], panel: true, statusField: 'status', print: 'po',
    numbering: { field: 'po_no', pattern: 'PO{YY}{seq:5}' },
    children: [{ key: 'lines', label: 'Items', entity: 'po_lines', fk: 'po_id' }],
    fields: [
      T('po_no', 'PO no.', { readonly: true, list: true, search: true, section: 'Purchase order' }), R('vendor_id', 'Supplier', 'parties', { required: true, refFilter: { is_vendor: 1 }, list: true }), D('po_date', 'Date', { required: true, default: 'today', list: true }), D('expected_date', 'Expected', { list: true }),
      S('status', 'Status', ['Draft', 'Pending approval', 'Approved', 'Ordered', 'Received', 'Cancelled'], { default: 'Draft', list: true }), S('currency', 'Currency', ['AED', 'USD', 'EUR'], { default: 'AED' }), R('requested_by', 'Requested by', 'users', { default: 'me' }),
      M('subtotal', 'Subtotal', { computed: true }), M('vat_total', 'VAT', { computed: true }), M('total', 'Total', { computed: true, list: true }), R('approved_by', 'Approved by', 'users', { readonly: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'po_lines', label: 'PO line', plural: 'PO lines', module: 'assets', icon: 'List', title: ['description'], child: true,
    fields: [
      R('po_id', 'PO', 'purchase_orders', { hidden: true }), T('description', 'Item / description', { required: true }), N('qty', 'Qty', { default: 1 }), M('rate', 'Rate'), P('vat_pct', 'VAT %', { default: 5 }), M('amount', 'Amount', { computed: true }), M('vat_amount', 'VAT', { computed: true, hidden: true }),
    ],
  },
]
