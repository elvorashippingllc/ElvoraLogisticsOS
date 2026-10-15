import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, Header, Footer, PageNumber, AlignmentType, BorderStyle, ShadingType, TabStopType, Tab, VerticalAlign, TableLayoutType, LevelFormat } from 'docx'

export const CO = { name: 'Elvora Shipping LLC', addr: 'Bur Dubai, Dubai, UAE', tel: '+971 50 422 1950', mail: 'sales@elvorashipping.com', web: 'www.elvorashipping.com', hours: 'Sun–Thu 09:00–18:00 GST; 24/7 for active shipments' }
export const ROOT = path.resolve(import.meta.dirname, '../..')
const LOGO = fs.readFileSync(path.join(ROOT, 'public/brand/logo-primary.png'))
const W = 9504 // content width in twips (8.5in − 2 × 0.95in)
const GREY = 'C9CFCB', SOFT = 'F1F3F2', CHAR = '2B2F2D', MUTE = '5B6560'
const FONT = 'Arial'

// ------------------------------------------------------------ inline text (**bold** supported)
function runs(text, o = {}) {
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(s => s.startsWith('**') ? new TextRun({ text: s.slice(2, -2), bold: true, font: FONT, size: o.size, color: o.color }) : new TextRun({ text: s, font: FONT, size: o.size, color: o.color, bold: o.bold, italics: o.italics }))
}
const line = 269 // 1.12 line spacing
export const P = (text, o = {}) => ({ k: 'p', text, ...o })
export const H = text => ({ k: 'h', text })
export const L = items => ({ k: 'l', items })              // bullet list
export const N = (items, o = {}) => ({ k: 'n', items, ref: o.ref })              // numbered list
export const NOTE = text => ({ k: 'note', text })
/** Field grid. rows: [[label, value]…]; cols 1 → label|value, cols 2 → label|value|label|value. */
export const F = (rows, cols = 2) => ({ k: 'f', rows, cols })
/** Table. cols: [[header, fraction, align?]…]; rows: array of arrays, or number of blank rows. */
export const T = (cols, rows = 4, o = {}) => ({ k: 't', cols, rows, ...o })
export const TOT = rows => ({ k: 'tot', rows })            // right-aligned totals [[label, value]…]
export const SIG = (parties) => ({ k: 'sig', parties })
export const SP = (n = 1) => ({ k: 'sp', n })
export const PB = () => ({ k: 'pb' })

const border = (c = GREY, sz = 4) => ({ style: BorderStyle.SINGLE, size: sz, color: c })
const borders = (c = GREY) => ({ top: border(c), bottom: border(c), left: border(c), right: border(c) })
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

function cell(text, w, o = {}) {
  const lines = Array.isArray(text) ? text : [text]
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, borders: o.borders ?? borders(), margins: { top: 50, bottom: 50, left: 90, right: 90 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, columnSpan: o.span,
    children: lines.map(t => new Paragraph({ alignment: o.align === 'r' ? AlignmentType.RIGHT : o.align === 'c' ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 252, before: 0, after: 0 , lineRule: 'auto'}, children: runs(t, { size: 18, bold: o.bold, color: o.color }) })),
  })
}
const RH = 340
const row = (cells, o = {}) => new TableRow({ children: cells, tableHeader: o.header, cantSplit: true, height: o.h ? { value: o.h, rule: 'atLeast' } : undefined })

function block(b) {
  switch (b.k) {
    case 'p': return [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line, after: b.after ?? 120 , lineRule: 'auto'}, children: runs(b.text, { size: 21, bold: b.bold, italics: b.italics }) })]
    case 'h': return [new Paragraph({ keepNext: true, spacing: { before: 260, after: 90, line , lineRule: 'auto'}, children: [new TextRun({ text: b.text, bold: true, size: 22, font: FONT })] })]
    case 'l': return b.items.map(t => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { line, after: 40 , lineRule: 'auto'}, children: runs(t, { size: 21 }) }))
    case 'n': return b.items.map((t, i) => new Paragraph({ numbering: { reference: 'num' + (b.ref ?? 0), level: 0 }, spacing: { line, after: 50 , lineRule: 'auto'}, children: runs(t, { size: 21 }) }))
    case 'note': return [new Paragraph({ spacing: { before: 80, after: 120, line , lineRule: 'auto'}, shading: { type: ShadingType.CLEAR, fill: SOFT, color: 'auto' }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: CHAR, space: 6 } }, indent: { left: 120 }, children: runs(b.text, { size: 18, color: MUTE }) })]
    case 'sp': return Array.from({ length: b.n }, () => new Paragraph({ spacing: { after: 120 }, children: [] }))
    case 'pb': return [new Paragraph({ pageBreakBefore: true, children: [] })]
    case 'f': {
      const cols = b.cols
      const lw = cols === 1 ? 2700 : 1500, vw = cols === 1 ? W - lw : (W - 2 * lw) / 2
      const widths = cols === 1 ? [lw, vw] : [lw, vw, lw, vw]
      const rows = []
      for (let i = 0; i < b.rows.length; i += cols) {
        const chunk = b.rows.slice(i, i + cols)
        const cells = []
        for (let j = 0; j < cols; j++) { const r = chunk[j]; cells.push(cell(r ? r[0] : '', widths[j * 2], { fill: SOFT, bold: true }), cell(r ? (r[1] ?? '') : '', widths[j * 2 + 1])) }
        rows.push(row(cells, { h: RH }))
      }
      return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows }), new Paragraph({ spacing: { after: 60 }, children: [] })]
    }
    case 't': {
      const widths = b.cols.map(c => Math.round(W * c[1]))
      const diff = W - widths.reduce((a, x) => a + x, 0); widths[widths.length - 1] += diff
      // guarantee each header's longest word fits on one line; take the space from the widest column
      b.cols.forEach((c, i) => { const need = Math.max(...String(c[0]).split(/[\s/]+/).map(w => w.length)) * 112 + 230; if (widths[i] < need) { const j = widths.indexOf(Math.max(...widths)); widths[j] -= need - widths[i]; widths[i] = need } })
      const head = row(b.cols.map((c, i) => cell(c[0], widths[i], { fill: CHAR, color: 'FFFFFF', bold: true, align: c[2] })), { header: true, h: 360 })
      const body = typeof b.rows === 'number' ? Array.from({ length: b.rows }, () => b.cols.map(() => '')) : b.rows
      const rows = body.map(r => row(r.map((v, i) => cell(v ?? '', widths[i], { align: b.cols[i][2], bold: r.bold })), { h: RH }))
      return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [head, ...rows] }), new Paragraph({ spacing: { after: 60 }, children: [] })]
    }
    case 'tot': {
      const lw = 2300, vw = 1700, ml = W - lw - vw
      return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [ml, lw, vw], layout: TableLayoutType.FIXED, rows: b.rows.map(r => row([cell('', ml, { borders: { top: none, bottom: none, left: none, right: none } }), cell(r[0], lw, { fill: SOFT, bold: true }), cell(r[1] ?? '[0.00]', vw, { align: 'r' })], { h: 320 })) }), new Paragraph({ spacing: { after: 80 }, children: [] })]
    }
    case 'sig': {
      const n = b.parties.length, w = Math.floor(W / n)
      const mk = (fn) => new TableRow({ cantSplit: true, children: b.parties.map((p, i) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none }, margins: { left: i ? 160 : 0, right: 160 }, children: fn(p) })) })
      const par = (t, o = {}) => new Paragraph({ spacing: { after: 40, line: 252 , lineRule: 'auto'}, children: runs(t, { size: 18, ...o }) })
      return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: Array(n).fill(w), layout: TableLayoutType.FIXED, rows: [
        mk(p => [par('**' + p + '**')]),
        mk(() => [new Paragraph({ spacing: { before: 520, after: 40 }, border: { bottom: border('888F8B', 6) }, children: [] }), par('Signature')]),
        mk(() => [par('Name: [Full name]'), par('Title: [Position]'), par('Date: [DD MMM YYYY]'), par('Company stamp (if applicable)')]),
      ] }), new Paragraph({ spacing: { after: 60 }, children: [] })]
    }
  }
  return []
}

function header() {
  return new Header({ children: [new Paragraph({ spacing: { after: 160 }, children: [new ImageRun({ type: 'png', data: LOGO, transformation: { width: 150, height: 34 }, altText: { title: 'Elvora Shipping', description: 'Elvora Shipping logo', name: 'logo' } })] })] })
}
function footer(code, title) {
  const s = { size: 15, color: MUTE, font: FONT }
  return new Footer({ children: [
    new Paragraph({ spacing: { after: 20, line: 240, lineRule: 'auto' }, children: [new TextRun({ text: `${code}  ·  ${title}  ·  Page `, ...s }), new TextRun({ children: [PageNumber.CURRENT], ...s })] }),
    new Paragraph({ spacing: { after: 20, line: 240, lineRule: 'auto' }, children: [new TextRun({ text: `${CO.name}  ·  Dubai, UAE  ·  ${CO.tel}  ·  ${CO.mail}  ·  ${CO.web}`, ...s })] }),
  ] })
}

export async function buildDocx(def) {
  const body = []
  body.push(new Paragraph({ spacing: { before: 80, after: def.subtitle ? 40 : 200, line , lineRule: 'auto'}, children: [new TextRun({ text: def.title, bold: true, size: 44, font: FONT, color: '000000' })] }))
  if (def.subtitle) body.push(new Paragraph({ spacing: { after: 200, line , lineRule: 'auto'}, children: runs(def.subtitle, { size: 20, color: MUTE }) }))
  for (const b of def.blocks) body.push(...block(b))
  const numCfg = Array.from({ length: 4 }, (_, i) => ({ reference: 'num' + i, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 440, hanging: 340 } } } }] }))
  const doc = new Document({
    creator: CO.name, title: `${def.id} ${def.title}`, description: `${CO.name} corporate template`, subject: def.cat,
    styles: { default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line , lineRule: 'auto'} } } } },
    numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 440, hanging: 280 } } } }] }, ...numCfg] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1250, left: 1368, right: 1368, header: 560, footer: 480 } } }, headers: { default: header() }, footers: { default: footer(def.id, def.title) }, children: body }],
  })
  return fixFooter(await Packer.toBuffer(doc))
}

/** Give PAGE / NUMPAGES fields an explicit result run so every viewer applies the footer font size. */
async function fixFooter(buf) {
  const zip = await JSZip.loadAsync(buf)
  for (const name of Object.keys(zip.files).filter(n => /^word\/footer\d+\.xml$/.test(n))) {
    let x = await zip.file(name).async('string')
    x = x.replace(/<w:r>(<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>)<w:fldChar w:fldCharType="begin"\/><w:instrText xml:space="preserve">(PAGE|NUMPAGES)<\/w:instrText><w:fldChar w:fldCharType="separate"\/><w:fldChar w:fldCharType="end"\/><\/w:r>/g,
      (_m, rpr, ins) => `<w:fldSimple w:instr=" ${ins} "><w:r>${rpr}<w:t>1</w:t></w:r></w:fldSimple>`)
    x = x.replace('w:pos="9504"', 'w:pos="9490"')
    zip.file(name, x)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/** DOCX → DOTX: same package, template main-part content type. */
export async function toDotx(docx) {
  const zip = await JSZip.loadAsync(docx)
  const ct = await zip.file('[Content_Types].xml').async('string')
  zip.file('[Content_Types].xml', ct.replace('wordprocessingml.document.main+xml', 'wordprocessingml.template.main+xml'))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
export const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
