import { corporateFooterDetails } from '@shared/corporate-footer'
import { useMeta } from '../lib/meta'

/** One contact identity across Studio, print preview and browser printing. */
export function CorporateFooter({ note }: { note?: string }) {
  const { meta } = useMeta()
  const c = corporateFooterDetails(meta?.settings ?? {})
  return <div className="corporate-footer" data-notr="true">
    <div className="corporate-footer-identity"><strong>{c.name}</strong><span>{c.address}</span></div>
    <div className="corporate-footer-contact"><span>{[c.phone, c.email].filter(Boolean).join(' · ')}</span><strong>{c.website}</strong></div>
    {note && <div className="corporate-footer-note">{note}</div>}
  </div>
}
