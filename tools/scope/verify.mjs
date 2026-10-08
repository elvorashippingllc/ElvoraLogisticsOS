import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const root = new URL('../../', import.meta.url)
const original = readFileSync(new URL('docs/scope/MASTER-SPECIFICATION.md', root))
const text = original.toString('utf8')
const data = JSON.parse(readFileSync(new URL('src/shared/enterprise-scope.json', root), 'utf8'))
assert.equal(createHash('sha256').update(original).digest('hex'), data.sourceSha256, 'Canonical source changed: update the coverage assessment deliberately')
const headings = [...text.matchAll(/^#{1,2} (\d+)\. (.+)$/gm)]
assert.equal(headings.length, 147)
assert.equal(data.sections.length, 147)
assert.deepEqual(data.sections.map(s => s.id), Array.from({ length: 147 }, (_, i) => i + 1))
for (let i = 0; i < headings.length; i++) {
  const match = headings[i], section = data.sections[i]
  const end = headings[i + 1]?.index ?? text.indexOf('# Final operating lifecycle', match.index)
  assert.equal(section.title, match[2])
  assert.equal(section.specification, text.slice(match.index, end).trim(), `Requirement ${section.id} was omitted or altered`)
  assert.ok(section.gap && section.evidence)
  assert.ok(['Partial', 'Missing', 'External validation'].includes(section.status))
  for (const path of section.sources) assert.ok(existsSync(new URL(path, root)), `Missing evidence: ${path}`)
}
for (const label of ['# Final operating lifecycle', 'ELVORA CONTROL', ...data.areas]) assert.ok(text.includes(label), `Missing canonical content: ${label}`)
console.log('Scope integrity passed: 147 complete original sections, lifecycle, product areas and evidence paths.')
