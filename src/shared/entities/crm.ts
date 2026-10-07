import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, E, PH, S, R, D, DT, U } from '../dsl'
import { INCOTERMS } from './masters'

export const LEAD_SOURCES = ['Website', 'Referral', 'Cold call', 'Exhibition / event', 'Email campaign', 'WhatsApp', 'LinkedIn', 'Agent network', 'Existing customer', 'Other']
export const MODES = ['Ocean FCL', 'Ocean LCL', 'Air', 'Road', 'Multimodal', 'Customs clearance', 'Warehousing', 'Project cargo']

export const crm: EntityDef[] = [
  {
    key: 'parties', label: 'Customer / Party', plural: 'Customers & Parties', module: 'crm', icon: 'Building', title: ['name'], panel: true, customFields: true,
    numbering: { field: 'code', pattern: 'P{seq:5}' }, statusField: 'status', print: 'party',
    fields: [
      T('code', 'Code', { readonly: true, list: true, search: true, section: 'Company' }),
      T('name', 'Company name', { required: true, list: true, search: true, span: 2 }),
      T('legal_name', 'Legal name', { span: 2 }), S('status', 'Status', ['Prospect', 'Active', 'On hold', 'Blocked', 'Inactive'], { default: 'Active', list: true }),
      B('is_customer', 'Customer', { default: true, list: true }), B('is_shipper', 'Shipper'), B('is_consignee', 'Consignee'), B('is_notify', 'Notify party'),
      B('is_vendor', 'Vendor / supplier', { list: true }), B('is_agent', 'Overseas agent'), B('is_transporter', 'Transporter'), B('is_broker', 'Customs broker'),
      T('address1', 'Address line 1', { section: 'Address & contact', span: 2 }), T('address2', 'Address line 2'), T('city', 'City', { list: true }), T('state', 'Emirate / state'),
      R('country_id', 'Country', 'countries', { list: true }), T('po_box', 'PO box / postcode'),
      PH('phone', 'Phone', { list: true }), E('email', 'E-mail', { list: true }), U('website', 'Website'), T('contact_person', 'Primary contact'),
      T('trn', 'Tax registration no. (TRN)', { section: 'Tax & credit' }), T('trade_license', 'Trade licence no.'), T('eori', 'EORI / importer code'),
      M('credit_limit', 'Credit limit'), I('credit_days', 'Credit days'), R('payment_term_id', 'Payment term', 'payment_terms'),
      S('currency', 'Billing currency', ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR', 'CNY', 'ZAR'], { default: 'AED' }),
      S('kyc_status', 'KYC status', ['Pending', 'Verified', 'Expired', 'Rejected'], { default: 'Pending' }), D('kyc_expiry', 'KYC / licence expiry'),
      T('customs_code', 'Customs client / importer-exporter code', { help: 'Dubai Customs client code used on declarations' }),
      S('sanctions_status', 'Sanctions screening', ['Not screened', 'Clear', 'Potential match', 'Confirmed match'], { default: 'Not screened', section: 'Compliance (UAE)', list: false, help: 'Screen against the UAE Local Terrorist List and UN Consolidated List. A confirmed match blocks new jobs, quotations and invoices.' }),
      D('sanctions_screened_on', 'Screened on'), S('risk_rating', 'Risk rating', ['Low', 'Medium', 'High']), B('is_related_party', 'Related party / connected person', { help: 'Owner, shareholders, group companies – disclosed in the corporate tax return' }),
      S('marketing_consent', 'Marketing consent (PDPL)', ['Unknown', 'Opted in', 'Opted out'], { default: 'Unknown' }), D('consent_date', 'Consent date'),
      R('salesperson_id', 'Salesperson', 'users', { section: 'Relationship', list: true }), S('industry', 'Industry', ['Manufacturing', 'Trading', 'FMCG', 'Automotive', 'Pharma / healthcare', 'Oil & gas', 'Construction', 'Retail', 'Electronics', 'Agriculture / food', 'Textiles', 'Other']),
      S('source', 'Source', LEAD_SOURCES), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  {
    key: 'contacts', label: 'Contact', plural: 'Contacts', module: 'crm', icon: 'Contact', title: ['name'], panel: true,
    fields: [
      T('name', 'Name', { required: true, list: true, search: true, section: 'Contact' }), R('party_id', 'Company', 'parties', { list: true }),
      T('designation', 'Designation', { list: true }), E('email', 'E-mail', { list: true, search: true }), PH('phone', 'Phone', { list: true }), PH('mobile', 'Mobile / WhatsApp'),
      B('is_primary', 'Primary contact'), B('receives_invoices', 'Receives invoices'), B('receives_tracking', 'Receives tracking updates'), TA('notes', 'Notes'),
    ],
  },
  {
    key: 'campaigns', label: 'Campaign', plural: 'Campaigns', module: 'crm', icon: 'Megaphone', title: ['name'], panel: true, statusField: 'status',
    fields: [
      T('name', 'Campaign', { required: true, list: true, search: true, span: 2, section: 'Campaign' }),
      S('type', 'Channel', ['E-mail', 'WhatsApp', 'Exhibition', 'Webinar', 'LinkedIn', 'Direct visit', 'Referral'], { list: true }),
      S('status', 'Status', ['Planned', 'Running', 'Completed', 'Cancelled'], { default: 'Planned', list: true }),
      D('start_date', 'Start', { list: true }), D('end_date', 'End', { list: true }), M('budget', 'Budget', { list: true }), M('actual_cost', 'Actual cost'),
      R('owner_id', 'Owner', 'users'), TA('description', 'Target audience & notes'),
    ],
  },
  {
    key: 'leads', label: 'Lead', plural: 'Leads', module: 'crm', icon: 'UserPlus', title: ['lead_no', 'company'], titleSep: ' – ', panel: true,
    numbering: { field: 'lead_no', pattern: 'L{YY}{seq:5}' }, statusField: 'status',
    fields: [
      T('lead_no', 'Lead no.', { readonly: true, list: true, search: true, section: 'Lead' }), T('company', 'Company', { required: true, list: true, search: true, span: 2 }),
      T('contact_name', 'Contact person', { list: true, search: true }), E('email', 'E-mail', { list: true }), PH('phone', 'Phone / WhatsApp', { list: true }),
      S('status', 'Status', ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'], { default: 'New', list: true }),
      S('source', 'Source', LEAD_SOURCES, { list: true }), S('marketing_consent', 'Marketing consent (PDPL)', ['Unknown', 'Opted in', 'Opted out'], { default: 'Unknown' }), R('campaign_id', 'Campaign', 'campaigns'), R('owner_id', 'Owner', 'users', { list: true }),
      S('interest', 'Interested in', MODES), T('origin', 'Origin'), T('destination', 'Destination'), M('est_value', 'Estimated value'),
      R('converted_party_id', 'Converted to customer', 'parties', { readonly: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'opportunities', label: 'Opportunity', plural: 'Opportunities', module: 'crm', icon: 'Target', title: ['opp_no', 'title'], titleSep: ' – ', panel: true,
    numbering: { field: 'opp_no', pattern: 'OPP{YY}{seq:5}' }, statusField: 'stage', kanban: { field: 'stage' },
    fields: [
      T('opp_no', 'Opp. no.', { readonly: true, list: true, search: true, section: 'Opportunity' }), T('title', 'Title', { required: true, list: true, search: true, span: 2 }),
      R('party_id', 'Customer', 'parties', { required: true, list: true }), R('contact_id', 'Contact', 'contacts'),
      S('stage', 'Stage', ['Prospecting', 'Qualification', 'Quotation', 'Negotiation', 'Won', 'Lost'], { default: 'Prospecting', list: true }),
      M('value', 'Expected revenue', { list: true }), P('probability', 'Probability %', { default: 20, list: true }), D('expected_close', 'Expected close', { list: true }),
      R('owner_id', 'Owner', 'users', { list: true }), S('mode', 'Service', MODES), T('origin', 'Origin'), T('destination', 'Destination'),
      S('frequency', 'Volume', ['One-off', 'Monthly', 'Quarterly', 'Annual contract']), T('lost_reason', 'Lost reason'), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'activities', label: 'Activity', plural: 'Calls & Activities', module: 'crm', icon: 'PhoneCall', title: ['subject'], panel: true, statusField: 'status',
    calendar: { field: 'start_at' },
    fields: [
      S('type', 'Type', ['Call', 'Meeting', 'E-mail', 'Visit', 'Video call', 'WhatsApp'], { required: true, default: 'Call', list: true, section: 'Activity' }),
      T('subject', 'Subject', { required: true, list: true, search: true, span: 2 }),
      R('party_id', 'Company', 'parties', { list: true }), R('contact_id', 'Contact', 'contacts'), T('contact_name', 'Contact name', { list: true }), PH('phone', 'Phone'),
      S('direction', 'Direction', ['Outbound', 'Inbound'], { default: 'Outbound', list: true }), S('status', 'Status', ['Planned', 'Done', 'Cancelled'], { default: 'Done', list: true }),
      S('outcome', 'Outcome', ['Connected', 'No answer', 'Voicemail', 'Callback requested', 'Quote requested', 'Not interested', 'Follow-up needed']),
      DT('start_at', 'Date & time', { default: 'now', list: true }), DT('end_at', 'Ends'), I('duration_min', 'Duration (min)'),
      R('owner_id', 'Owner', 'users', { default: 'me', list: true }), T('location', 'Location'), U('video_link', 'Video call link'),
      D('followup_date', 'Follow-up date'), T('link_entity', 'Linked record type', { hidden: true }), I('link_id', 'Linked record id', { hidden: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'start_at', dir: 'desc' },
  },
  // ---- Sales & pricing
  {
    key: 'rate_cards', label: 'Rate card', plural: 'Rate cards (buy / sell)', module: 'sales', icon: 'Tags', title: ['name'], panel: true, statusField: 'status',
    children: [{ key: 'lines', label: 'Rates', entity: 'rate_card_lines', fk: 'rate_card_id' }],
    fields: [
      T('name', 'Rate card name', { required: true, list: true, search: true, span: 2, section: 'Rate card' }), S('kind', 'Kind', ['Buy (cost)', 'Sell (price list)'], { required: true, list: true }),
      S('mode', 'Mode', MODES, { list: true }), R('vendor_id', 'Carrier / vendor / agent', 'parties', { refFilter: { is_vendor: 1 }, list: true }), R('customer_id', 'Customer (if specific)', 'parties', { refFilter: { is_customer: 1 } }),
      S('currency', 'Currency', ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR', 'CNY'], { default: 'USD', list: true }), D('valid_from', 'Valid from', { list: true }), D('valid_to', 'Valid to', { list: true }),
      S('status', 'Status', ['Draft', 'Active', 'Expired'], { default: 'Active', list: true }), TA('notes', 'Notes'),
    ],
  },
  {
    key: 'rate_card_lines', label: 'Rate line', plural: 'Rate lines', module: 'sales', icon: 'Tag', title: ['id'], child: true,
    fields: [
      R('rate_card_id', 'Rate card', 'rate_cards', { hidden: true }), R('origin_id', 'Origin', 'locations', { list: true }), R('destination_id', 'Destination', 'locations', { list: true }),
      R('charge_code_id', 'Charge', 'charge_codes', { list: true }), T('basis', 'Basis', { list: true, placeholder: '20GP, 40HC, kg, CBM…' }), M('rate', 'Rate', { list: true }), M('min_charge', 'Minimum'),
      I('transit_days', 'Transit days'), I('free_days', 'Free days'), T('remarks', 'Remarks'),
    ],
  },
  {
    key: 'quotations', label: 'Quotation', plural: 'Quotations', module: 'sales', icon: 'FileSignature', title: ['quote_no'], panel: true, statusField: 'status', print: 'quotation',
    numbering: { field: 'quote_no', pattern: 'QT{YY}{MM}{seq:4}' }, customFields: true,
    children: [{ key: 'lines', label: 'Charges', entity: 'quotation_lines', fk: 'quote_id', columns: ['charge_code_id', 'description', 'basis', 'qty', 'rate', 'cost_rate', 'vat_code_id', 'amount'] }],
    fields: [
      T('quote_no', 'Quote no.', { readonly: true, list: true, search: true, section: 'Quotation' }), D('quote_date', 'Date', { required: true, default: 'today', list: true }), D('valid_until', 'Valid until', { list: true }),
      R('customer_id', 'Customer', 'parties', { required: true, refFilter: { is_customer: 1 }, list: true }), R('contact_id', 'Contact', 'contacts'), R('salesperson_id', 'Salesperson', 'users', { default: 'me', list: true }),
      S('mode', 'Service', ['Ocean FCL', 'Ocean LCL', 'Air', 'Road', 'Multimodal', 'Customs clearance', 'Warehousing', 'Project cargo'], { required: true, list: true }),
      S('trade', 'Trade', ['Export', 'Import', 'Cross trade', 'Domestic']), S('inco_terms', 'Incoterms', INCOTERMS), S('service_type', 'Service type', ['Port to Port', 'Door to Door', 'Door to Port', 'Port to Door']),
      R('pol_id', 'Port of loading', 'locations', { section: 'Route & cargo' }), R('pod_id', 'Port of discharge', 'locations'), T('place_of_receipt', 'Place of receipt'), T('place_of_delivery', 'Place of delivery'),
      T('commodity', 'Commodity'), I('packages', 'Packages'), N('gross_weight', 'Gross weight (kg)'), N('volume_cbm', 'Volume (CBM)'), T('equipment', 'Equipment', { placeholder: '1 x 40HC' }), B('is_hazardous', 'Dangerous goods'),
      S('currency', 'Currency', ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'], { default: 'AED', section: 'Commercials' }), N('ex_rate', 'Exchange rate to AED', { default: 1 }), R('payment_term_id', 'Payment term', 'payment_terms'),
      S('status', 'Status', ['Draft', 'Pending approval', 'Approved', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted to job'], { default: 'Draft', list: true }),
      M('subtotal', 'Sell total', { computed: true, list: true }), M('vat_total', 'VAT', { computed: true }), M('total', 'Total', { computed: true, list: true }),
      M('total_cost', 'Estimated cost', { computed: true }), M('margin', 'Margin', { computed: true, list: true }), P('margin_pct', 'Margin %', { computed: true }),
      R('opportunity_id', 'Opportunity', 'opportunities'), R('job_id', 'Converted job', 'jobs', { readonly: true }), I('revision', 'Revision', { default: 1, readonly: true }),
      S('approval_status', 'Approval', ['Not required', 'Pending', 'Approved', 'Rejected'], { default: 'Not required', readonly: true }), T('rejection_reason', 'Rejection reason'),
      TA('terms', 'Terms & conditions', { section: 'Notes' }), TA('notes', 'Internal notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'quotation_lines', label: 'Quotation line', plural: 'Quotation lines', module: 'sales', icon: 'List', title: ['description'], child: true,
    fields: [
      R('quote_id', 'Quotation', 'quotations', { hidden: true }), R('charge_code_id', 'Charge', 'charge_codes'), T('description', 'Description'), T('basis', 'Basis'),
      N('qty', 'Qty', { default: 1 }), M('rate', 'Sell rate'), M('cost_rate', 'Cost rate'), R('vat_code_id', 'Tax', 'vat_codes'), P('vat_pct', 'VAT %', { hidden: true }),
      M('amount', 'Amount', { computed: true }), M('vat_amount', 'VAT', { computed: true, hidden: true }), M('cost_amount', 'Cost', { computed: true, hidden: true }), T('remarks', 'Remarks', { hidden: true }),
    ],
  },
  {
    key: 'contracts', label: 'Contract', plural: 'Contracts & agreements', module: 'sales', icon: 'FileCheck2', title: ['contract_no', 'title'], titleSep: ' – ', panel: true, statusField: 'status',
    numbering: { field: 'contract_no', pattern: 'CTR{YY}{seq:4}' },
    fields: [
      T('contract_no', 'Contract no.', { readonly: true, list: true, search: true, section: 'Contract' }), T('title', 'Title', { required: true, list: true, search: true, span: 2 }),
      R('party_id', 'Counterparty', 'parties', { required: true, list: true }), S('type', 'Type', ['Service agreement', 'Rate contract', 'Transport', 'Warehousing', 'Agency', 'NDA', 'Other'], { list: true }),
      S('status', 'Status', ['Draft', 'Active', 'Expired', 'Terminated'], { default: 'Draft', list: true }), D('start_date', 'Start', { list: true }), D('end_date', 'End', { list: true }),
      M('value', 'Contract value'), I('credit_days', 'Credit days'), B('auto_renew', 'Auto-renew'), I('renewal_notice_days', 'Renewal reminder (days)', { default: 30 }),
      R('owner_id', 'Owner', 'users'), TA('terms', 'Key terms'),
    ],
    defaultSort: { field: 'end_date', dir: 'asc' },
  },
]
