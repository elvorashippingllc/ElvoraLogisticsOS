import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const data = fs.mkdtempSync(path.join(os.tmpdir(), 'elvora-ui-'))
const server = spawn(process.execPath, ['dist/server/index.mjs'], { env: { ...process.env, DATA_DIR: data, DATABASE_URL: '', REQUIRE_DATABASE_URL: 'false', DEMO_ENABLED: 'true', PORT: '8088', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''; server.stdout.on('data', b => { logs += b }); server.stderr.on('data', b => { logs += b })
const base = 'http://127.0.0.1:8088', out = '.impeccable/review'
fs.mkdirSync(out, { recursive: true })
let browser
try {
  let online = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) { online = true; break } } catch {} await new Promise(r => setTimeout(r, 500)) }
  assert.ok(online, logs)
  const executablePath = process.env.CHROME_PATH || execFileSync('bash', ['-c', 'command -v google-chrome || command -v chromium'], { encoding: 'utf8' }).trim()
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  const demo = await (await context.request.get(base + '/api/demo/status')).json()
  const auth = await context.request.post(base + '/api/auth/login', { data: { email: demo.email, password: demo.password, demo: true }, headers: { 'x-elvora-client': 'web' } })
  assert.equal(auth.status(), 200)
  await page.goto(base + '/dashboard'); await page.getByRole('heading', { name: 'Move each shipment forward' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  const capture = async name => { const style = await page.addStyleTag({ content: '.workspace-frame { height:auto; min-height:100dvh; overflow:visible; } .app-main { overflow:visible; }' }); await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 65, fullPage: true }); await style.evaluate(el => el.remove()) }
  await capture('desktop')
  const carousel = page.getByLabel('Shipment workflow steps')
  await page.getByRole('button', { name: 'Next workflow steps' }).click()
  await page.waitForTimeout(300)
  assert.ok(await carousel.evaluate(el => el.scrollLeft > 0), 'carousel moves when requested')
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Operations' })
  await dialog.waitFor(); assert.ok(await dialog.getByRole('link', { name: 'Master Jobs', exact: true }).isVisible())
  await page.screenshot({ path: `${out}/sidebar.png` }); await page.screenshot({ path: `${out}/sidebar.jpg`, type: 'jpeg', quality: 65 })
  await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0)
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Operations', 'focus returns to sidebar')
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/dashboard')
  await page.getByRole('heading', { name: 'Move each shipment forward' }).waitFor(); await page.waitForTimeout(300)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile page fits viewport')
  const badges = await page.locator('.dashboard-page .badge').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, height: n.getBoundingClientRect().height, line: parseFloat(getComputedStyle(n).lineHeight) })))
  assert.ok(badges.every(b => b.height < b.line * 2), 'mobile status words remain on one line')
  await capture('mobile')
  await page.goto(base + '/email'); await page.getByRole('button', { name: 'Write email', exact: true }).waitFor()
  await capture('email')
  assert.equal(await page.getByRole('button', { name: 'Send email', exact: true }).isEnabled(), false, 'unconnected sender cannot send')
  assert.deepEqual(errors, [])
  console.log('PASS: dashboard desktop, mobile, carousel, sidebar popup, focus return and email empty state')
  if (process.env.UI_CAPTURE_PRINT === 'true') for (const name of ['desktop', 'mobile', 'sidebar', 'email']) console.log(`UI_CAPTURE:${name}:${fs.readFileSync(`${out}/${name}.jpg`).toString('base64')}`)
} finally { await browser?.close(); server.kill('SIGTERM'); fs.rmSync(data, { recursive: true, force: true }) }
