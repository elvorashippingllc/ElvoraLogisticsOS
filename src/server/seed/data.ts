// Reference data. Only identifiers / structure — no commercial figures.

export const ISO_COUNTRIES = 'AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BV BR IO BN BG BF BI KH CM CA CV KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW SH KN LC PM VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(' ')

const R = (codes: string) => new Set(codes.split(' '))
export const REGIONS: [string, Set<string>][] = [
  ['GCC & Middle East', R('AE SA OM QA KW BH IQ IR JO LB SY YE IL PS TR')],
  ['Indian Subcontinent', R('IN PK BD LK NP BT MV AF')],
  ['Far East & Asia', R('CN HK TW JP KR KP SG MY TH VN ID PH MM KH LA BN MN MO TL KZ UZ TM KG TJ AZ AM GE')],
  ['Europe', R('GB IE FR DE NL BE LU ES PT IT GR MT CH AT DK SE NO FI IS PL CZ SK HU RO BG HR SI RS BA ME MK AL EE LV LT UA BY MD RU CY AD MC SM LI')],
  ['Africa', R('ZA KE TZ UG ET DJ SO SD SS ER EG LY TN DZ MA NG GH CI SN ML MR GM GN GW SL LR TG BJ BF NE TD CM CF CG CD GA GQ AO ZM ZW MZ MW NA BW LS SZ MG MU SC KM RW BI CV ST')],
  ['Americas', R('US CA MX BR AR CL CO PE VE EC UY PY BO PA CR GT HN SV NI CU DO JM TT BS BB HT')],
  ['Oceania', R('AU NZ FJ PG WS TO VU SB')],
]
export const CURRENCY_BY_COUNTRY: Record<string, string> = { AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', OM: 'OMR', BH: 'BHD', US: 'USD', GB: 'GBP', IN: 'INR', PK: 'PKR', CN: 'CNY', ZA: 'ZAR', KE: 'KES', DE: 'EUR', FR: 'EUR', NL: 'EUR', IT: 'EUR', ES: 'EUR', BE: 'EUR', JP: 'JPY' }

// code, name, country, type, iata
export const LOCATIONS: [string, string, string, string, string?][] = [
  ['AEDXB', 'Dubai', 'AE', 'City', 'DXB'], ['AEJEA', 'Jebel Ali', 'AE', 'Seaport'], ['AEAUH', 'Abu Dhabi', 'AE', 'City', 'AUH'], ['AESHJ', 'Sharjah', 'AE', 'City', 'SHJ'], ['AEFJR', 'Fujairah', 'AE', 'Seaport', 'FJR'],
  ['AEKLF', 'Khor Fakkan', 'AE', 'Seaport'], ['AERKT', 'Ras Al Khaimah', 'AE', 'Seaport', 'RKT'], ['AEAJM', 'Ajman', 'AE', 'Seaport'], ['AEDWC', 'Dubai World Central (Al Maktoum)', 'AE', 'Airport', 'DWC'],
  ['SADMM', 'Dammam', 'SA', 'City', 'DMM'], ['SAJED', 'Jeddah', 'SA', 'City', 'JED'], ['SARUH', 'Riyadh', 'SA', 'City', 'RUH'], ['SAJUB', 'Jubail', 'SA', 'Seaport'], ['SAYNB', 'Yanbu', 'SA', 'Seaport'],
  ['OMSLL', 'Salalah', 'OM', 'Seaport', 'SLL'], ['OMSOH', 'Sohar', 'OM', 'Seaport'], ['OMMCT', 'Muscat', 'OM', 'City', 'MCT'], ['QADOH', 'Doha', 'QA', 'City', 'DOH'], ['KWKWI', 'Kuwait', 'KW', 'City', 'KWI'], ['KWSWK', 'Shuwaikh', 'KW', 'Seaport'],
  ['BHBAH', 'Bahrain', 'BH', 'City', 'BAH'], ['IQBSR', 'Basra', 'IQ', 'City', 'BSR'], ['IRBND', 'Bandar Abbas', 'IR', 'Seaport', 'BND'], ['JOAQJ', 'Aqaba', 'JO', 'Seaport', 'AQJ'], ['JOAMM', 'Amman', 'JO', 'City', 'AMM'],
  ['LBBEY', 'Beirut', 'LB', 'City', 'BEY'], ['EGALY', 'Alexandria', 'EG', 'Seaport', 'ALY'], ['EGPSD', 'Port Said', 'EG', 'Seaport'], ['EGCAI', 'Cairo', 'EG', 'City', 'CAI'], ['TRIST', 'Istanbul', 'TR', 'City', 'IST'], ['TRMER', 'Mersin', 'TR', 'Seaport'], ['TRIZM', 'Izmir', 'TR', 'City', 'ADB'],
  ['CNSHA', 'Shanghai', 'CN', 'City', 'PVG'], ['CNNGB', 'Ningbo', 'CN', 'Seaport'], ['CNSZX', 'Shenzhen', 'CN', 'City', 'SZX'], ['CNYTN', 'Yantian', 'CN', 'Seaport'], ['CNGZH', 'Guangzhou', 'CN', 'City', 'CAN'], ['CNTAO', 'Qingdao', 'CN', 'Seaport', 'TAO'],
  ['CNTSN', 'Tianjin', 'CN', 'Seaport', 'TSN'], ['CNXMN', 'Xiamen', 'CN', 'Seaport', 'XMN'], ['CNDLC', 'Dalian', 'CN', 'Seaport', 'DLC'], ['HKHKG', 'Hong Kong', 'HK', 'City', 'HKG'], ['TWKHH', 'Kaohsiung', 'TW', 'Seaport', 'KHH'],
  ['KRPUS', 'Busan', 'KR', 'Seaport', 'PUS'], ['KRICN', 'Incheon', 'KR', 'City', 'ICN'], ['JPTYO', 'Tokyo', 'JP', 'City', 'NRT'], ['JPYOK', 'Yokohama', 'JP', 'Seaport'], ['JPUKB', 'Kobe', 'JP', 'Seaport'], ['JPOSA', 'Osaka', 'JP', 'City', 'KIX'],
  ['SGSIN', 'Singapore', 'SG', 'City', 'SIN'], ['MYPKG', 'Port Klang', 'MY', 'Seaport'], ['MYPEN', 'Penang', 'MY', 'Seaport', 'PEN'], ['MYTPP', 'Tanjung Pelepas', 'MY', 'Seaport'], ['THBKK', 'Bangkok', 'TH', 'City', 'BKK'], ['THLCH', 'Laem Chabang', 'TH', 'Seaport'],
  ['VNSGN', 'Ho Chi Minh City', 'VN', 'City', 'SGN'], ['VNHPH', 'Haiphong', 'VN', 'Seaport'], ['VNCMT', 'Cai Mep', 'VN', 'Seaport'], ['IDJKT', 'Jakarta', 'ID', 'City', 'CGK'], ['IDSUB', 'Surabaya', 'ID', 'Seaport', 'SUB'], ['PHMNL', 'Manila', 'PH', 'City', 'MNL'],
  ['LKCMB', 'Colombo', 'LK', 'City', 'CMB'], ['INNSA', 'Nhava Sheva (JNPT)', 'IN', 'Seaport'], ['INMUN', 'Mundra', 'IN', 'Seaport'], ['INMAA', 'Chennai', 'IN', 'City', 'MAA'], ['INBOM', 'Mumbai', 'IN', 'City', 'BOM'], ['INDEL', 'Delhi', 'IN', 'City', 'DEL'],
  ['INBLR', 'Bangalore', 'IN', 'City', 'BLR'], ['INCCU', 'Kolkata', 'IN', 'City', 'CCU'], ['INCOK', 'Cochin', 'IN', 'City', 'COK'], ['INTUT', 'Tuticorin', 'IN', 'Seaport'], ['INPAV', 'Pipavav', 'IN', 'Seaport'], ['PKKHI', 'Karachi', 'PK', 'City', 'KHI'], ['PKQCT', 'Port Qasim', 'PK', 'Seaport'],
  ['PKLHE', 'Lahore', 'PK', 'City', 'LHE'], ['BDCGP', 'Chittagong', 'BD', 'Seaport', 'CGP'], ['BDDAC', 'Dhaka', 'BD', 'City', 'DAC'],
  ['NLRTM', 'Rotterdam', 'NL', 'Seaport'], ['NLAMS', 'Amsterdam', 'NL', 'City', 'AMS'], ['BEANR', 'Antwerp', 'BE', 'Seaport'], ['DEHAM', 'Hamburg', 'DE', 'Seaport', 'HAM'], ['DEBRV', 'Bremerhaven', 'DE', 'Seaport'], ['DEFRA', 'Frankfurt', 'DE', 'City', 'FRA'],
  ['GBFXT', 'Felixstowe', 'GB', 'Seaport'], ['GBSOU', 'Southampton', 'GB', 'Seaport'], ['GBLGP', 'London Gateway', 'GB', 'Seaport'], ['GBLON', 'London', 'GB', 'City', 'LHR'], ['FRLEH', 'Le Havre', 'FR', 'Seaport'], ['FRPAR', 'Paris', 'FR', 'City', 'CDG'], ['FRMRS', 'Marseille', 'FR', 'Seaport', 'MRS'],
  ['ESBCN', 'Barcelona', 'ES', 'City', 'BCN'], ['ESVLC', 'Valencia', 'ES', 'Seaport', 'VLC'], ['ESALG', 'Algeciras', 'ES', 'Seaport'], ['ESMAD', 'Madrid', 'ES', 'City', 'MAD'], ['ITGOA', 'Genoa', 'IT', 'Seaport'], ['ITLSP', 'La Spezia', 'IT', 'Seaport'],
  ['ITMIL', 'Milan', 'IT', 'City', 'MXP'], ['ITROM', 'Rome', 'IT', 'City', 'FCO'], ['GRPIR', 'Piraeus', 'GR', 'Seaport'], ['MTMAR', 'Marsaxlokk', 'MT', 'Seaport'], ['PTLIS', 'Lisbon', 'PT', 'City', 'LIS'], ['PLGDN', 'Gdansk', 'PL', 'Seaport', 'GDN'],
  ['SEGOT', 'Gothenburg', 'SE', 'Seaport', 'GOT'], ['DKCPH', 'Copenhagen', 'DK', 'City', 'CPH'], ['CHZRH', 'Zurich', 'CH', 'City', 'ZRH'], ['ATVIE', 'Vienna', 'AT', 'City', 'VIE'], ['RULED', 'St Petersburg', 'RU', 'Seaport', 'LED'],
  ['ZADUR', 'Durban', 'ZA', 'Seaport', 'DUR'], ['ZACPT', 'Cape Town', 'ZA', 'City', 'CPT'], ['ZAJNB', 'Johannesburg', 'ZA', 'City', 'JNB'], ['ZAPLZ', 'Port Elizabeth (Gqeberha)', 'ZA', 'Seaport', 'PLZ'],
  ['KEMBA', 'Mombasa', 'KE', 'Seaport', 'MBA'], ['KENBO', 'Nairobi', 'KE', 'City', 'NBO'], ['TZDAR', 'Dar es Salaam', 'TZ', 'City', 'DAR'], ['UGEBB', 'Entebbe', 'UG', 'Airport', 'EBB'], ['ETADD', 'Addis Ababa', 'ET', 'City', 'ADD'], ['DJJIB', 'Djibouti', 'DJ', 'Seaport', 'JIB'],
  ['NGLOS', 'Lagos', 'NG', 'City', 'LOS'], ['GHTEM', 'Tema', 'GH', 'Seaport'], ['GHACC', 'Accra', 'GH', 'City', 'ACC'], ['CIABJ', 'Abidjan', 'CI', 'City', 'ABJ'], ['SNDKR', 'Dakar', 'SN', 'City', 'DKR'], ['MAPTM', 'Tanger Med', 'MA', 'Seaport'], ['MACAS', 'Casablanca', 'MA', 'City', 'CMN'],
  ['DZALG', 'Algiers', 'DZ', 'City', 'ALG'], ['TNTUN', 'Tunis', 'TN', 'City', 'TUN'], ['AOLAD', 'Luanda', 'AO', 'City', 'LAD'], ['MZMPM', 'Maputo', 'MZ', 'City', 'MPM'], ['MZBEW', 'Beira', 'MZ', 'Seaport', 'BEW'], ['ZMLUN', 'Lusaka', 'ZM', 'City', 'LUN'], ['ZWHRE', 'Harare', 'ZW', 'City', 'HRE'],
  ['SDPZU', 'Port Sudan', 'SD', 'Seaport', 'PZU'], ['SOMGQ', 'Mogadishu', 'SO', 'City', 'MGQ'],
  ['USNYC', 'New York', 'US', 'City', 'JFK'], ['USLAX', 'Los Angeles', 'US', 'City', 'LAX'], ['USLGB', 'Long Beach', 'US', 'Seaport'], ['USSAV', 'Savannah', 'US', 'Seaport', 'SAV'], ['USHOU', 'Houston', 'US', 'City', 'IAH'], ['USMIA', 'Miami', 'US', 'City', 'MIA'],
  ['USCHI', 'Chicago', 'US', 'City', 'ORD'], ['USORF', 'Norfolk', 'US', 'Seaport', 'ORF'], ['USATL', 'Atlanta', 'US', 'City', 'ATL'], ['USSEA', 'Seattle', 'US', 'City', 'SEA'], ['CAVAN', 'Vancouver', 'CA', 'City', 'YVR'], ['CAMTR', 'Montreal', 'CA', 'City', 'YUL'], ['CATOR', 'Toronto', 'CA', 'City', 'YYZ'],
  ['MXZLO', 'Manzanillo', 'MX', 'Seaport', 'ZLO'], ['BRSSZ', 'Santos', 'BR', 'Seaport'], ['ARBUE', 'Buenos Aires', 'AR', 'City', 'EZE'], ['CLVAP', 'Valparaiso', 'CL', 'Seaport'], ['CLSAI', 'San Antonio', 'CL', 'Seaport'], ['COCTG', 'Cartagena', 'CO', 'Seaport', 'CTG'],
  ['PAONX', 'Colon', 'PA', 'Seaport'], ['PABLB', 'Balboa', 'PA', 'Seaport'], ['AUSYD', 'Sydney', 'AU', 'City', 'SYD'], ['AUMEL', 'Melbourne', 'AU', 'City', 'MEL'], ['AUBNE', 'Brisbane', 'AU', 'City', 'BNE'], ['NZAKL', 'Auckland', 'NZ', 'City', 'AKL'],
]

// name, type, scac/iata, awb prefix, website, tracking url
export const CARRIERS: [string, string, string, string, string, string][] = [
  ['Maersk', 'Ocean line', 'MAEU', '', 'https://www.maersk.com', 'https://www.maersk.com/tracking/{no}'], ['MSC – Mediterranean Shipping Company', 'Ocean line', 'MSCU', '', 'https://www.msc.com', ''],
  ['CMA CGM', 'Ocean line', 'CMDU', '', 'https://www.cma-cgm.com', 'https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference={no}'], ['COSCO Shipping Lines', 'Ocean line', 'COSU', '', 'https://lines.coscoshipping.com', ''],
  ['Hapag-Lloyd', 'Ocean line', 'HLCU', '', 'https://www.hapag-lloyd.com', ''], ['Ocean Network Express (ONE)', 'Ocean line', 'ONEY', '', 'https://www.one-line.com', 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam={no}'],
  ['Evergreen Line', 'Ocean line', 'EGLV', '', 'https://www.evergreen-line.com', ''], ['HMM', 'Ocean line', 'HDMU', '', 'https://www.hmm21.com', ''], ['Yang Ming', 'Ocean line', 'YMLU', '', 'https://www.yangming.com', ''],
  ['ZIM', 'Ocean line', 'ZIMU', '', 'https://www.zim.com', ''], ['PIL – Pacific International Lines', 'Ocean line', 'PCIU', '', 'https://www.pilship.com', ''], ['OOCL', 'Ocean line', 'OOLU', '', 'https://www.oocl.com', ''],
  ['Wan Hai Lines', 'Ocean line', 'WHLC', '', 'https://www.wanhai.com', ''], ['Emirates Shipping Line', 'Ocean line', '', '', 'https://www.emiratesline.com', ''], ['Arkas Line', 'Ocean line', '', '', 'https://www.arkasline.com.tr', ''],
  ['Etihad Airways', 'Airline', 'EY', '607', 'https://www.etihadcargo.com', ''], ['Emirates SkyCargo', 'Airline', 'EK', '176', 'https://www.skycargo.com', ''], ['Qatar Airways Cargo', 'Airline', 'QR', '157', 'https://www.qrcargo.com', ''],
  ['Saudia Cargo', 'Airline', 'SV', '065', 'https://www.saudiacargo.com', ''], ['flydubai Cargo', 'Airline', 'FZ', '141', 'https://www.flydubaicargo.com', ''], ['Turkish Cargo', 'Airline', 'TK', '235', 'https://www.turkishcargo.com', ''],
  ['Lufthansa Cargo', 'Airline', 'LH', '020', 'https://lufthansa-cargo.com', ''], ['Air India Cargo', 'Airline', 'AI', '098', 'https://www.airindia.com', ''], ['Cathay Cargo', 'Airline', 'CX', '160', 'https://www.cathaycargo.com', ''],
  ['Singapore Airlines Cargo', 'Airline', 'SQ', '618', 'https://www.siacargo.com', ''], ['British Airways Cargo', 'Airline', 'BA', '125', 'https://www.iagcargo.com', ''], ['Ethiopian Cargo', 'Airline', 'ET', '071', 'https://www.ethiopianairlines.com', ''],
  ['Kenya Airways Cargo', 'Airline', 'KQ', '706', 'https://www.kenya-airways.com', ''], ['Air Arabia Cargo', 'Airline', 'G9', '514', 'https://www.airarabia.com', ''], ['Gulf Air Cargo', 'Airline', 'GF', '072', 'https://www.gulfair.com', ''],
  ['Oman Air Cargo', 'Airline', 'WY', '910', 'https://www.omanair.com', ''], ['Kuwait Airways Cargo', 'Airline', 'KU', '229', 'https://www.kuwaitairways.com', ''], ['EgyptAir Cargo', 'Airline', 'MS', '077', 'https://www.egyptair.com', ''],
  ['DHL Express', 'Courier', '', '', 'https://www.dhl.com', ''], ['FedEx', 'Courier', '', '', 'https://www.fedex.com', ''], ['UPS', 'Courier', '', '', 'https://www.ups.com', ''], ['Aramex', 'Courier', '', '', 'https://www.aramex.com', ''],
]

// code, ISO type, teu, tare, payload, cbm  (typical values — adjust to your lessor specifications)
export const CONTAINER_TYPES: [string, string, string, number, number, number, number][] = [
  ['20GP', "20' General purpose", '22G1', 1, 2300, 28200, 33], ['40GP', "40' General purpose", '42G1', 2, 3750, 28750, 67], ['40HC', "40' High cube", '45G1', 2, 3900, 28600, 76], ['45HC', "45' High cube", 'L5G1', 2.25, 4800, 27700, 86],
  ['20RF', "20' Reefer", '22R1', 1, 3050, 27400, 28], ['40RH', "40' Reefer high cube", '45R1', 2, 4800, 29500, 67], ['20OT', "20' Open top", '22U1', 1, 2300, 28200, 32], ['40OT', "40' Open top", '42U1', 2, 3900, 28600, 65],
  ['20FR', "20' Flat rack", '22P1', 1, 2700, 30000, 0], ['40FR', "40' Flat rack", '42P1', 2, 5000, 40000, 0], ['20TK', "20' Tank", '22T6', 1, 3600, 26900, 24], ['LCL', 'Loose / consolidated cargo', '', 0, 0, 0, 0], ['ULD', 'Air ULD / pallet', '', 0, 0, 0, 0],
]

export const CURRENCIES: [string, string, string][] = [
  ['AED', 'UAE Dirham', 'د.إ'], ['USD', 'US Dollar', '$'], ['EUR', 'Euro', '€'], ['GBP', 'Pound Sterling', '£'], ['SAR', 'Saudi Riyal', '﷼'], ['QAR', 'Qatari Riyal', ''], ['KWD', 'Kuwaiti Dinar', ''], ['OMR', 'Omani Rial', ''], ['BHD', 'Bahraini Dinar', ''],
  ['INR', 'Indian Rupee', '₹'], ['PKR', 'Pakistani Rupee', ''], ['CNY', 'Chinese Yuan', '¥'], ['JPY', 'Japanese Yen', '¥'], ['ZAR', 'South African Rand', 'R'], ['KES', 'Kenyan Shilling', ''],
]

export const UOMS: [string, string][] = [['KG', 'Kilogram'], ['CBM', 'Cubic metre'], ['PCS', 'Pieces'], ['CTN', 'Carton'], ['PLT', 'Pallet'], ['CNT', 'Container'], ['20GP', "20' container"], ['40HC', "40' high cube"], ['BL', 'Bill of lading'], ['AWB', 'Air waybill'], ['SHP', 'Shipment'], ['TRIP', 'Trip'], ['DAY', 'Day'], ['HR', 'Hour'], ['MT', 'Metric tonne'], ['WM', 'Weight / measurement'], ['SET', 'Set'], ['LS', 'Lump sum']]

export const VAT_CODES: [string, string, number, string][] = [
  ['SR', 'Standard rated 5%', 5, 'Standard rated'], ['ZR', 'Zero rated (e.g. international transport / exports)', 0, 'Zero rated'], ['ES', 'Exempt', 0, 'Exempt'], ['OS', 'Out of scope / disbursement', 0, 'Out of scope'], ['RC', 'Reverse charge 5%', 5, 'Reverse charge'],
]

export const PAYMENT_TERMS: [string, number][] = [['Immediate / advance', 0], ['Net 7 days', 7], ['Net 15 days', 15], ['Net 30 days', 30], ['Net 45 days', 45], ['Net 60 days', 60], ['Net 90 days', 90]]
export const SERVICE_TYPES = ['Port to Port', 'Door to Door', 'Door to Port', 'Port to Door', 'Warehouse to Warehouse']

// code, name, type, subtype, role
export const ACCOUNTS: [string, string, string, string, string?][] = [
  ['1000', 'Cash in hand', 'Asset', 'Cash'], ['1010', 'Petty cash', 'Asset', 'Cash'], ['1100', 'Main operating account – AED', 'Asset', 'Bank'], ['1110', 'USD account', 'Asset', 'Bank'],
  ['1200', 'Accounts receivable', 'Asset', 'Accounts receivable', 'ar_control'], ['1210', 'Employee advances', 'Asset', 'Current asset'], ['1250', 'VAT receivable (input VAT)', 'Asset', 'VAT receivable (input)', 'vat_input'],
  ['1300', 'Prepayments & deposits', 'Asset', 'Current asset'], ['1500', 'Vehicles', 'Asset', 'Fixed asset'], ['1510', 'Warehouse & handling equipment', 'Asset', 'Fixed asset'], ['1520', 'Furniture, IT & office equipment', 'Asset', 'Fixed asset'], ['1590', 'Accumulated depreciation', 'Asset', 'Accumulated depreciation'],
  ['2000', 'Accounts payable', 'Liability', 'Accounts payable', 'ap_control'], ['2100', 'VAT payable (output VAT)', 'Liability', 'VAT payable (output)', 'vat_output'], ['2200', 'Accrued expenses', 'Liability', 'Current liability'], ['2210', 'Employee payables', 'Liability', 'Current liability', 'employee_payable'],
  ['2300', 'Customer deposits', 'Liability', 'Current liability'], ['2500', 'Bank loans', 'Liability', 'Long-term liability'],
  ['3000', 'Share capital', 'Equity', 'Capital'], ['3100', 'Retained earnings', 'Equity', 'Retained earnings', 'retained_earnings'], ['3200', "Owners' current account", 'Equity', 'Capital'], ['3900', 'Opening balance equity', 'Equity', 'Capital', 'opening_balance'],
  ['4000', 'Freight revenue', 'Income', 'Operating revenue', 'default_revenue'], ['4100', 'Origin / destination local charges revenue', 'Income', 'Operating revenue'], ['4200', 'Customs clearance & documentation revenue', 'Income', 'Operating revenue'], ['4300', 'Transport revenue', 'Income', 'Operating revenue'],
  ['4400', 'Warehousing & handling revenue', 'Income', 'Operating revenue'], ['4800', 'Disbursement recoveries', 'Income', 'Operating revenue'], ['4900', 'Other income', 'Income', 'Other income'],
  ['5000', 'Freight cost (carriers / airlines)', 'Expense', 'Direct cost'], ['5100', 'Local charges cost', 'Expense', 'Direct cost', 'default_cost'], ['5200', 'Customs & documentation cost', 'Expense', 'Direct cost'], ['5300', 'Transport cost', 'Expense', 'Direct cost'],
  ['5400', 'Warehousing & handling cost', 'Expense', 'Direct cost'], ['5800', 'Disbursements paid', 'Expense', 'Direct cost'], ['5900', 'Other direct cost', 'Expense', 'Direct cost'],
  ['6000', 'Salaries & wages', 'Expense', 'Payroll'], ['6010', 'Staff benefits, visas & medical', 'Expense', 'Payroll'], ['6100', 'Rent', 'Expense', 'Operating expense'], ['6200', 'Utilities & communication', 'Expense', 'Operating expense'], ['6300', 'Vehicle running costs', 'Expense', 'Operating expense'],
  ['6400', 'Depreciation', 'Expense', 'Operating expense'], ['6500', 'Professional & legal fees', 'Expense', 'Operating expense'], ['6600', 'Marketing & business development', 'Expense', 'Operating expense'], ['6700', 'Bank charges', 'Expense', 'Operating expense'],
  ['6800', 'Insurance', 'Expense', 'Operating expense'], ['6900', 'Miscellaneous expense', 'Expense', 'Operating expense'], ['7000', 'Interest expense', 'Expense', 'Operating expense'], ['7900', 'Exchange gain / (loss)', 'Expense', 'FX gain / loss', 'fx_gain_loss'],
]

// code, name, applies_to, group, uom, vat, income acct, cost acct
export const CHARGE_CODES: [string, string, string, string, string, string, string, string][] = [
  ['FRT-OCN', 'Ocean freight', 'Revenue & cost', 'Freight', 'CNT', 'ZR', '4000', '5000'], ['FRT-AIR', 'Air freight', 'Revenue & cost', 'Freight', 'KG', 'ZR', '4000', '5000'], ['FRT-RD', 'Road freight', 'Revenue & cost', 'Freight', 'TRIP', 'SR', '4300', '5300'],
  ['BAF', 'Bunker adjustment factor (BAF)', 'Revenue & cost', 'Surcharges', 'CNT', 'ZR', '4000', '5000'], ['PSS', 'Peak season surcharge', 'Revenue & cost', 'Surcharges', 'CNT', 'ZR', '4000', '5000'], ['EBS', 'Emergency bunker surcharge', 'Revenue & cost', 'Surcharges', 'CNT', 'ZR', '4000', '5000'],
  ['FSC', 'Fuel surcharge (air)', 'Revenue & cost', 'Surcharges', 'KG', 'ZR', '4000', '5000'], ['SSC', 'Security surcharge (air)', 'Revenue & cost', 'Surcharges', 'KG', 'ZR', '4000', '5000'],
  ['THC-O', 'Terminal handling – origin', 'Revenue & cost', 'Origin charges', 'CNT', 'SR', '4100', '5100'], ['THC-D', 'Terminal handling – destination', 'Revenue & cost', 'Destination charges', 'CNT', 'SR', '4100', '5100'],
  ['DOC', 'Documentation fee', 'Revenue & cost', 'Documentation', 'SHP', 'SR', '4200', '5200'], ['BLF', 'Bill of lading fee', 'Revenue & cost', 'Documentation', 'BL', 'SR', '4200', '5200'], ['AWBF', 'Air waybill fee', 'Revenue & cost', 'Documentation', 'AWB', 'SR', '4200', '5200'],
  ['DOF', 'Delivery order fee', 'Revenue & cost', 'Destination charges', 'BL', 'SR', '4100', '5100'], ['SEAL', 'Seal charge', 'Revenue & cost', 'Origin charges', 'CNT', 'SR', '4100', '5100'], ['VGM', 'VGM fee', 'Revenue & cost', 'Origin charges', 'CNT', 'SR', '4100', '5100'],
  ['CCF', 'Customs clearance fee', 'Revenue & cost', 'Customs', 'SHP', 'SR', '4200', '5200'], ['DUTY', 'Customs duty (disbursement)', 'Revenue & cost', 'Customs', 'LS', 'OS', '4800', '5800'], ['INSP', 'Customs inspection / exam charges', 'Revenue & cost', 'Customs', 'SHP', 'SR', '4200', '5200'],
  ['ATTEST', 'Attestation / chamber of commerce', 'Revenue & cost', 'Documentation', 'SHP', 'SR', '4200', '5200'], ['GATE', 'Gate pass / port charges', 'Revenue & cost', 'Origin charges', 'SHP', 'SR', '4100', '5100'],
  ['TRK', 'Trucking / inland haulage', 'Revenue & cost', 'Transport', 'TRIP', 'SR', '4300', '5300'], ['PICKUP', 'Pick-up / collection', 'Revenue & cost', 'Transport', 'TRIP', 'SR', '4300', '5300'], ['DELIV', 'Delivery charges', 'Revenue & cost', 'Transport', 'TRIP', 'SR', '4300', '5300'],
  ['DEM', 'Demurrage', 'Revenue & cost', 'Destination charges', 'DAY', 'SR', '4100', '5100'], ['DET', 'Detention', 'Revenue & cost', 'Destination charges', 'DAY', 'SR', '4100', '5100'], ['STOR', 'Storage', 'Revenue & cost', 'Warehousing', 'DAY', 'SR', '4400', '5400'],
  ['HNDL', 'Handling / forklift / labour', 'Revenue & cost', 'Handling', 'SHP', 'SR', '4400', '5400'], ['STUFF', 'Stuffing / unstuffing', 'Revenue & cost', 'Handling', 'CNT', 'SR', '4400', '5400'], ['PALL', 'Palletising / wrapping', 'Revenue & cost', 'Handling', 'PLT', 'SR', '4400', '5400'],
  ['AHC', 'Airport handling charge', 'Revenue & cost', 'Origin charges', 'KG', 'SR', '4100', '5100'], ['XRAY', 'X-ray / screening', 'Revenue & cost', 'Origin charges', 'KG', 'SR', '4100', '5100'], ['FUM', 'Fumigation', 'Revenue & cost', 'Handling', 'SHP', 'SR', '4400', '5400'],
  ['INS', 'Cargo insurance premium', 'Revenue & cost', 'Insurance', 'LS', 'SR', '4900', '5900'], ['AGENCY', 'Agency / service fee', 'Revenue only', 'Other', 'SHP', 'SR', '4900', '5900'], ['COURIER', 'Courier / dispatch of documents', 'Revenue & cost', 'Documentation', 'SHP', 'SR', '4200', '5200'],
  ['MISC', 'Miscellaneous charges', 'Revenue & cost', 'Other', 'LS', 'SR', '4900', '5900'],
]

export interface RoleSeed { name: string; description: string; system?: boolean; permissions: '*' | Record<string, string[]> }
export const ROLES: RoleSeed[] = (() => {
  const V = ['view'], VE = ['view', 'export'], CRUD = ['view', 'create', 'edit', 'delete', 'export'], CE = ['view', 'create', 'edit', 'export']
  const list: RoleSeed[] = [
    { name: 'Admin', description: 'Full system access, including administration', system: true, permissions: '*' },
    { name: 'Manager', description: 'Full access to every module', system: true, permissions: '*' },
    { name: 'Sales', description: 'CRM, quotations and customer follow-up', permissions: { dashboard: V, crm: CRUD, sales: [...CRUD, 'approve'], jobs: VE, documents: CE, support: CE, projects: CRUD, reports: VE, masters: V } },
    { name: 'Operations', description: 'Jobs, shipments, customs, transport and warehouse', permissions: { dashboard: V, crm: V, sales: V, jobs: CRUD, customs: CRUD, transport: CRUD, warehouse: CRUD, documents: CRUD, support: CE, projects: CRUD, reports: VE, masters: V } },
    { name: 'Accounts', description: 'Invoicing, bills, banking and financial reports', permissions: { dashboard: V, crm: V, sales: V, jobs: V, finance: [...CRUD, 'approve'], documents: CE, reports: VE, masters: CE, hr: V, assets: CRUD } },
    { name: 'Warehouse', description: 'Warehouse stock, receipts and dispatch', permissions: { dashboard: V, jobs: V, warehouse: CRUD, transport: CE, documents: CE, projects: CE, masters: V } },
    { name: 'HR', description: 'Employees, leave, attendance and payroll', permissions: { dashboard: V, hr: [...CRUD, 'approve'], documents: CE, projects: CE, masters: V } },
    { name: 'Viewer', description: 'Read-only access to business modules', permissions: { dashboard: V, crm: V, sales: V, jobs: V, customs: V, transport: V, warehouse: V, finance: V, support: V, projects: V, documents: V, reports: V } },
    { name: 'Customer Portal', description: 'External customers — own jobs, invoices and quotations only', permissions: { dashboard: V, jobs: V, finance: V, sales: V, documents: V, support: ['view', 'create'] } },
  ]
  return list
})()
