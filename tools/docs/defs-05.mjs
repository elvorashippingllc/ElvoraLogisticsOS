import { P, H, L, N, NOTE, F, T, TOT, SIG, SP, CO } from './lib.mjs'
const cat = '05 HR and Administration'
const emp = [['Employee', '[Full name]'], ['Employee no.', '[Number]'], ['Position', '[Job title]'], ['Department', '[Department]']]
export default [
  { id: 'ELV-063', cat, title: 'Employment Offer Summary', subtitle: 'A summary of the main terms offered to a candidate. It supports administration and does not replace the official employment contract that must be registered under UAE labour requirements.', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['Candidate', '[Full name]'], ['Position', '[Job title]'], ['Department', '[Department]'], ['Reports to', '[Name / title]'], ['Work location', CO.addr], ['Proposed start date', '[DD MMM YYYY]'], ['Contract type', '[As permitted – confirm with HR / MOHRE]']]),
    H('Remuneration (monthly, AED)'), T([['Component', 0.5], ['Amount', 0.25, 'r'], ['Notes', 0.25]], [['Basic salary', '', ''], ['Housing allowance', '', ''], ['Transport allowance', '', ''], ['Other allowance', '', ''], ['Total monthly pay', '', '']]),
    H('Other terms'), F([['Probation', '[Period permitted by law]'], ['Working hours', '[Hours per day / days per week]'], ['Annual leave', '[Days per year]'], ['Notice period', '[Days]'], ['Medical insurance', '[Provided / category]'], ['Annual air ticket', '[Entitlement, if any]'], ['End-of-service benefits', 'As per UAE labour law']], 1),
    P('This offer depends on satisfactory references, valid work-permit or visa processing, medical fitness where required, and verification of qualifications. The formal employment contract will be issued for your signature through the official channel.'),
    SIG([CO.name, 'Candidate – I accept this offer']),
  ] },
  { id: 'ELV-064', cat, title: 'Employee Appointment Memorandum', blocks: [
    F([['Memo no.', '[Number]'], ['Date', '[DD MMM YYYY]'], ...emp, ['Reports to', '[Name]'], ['Effective date', '[DD MMM YYYY]']]),
    P('We are pleased to confirm that the above-named employee has been appointed to the position shown with effect from the date stated. The employee’s terms and conditions are as set out in the registered employment contract and company policies.'),
    H('Main responsibilities'), L(['[Responsibility]', '[Responsibility]', '[Responsibility]']),
    H('Handover and introductions'), T([['Item', 0.5], ['Responsible', 0.25], ['Date', 0.25]], [['Introduce to team and customers', '', ''], ['System access and e-mail', '', ''], ['Company assets issued', '', '']]),
    SIG(['General manager', 'Employee – acknowledged']),
  ] },
  { id: 'ELV-065', cat, title: 'Job Description', blocks: [
    F([['Job title', '[Title]'], ['Department', '[Department]'], ['Reports to', '[Title]'], ['Grade / level', '[Level]'], ['Location', '[Office]'], ['Date', '[DD MMM YYYY]']]),
    H('Purpose of the role'), P('[One or two sentences on why the role exists and what it delivers for customers and the company.]'),
    H('Key responsibilities'), L(['[Responsibility]', '[Responsibility]', '[Responsibility]', '[Responsibility]']),
    H('Measures of success'), T([['Measure', 0.5], ['Target', 0.25], ['Review', 0.25]], 3),
    H('Requirements'), F([['Education', '[Qualification]'], ['Experience', '[Years and type]'], ['Skills', '[Freight systems, customs, languages, etc.]'], ['Licences / certifications', '[If required]']], 1),
    SIG(['Line manager', 'Employee']),
  ] },
  { id: 'ELV-066', cat, title: 'Employee Joining Checklist', blocks: [
    F([...emp, ['Start date', '[DD MMM YYYY]'], ['Line manager', '[Name]'], ['HR contact', '[Name]']]),
    T([['Item', 0.46], ['Owner', 0.16], ['Done', 0.1], ['Date', 0.14], ['Notes', 0.14]], [['Signed registered employment contract on file', 'HR', '', '', ''], ['Passport, visa / residence, Emirates ID copies', 'HR', '', '', ''], ['Medical insurance enrolled', 'HR', '', '', ''], ['Salary bank details and WPS information', 'HR / Accounts', '', '', ''], ['Photo and emergency contact', 'HR', '', '', ''], ['E-mail and system accounts created', 'Admin', '', '', ''], ['Laptop, phone, access card issued (see asset handover)', 'Admin', '', '', ''], ['Company policies and code of conduct explained', 'HR', '', '', ''], ['Information-security and confidentiality briefing', 'Manager', '', '', ''], ['Role training plan agreed', 'Manager', '', '', ''], ['Probation review date set', 'HR', '', '', '']]),
    SIG(['HR', 'Employee']),
  ] },
  { id: 'ELV-067', cat, title: 'Leave Request', blocks: [
    F([...emp, ['Leave type', '[Annual / sick / unpaid / other]'], ['From', '[DD MMM YYYY]'], ['To', '[DD MMM YYYY]'], ['Working days', '[Number]'], ['Contact while away', '[Phone]'], ['Cover arranged with', '[Name]']]),
    F([['Reason (optional)', '[Reason]'], ['Balance before request', '[Days]'], ['Balance after request', '[Days]']], 1),
    P('Sick leave must be supported by a medical certificate from a recognised provider.'),
    T([['Decision', 0.3], ['By', 0.25], ['Date', 0.2], ['Remarks', 0.25]], [['Line manager', '', '', ''], ['HR', '', '', '']]),
    SIG(['Employee', 'Line manager']),
  ] },
  { id: 'ELV-068', cat, title: 'Employee Timesheet', blocks: [
    F([...emp, ['Month', '[Month YYYY]'], ['Approved by', '[Name]']]),
    T([['Date', 0.12], ['Day', 0.08], ['In', 0.1], ['Out', 0.1], ['Break (h)', 0.1, 'r'], ['Hours', 0.1, 'r'], ['Overtime', 0.1, 'r'], ['Job / customer ref.', 0.15], ['Notes', 0.15]], 15),
    TOT([['Total hours', '[0.0]'], ['Overtime hours', '[0.0]'], ['Leave days', '[0.0]']]),
    SIG(['Employee', 'Line manager']),
  ] },
  { id: 'ELV-069', cat, title: 'Salary Certificate', subtitle: 'Issue only on the employee’s written request, using current payroll records. Banks and embassies may require specific wording; adapt the addressee and purpose.', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['Reference', '[Number]'], ['Addressed to', '[Bank / embassy / “To whom it may concern”]'], ['Purpose', '[As requested by employee]']]),
    P('We, ' + CO.name + ', Trade Licence No. [number], certify that **[Employee full name]**, holder of passport no. [number] / Emirates ID [number], is employed by our company as **[Job title]** since **[DD MMM YYYY]** and is currently in active service.'),
    T([['Monthly salary component', 0.6], ['AED', 0.4, 'r']], [['Basic salary', ''], ['Housing allowance', ''], ['Transport allowance', ''], ['Other allowances', ''], ['Total monthly salary', '']]),
    P('This certificate is issued at the employee’s request without any liability on the part of the company.'),
    SIG([CO.name + ' – HR / authorised signatory']),
  ] },
  { id: 'ELV-070', cat, title: 'Employment Experience Certificate', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['Reference', '[Number]']]),
    P('To whom it may concern,'),
    P('This is to certify that **[Employee full name]**, passport no. [number], worked for ' + CO.name + ' as **[Job title]** in the **[Department]** from **[DD MMM YYYY]** to **[DD MMM YYYY]**.'),
    P('[Describe duties performed, e.g. “handled import and export documentation, customer coordination and carrier booking.”] During this period [his / her / their] conduct was [satisfactory / good / excellent].'),
    P('We wish [him / her / them] success in future endeavours. This certificate is issued on request.'),
    SIG([CO.name + ' – authorised signatory']),
  ] },
  { id: 'ELV-071', cat, title: 'Employee Performance Notice', blocks: [
    F([...emp, ['Notice date', '[DD MMM YYYY]'], ['Type', '[Performance feedback / improvement plan / warning]'], ['Issued by', '[Name, title]']]),
    H('Issue'), P('[Factual description with dates and examples: what was expected, what happened, and the effect on customers or the team.]'),
    H('Previous discussions'), P('[Dates and outcomes of earlier conversations, if any.]'),
    H('Expected improvement'), T([['Standard expected', 0.5], ['By when', 0.2], ['How it will be measured', 0.3]], 3),
    H('Support offered'), P('[Training, coaching, resources.]'),
    P('The employee has the right to respond in writing within [number] days. Discuss disciplinary measures with HR to ensure they follow the registered contract and UAE labour law.'),
    SIG(['Manager', 'Employee – received (signature does not mean agreement)', 'HR']),
  ] },
  { id: 'ELV-072', cat, title: 'Employee Exit Clearance', blocks: [
    F([...emp, ['Last working day', '[DD MMM YYYY]'], ['Reason for exit', '[Resignation / end of contract / termination]'], ['Handover to', '[Name]']]),
    T([['Clearance item', 0.4], ['Department', 0.18], ['Cleared', 0.1], ['By / date', 0.17], ['Remarks', 0.15]], [['Work handed over; files and customers briefed', 'Manager', '', '', ''], ['Laptop, phone, keys, access cards returned', 'Admin', '', '', ''], ['System and e-mail access disabled', 'IT', '', '', ''], ['Advances, loans, expense claims settled', 'Accounts', '', '', ''], ['Medical insurance and visa cancellation steps', 'HR', '', '', ''], ['Final settlement calculated and approved', 'HR / Accounts', '', '', '']]),
    F([['Final settlement amount', '[Amount – per official calculation]'], ['Payment date', '[DD MMM YYYY]']]),
    SIG(['Employee', 'HR', 'Accounts']),
  ] },
  { id: 'ELV-073', cat, title: 'Company Asset Handover', blocks: [
    F([...emp, ['Date', '[DD MMM YYYY]'], ['Type', '[Issue / return]']]),
    T([['Asset', 0.24], ['Make / model', 0.16], ['Serial / tag no.', 0.18], ['Condition', 0.14], ['Accessories', 0.14], ['Value (AED)', 0.14, 'r']], 6),
    P('I received / returned the assets above in the condition stated. I will use them for company business, keep them safe, report loss or damage immediately and return them on request or when employment ends.'),
    SIG(['Employee', 'Issued / received by']),
  ] },
  { id: 'ELV-074', cat, title: 'Business Travel Request', blocks: [
    F([...emp, ['Destination', '[City, country]'], ['Purpose', '[Business reason]'], ['Travel dates', '[DD MMM – DD MMM YYYY]'], ['Related customer / job', '[Reference]']]),
    T([['Item', 0.3], ['Details', 0.4], ['Estimated cost (AED)', 0.3, 'r']], [['Flights', '', ''], ['Accommodation', '', ''], ['Ground transport', '', ''], ['Visa / insurance', '', ''], ['Daily allowance', '', ''], ['Total', '', '']]),
    F([['Advance requested', '[Amount]'], ['Visa required', '[Yes / No – type]']]),
    SIG(['Employee', 'Line manager', 'General manager']),
  ] },
]
