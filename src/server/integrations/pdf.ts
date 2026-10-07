import fs from 'node:fs'
import path from 'node:path'
import { chromium, type Browser } from 'playwright-core'
import { config } from '../config'
import { bad } from '../util'

function findChrome(): string | undefined {
  const cand = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean) as string[]
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (pw && fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter(x => /^chromium-\d+/.test(x))) cand.push(path.join(pw, d, 'chrome-linux', 'chrome'), path.join(pw, d, 'chrome-linux64', 'chrome'))
  return cand.find(p => { try { return fs.existsSync(p) } catch { return false } })
}
export const pdfAvailable = () => !!findChrome()

let browser: Browser | null = null, idle: NodeJS.Timeout | null = null
async function getBrowser(): Promise<Browser> {
  if (idle) clearTimeout(idle)
  if (!browser || !browser.isConnected()) {
    const exe = findChrome()
    if (!exe) throw bad('PDF engine (Chromium) is not installed on this server. Set CHROME_PATH or use the Docker image, which includes it.')
    browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] })
  }
  idle = setTimeout(() => { void browser?.close().catch(() => {}); browser = null }, 60_000)
  idle.unref()
  return browser
}

/** Render one of the app's own print pages to a PDF, authenticated with the requester's session cookie. */
export async function renderPrintPdf(printPath: string, cookie: { name: string; value: string }, opts: { landscape?: boolean } = {}): Promise<Buffer> {
  if (!/^\/print\/[\w-]+\/[\w,-]+(\?[\w=&,%-]*)?$/.test(printPath)) throw bad('Invalid print path')
  const b = await getBrowser()
  const ctx = await b.newContext({ viewport: { width: 1000, height: 1400 } })
  try {
    await ctx.addCookies([{ name: cookie.name, value: cookie.value, domain: '127.0.0.1', path: '/', httpOnly: true, secure: false }])
    const page = await ctx.newPage()
    await page.goto(`http://127.0.0.1:${config.port}${printPath}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('.print-sheet', { timeout: 15000 })
    await page.evaluate(() => (document as any).fonts?.ready)
    await page.waitForTimeout(250)
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, landscape: opts.landscape, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }))
  } finally { await ctx.close().catch(() => {}) }
}
