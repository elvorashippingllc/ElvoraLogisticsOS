import type { EntityDef, NavGroup } from '../types'
import { platform } from './platform'
import { masters } from './masters'
import { crm } from './crm'
import { ops } from './ops'
import { transportWarehouse } from './operations2'
import { finance } from './finance'
import { people } from './people'
import { automation } from './automation'
import { compliance } from './compliance'

export { MODULE_DEFS } from './platform'
export * from './ops'
export { INCOTERMS, PACKAGE_TYPES } from './masters'

export const ENTITY_LIST: EntityDef[] = [...platform, ...masters, ...crm, ...ops, ...transportWarehouse, ...finance, ...people, ...automation, ...compliance]
export const ENTITIES: Record<string, EntityDef> = Object.fromEntries(ENTITY_LIST.map(e => [e.key, e]))

export function validateMeta(): string[] {
  const errs: string[] = []
  for (const e of ENTITY_LIST) {
    const names = new Set<string>()
    for (const f of e.fields) {
      if (names.has(f.name)) errs.push(`${e.key}.${f.name} duplicated`)
      names.add(f.name)
      if (['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at', 'version', 'custom'].includes(f.name)) errs.push(`${e.key}.${f.name} is reserved`)
      if (f.type === 'ref' && !ENTITIES[f.ref!]) errs.push(`${e.key}.${f.name} -> unknown entity ${f.ref}`)
      if (f.type === 'select' && !f.options?.length) errs.push(`${e.key}.${f.name} select without options`)
    }
    for (const c of e.children ?? []) {
      const ce = ENTITIES[c.entity]
      if (!ce) errs.push(`${e.key}.${c.key} child entity ${c.entity} missing`)
      else if (!ce.fields.find(f => f.name === c.fk)) errs.push(`${c.entity}.${c.fk} fk missing`)
    }
    for (const n of e.title) if (!names.has(n) && n !== 'id') errs.push(`${e.key} title field ${n} missing`)
  }
  return errs
}

export const NAV: NavGroup[] = [
  { label: 'Operations', icon: 'Ship', items: [
    { label: 'Master Jobs', to: '/e/jobs', icon: 'Briefcase', module: 'jobs' },
    { label: 'Shipments (Sub-Jobs)', to: '/e/shipments', icon: 'PackageCheck', module: 'jobs' },
    { label: 'Carrier Bookings', to: '/e/bookings', icon: 'CalendarCheck', module: 'jobs' },
    { label: 'Delivery Orders', to: '/e/delivery_orders', icon: 'FileOutput', module: 'jobs' },
    { label: 'Track & Trace', to: '/tracking', icon: 'MapPinned', module: 'jobs' },
    { label: 'Customs (SB / BOE)', to: '/e/customs_declarations', icon: 'Stamp', module: 'customs' },
    { label: 'Job Search', to: '/search', icon: 'Search', module: 'jobs' },
  ] },
  { label: 'CRM & Sales', icon: 'Handshake', items: [
    { label: 'Customers & Parties', to: '/e/parties', icon: 'Building', module: 'crm' },
    { label: 'Contacts', to: '/e/contacts', icon: 'Contact', module: 'crm' },
    { label: 'Leads', to: '/e/leads', icon: 'UserPlus', module: 'crm' },
    { label: 'Opportunities', to: '/e/opportunities', icon: 'Target', module: 'crm' },
    { label: 'Calls & Activities', to: '/e/activities', icon: 'PhoneCall', module: 'crm' },
    { label: 'Campaigns', to: '/e/campaigns', icon: 'Megaphone', module: 'crm' },
    { label: 'Quotations', to: '/e/quotations', icon: 'FileSignature', module: 'sales' },
    { label: 'Rate Cards', to: '/e/rate_cards', icon: 'Tags', module: 'sales' },
    { label: 'Contracts', to: '/e/contracts', icon: 'FileCheck2', module: 'sales' },
  ] },
  { label: 'Transport', icon: 'Truck', items: [
    { label: 'Transport Orders', to: '/e/transport_orders', icon: 'Route', module: 'transport' },
    { label: 'Vehicles', to: '/e/vehicles', icon: 'Truck', module: 'transport' },
    { label: 'Drivers', to: '/e/drivers', icon: 'IdCard', module: 'transport' },
    { label: 'Fuel Logs', to: '/e/fuel_logs', icon: 'Fuel', module: 'transport' },
    { label: 'Maintenance', to: '/e/vehicle_services', icon: 'Wrench', module: 'transport' },
  ] },
  { label: 'Warehouse', icon: 'Warehouse', items: [
    { label: 'Stock on Hand', to: '/warehouse/stock', icon: 'Boxes', module: 'warehouse' },
    { label: 'Goods Receipts (GRN)', to: '/e/grns', icon: 'PackagePlus', module: 'warehouse' },
    { label: 'Dispatch Orders', to: '/e/dispatches', icon: 'PackageMinus', module: 'warehouse' },
    { label: 'Stock Ledger', to: '/e/stock_moves', icon: 'ArrowLeftRight', module: 'warehouse' },
    { label: 'Items (SKU)', to: '/e/items', icon: 'Barcode', module: 'warehouse' },
    { label: 'Warehouses', to: '/e/warehouses', icon: 'Warehouse', module: 'warehouse' },
    { label: 'Bins & Locations', to: '/e/wh_locations', icon: 'LayoutGrid', module: 'warehouse' },
  ] },
  { label: 'Accounts', icon: 'Landmark', items: [
    { label: 'Invoices & Notes', to: '/e/invoices', icon: 'ReceiptText', module: 'finance' },
    { label: 'Customer Receipts', to: '/e/receipts', icon: 'HandCoins', module: 'finance' },
    { label: 'Vendor Bills', to: '/e/bills', icon: 'FileInput', module: 'finance' },
    { label: 'Vendor Payments', to: '/e/payments', icon: 'Banknote', module: 'finance' },
    { label: 'Journal Entries', to: '/e/journal_entries', icon: 'NotebookPen', module: 'finance' },
    { label: 'Expense Claims', to: '/e/expenses', icon: 'Wallet', module: 'finance' },
    { label: 'Bank Accounts', to: '/e/bank_accounts', icon: 'Landmark', module: 'finance' },
    { label: 'Bank Reconciliation', to: '/e/bank_transactions', icon: 'Scale', module: 'finance' },
    { label: 'Chart of Accounts', to: '/e/accounts', icon: 'BookOpenText', module: 'finance' },
    { label: 'Financial Statements', to: '/finance/statements', icon: 'Sigma', module: 'finance' },
    { label: 'Bank Statement Import', to: '/finance/bank-import', icon: 'FileUp', module: 'finance' },
    { label: 'Year-end Close', to: '/finance/year-end', icon: 'CalendarCheck2', module: 'finance' },
    { label: 'Legal Entities', to: '/e/legal_entities', icon: 'Building2', module: 'finance' },
  ] },
  { label: 'People & Support', icon: 'Users', items: [
    { label: 'Employees', to: '/e/employees', icon: 'UserRound', module: 'hr' },
    { label: 'Leave', to: '/e/leave_requests', icon: 'Plane', module: 'hr' },
    { label: 'Attendance', to: '/e/attendance', icon: 'Clock', module: 'hr' },
    { label: 'Payroll', to: '/e/payslips', icon: 'BadgeDollarSign', module: 'hr' },
    { label: 'WPS Salary File', to: '/hr/wps', icon: 'FileSpreadsheet', module: 'hr' },
    { label: 'Complaints & Tickets', to: '/e/tickets', icon: 'LifeBuoy', module: 'support' },
    { label: 'Cargo Claims', to: '/e/claims', icon: 'ShieldAlert', module: 'support' },
    { label: 'Cargo Insurance', to: '/e/insurance_certs', icon: 'Umbrella', module: 'support' },
  ] },
  { label: 'Work', icon: 'ListChecks', items: [
    { label: 'Tasks & Follow-ups', to: '/e/tasks', icon: 'ListChecks', module: 'projects' },
    { label: 'Projects', to: '/e/projects', icon: 'FolderKanban', module: 'projects' },
    { label: 'Calendar', to: '/calendar', icon: 'CalendarDays', module: 'dashboard' },
    { label: 'Documents Library', to: '/documents', icon: 'FolderOpen', module: 'documents' },
    { label: 'Blog & Announcements', to: '/e/announcements', icon: 'Newspaper', module: 'documents' },
    { label: 'Fixed Assets', to: '/e/fixed_assets', icon: 'Armchair', module: 'assets' },
    { label: 'Purchase Orders', to: '/e/purchase_orders', icon: 'ShoppingCart', module: 'assets' },
  ] },
  { label: 'AI Team', icon: 'Bot', items: [
    { label: 'Jarvis & Employees', to: '/ai', icon: 'Bot', module: 'ai' },
    { label: 'Approvals', to: '/ai?tab=approvals', icon: 'ShieldCheck', module: 'ai' },
    { label: 'AI Activity', to: '/e/ai_runs', icon: 'Activity', module: 'ai' },
    { label: 'WhatsApp', to: '/whatsapp', icon: 'MessageCircle', module: 'crm' },
  ] },
  { label: 'Compliance (UAE)', icon: 'BadgeCheck', items: [
    { label: 'Compliance Centre', to: '/compliance', icon: 'BadgeCheck', module: 'compliance' },
    { label: 'Licences & Registrations', to: '/e/compliance_items', icon: 'FileCheck2', module: 'compliance' },
    { label: 'Licensed Activities', to: '/e/licence_activities', icon: 'ListChecks', module: 'compliance' },
    { label: 'Compliance Calendar', to: '/e/compliance_filings', icon: 'CalendarClock', module: 'compliance' },
    { label: 'Exceptions', to: '/e/compliance_exceptions', icon: 'ShieldAlert', module: 'compliance' },
  ] },
  { label: 'Reports & Tools', icon: 'BarChart3', items: [
    { label: 'Reports', to: '/reports', icon: 'BarChart3', module: 'reports' },
    { label: 'KPI Dashboard', to: '/kpi', icon: 'Gauge', module: 'reports' },
    { label: 'Freight Tools', to: '/tools', icon: 'Calculator', module: 'dashboard' },
  ] },
  { label: 'Master Data', icon: 'Database', items: [
    { label: 'Ports & Locations', to: '/e/locations', icon: 'Anchor', module: 'masters' },
    { label: 'Carriers & Airlines', to: '/e/carriers', icon: 'Ship', module: 'masters' },
    { label: 'Charge Codes', to: '/e/charge_codes', icon: 'Receipt', module: 'masters' },
    { label: 'Container Types', to: '/e/container_types', icon: 'Container', module: 'masters' },
    { label: 'Currencies', to: '/e/currencies', icon: 'Coins', module: 'masters' },
    { label: 'Exchange-rate History', to: '/e/exchange_rates', icon: 'LineChart', module: 'masters' },
    { label: 'VAT / Tax Codes', to: '/e/vat_codes', icon: 'Percent', module: 'masters' },
    { label: 'Payment Terms', to: '/e/payment_terms', icon: 'CalendarClock', module: 'masters' },
    { label: 'HS Codes', to: '/e/hs_codes', icon: 'Barcode', module: 'masters' },
    { label: 'Vessels', to: '/e/vessels', icon: 'Sailboat', module: 'masters' },
    { label: 'Countries', to: '/e/countries', icon: 'Globe2', module: 'masters' },
    { label: 'Units of Measure', to: '/e/uoms', icon: 'Ruler', module: 'masters' },
    { label: 'Service Types', to: '/e/service_types', icon: 'Route', module: 'masters' },
  ] },
  { label: 'Administration', icon: 'Settings', items: [
    { label: 'Users', to: '/e/users', icon: 'Users', module: 'admin' },
    { label: 'Roles & Permissions', to: '/admin/roles', icon: 'ShieldCheck', module: 'admin' },
    { label: 'Branches', to: '/e/branches', icon: 'Building2', module: 'admin' },
    { label: 'Departments', to: '/e/departments', icon: 'Network', module: 'admin' },
    { label: 'Company Settings', to: '/admin/settings', icon: 'Settings', module: 'admin' },
    { label: 'Integrations', to: '/admin/integrations', icon: 'Plug', module: 'admin' },
    { label: 'Integration Log', to: '/e/integration_logs', icon: 'Activity', module: 'admin' },
    { label: 'Custom Fields', to: '/e/custom_fields', icon: 'SlidersHorizontal', module: 'admin' },
    { label: 'Automation Rules', to: '/e/automation_rules', icon: 'Workflow', module: 'admin' },
    { label: 'E-mail Outbox', to: '/e/email_outbox', icon: 'Mail', module: 'admin' },
    { label: 'Webhooks', to: '/e/webhooks', icon: 'Webhook', module: 'admin' },
    { label: 'API Keys', to: '/e/api_keys', icon: 'KeyRound', module: 'admin' },
    { label: 'Audit Log', to: '/admin/audit', icon: 'ScrollText', module: 'admin' },
    { label: 'Backup & Data', to: '/admin/backup', icon: 'DatabaseBackup', module: 'admin' },
  ] },
]
