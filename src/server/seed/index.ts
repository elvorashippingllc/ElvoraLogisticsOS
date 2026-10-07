import { q } from '../db'
import { config } from '../config'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { nowIso, todayStr } from '../util'
import * as D from './data'
import { seedCompliance } from './compliance'

const done = (g: string) => !!q.val(`SELECT 1 FROM settings WHERE key = ?`, `seed:${g}`)
const mark = (g: string) => q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, `seed:${g}`, nowIso())
const idOf = (table: string, col: string, val: string) => q.val<number>(`SELECT id FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`, val)

export function seedReference(opts: { users?: boolean; demo?: boolean } = {}) {
  const withUsers = opts.users !== false
  const mk = (key: string, payload: Record<string, any>) => createRecord(getDef(key), payload, SYSTEM_CTX)

  if (!done('roles')) {
    for (const r of D.ROLES) mk('roles', { name: r.name, description: r.description, is_system: !!r.system, permissions: r.permissions })
    q.run(`UPDATE roles SET is_system = 1 WHERE name IN ('Admin','Manager')`)
    mark('roles')
  }
  if (!done('branches')) {
    mk('branches', { code: 'DXB', name: 'Dubai – Head Office', city: 'Dubai', country: 'United Arab Emirates', is_head_office: true, active: true })
    mark('branches')
  }
  if (!done('legal_entity')) {
    const id = mk('legal_entities', { code: 'ELV', name: 'Elvora Shipping L.L.C.', base_currency: config.baseCurrency, is_default: true, active: true }).id
    q.run(`UPDATE branches SET legal_entity_id = ? WHERE legal_entity_id IS NULL`, id)
    mark('legal_entity')
  }
  if (!done('departments')) {
    for (const [code, name] of [['OPS', 'Operations'], ['SAL', 'Sales & Business Development'], ['ACC', 'Accounts & Finance'], ['DOC', 'Documentation & Customs'], ['WHS', 'Warehouse & Transport'], ['HR', 'Human Resources'], ['MGT', 'Management']]) mk('departments', { code, name })
    mark('departments')
  }
  if (withUsers && !done('users')) {
    const a = config.accounts
    const dxb = idOf('branches', 'code', 'DXB')
    for (const [email, name, pw, role] of [[a.adminEmail, a.adminName, a.adminPassword, 'Admin'], [a.managerEmail, a.managerName, a.managerPassword, 'Manager']] as const) {
      if (!idOf('users', 'lower(email)', email)) mk('users', { name, email, password: pw, role_id: idOf('roles', 'name', role), branch_id: dxb, department_id: idOf('departments', 'code', role === 'Admin' ? 'MGT' : 'OPS'), active: true, must_change_password: true })
    }
    mark('users')
  }
  if (!done('countries')) {
    const names = new Intl.DisplayNames(['en'], { type: 'region' })
    for (const code of D.ISO_COUNTRIES) {
      let name = code
      try { name = names.of(code) ?? code } catch { /* keep code */ }
      const region = D.REGIONS.find(([, s]) => s.has(code))?.[0] ?? 'Other'
      mk('countries', { code, name, region, currency: D.CURRENCY_BY_COUNTRY[code] ?? null, active: true })
    }
    mark('countries')
  }
  if (!done('currencies')) {
    for (const [code, name, symbol] of D.CURRENCIES) mk('currencies', { code, name, symbol, rate: code === 'AED' ? 1 : code === 'USD' ? 3.6725 : null, active: true })
    mark('currencies')
  }
  if (!done('uoms')) { for (const [code, name] of D.UOMS) mk('uoms', { code, name }); mark('uoms') }
  if (!done('vat')) { for (const [code, name, rate, category] of D.VAT_CODES) mk('vat_codes', { code, name, rate, category }); mark('vat') }
  if (!done('terms')) { for (const [name, days] of D.PAYMENT_TERMS) mk('payment_terms', { name, days }); mark('terms') }
  if (!done('service_types')) { for (const name of D.SERVICE_TYPES) mk('service_types', { name }); mark('service_types') }
  if (!done('accounts')) {
    for (const [code, name, type, subtype, role] of D.ACCOUNTS) mk('accounts', { code, name, type, subtype, role: role ?? '', active: true })
    mark('accounts')
  }
  if (!done('charges')) {
    for (const [code, name, applies_to, group, uom, vat, inc, cost] of D.CHARGE_CODES) {
      mk('charge_codes', { code, name, applies_to, group, uom_id: idOf('uoms', 'code', uom), vat_code_id: idOf('vat_codes', 'code', vat), income_account_id: idOf('accounts', 'code', inc), cost_account_id: idOf('accounts', 'code', cost), active: true })
    }
    mark('charges')
  }
  if (!done('carriers')) {
    for (const [name, type, code, awb_prefix, website, tracking_url] of D.CARRIERS) mk('carriers', { name, type, code: code || null, awb_prefix: awb_prefix || null, website, tracking_url: tracking_url || null, active: true })
    mark('carriers')
  }
  if (!done('container_types')) {
    for (const [code, name, iso, teu, tare, payload, cbm] of D.CONTAINER_TYPES) mk('container_types', { code, name, iso_code: iso || null, teu, tare_kg: tare || null, max_payload_kg: payload || null, cbm: cbm || null })
    mark('container_types')
  }
  if (!done('locations')) {
    for (const [code, name, cc, type, iata] of D.LOCATIONS) {
      const country = idOf('countries', 'code', cc)
      if (country) mk('locations', { code, name, country_id: country, type, iata: iata ?? null, active: true })
    }
    mark('locations')
  }
  if (!done('banks')) {
    mk('bank_accounts', { name: 'Main operating account (AED)', type: 'Bank', currency: 'AED', gl_account_id: idOf('accounts', 'code', '1100'), active: true })
    mk('bank_accounts', { name: 'Cash in hand', type: 'Cash', currency: 'AED', gl_account_id: idOf('accounts', 'code', '1000'), active: true })
    mk('bank_accounts', { name: 'Petty cash', type: 'Petty cash', currency: 'AED', gl_account_id: idOf('accounts', 'code', '1010'), active: true })
    mark('banks')
  }
  if (!done('compliance')) { seedCompliance({ demo: opts.demo }); mark('compliance') }
}
