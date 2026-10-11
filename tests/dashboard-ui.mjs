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
  await page.goto(base + '/login')
  await page.locator('input[type="email"]').fill(demo.email)
  await page.locator('input[type="password"]').fill(demo.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/dashboard')
  await page.locator('.dashboard-workflow > summary').waitFor()
  assert.equal(await page.locator('.dashboard-business').getAttribute('open'), null, 'detailed reports start collapsed')
  await page.locator('.dashboard-workflow > summary').click()
  await page.getByRole('heading', { name: 'Move each shipment forward' }).waitFor()
  await page.getByRole('heading', { name: 'Next on the shipment desk' }).waitFor()
  const back = page.getByRole('button', { name: 'Back to previous section', exact: true })
  await back.waitFor()
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Workspaces', exact: true }).click()
  await page.locator('.workspace-card').first().click()
  await back.click(); await page.waitForURL(base + '/')
  await back.click(); await page.waitForURL(base + '/dashboard')
  await page.goForward(); await page.waitForURL(base + '/')
  await back.click(); await page.waitForURL(base + '/dashboard')
  // A fresh shell has no prior in-app section; its fallback must stay inside the app.
  const direct = await context.newPage()
  await direct.goto(base + '/email')
  await direct.getByRole('button', { name: 'Back to previous section', exact: true }).click()
  await direct.waitForURL(/\/(workspace\/[^/]+)?$/)
  assert.notEqual(new URL(direct.url()).pathname, '/email')
  await direct.close()
  const checkBackContrast = async () => {
    const ratio = await back.evaluate(el => {
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
      const luminance = color => {
        ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1)
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
      }
      const style = getComputedStyle(el), a = luminance(style.color), b = luminance(style.backgroundColor)
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
    })
    assert.ok(ratio >= 4.5, 'Back button text meets 4.5:1 contrast')
  }
  await back.hover(); await checkBackContrast(); await page.mouse.move(0, 0); await checkBackContrast()
  await page.evaluate(() => document.fonts.ready)
  const sidebarLabels = await page.locator('.rail-shortcut-label').evaluateAll(nodes => nodes.map(n => {
    const label = n.getBoundingClientRect(), button = n.parentElement.getBoundingClientRect()
    return { text: n.textContent.trim(), fits: label.left >= button.left && label.right <= button.right + 1 && label.bottom <= button.bottom + 1 }
  }))
  assert.ok(sidebarLabels.length > 2 && sidebarLabels.every(n => n.text && n.fits), 'sidebar icons have readable labels contained within each button')
  const capture = async name => { const style = await page.addStyleTag({ content: '.workspace-frame { height:auto; min-height:100dvh; overflow:visible; } .app-main { overflow:visible; }' }); await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 65, fullPage: true }); await style.evaluate(el => el.remove()) }
  await page.locator('.dashboard-workflow').evaluate(el => { el.open = false })
  await capture('desktop')
  await page.locator('.dashboard-workflow').evaluate(el => { el.open = true })
  await page.goto(base + '/'); assert.equal(await page.locator('.workspace-intro img').count(), 0, 'workspace mark is removed'); await page.goto(base + '/dashboard'); await page.locator('.dashboard-workflow > summary').click(); await page.getByRole('heading', { name: 'Move each shipment forward' }).waitFor()
  const checkDashboardContrast = async () => {
    const failures = await page.evaluate(() => {
      const rgb = value => value.match(/[\d.]+/g)?.slice(0, 3).map(Number)
      const luminance = color => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
      const selectors = '.recharts-line .recharts-curve,.recharts-cartesian-axis-tick-value,.recharts-legend-item-text,.control-welcome h1,.control-welcome .text-muted,.control-welcome .btn,.desk-heading h2,.desk-heading p,.desk-summary,.movement-kind,.movement-client,.movement-action,.movement-ticket strong,.dashboard-alert,.dashboard-brief > div:first-child,.quick-work a,.workflow-step h3,.workflow-step p,.workflow-step strong,.workflow-step-head,.workflow-open,.dashboard-metrics .kpi .l,.dashboard-metrics .kpi .v,.dashboard-metrics .kpi .text-muted,.overview-ledger dt,.overview-ledger dd,.overview-ledger h2,.overview-mix h2,.overview-mix header > span,.mode-legend li,.mode-legend strong,.daily-schedule b,.daily-schedule small'
      return [...document.querySelectorAll(selectors)].filter(n => n.getClientRects().length).flatMap(n => {
        let surface = n
        while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement
        const bg = getComputedStyle(surface).backgroundColor, fg = n.matches('.recharts-line .recharts-curve') ? getComputedStyle(n).stroke : n.matches('.recharts-cartesian-axis-tick-value') ? getComputedStyle(n).fill : getComputedStyle(n).color
        const a = luminance(bg), b = luminance(fg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
        return ratio >= 4.5 ? [] : [{ text: n.textContent.slice(0, 60), ratio, bg, fg }]
      })
    })
    assert.deepEqual(failures, [], 'dashboard text meets 4.5:1 contrast')
  }
  await page.locator('.dashboard-business > summary').click()
  await checkDashboardContrast()
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.metric-transit .v')).color === 'rgb(238, 243, 239)')
  await checkDashboardContrast()
  await page.locator('.dashboard-business > summary').click()
  await page.locator('.dashboard-workflow > summary').click()
  await capture('dark')
  await page.locator('.dashboard-workflow > summary').click()
  await back.hover(); await checkBackContrast(); await page.mouse.move(0, 0); await checkBackContrast()
  await page.evaluate(() => delete document.documentElement.dataset.theme)
  await page.waitForTimeout(300)

  const carousel = page.getByLabel('Shipment workflow steps')
  await page.getByRole('button', { name: 'Next workflow steps' }).click()
  await page.waitForTimeout(300)
  assert.ok(await carousel.evaluate(el => el.scrollLeft > 0), 'carousel moves when requested')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Operations' })
  await dialog.waitFor(); assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), 'workspace-open', 'sidebar popup has authored motion'); assert.ok(await dialog.getByRole('link', { name: 'Master Jobs', exact: true }).isVisible())
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
  await page.screenshot({ path: `${out}/sidebar.png` }); await page.screenshot({ path: `${out}/sidebar.jpg`, type: 'jpeg', quality: 65 })
  await page.emulateMedia({ reducedMotion: 'reduce' }); assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), 'none', 'sidebar popup respects reduced motion');
  await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0)
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Operations', 'focus returns to sidebar')
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/dashboard')
  await page.locator('.dashboard-workflow > summary').waitFor(); await page.waitForTimeout(300)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile page fits viewport')
  const badges = await page.locator('.dashboard-page .badge').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, height: n.getBoundingClientRect().height, line: parseFloat(getComputedStyle(n).lineHeight) })))
  assert.ok(badges.every(b => b.height < b.line * 2), 'mobile status words remain on one line')
  await capture('mobile')
  await page.goto(base + '/email'); await page.getByRole('button', { name: 'Write email', exact: true }).waitFor()
  await capture('email')
  assert.equal(await page.getByRole('button', { name: 'Send email', exact: true }).isEnabled(), false, 'unconnected sender cannot send')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/e/vendor_services?new=1')
    const serviceForm = page.getByRole('dialog', { name: 'New Vendor service', exact: true })
    await serviceForm.waitFor()
    await serviceForm.getByText('Vendor buying price', { exact: true }).waitFor()
    assert.ok(await serviceForm.getByText('Customer selling price', { exact: true }).count())
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'vendor-service page fits viewport')
    assert.ok(await serviceForm.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'vendor-service form has no horizontal overflow')
    await serviceForm.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
  await page.goto(base + '/email'); await page.getByRole('button', { name: 'Help me write', exact: true }).click(); await page.getByLabel('What should this say?').fill('Ask for the delivery address'); await page.getByRole('button', { name: 'Create draft', exact: true }).click(); await page.getByText('AI writing requires a connected provider in your live workspace', { exact: true }).waitFor(); await page.getByLabel('Subject', { exact: true }).fill('Draft for review'); await page.getByLabel('Message', { exact: true }).fill('Please confirm the delivery address.'); await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByRole('button', { name: /Saved drafts/ }).click(); await page.getByText('Draft for review', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Continue writing', exact: true }).click(); assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Please confirm the delivery address.');
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(base + '/dashboard')
  await page.locator('.dashboard-metrics').first().waitFor()
  await page.waitForFunction(() => !!document.querySelector('.dashboard-page .desk-arrive'))
  assert.notEqual(await page.locator('.control-welcome').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'welcome has a brand tint')
  await page.locator('.dashboard-business').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => document.querySelector('.dashboard-business')?.classList.contains('desk-arrive'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('.desk-arrive').first().evaluate(el => getComputedStyle(el).animationName), 'none', 'reduced motion disables scroll reveal')
  assert.deepEqual(errors, []); console.log('PASS: sign-in dashboard landing, desktop/mobile contrast and layout, carousel, sidebar motion and focus, saved email drafts, AI demo guidance and vendor-service forms');
  if (process.env.UI_CAPTURE_PRINT === 'true') for (const name of ['desktop', 'mobile', 'dark', 'sidebar', 'email']) console.log(`UI_CAPTURE:${name}:${fs.readFileSync(`${out}/${name}.jpg`).toString('base64')}`)
} finally { await browser?.close(); server.kill('SIGTERM'); fs.rmSync(data, { recursive: true, force: true }) }
