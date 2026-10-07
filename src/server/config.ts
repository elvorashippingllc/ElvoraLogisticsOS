import path from 'node:path'
import fs from 'node:fs'

const env = process.env
const bool = (v: string | undefined, d: boolean) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()))

if (process.env.REQUIRE_DATABASE_URL === 'true' && !process.env.DATABASE_URL) {
  // Hosts with a disposable disk (e.g. Cloudflare Containers) set this so a missing secret can never silently create a throw-away SQLite database.
  throw new Error('DATABASE_URL is required on this host but is not set. Refusing to start on a local database file.')
}

export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd: (env.NODE_ENV ?? 'development') === 'production',
  port: Number(env.PORT ?? 8080),
  host: env.HOST ?? '0.0.0.0',
  dataDir: path.resolve(env.DATA_DIR ?? 'data'),
  /** When set, the app runs on PostgreSQL (e.g. Supabase) instead of the local SQLite file. */
  databaseUrl: env.DATABASE_URL ?? '',
  pgSchema: (env.PG_SCHEMA ?? 'elvora').replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'elvora',
  baseUrl: env.PUBLIC_URL ?? '',
  timezone: env.APP_TIMEZONE ?? 'Asia/Dubai',
  baseCurrency: env.BASE_CURRENCY ?? 'AED',
  cookieSecure: env.COOKIE_SECURE === undefined ? undefined : bool(env.COOKIE_SECURE, true),
  sessionHours: Number(env.SESSION_HOURS ?? 12),
  trustProxy: bool(env.TRUST_PROXY, false),
  maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 25),
  demo: { enabled: bool(env.DEMO_ENABLED, true), email: (env.DEMO_EMAIL ?? 'demo@elvorashipping.com').toLowerCase(), password: env.DEMO_PASSWORD ?? 'Demo@Elvora2026' },
  accounts: {
    adminEmail: (env.ADMIN_EMAIL ?? 'admin@elvorashipping.com').toLowerCase(),
    adminName: env.ADMIN_NAME ?? 'System Administrator',
    adminPassword: env.ADMIN_PASSWORD ?? 'Elvora@Admin2026',
    managerEmail: (env.MANAGER_EMAIL ?? 'manager@elvorashipping.com').toLowerCase(),
    managerName: env.MANAGER_NAME ?? 'Operations Manager',
    managerPassword: env.MANAGER_PASSWORD ?? 'Elvora@Manager2026',
  },
  smtp: {
    host: env.SMTP_HOST ?? '',
    port: Number(env.SMTP_PORT ?? 587),
    user: env.SMTP_USER ?? '',
    pass: env.SMTP_PASS ?? '',
    from: env.SMTP_FROM ?? '',
    secure: bool(env.SMTP_SECURE, false),
  },
}

export const dirs = {
  demo: path.join(config.dataDir, 'demo'),
  data: config.dataDir,
  uploads: path.join(config.dataDir, 'uploads'),
  backups: path.join(config.dataDir, 'backups'),
  db: path.join(config.dataDir, 'elvora.db'),
}

export function ensureDirs() {
  for (const d of [dirs.data, dirs.uploads, dirs.backups, dirs.demo]) fs.mkdirSync(d, { recursive: true })
}

/** Backup files: a copy of the SQLite file, or a gzip NDJSON snapshot when running on PostgreSQL. */
export const BACKUP_EXT = config.databaseUrl ? '.json.gz' : '.db'
export const isBackupFile = (f: string) => f.endsWith('.db') || f.endsWith('.json.gz')
