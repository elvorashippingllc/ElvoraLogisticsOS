import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { ROOT } from './lib.mjs'
import { CO } from './emails.mjs'

const OUT = path.join(ROOT, 'corporate-templates/marketing')
fs.mkdirSync(OUT, { recursive: true })
const CSS = `
@page { size: letter; margin: 0 }
*{box-sizing:border-box} body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#161d1a;font-size:11pt;line-height:1.45}
.page{width:8.5in;height:11in;position:relative;overflow:hidden;page-break-after:always;background:#fff}
.page:last-child{page-break-after:auto}
.land .page{width:11in;height:8.5in}
.logo{height:.5in}
.band{background:#14211b;color:#fff;padding:.5in .7in .45in}
.band h1{margin:.28in 0 .08in;font-size:30pt;line-height:1.1;letter-spacing:-.01em}
.band p{margin:0;font-size:13pt;color:#d6e4dc;max-width:6in}
.accent{height:.09in;background:linear-gradient(90deg,#007b52 0 70%,#c32135 70% 100%)}
.body{padding:.35in .7in}
h2{font-size:15pt;margin:.22in 0 .08in;color:#007b52} h3{font-size:11.5pt;margin:.14in 0 .03in}
p{margin:0 0 .09in} ul{margin:.04in 0 .12in 0;padding-left:.2in} li{margin-bottom:.04in}
.cols{display:flex;gap:.3in} .cols>div{flex:1}
.card{border:1px solid #d5dad7;border-radius:6px;padding:.09in .15in;margin-bottom:.08in} .card p{margin:0}
.card h3{margin-top:0;color:#14211b}
.big{font-size:26pt;font-weight:bold;color:#007b52;line-height:1}
.foot{position:absolute;left:0;right:0;bottom:0;background:#14211b;color:#d6e4dc;padding:.22in .7in;font-size:9.5pt;display:flex;justify-content:space-between;gap:.2in}
.foot b{color:#fff}
.cta{display:inline-block;background:#007b52;color:#fff;font-weight:bold;padding:.1in .22in;border-radius:4px;margin-top:.06in}
.steps{counter-reset:s;list-style:none;padding:0} .steps li{counter-increment:s;position:relative;padding-left:.42in;margin-bottom:.12in} .steps li:before{content:counter(s);position:absolute;left:0;top:-.02in;width:.3in;height:.3in;border-radius:50%;background:#007b52;color:#fff;text-align:center;line-height:.3in;font-weight:bold;font-size:10pt}
.cap h2{margin:.12in 0 .05in} .cap li{margin-bottom:.02in}
table{border-collapse:collapse;width:100%;font-size:10pt} th{background:#14211b;color:#fff;text-align:left;padding:.06in .1in} td{border-bottom:1px solid #d5dad7;padding:.06in .1in}
.small{font-size:9pt;color:#5b6560}
`
const foot = `<div class="foot"><div><b>${CO.name}</b><br>${CO.addr}</div><div>${CO.tel}<br>${CO.mail}</div><div>${CO.web}<br>${CO.hours}</div></div>`
const head = (title, sub) => `<div class="band"><img class="logo" src="../assets/logo-reverse.png" alt="Elvora Shipping"><h1>${title}</h1><p>${sub}</p></div><div class="accent"></div>`
const page = inner => `<div class="page">${inner}</div>`
const doc = (title, pages, land = false) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body class="${land ? 'land' : ''}">${pages.join('')}</body></html>`
const REQ = `<p class="small">Quotations are valid for the period stated and subject to carrier space, equipment and surcharges at the time of booking.</p>`
const CTA = `<h2>Ask for a quotation</h2><p>Send us the origin, destination, cargo description, weight, volume and the date the cargo will be ready. You will get a written quotation, normally within one working day.</p><span class="cta">${CO.mail} · ${CO.tel}</span>`

const pieces = {
  'company-pamphlet': { size: 'p', html: doc('Elvora Shipping – company pamphlet', [
    page(`${head('Freight forwarding that keeps you informed', 'Sea, air and road cargo from Dubai, with one coordinator who knows your shipment.')}<div class="body">
<h2 style="margin-top:.1in">Who we are</h2><p>Elvora Shipping LLC is a freight forwarding and logistics company based in Bur Dubai. We move cargo for importers, exporters and traders between the UAE and the rest of the world, and we take care of the paperwork, customs and delivery around each shipment.</p>
<p>We keep things simple. You get a written quotation before we book, a named person to call, and updates at every milestone – not only when something goes wrong.</p>
<h2>What we do</h2><div class="cols"><div><div class="card"><h3>Ocean freight</h3><p>Full and part containers, import and export, with booking, container release, documents and tracking.</p></div><div class="card"><h3>Air freight</h3><p>Airport-to-airport and door-to-door for urgent, valuable and time-sensitive cargo.</p></div><div class="card"><h3>Road transport</h3><p>Trucking inside the UAE and across the GCC, with trip planning and signed proof of delivery.</p></div></div>
<div><div class="card"><h3>Customs clearance</h3><p>Declarations, duty calculation and document checks prepared with licensed customs brokers.</p></div><div class="card"><h3>Warehousing</h3><p>Receiving, storage, picking and dispatch of customer cargo, with stock reports.</p></div><div class="card"><h3>Special cargo</h3><p>Out-of-gauge, temperature-sensitive and dangerous goods handled with qualified carriers and the required declarations.</p></div></div></div></div>${foot}`),
    page(`<div class="body" style="padding-top:.6in"><h2>How a shipment works with us</h2><ol class="steps"><li><b>Enquiry.</b> Tell us what you are shipping and where it needs to go.</li><li><b>Quotation.</b> We send a clear written price with what is and is not included.</li><li><b>Booking.</b> We book space, confirm cut-off dates and tell you which documents we need.</li><li><b>Movement.</b> We follow the cargo, handle documents and customs, and update you at each milestone.</li><li><b>Delivery.</b> You receive the cargo and a signed proof of delivery.</li><li><b>Invoice.</b> The invoice matches the quotation. Any change is explained before it appears.</li></ol>
<h2>Why customers stay with us</h2><ul><li><b>One coordinator</b> for your account, reachable by phone and e-mail.</li><li><b>Plain answers.</b> If a vessel rolls or customs asks a question, we tell you early and say what we are doing about it.</li><li><b>Tracking you can share</b> with your own customers.</li><li><b>Accurate paperwork.</b> We check documents against each other before they reach the carrier or customs.</li><li><b>Open day-to-day accounts.</b> Monthly statements and a named person in accounts.</li></ul>${CTA}${REQ}</div>${foot}`),
  ]) },
  'service-flyer-ocean-freight': { size: 'p', html: doc('Ocean freight flyer', [page(`${head('Ocean freight, door to door or port to port', 'FCL and LCL imports and exports through the UAE.')}<div class="body"><div class="cols"><div><h2>What is included</h2><ul><li>Carrier selection and booking</li><li>Empty container pickup and loading coordination</li><li>Export and import customs clearance</li><li>Bill of lading preparation and checking</li><li>Container tracking and milestone updates</li><li>Delivery to your warehouse or site</li></ul></div><div><h2>Good to know</h2><ul><li>Full containers (20ft, 40ft, 40ft high-cube) and part-container consolidation</li><li>Reefer and special equipment on request</li><li>Clear cut-off dates in the booking confirmation</li><li>Free-time and detention watched on every container</li></ul></div></div>
<h2>What we need from you</h2><table><tr><th>Before booking</th><th>Before sailing</th></tr><tr><td>Origin, destination, cargo description, weight and volume, ready date, Incoterm</td><td>Commercial invoice, packing list, shipping instructions, verified gross mass for each container</td></tr></table>
${CTA}${REQ}</div>${foot}`)]) },
  'service-flyer-air-freight': { size: 'p', html: doc('Air freight flyer', [page(`${head('Air freight when time matters', 'Fast, tracked and handled with care.')}<div class="body"><div class="cols"><div><h2>Our air service</h2><ul><li>Airport-to-airport and door-to-door</li><li>Consolidation for smaller shipments</li><li>Express and next-flight-out options</li><li>Charter enquiries for large or urgent cargo</li><li>Special handling for valuable, perishable and fragile goods</li></ul></div><div><h2>Before you ship</h2><ul><li>We calculate chargeable weight from actual and volumetric weight, so you know the basis of the price.</li><li>Dangerous goods require the correct declaration and carrier approval before we accept them.</li><li>Send the invoice and packing list in advance so we can prepare customs documents.</li></ul></div></div>
<h2>How we keep you updated</h2><p>You receive the air waybill number, flight details, departure and arrival confirmation, and delivery notice with proof of delivery.</p>${CTA}${REQ}</div>${foot}`)]) },
  'service-flyer-customs-clearance': { size: 'p', html: doc('Customs clearance flyer', [page(`${head('Customs clearance without surprises', 'Documents checked before they are filed.')}<div class="body"><div class="cols"><div><h2>What we handle</h2><ul><li>Import and export declarations</li><li>HS code and valuation checks</li><li>Duty and VAT calculation for your approval</li><li>Permits and certificates for regulated goods</li><li>Inspection coordination and release</li><li>Delivery after clearance</li></ul></div><div><h2>Documents we normally need</h2><ul><li>Commercial invoice and packing list</li><li>Bill of lading or air waybill</li><li>Delivery order from the carrier</li><li>Certificate of origin, if applicable</li><li>Import or export permits for controlled goods</li><li>Your importer / exporter registration details</li></ul></div></div>
<h2>Why it matters</h2><p>Most customs delays come from documents that do not match, an incorrect description or a missing permit. We compare every document before submission and call you if something looks wrong, so the cargo is not held while we wait for an answer.</p><p class="small">Declarations are prepared and submitted with licensed customs brokers. Duty rates and requirements are set by the authorities and can change.</p>${CTA}</div>${foot}`)]) },
  'service-flyer-warehousing-distribution': { size: 'p', html: doc('Warehousing and distribution flyer', [page(`${head('Warehousing and distribution in Dubai', 'Store it, count it, and send it where it needs to go.')}<div class="body"><div class="cols"><div><h2>Warehouse services</h2><ul><li>Receiving with count and condition check</li><li>Racked and floor storage by owner, bin and lot</li><li>Picking, packing and labelling</li><li>Dispatch to customers or ports</li><li>Cross-docking and short-term storage</li><li>Stock reports and cycle counts</li></ul></div><div><h2>Transport</h2><ul><li>Pickups and deliveries across the UAE</li><li>GCC cross-border trucking</li><li>Delivery notes and signed proof of delivery</li><li>Trip planning and driver contact</li></ul></div></div>
<h2>You always know what you have</h2><p>Every receipt and dispatch is recorded against your account. You can ask for current stock by item, bin and expiry date, and we count regularly and tell you about any difference before it becomes a problem.</p><p class="small">Storage terms, minimum periods and handling rates are agreed in writing before cargo is received.</p>${CTA}</div>${foot}`)]) },
  'capability-statement': { size: 'p', html: doc('Capability statement', [page(`${head('Capability statement', 'Elvora Shipping LLC · freight forwarding and logistics · Dubai, UAE')}<div class="body cap" style="font-size:9.5pt;padding-top:.15in;line-height:1.35"><h2 style="margin-top:.05in">Company</h2><table><tr><td><b>Legal name</b></td><td>${CO.name}</td></tr><tr><td><b>Office</b></td><td>${CO.addr}</td></tr><tr><td><b>Trade licence</b></td><td>[Licence number, issuing authority]</td></tr><tr><td><b>VAT TRN</b></td><td>[TRN, if registered]</td></tr><tr><td><b>Contact</b></td><td>${CO.tel} · ${CO.mail} · ${CO.web}</td></tr></table>
<h2>Core services</h2><ul><li>International sea and air freight forwarding (import, export, cross-trade)</li><li>Customs clearance support through licensed brokers</li><li>UAE and GCC road transport</li><li>Warehousing, distribution and stock reporting</li><li>Project, out-of-gauge, temperature-controlled and dangerous goods (with qualified carriers and required declarations)</li></ul>
<h2>Differentiators</h2><ul><li>Named coordinator on every account</li><li>Written quotation and booking confirmation for every shipment</li><li>Milestone tracking with a shareable tracking link</li><li>Documents cross-checked before submission</li><li>Open accounts reporting and monthly statements</li></ul>
<h2>Typical customers</h2><p>Importers and exporters, traders, manufacturers and distributors, and other freight forwarders needing a Dubai partner. [Add sectors and sample trade lanes you actively serve.]</p>
<h2>Compliance and references</h2><p>[List only licences, memberships, certifications and insurance that you currently hold, with numbers and expiry dates. Add customer references with their permission.]</p></div>${foot}`)]) },
  'corporate-brochure': { size: 'l', html: doc('Elvora Shipping – corporate brochure', [
    `<div class="page" style="display:flex"><div style="flex:1;padding:.55in .45in;background:#fff"><h2 style="margin-top:0">Our promise</h2><p>Every shipment has a person behind it. We quote clearly, book carefully, keep you informed, and invoice what we agreed.</p><div class="card"><div class="big">1</div><p>coordinator per customer account</p></div><div class="card"><div class="big">3</div><p>modes of transport: sea, air and road</p></div><h2>Get in touch</h2><p>${CO.tel}<br>${CO.mail}<br>${CO.web}</p></div>
<div style="flex:1;padding:.55in .45in;background:#f3f5f4"><h2 style="margin-top:0">Services at a glance</h2><ul><li>Ocean freight – FCL and LCL</li><li>Air freight – standard and urgent</li><li>Road transport – UAE and GCC</li><li>Customs clearance support</li><li>Warehousing and distribution</li><li>Special and project cargo</li></ul><p class="small">Details inside.</p></div>
<div style="flex:1;background:#14211b;color:#fff;padding:.55in .45in;text-align:left"><img src="../assets/logo-reverse.png" style="height:.7in" alt="Elvora Shipping"><h1 style="font-size:26pt;line-height:1.1;margin:.5in 0 .1in">Moving your cargo with care</h1><p style="color:#d6e4dc">Freight forwarding and logistics from Dubai.</p><p style="margin-top:2in;font-size:9pt;color:#9fb3a8">${CO.name}<br>${CO.addr}</p></div></div>`,
    `<div class="page" style="display:flex"><div style="flex:1;padding:.5in .45in"><h2 style="margin-top:0">About Elvora Shipping</h2><p>We are a Dubai freight forwarding company built around a simple idea: customers should never have to chase us for news about their cargo.</p><p>Our team handles bookings, documentation, customs and delivery for importers, exporters and traders. We work with established carriers, terminals and licensed customs brokers, and we choose the route that fits your timing and budget.</p><h2>How we work</h2><ol class="steps"><li>Enquiry</li><li>Written quotation</li><li>Booking confirmation</li><li>Tracking and updates</li><li>Delivery and proof</li><li>Accurate invoice</li></ol></div>
<div style="flex:1;padding:.5in .45in;background:#f3f5f4"><h2 style="margin-top:0">Our services</h2><h3>Ocean freight</h3><p>Booking, container release, documents, tracking and delivery for full and part containers.</p><h3>Air freight</h3><p>Airport-to-airport and door-to-door shipping for urgent and valuable cargo.</p><h3>Road transport</h3><p>Trucking in the UAE and GCC with signed proof of delivery.</p><h3>Customs clearance</h3><p>Document checks and declaration support with licensed brokers.</p><h3>Warehousing</h3><p>Storage, picking, dispatch and stock reporting.</p><h3>Special cargo</h3><p>Out-of-gauge, temperature-controlled and dangerous goods with the required approvals.</p></div>
<div style="flex:1;padding:.5in .45in"><h2 style="margin-top:0">Start a shipment</h2><p>Send us the origin, destination, cargo description, weight, volume and ready date.</p><div class="card"><b>${CO.tel}</b><br>${CO.mail}<br>${CO.web}</div><p class="small">${CO.hours}</p><h2>Open an account</h2><p>We will ask for your trade licence, signatory ID and, if you are VAT-registered, your tax registration number. Credit terms are agreed after a short review.</p><span class="cta">Ask for a quotation</span></div></div>`], true) },
}
const run = async () => {
  fs.mkdirSync(path.join(ROOT, 'corporate-templates/assets'), { recursive: true })
  for (const f of ['logo-primary.png', 'logo-reverse.png', 'icon-primary.png']) fs.copyFileSync(path.join(ROOT, 'public/brand', f), path.join(ROOT, 'corporate-templates/assets', f))
  const pw = '/opt/pw-browsers'; const exe = process.env.CHROME_PATH || fs.readdirSync(pw).filter(d => /^chromium-\d+/.test(d)).map(d => path.join(pw, d, 'chrome-linux/chrome'))[0]
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
  for (const [name, p] of Object.entries(pieces)) {
    const file = path.join(OUT, `${name}.html`); fs.writeFileSync(file, p.html)
    const pg = await b.newPage(); await pg.goto('file://' + file, { waitUntil: 'load' })
    await pg.pdf({ path: path.join(OUT, `${name}.pdf`), width: p.size === 'l' ? '11in' : '8.5in', height: p.size === 'l' ? '8.5in' : '11in', printBackground: true, preferCSSPageSize: false })
    await pg.close()
  }
  await b.close()
}
export default run
