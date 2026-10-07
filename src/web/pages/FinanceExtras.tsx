import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileUp, CalendarCheck2, FileSpreadsheet, Download, Lock, Undo2, ShieldAlert } from 'lucide-react'
import { get, post } from '../lib/api'
import { useToast } from '../lib/toast'
import { PageHeader, Loading, ErrorBox, Badge, Empty } from '../ui/kit'
import { useDialogs } from '../ui/kit'
import { fmtMoney } from '../lib/format'

export function BankImportPage() {
  const toast = useToast()
  const banks = useQuery({ queryKey: ['bank-accts'], queryFn: () => get<any>('/api/e/bank_accounts', { pageSize: 100 }) })
  const [bank, setBank] = useState(''); const [text, setText] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState<any>(null)
  const pick = async (f: File | undefined) => { if (!f) return; setName(f.name); setText(await f.text()); setRes(null) }
  const run = async () => { setBusy(true); try { setRes(await post('/api/finance/bank/import', { bank_account_id: Number(bank), text })); toast.ok('Statement imported') } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  if (!banks.data) return <Loading />
  return (
    <div className="fade-in max-w-3xl">
      <PageHeader icon={<FileUp size={20} />} title="Bank statement import" subtitle="Upload a CSV or SWIFT MT940 statement. Lines are de-duplicated and automatically matched to posted receipts and payments (same amount within 10 days)." actions={<Link className="btn outline" to="/e/bank_transactions">Open reconciliation</Link>} />
      <div className="card p-4 md:p-5 grid gap-4">
        <div><label className="label">Bank account</label><select className="select" value={bank} onChange={e => setBank(e.target.value)}><option value="">Choose…</option>{banks.data.rows.map((b: any) => <option key={b.id} value={b.id}>{b.name} {b.iban ? `(${b.iban})` : ''}</option>)}</select></div>
        <div><label className="label">Statement file (.csv, .txt, .sta, .mt940)</label><input className="input" type="file" accept=".csv,.txt,.sta,.mt940,.940" onChange={e => void pick(e.target.files?.[0])} />
          <div className="text-xs text-muted mt-1">CSV needs a header row with Date and Debit/Credit (or Amount) columns; day-first dates (31/12/2026) are understood. {name && <b>Loaded: {name} ({text.length.toLocaleString()} characters)</b>}</div></div>
        <div className="flex gap-2 items-center"><button className="btn green" disabled={!bank || !text || busy} onClick={() => void run()}><FileUp /> {busy ? 'Importing…' : 'Import & auto-match'}</button>
          <button className="btn outline" onClick={async () => { try { const r = await post<any>('/api/finance/bank/auto-match', {}); toast.ok(`${r.matched} more lines matched`) } catch (e: any) { toast.error(e.message) } }}>Re-run auto-match</button></div>
        {res && <div className="rounded-xl bg-mint border border-[#bfe3d0] p-3 text-[14px]">Imported <b>{res.created}</b> new lines · <b>{res.duplicates}</b> duplicates skipped · <b>{res.matched}</b> auto-matched.</div>}
        <div className="text-xs text-muted">Live feeds: an aggregator or automation tool can push transactions to a private webhook – see Integrations → Bank feed webhook.</div>
      </div>
    </div>
  )
}

export function YearEndPage() {
  const toast = useToast(); const dlg = useDialogs()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear - 1); const [entity, setEntity] = useState('')
  const ents = useQuery({ queryKey: ['entities-le'], queryFn: () => get<any>('/api/e/legal_entities', { pageSize: 50 }) })
  const prev = useQuery({ queryKey: ['ye-preview', year, entity], queryFn: () => get<any>(`/api/finance/year-end/${year}`, { entity: entity || undefined }), retry: false })
  const hist = useQuery({ queryKey: ['ye-history'], queryFn: () => get<any>('/api/e/year_end_closes', { pageSize: 50 }) })
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => get<any>('/api/admin/settings') })
  const [busy, setBusy] = useState(false)
  const close = async () => {
    if (!(await dlg.confirm({ title: `Close financial year ${year}?`, message: <>All income and expense balances for {year} are transferred to retained earnings (net {fmtMoney(prev.data?.net_result)}), and the accounting lock date moves to 31-Dec-{year}, so nothing can be posted into that year. You can re-open it later.</>, ok: 'Close the year' }))) return
    setBusy(true); try { await post('/api/finance/year-end/close', { year, entity: entity ? Number(entity) : null }); toast.ok(`Year ${year} closed`); void prev.refetch(); void hist.refetch(); void settings.refetch() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  const reopen = async (id: number, fy: string) => { if (!(await dlg.confirm({ title: `Re-open ${fy}?`, message: 'The closing journal is withdrawn and the lock date moves back one year.', danger: true, ok: 'Re-open' }))) return; try { await post(`/api/finance/year-end/${id}/reopen`); toast.ok('Re-opened'); void hist.refetch(); void prev.refetch(); void settings.refetch() } catch (e: any) { toast.error(e.message) } }
  return (
    <div className="fade-in max-w-4xl">
      <PageHeader icon={<CalendarCheck2 size={20} />} title="Year-end close" subtitle="Close the books: transfer profit or loss to retained earnings and lock the period." actions={<span className="text-sm text-muted flex items-center gap-1"><Lock size={14} /> Locked up to: <b>{settings.data?.lock_date || 'none'}</b></span>} />
      <div className="card p-4 md:p-5 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3"><div><label className="label">Financial year (Jan–Dec)</label><select className="select" value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: 8 }, (_, i) => thisYear - i).map(y => <option key={y}>{y}</option>)}</select></div>
          <div><label className="label">Legal entity</label><select className="select" value={entity} onChange={e => setEntity(e.target.value)}><option value="">All / default</option>{ents.data?.rows.map((e: any) => <option key={e.id} value={e.id}>{e.code} – {e.name}</option>)}</select></div></div>
        {prev.error ? <ErrorBox error={prev.error} /> : !prev.data ? <Loading /> : <>
          <div className="flex gap-3 flex-wrap items-center"><div className="rounded-xl bg-soft border border-line px-4 py-2"><div className="text-xs text-muted">Net profit / (loss) {year}</div><div className="text-[22px] font-extrabold font-display">{fmtMoney(prev.data.net_result)}</div></div>
            {prev.data.already_closed ? <Badge value="Already closed" tone="green" /> : <button className="btn green" disabled={busy || !prev.data.accounts.length} onClick={() => void close()}><Lock /> Close {year}</button>}
            {!prev.data.accounts.length && <span className="text-sm text-muted">No income or expense activity in {year}.</span>}</div>
          {prev.data.accounts.length > 0 && <div className="table-wrap border border-line rounded-xl"><table className="grid"><thead><tr><th>Account</th><th>Type</th><th className="num">Balance to close</th></tr></thead><tbody>{prev.data.accounts.map((a: any) => <tr key={a.code}><td>{a.code} – {a.name}</td><td>{a.type}</td><td className="num">{fmtMoney(a.balance)}</td></tr>)}</tbody></table></div>}
          <div className="text-xs text-muted flex gap-2"><ShieldAlert size={14} className="flex-none mt-0.5" />Post and review all invoices, bills and adjustments dated in {year} first. Draft invoices dated in the year block the close. Reports exclude the closing entry from Profit & Loss, so the year still shows its result.</div></>}
      </div>
      <h3 className="mt-6 mb-2">Closed years</h3>
      {!hist.data ? <Loading /> : !hist.data.rows.length ? <Empty title="No years closed yet" /> : <div className="card table-wrap"><table className="grid"><thead><tr><th>Year</th><th>Entity</th><th className="num">Net result</th><th>Status</th><th /></tr></thead><tbody>{hist.data.rows.map((r: any) => <tr key={r.id}><td><b>{r.fiscal_year}</b></td><td>{r._labels?.legal_entity_id ?? '—'}</td><td className="num">{fmtMoney(r.net_result)}</td><td><Badge value={r.status} tone={r.status === 'Closed' ? 'green' : 'amber'} /></td><td>{r.status === 'Closed' && <button className="btn ghost sm" onClick={() => void reopen(r.id, r.fiscal_year)}><Undo2 /> Re-open</button>}</td></tr>)}</tbody></table></div>}
    </div>
  )
}

export function WpsPage() {
  const toast = useToast()
  const last = new Date(); last.setMonth(last.getMonth() - 1)
  const [period, setPeriod] = useState(`${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`); const [drafts, setDrafts] = useState(false)
  const chk = useQuery({ queryKey: ['wps', period, drafts], queryFn: () => get<any>(`/api/hr/wps/${period}`, { drafts: drafts ? 1 : undefined }), retry: false })
  const hist = useQuery({ queryKey: ['wps-hist'], queryFn: () => get<any>('/api/e/wps_batches', { pageSize: 30 }) })
  const [busy, setBusy] = useState(false)
  const gen = async () => { setBusy(true); try { const r = await post<any>(`/api/hr/wps/${period}/generate`, {}); toast.ok(`${r.file_name} generated`); void hist.refetch(); window.location.href = `/api/hr/wps/batches/${r.batch_id}/download` } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  const d = chk.data
  return (
    <div className="fade-in max-w-4xl">
      <PageHeader icon={<FileSpreadsheet size={20} />} title="WPS salary file (SIF)" subtitle="Generate the UAE Wages Protection System file from approved payslips and upload it to your bank or exchange house." actions={<Link className="btn outline" to="/e/payslips">Payroll</Link>} />
      <div className="card p-4 md:p-5 grid gap-4">
        <div className="flex gap-3 items-end flex-wrap"><div><label className="label">Salary month</label><input className="input" type="month" value={period} onChange={e => setPeriod(e.target.value)} /></div><label className="flex gap-2 text-sm items-center pb-2"><input type="checkbox" checked={drafts} onChange={e => setDrafts(e.target.checked)} /> Include draft payslips (preview only)</label></div>
        {chk.error ? <ErrorBox error={chk.error} /> : !d ? <Loading /> : <>
          {d.header_problems.length > 0 && <div className="rounded-xl border border-[#f2bcc3] bg-blush p-3 text-[13.5px]"><b>Company setup needed</b><ul className="m-0 pl-5">{d.header_problems.map((p: string) => <li key={p}>{p}</li>)}</ul><Link className="underline" to="/admin/integrations">Open Integrations → Payroll / WPS</Link></div>}
          {d.employee_problems.length > 0 && <div className="rounded-xl border border-[#ecd9a0] bg-[#fbf3d6] p-3 text-[13.5px]"><b>{d.employee_problems.length} employee(s) cannot be paid through WPS yet</b><ul className="m-0 pl-5">{d.employee_problems.map((p: any) => <li key={p.emp_no}>{p.emp_no} {p.employee}: {p.problems.join('; ')}</li>)}</ul></div>}
          <div className="flex items-center gap-4 flex-wrap"><div className="rounded-xl bg-soft border border-line px-4 py-2"><div className="text-xs text-muted">Ready employees</div><div className="text-[22px] font-extrabold font-display">{d.employees}</div></div><div className="rounded-xl bg-soft border border-line px-4 py-2"><div className="text-xs text-muted">Total (AED)</div><div className="text-[22px] font-extrabold font-display">{fmtMoney(d.total)}</div></div>
            <button className="btn green" disabled={!d.ok || busy || drafts} onClick={() => void gen()}><Download /> Generate & download SIF</button></div>
          <div className="text-xs text-muted">{d.note}</div></>}
      </div>
      <h3 className="mt-6 mb-2">Generated files</h3>
      {!hist.data ? <Loading /> : !hist.data.rows.length ? <Empty title="No WPS files yet" /> : <div className="card table-wrap"><table className="grid"><thead><tr><th>Period</th><th>File</th><th className="num">Employees</th><th className="num">Total</th><th>Generated</th><th /></tr></thead><tbody>{hist.data.rows.map((r: any) => <tr key={r.id}><td>{r.period}</td><td>{r.file_name}</td><td className="num">{r.employees}</td><td className="num">{fmtMoney(r.total)}</td><td>{r.created?.replace('T', ' ')}</td><td><a className="btn ghost sm" href={`/api/hr/wps/batches/${r.id}/download`}><Download /> Download</a></td></tr>)}</tbody></table></div>}
    </div>
  )
}
