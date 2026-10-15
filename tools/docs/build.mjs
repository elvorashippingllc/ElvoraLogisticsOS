import fs from 'node:fs'
import path from 'node:path'
import { buildDocx, toDotx, slug, ROOT } from './lib.mjs'
const only = process.argv[2] && !process.argv[2].startsWith('--from=') ? process.argv[2] : undefined
const from = Number((process.argv.find(a => a.startsWith('--from=')) ?? '').slice(7)) || 0   // --from=83 builds ELV-083 and above only
const OUT = path.join(ROOT, 'corporate-templates')
const mods = ['01', '02', '03', '04', '05', '06', '07', '08'].filter(n => fs.existsSync(path.join(import.meta.dirname, `defs-${n}.mjs`)))
const all = []
for (const m of mods) all.push(...(await import(`./defs-${m}.mjs`)).default)
let n = 0
for (const d of all) {
  if (only && !d.id.includes(only)) continue
  if (from && Number(d.id.replace(/\D/g, '')) < from) continue
  const dir = path.join(OUT, 'documents', slug(d.cat)); fs.mkdirSync(dir, { recursive: true })
  const base = `${d.id}-${slug(d.title)}`
  const docx = await buildDocx(d)
  fs.writeFileSync(path.join(dir, base + '.docx'), docx)
  fs.writeFileSync(path.join(dir, base + '.dotx'), await toDotx(docx))
  n++
}
fs.writeFileSync(path.join(OUT, 'inventory.json'), JSON.stringify(all.map(d => ({ id: d.id, title: d.title, cat: d.cat, file: `documents/${slug(d.cat)}/${d.id}-${slug(d.title)}` })), null, 1))
console.log(`built ${n} documents (${all.length} defined)`)
