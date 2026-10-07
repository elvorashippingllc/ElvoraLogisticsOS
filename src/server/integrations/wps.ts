import { q } from '../db'
import { getSetting } from '../settings'
import { bad, fromCents, nowLocal, r2 } from '../util'
import { getDef, insertRow, SYSTEM_CTX } from '../engine'

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
const money = (c: number) => (c / 100).toFixed(2)

export interface WpsCheck { employee: string; emp_no: string; problems: string[] }

/** Build the UAE WPS "SIF" file (EDR rows + SCR trailer) from approved payslips of a period. */
export function buildWps(period: string, opts: { entityId?: number | null; save?: boolean; includeDrafts?: boolean } = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw bad('Period must be YYYY-MM')
  const employerId = digits(getSetting('wps_employer_id')), routing = digits(getSetting('wps_bank_routing'))
  const header: string[] = []
  if (employerId.length < 8) header.push('Employer establishment ID (MOHRE) is not set or too short – enter it under Integrations → Payroll / WPS')
  if (routing.length !== 9) header.push('Employer bank routing code must be 9 digits – enter it under Integrations → Payroll / WPS')
  const statuses = opts.includeDrafts ? `('Draft','Approved','Paid')` : `('Approved','Paid')`
  const rows = q.all(`SELECT p.*, e.name, e.emp_no, e.mol_person_id, e.labour_card_no, e.bank_iban, e.bank_routing_code FROM payslips p JOIN employees e ON e.id = p.employee_id WHERE p.period = ? AND p.status IN ${statuses} AND p.deleted_at IS NULL ORDER BY e.emp_no`, period)
  if (!rows.length) throw bad(`No approved payslips for ${period}. Generate payroll and approve the payslips first.`)
  const [y, m] = period.split('-').map(Number)
  const start = `${period}-01`, end = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`, dim = new Date(y, m, 0).getDate()
  const checks: WpsCheck[] = []
  const edr: string[] = []
  let total = 0
  for (const r of rows) {
    const problems: string[] = []
    const pid = digits(r.mol_person_id || r.labour_card_no), iban = String(r.bank_iban ?? '').replace(/\s/g, '').toUpperCase(), rc = digits(r.bank_routing_code)
    if (pid.length < 10 || pid.length > 14) problems.push('MOHRE person ID (14 digits) missing')
    if (!/^AE\d{21}$/.test(iban)) problems.push('IBAN must be a valid UAE IBAN (AE + 21 digits)')
    if (rc.length !== 9) problems.push('Employee bank routing code must be 9 digits')
    if ((r.net_pay ?? 0) <= 0) problems.push('Net pay is zero')
    if (problems.length) { checks.push({ employee: r.name, emp_no: r.emp_no, problems }); continue }
    const fixed = (r.basic ?? 0) + (r.allowances ?? 0) - (r.deductions ?? 0), variable = r.overtime ?? 0
    total += fixed + variable
    edr.push(['EDR', pid.padStart(14, '0'), rc, iban, start, end, dim - Math.round(r.unpaid_days ?? 0), money(fixed), money(variable), Math.round(r.unpaid_days ?? 0)].join(','))
  }
  const now = nowLocal()
  const ymd = now.slice(2, 4) + now.slice(5, 7) + now.slice(8, 10), hm = now.slice(11, 13) + now.slice(14, 16)
  const scr = ['SCR', employerId, routing, now.slice(0, 10), hm, `${String(m).padStart(2, '0')}${y}`, edr.length, money(total), 'AED', getSetting('wps_employer_ref') || ''].join(',')
  const fileName = `${employerId.padStart(13, '0')}${ymd}${hm}00.SIF`
  const content = [...edr, scr].join('\r\n') + '\r\n'
  const ok = !header.length && !checks.length && edr.length > 0
  let batchId: number | undefined
  if (opts.save && ok) batchId = insertRow(getDef('wps_batches'), { period, legal_entity_id: opts.entityId ?? null, file_name: fileName, employees: edr.length, total: r2(total / 100), employer_id: employerId, bank_routing: routing, content, created: nowLocal() }, SYSTEM_CTX)
  return { ok, header_problems: header, employee_problems: checks, employees: edr.length, total: r2(total / 100), file_name: fileName, content: ok ? content : null, batch_id: batchId, note: 'Layout follows the common bank SIF format (EDR rows + SCR trailer). Confirm field order and file naming with your exchange house / bank before the first live upload.' }
}
void fromCents
