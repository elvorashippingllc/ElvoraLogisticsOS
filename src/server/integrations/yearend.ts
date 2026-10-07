import { q } from '../db'
import { bad, r2, todayStr, nowLocal } from '../util'
import { getSetting, setSettings } from '../settings'
import { accountByRole, postJournal } from '../domain/accounting'
import { getDef, insertRow, SYSTEM_CTX, audit, type Ctx } from '../engine'

/** Close income & expense accounts into retained earnings at year end. */
export function yearEndPreview(year: number, entityId?: number | null) {
  const from = `${year}-01-01`, to = `${year}-12-31`
  const ent = entityId ? ' AND e.legal_entity_id = ' + Number(entityId) : ''
  const rows = q.all(`SELECT a.id, a.code, a.name, a.type, COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM accounts a JOIN journal_lines l ON l.account_id = a.id AND l.deleted_at IS NULL JOIN journal_entries e ON e.id = l.entry_id AND e.deleted_at IS NULL WHERE a.deleted_at IS NULL AND a.type IN ('Income','Expense') AND e.entry_date BETWEEN ? AND ? AND e.source_type <> 'Year-end close' ${ent} GROUP BY a.id HAVING COALESCE(SUM(l.debit),0) <> COALESCE(SUM(l.credit),0) ORDER BY a.code`, from, to)
  const net = rows.reduce((s, r) => s + (r.c - r.d), 0)
  const existing = q.get(`SELECT * FROM year_end_closes WHERE fiscal_year = ? AND status = 'Closed' AND legal_entity_id IS ? AND deleted_at IS NULL`, String(year), entityId ?? null)
  return { year, from, to, accounts: rows.map(r => ({ code: r.code, name: r.name, type: r.type, balance: r2((r.c - r.d) / 100) })), net_result: r2(net / 100), already_closed: !!existing }
}

export function closeYear(year: number, ctx: Ctx, opts: { entityId?: number | null; lock?: boolean } = {}) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw bad('Invalid year')
  if (year >= Number(todayStr().slice(0, 4)) && todayStr() <= `${year}-12-31`) throw bad(`The year ${year} has not ended yet`)
  const prev = q.get(`SELECT id FROM year_end_closes WHERE fiscal_year = ? AND status = 'Closed' AND legal_entity_id IS ? AND deleted_at IS NULL`, String(year), opts.entityId ?? null)
  if (prev) throw bad(`${year} is already closed. Re-open it first to close again.`)
  const unposted = q.val<number>(`SELECT COUNT(*) FROM invoices WHERE status = 'Draft' AND doc_type <> 'Proforma Invoice' AND invoice_date <= ? AND deleted_at IS NULL`, `${year}-12-31`) ?? 0
  if (unposted) throw bad(`${unposted} draft invoice(s) dated in ${year} still need posting or deleting before the year can be closed`)
  const pv = yearEndPreview(year, opts.entityId)
  if (!pv.accounts.length) throw bad(`No income or expense activity found in ${year}`)
  const re = accountByRole('retained_earnings')
  const lines = pv.accounts.map(a => {
    const id = q.val<number>(`SELECT id FROM accounts WHERE code = ?`, a.code)!
    return a.balance > 0 ? { account_id: id, debit: a.balance, description: `Close ${a.name}` } : { account_id: id, credit: -a.balance, description: `Close ${a.name}` }
  })
  lines.push(pv.net_result >= 0 ? { account_id: re, credit: pv.net_result, description: `Net result ${year} to retained earnings` } as any : { account_id: re, debit: -pv.net_result, description: `Net loss ${year} to retained earnings` } as any)
  const jid = postJournal(ctx, { date: `${year}-12-31`, memo: `Year-end close ${year}`, source_type: 'Year-end close', source_no: String(year), lines })
  if (opts.entityId) q.run(`UPDATE journal_entries SET legal_entity_id = ? WHERE id = ?`, opts.entityId, jid)
  const rec = insertRow(getDef('year_end_closes'), { fiscal_year: String(year), legal_entity_id: opts.entityId ?? null, closing_date: `${year}-12-31`, net_result: pv.net_result, journal_id: jid, status: 'Closed' }, SYSTEM_CTX)
  if (opts.lock !== false) setSettings({ lock_date: `${year}-12-31` })
  audit(ctx, getDef('year_end_closes'), rec, 'year-end-close', { year: [null, year] }, String(year))
  return { id: rec, journal_id: jid, net_result: pv.net_result, lock_date: opts.lock !== false ? `${year}-12-31` : getSetting('lock_date') }
}

export function reopenYear(id: number, ctx: Ctx) {
  const c = q.get(`SELECT * FROM year_end_closes WHERE id = ? AND status = 'Closed'`, id)
  if (!c) throw bad('Closed year not found')
  const later = q.get(`SELECT id FROM year_end_closes WHERE fiscal_year > ? AND status = 'Closed' AND legal_entity_id IS ?`, c.fiscal_year, c.legal_entity_id ?? null)
  if (later) throw bad('Re-open the later year(s) first')
  if (getSetting('lock_date') && getSetting('lock_date') >= c.closing_date) setSettings({ lock_date: `${Number(c.fiscal_year) - 1}-12-31` })
  const at = new Date().toISOString()
  q.run(`UPDATE journal_entries SET deleted_at = ? WHERE id = ?`, at, c.journal_id)
  q.run(`UPDATE journal_lines SET deleted_at = ? WHERE entry_id = ?`, at, c.journal_id)
  q.run(`UPDATE year_end_closes SET status = 'Re-opened', reopened_on = ? WHERE id = ?`, todayStr(), id)
  audit(ctx, getDef('year_end_closes'), id, 'year-end-reopen', { status: ['Closed', 'Re-opened'] }, c.fiscal_year)
  return { ok: true, note: `Lock date moved back to ${Number(c.fiscal_year) - 1}-12-31. The closing journal was withdrawn.` }
}
void nowLocal
