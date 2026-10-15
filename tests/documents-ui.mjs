import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const data = fs.mkdtempSync(path.join(os.tmpdir(), 'elvora-documents-'))
const base = 'http://127.0.0.1:8090'
const server = spawn(process.execPath, ['dist/server/index.mjs'], { env: { ...process.env, DATA_DIR: data, DATABASE_URL: '', REQUIRE_DATABASE_URL: 'false', DEMO_ENABLED: 'true', PORT: '8090', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = '', browser, checks = 0
server.stdout.on('data', b => { logs += b }); server.stderr.on('data', b => { logs += b })
const check = (label, condition) => { assert.ok(condition, label); checks++; console.log(`  ✓ ${label}`) }
try {
  let online = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) { online = true; break } } catch {} await new Promise(r => setTimeout(r, 500)) }
  assert.ok(online, logs)
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  const demo = await (await context.request.get(base + '/api/demo/status')).json()
  await page.goto(base + '/login')
  await page.locator('input[type=email]').fill(demo.email)
  await page.locator('input[type=password]').fill(demo.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/dashboard')
  const api = async (url, payload) => {
    const r = payload === undefined ? await context.request.get(base + url) : await context.request.put(base + url, { data: payload, headers: { 'x-elvora-client': 'web' } })
    return { status: r.status(), data: await r.json() }
  }
  await page.goto(base + '/admin/settings')
  const company = page.getByLabel('Company name', { exact: true })
  await company.fill('Elvora Shipping')
  await company.press('End'); await company.pressSequentially(' L.L.C.', { delay: 20 })
  check('settings keep focus and accept continuous typing', await company.inputValue() === 'Elvora Shipping L.L.C.' && await company.evaluate(el => el === document.activeElement))
  // Test raster, not a reproduction of the company seal.
  const seal = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 80; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#001078'; x.fillRect(10, 10, 60, 60); return c.toDataURL('image/png') })
  check('active images rejected', (await api('/api/admin/settings', { document_seal: 'data:image/svg+xml;base64,PHN2Zz4=' })).status === 400)
  check('remote seal images rejected', (await api('/api/admin/settings', { document_seal: 'https://example.test/seal.png' })).status === 400)
  check('incorrect image signatures rejected', (await api('/api/admin/settings', { document_seal: 'data:image/png;base64,ZmFrZQ==' })).status === 400)
  check('non-boolean default rejected', (await api('/api/admin/settings', { document_seal_default: 'false' })).status === 400)
  await page.getByRole('tab', { name: 'Document text', exact: true }).click()
  await page.getByLabel('Seal image (PNG or JPEG, up to 1 MB)').setInputFiles({ name: 'test-seal.png', mimeType: 'image/png', buffer: Buffer.from(seal.split(',')[1], 'base64') })
  await page.getByAltText('Company seal preview').waitFor()
  await page.getByLabel('Include the company seal by default').check()
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await page.getByText('Settings saved', { exact: true }).waitFor()
  const meta = (await api('/api/meta')).data.settings
  check('seal upload and default saved through settings UI', meta.document_seal === seal && meta.document_seal_default === true)
  const invoice = (await api('/api/e/invoices?pageSize=1')).data.rows[0]
  const quotation = (await api('/api/e/quotations?pageSize=1')).data.rows[0]
  const record = (await api(`/api/e/invoices/${invoice.id}`)).data
  await page.route(`**/api/print/invoices/${record.id}/parties`, async route => { await new Promise(r => setTimeout(r, 600)); await route.continue() })
  await page.goto(`${base}/print/invoices/${invoice.id}`)
  const print = page.getByRole('button', { name: 'Print / Save as PDF', exact: true })
  check('printing disabled while recipient data is loading', await print.isDisabled())
  await page.locator('.print-sheet[data-print-ready=true]').waitFor()
  const recipient = await page.locator('.document-recipient strong').textContent()
  check('recipient precedes document title', await page.evaluate(() => !!(document.querySelector('.document-recipient').compareDocumentPosition(document.querySelector('.print-sheet h1')) & Node.DOCUMENT_POSITION_FOLLOWING)))
  check('recipient matches invoice customer', recipient === record._labels.party_id)
  if (record.doc_type === 'Tax Invoice' && meta.vat_registered !== false) check('VAT tax invoice retains supplier TRN', (await page.locator('.print-sheet').textContent()).includes('Supplier TRN'))
  check('invoice has required no-signature notice', await page.locator('.document-footer').textContent().then(t => t.includes('This is a system-generated invoice and does not require a signature.')))
  check('default seal is displayed', await page.locator('.document-seal').count() === 1)
  await page.getByLabel('Include company seal', { exact: true }).click()
  await page.waitForURL('**seal=0')
  await page.waitForFunction(() => !document.querySelector('.document-seal'))
  check('per-document seal can be excluded', await page.locator('.document-seal').count() === 0 && page.url().includes('seal=0'))
  await page.reload(); await page.locator('.print-sheet[data-print-ready=true]').waitFor()
  check('seal choice survives reload', await page.locator('.document-seal').count() === 0)
  await page.setViewportSize({ width: 390, height: 844 })
  check('mobile print preview scrolls inside the page', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.print-preview').scrollWidth > document.querySelector('.print-preview').clientWidth))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${base}/print/quotations/${quotation.id}?seal=1`)
  await page.locator('.print-sheet[data-print-ready=true]').waitFor()
  check('quotation notice and customer acceptance both retained', (await page.locator('.document-footer').textContent()).includes('system-generated quotation') && (await page.locator('.print-sheet').textContent()).includes('Accepted by customer'))
  check('issuer signature line removed', !(await page.locator('.print-sheet').textContent()).includes('For Elvora Shipping L.L.C.'))
  await api('/api/admin/settings', { vat_registered: false, company_name_ar: 'الفورا', company_info_email: 'info@elvorashipping.com', company_trade_license: 'TEST-LICENCE' })
  await page.goto(`${base}/print/invoices/${invoice.id}?seal=0`); await page.locator('.print-sheet[data-print-ready=true]').waitFor()
  check('non-VAT registration reaches print metadata', (await api('/api/meta')).data.settings.vat_registered === false)
  if (record.doc_type === 'Tax Invoice') check('non-VAT invoice is labelled INVOICE', (await page.locator('.print-sheet h1').textContent()).startsWith('INVOICE'))
  const sheet = await page.locator('.print-sheet').textContent()
  check('letterhead uses English without registration identifiers', !sheet.includes('الفورا') && !sheet.includes('TEST-LICENCE'))
  check('document uses the requested Bur Dubai address', sheet.includes('Bur Dubai, Dubai, UAE'))
  check('non-VAT invoice omits supplier TRN', !sheet.includes('Supplier TRN'))
  for (const useSeal of [0, 1]) {
    const pdf = await context.request.get(`${base}/api/pdf/invoices/${invoice.id}?seal=${useSeal}`)
    check(`server PDF succeeds with seal=${useSeal}`, pdf.status() === 200 && pdf.headers()['content-type'].includes('application/pdf'))
    const file = path.join(data, `invoice-${useSeal}.pdf`)
    fs.writeFileSync(file, await pdf.body())
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' })
    check(`PDF includes customer and notice with seal=${useSeal}`, text.includes(recipient) && text.includes('system-generated invoice') && text.includes('does not require a signature'))
    check(`PDF omits Arabic and licence identifiers with seal=${useSeal}`, !text.includes('TEST-LICENCE') && !/[\u0600-\u06ff]/.test(text))
    check(`PDF uses requested document address with seal=${useSeal}`, text.includes('Bur Dubai, Dubai, UAE'))
    const images = execFileSync('pdfimages', ['-list', file], { encoding: 'utf8' })
    check(`PDF seal image ${useSeal ? 'included' : 'excluded'}`, /\s80\s+80\s/.test(images) === !!useSeal)
  }
  await page.goto(`${base}/print/parties/${record.party_id}?from=2026-02-01&to=2026-03-01&seal=1`)
  await page.locator('.print-sheet[data-print-ready=true]').waitFor()
  check('statement preserves supplied date range', await page.getByLabel('Statement from date').inputValue() === '2026-02-01' && await page.getByLabel('Statement to date').inputValue() === '2026-03-01')
  check('statement includes recipient, notice and seal', await page.locator('.document-recipient').count() === 1 && await page.locator('.document-seal').count() === 1 && (await page.locator('.document-footer').textContent()).includes('system-generated statement of account'))
  const statementPdf = await context.request.get(`${base}/api/pdf/parties/${record.party_id}?from=2026-02-01&to=2026-03-01&seal=0`)
  check('statement server PDF preserves requested range', statementPdf.status() === 200)
  await page.goto(`${base}/print/invoices/999999999`)
  await page.locator('.print-sheet [role=alert]').waitFor()
  check('missing records cannot print an error sheet', await print.isDisabled())
  check('no browser runtime errors', errors.length === 0)
  console.log(`${checks} document workflow checks passed`)
} finally {
  await browser?.close(); server.kill('SIGTERM')
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve) })
  fs.rmSync(data, { recursive: true, force: true })
}
