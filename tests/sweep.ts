/* Read-only sweep: calls every report, list, dashboard, KPI, search and per-record view on the demo workspace and fails on any 5xx.
   Catches database-dialect problems (e.g. SQL that one database accepts and another rejects).
   Usage: server running with DEMO_ENABLED (default), then: npx tsx tests/sweep.ts */
export {}
const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
let cookie = '', calls = 0
const bad: string[] = []
async function get(path: string): Promise<{ status: number; data: any }> {
  const res = await fetch(BASE + path, { headers: { 'x-elvora-client': 'web', cookie } })
  calls++
  const text = await res.text(); let data: any; try { data = JSON.parse(text) } catch { data = text }
  if (res.status >= 500) bad.push(`${res.status} ${path} → ${String(data?.error ?? text).slice(0, 200)}`)
  return { status: res.status, data }
}
async function main() {
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-elvora-client': 'web' }, body: JSON.stringify({ email: 'demo@elvorashipping.com', password: 'Demo@Elvora2026' }) })
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
  if (!cookie) { console.error('Demo login failed – is the demo workspace enabled and ready?'); process.exit(2) }

  const meta = (await get('/api/meta')).data
  for (const p of ['/api/dashboard', '/api/kpi', '/api/calendar', '/api/notifications', '/api/ai/brief', '/api/ai/status', '/api/integrations', '/api/admin/audit', '/api/admin/system', '/api/admin/roles', '/api/admin/settings', '/api/admin/login-events', '/api/auth/me', '/api/auth/sessions', '/api/auth/login-history', '/api/compliance/overview', '/api/finance/open-invoices', '/api/finance/open-bills', '/api/finance/bank/summary', '/api/warehouse/stock', '/api/whatsapp/threads', '/api/tags', '/api/rates/search', '/api/search/global?q=a', '/api/search/jobs?type=job_no&value=DXB', '/api/pdf/status', '/api/admin/backups']) await get(p)

  // every report with its default parameters
  const reports = (await get('/api/reports')).data
  for (const r of Array.isArray(reports) ? reports : reports.reports ?? []) await get(`/api/reports/${r.key}`)

  // every entity: list (default, searched, sorted) and the first record's detail + side panel
  for (const e of meta.entities) {
    if (e.key === undefined) continue
    const l = await get(`/api/e/${e.key}?pageSize=5`)
    await get(`/api/e/${e.key}?pageSize=5&q=a`)
    await get(`/api/e/${e.key}/lookup?q=a`)
    // Numeric titles/revisions must support the same search and filter UI as
    // text titles, on SQLite and PostgreSQL. Exercise actual endpoint results.
    if (['knowledge_versions', 'freight_document_versions', 'document_originals'].includes(e.key)) {
      const field = e.key === 'document_originals' ? 'original_no' : 'revision'
      for (const op of ['contains', 'starts', 'ends', 'null', 'notnull']) {
        const filters = encodeURIComponent(JSON.stringify([{ field, op, value: '1' }]))
        const r = await get(`/api/e/${e.key}?pageSize=5&filters=${filters}`)
        if (r.status !== 200 && r.status < 500) bad.push(`${r.status} numeric filter ${e.key}/${op}`)
      }
    }
    const first = l.data?.rows?.[0]
    if (first?.id) {
      await get(`/api/e/${e.key}/${first.id}`)
      if (e.panel) for (const s of ['', '/comments', '/history', '/likes', '/links', '/refs', '/tags']) await get(`/api/panel/${e.key}/${first.id}${s}`)
      if (e.print) await get(`/api/pdf/status`)
    }
  }
  // records that have their own actions / views
  const job = (await get('/api/e/jobs?pageSize=1')).data?.rows?.[0]
  if (job) for (const s of ['events', 'kpi', 'tracking-links', 'tracking-token', 'edi-preview']) await get(`/api/jobs/${job.id}/${s}`)
  const party = (await get('/api/e/parties?pageSize=1')).data?.rows?.[0]
  if (party) { await get(`/api/finance/statement/${party.id}`); await get(`/api/finance/open-invoices?party_id=${party.id}`); await get(`/api/finance/open-bills?vendor_id=${party.id}`) }
  const inv = (await get('/api/e/invoices?pageSize=50')).data?.rows?.find((i: any) => i.status !== 'Draft' && i.doc_type === 'Tax Invoice')
  if (inv) await get(`/api/invoices/${inv.id}/einvoice.xml`)
  await get('/api/finance/year-end/2025'); await get(`/api/finance/year-end/${new Date().getFullYear()}`)

  console.log(`${calls} requests, ${bad.length} server errors`)
  for (const b of [...new Set(bad)]) console.log('  ✗', b)
  process.exit(bad.length ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
