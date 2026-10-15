// Builds the Document Studio template library (src/server/studio/library.json) from the same content definitions that produce the Word templates,
// plus the e-mail templates and the designed marketing pieces. Run with `npm run docs:studio`.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib.mjs'
import { EMAILS } from './emails.mjs'

const OUT = path.join(ROOT, 'src/server/studio/library.json')
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const CO_TOKENS = [
  [/Elvora Shipping LLC/g, '{{company.name}}'],
  [/Bur Dubai, Dubai, United Arab Emirates/g, '{{company.address}}'],
  [/\+971 50 422 1950/g, '{{company.phone}}'],
  [/sales@elvorashipping\.com/g, '{{company.email}}'],
  [/www\.elvorashipping\.com/g, '{{company.website}}'],
]
const tokenise = s => CO_TOKENS.reduce((t, [re, v]) => t.replace(re, v), s)

/** Inline text: escape, **bold**, line breaks, and [placeholders] highlighted so unfilled fields are easy to find. */
function inline(text) {
  let t = esc(tokenise(String(text ?? '')))
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\[([^\[\]\n]{1,90})\]/g, '<span class="ph">[$1]</span>')
  return t.replace(/\n/g, '<br>')
}
const cellHtml = (v, tag = 'td', attrs = '') => `<${tag}${attrs}>${inline(v)}</${tag}>`

function block(b) {
  switch (b.k) {
    case 'p': return `<p${b.bold ? '' : ''}>${b.bold ? `<strong>${inline(b.text)}</strong>` : inline(b.text)}</p>`
    case 'h': return `<h2>${inline(b.text)}</h2>`
    case 'l': return `<ul>${b.items.map(i => `<li>${inline(i)}</li>`).join('')}</ul>`
    case 'n': return `<ol>${b.items.map(i => `<li>${inline(i)}</li>`).join('')}</ol>`
    case 'note': return `<div class="guidance">${inline(b.text)}</div>`
    case 'sp': return '<p><br></p>'.repeat(b.n)
    case 'pb': return '<div class="page-break"></div>'
    case 'f': {
      const rows = []
      for (let i = 0; i < b.rows.length; i += b.cols) {
        const chunk = b.rows.slice(i, i + b.cols); const cells = []
        for (let j = 0; j < b.cols; j++) { const r = chunk[j]; cells.push(cellHtml(r ? r[0] : '', 'th'), cellHtml(r ? (r[1] ?? '') : '')) }
        rows.push(`<tr>${cells.join('')}</tr>`)
      }
      return `<table class="fields"><tbody>${rows.join('')}</tbody></table>`
    }
    case 't': {
      const widths = b.cols.map(c => Math.round(c[1] * 100))
      const body = typeof b.rows === 'number' ? Array.from({ length: b.rows }, () => b.cols.map(() => '')) : b.rows
      return `<table><colgroup>${widths.map(w => `<col style="width:${w}%">`).join('')}</colgroup><thead><tr>${b.cols.map(c => cellHtml(c[0], 'th', c[2] === 'r' ? ' style="text-align:right"' : '')).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map((v, i) => cellHtml(v ?? '', 'td', b.cols[i][2] === 'r' ? ' style="text-align:right"' : '')).join('')}</tr>`).join('')}</tbody></table>`
    }
    case 'tot': return `<table class="totals"><tbody>${b.rows.map(r => `<tr>${cellHtml('', 'td')}${cellHtml(r[0], 'th')}${cellHtml(r[1] ?? '[0.00]', 'td', ' style="text-align:right"')}</tr>`).join('')}</tbody></table>`
    case 'sig': {
      const n = b.parties.length
      const cols = b.parties.map(() => `<col style="width:${Math.floor(100 / n)}%">`).join('')
      const row = fn => `<tr>${b.parties.map(p => `<td>${fn(p)}</td>`).join('')}</tr>`
      return `<table class="sig"><colgroup>${cols}</colgroup><tbody>${row(p => `<strong>${inline(p)}</strong>`)}${row(() => '<div class="sig-line"></div>Signature')}${row(() => 'Name: <span class="ph">[Full name]</span><br>Title: <span class="ph">[Position]</span><br>Date: <span class="ph">[DD MMM YYYY]</span><br>Company stamp (if applicable)')}</tbody></table>`
    }
  }
  return ''
}

const CATEGORY = {
  '01 Corporate': 'Corporate', '02 Sales and Customers': 'Sales & Customers', '03 Finance and Procurement': 'Finance & Procurement', '04 Shipping and Warehouse': 'Shipping & Warehouse',
  '05 HR and Administration': 'HR & Administration', '06 Control and Guidance': 'Control & Guidance',
  '07 Legal and Contracts': 'Legal & Contracts', '08 Letters and Notices': 'Letters & Notices', '09 Customs and Compliance': 'Customs & Compliance',
}
const kindOf = (title, cat) => {
  if (/agreement|resolution|power of attorney|indemnity|contract|conditions/i.test(title)) return 'Contract'
  if (/certificate/i.test(title)) return 'Certificate'
  if (/policy|procedure|plan\b/i.test(title)) return 'Policy'
  if (/letter|memorandum|notice|advisory|memo|reference/i.test(title)) return 'Letter'
  if (/form|checklist|request|application|record|register|worksheet|sheet|declaration|instruction|inspection|report|review|dashboard|timesheet|statement|reconciliation/i.test(title)) return /report|review|dashboard|statement/i.test(title) ? 'Report' : 'Form'
  if (cat === 'Marketing & Brochures') return 'Marketing'
  return 'Document'
}
const widest = blocks => Math.max(0, ...blocks.filter(b => b.k === 't').map(b => b.cols.length))

const library = []
for (const n of ['01', '02', '03', '04', '05', '06', '07']) {
  const f = path.join(import.meta.dirname, `defs-${n}.mjs`)
  if (!fs.existsSync(f)) continue
  for (const d of (await import(f)).default) {
    const category = CATEGORY[d.cat] ?? d.cat
    const html = `<h1>${inline(d.title)}</h1>${d.subtitle ? `<p class="muted">${inline(d.subtitle)}</p>` : ''}${d.blocks.map(block).join('\n')}`
    library.push({ code: d.id, title: d.title, category, kind: kindOf(d.title, category), orientation: widest(d.blocks) >= 8 ? 'Landscape' : 'Portrait', letterhead: true, description: d.subtitle || `${d.title} – fill in the highlighted fields, edit as needed, then print or save as PDF.`, tags: [d.cat.replace(/^\d+\s/, ''), d.title].join(' ').toLowerCase(), html })
  }
}

// e-mail templates (subject line first, then the message). They are text documents here; send them from the Email page.
for (const e of EMAILS) {
  const body = e.body.map(b => typeof b === 'string' ? `<p>${inline(b)}</p>` : b.t === 'table' ? `<table class="fields"><tbody>${b.rows.map(r => `<tr>${cellHtml(r[0], 'th')}${cellHtml(r[1])}</tr>`).join('')}</tbody></table>` : `<ul>${b.items.map(i => `<li>${inline(i)}</li>`).join('')}</ul>`).join('\n')
  library.push({ code: `EM-${String(e.n).padStart(2, '0')}`, title: e.subject.replace(/\[[^\]]*\]/g, '').replace(/\s+[–-]\s*$/, '').replace(/\s{2,}/g, ' ').trim() || e.slug, category: 'E-mail templates', kind: 'E-mail', orientation: 'Portrait', letterhead: false, description: e.use, tags: `email ${e.slug.replace(/-/g, ' ')}`, html: `<p class="muted">Subject</p><h2>${inline(e.subject)}</h2>${body}` })
}

// designed marketing pieces
const marketing = (await import(path.join(import.meta.dirname, 'studio-marketing.mjs'))).default
for (const m of marketing) library.push({ letterhead: false, orientation: 'Portrait', kind: 'Marketing', category: 'Marketing & Brochures', ...m, html: tokenise(m.html).replace(/\[([^\[\]\n<>]{1,90})\]/g, '<span class="ph">[$1]</span>') })

const seen = new Set()
for (const t of library) { if (seen.has(t.code)) throw new Error('duplicate template code ' + t.code); seen.add(t.code) }
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(library))
console.log(`Document Studio library: ${library.length} templates → ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`)
