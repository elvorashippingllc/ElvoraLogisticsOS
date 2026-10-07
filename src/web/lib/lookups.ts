import { useEffect, useState } from 'react'
import { get } from './api'

let vat: Record<number, number> | null = null
let pending: Promise<void> | null = null
export function useVatRates() {
  const [rates, setRates] = useState<Record<number, number>>(vat ?? {})
  useEffect(() => {
    if (vat) return
    pending ??= get<{ rows: any[] }>('/api/e/vat_codes', { pageSize: 100 }).then(r => { vat = Object.fromEntries(r.rows.map(x => [x.id, x.rate])) }).catch(() => { vat = {} })
    void pending.then(() => setRates(vat!))
  }, [])
  return rates
}
