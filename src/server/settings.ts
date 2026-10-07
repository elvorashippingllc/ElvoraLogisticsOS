import { q, currentDb, inDemo } from './db'
import { nowIso, safeJson } from './util'
import { config, dirs } from './config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

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
  // --- e-mail (Resend / SMTP)
  mail_provider: 'auto', resend_api_key: '', resend_from: '',
  // --- file storage (Cloudflare R2, S3 compatible)
  storage_provider: 'local', r2_account_id: '', r2_access_key_id: '', r2_secret_access_key: '', r2_bucket: '', r2_backup_nightly: true,
  // --- Supabase (Postgres replica for BI / disaster recovery)
  supabase_url: '', supabase_service_key: '', supabase_sync: false, supabase_cursors: {},
  // --- WhatsApp Cloud API
  wa_enabled: false, wa_phone_number_id: '', wa_access_token: '', wa_verify_token: '', wa_app_secret: '', wa_owner_numbers: '', wa_default_country_code: '971',
  wa_template_lang: 'en', wa_tpl_notify: '', wa_tpl_reminder: '', wa_tpl_report: '',
  wa_auto_leads: true, wa_auto_milestones: false, wa_auto_overdue: false, wa_owner_daily_report: false, wa_staff_bot: true, wa_customer_bot: true,
  // --- AI
  ai_enabled: false, ai_provider: 'groq', ai_base_url: '', ai_api_key: '', ai_model: '', ai_fallback_provider: '', ai_fallback_base_url: '', ai_fallback_api_key: '', ai_fallback_model: '', ai_company_context: '',
  // --- tracking
  tracking_provider: 'none', tracking_api_key: '', tracking_webhook_secret: '',
  // --- e-invoicing (UAE PINT AE / Peppol)
  einv_enabled: false, einv_endpoint: '', einv_api_key: '', einv_endpoint_id: '', einv_scheme_id: '0235', einv_auto_submit: false,
  // --- EDI transmission & customs gateway
  edi_transport: 'none', edi_http_url: '', edi_http_auth: '', edi_email_to: '', edi_sftp_host: '', edi_sftp_port: 22, edi_sftp_user: '', edi_sftp_pass: '', edi_sftp_dir: '/',
  customs_gateway_url: '', customs_gateway_key: '',
  // --- bank feed
  bank_webhook_secret: '',
  // --- WPS
  wps_employer_id: '', wps_bank_routing: '', wps_employer_ref: '',
  // --- UAE compliance
  company_name_ar: '', licence_name_en: '', licence_authority: '', licence_issue_date: '', licence_expiry_date: '', dcci_no: '', commercial_register_no: '', company_legal_form: '',
  vat_registered: true, vat_filing_frequency: 'Quarterly', ct_registered: false, ct_trn: '', financial_year_end: '12-31', einv_revenue_over_50m: false,
  compliance_mode: 'enforce', activity_scope_mode: 'warn', sanctions_review_days: 365,
  ui_lang: 'en',
  seeded: {},
}
export const SECRET_SETTINGS = new Set(['smtp_pass', 'resend_api_key', 'r2_secret_access_key', 'supabase_service_key', 'wa_access_token', 'wa_app_secret', 'ai_api_key', 'ai_fallback_api_key', 'tracking_api_key', 'tracking_webhook_secret', 'einv_api_key', 'edi_http_auth', 'edi_sftp_pass', 'customs_gateway_key', 'bank_webhook_secret'])

const caches = new WeakMap<object, Record<string, any>>()
export function loadSettings(): Record<string, any> {
  let cache = caches.get(currentDb()) ?? null
  if (!cache) {
    cache = { ...SETTING_DEFAULTS }
    caches.set(currentDb(), cache)
    for (const r of q.all<{ key: string; value: string }>('SELECT key, value FROM settings')) { const val = safeJson(r.value, null); cache[r.key] = SECRET_SETTINGS.has(r.key) && typeof val === 'string' ? decryptSecret(val) : val }
    // environment overrides for SMTP so secrets can live outside the DB
    const s = config.smtp
    if (s.host && !cache.smtp_host && !inDemo()) { cache.smtp_host = s.host; cache.smtp_port = s.port; cache.smtp_user = s.user; cache.smtp_pass = s.pass; cache.smtp_from = s.from; cache.smtp_secure = s.secure }
  }
  return cache
}
export const getSetting = <T = any>(key: string): T => loadSettings()[key] as T
export function setSettings(patch: Record<string, any>) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in SETTING_DEFAULTS)) continue
    const stored = SECRET_SETTINGS.has(k) && typeof v === 'string' && v ? encryptSecret(v) : v
    q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, k, JSON.stringify(stored), nowIso())
  }
  caches.delete(currentDb())
}
export function publicSettings(includeSecrets = false) {
  const s = { ...loadSettings() }
  delete s.seeded; delete s.supabase_cursors
  if (!includeSecrets) for (const k of SECRET_SETTINGS) s[k] = s[k] ? '********' : ''
  return s
}

// ---- secret encryption (AES-256-GCM). Key: APP_SECRET env var, or an auto-generated key file in the data directory.
let key: Buffer | null = null
function secretKey(): Buffer {
  if (key) return key
  const env = process.env.APP_SECRET
  if (env) key = crypto.createHash('sha256').update(env).digest()
  else {
    const f = path.join(dirs.data, '.secret')
    if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 })
    key = Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex')
  }
  return key
}
export function encryptSecret(v: string): string {
  if (!v || v.startsWith('enc:v1:')) return v
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv)
  const enc = Buffer.concat([c.update(v, 'utf8'), c.final()])
  return 'enc:v1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')
}
export function decryptSecret(v: string): string {
  if (typeof v !== 'string' || !v.startsWith('enc:v1:')) return v
  try {
    const b = Buffer.from(v.slice(7), 'base64'), d = crypto.createDecipheriv('aes-256-gcm', secretKey(), b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
  } catch { return '' }
}
