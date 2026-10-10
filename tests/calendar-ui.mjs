import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
const base = 'http://127.0.0.1:8091', data = fs.mkdtempSync(path.join(os.tmpdir(), 'elvora-calendar-ui-'))
const server = spawn(process.execPath, ['dist/server/index.mjs'], { env: { ...process.env, DATA_DIR: data, DATABASE_URL: '', DEMO_ENABLED: 'true', PORT: '8091', HOST: '127.0.0.1', NODE_ENV: 'development', COOKIE_SECURE: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = '', browser; server.stdout.on('data', b => logs += b); server.stderr.on('data', b => logs += b)
const out = process.env.CALENDAR_CAPTURE_DIR || '/tmp/elvora-calendar-review'; fs.mkdirSync(out, { recursive: true })
try {
  let ready = false
  for (let i = 0; i < 90; i++) { try { if ((await fetch(base + '/api/health')).ok) { ready = true; break } } catch {} await new Promise(r => setTimeout(r, 500)) }
  assert.ok(ready, logs)
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || execFileSync('bash', ['-c', 'command -v google-chrome || command -v chromium'], { encoding: 'utf8' }).trim(), headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }), page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  const demo = await (await context.request.get(base + '/api/demo/status')).json()
  await page.goto(base + '/login'); await page.locator('input[type="email"]').fill(demo.email); await page.locator('input[type="password"]').fill(demo.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/dashboard')
  await page.goto(base + '/calendar'); await page.getByRole('heading', { name: 'Company calendar', exact: true }).waitFor()
  await page.locator('.calendar-board').waitFor(); assert.equal(await page.locator('.calendar-cell').count(), 42)
  await page.getByRole('button', { name: 'Schedule activity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Schedule activity' })
  await dialog.getByLabel('Title', { exact: true }).fill('Calendar UI scheduled meeting')
  await dialog.getByRole('button', { name: 'Save activity', exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
  await page.getByLabel('Search calendar').fill('Calendar UI scheduled meeting')
  await page.locator('.calendar-day-detail .calendar-event-title').filter({ hasText: 'Calendar UI scheduled meeting' }).waitFor()
  await page.reload(); await page.locator('.calendar-board').waitFor()
  await page.getByLabel('Search calendar').fill('Calendar UI scheduled meeting')
  await page.locator('.calendar-day-detail .calendar-event-title').filter({ hasText: 'Calendar UI scheduled meeting' }).waitFor()
  await page.getByRole('button', { name: 'Week', exact: true }).click(); await page.locator('.calendar-week').waitFor(); assert.equal(await page.locator('.calendar-cell').count(), 7)
  await page.getByRole('button', { name: 'Day', exact: true }).click(); await page.locator('.calendar-agenda .calendar-event-title').filter({ hasText: 'Calendar UI scheduled meeting' }).waitFor()
  await page.getByRole('button', { name: 'Agenda', exact: true }).click(); await page.locator('.calendar-agenda').waitFor()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByRole('button', { name: 'Month', exact: true }).click(); await page.locator('.calendar-board').waitFor()
  await page.getByLabel('Activity group', { exact: true }).selectOption('activities')
  assert.ok(await page.locator('.calendar-type').count() > 0)
  await page.getByLabel('Search calendar').fill('NoSuchCalendarActivity987'); await page.getByText('No matching events this day', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  const check = async () => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow')
    const failures = await page.locator('.calendar-type,.calendar-event-chip,.calendar-day-number,.calendar-mobile-count,.calendar-summary,.calendar-event-title,.calendar-event-facts,.calendar-event-status,.calendar-views button,.calendar-panel-hint').evaluateAll(nodes => {
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
      const lum = color => { ctx.fillStyle = color; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4 }).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0) }
      return nodes.filter(n => n.getClientRects().length).flatMap(n => { let surface=n; while(surface && getComputedStyle(surface).backgroundColor==='rgba(0, 0, 0, 0)') surface=surface.parentElement; if (!surface) return []; const a=lum(getComputedStyle(n).color), b=lum(getComputedStyle(surface).backgroundColor), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05); return ratio>=4.5?[]:[{text:n.textContent.slice(0,45),ratio}] })
    })
    assert.deepEqual(failures, [], 'calendar text contrast meets 4.5:1')
  }
  await check(); await page.screenshot({ path: out + '/desktop.png', fullPage: true })
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark'); await page.waitForTimeout(200); await check(); await page.screenshot({ path: out + '/dark.png', fullPage: true })
  await page.evaluate(() => delete document.documentElement.dataset.theme)
  await page.setViewportSize({ width: 390, height: 844 }); await check(); await page.locator('.calendar-board').scrollIntoViewIfNeeded(); await page.screenshot({ path: out + '/mobile.png', fullPage: true })
  // Counts are hidden on desktop: they must inherit the current cell text color
  // when a theme switch is followed by the mobile breakpoint.
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark'); await check()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => delete document.documentElement.dataset.theme)
  await page.setViewportSize({ width: 390, height: 844 }); await check()
  assert.ok(await page.locator('.calendar-mobile-dots .calendar-dot').count() > 0, 'mobile days retain activity colors')
  await page.locator('.calendar-mobile-count').filter({ hasText: /events/ }).first().click(); await page.locator('.calendar-day-detail .calendar-event-row').first().waitFor()
  assert.deepEqual(errors, [])
  console.log('Calendar UI passed: persisted scheduling, four views, search and filters, selected-day mobile access, desktop/mobile/dark contrast and layout.')
} finally { await browser?.close(); server.kill('SIGTERM') }
