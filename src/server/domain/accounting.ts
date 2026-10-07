import { q } from '../db'
import { bad, r2, toCents, todayStr } from '../util'
import { getSetting } from '../settings'
import { createRecord, getDef, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { config } from '../config'

export const BASE = () => (getSetting<string>('base_currency') || config.baseCurrency)

export function accountByRole(role: string): number {
  const id = q.val<number>(`SELECT id FROM accounts WHERE role = ? AND deleted_at IS NULL AND active = 1 ORDER BY id LIMIT 1`, role)
  if (!id) throw bad(`No account is flagged with the system role "${role}". Configure it in Chart of Accounts.`)
  return id
}
export function accountByCode(code: string): number | undefined {
  return q.val<number>(`SELECT id FROM accounts WHERE code = ? AND deleted_at IS NULL`, code)
}

/** Exchange rate (units of base currency per 1 unit of `currency`). */
export function fxRate(currency: string | null | undefined, provided?: number | null): number {
  if (!currency || currency === BASE()) return 1
  if (provided && provided > 0 && provided !== 1) return provided
  const r = q.val<number>(`SELECT rate FROM currencies WHERE code = ? AND deleted_at IS NULL`, currency)
  if (!r || r <= 0) throw bad(`No exchange rate for ${currency}. Enter the rate on the document or maintain it under Master Data → Currencies.`)
  return r
}

export function assertNotLocked(date: string | null | undefined) {
  const lock = getSetting<string>('lock_date')
  if (lock && date && date <= lock) throw bad(`Accounting period is locked up to ${lock}. Posting dated ${date} is not allowed.`)
}

export interface JLine { account_id: number; party_id?: number | null; job_id?: number | null; description?: string; debit?: number; credit?: number }
export interface JournalInput { date: string; memo: string; source_type: string; source_id?: number | null; source_no?: string | null; branch_id?: number | null; lines: JLine[] }

export function postJournal(ctx: Ctx, j: JournalInput): number {
  assertNotLocked(j.date)
  const lines = j.lines.filter(l => toCents(l.debit ?? 0) !== 0 || toCents(l.credit ?? 0) !== 0)
  if (lines.length < 2) throw bad('Journal needs at least two non-zero lines')
  const rec = createRecord(getDef('journal_entries'), {
    entry_date: j.date, memo: j.memo, source_type: j.source_type, source_id: j.source_id ?? null, source_no: j.source_no ?? null, branch_id: j.branch_id ?? null, status: 'Posted',
    children: { lines: lines.map(l => ({ account_id: l.account_id, party_id: l.party_id ?? null, job_id: l.job_id ?? null, description: l.description ?? null, debit: l.debit ?? 0, credit: l.credit ?? 0 })) },
  }, { ...SYSTEM_CTX, user: ctx.user, ip: ctx.ip })
  const ent = (j.branch_id ? q.val<number>(`SELECT legal_entity_id FROM branches WHERE id = ?`, j.branch_id) : null) ?? q.val<number>(`SELECT id FROM legal_entities WHERE is_default = 1 AND deleted_at IS NULL ORDER BY id LIMIT 1`)
  if (ent) q.run(`UPDATE journal_entries SET legal_entity_id = ? WHERE id = ?`, ent, rec.id)
  return rec.id
}

export function reverseJournal(ctx: Ctx, entryId: number, memo: string, date = todayStr()): number {
  const lines = q.all(`SELECT * FROM journal_lines WHERE entry_id = ? AND deleted_at IS NULL`, entryId)
  const entry = q.get(`SELECT * FROM journal_entries WHERE id = ?`, entryId)
  if (!entry) throw bad('Journal entry not found')
  const id = postJournal(ctx, {
    date, memo, source_type: 'Reversal', source_id: entryId, source_no: entry.entry_no, branch_id: entry.branch_id,
    lines: lines.map(l => ({ account_id: l.account_id, party_id: l.party_id, job_id: l.job_id, description: l.description, debit: (l.credit ?? 0) / 100, credit: (l.debit ?? 0) / 100 })),
  })
  q.run(`UPDATE journal_entries SET status = 'Reversed' WHERE id = ?`, entryId)
  q.run(`UPDATE journal_entries SET reversal_of = ? WHERE id = ?`, entryId, id)
  return id
}

export function sumLines(rows: Rec[], f: string) { return r2(rows.reduce((s, r) => s + (Number(r[f]) || 0), 0)) }
