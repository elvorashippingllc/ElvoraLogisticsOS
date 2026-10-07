import { P, H, L, N, NOTE, F, T, TOT, SIG, SP, CO } from './lib.mjs'
const cat = '04 Shipping and Warehouse'
const ref = F([['Our ref. / job no.', '[ELV-JOB-…]'], ['Date', '[DD MMM YYYY]'], ['Customer', '[Company]'], ['Customer ref. / PO', '[Reference]']])
const ship = F([['Shipper', '[Name and address]'], ['Consignee', '[Name and address]'], ['Notify party', '[Name and address]']], 1)
const route = [['Port / airport of loading', '[Location]'], ['Port / airport of discharge', '[Location]'], ['Vessel / flight', '[Name and voyage]'], ['ETD', '[DD MMM YYYY]'], ['ETA', '[DD MMM YYYY]'], ['Carrier', '[Name]']]
const cont = T([['Container no.', 0.2], ['Type', 0.1], ['Seal no.', 0.16], ['Packages', 0.1, 'r'], ['Gross wt (kg)', 0.15, 'r'], ['Volume (CBM)', 0.14, 'r'], ['Remarks', 0.15]], 4)
const goods = T([['Marks and numbers', 0.2], ['Packages / type', 0.15], ['Description of goods', 0.3], ['HS code', 0.1], ['Gross wt (kg)', 0.125, 'r'], ['Volume (CBM)', 0.125, 'r']], 5)
const official = txt => NOTE(txt)
export default [
  { id: 'ELV-037', cat, title: 'Carrier Booking Request', blocks: [
    ref, F([['Carrier / airline', '[Name]'], ['Carrier contact', '[Name / e-mail]'], ['Service / contract no.', '[Reference]'], ['Booking type', '[FCL / LCL / air / RoRo / breakbulk]']]),
    H('Route'), F(route), H('Cargo'), F([['Commodity', '[Description]'], ['HS code', '[Code]'], ['Equipment', '[Quantity × type]'], ['Gross weight (kg)', '[kg]'], ['Volume (CBM)', '[CBM]'], ['Dangerous goods', '[No / Yes – class, UN no.]'], ['Reefer settings', '[°C, ventilation, humidity]'], ['Special equipment', '[OOG dimensions / flat rack]']]),
    H('Requirements'), F([['Empty pickup depot', '[Depot]'], ['Pickup date', '[DD MMM YYYY]'], ['Free time requested', '[Days at origin / destination]'], ['Shipper’s own container', '[Yes / No]'], ['Freight terms', '[Prepaid / collect]'], ['Remarks', '[Notes]']]),
    P('Please confirm space, equipment and the booking number, and advise cut-offs and applicable surcharges.'),
  ] },
  { id: 'ELV-038', cat, title: 'Shipper Instructions', subtitle: 'The shipper’s written instructions for preparing the transport document. Information entered here appears on the bill of lading or air waybill, so it must match the commercial documents.', blocks: [
    ref, ship, F([['Booking no.', '[Number]'], ['B/L or AWB type', '[Original / sea waybill / express release / house AWB]'], ['Number of originals', '[Number]'], ['Freight', '[Prepaid / collect]'], ['Incoterm', '[Incoterm]'], ['Letter of credit no.', '[If applicable]']]),
    H('Cargo particulars'), goods,
    H('Container details'), cont,
    H('Documents required'), T([['Document', 0.4], ['Originals', 0.15], ['Copies', 0.15], ['Send to', 0.3]], [['Bill of lading / AWB', '', '', ''], ['Certificate of origin', '', '', ''], ['Commercial invoice and packing list', '', '', ''], ['', '', '', '']]),
    H('Special instructions'), P('[Statements to appear on the document, LC wording, release conditions.]'),
    P('The shipper confirms the accuracy of these particulars and accepts responsibility for them.'), SIG(['Shipper – authorised signatory']),
  ] },
  { id: 'ELV-039', cat, title: 'Packing List', blocks: [
    F([['Packing list no.', '[Number]'], ['Date', '[DD MMM YYYY]'], ['Invoice no.', '[Commercial invoice number]'], ['Shipper', '[Name and address]'], ['Consignee', '[Name and address]'], ['Marks and numbers', '[Marks]']]),
    T([['Pkg no.', 0.08], ['Type', 0.1], ['Contents / description', 0.28], ['Qty', 0.08, 'r'], ['Net kg', 0.1, 'r'], ['Gross kg', 0.1, 'r'], ['L × W × H cm', 0.16], ['CBM', 0.1, 'r']], 10),
    TOT([['Total packages', '[0]'], ['Total net kg', '[0.00]'], ['Total gross kg', '[0.00]'], ['Total CBM', '[0.000]']]),
    P('Packed by: [Name]    Date: [DD MMM YYYY]'),
  ] },
  { id: 'ELV-040', cat, title: 'Cargo Manifest', blocks: [
    F([['Manifest no.', '[Number]'], ['Mode', '[Sea / air / road]'], ['Carrier / vessel / flight', '[Name and voyage]'], ['Loading port', '[Port]'], ['Discharge port', '[Port]'], ['Sailing / departure', '[DD MMM YYYY]']]),
    T([['B/L / AWB no.', 0.14], ['Shipper', 0.15], ['Consignee', 0.15], ['Description', 0.19], ['Pkgs', 0.07, 'r'], ['Weight kg', 0.1, 'r'], ['CBM', 0.08, 'r'], ['Container / remarks', 0.12]], 10),
    TOT([['Total packages', '[0]'], ['Total weight kg', '[0.00]'], ['Total CBM', '[0.000]']]),
    P('Prepared by: [Name]    Checked by: [Name]    Date: [DD MMM YYYY]'),
  ] },
  { id: 'ELV-041', cat, title: 'Bill of Lading Draft Data Sheet', subtitle: 'Data for checking before the bill of lading is issued. This is not a bill of lading and has no legal effect. The carrier’s or our authorised house bill of lading is the transport document.', blocks: [
    F([['B/L no. (draft)', '[Number]'], ['Booking no.', '[Number]'], ['Type', '[Master / house, original / sea waybill]'], ['Date', '[DD MMM YYYY]']]),
    ship, F(route),
    H('Cargo and containers'), goods, cont,
    F([['Freight terms', '[Prepaid / collect]'], ['Number of originals', '[Number]'], ['Place and date of issue', '[Place, DD MMM YYYY]'], ['Clean on board date', '[DD MMM YYYY]']]),
    H('Customer approval'), P('Please check every field, especially names, addresses, weights, marks and HS descriptions. After issue, amendments may incur carrier fees and delay release.'),
    T([['Checked item', 0.5], ['Approved', 0.2], ['Correction required', 0.3]], [['Parties and addresses', '', ''], ['Description, quantity, weight', '', ''], ['Container and seal numbers', '', ''], ['Freight terms and originals', '', '']]),
    SIG(['Customer approval']),
  ] },
  { id: 'ELV-042', cat, title: 'Air Waybill Instruction Sheet', subtitle: 'Instruction data for preparing the air waybill. The air waybill itself is issued on the carrier or IATA-compliant document.', blocks: [
    ref, F([['Airline', '[Name]'], ['AWB prefix / no.', '[000-00000000]'], ['Airport of departure', '[IATA code]'], ['Airport of destination', '[IATA code]'], ['Flight / date', '[Flight, DD MMM YYYY]'], ['Handling information', '[e.g. keep upright, perishable]']]), ship,
    H('Cargo'), T([['Pieces', 0.09, 'r'], ['Gross wt (kg)', 0.13, 'r'], ['Dimensions (cm)', 0.2], ['Volume wt (kg)', 0.13, 'r'], ['Chargeable wt (kg)', 0.15, 'r'], ['Nature and quantity of goods', 0.3]], 4),
    F([['Declared value for carriage', '[Amount or NVD]'], ['Declared value for customs', '[Amount or NCV]'], ['Charges', '[Prepaid / collect]'], ['Insurance', '[Amount or XXX]'], ['Special customs info', '[Codes]'], ['Dangerous goods', '[No / Yes – use official shipper’s declaration]']]),
    SIG(['Shipper']),
  ] },
  { id: 'ELV-043', cat, title: 'Shipment Pre Alert', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['To', '[Agent / consignee / customer]'], ['From', CO.name], ['Our ref.', '[Job no.]']]),
    P('Please note the following shipment has been dispatched. Kindly prepare for arrival, customs clearance and delivery.'),
    F([...route, ['B/L / AWB no.', '[Number]'], ['Container nos.', '[Numbers]'], ['Packages', '[Number and type]'], ['Gross weight / volume', '[kg / CBM]'], ['Commodity', '[Description]'], ['Incoterm', '[Incoterm]']]),
    H('Documents attached'), L(['[Bill of lading / AWB copy]', '[Commercial invoice]', '[Packing list]', '[Certificate of origin / other]']),
    P('Please confirm receipt and advise any special requirements at destination.\nRegards,\n[Name], ' + CO.name),
  ] },
  { id: 'ELV-044', cat, title: 'Shipment Arrival Notice', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['To', '[Consignee / notify party]'], ['B/L / AWB no.', '[Number]'], ['Our ref.', '[Job no.]'], ['Vessel / flight', '[Name and voyage]'], ['Arrival date', '[DD MMM YYYY]'], ['Discharge terminal', '[Terminal]'], ['Free time ends', '[DD MMM YYYY]']]),
    P('We advise that your cargo has arrived / is due to arrive as shown above.'),
    cont,
    H('To release your cargo we need'), L(['Original bill of lading (or confirmation of express / telex release).', 'Commercial invoice, packing list and customs documents.', 'Payment of freight and local charges as invoiced.', 'Delivery order fee and carrier charges as applicable.']),
    P('Detention, demurrage and storage start after the free time shown and are charged by the carrier or terminal. Please act promptly to avoid them.'),
  ] },
  { id: 'ELV-045', cat, title: 'Delivery Order Request', subtitle: 'A request to the carrier or agent to issue a delivery order. A company letter is not a carrier release order; the carrier’s release is required.', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['To (carrier / agent)', '[Name]'], ['B/L no.', '[Number]'], ['Vessel / voyage', '[Name]'], ['Consignee', '[Name]'], ['Our ref.', '[Job no.]']]),
    cont,
    H('Documents submitted'), T([['Document', 0.5], ['Original / copy', 0.2], ['Received', 0.3]], [['Original B/L or release confirmation', '', ''], ['Letter of authority from consignee', '', ''], ['Customs release / declaration ref.', '', ''], ['Freight and charges payment proof', '', '']]),
    F([['Collection by', '[Name, ID no.]'], ['Terminal / depot', '[Location]'], ['Charges payable by', '[Party]']]),
    SIG([CO.name]),
  ] },
  { id: 'ELV-046', cat, title: 'Delivery Note', blocks: [
    F([['Delivery note no.', '[Number]'], ['Date', '[DD MMM YYYY]'], ['Our ref.', '[Job no.]'], ['Customer', '[Company]'], ['Deliver to', '[Address and contact]'], ['Vehicle / driver', '[Plate no., name]']]),
    T([['#', 0.05], ['Description', 0.4], ['Packages / type', 0.15], ['Qty', 0.1, 'r'], ['Weight kg', 0.1, 'r'], ['Marks / remarks', 0.2]], 6),
    P('Goods received in good order and condition unless noted below.'), F([['Exceptions noted', '[None / describe]']], 1),
    SIG(['Delivered by', 'Received by (name, signature, stamp, date and time)']),
  ] },
  { id: 'ELV-047', cat, title: 'Proof of Delivery', blocks: [
    F([['POD no.', '[Number]'], ['Job / B/L / AWB', '[Reference]'], ['Delivery date and time', '[DD MMM YYYY, HH:MM GST]'], ['Delivered to', '[Name and address]'], ['Consignee reference', '[PO / delivery ref.]'], ['Delivered by', '[Driver and vehicle]']]),
    cont,
    H('Condition on delivery'), T([['Check', 0.5], ['OK', 0.1], ['Exception', 0.4]], [['Seals intact and numbers match', '', ''], ['Packages count correct', '', ''], ['No visible damage or wetness', '', ''], ['Temperature within range (if applicable)', '', '']]),
    F([['Receiver name', '[Name]'], ['ID / staff no.', '[Number]'], ['Time in / out', '[HH:MM / HH:MM]']]),
    SIG(['Receiver – signature and stamp', 'Driver']),
    NOTE('Attach photographs of the delivered cargo and signed copy. Record any exception on the document before the driver leaves.'),
  ] },
  { id: 'ELV-048', cat, title: 'Cargo Collection Order', blocks: [
    F([['Order no.', '[Number]'], ['Date issued', '[DD MMM YYYY]'], ['Collect from', '[Name, address, contact]'], ['Collection date and window', '[DD MMM YYYY, HH:MM–HH:MM]'], ['Deliver to', '[Warehouse / port / customer]'], ['Vehicle type', '[Pickup / 3-ton / trailer / reefer]'], ['Transporter', '[Company]'], ['Driver and plate no.', '[Name, plate]']]),
    T([['Description', 0.34], ['Packages', 0.12, 'r'], ['Weight kg', 0.12, 'r'], ['Reference / PO', 0.2], ['Special handling', 0.22]], 4),
    L(['Driver must carry this order and a photo ID.', 'Count and inspect cargo at pickup; note any damage before signing.', 'Call [dispatcher] on ' + CO.tel + ' for any delay or discrepancy.']),
    SIG(['Issued by', 'Driver / transporter']),
  ] },
  { id: 'ELV-049', cat, title: 'Verified Gross Mass Submission', subtitle: 'Records the verified gross mass of a packed container before loading. The shipper is responsible for obtaining and signing the verified mass; submit it to the carrier or terminal before their cut-off. See the IMO guidance on verification of the gross mass of containers.', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['Booking / B/L no.', '[Number]'], ['Vessel / voyage', '[Name]'], ['Submitted to', '[Carrier / terminal]'], ['VGM cut-off', '[DD MMM YYYY, HH:MM GST]'], ['Shipper', '[Name]']]),
    T([['Container no.', 0.2], ['Type', 0.1], ['Method (1 / 2)', 0.12], ['Verified gross mass (kg)', 0.18, 'r'], ['Weighing ticket / calc. ref.', 0.2], ['Date weighed', 0.1], ['Seal no.', 0.1]], 5),
    F([['Weighing facility', '[Name and location]'], ['Equipment / calibration ref.', '[Reference]']]),
    L(['Method 1: container weighed after packing and sealing.', 'Method 2: weight of all packages, pallets, dunnage and the container tare added up using approved calculation.']),
    P('I declare the verified gross mass shown for each container is correct.'), SIG(['Authorised signatory of shipper']),
  ] },
  { id: 'ELV-050', cat, title: 'Container Condition Inspection', blocks: [
    F([['Container no.', '[Number]'], ['Type / size', '[Type]'], ['Date and time', '[DD MMM YYYY, HH:MM]'], ['Location', '[Depot / warehouse]'], ['Inspector', '[Name]'], ['Booking / job', '[Reference]'], ['Stage', '[Empty pickup / before loading / after unloading / return]']]),
    T([['Area', 0.28], ['Satisfactory', 0.14], ['Defect', 0.3], ['Photo ref.', 0.14], ['Action', 0.14]], [['Doors, hinges, locking bars', '', '', '', ''], ['Floor and walls (holes, rust, stains)', '', '', '', ''], ['Roof', '', '', '', ''], ['Interior cleanliness, odour', '', '', '', ''], ['Seals and CSC plate', '', '', '', ''], ['Reefer unit / set-point (if any)', '', '', '', '']]),
    P('Mark damage on a diagram or in photographs attached to this record.'), SIG(['Inspector', 'Driver / depot representative']),
  ] },
  { id: 'ELV-051', cat, title: 'Container Seal Record', blocks: [
    T([['Container no.', 0.18], ['Carrier seal no.', 0.16], ['Shipper seal no.', 0.16], ['Applied by', 0.14], ['Date / time', 0.14], ['Checked at port / delivery', 0.12], ['Intact?', 0.1]], 10),
    P('Record every seal when it is applied, at each hand-over, and when it is broken. If a seal is damaged or does not match, stop, photograph it, notify the customer and the carrier, and record who witnessed the opening.'),
    F([['Seal broken by', '[Name]'], ['Reason (customs inspection, etc.)', '[Reason]'], ['New seal no.', '[Number]'], ['Witness', '[Name]']]),
  ] },
  { id: 'ELV-052', cat, title: 'Customs Document Checklist', blocks: [
    F([['Job no.', '[Reference]'], ['Direction', '[Import / export / transit / re-export]'], ['Customer', '[Company]'], ['Declarant / broker', '[Name]'], ['Customs centre', '[Location]'], ['Prepared by', '[Name]']]),
    T([['Document', 0.38], ['Required', 0.12], ['Received', 0.12], ['Checked', 0.12], ['Remarks', 0.26]], [['Commercial invoice', '', '', '', ''], ['Packing list', '', '', '', ''], ['Bill of lading / AWB', '', '', '', ''], ['Delivery order', '', '', '', ''], ['Certificate of origin', '', '', '', ''], ['Import / export licence or permit (if regulated goods)', '', '', '', ''], ['Importer / exporter code and company documents', '', '', '', ''], ['Inspection or conformity certificates', '', '', '', ''], ['Customs declaration and duty/VAT calculation', '', '', '', ''], ['Insurance certificate', '', '', '', '']]),
    P('Use the current official customs requirements for the goods and route. This checklist does not replace them. Check HS code, valuation, origin and permits before submission.'),
  ] },
  { id: 'ELV-053', cat, title: 'Customs Clearance Authority', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['Grantor (importer / exporter)', '[Legal name, licence no., customs code]'], ['Authorised agent', CO.name + ' / [licensed customs broker]'], ['Valid from – to', '[DD MMM YYYY – DD MMM YYYY]'], ['Shipment / scope', '[B/L, AWB, or “all shipments during validity”]']], 1),
    P('We authorise the agent named above to prepare and submit customs declarations, pay duties and fees on our behalf and our account, receive customs notices and collect released cargo for the scope stated. We remain responsible for the accuracy of the information and documents we provide and for duties and taxes due.'),
    L(['The agent may not sign contracts or accept liabilities beyond customs clearance.', 'This authority may be withdrawn in writing at any time.']),
    SIG(['Grantor – authorised signatory and stamp', 'Agent']),
  ] },
  { id: 'ELV-054', cat, title: 'Cargo Insurance Instruction', blocks: [
    ref, F([['Insured', '[Name]'], ['Policy / open cover no.', '[Number]'], ['Insurer / broker', '[Name]'], ['Cover required', '[Institute Cargo Clauses A / B / C, air, other]']]),
    F([['Voyage from', '[Origin]'], ['Voyage to', '[Destination]'], ['Conveyance', '[Vessel / flight / truck]'], ['Departure date', '[DD MMM YYYY]'], ['Goods insured', '[Description and packing]'], ['Sum insured', '[Currency and amount, e.g. CIF + 10%]'], ['Invoice no. / date', '[Reference]'], ['Special conditions', '[Warehouse-to-warehouse, deck cargo, etc.]']]),
    P('Instruction to arrange cover is effective only when confirmed by the insurer in writing. Insurance is not provided unless confirmed.'), SIG(['Customer']),
  ] },
  { id: 'ELV-055', cat, title: 'Dangerous Goods Intake Worksheet', subtitle: 'Internal preparation worksheet only. It does not replace the shipper’s official dangerous goods declaration for the mode (IATA form for air, IMDG-compliant declaration for sea) or carrier approval. Use the current IATA and IMDG regulations.', blocks: [
    ref, F([['Mode', '[Air / sea / road]'], ['Carrier acceptance', '[Obtained / pending – reference]'], ['Shipper’s declaration received', '[Yes / No – date]'], ['Emergency contact (24 h)', '[Name, phone]']]),
    T([['UN no.', 0.09], ['Proper shipping name', 0.25], ['Class / division', 0.1], ['Packing group', 0.08], ['Qty and packing', 0.18], ['Net qty', 0.1, 'r'], ['Limited / excepted qty?', 0.1], ['Marks / labels', 0.1]], 4),
    H('Checks'), T([['Check', 0.55], ['Yes / No', 0.15], ['By', 0.3]], [['Safety data sheet received and matches', '', ''], ['Packaging UN-certified and marked', '', ''], ['Segregation / compatibility checked', '', ''], ['Carrier and airport / port accept the class', '', ''], ['Staff handling are trained and certified', '', '']]),
    SIG(['Prepared by', 'Dangerous goods adviser / approver']),
  ] },
  { id: 'ELV-056', cat, title: 'Temperature Controlled Cargo Instructions', blocks: [
    ref, F([['Commodity', '[Product]'], ['Required temperature', '[°C range]'], ['Pre-cooling', '[Yes / No – temperature]'], ['Ventilation / humidity', '[Settings]'], ['Atmosphere (CA/MA)', '[If applicable]'], ['Equipment', '[Reefer container / insulated / dry ice / pharma box]'], ['Data logger', '[Yes / No – ID]'], ['Maximum time out of control', '[Hours]']]),
    H('Handling plan'), T([['Stage', 0.25], ['Responsible', 0.2], ['Temperature check', 0.25], ['Recorded', 0.15], ['Remarks', 0.15]], [['Pickup / stuffing', '', '', '', ''], ['Terminal / airport', '', '', '', ''], ['Transhipment', '', '', '', ''], ['Arrival and delivery', '', '', '', '']]),
    P('Notify the customer immediately if the temperature goes outside the range. Do not release cargo suspected of temperature excursion without the customer’s written instruction.'),
    SIG(['Customer', CO.name]),
  ] },
  { id: 'ELV-057', cat, title: 'Warehouse Goods Receipt', blocks: [
    F([['GRN no.', '[Number]'], ['Date and time', '[DD MMM YYYY, HH:MM]'], ['Owner / customer', '[Company]'], ['Supplier / sender', '[Name]'], ['Delivery ref. / B/L', '[Reference]'], ['Vehicle / driver', '[Plate, name]'], ['Received by', '[Name]'], ['Warehouse / bay', '[Location]']]),
    T([['#', 0.05], ['SKU / description', 0.26], ['Expected', 0.1, 'r'], ['Received', 0.1, 'r'], ['Damaged', 0.1, 'r'], ['Lot / batch', 0.12], ['Expiry', 0.1], ['Put-away bin', 0.17]], 8),
    F([['Condition on arrival', '[OK / exceptions]'], ['Seal / pallets', '[Intact / count]']], 1),
    SIG(['Warehouse supervisor', 'Driver']),
  ] },
  { id: 'ELV-058', cat, title: 'Warehouse Dispatch Note', blocks: [
    F([['Dispatch no.', '[Number]'], ['Date and time', '[DD MMM YYYY, HH:MM]'], ['Owner / customer', '[Company]'], ['Deliver to', '[Name, address]'], ['Order / PO ref.', '[Reference]'], ['Vehicle / driver', '[Plate, name]']]),
    T([['#', 0.05], ['SKU / description', 0.3], ['Ordered', 0.1, 'r'], ['Picked', 0.1, 'r'], ['Lot / batch', 0.15], ['From bin', 0.15], ['Remarks', 0.15]], 8),
    F([['Pickers / checker', '[Names]'], ['Loaded and sealed', '[Seal no.]']]), SIG(['Warehouse supervisor', 'Driver']),
  ] },
  { id: 'ELV-059', cat, title: 'Warehouse Stock Count', blocks: [
    F([['Count no.', '[Number]'], ['Date', '[DD MMM YYYY]'], ['Warehouse / zone', '[Location]'], ['Owner / customer', '[Company or “All”]'], ['Counted by', '[Names]'], ['Verified by', '[Name]']]),
    T([['Bin', 0.1], ['SKU / description', 0.28], ['Lot / expiry', 0.14], ['System qty', 0.12, 'r'], ['Counted qty', 0.12, 'r'], ['Variance', 0.1, 'r'], ['Cause / action', 0.14]], 12),
    P('Recount any variance above the tolerance of [x%]. Investigate before adjusting the stock record. Approved adjustments need the warehouse manager’s signature.'), SIG(['Counter', 'Supervisor', 'Warehouse manager']),
  ] },
  { id: 'ELV-060', cat, title: 'Cargo Claim Notice', subtitle: 'Notify the carrier or other party in writing as soon as loss or damage is discovered and within the time limits of the transport document or convention. Keep evidence.', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['Claim ref.', '[ELV-CLM-YYYY-NNN]'], ['To', '[Carrier / terminal / insurer]'], ['From', '[Claimant]'], ['B/L / AWB / CMR no.', '[Number]'], ['Container / packages', '[Numbers]'], ['Vessel / flight / truck', '[Name]'], ['Date and place of discovery', '[Date, place]']]),
    H('Nature of loss or damage'), P('[Describe what was found: shortage, damage, wetting, delay. State the condition shown on delivery receipt or survey report.]'),
    H('Amount claimed'), T([['Item', 0.45], ['Quantity', 0.15, 'r'], ['Value', 0.2, 'r'], ['Basis', 0.2]], 4), TOT([['Total claimed', '[0.00]']]),
    H('Enclosures'), L(['Transport document and delivery receipt', 'Commercial invoice and packing list', 'Photographs and survey report', 'Damage report or incident record']),
    P('We hold you responsible for the loss or damage and reserve all rights, including time limits for formal proceedings.'), SIG([CO.name + ' on behalf of [Claimant]']),
  ] },
  { id: 'ELV-061', cat, title: 'Cargo Damage Incident Report', blocks: [
    F([['Report no.', '[Number]'], ['Date and time found', '[DD MMM YYYY, HH:MM]'], ['Location', '[Place]'], ['Job / container / B/L', '[Reference]'], ['Reported by', '[Name and role]'], ['Witnesses', '[Names]']]),
    H('What happened'), P('[Factual description in order: what was seen, when, by whom. No opinions about fault.]'),
    H('Damage'), T([['Item / package', 0.3], ['Quantity affected', 0.15, 'r'], ['Description of damage', 0.35], ['Photo ref.', 0.2]], 4),
    H('Immediate action'), L(['[Cargo secured / segregated]', '[Carrier, customer and insurer informed – who and when]', '[Survey arranged – surveyor and date]']),
    H('Likely cause and prevention'), P('[After investigation.]'), SIG(['Reporter', 'Operations manager']),
  ] },
  { id: 'ELV-062', cat, title: 'Shipment Delay Advisory', blocks: [
    F([['Date', '[DD MMM YYYY]'], ['To', '[Customer contact]'], ['Our ref.', '[Job no.]'], ['B/L / AWB', '[Number]']]),
    P('Dear [Name],\nWe are writing to let you know that your shipment is delayed.'),
    F([['Original ETA', '[DD MMM YYYY]'], ['Revised ETA', '[DD MMM YYYY / to be confirmed]'], ['Reason', '[Port congestion / rolled booking / weather / documents / customs query]'], ['Impact', '[On delivery, storage, free time, cut-offs]']]),
    H('What we are doing'), L(['[Action with carrier or authority]', '[Alternative routing or recovery option and its cost]']),
    H('What we need from you'), P('[Decision, document or approval needed, and by when.]'),
    P('We will update you again by [date/time]. Please call ' + CO.tel + ' for urgent questions.\nRegards,\n[Name], ' + CO.name),
  ] },
]
