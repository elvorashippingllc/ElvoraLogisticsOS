import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib.mjs'
import { EMAILS, renderHtml, renderText, SIGNATURE_HTML } from './emails.mjs'
import run from './marketing.mjs'
const OUT = path.join(ROOT, 'corporate-templates')
const ed = path.join(OUT, 'emails'); fs.mkdirSync(ed, { recursive: true })
for (const e of EMAILS) { const base = `EM-${String(e.n).padStart(2, '0')}-${e.slug}`; fs.writeFileSync(path.join(ed, base + '.html'), renderHtml(e)); fs.writeFileSync(path.join(ed, base + '.txt'), renderText(e)) }
fs.writeFileSync(path.join(ed, 'email-signature.html'), SIGNATURE_HTML)
fs.copyFileSync(path.join(ROOT, 'public/brand/logo-primary.png'), path.join(ed, 'logo.png'))
fs.writeFileSync(path.join(ed, 'INDEX.md'), '# E-mail templates\n\nHost `logo.png` on your website (or attach it inline) and change the `src` in each HTML file. Replace every bracketed field before sending.\n\n| No. | File | Use | Subject |\n|---|---|---|---|\n' + EMAILS.map(e => `| ${e.n} | EM-${String(e.n).padStart(2, '0')}-${e.slug} (.html / .txt) | ${e.use} | ${e.subject} |`).join('\n') + '\n')
await run()
console.log('emails', EMAILS.length, 'marketing done')
