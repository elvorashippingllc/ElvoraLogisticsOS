/** Shared by print, PDF download and email so document choices travel with the request. */
export function documentKind(entity: string, record?: any): string {
  if (entity === 'invoices') return record?.doc_type === 'Credit Note' ? 'credit note' : record?.doc_type === 'Debit Note' ? 'debit note' : 'invoice'
  return ({ quotations: 'quotation', purchase_orders: 'purchase order', receipts: 'receipt voucher', payments: 'payment voucher', statement: 'statement of account', parties: 'statement of account' } as Record<string, string>)[entity] ?? 'document'
}

export function documentNotice(entity: string, record?: any): string {
  const kind = documentKind(entity, record)
  return `This is a system-generated ${kind} and does not require ${entity === 'invoices' ? 'a' : 'an issuer’s'} signature.`
}

export function documentRecipient(record: any): string {
  const labels = record?._labels ?? {}
  return labels.party_id || labels.customer_id || labels.vendor_id || labels.issued_to_id || labels.client_id || labels.consignee_id || labels.employee_id || record?.consignee || 'To whom it may concern'
}

export function useDocumentSeal(value: string | null | undefined, defaultValue: boolean): boolean {
  return value === '1' ? true : value === '0' ? false : defaultValue
}
