import { q } from './db'
import { nowIso, safeJson } from './util'
import { config } from './config'

export const SETTING_DEFAULTS: Record<string, any> = {
  company_name: 'Elvora Shipping L.L.C.',
  company_address: 'Dubai, United Arab Emirates',
  company_phone: '',
  company_email: 'sales@elvorashipping.com',
  company_website: 'https://www.elvorashipping.com',
  company_trn: '',
  company_trade_license: '',
  base_currency: config.baseCurrency,
  quote_validity_days: 14,
  min_margin_pct: 8,
  bill_approval_limit: 25000,
  payment_approval_limit: 25000,
  lock_date: '',
  quote_terms: 'Rates are indicative and subject to space and equipment availability at the time of booking. Carrier surcharges, THC, BAF and other charges are as applicable on the date of shipment. Cargo is handled under the Company\'s standard trading conditions. Demurrage, detention, storage and any statutory charges are for the account of the cargo owner. This quotation does not include cargo insurance unless stated.',
  invoice_terms: 'Payment is due by the due date shown. Please quote the invoice number on remittance. Queries must be raised within 7 days of the invoice date. Late payment may attract a handling charge and suspension of credit.',
  invoice_footer: 'This is a computer-generated document.',
  bank_details: '',
  smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', smtp_from: '', smtp_secure: false,
  tracking_public_enabled: true,
  weight_divisor_air: 6000,
  weight_divisor_courier: 5000,
  free_days_default: 7,
  seeded: {},
}
export const SECRET_SETTINGS = new Set(['smtp_pass'])

let cache: Record<string, any> | null = null
export function loadSettings(): Record<string, any> {
  if (!cache) {
    cache = { ...SETTING_DEFAULTS }
    for (const r of q.all<{ key: string; value: string }>('SELECT key, value FROM settings')) cache[r.key] = safeJson(r.value, null)
    // environment overrides for SMTP so secrets can live outside the DB
    const s = config.smtp
    if (s.host && !cache.smtp_host) { cache.smtp_host = s.host; cache.smtp_port = s.port; cache.smtp_user = s.user; cache.smtp_pass = s.pass; cache.smtp_from = s.from; cache.smtp_secure = s.secure }
  }
  return cache
}
export const getSetting = <T = any>(key: string): T => loadSettings()[key] as T
export function setSettings(patch: Record<string, any>) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in SETTING_DEFAULTS)) continue
    q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, k, JSON.stringify(v), nowIso())
  }
  cache = null
}
export function publicSettings(includeSecrets = false) {
  const s = { ...loadSettings() }
  delete s.seeded
  if (!includeSecrets) for (const k of SECRET_SETTINGS) s[k] = s[k] ? '********' : ''
  return s
}
