import { DocumentPrinter } from '../components/ui/document-printer'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'
import { get } from '../lib/api'
import { useMeta } from '../lib/meta'
import { Loading, ErrorBox } from '../ui/kit'
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, todayIso } from '../lib/format'

const S = () => useMeta().meta!.settings
function Letterhead() {
  const s = S()
  return (
    <div className="flex items-start justify-between gap-6 pb-3 mb-4" style={{ borderBottom: '3px solid #007b52' }}>
      <img src="/brand/logo-primary.png" alt={s.company_name} style={{ height: 52 }} />
      <div style={{ textAlign: 'right', fontSize: 10.5, lineHeight: 1.45 }}><b style={{ fontSize: 12.5 }}>{s.company_name}</b>{s.company_name_ar && <div dir="rtl" style={{ fontWeight: 700 }}>{s.company_name_ar}</div>}<div style={{ whiteSpace: 'pre-line' }}>{s.company_address}</div>{s.company_phone && <div>Tel {s.company_phone}</div>}<div>{s.company_email}{s.company_info_email && s.company_info_email !== s.company_email ? ` · ${s.company_info_email}` : ''}{s.company_website ? ` · ${String(s.company_website).replace(/^https?:\/\//, '')}` : ''}</div>{s.company_trn && <div>TRN {s.company_trn}</div>}{s.company_trade_license && <div>Trade licence {s.company_trade_license}{s.licence_authority ? ` · ${s.licence_authority}` : ''}</div>}</div>
    </div>
  )
}
const AR_T: Record<string, string> = { 'TAX INVOICE': 'فاتورة ضريبية', 'CREDIT NOTE': 'إشعار دائن', 'DEBIT NOTE': 'إشعار مدين', 'PROFORMA INVOICE': 'فاتورة مبدئية', QUOTATION: 'عرض سعر', 'RECEIPT VOUCHER': 'سند قبض', 'PAYMENT VOUCHER': 'سند صرف', 'DELIVERY ORDER': 'أمر تسليم', 'GOODS RECEIPT NOTE': 'إشعار استلام بضائع', 'DISPATCH NOTE': 'إشعار صرف بضائع', 'TRIP SHEET / PROOF OF DELIVERY': 'بيان رحلة / إثبات التسليم', 'JOB REPORT': 'تقرير الشحنة', 'STATEMENT OF ACCOUNT': 'كشف حساب', 'PURCHASE ORDER': 'أمر شراء', INVOICE: 'فاتورة' }
const Title = ({ children, sub, watermark }: { children: ReactNode; sub?: ReactNode; watermark?: string }) => <div className="flex items-end justify-between mb-3 relative"><h1>{children}{typeof children === 'string' && AR_T[children.toUpperCase()] && <div dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif", fontSize: 16, fontWeight: 700, marginTop: 2 }}>{AR_T[children.toUpperCase()]}</div>}</h1><div style={{ textAlign: 'right' }}>{sub}</div>{watermark && <div style={{ position: 'absolute', left: '28%', top: 40, transform: 'rotate(-12deg)', fontSize: 54, fontWeight: 800, color: '#c32135', opacity: 0.12, pointerEvents: 'none', whiteSpace: 'nowrap' }}>{watermark}</div>}</div>
const Box = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => <div className={`box ${className ?? ''}`}><div className="lbl">{label}</div><div style={{ whiteSpace: 'pre-line' }}>{children || ' '}</div></div>
const Grid = ({ cols = 3, children }: { cols?: number; children: ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 10 }}>{children}</div>
const Kv = ({ items }: { items: [string, ReactNode][] }) => <div className="box" style={{ padding: 0 }}><table style={{ margin: 0 }}><tbody>{items.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => <tr key={k}><td className="lbl" style={{ width: '42%', border: 0, padding: '3px 10px' }}>{k}</td><td style={{ border: 0, padding: '3px 10px', fontWeight: 600 }}>{v}</td></tr>)}</tbody></table></div>
const R = ({ children }: { children: ReactNode }) => <td style={{ textAlign: 'right' }}>{children}</td>
function Sign({ labels }: { labels: string[] }) { return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, 1fr)`, gap: 28, marginTop: 46 }}>{labels.map(l => <div key={l} style={{ borderTop: '1px solid #444', paddingTop: 4, fontSize: 10, textAlign: 'center' }}>{l}</div>)}</div> }
const Foot = ({ children }: { children?: ReactNode }) => <div style={{ marginTop: 18, paddingTop: 8, borderTop: '1px solid #dfe6e1', fontSize: 9.5, color: '#5b6c63' }}>{children ?? S().invoice_footer}</div>
const addr = (p: any) => [p?.address1, p?.address2, [p?.city, p?.state].filter(Boolean).join(', '), p?._labels?.country_id, p?.po_box && `PO Box ${p.po_box}`].filter(Boolean).join('\n')
const party = (p: any) => p ? `${p.name}\n${addr(p)}${p.trn ? `\nTRN ${p.trn}` : ''}${p.phone ? `\nTel ${p.phone}` : ''}` : ''

function useRec(entity: string, id: string) { return useQuery({ queryKey: ['print', entity, id], queryFn: () => get<any>(`/api/e/${entity}/${id}`) }) }

function InvoiceDoc({ r }: { r: any }) {
  const s = S(); const p = useQuery({ queryKey: ['print-party', r.party_id], queryFn: () => get<any>(`/api/e/parties/${r.party_id}`) })
  const bank = useQuery({ queryKey: ['print-bank', r.bank_account_id], enabled: !!r.bank_account_id, queryFn: () => get<any>(`/api/e/bank_accounts/${r.bank_account_id}`) })
  const lines = r.children.lines as any[]; const credit = r.doc_type === 'Credit Note'
  return (<>
    <Title watermark={r.status === 'Draft' ? 'DRAFT' : r.status === 'Void' ? 'VOID' : undefined} sub={<><div style={{ fontSize: 15, fontWeight: 800 }}>{r.invoice_no}</div><div style={{ color: '#5b6c63' }}>{r.status}</div></>}>{r.doc_type === 'Tax Invoice' ? (s.vat_registered === false ? 'INVOICE' : 'TAX INVOICE') : r.doc_type.toUpperCase()}</Title>
    <Grid cols={2}><Box label="Bill to">{p.data ? party(p.data) : r._labels.party_id}</Box><Kv items={[['Document no.', r.invoice_no], ['Date', fmtDate(r.invoice_date)], ['Date of supply', r.supply_date ? fmtDate(r.supply_date) : ''], ['Due date', fmtDate(r.due_date)], ['Currency', r.currency], ['Our job ref.', r._labels.job_id], ['Customer ref.', r.reference], ['Against invoice', r._labels.original_invoice_id], ['Reason', r.credit_reason], ['Exchange rate', r.currency !== 'AED' ? `1 ${r.currency} = ${r.ex_rate} AED` : ''], ['Supplier TRN', s.company_trn]]} /></Grid>
    <table><thead><tr><th style={{ width: 24 }}>#</th><th>Description</th><th style={{ textAlign: 'right' }}>Qty</th><th>Unit</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right' }}>VAT %</th><th style={{ textAlign: 'right' }}>VAT</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead><tbody>
      {lines.map((l, i) => <tr key={l.id}><td>{i + 1}</td><td>{l.description}</td><R>{fmtNum(l.qty)}</R><td>{l.unit}</td><R>{fmtMoney(l.rate)}</R><R>{fmtMoney(l.amount)}</R><R>{fmtNum(l.vat_pct)}</R><R>{fmtMoney(l.vat_amount)}</R><R>{fmtMoney(l.line_total)}</R></tr>)}</tbody></table>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><table style={{ width: '46%' }}><tbody><tr><td>Subtotal ({r.currency})</td><R>{fmtMoney(r.subtotal)}</R></tr><tr><td>VAT</td><R>{fmtMoney(r.vat_total)}</R></tr>{r.currency !== 'AED' && <tr><td>VAT in AED @ {r.ex_rate}</td><R>{fmtMoney(r.vat_total * r.ex_rate)}</R></tr>}<tr style={{ fontWeight: 800, fontSize: 13, background: '#dcf1e6' }}><td>{credit ? 'Total credit' : 'Total due'} ({r.currency})</td><R>{fmtMoney(r.total)}</R></tr>{r.currency !== 'AED' && <tr><td style={{ color: '#5b6c63' }}>Total in AED @ {r.ex_rate}</td><R>{fmtMoney(r.base_total)}</R></tr>}{r.paid_amount > 0 && <tr><td>Paid</td><R>{fmtMoney(r.paid_amount)}</R></tr>}{r.balance > 0 && r.paid_amount > 0 && <tr style={{ fontWeight: 700 }}><td>Balance</td><R>{fmtMoney(r.balance)}</R></tr>}</tbody></table></div>
    <Grid cols={2}>{(bank.data || s.bank_details) && <Box label="Payment details">{bank.data ? `${bank.data.name}\n${bank.data.bank_name ?? ''}\nIBAN ${bank.data.iban ?? ''}  SWIFT ${bank.data.swift ?? ''}\nCurrency ${bank.data.currency}` : s.bank_details}</Box>}<Box label="Notes / terms">{[r.notes, r.terms].filter(Boolean).join('\n\n')}</Box></Grid>
    <Foot />
  </>)
}

function QuoteDoc({ r }: { r: any }) {
  const p = useQuery({ queryKey: ['print-party', r.customer_id], queryFn: () => get<any>(`/api/e/parties/${r.customer_id}`) })
  const lines = r.children.lines as any[]; const L = r._labels
  return (<>
    <Title watermark={r.status === 'Draft' ? 'DRAFT' : undefined} sub={<><div style={{ fontSize: 15, fontWeight: 800 }}>{r.quote_no}</div><div style={{ color: '#5b6c63' }}>Revision {r.revision}</div></>}>QUOTATION</Title>
    <Grid cols={2}><Box label="Prepared for">{p.data ? party(p.data) : L.customer_id}{L.contact_id ? `\nAttn: ${L.contact_id}` : ''}</Box><Kv items={[['Date', fmtDate(r.quote_date)], ['Valid until', fmtDate(r.valid_until)], ['Service', `${r.mode}${r.trade ? ' · ' + r.trade : ''}`], ['Incoterms', r.inco_terms], ['Service type', r.service_type], ['Prepared by', L.salesperson_id], ['Currency', r.currency]]} /></Grid>
    <Grid cols={2}><Box label="Route">{[L.pol_id && `Origin / POL: ${L.pol_id}`, L.pod_id && `Destination / POD: ${L.pod_id}`, r.place_of_receipt && `Place of receipt: ${r.place_of_receipt}`, r.place_of_delivery && `Place of delivery: ${r.place_of_delivery}`].filter(Boolean).join('\n')}</Box><Box label="Cargo">{[r.commodity, r.equipment, r.packages && `${r.packages} packages`, r.gross_weight && `${r.gross_weight} kg`, r.volume_cbm && `${r.volume_cbm} CBM`, r.is_hazardous && 'Dangerous goods'].filter(Boolean).join(' · ')}</Box></Grid>
    <table><thead><tr><th>Charge description</th><th>Basis</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>VAT</th></tr></thead><tbody>{lines.map(l => <tr key={l.id}><td>{l.description}</td><td>{l.basis}</td><R>{fmtNum(l.qty)}</R><R>{fmtMoney(l.rate)}</R><R>{fmtMoney(l.amount)}</R><R>{fmtMoney(l.vat_amount)}</R></tr>)}</tbody></table>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><table style={{ width: '42%' }}><tbody><tr><td>Total ({r.currency})</td><R>{fmtMoney(r.subtotal)}</R></tr><tr><td>VAT</td><R>{fmtMoney(r.vat_total)}</R></tr><tr style={{ fontWeight: 800, background: '#dcf1e6' }}><td>Total incl. VAT</td><R>{fmtMoney(r.total)}</R></tr></tbody></table></div>
    <Box label="Terms & conditions" className="mt-3"><span style={{ fontSize: 10 }}>{r.terms}</span></Box>
    <Sign labels={['For Elvora Shipping L.L.C.', 'Accepted by customer (name, signature, date)']} /><Foot>Quotation valid until {fmtDate(r.valid_until)}. Subject to space, equipment and carrier acceptance. {S().invoice_footer}</Foot>
  </>)
}

function VoucherDoc({ r, kind }: { r: any; kind: 'receipt' | 'payment' }) {
  const L = r._labels; const isR = kind === 'receipt'
  return (<>
    <Title sub={<div style={{ fontSize: 15, fontWeight: 800 }}>{isR ? r.receipt_no : r.payment_no}</div>} watermark={r.status !== 'Posted' ? r.status.toUpperCase() : undefined}>{isR ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'}</Title>
    <Grid cols={2}><Box label={isR ? 'Received from' : 'Paid to'}>{isR ? L.party_id : L.vendor_id}</Box><Kv items={[['Date', fmtDate(isR ? r.receipt_date : r.payment_date)], ['Method', r.method], [isR ? 'Deposited to' : 'Paid from', L.bank_account_id], ['Reference', r.reference], ['Currency', r.currency]]} /></Grid>
    <div className="box" style={{ textAlign: 'center', padding: 16, marginBottom: 10 }}><div className="lbl">Amount</div><div style={{ fontSize: 26, fontWeight: 800 }}>{r.currency} {fmtMoney(r.amount)}</div></div>
    {r.children.allocations.length > 0 && <table><thead><tr><th>Applied to</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>{r.children.allocations.map((a: any) => <tr key={a.id}><td>{a._labels.invoice_id ?? a._labels.bill_id}</td><R>{fmtMoney(a.amount)}</R></tr>)}</tbody></table>}
    {r.unallocated > 0 && <p>On account / unallocated: <b>{fmtMoney(r.unallocated)}</b></p>}{r.notes && <p>{r.notes}</p>}
    <Sign labels={[isR ? 'Received by' : 'Prepared by', isR ? 'Customer' : 'Approved by', isR ? '' : 'Received by (vendor)'].filter(Boolean)} /><Foot />
  </>)
}

function StockDoc({ r, kind }: { r: any; kind: 'grn' | 'dispatch' }) {
  const L = r._labels; const g = kind === 'grn'
  return (<>
    <Title sub={<div style={{ fontSize: 15, fontWeight: 800 }}>{g ? r.grn_no : r.dispatch_no}</div>} watermark={r.status !== 'Posted' ? r.status.toUpperCase() : undefined}>{g ? 'GOODS RECEIPT NOTE' : 'DISPATCH NOTE'}</Title>
    <Grid cols={2}><Kv items={[['Warehouse', L.warehouse_id], ['Owner (customer)', L.customer_id], ['Job', L.job_id], [g ? 'Received at' : 'Dispatched at', fmtDateTime(g ? r.received_at : r.dispatch_at)], ['Vehicle / driver', [r.vehicle_no, r.driver_name].filter(Boolean).join(' / ')], [g ? 'Delivery note' : 'Deliver to', g ? r.delivery_note : r.consignee]]} /><Box label="Remarks">{r.remarks}</Box></Grid>
    <table><thead><tr><th>Item</th><th>Lot</th>{g && <th>Expiry</th>}<th>Bin</th>{g && <th>Condition</th>}<th style={{ textAlign: 'right' }}>Qty</th></tr></thead><tbody>{r.children.lines.map((l: any) => <tr key={l.id}><td>{l._labels.item_id}</td><td>{l.lot_no}</td>{g && <td>{fmtDate(l.expiry_date)}</td>}<td>{l._labels.location_id}</td>{g && <td>{l.condition}</td>}<R>{fmtNum(l.qty)}</R></tr>)}</tbody></table>
    <Sign labels={g ? ['Delivered by', 'Received by (warehouse)'] : ['Issued by (warehouse)', 'Driver', 'Received by']} /><Foot />
  </>)
}

function DoDoc({ r }: { r: any }) {
  const job = useQuery({ queryKey: ['print-job', r.job_id], queryFn: () => get<any>(`/api/e/jobs/${r.job_id}`) })
  const j = job.data; const L = j?._labels ?? {}
  return (<>
    <Title sub={<div style={{ fontSize: 15, fontWeight: 800 }}>{r.do_no}</div>} watermark={r.status === 'Draft' ? 'DRAFT' : r.status === 'Cancelled' ? 'CANCELLED' : undefined}>DELIVERY ORDER</Title>
    {!j ? <DocumentPrinter /> : <><Grid cols={2}><Box label="Deliver / release to">{r._labels.issued_to_id}</Box><Kv items={[['DO date', fmtDate(r.do_date)], ['Valid until', fmtDate(r.valid_until)], ['Job no.', j.job_no], ['MBL / AWB', j.mbl_no], ['HBL / HAWB', j.hbl_no], ['Vessel / flight', [j.vessel_name, j.voyage_no].filter(Boolean).join(' ')], ['Port of discharge', L.pod_id], ['ETA / ATA', fmtDateTime(j.ata ?? j.eta)]]} /></Grid>
      <Grid cols={1}><Box label="Description of goods">{[j.commodity, j.packages && `${j.packages} ${j.package_type ?? 'packages'}`, j.gross_weight && `Gross weight ${j.gross_weight} kg`, j.volume_cbm && `${j.volume_cbm} CBM`, j.marks_no && `Marks: ${j.marks_no}`].filter(Boolean).join(' · ')}</Box></Grid>
      {j.children.containers.length > 0 && <table><thead><tr><th>Container</th><th>Type</th><th>Seal</th><th style={{ textAlign: 'right' }}>Gross wt</th></tr></thead><tbody>{j.children.containers.map((c: any) => <tr key={c.id}><td>{c.container_no}</td><td>{c._labels.type_id}</td><td>{c.seal_no}</td><R>{fmtNum(c.gross_weight)}</R></tr>)}</tbody></table>}
      {r.release_note && <Box label="Release conditions" className="mt-2">{r.release_note}</Box>}</>}
    <Sign labels={['For Elvora Shipping L.L.C.', 'Received by (name, ID, signature, date)']} /><Foot>Please present this delivery order with a valid ID at the terminal / warehouse. Delivery is subject to clearance of all charges and the Company's standard trading conditions.</Foot>
  </>)
}

function TripDoc({ r }: { r: any }) {
  return (<>
    <Title sub={<div style={{ fontSize: 15, fontWeight: 800 }}>{r.order_no}</div>}>TRIP SHEET / PROOF OF DELIVERY</Title>
    <Grid cols={2}><Kv items={[['Customer', r._labels.customer_id], ['Job', r._labels.job_id], ['Type', r.type], ['Vehicle', r._labels.vehicle_id], ['Driver', r._labels.driver_id], ['Subcontractor', r._labels.subcontractor_id], ['Container', r.container_no]]} /><Kv items={[['Pick-up', r.pickup_location], ['Pick-up time', fmtDateTime(r.pickup_at)], ['Delivery', r.delivery_location], ['Delivery time', fmtDateTime(r.delivery_at)], ['Cargo', r.cargo_description], ['Weight (kg)', r.weight_kg]]} /></Grid>
    {r.instructions && <Box label="Instructions">{r.instructions}</Box>}
    <div className="box" style={{ marginTop: 14, minHeight: 130 }}><div className="lbl">Proof of delivery</div>{r.pod_signature ? <div><img src={r.pod_signature} alt="Signature" style={{ height: 80 }} /><div>Received by <b>{r.pod_signed_by}</b> · {fmtDateTime(r.pod_at)}</div></div> : <div style={{ height: 80 }} />}</div>
    <Sign labels={['Driver', 'Consignee stamp & signature']} /><Foot />
  </>)
}

function GenericDoc({ r, title, items, lines, cols }: { r: any; title: string; items: [string, ReactNode][]; lines?: any[]; cols?: { h: string; f: (l: any) => ReactNode; right?: boolean }[] }) {
  return (<>
    <Title sub={<div style={{ fontSize: 15, fontWeight: 800 }}>{r._title}</div>}>{title}</Title>
    <Kv items={items} />
    {lines && cols && <table style={{ marginTop: 10 }}><thead><tr>{cols.map(c => <th key={c.h} style={{ textAlign: c.right ? 'right' : 'left' }}>{c.h}</th>)}</tr></thead><tbody>{lines.map((l, i) => <tr key={i}>{cols.map(c => c.right ? <R key={c.h}>{c.f(l)}</R> : <td key={c.h}>{c.f(l)}</td>)}</tr>)}</tbody></table>}
    <Foot />
  </>)
}

function JobDoc({ j, doc }: { j: any; doc: string | null }) {
  const L = j._labels; const [qr, setQr] = useState('')
  useEffect(() => { void QRCode.toDataURL(`${location.origin}/jobs/${j.id}`, { margin: 0, width: 140 }).then(setQr) }, [j.id])
  const parties = useQuery({ queryKey: ['print-jobparties', j.id], queryFn: async () => { const ids = [j.shipper_id ?? j.client_id, j.consignee_id, j.notify_id].filter(Boolean); const out: Record<number, any> = {}; await Promise.all(ids.map(async (id: number) => { out[id] = await get<any>(`/api/e/parties/${id}`) })); return out } })
  const pp = (id?: number) => (id && parties.data?.[id] ? party(parties.data[id]) : id === j.shipper_id ? L.shipper_id : id === j.consignee_id ? L.consignee_id : '')
  const cont = j.children.containers as any[]; const air = j.mode === 'Air'
  if (doc === 'bl' || doc === 'awb') {
    const awb = doc === 'awb'
    return (<>
      <Title watermark="DRAFT – NON NEGOTIABLE" sub={<div style={{ fontSize: 14, fontWeight: 800 }}>{j.hbl_no || j.job_no}</div>}>{awb ? 'HOUSE AIR WAYBILL (DRAFT)' : 'HOUSE BILL OF LADING (DRAFT)'}</Title>
      <Grid cols={2}><Box label="Shipper">{pp(j.shipper_id ?? j.client_id) || L.client_id}</Box><Box label={awb ? 'House AWB no. / Master AWB no.' : 'B/L no. / Master B/L no.'}>{`${j.hbl_no ?? ''}\n${j.mbl_no ?? ''}`}</Box><Box label="Consignee">{pp(j.consignee_id)}</Box><Box label="Notify party">{pp(j.notify_id) || 'SAME AS CONSIGNEE'}</Box></Grid>
      <Grid cols={awb ? 3 : 4}><Box label={awb ? 'Airline / flight' : 'Vessel / voyage'}>{[L.carrier_id, j.vessel_name, j.voyage_no].filter(Boolean).join(' · ')}</Box><Box label={awb ? 'Airport of departure' : 'Port of loading'}>{L.pol_id}</Box><Box label={awb ? 'Airport of destination' : 'Port of discharge'}>{L.pod_id}</Box>{!awb && <Box label="Place of delivery">{j.place_of_delivery || L.pof_id}</Box>}</Grid>
      <table><thead><tr><th>Marks &amp; numbers / containers</th><th>Packages &amp; description of goods</th><th style={{ textAlign: 'right' }}>Gross weight (kg)</th>{awb ? <th style={{ textAlign: 'right' }}>Chargeable (kg)</th> : <th style={{ textAlign: 'right' }}>Measurement (CBM)</th>}</tr></thead><tbody><tr style={{ height: 120 }}><td>{j.marks_no}{cont.map(c => <div key={c.id}>{c.container_no} / {c.seal_no}</div>)}</td><td>{[j.packages && `${j.packages} ${j.package_type ?? 'PKGS'}`, j.commodity].filter(Boolean).join(' — ')}{j.is_hazardous === 'Yes' && <div style={{ fontWeight: 700 }}>DANGEROUS GOODS</div>}{j.handling_info && <div style={{ marginTop: 6, fontSize: 10 }}>{j.handling_info}</div>}</td><R>{fmtNum(j.gross_weight)}</R><R>{awb ? fmtNum(j.chargeable_weight ?? j.gross_weight) : fmtNum(j.volume_cbm, 3)}</R></tr></tbody></table>
      <Grid cols={3}><Box label="Freight">{j.freight_terms}</Box><Box label="Freight payable at">{j.payable_at}</Box><Box label="Number of originals">{j.no_originals}</Box></Grid>
      <Grid cols={2}><Box label="Place and date of issue">{`${j.bl_place_of_issue ?? ''} ${fmtDate(j.hbl_date)}`}</Box><Box label="For the carrier / forwarder">Elvora Shipping L.L.C.{'\n\n\n'}as agent</Box></Grid>
      <Foot>Draft for review only — not a negotiable document. Issued subject to the Company's standard trading conditions. Particulars declared by the shipper.</Foot></>)
  }
  if (doc === 'labels') {
    const n = Math.max(1, Math.min(200, Number(j.packages) || 1))
    return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{Array.from({ length: n }, (_, i) => <div key={i} className="box" style={{ pageBreakInside: 'avoid', padding: 12 }}><div className="flex justify-between items-start"><img src="/brand/logo-primary.png" alt="" style={{ height: 30 }} />{qr && <img src={qr} alt="" style={{ height: 62 }} />}</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{j.job_no}</div><div style={{ fontSize: 11 }}>To: <b>{L.consignee_id ?? L.client_id}</b></div><div style={{ fontSize: 11 }}>Dest: <b>{L.pod_id}</b></div><div style={{ fontSize: 11 }}>HBL: {j.hbl_no ?? '—'} · {j.gross_weight ? `${j.gross_weight} kg` : ''}</div><div style={{ fontSize: 24, fontWeight: 800, textAlign: 'right' }}>{i + 1} / {n}</div></div>)}</div>
  }
  // internal job report
  return (<>
    <Title sub={<><div style={{ fontSize: 16, fontWeight: 800 }}>{j.job_no}</div><div style={{ color: '#5b6c63' }}>{j.job_status} · {fmtDate(j.job_date)}</div></>}>JOB REPORT</Title>
    <Grid cols={3}><Kv items={[['Client', L.client_id], ['Branch', L.branch_id], ['Department', j.department], ['Trade', j.trade], ['INCO terms', j.inco_terms], ['Freight', j.freight_terms], ['Service type', j.service_type]]} /><Kv items={[['MBL / MAWB', j.mbl_no], ['HBL / HAWB', j.hbl_no], ['Booking no.', j.booking_no], ['Carrier', L.carrier_id], ['Vessel / flight', [j.vessel_name, j.voyage_no].filter(Boolean).join(' ')], ['DO no.', j.do_no], ['SB / BOE', [j.sb_no, j.boe_no].filter(Boolean).join(' / ')]]} /><Kv items={[['POR', L.por_id], ['POL', L.pol_id], ['POD', L.pod_id], ['POF', L.pof_id], ['ETD / ATD', `${fmtDateTime(j.etd)} / ${fmtDateTime(j.atd)}`], ['ETA / ATA', `${fmtDateTime(j.eta)} / ${fmtDateTime(j.ata)}`], ['Operational status', j.operational_status]]} /></Grid>
    <Grid cols={2}><Box label="Cargo">{[j.commodity, j.packages && `${j.packages} ${j.package_type ?? 'pkgs'}`, j.gross_weight && `${j.gross_weight} kg`, j.volume_cbm && `${j.volume_cbm} CBM`, j.containers_summary].filter(Boolean).join(' · ')}</Box><Box label="Shipper → Consignee">{`${L.shipper_id ?? '—'}\n→ ${L.consignee_id ?? '—'}`}</Box></Grid>
    {cont.length > 0 && <><div className="lbl" style={{ margin: '6px 0 3px' }}>Containers</div><table><thead><tr><th>Container</th><th>Type</th><th>Seal</th><th>Status</th><th style={{ textAlign: 'right' }}>Gross wt</th></tr></thead><tbody>{cont.map(c => <tr key={c.id}><td>{c.container_no}</td><td>{c._labels.type_id}</td><td>{c.seal_no}</td><td>{c.status}</td><R>{fmtNum(c.gross_weight)}</R></tr>)}</tbody></table></>}
    <div className="lbl" style={{ margin: '10px 0 3px' }}>Charges</div><table><thead><tr><th>Type</th><th>Charge</th><th>Party</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th>Cur</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>AED</th><th>Status</th></tr></thead><tbody>{j.children.charges.map((c: any) => <tr key={c.id}><td>{c.kind}</td><td>{c.description}</td><td>{c._labels.party_id}</td><R>{fmtNum(c.qty)}</R><R>{fmtMoney(c.rate)}</R><td>{c.currency}</td><R>{fmtMoney(c.amount)}</R><R>{fmtMoney(c.base_amount)}</R><td>{c.status}</td></tr>)}</tbody></table>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><table style={{ width: '40%' }}><tbody><tr><td>Revenue (AED)</td><R>{fmtMoney(j.total_revenue)}</R></tr><tr><td>Cost (AED)</td><R>{fmtMoney(j.total_cost)}</R></tr><tr style={{ fontWeight: 800, background: '#dcf1e6' }}><td>Profit (AED)</td><R>{fmtMoney(j.profit)}</R></tr></tbody></table></div>
    {j.children.events.length > 0 && <><div className="lbl" style={{ margin: '10px 0 3px' }}>Milestones</div><table><tbody>{[...j.children.events].sort((a: any, b: any) => String(a.event_at).localeCompare(String(b.event_at))).map((e: any) => <tr key={e.id}><td style={{ width: 120 }}>{fmtDateTime(e.event_at)}</td><td>{e.event_type}</td><td>{[e.location, e.description].filter(Boolean).join(' – ')}</td></tr>)}</tbody></table></>}
    <Foot>Internal document — contains cost and profit information. Printed {fmtDate(todayIso())}.</Foot>
  </>)
}

function StatementDoc({ partyId }: { partyId: string }) {
  const [from, setFrom] = useState(todayIso().slice(0, 4) + '-01-01'); const [to, setTo] = useState(todayIso())
  const q = useQuery({ queryKey: ['statement', partyId, from, to], queryFn: () => get<any>(`/api/finance/statement/${partyId}`, { from, to }) })
  const s = q.data
  return (<>
    <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 160 }} /><input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 160 }} /></div>
    <Title sub={<div>{fmtDate(from)} – {fmtDate(to)}</div>}>STATEMENT OF ACCOUNT</Title>
    {!s ? <DocumentPrinter /> : <><Grid cols={2}><Box label="Account">{`${s.party.name}\n${s.party.code}${s.party.trn ? `\nTRN ${s.party.trn}` : ''}`}</Box><Kv items={[['Opening balance (AED)', fmtMoney(s.opening)], ['Closing balance (AED)', fmtMoney(s.closing)]]} /></Grid>
      <table><thead><tr><th>Date</th><th>Type</th><th>Document</th><th>Description</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead><tbody><tr><td colSpan={6}><i>Opening balance</i></td><R>{fmtMoney(s.opening)}</R></tr>{s.rows.map((r: any, i: number) => <tr key={i}><td>{fmtDate(r.date)}</td><td>{r.type}</td><td>{r.doc_no}</td><td>{r.description}</td><R>{r.debit ? fmtMoney(r.debit) : ''}</R><R>{r.credit ? fmtMoney(r.credit) : ''}</R><R>{fmtMoney(r.balance)}</R></tr>)}<tr style={{ fontWeight: 800, background: '#dcf1e6' }}><td colSpan={6}>Closing balance (AED) — positive = amount due to Elvora</td><R>{fmtMoney(s.closing)}</R></tr></tbody></table><Foot>Please notify us of any discrepancy within 7 days. {S().invoice_footer}</Foot></>}
  </>)
}

function FreightDoc({r}:{r:any}) {return <><Title sub={`${r.doc_no} · revision ${r.revision}`} watermark={r.status==='Draft'?'DRAFT':'COPY'}>{r.kind==='HAWB'||r.kind==='MAWB'?'AIR WAYBILL WORKSHEET':'BILL OF LADING WORKSHEET'}</Title><Grid cols={2}><Box label="Shipper">{r.shipper}</Box><Box label="Consignee">{r.consignee}</Box><Box label="Notify party">{r.notify_party}</Box><Kv items={[['Job',r._labels.job_id],['Carrier document',r.carrier_document_no],['Vessel / flight',r.vessel_flight],['Origin',r.origin],['Destination',r.destination],['Release mode',r.release_mode],['Approval',r.status]]}/></Grid><Box label="Description of goods">{r.goods}</Box><Grid><Box label="Packages">{r.packages}</Box><Box label="Gross weight kg">{r.gross_weight}</Box><Box label="Volume CBM">{r.volume_cbm}</Box></Grid><Box label="Terms">{r.terms}</Box><Sign labels={['Prepared by','Reviewed by']}/><Foot>This is a controlled internal worksheet copy. Carrier originals and negotiable documents require the authorised carrier form and issuance process. Printing does not issue an original or authorise cargo release.</Foot></>}

export function PrintPage() {
  const { entity = '', id = '' } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate()
  const { meta } = useMeta()
  const ids = entity === 'jobs' ? id.split(',') : [id]
  const q = useQuery({ queryKey: ['print-all', entity, id], enabled: entity !== 'statement' && entity !== 'parties', queryFn: () => Promise.all(ids.map(i => get<any>(`/api/e/${entity}/${i}`))) })
  const doc = sp.get('doc')
  const doDoc = useQuery({ queryKey: ['print-do', id], enabled: entity === 'jobs' && doc === 'do', queryFn: () => get<{ rows: any[] }>('/api/e/delivery_orders', { filters: JSON.stringify([{ field: 'job_id', op: 'eq', value: Number(id) }]), pageSize: 1 }) })
  useEffect(() => { if (doDoc.data?.rows[0]) nav(`/print/delivery_orders/${doDoc.data.rows[0].id}`, { replace: true }) }, [doDoc.data])
  if (!meta) return <DocumentPrinter />
  const body = (() => {
    if (entity === 'statement' || entity === 'parties') return <StatementDoc partyId={id} />
    if (entity === 'jobs' && doc === 'do') return doDoc.data && !doDoc.data.rows.length ? <p>No delivery order exists for this job yet. Create one from the job's Create menu.</p> : <DocumentPrinter />
    if (q.error) return <ErrorBox error={q.error} />
    if (!q.data) return <DocumentPrinter />
    const rs = q.data
    return rs.map((r, i) => {
      const e = <div key={i} style={{ pageBreakAfter: i < rs.length - 1 ? 'always' : 'auto' }}>{(() => { switch (entity) {
        case 'freight_documents': return <FreightDoc r={r} />
        case 'invoices': return <InvoiceDoc r={r} />
        case 'quotations': return <QuoteDoc r={r} />
        case 'receipts': return <VoucherDoc r={r} kind="receipt" />
        case 'payments': return <VoucherDoc r={r} kind="payment" />
        case 'grns': return <StockDoc r={r} kind="grn" />
        case 'dispatches': return <StockDoc r={r} kind="dispatch" />
        case 'delivery_orders': return <DoDoc r={r} />
        case 'transport_orders': return <TripDoc r={r} />
        case 'jobs': return <JobDoc j={r} doc={doc} />
        case 'shipments': return <GenericDoc r={r} title="SHIPMENT (SUB-JOB) SUMMARY" items={[['Sub-job', r.shipment_no], ['Master job', r._labels.job_id], ['Status', r.status], ['Shipper', r._labels.shipper_id], ['Consignee', r._labels.consignee_id], ['Notify', r._labels.notify_id], ['HBL / HAWB', r.hbl_no], ['Commodity', r.commodity], ['Packages', r.packages], ['Weight (kg)', r.gross_weight], ['Volume (CBM)', r.volume_cbm], ['Container', r.container_no]]} />
        case 'customs_declarations': return <GenericDoc r={r} title="CUSTOMS DECLARATION WORKSHEET" items={[['Reference', r.ref_no], ['Type', r.declaration_type], ['SB / BOE no.', r.declaration_no], ['Job', r._labels.job_id], ['Customs centre', r.customs_office], ['Broker', r._labels.broker_id], ['Status', r.status], ['Declared value', fmtMoney(r.total_value)], ['Duty', fmtMoney(r.duty_total)], ['VAT', fmtMoney(r.vat_total)]]} lines={r.children.lines} cols={[{ h: 'HS code', f: (l: any) => l._labels.hs_code_id ?? l.hs_text }, { h: 'Description', f: (l: any) => l.description }, { h: 'Origin', f: (l: any) => l._labels.origin_country_id }, { h: 'Value', f: (l: any) => fmtMoney(l.value), right: true }, { h: 'Duty', f: (l: any) => fmtMoney(l.duty_amount), right: true }, { h: 'VAT', f: (l: any) => fmtMoney(l.vat_amount), right: true }]} />
        case 'payslips': return <GenericDoc r={r} title="PAYSLIP" items={[['Employee', r._labels.employee_id], ['Period', r.period], ['Basic', fmtMoney(r.basic)], ['Allowances', fmtMoney(r.allowances)], ['Overtime', fmtMoney(r.overtime)], ['Deductions', fmtMoney(r.deductions)], ['Net pay (AED)', fmtMoney(r.net_pay)], ['Status', r.status]]} />
        case 'purchase_orders': return <GenericDoc r={r} title="PURCHASE ORDER" items={[['PO no.', r.po_no], ['Supplier', r._labels.vendor_id], ['Date', fmtDate(r.po_date)], ['Expected', fmtDate(r.expected_date)], ['Total', `${r.currency} ${fmtMoney(r.total)}`]]} lines={r.children.lines} cols={[{ h: 'Description', f: (l: any) => l.description }, { h: 'Qty', f: (l: any) => fmtNum(l.qty), right: true }, { h: 'Rate', f: (l: any) => fmtMoney(l.rate), right: true }, { h: 'Amount', f: (l: any) => fmtMoney(l.amount), right: true }, { h: 'VAT', f: (l: any) => fmtMoney(l.vat_amount), right: true }]} />
        case 'insurance_certs': return <GenericDoc r={r} title="CARGO INSURANCE CERTIFICATE (RECORD)" items={[['Certificate no.', r.certificate_no], ['Insured', r._labels.customer_id], ['Insurer', r.insurer], ['Policy no.', r.policy_no], ['Cover', r.cover_type], ['Voyage', r.voyage], ['Sum insured', `${r.currency} ${fmtMoney(r.insured_value)}`], ['Premium', fmtMoney(r.premium)], ['Cover period', `${fmtDate(r.cover_from)} – ${fmtDate(r.cover_to)}`], ['Commodity', r.commodity]]} />
        default: return <GenericDoc r={r} title={r._title} items={Object.entries(r).filter(([k, v]) => !k.startsWith('_') && typeof v !== 'object' && v !== null && !['id', 'version', 'created_by', 'updated_by'].includes(k)).slice(0, 24).map(([k, v]) => [k.replace(/_/g, ' '), String(v)] as [string, ReactNode])} />
      } })()}</div>
      return e
    })
  })()
  return (
    <div>
      <div className="no-print flex gap-2 mb-4 items-center"><button className="btn grey" onClick={() => nav(-1)}><ArrowLeft /> Back</button><button className="btn green" onClick={() => window.print()}><Printer /> Print / Save as PDF</button><span className="text-xs text-muted">In the print dialog choose “Save as PDF” to create a file.</span></div>
      <div className="print-sheet"><Letterhead />{body}</div>
    </div>
  )
}
void Link


