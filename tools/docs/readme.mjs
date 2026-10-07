import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib.mjs'
const OUT = path.join(ROOT, 'corporate-templates')
const inv = JSON.parse(fs.readFileSync(path.join(OUT, 'inventory.json'), 'utf8'))
const cats = [...new Set(inv.map(d => d.cat))]
const md = `# Elvora Shipping LLC Corporate Template Set

## Start here
This pack contains ${inv.length} document designs, each supplied as editable DOCX and reusable DOTX, plus 16 e-mails in HTML and plain text, an HTML e-mail signature, the logo asset, and ready-to-print marketing material (company pamphlet, corporate brochure, capability statement and four service flyers, as HTML source and PDF).

Open a DOTX in Microsoft Word to create a new document without overwriting the template. In Google Docs or LibreOffice, use the DOCX copy. Replace all bracketed fields and review the final page layout after entering real data. The blank templates are not completed transactions.

## Company details
Office: Bur Dubai, Dubai, United Arab Emirates
Phone: +971 50 422 1950
Email: sales@elvorashipping.com
Website: [www.elvorashipping.com](https://www.elvorashipping.com)
Hours: Sun-Thu 09:00-18:00 GST; 24/7 for active shipments

Before issue, verify and enter the full registered address, trade licence, VAT TRN if registered, bank beneficiary and IBAN, authorised signatories and approved contract terms. No registration, tax number, banking detail or certification has been invented. In the marketing material, claims are limited to how the company works; add years in operation, memberships and certifications only when you can prove them.

## Folder layout
- \`documents/<category>/\` – ELV-001 to ELV-082 as \`.docx\` and \`.dotx\`
- \`emails/\` – EM-01 to EM-16 (\`.html\` and \`.txt\`), \`email-signature.html\`, \`logo.png\`, \`INDEX.md\`
- \`marketing/\` – pamphlet, brochure, capability statement and flyers (\`.html\` editable source, \`.pdf\` print-ready)
- \`assets/\` – logo files (primary, reverse, icon)
- \`inventory.json\` – machine-readable list of all documents

To regenerate everything after editing the content: \`npm run docs:build\`.

## Format
Letter portrait 8.5 x 11 inches; 0.95 inch side margins; Arial 10.5 pt body; 22 pt black titles; 11 pt bold black section headings; 1.12 body line spacing; 9 pt tables with repeatable header rows, light grey borders and expandable rows. Colour is concentrated in the approved logo; restrained charcoal tables keep operational forms readable. Headers have no decorative rule. Footer contact details and automatic page number repeat on every page. Marketing pieces use the brand green and red on a dark band and are designed for Letter; resize to A4 before printing in the UAE if your printer requires it.

Body text and descriptions are left aligned. Short quantities, dates and status fields use compact columns. Enter monetary amounts consistently to two decimals and check totals manually; these Word templates do not calculate. Dates should use DD MMM YYYY, times should include GST or the relevant local time zone, and cargo measurements must specify their units.

## Operational and regulatory boundaries
Use the current official carrier, customs, employment and dangerous-goods documents when required. The corresponding preparation worksheets in this pack do not replace them. A company letter is not a carrier release order. The commercial invoice for goods is for the seller to complete and issue. Contracts are editable starting templates with essential fields and schedules to complete and approve before signature. Employment offer and appointment summaries support administration and do not replace official employment contracts.

Tax document fields follow the referenced FTA invoice guidance, but finance must determine registration, place of supply, VAT rate, exchange rate and any applicable electronic invoicing requirements. Do not automatically apply one VAT rate to all freight services. These documents are not connected to an accounting or electronic invoicing platform (the Elvora Logistics OS application in this repository produces its own invoices and e-invoice files).

## Official reference sources
- FTA Tax Invoices clarification VATP006: https://tax.gov.ae/DataFolder/Files/Pdf/06-Tax-Invoices.pdf
- IMO verified gross mass guidance: https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx
- IATA dangerous goods declaration and official form downloads: https://www.iata.org/en/programs/cargo/dangerous-goods/shippers-declaration/
- MOHRE contract documentation guidance: https://taqyeem.mohre.gov.ae/en/media-center/Awareness-and-Guidance/workers-rights.aspx

## Release checklist
1. Correct customer, supplier, employee and company identity.
2. Correct reference, date, scope, cargo and units.
3. Reconciled figures, currency, tax and bank details.
4. All placeholders replaced and unnecessary rows removed.
5. Supporting evidence and attachments checked.
6. Required approvals and signatures obtained.
7. Filled document previewed, exported and archived under its reference.

## Inventory
${cats.map(c => `\n### ${c}\n\n` + inv.filter(d => d.cat === c).map(d => `- ${d.id} — ${d.title}`).join('\n')).join('\n')}

### 07 Marketing and e-mail

- EM-01 to EM-16 — customer, supplier and accounts e-mails (see emails/INDEX.md)
- Company pamphlet, corporate brochure, capability statement
- Flyers: ocean freight, air freight, customs clearance, warehousing and distribution
`
fs.writeFileSync(path.join(OUT, 'README.md'), md)
console.log('readme written')
