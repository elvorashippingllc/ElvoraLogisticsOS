import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { q } from '../src/server/db'
import { getSetting, setSettings } from '../src/server/settings'
import { mergeCompanyTokens, presentDocumentHtml } from '../src/shared/studio-html'

syncSchema()
// Simulate an existing installation whose original compliance seed already ran.
q.run("INSERT INTO settings(key,value,updated_at) VALUES ('seed:compliance','1',?)", new Date().toISOString())
setSettings({ company_name: 'Elvora Shipping L.L.C.', company_address: 'Naif, Dubai, United Arab Emirates (Parcel ID 118-157)', company_email: 'accounts@example.test', company_trn: '100123456700003' })
seedReference()
assert.equal(getSetting('company_name'), 'ELVORA SHIPPING L.L.C')
assert.equal(getSetting('company_address'), 'Bur Dubai, Dubai, UAE')
assert.equal(getSetting('company_email'), 'accounts@example.test')
assert.equal(getSetting('company_trn'), '100123456700003')
assert.equal(getSetting('ct_registered'), false)
assert.equal(getSetting('ct_trn'), '')
assert.equal(getSetting('ct_application_reference'), '101002831255')
assert.equal(getSetting('establishment_card_no'), '2/1/1336642')
assert.equal(q.val("SELECT reference_no FROM compliance_items WHERE name='Corporate tax registration'"), '101002831255')
const count = q.val('SELECT COUNT(*) FROM compliance_items')
setSettings({ company_address: 'Administrator updated office', ct_application_status: 'Approved - certificate reviewed' })
seedReference()
assert.equal(getSetting('company_address'), 'Administrator updated office')
assert.equal(getSetting('ct_application_status'), 'Approved - certificate reviewed')
assert.equal(q.val('SELECT COUNT(*) FROM compliance_items'), count)
const html = mergeCompanyTokens('{{company.address_ar}} / {{company.dcci_no}} / {{company.legal_form}} / {{company.ct_application_reference}}', { company_address_ar: 'دبي', dcci_no: '697774', company_legal_form: '<LLC & SO>', ct_application_reference: '101002831255' }, '2026-10-15')
assert.equal(html, 'دبي / 697774 / &lt;LLC &amp; SO&gt; / 101002831255')
for (const code of ['CO-FACTS', 'CO-LETTER', 'CO-REG']) assert.equal(q.val('SELECT COUNT(*) FROM doc_templates WHERE code=? AND active=1', code), 1)
console.log('Company documents passed: existing-install migration, source facts, TRN separation, token escaping, template installation and preservation of administrator changes.')

const contact = '<table><tr><th>Trade licence</th><td>1645802</td><th>Contact</th><td>sales@example.test</td></tr><tr><th>Supplier TRN</th><td>100123456700003</td></tr></table><p>{{company.name_ar}}</p><h1>Letter / رسالة</h1>'
const general = presentDocumentHtml(contact, 'Company profile')
assert.ok(!/1645802|100123456700003|[\u0600-\u06ff]|name_ar/.test(general))
assert.ok(general.includes('sales@example.test'))
for (const title of ['Tax Invoice', 'Credit Note', 'Debit Note']) {
 const tax = presentDocumentHtml(contact, title)
 assert.ok(tax.includes('100123456700003'))
 assert.ok(!tax.includes('1645802'))
}
assert.ok(!presentDocumentHtml(contact, 'Proforma Invoice').includes('100123456700003'))
assert.equal(presentDocumentHtml('<p>Office F101-3, Ibrahim Mohammed Sharif Balsalah building, Naif, Dubai, United Arab Emirates</p>'), '<p>Bur Dubai, Dubai, UAE</p>')
console.log('English presentation passed: no Arabic or general identifiers, preserved required tax fields and contact cells, legacy address replacement.')
