import crypto from 'node:crypto'
import { q } from '../db'
import { bad, parseCsv, toCents, fromCents, todayStr, addDays, nowIso } from '../util'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { logIntegration } from './log'

export interface StmtLine { date: string; description: string; reference: string; debit: number; credit: number }

const num = (s: string) => { const t = String(s ?? '').replace(/[^\d.,\-()]/g, ''); if (!t) return 0; const neg = /^\(.*\)$/.test(t) || t.startsWith('-'); const v = parseFloat(t.replace(/[(),-]/g, m => (m === ',' ? '' : ''))); return neg ? -Math.abs(v || 0) : v || 0 }
function isoDate(s: string): string {
  const t = String(s ?? '').trim()
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }   // day first (UAE banks)
  m = t.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{2,4})/); if (m) { const mo = 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m[2].toLowerCase()) / 3 + 1; if (mo >= 1) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  throw bad(`Unrecognised date "${s}"`)
}

export function parseCsvStatement(text: string): StmtLine[] {
  const rows = parseCsv(text)
  if (rows.length < 2) throw bad('The file has no data rows')
  const hi = rows.findIndex(r => r.some(c => /date/i.test(c)) && r.some(c => /(debit|credit|amount|withdraw|deposit)/i.test(c)))
  if (hi < 0) throw bad('Could not find a header row with Date and Amount / Debit / Credit columns')
  const h = rows[hi].map(c => c.trim().toLowerCase())
  const col = (re: RegExp) => h.findIndex(c => re.test(c))
  const cDate = col(/date/), cDesc = col(/(desc|narr|particular|detail|remark)/), cRef = col(/(ref|cheque|chq|txn id|transaction id)/)
  const cDr = col(/(debit|withdraw|paid out|dr$)/), cCr = col(/(credit|deposit|paid in|cr$)/), cAmt = col(/^amount/)
  if (cDr < 0 && cCr < 0 && cAmt < 0) throw bad('No amount columns found')
  const out: StmtLine[] = []
  for (const r of rows.slice(hi + 1)) {
    if (!r[cDate]?.trim()) continue
    let debit = 0, credit = 0
    if (cDr >= 0 || cCr >= 0) { debit = Math.abs(num(r[cDr] ?? '')); credit = Math.abs(num(r[cCr] ?? '')) } else { const a = num(r[cAmt]); if (a < 0) debit = -a; else credit = a }
    if (!debit && !credit) continue
    out.push({ date: isoDate(r[cDate]), description: (r[cDesc] ?? '').trim() || '(no description)', reference: (r[cRef] ?? '').trim(), debit, credit })
  }
  return out
}

/** SWIFT MT940 (:61: / :86: pairs). */
export function parseMt940(text: string): StmtLine[] {
  const out: StmtLine[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^:61:(\d{2})(\d{2})(\d{2})(?:\d{4})?(R?[DC])[A-Z]?([\d,]+)N\w{3}([^/\n]*)(?:\/\/(.*))?/)
    if (!m) continue
    const amount = parseFloat(m[5].replace(',', '.'))
    let desc = ''
    for (let j = i + 1; j < lines.length && !lines[j].startsWith(':61:') && !lines[j].startsWith(':62'); j++) { if (lines[j].startsWith(':86:')) desc = lines[j].slice(4); else if (!lines[j].startsWith(':')) desc += ' ' + lines[j] }
    const isDebit = m[4].endsWith('D')
    out.push({ date: `20${m[1]}-${m[2]}-${m[3]}`, description: desc.replace(/\?\d{2}/g, ' ').replace(/\s+/g, ' ').trim() || 'Bank transaction', reference: (m[7] || m[6] || '').trim(), debit: isDebit ? amount : 0, credit: isDebit ? 0 : amount })
  }
  if (!out.length) throw bad('No :61: transaction lines found in the MT940 file')
  return out
}

export function parseStatement(text: string, format?: string): StmtLine[] {
  const f = format && format !== 'auto' ? format : /:61:/.test(text) ? 'mt940' : 'csv'
  return f === 'mt940' ? parseMt940(text) : parseCsvStatement(text)
}

const fp = (acct: number, l: StmtLine) => crypto.createHash('sha1').update(`${acct}|${l.date}|${l.reference}|${l.debit}|${l.credit}|${l.description}`).digest('hex').slice(0, 24)

export function importLines(bankAccountId: number, lines: StmtLine[], source = 'import'): { imported: number; duplicates: number; matched: number } {
  if (!q.get(`SELECT id FROM bank_accounts WHERE id = ? AND deleted_at IS NULL`, bankAccountId)) throw bad('Bank account not found')
  let imported = 0, duplicates = 0
  for (const l of lines) {
    const key = fp(bankAccountId, l)
    if (q.get(`SELECT id FROM bank_transactions WHERE bank_account_id = ? AND fingerprint = ? AND deleted_at IS NULL`, bankAccountId, key)) { duplicates++; continue }
    createRecord(getDef('bank_transactions'), { bank_account_id: bankAccountId, txn_date: l.date, description: l.description, reference: l.reference || null, debit: l.debit, credit: l.credit, status: 'Unreconciled', fingerprint: key }, SYSTEM_CTX)
    imported++
  }
  const matched = autoMatch(bankAccountId)
  logIntegration('bank', source, true, `Imported ${imported} lines (${duplicates} duplicates skipped), auto-matched ${matched}`)
  return { imported, duplicates, matched }
}

/** Match statement lines to posted receipts (deposits) and payments (withdrawals) by amount, date window and reference. */
export function autoMatch(bankAccountId?: number): number {
  let n = 0
  const where = bankAccountId ? 'AND bank_account_id = ' + Number(bankAccountId) : ''
  const lines = q.all(`SELECT * FROM bank_transactions WHERE status = 'Unreconciled' AND deleted_at IS NULL ${where}`)
  const used = new Set<string>(q.all(`SELECT matched_to FROM bank_transactions WHERE status = 'Reconciled' AND matched_to IS NOT NULL AND deleted_at IS NULL`).map((r: any) => r.matched_to))
  for (const l of lines) {
    const credit = (l.credit ?? 0) > 0, cents = credit ? l.credit : l.debit
    const lo = addDays(l.txn_date, -10), hi = addDays(l.txn_date, 10)
    const cands = credit
      ? q.all(`SELECT receipt_no no, amount, reference, receipt_date d FROM receipts WHERE status = 'Posted' AND bank_account_id = ? AND amount = ? AND receipt_date BETWEEN ? AND ? AND deleted_at IS NULL`, l.bank_account_id, cents, lo, hi)
      : q.all(`SELECT payment_no no, amount, reference, payment_date d FROM payments WHERE status = 'Posted' AND bank_account_id = ? AND amount = ? AND payment_date BETWEEN ? AND ? AND deleted_at IS NULL`, l.bank_account_id, cents, lo, hi)
    const free = cands.filter(c => !used.has(c.no))
    const byRef = free.find(c => c.reference && l.reference && (String(l.description + l.reference).toLowerCase().includes(String(c.reference).toLowerCase())))
    const pick = byRef ?? (free.length === 1 ? free[0] : null)
    if (!pick) continue
    used.add(pick.no)
    q.run(`UPDATE bank_transactions SET status='Reconciled', matched_to=?, reconciled_on=?, updated_at=? WHERE id=?`, pick.no, todayStr(), nowIso(), l.id)
    n++
  }
  return n
}
export const centsOf = toCents; export const fromC = fromCents
