import { config } from './config'

export class HttpError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}
export const bad = (msg: string, details?: unknown) => new HttpError(400, msg, details)
export const forbidden = (msg = 'You do not have permission to do this') => new HttpError(403, msg)
export const notFound = (msg = 'Record not found') => new HttpError(404, msg)
export const conflict = (msg: string) => new HttpError(409, msg)

// ---------- money (stored as integer minor units, API uses decimals)
export const toCents = (v: unknown): number => Math.round((Number(v) || 0) * 100 + (Number(v) < 0 ? -1e-9 : 1e-9))
export const fromCents = (c: unknown): number => (c === null || c === undefined ? 0 : Number(c) / 100)
export const r2 = (v: number): number => Math.round((v + (v < 0 ? -1e-9 : 1e-9)) * 100) / 100
export const r4 = (v: number): number => Math.round((v + (v < 0 ? -1e-9 : 1e-9)) * 10000) / 10000

// ---------- dates in the company time zone
function parts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(d)) o[p.type] = p.value
  return o
}
export const todayStr = (d = new Date()) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}` }
export const nowLocal = (d = new Date()) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` }
export const nowIso = () => new Date().toISOString()
export function addDays(date: string, days: number): string {
  const d = new Date(date.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000)

export function monthStart(d = todayStr()) { return d.slice(0, 8) + '01' }
export function yearStart(d = todayStr()) { return d.slice(0, 5) + '01-01' }

// ---------- csv
export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  // neutralise spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
export function toCsv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\r\n')
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur)
  if (row.some(x => x !== '')) rows.push(row)
  return rows
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
export function safeJson<T = any>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
