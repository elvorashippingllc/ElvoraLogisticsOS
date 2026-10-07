import type { EntityDef } from '../shared/types'
import type { Ctx, Rec } from './engine'
import { jobHooks, shipmentHooks, customsHooks, customsLineHooks, transportHooks, doHooks, bookingHooks } from './domain/jobs'
import { quoteHooks, partyHooks, leadHooks, opportunityHooks, contractHooks } from './domain/sales'
import { invoiceHooks, billHooks, receiptHooks, paymentHooks, journalHooks, expenseHooks, bankTxnHooks } from './domain/finance'
import { grnHooks, dispatchHooks, itemHooks } from './domain/warehouse'
import { withCompliance, COMPLIANCE_KEYS } from './domain/compliance'
import { userHooks, roleHooks, branchHooks, taskHooks, ticketHooks, leaveHooks, attendanceHooks, payslipHooks, poHooks, currencyHooks, activityHooks, apiKeyHooks, attachmentHooks } from './domain/misc'

export interface HookArgs { def: EntityDef; rec: Rec; old: Rec | null; children: Record<string, Rec[]>; isNew: boolean; ctx: Ctx }
export interface DeleteArgs { def: EntityDef; rec: Rec; ctx: Ctx }
export interface Hooks {
  tokens?: (rec: Rec) => Record<string, string>
  numberDate?: (rec: Rec) => string
  beforeSave?: (a: HookArgs) => void
  afterSave?: (a: HookArgs) => void
  beforeDelete?: (a: DeleteArgs) => void
}

// Lazy registry: domain modules import the engine, the engine imports this file.
const registry: Record<string, () => Hooks> = {
  jobs: () => jobHooks, shipments: () => shipmentHooks, customs_declarations: () => customsHooks, customs_lines: () => customsLineHooks,
  transport_orders: () => transportHooks, delivery_orders: () => doHooks, bookings: () => bookingHooks,
  quotations: () => quoteHooks, parties: () => partyHooks, leads: () => leadHooks, opportunities: () => opportunityHooks, contracts: () => contractHooks,
  invoices: () => invoiceHooks, bills: () => billHooks, receipts: () => receiptHooks, payments: () => paymentHooks, journal_entries: () => journalHooks,
  expenses: () => expenseHooks, bank_transactions: () => bankTxnHooks,
  grns: () => grnHooks, dispatches: () => dispatchHooks, items: () => itemHooks,
  users: () => userHooks, roles: () => roleHooks, branches: () => branchHooks, tasks: () => taskHooks, tickets: () => ticketHooks, leave_requests: () => leaveHooks,
  attendance: () => attendanceHooks, payslips: () => payslipHooks, purchase_orders: () => poHooks, currencies: () => currencyHooks, activities: () => activityHooks,
  api_keys: () => apiKeyHooks, attachments: () => attachmentHooks,
}
const NONE: Hooks = {}
const wrapped = new Map<string, Hooks>()
export function hooksFor(key: string): Hooks {
  const base = registry[key]?.() ?? NONE
  if (!COMPLIANCE_KEYS.has(key)) return base
  let w = wrapped.get(key)
  if (!w) { w = withCompliance(key, base); wrapped.set(key, w) }
  return w
}
